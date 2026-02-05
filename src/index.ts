#!/usr/bin/env node
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { DocsDatabase, type DocMeta, type DocRow, type SearchResult } from "./db/docs-db.js";

const DEFAULT_SEARCH_LIMIT = 10;
const MAX_SEARCH_LIMIT = 50;
const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 200;
const DEFAULT_MAX_CONTENT_CHARS = 12000;
const MAX_CONTENT_CHARS = 50000;
const MAX_MATCHES = 5;
const MAX_COMPLETE_RESULTS = 25;

const PageRefSchema = z.object({
  url: z.string(),
  title: z.string(),
  category: z.string(),
  subcategory: z.string(),
  fetched_at: z.string().nullable().optional(),
  resource_uri: z.string(),
});

const PageSchema = PageRefSchema.extend({
  content_md: z.string().optional(),
  content_truncated: z.boolean().optional(),
});

const SearchResultSchema = PageRefSchema.extend({
  snippet: z.string(),
  rank: z.number(),
});

const SearchOutputSchema = z.object({
  query: z.string(),
  limit: z.number(),
  offset: z.number(),
  count: z.number(),
  results: z.array(SearchResultSchema),
});

const GetPageOutputSchema = z.object({
  kind: z.enum(["page", "matches", "not_found"]),
  page: PageSchema.optional(),
  matches: z.array(PageRefSchema).optional(),
  query: z.object({ url: z.string().optional(), title: z.string().optional() }).optional(),
  message: z.string().optional(),
});

const PageResultSchema = z.object({
  kind: z.enum(["page", "not_found"]),
  page: PageSchema.optional(),
  query: z.record(z.string(), z.string()).optional(),
  message: z.string().optional(),
});

const SectionSchema = z.object({
  category: z.string(),
  subcategory: z.string(),
  count: z.number(),
});

const ListSectionsOutputSchema = z.object({
  total_sections: z.number(),
  sections: z.array(SectionSchema),
});

const ListPagesOutputSchema = z.object({
  category: z.string(),
  subcategory: z.string().optional(),
  limit: z.number(),
  offset: z.number(),
  total: z.number(),
  pages: z.array(PageRefSchema),
});

const StatsOutputSchema = z.object({
  pages: z.number(),
  last_fetched_at: z.string().nullable(),
});

const contentOptionsSchema = z.object({
  include_content: z.boolean().optional().default(false),
  max_chars: z
    .number()
    .int()
    .min(500)
    .max(MAX_CONTENT_CHARS)
    .optional()
    .default(DEFAULT_MAX_CONTENT_CHARS),
});

function toResourceUri(url: string): string {
  return `runai-docs://page/${encodeURIComponent(url)}`;
}

function decodeResourceUrl(encoded: string): string {
  try {
    return decodeURIComponent(encoded);
  } catch (err) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid resource URL encoding");
  }
}

function pageToRef(page: DocMeta | DocRow): z.infer<typeof PageRefSchema> {
  return {
    url: page.url,
    title: page.title,
    category: page.category,
    subcategory: page.subcategory,
    fetched_at: page.fetched_at,
    resource_uri: toResourceUri(page.url),
  };
}

function buildPageMarkdown(page: DocRow): string {
  return `# ${page.title}\n\nSource: ${page.url}\nCategory: ${page.category}/${page.subcategory}\nFetched: ${page.fetched_at}\n\n${page.content_md}`;
}

function truncateContent(content: string, maxChars: number): { content: string; truncated: boolean } {
  if (content.length <= maxChars) {
    return { content, truncated: false };
  }
  return { content: `${content.slice(0, Math.max(0, maxChars - 3))}...`, truncated: true };
}

function pageWithContent(page: DocRow, includeContent: boolean, maxChars: number): z.infer<typeof PageSchema> {
  const base = pageToRef(page);
  if (!includeContent) {
    return base;
  }
  const markdown = buildPageMarkdown(page);
  const truncated = truncateContent(markdown, maxChars);
  return {
    ...base,
    content_md: truncated.content,
    content_truncated: truncated.truncated,
  };
}

function toResourceLink(meta: DocMeta | SearchResult | DocRow) {
  const annotations = meta.fetched_at ? { lastModified: meta.fetched_at } : undefined;
  return {
    type: "resource_link" as const,
    uri: toResourceUri(meta.url),
    name: meta.title,
    title: meta.title,
    description: `${meta.category}/${meta.subcategory}`,
    mimeType: "text/markdown",
    annotations,
  };
}

function toolError(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

function registerResources(server: McpServer, db: DocsDatabase) {
  const template = new ResourceTemplate("runai-docs://page/{url}", {
    list: () => {
      const pages = db.listAllPages();
      return {
        resources: pages.map((page) => ({
          uri: toResourceUri(page.url),
          name: page.title,
          title: page.title,
          description: `${page.category}/${page.subcategory}`,
          mimeType: "text/markdown",
          annotations: page.fetched_at ? { lastModified: page.fetched_at } : undefined,
          _meta: {
            url: page.url,
            category: page.category,
            subcategory: page.subcategory,
            fetched_at: page.fetched_at,
          },
        })),
      };
    },
    complete: {
      url: (value) => {
        if (!value) {
          return [];
        }
        const normalized = value.toLowerCase();
        const pages = db.listAllPages();
        const matches = pages.filter(
          (page) => page.url.toLowerCase().includes(normalized) || page.title.toLowerCase().includes(normalized)
        );
        return matches.slice(0, MAX_COMPLETE_RESULTS).map((page) => encodeURIComponent(page.url));
      },
    },
  });

  server.registerResource(
    "runai_doc_page",
    template,
    {
      title: "Run:ai documentation page",
      description: "Run:ai v2.24 documentation page (markdown)",
      mimeType: "text/markdown",
      annotations: {
        audience: ["assistant", "user"],
      },
    },
    (uri, variables) => {
      const encoded = typeof variables.url === "string" ? variables.url : "";
      if (!encoded) {
        throw new McpError(ErrorCode.InvalidParams, "Missing resource URL value");
      }
      const decoded = decodeResourceUrl(encoded);
      const page = db.getPage(decoded);
      if (!page) {
        throw new McpError(ErrorCode.InvalidParams, `Page not found for URL: ${decoded}`);
      }
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: "text/markdown",
            text: buildPageMarkdown(page),
            _meta: {
              url: page.url,
              category: page.category,
              subcategory: page.subcategory,
              title: page.title,
              fetched_at: page.fetched_at,
            },
          },
        ],
      };
    }
  );
}

function registerTools(server: McpServer, db: DocsDatabase) {
  server.registerTool(
    "search_docs",
    {
      title: "Search Run:ai docs",
      description:
        "Full-text search across Run:ai v2.24 documentation. Use for installation, APIs, configuration, Helm charts, CRDs, etc.",
      inputSchema: z.object({
        query: z
          .string()
          .trim()
          .min(1)
          .describe("Search query (supports FTS5 syntax: AND, OR, NOT, phrases in quotes)"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_SEARCH_LIMIT)
          .optional()
          .default(DEFAULT_SEARCH_LIMIT)
          .describe("Max results to return"),
        offset: z.number().int().min(0).max(1000).optional().default(0).describe("Offset for pagination"),
      }),
      outputSchema: SearchOutputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ query, limit, offset }) => {
      const results = db.search(query, limit, offset);
      const structuredResults = results.map((result) => ({
        ...pageToRef(result),
        snippet: result.snippet,
        rank: result.rank,
      }));
      const content = [
        {
          type: "text" as const,
          text: `Found ${results.length} result(s) for \"${query}\" (limit ${limit}, offset ${offset}).`,
        },
        ...results.map((result) => toResourceLink(result)),
      ];
      return {
        content,
        structuredContent: {
          query,
          limit,
          offset,
          count: results.length,
          results: structuredResults,
        },
      };
    }
  );

  server.registerTool(
    "get_page",
    {
      title: "Get documentation page",
      description: "Retrieve a Run:ai documentation page by URL or title match.",
      inputSchema: z.object({
        url: z.string().url().optional().describe("Full URL of the doc page"),
        title: z.string().trim().min(1).optional().describe("Partial title match (used if url not provided)"),
        include_content: contentOptionsSchema.shape.include_content,
        max_chars: contentOptionsSchema.shape.max_chars,
      }),
      outputSchema: GetPageOutputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ url, title, include_content, max_chars }) => {
      const provided = [url ? "url" : null, title ? "title" : null].filter(Boolean);
      if (provided.length !== 1) {
        return toolError("Provide exactly one of url or title.");
      }

      if (url) {
        const page = db.getPage(url);
        if (!page) {
          return {
            content: [{ type: "text", text: `Page not found for URL: ${url}` }],
            structuredContent: {
              kind: "not_found",
              query: { url },
              message: "Page not found",
            },
          };
        }
        const pageResult = pageWithContent(page, include_content, max_chars);
        return {
          content: [
            { type: "text", text: `Found page: ${page.title}` },
            toResourceLink(page),
          ],
          structuredContent: {
            kind: "page",
            page: pageResult,
            query: { url },
          },
        };
      }

      const matches = db.findPagesByTitle(title ?? "", MAX_MATCHES);
      if (matches.length === 0) {
        return {
          content: [{ type: "text", text: `No pages found matching title: ${title}` }],
          structuredContent: {
            kind: "not_found",
            query: { title },
            message: "No title matches",
          },
        };
      }

      if (matches.length > 1) {
        return {
          content: [
            { type: "text", text: `Multiple pages match \"${title}\". Choose a URL:` },
            ...matches.map((match) => toResourceLink(match)),
          ],
          structuredContent: {
            kind: "matches",
            matches: matches.map(pageToRef),
            query: { title },
            message: "Multiple title matches",
          },
        };
      }

      const page = db.getPage(matches[0].url);
      if (!page) {
        return {
          content: [{ type: "text", text: `Page not found for title match: ${title}` }],
          structuredContent: {
            kind: "not_found",
            query: { title },
            message: "Page not found",
          },
        };
      }

      const pageResult = pageWithContent(page, include_content, max_chars);
      return {
        content: [
          { type: "text", text: `Found page: ${page.title}` },
          toResourceLink(page),
        ],
        structuredContent: {
          kind: "page",
          page: pageResult,
          query: { title },
        },
      };
    }
  );

  server.registerTool(
    "list_sections",
    {
      title: "List documentation sections",
      description: "List all documentation categories and subcategories with page counts.",
      outputSchema: ListSectionsOutputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const sections = db.listCategories();
      return {
        content: [
          {
            type: "text",
            text: `Run:ai documentation sections (${sections.length}).`,
          },
        ],
        structuredContent: {
          total_sections: sections.length,
          sections,
        },
      };
    }
  );

  server.registerTool(
    "list_pages",
    {
      title: "List pages in a category",
      description: "List all pages in a documentation category, optionally filtered by subcategory.",
      inputSchema: z.object({
        category: z
          .enum(["installation", "infrastructure", "platform", "api", "workloads", "scheduler", "cli", "policies"])
          .describe("Documentation category"),
        subcategory: z.string().trim().min(1).optional().describe("Optional subcategory filter"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_LIST_LIMIT)
          .optional()
          .default(DEFAULT_LIST_LIMIT)
          .describe("Max results to return"),
        offset: z.number().int().min(0).max(2000).optional().default(0).describe("Offset for pagination"),
      }),
      outputSchema: ListPagesOutputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ category, subcategory, limit, offset }) => {
      const total = db.countByCategory(category, subcategory);
      const pages = db.listByCategory(category, limit, offset, subcategory);
      return {
        content: [
          {
            type: "text",
            text: `Pages in ${category}${subcategory ? `/${subcategory}` : ""}: ${pages.length} of ${total}.`,
          },
          ...pages.map((page) => toResourceLink(page)),
        ],
        structuredContent: {
          category,
          subcategory,
          limit,
          offset,
          total,
          pages: pages.map(pageToRef),
        },
      };
    }
  );

  server.registerTool(
    "get_doc_stats",
    {
      title: "Get docs database stats",
      description: "Return document count and last fetch timestamp for the docs database.",
      outputSchema: StatsOutputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const stats = db.getStats();
      return {
        content: [
          {
            type: "text",
            text: `Docs database contains ${stats.pages} pages. Last fetched at: ${stats.lastFetchedAt ?? "unknown"}.`,
          },
        ],
        structuredContent: {
          pages: stats.pages,
          last_fetched_at: stats.lastFetchedAt,
        },
      };
    }
  );

  server.registerTool(
    "get_helm_install_guide",
    {
      title: "Get Helm installation guide",
      description:
        "Get the Helm installation guide for Run:ai self-hosted deployment. Includes control plane and cluster installation, with connected and airgapped variants.",
      inputSchema: contentOptionsSchema.extend({
        component: z
          .enum(["control-plane", "cluster", "preparations", "upgrade", "uninstall"])
          .describe("Which installation component to get"),
      }),
      outputSchema: PageResultSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ component, include_content, max_chars }) => {
      const urlMap: Record<string, string> = {
        "control-plane":
          "https://run-ai-docs.nvidia.com/self-hosted/getting-started/installation/install-using-helm/install-control-plane",
        cluster:
          "https://run-ai-docs.nvidia.com/self-hosted/getting-started/installation/install-using-helm/helm-install",
        preparations:
          "https://run-ai-docs.nvidia.com/self-hosted/getting-started/installation/install-using-helm/preparations",
        upgrade:
          "https://run-ai-docs.nvidia.com/self-hosted/getting-started/installation/install-using-helm/upgrade",
        uninstall:
          "https://run-ai-docs.nvidia.com/self-hosted/getting-started/installation/install-using-helm/uninstall",
      };
      const page = db.getPage(urlMap[component]);
      if (!page) {
        return {
          content: [{ type: "text", text: `Page not found for component: ${component}. Run npm run scrape.` }],
          structuredContent: {
            kind: "not_found",
            query: { component },
            message: "Page not found",
          },
        };
      }
      const pageResult = pageWithContent(page, include_content, max_chars);
      return {
        content: [
          { type: "text", text: `Helm ${component} guide found.` },
          toResourceLink(page),
        ],
        structuredContent: {
          kind: "page",
          page: pageResult,
          query: { component },
        },
      };
    }
  );

  server.registerTool(
    "get_api_reference",
    {
      title: "Get REST API reference",
      description:
        "Get the REST API reference for a specific Run:ai management API endpoint (clusters, projects, departments, users, roles, access-rules, etc.).",
      inputSchema: contentOptionsSchema.extend({
        endpoint: z
          .enum([
            "clusters",
            "departments",
            "projects",
            "nodepools",
            "nodes",
            "tenant",
            "access-rules",
            "access-keys",
            "roles",
            "users",
            "service-accounts",
            "applications",
            "permissions",
            "tokens",
            "idps",
            "org-unit",
          ])
          .describe("API endpoint name"),
      }),
      outputSchema: PageResultSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ endpoint, include_content, max_chars }) => {
      const categoryMap: Record<string, string> = {
        clusters: "organizations/clusters",
        departments: "organizations/departments",
        projects: "organizations/projects",
        nodepools: "organizations/nodepools",
        nodes: "organizations/nodes",
        tenant: "organizations/tenant",
        "access-rules": "authentication-and-authorization/access-rules",
        "access-keys": "authentication-and-authorization/access-keys",
        roles: "authentication-and-authorization/roles",
        users: "authentication-and-authorization/users",
        "service-accounts": "authentication-and-authorization/service-accounts",
        applications: "authentication-and-authorization/applications",
        permissions: "authentication-and-authorization/permissions",
        tokens: "authentication-and-authorization/tokens",
        idps: "authentication-and-authorization/idps",
        "org-unit": "authentication-and-authorization/org-unit",
      };
      const url = `https://run-ai-docs.nvidia.com/api/2.24/${categoryMap[endpoint]}`;
      const page = db.getPage(url);
      if (!page) {
        return {
          content: [{ type: "text", text: `API reference for ${endpoint} not found. Run npm run scrape.` }],
          structuredContent: {
            kind: "not_found",
            query: { endpoint },
            message: "Page not found",
          },
        };
      }
      const pageResult = pageWithContent(page, include_content, max_chars);
      return {
        content: [
          { type: "text", text: `API reference for ${endpoint} found.` },
          toResourceLink(page),
        ],
        structuredContent: {
          kind: "page",
          page: pageResult,
          query: { endpoint },
        },
      };
    }
  );

  server.registerTool(
    "get_system_requirements",
    {
      title: "Get system requirements",
      description:
        "Get system requirements for Run:ai self-hosted deployment (support matrix, K8s versions, hardware, network requirements).",
      inputSchema: contentOptionsSchema.extend({
        component: z
          .enum(["support-matrix", "control-plane-requirements", "cluster-requirements", "network"])
          .describe("Which requirements to get"),
      }),
      outputSchema: PageResultSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ component, include_content, max_chars }) => {
      const urlMap: Record<string, string> = {
        "support-matrix": "https://run-ai-docs.nvidia.com/self-hosted/getting-started/installation/support-matrix",
        "control-plane-requirements":
          "https://run-ai-docs.nvidia.com/self-hosted/getting-started/installation/install-using-helm/cp-system-requirements",
        "cluster-requirements":
          "https://run-ai-docs.nvidia.com/self-hosted/getting-started/installation/install-using-helm/system-requirements",
        network:
          "https://run-ai-docs.nvidia.com/self-hosted/getting-started/installation/install-using-helm/network-requirements",
      };
      const page = db.getPage(urlMap[component]);
      if (!page) {
        return {
          content: [{ type: "text", text: `Requirements page not found. Run npm run scrape.` }],
          structuredContent: {
            kind: "not_found",
            query: { component },
            message: "Page not found",
          },
        };
      }
      const pageResult = pageWithContent(page, include_content, max_chars);
      return {
        content: [
          { type: "text", text: `Requirements page found for ${component}.` },
          toResourceLink(page),
        ],
        structuredContent: {
          kind: "page",
          page: pageResult,
          query: { component },
        },
      };
    }
  );

  server.registerTool(
    "get_rbac_info",
    {
      title: "Get RBAC information",
      description: "Get information about Run:ai RBAC model - roles, access rules, service accounts, authentication.",
      inputSchema: contentOptionsSchema.extend({
        topic: z.enum(["overview", "roles", "access-rules", "service-accounts", "cluster-auth"]).describe("RBAC topic"),
      }),
      outputSchema: PageResultSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ topic, include_content, max_chars }) => {
      const urlMap: Record<string, string> = {
        overview: "https://run-ai-docs.nvidia.com/self-hosted/infrastructure-setup/authentication/overview",
        roles: "https://run-ai-docs.nvidia.com/self-hosted/infrastructure-setup/authentication/roles",
        "access-rules": "https://run-ai-docs.nvidia.com/self-hosted/infrastructure-setup/authentication/accessrules",
        "service-accounts":
          "https://run-ai-docs.nvidia.com/self-hosted/infrastructure-setup/authentication/service-accounts",
        "cluster-auth":
          "https://run-ai-docs.nvidia.com/self-hosted/infrastructure-setup/authentication/cluster-authentication",
      };
      const page = db.getPage(urlMap[topic]);
      if (!page) {
        return {
          content: [{ type: "text", text: `RBAC topic not found. Run npm run scrape.` }],
          structuredContent: {
            kind: "not_found",
            query: { topic },
            message: "Page not found",
          },
        };
      }
      const pageResult = pageWithContent(page, include_content, max_chars);
      return {
        content: [
          { type: "text", text: `RBAC topic ${topic} found.` },
          toResourceLink(page),
        ],
        structuredContent: {
          kind: "page",
          page: pageResult,
          query: { topic },
        },
      };
    }
  );

  server.registerTool(
    "get_workload_info",
    {
      title: "Get workload documentation",
      description:
        "Get information about Run:ai workloads — types, submission, training, inference, workspaces, and assets.",
      inputSchema: contentOptionsSchema.extend({
        topic: z
          .enum([
            "introduction",
            "workloads-overview",
            "workload-types",
            "native-workloads",
            "supported-workload-types",
            "supported-features",
            "extending-workload-support",
            "submit-via-yaml",
            "workload-templates",
            "using-workspaces",
            "using-training",
            "train-models",
            "distributed-training",
            "using-inference",
            "inference-overview",
            "custom-inference",
            "nim-inference",
            "hugging-face-inference",
            "assets-overview",
            "environments",
            "compute-resources",
            "datasources",
            "credentials",
            "data-volumes",
            "ai-applications",
          ])
          .describe("Workload topic"),
      }),
      outputSchema: PageResultSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ topic, include_content, max_chars }) => {
      const urlMap: Record<string, string> = {
        introduction: "https://run-ai-docs.nvidia.com/self-hosted/workloads-in-nvidia-run-ai/introduction-to-workloads",
        "workloads-overview": "https://run-ai-docs.nvidia.com/self-hosted/workloads-in-nvidia-run-ai/workloads",
        "workload-types": "https://run-ai-docs.nvidia.com/self-hosted/workloads-in-nvidia-run-ai/workload-types",
        "native-workloads":
          "https://run-ai-docs.nvidia.com/self-hosted/workloads-in-nvidia-run-ai/workload-types/native-workloads",
        "supported-workload-types":
          "https://run-ai-docs.nvidia.com/self-hosted/workloads-in-nvidia-run-ai/workload-types/supported-workload-types",
        "supported-features":
          "https://run-ai-docs.nvidia.com/self-hosted/workloads-in-nvidia-run-ai/workload-types/supported-features",
        "extending-workload-support":
          "https://run-ai-docs.nvidia.com/self-hosted/workloads-in-nvidia-run-ai/workload-types/extending-workload-support",
        "submit-via-yaml": "https://run-ai-docs.nvidia.com/self-hosted/workloads-in-nvidia-run-ai/submit-via-yaml",
        "workload-templates": "https://run-ai-docs.nvidia.com/self-hosted/workloads-in-nvidia-run-ai/workload-templates",
        "using-workspaces": "https://run-ai-docs.nvidia.com/self-hosted/workloads-in-nvidia-run-ai/using-workspaces",
        "using-training": "https://run-ai-docs.nvidia.com/self-hosted/workloads-in-nvidia-run-ai/using-training",
        "train-models": "https://run-ai-docs.nvidia.com/self-hosted/workloads-in-nvidia-run-ai/using-training/train-models",
        "distributed-training":
          "https://run-ai-docs.nvidia.com/self-hosted/workloads-in-nvidia-run-ai/using-training/distributed-training-models",
        "using-inference": "https://run-ai-docs.nvidia.com/self-hosted/workloads-in-nvidia-run-ai/using-inference",
        "inference-overview":
          "https://run-ai-docs.nvidia.com/self-hosted/workloads-in-nvidia-run-ai/using-inference/nvidia-run-ai-inference-overview",
        "custom-inference":
          "https://run-ai-docs.nvidia.com/self-hosted/workloads-in-nvidia-run-ai/using-inference/custom-inference",
        "nim-inference": "https://run-ai-docs.nvidia.com/self-hosted/workloads-in-nvidia-run-ai/using-inference/nim-inference",
        "hugging-face-inference":
          "https://run-ai-docs.nvidia.com/self-hosted/workloads-in-nvidia-run-ai/using-inference/hugging-face-inference",
        "assets-overview": "https://run-ai-docs.nvidia.com/self-hosted/workloads-in-nvidia-run-ai/assets/overview",
        environments: "https://run-ai-docs.nvidia.com/self-hosted/workloads-in-nvidia-run-ai/assets/environments",
        "compute-resources":
          "https://run-ai-docs.nvidia.com/self-hosted/workloads-in-nvidia-run-ai/assets/compute-resources",
        datasources: "https://run-ai-docs.nvidia.com/self-hosted/workloads-in-nvidia-run-ai/assets/datasources",
        credentials: "https://run-ai-docs.nvidia.com/self-hosted/workloads-in-nvidia-run-ai/assets/credentials",
        "data-volumes": "https://run-ai-docs.nvidia.com/self-hosted/workloads-in-nvidia-run-ai/assets/data-volumes",
        "ai-applications": "https://run-ai-docs.nvidia.com/self-hosted/ai-applications/ai-applications",
      };
      const page = db.getPage(urlMap[topic]);
      if (!page) {
        return {
          content: [{ type: "text", text: `Workload topic not found. Run npm run scrape.` }],
          structuredContent: {
            kind: "not_found",
            query: { topic },
            message: "Page not found",
          },
        };
      }
      const pageResult = pageWithContent(page, include_content, max_chars);
      return {
        content: [
          { type: "text", text: `Workload topic ${topic} found.` },
          toResourceLink(page),
        ],
        structuredContent: {
          kind: "page",
          page: pageResult,
          query: { topic },
        },
      };
    }
  );

  server.registerTool(
    "get_scheduler_info",
    {
      title: "Get scheduler documentation",
      description:
        "Get information about the Run:ai scheduler — how it works, fairness, GPU fractions, dynamic fractions, time-slicing, node-level scheduler, memory swap, priority control.",
      inputSchema: contentOptionsSchema.extend({
        topic: z
          .enum([
            "how-it-works",
            "concepts-and-principles",
            "workload-priority-control",
            "default-scheduler",
            "fractions",
            "dynamic-fractions",
            "time-slicing",
            "node-level-scheduler",
            "memory-swap",
            "dynamic-fractions-quickstart",
          ])
          .describe("Scheduler topic"),
      }),
      outputSchema: PageResultSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ topic, include_content, max_chars }) => {
      const urlMap: Record<string, string> = {
        "how-it-works":
          "https://run-ai-docs.nvidia.com/self-hosted/platform-management/runai-scheduler/scheduling/how-the-scheduler-works",
        "concepts-and-principles":
          "https://run-ai-docs.nvidia.com/self-hosted/platform-management/runai-scheduler/scheduling/concepts-and-principles",
        "workload-priority-control":
          "https://run-ai-docs.nvidia.com/self-hosted/platform-management/runai-scheduler/scheduling/workload-priority-control",
        "default-scheduler":
          "https://run-ai-docs.nvidia.com/self-hosted/platform-management/runai-scheduler/scheduling/default-scheduler",
        fractions:
          "https://run-ai-docs.nvidia.com/self-hosted/platform-management/runai-scheduler/resource-optimization/fractions",
        "dynamic-fractions":
          "https://run-ai-docs.nvidia.com/self-hosted/platform-management/runai-scheduler/resource-optimization/dynamic-fractions",
        "time-slicing":
          "https://run-ai-docs.nvidia.com/self-hosted/platform-management/runai-scheduler/resource-optimization/time-slicing",
        "node-level-scheduler":
          "https://run-ai-docs.nvidia.com/self-hosted/platform-management/runai-scheduler/resource-optimization/node-level-scheduler",
        "memory-swap":
          "https://run-ai-docs.nvidia.com/self-hosted/platform-management/runai-scheduler/resource-optimization/memory-swap",
        "dynamic-fractions-quickstart":
          "https://run-ai-docs.nvidia.com/self-hosted/platform-management/runai-scheduler/resource-optimization/quick-starts/dynamic-gpu-fractions-quickstart",
      };
      const page = db.getPage(urlMap[topic]);
      if (!page) {
        return {
          content: [{ type: "text", text: `Scheduler topic not found. Run npm run scrape.` }],
          structuredContent: {
            kind: "not_found",
            query: { topic },
            message: "Page not found",
          },
        };
      }
      const pageResult = pageWithContent(page, include_content, max_chars);
      return {
        content: [
          { type: "text", text: `Scheduler topic ${topic} found.` },
          toResourceLink(page),
        ],
        structuredContent: {
          kind: "page",
          page: pageResult,
          query: { topic },
        },
      };
    }
  );

  server.registerTool(
    "get_cli_reference",
    {
      title: "Get CLI reference",
      description: "Get the CLI reference for a specific Run:ai CLI command.",
      inputSchema: contentOptionsSchema.extend({
        command: z
          .enum([
            "install",
            "overview",
            "auth",
            "login",
            "logout",
            "config",
            "whoami",
            "kubeconfig",
            "training",
            "inference",
            "inference-describe",
            "workload",
            "workspace",
            "pytorch",
            "mpi",
            "tensorflow",
            "jax",
            "xgboost",
            "cluster",
            "node",
            "nodepool",
            "project",
            "compute",
            "datasource",
            "department",
            "environment",
            "template",
            "pvc",
            "diagnostics",
            "version",
            "upgrade",
            "report",
          ])
          .describe("CLI command name"),
      }),
      outputSchema: PageResultSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ command, include_content, max_chars }) => {
      const urlMap: Record<string, string> = {
        install: "https://run-ai-docs.nvidia.com/self-hosted/reference/cli/install-cli",
        overview: "https://run-ai-docs.nvidia.com/self-hosted/reference/cli/runai",
        auth: "https://run-ai-docs.nvidia.com/self-hosted/reference/cli/runai/runai_auth",
        login: "https://run-ai-docs.nvidia.com/self-hosted/reference/cli/runai/runai_login",
        logout: "https://run-ai-docs.nvidia.com/self-hosted/reference/cli/runai/runai_logout",
        config: "https://run-ai-docs.nvidia.com/self-hosted/reference/cli/runai/runai_config",
        whoami: "https://run-ai-docs.nvidia.com/self-hosted/reference/cli/runai/runai_whoami",
        kubeconfig: "https://run-ai-docs.nvidia.com/self-hosted/reference/cli/runai/runai_kubeconfig",
        training: "https://run-ai-docs.nvidia.com/self-hosted/reference/cli/runai/runai_training",
        inference: "https://run-ai-docs.nvidia.com/self-hosted/reference/cli/runai/runai_inference",
        "inference-describe": "https://run-ai-docs.nvidia.com/self-hosted/reference/cli/runai/runai_inference_describe",
        workload: "https://run-ai-docs.nvidia.com/self-hosted/reference/cli/runai/runai_workload",
        workspace: "https://run-ai-docs.nvidia.com/self-hosted/reference/cli/runai/runai_workspace",
        pytorch: "https://run-ai-docs.nvidia.com/self-hosted/reference/cli/runai/runai_pytorch",
        mpi: "https://run-ai-docs.nvidia.com/self-hosted/reference/cli/runai/runai_mpi",
        tensorflow: "https://run-ai-docs.nvidia.com/self-hosted/reference/cli/runai/runai_tensorflow",
        jax: "https://run-ai-docs.nvidia.com/self-hosted/reference/cli/runai/runai_jax",
        xgboost: "https://run-ai-docs.nvidia.com/self-hosted/reference/cli/runai/runai_xgboost",
        cluster: "https://run-ai-docs.nvidia.com/self-hosted/reference/cli/runai/runai_cluster",
        node: "https://run-ai-docs.nvidia.com/self-hosted/reference/cli/runai/runai_node",
        nodepool: "https://run-ai-docs.nvidia.com/self-hosted/reference/cli/runai/runai_nodepool",
        project: "https://run-ai-docs.nvidia.com/self-hosted/reference/cli/runai/runai_project",
        compute: "https://run-ai-docs.nvidia.com/self-hosted/reference/cli/runai/runai-compute",
        datasource: "https://run-ai-docs.nvidia.com/self-hosted/reference/cli/runai/runai-datasource",
        department: "https://run-ai-docs.nvidia.com/self-hosted/reference/cli/runai/runai-department",
        environment: "https://run-ai-docs.nvidia.com/self-hosted/reference/cli/runai/runai-environment",
        template: "https://run-ai-docs.nvidia.com/self-hosted/reference/cli/runai/runai-template",
        pvc: "https://run-ai-docs.nvidia.com/self-hosted/reference/cli/runai/runai_pvc",
        diagnostics: "https://run-ai-docs.nvidia.com/self-hosted/reference/cli/runai/runai-diagnostics",
        version: "https://run-ai-docs.nvidia.com/self-hosted/reference/cli/runai/runai_version",
        upgrade: "https://run-ai-docs.nvidia.com/self-hosted/reference/cli/runai/runai_upgrade",
        report: "https://run-ai-docs.nvidia.com/self-hosted/reference/cli/runai/runai_report",
      };
      const page = db.getPage(urlMap[command]);
      if (!page) {
        return {
          content: [{ type: "text", text: `CLI command not found. Run npm run scrape.` }],
          structuredContent: {
            kind: "not_found",
            query: { command },
            message: "Page not found",
          },
        };
      }
      const pageResult = pageWithContent(page, include_content, max_chars);
      return {
        content: [
          { type: "text", text: `CLI reference for ${command} found.` },
          toResourceLink(page),
        ],
        structuredContent: {
          kind: "page",
          page: pageResult,
          query: { command },
        },
      };
    }
  );

  server.registerTool(
    "get_policy_info",
    {
      title: "Get policy documentation",
      description:
        "Get information about Run:ai workload policies — rules, workload policies, scheduling rules, YAML reference and examples.",
      inputSchema: contentOptionsSchema.extend({
        topic: z
          .enum([
            "policies-and-rules",
            "workload-policies",
            "scheduling-rules",
            "policy-yaml-reference",
            "policy-yaml-examples",
          ])
          .describe("Policy topic"),
      }),
      outputSchema: PageResultSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ topic, include_content, max_chars }) => {
      const urlMap: Record<string, string> = {
        "policies-and-rules":
          "https://run-ai-docs.nvidia.com/self-hosted/platform-management/policies/policies-and-rules",
        "workload-policies":
          "https://run-ai-docs.nvidia.com/self-hosted/platform-management/policies/workload-policies",
        "scheduling-rules":
          "https://run-ai-docs.nvidia.com/self-hosted/platform-management/policies/scheduling-rules",
        "policy-yaml-reference":
          "https://run-ai-docs.nvidia.com/self-hosted/platform-management/policies/policy-yaml-reference",
        "policy-yaml-examples":
          "https://run-ai-docs.nvidia.com/self-hosted/platform-management/policies/policy-yaml-examples",
      };
      const page = db.getPage(urlMap[topic]);
      if (!page) {
        return {
          content: [{ type: "text", text: `Policy topic not found. Run npm run scrape.` }],
          structuredContent: {
            kind: "not_found",
            query: { topic },
            message: "Page not found",
          },
        };
      }
      const pageResult = pageWithContent(page, include_content, max_chars);
      return {
        content: [
          { type: "text", text: `Policy topic ${topic} found.` },
          toResourceLink(page),
        ],
        structuredContent: {
          kind: "page",
          page: pageResult,
          query: { topic },
        },
      };
    }
  );
}

async function main() {
  let db: DocsDatabase | null = null;
  try {
    db = new DocsDatabase();
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const server = new McpServer({
    name: "runai-docs",
    version: "0.1.0",
    description: "Run:ai v2.24 documentation and API reference MCP server",
  });

  registerResources(server, db);
  registerTools(server, db);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Run:ai MCP server running on stdio");

  const shutdown = async () => {
    if (db) {
      db.close();
    }
    await server.close();
  };

  process.on("SIGINT", () => {
    shutdown().catch(() => undefined);
  });

  process.on("SIGTERM", () => {
    shutdown().catch(() => undefined);
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
