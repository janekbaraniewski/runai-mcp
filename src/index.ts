#!/usr/bin/env node
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  DocsDatabase,
  type DocMeta,
  type DocRow,
  type SearchResult,
} from "./db/docs-db.js";
import { PageCache } from "./cache.js";
import { PageFetcher, type FetchStrategy } from "./fetch-strategy.js";
import {
  formatSearchResults,
  formatPageList,
  formatSections,
  formatPageHeader,
  formatDocsets,
  formatVersions,
  formatStats,
} from "./formatter.js";

const DEFAULT_SEARCH_LIMIT = 10;
const MAX_SEARCH_LIMIT = 50;
const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 200;
const DEFAULT_MAX_CONTENT_CHARS = 12000;
const MAX_CONTENT_CHARS = 50000;
const MAX_MATCHES = 5;
const MAX_COMPLETE_RESULTS = 25;
const DEFAULT_DOCSET = process.env.RUNAI_DOCS_DOCSET ?? "self-hosted";
const DEFAULT_VERSION = process.env.RUNAI_DOCS_VERSION ?? "latest";
const DEFAULT_FALLBACK_VERSION = process.env.RUNAI_DOCS_LATEST_VERSION ?? "2.24";
const FETCH_STRATEGY = (process.env.RUNAI_DOCS_FETCH_STRATEGY ?? "cache-first") as FetchStrategy;
const LIVE_LOOKUP_ENABLED = (process.env.RUNAI_DOCS_LIVE_LOOKUP ?? "1") !== "0";
const LIVE_LOOKUP_TIMEOUT_MS = Number(process.env.RUNAI_DOCS_LIVE_TIMEOUT_MS ?? "12000");

const PageRefSchema = z.object({
  docset: z.string(),
  version: z.string(),
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
  docset: z.string(),
  version: z.string().optional(),
  results: z.array(SearchResultSchema),
});

const GetPageOutputSchema = z.object({
  kind: z.enum(["page", "matches", "not_found"]),
  page: PageSchema.optional(),
  matches: z.array(PageRefSchema).optional(),
  query: z
    .object({
      url: z.string().optional(),
      title: z.string().optional(),
      docset: z.string().optional(),
      version: z.string().optional(),
    })
    .optional(),
  message: z.string().optional(),
});

const PageResultSchema = z.object({
  kind: z.enum(["page", "not_found"]),
  page: PageSchema.optional(),
  query: z.record(z.string(), z.string()).optional(),
  message: z.string().optional(),
});

const SectionSchema = z.object({
  docset: z.string(),
  version: z.string(),
  category: z.string(),
  subcategory: z.string(),
  count: z.number(),
});

const ListSectionsOutputSchema = z.object({
  total_sections: z.number(),
  sections: z.array(SectionSchema),
});

const ListPagesOutputSchema = z.object({
  docset: z.string(),
  version: z.string(),
  category: z.string(),
  subcategory: z.string().optional(),
  limit: z.number(),
  offset: z.number(),
  total: z.number(),
  pages: z.array(PageRefSchema),
});

const StatsOutputSchema = z.object({
  docset: z.string(),
  version: z.string(),
  pages: z.number(),
  last_fetched_at: z.string().nullable(),
});

const DocsetSchema = z.object({
  id: z.string(),
  label: z.string(),
  base_url: z.string(),
  versioned: z.boolean(),
});

const ListDocsetsOutputSchema = z.object({
  total_docsets: z.number(),
  docsets: z.array(DocsetSchema),
});

const VersionSchema = z.object({
  docset: z.string(),
  version: z.string(),
  is_latest: z.boolean().optional(),
  release_date: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
});

const ListVersionsOutputSchema = z.object({
  docset: z.string().optional(),
  versions: z.array(VersionSchema),
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

const docContextSchema = z.object({
  docset: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("Docset (self-hosted, saas, multi-tenant, api; legacy optional). Use 'all' to search across docsets."),
  version: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("Run:ai version (e.g., 2.24). Use 'latest' for newest or 'all' for all versions."),
});

function normalizeDocset(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (["selfhosted", "self_hosted", "self-hosted"].includes(normalized)) return "self-hosted";
  if (["multitenant", "multi_tenant", "multi-tenant", "mt"].includes(normalized)) return "multi-tenant";
  if (["saas", "cloud"].includes(normalized)) return "saas";
  if (["api", "api-docs", "apidocs"].includes(normalized)) return "api";
  if (["legacy", "docs.run.ai", "docs-run-ai"].includes(normalized)) return "legacy";
  return normalized;
}

function normalizeVersion(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "latest" || normalized === "current") return "latest";
  if (normalized === "all" || normalized === "*") return "all";
  return normalized.startsWith("v") ? normalized.slice(1) : normalized;
}

function isAll(value?: string): boolean {
  return value === "all" || value === "*";
}

function resolveContext(
  db: DocsDatabase,
  input: { docset?: string; version?: string }
): { docset?: string; version?: string; requestedDocset?: string; requestedVersion?: string } {
  const requestedDocset = normalizeDocset(input.docset);
  const requestedVersion = normalizeVersion(input.version);

  let docset: string | undefined = requestedDocset ?? DEFAULT_DOCSET;
  if (isAll(docset)) {
    docset = undefined;
  }

  let version: string | undefined = requestedVersion ?? DEFAULT_VERSION;
  if (isAll(version)) {
    version = undefined;
  }

  if (!docset && version === "latest") {
    version = undefined;
  }

  if (docset && version === "latest") {
    version = db.getLatestVersion(docset) ?? DEFAULT_FALLBACK_VERSION;
  }

  return { docset, version, requestedDocset, requestedVersion };
}

function resolveFixedDocsetContext(
  db: DocsDatabase,
  docset: string,
  version?: string
): { docset: string; version: string } | null {
  const context = resolveContext(db, { docset, version });
  if (!context.docset || !context.version) {
    return null;
  }
  return { docset: context.docset, version: context.version };
}

function toResourceUri(docset: string, version: string, url: string): string {
  return `runai-docs://${docset}/${version}/page/${encodeURIComponent(url)}`;
}

function decodeResourceUrl(encoded: string): string {
  try {
    return decodeURIComponent(encoded);
  } catch (err) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid resource URL encoding");
  }
}

function resolvePageContext(
  page: DocMeta | DocRow,
  fallback?: { docset?: string; version?: string }
): { docset: string; version: string } {
  const docset = page.docset ?? fallback?.docset ?? DEFAULT_DOCSET;
  const version = page.version ?? fallback?.version ?? DEFAULT_FALLBACK_VERSION;
  return { docset, version };
}

function pageToRef(page: DocMeta | DocRow, fallback?: { docset?: string; version?: string }): z.infer<typeof PageRefSchema> {
  const { docset, version } = resolvePageContext(page, fallback);
  return {
    docset,
    version,
    url: page.url,
    title: page.title,
    category: page.category,
    subcategory: page.subcategory,
    fetched_at: page.fetched_at,
    resource_uri: toResourceUri(docset, version, page.url),
  };
}

function buildPageMarkdown(page: DocRow, fallback?: { docset?: string; version?: string }): string {
  const { docset, version } = resolvePageContext(page, fallback);
  return `# ${page.title}\n\nSource: ${page.url}\nDocset: ${docset}\nVersion: ${version}\nCategory: ${page.category}/${page.subcategory}\nFetched: ${page.fetched_at}\n\n${page.content_md}`;
}

function truncateContent(content: string, maxChars: number): { content: string; truncated: boolean } {
  if (content.length <= maxChars) {
    return { content, truncated: false };
  }
  return { content: `${content.slice(0, Math.max(0, maxChars - 3))}...`, truncated: true };
}

function pageWithContent(
  page: DocRow,
  includeContent: boolean,
  maxChars: number,
  fallback?: { docset?: string; version?: string }
): z.infer<typeof PageSchema> {
  const base = pageToRef(page, fallback);
  if (!includeContent) {
    return base;
  }
  const markdown = buildPageMarkdown(page, fallback);
  const truncated = truncateContent(markdown, maxChars);
  return {
    ...base,
    content_md: truncated.content,
    content_truncated: truncated.truncated,
  };
}

function toResourceLink(meta: DocMeta | SearchResult | DocRow, fallback?: { docset?: string; version?: string }) {
  const { docset, version } = resolvePageContext(meta, fallback);
  const annotations = meta.fetched_at ? { lastModified: meta.fetched_at } : undefined;
  return {
    type: "resource_link" as const,
    uri: toResourceUri(docset, version, meta.url),
    name: meta.title,
    title: meta.title,
    description: `${docset}/${version} - ${meta.category}/${meta.subcategory}`,
    mimeType: "text/markdown",
    annotations,
  };
}

function toolError(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

function registerResources(server: McpServer, db: DocsDatabase, fetcher: PageFetcher) {
  // NOTE: We intentionally don't enumerate all pages as resources.
  // Listing ~1000 doc pages as MCP resources causes performance issues and
  // goes against MCP design principles. Use search_docs/list_pages tools instead.
  // The template is kept so resource URIs in tool responses remain valid.
  const template = new ResourceTemplate("runai-docs://{docset}/{version}/page/{url}", {
    list: undefined,
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
      description: "Run:ai documentation page (markdown, versioned)",
      mimeType: "text/markdown",
      annotations: {
        audience: ["assistant", "user"],
      },
    },
    (uri, variables) => {
      const encoded = typeof variables.url === "string" ? variables.url : "";
      const docsetInput = typeof variables.docset === "string" ? variables.docset : "";
      const versionInput = typeof variables.version === "string" ? variables.version : "";
      if (!encoded) {
        throw new McpError(ErrorCode.InvalidParams, "Missing resource URL value");
      }
      const decoded = decodeResourceUrl(encoded);
      const context = resolveContext(db, { docset: docsetInput, version: versionInput });
      if (!context.docset || !context.version) {
        throw new McpError(ErrorCode.InvalidParams, "Missing docset or version for resource lookup");
      }
      const page = fetcher.getPageFromDb(decoded, { docset: context.docset, version: context.version });
      if (!page) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Page not found for ${context.docset}/${context.version} URL: ${decoded}`
        );
      }
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: "text/markdown",
            text: buildPageMarkdown(page, context),
            _meta: {
              url: page.url,
              category: page.category,
              subcategory: page.subcategory,
              title: page.title,
              fetched_at: page.fetched_at,
              docset: context.docset,
              version: context.version,
            },
          },
        ],
      };
    }
  );
}

function registerTools(server: McpServer, db: DocsDatabase, fetcher: PageFetcher) {
  server.registerTool(
    "search_docs",
    {
      title: "Search Run:ai docs",
      description:
        "Full-text search across Run:ai documentation (all supported versions). Use for installation, APIs, configuration, Helm charts, CRDs, etc.",
      inputSchema: docContextSchema.extend({
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
    async ({ query, limit, offset, docset, version }) => {
      const context = resolveContext(db, { docset, version });
      const results = db.search(query, { limit, offset, docset: context.docset, version: context.version });
      const structuredResults = results.map((result) => ({
        ...pageToRef(result, context),
        snippet: result.snippet,
        rank: result.rank,
      }));
      const content = [
        {
          type: "text" as const,
          text: formatSearchResults(results, query, context),
        },
        ...results.map((result) => toResourceLink(result, context)),
      ];
      return {
        content,
        structuredContent: {
          query,
          limit,
          offset,
          count: results.length,
          docset: context.docset ?? "all",
          version: context.version ?? "all",
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
      inputSchema: docContextSchema.extend({
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
    async ({ url, title, include_content, max_chars, docset, version }) => {
      const context = resolveContext(db, { docset, version });
      if (!context.docset || !context.version) {
        return toolError("Provide a specific docset and version (not 'all') for get_page.");
      }
      const provided = [url ? "url" : null, title ? "title" : null].filter(Boolean);
      if (provided.length !== 1) {
        return toolError("Provide exactly one of url or title.");
      }

      if (url) {
        const page = await fetcher.getPage(url, { docset: context.docset, version: context.version });
        if (!page) {
          return {
            content: [{ type: "text", text: `Page not found for URL: ${url}` }],
            structuredContent: {
              kind: "not_found",
              query: { url, docset: context.docset, version: context.version },
              message: "Page not found",
            },
          };
        }
        const pageResult = pageWithContent(page, include_content, max_chars, context);
        return {
          content: [
            { type: "text", text: formatPageHeader(page, context) },
            toResourceLink(page, context),
          ],
          structuredContent: {
            kind: "page",
            page: pageResult,
            query: { url, docset: context.docset, version: context.version },
          },
        };
      }

      const matches = db.findPagesByTitle(title ?? "", MAX_MATCHES, {
        docset: context.docset,
        version: context.version,
      });
      if (matches.length === 0) {
        return {
          content: [{ type: "text", text: `No pages found matching title: ${title}` }],
          structuredContent: {
            kind: "not_found",
            query: { title, docset: context.docset, version: context.version },
            message: "No title matches",
          },
        };
      }

      if (matches.length > 1) {
        return {
          content: [
            { type: "text", text: `Multiple pages match \"${title}\". Choose a URL:` },
            ...matches.map((match) => toResourceLink(match, context)),
          ],
          structuredContent: {
            kind: "matches",
            matches: matches.map((match) => pageToRef(match, context)),
            query: { title, docset: context.docset, version: context.version },
            message: "Multiple title matches",
          },
        };
      }

      const page = await fetcher.getPage(matches[0].url, { docset: context.docset, version: context.version });
      if (!page) {
        return {
          content: [{ type: "text", text: `Page not found for title match: ${title}` }],
          structuredContent: {
            kind: "not_found",
            query: { title, docset: context.docset, version: context.version },
            message: "Page not found",
          },
        };
      }

      const pageResult = pageWithContent(page, include_content, max_chars, context);
      return {
        content: [
          { type: "text", text: formatPageHeader(page, context) },
          toResourceLink(page, context),
        ],
        structuredContent: {
          kind: "page",
          page: pageResult,
          query: { title, docset: context.docset, version: context.version },
        },
      };
    }
  );

  server.registerTool(
    "list_sections",
    {
      title: "List documentation sections",
      description: "List all documentation categories and subcategories with page counts.",
      inputSchema: docContextSchema,
      outputSchema: ListSectionsOutputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ docset, version }) => {
      const context = resolveContext(db, { docset, version });
      const sections = db.listCategories({ docset: context.docset, version: context.version });
      const sectionData = sections.map((section) => ({
        docset: section.docset ?? context.docset ?? DEFAULT_DOCSET,
        version: section.version ?? context.version ?? DEFAULT_FALLBACK_VERSION,
        category: section.category,
        subcategory: section.subcategory,
        count: section.count,
      }));
      return {
        content: [
          {
            type: "text",
            text: formatSections(sectionData),
          },
        ],
        structuredContent: {
          total_sections: sections.length,
          sections: sectionData,
        },
      };
    }
  );

  server.registerTool(
    "list_pages",
    {
      title: "List pages in a category",
      description: "List all pages in a documentation category, optionally filtered by subcategory.",
      inputSchema: docContextSchema.extend({
        category: z.string().trim().min(1).describe("Documentation category"),
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
    async ({ category, subcategory, limit, offset, docset, version }) => {
      const context = resolveContext(db, { docset, version });
      const filters = { docset: context.docset, version: context.version };
      const total = db.countByCategory(category, subcategory, filters);
      const pages = db.listByCategory(category, { limit, offset, subcategory, ...filters });
      return {
        content: [
          {
            type: "text",
            text: formatPageList(pages, context),
          },
          ...pages.map((page) => toResourceLink(page, context)),
        ],
        structuredContent: {
          docset: context.docset ?? "all",
          version: context.version ?? "all",
          category,
          subcategory,
          limit,
          offset,
          total,
          pages: pages.map((page) => pageToRef(page, context)),
        },
      };
    }
  );

  server.registerTool(
    "list_docsets",
    {
      title: "List available docsets",
      description: "List the available Run:ai documentation sets (self-hosted, saas, multi-tenant, api, legacy).",
      outputSchema: ListDocsetsOutputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const docsets = db.listDocsets().map((docset) => ({
        id: docset.id,
        label: docset.label,
        base_url: docset.base_url,
        versioned: Boolean(docset.versioned),
      }));
      return {
        content: [
          {
            type: "text",
            text: formatDocsets(docsets),
          },
        ],
        structuredContent: {
          total_docsets: docsets.length,
          docsets,
        },
      };
    }
  );

  server.registerTool(
    "list_versions",
    {
      title: "List available versions",
      description: "List available Run:ai versions for a docset (or all docsets).",
      inputSchema: z.object({
        docset: docContextSchema.shape.docset,
      }),
      outputSchema: ListVersionsOutputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ docset }) => {
      let normalizedDocset = normalizeDocset(docset);
      if (isAll(normalizedDocset)) {
        normalizedDocset = undefined;
      }
      const versions = db.listVersions(normalizedDocset);
      const versionData = versions.map((version) => ({
        docset: version.docset,
        version: version.version,
        is_latest: Boolean(version.is_latest),
        release_date: version.release_date,
        source: version.source,
      }));
      return {
        content: [
          {
            type: "text",
            text: formatVersions(versionData, normalizedDocset),
          },
        ],
        structuredContent: {
          docset: normalizedDocset,
          versions: versionData,
        },
      };
    }
  );

  server.registerTool(
    "get_doc_stats",
    {
      title: "Get docs database stats",
      description: "Return document count and last fetch timestamp for the docs database.",
      inputSchema: docContextSchema,
      outputSchema: StatsOutputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ docset, version }) => {
      const context = resolveContext(db, { docset, version });
      const stats = db.getStats({ docset: context.docset, version: context.version });
      const statsData = {
        docset: context.docset ?? "all",
        version: context.version ?? "all",
        pages: stats.pages,
        last_fetched_at: stats.lastFetchedAt,
      };
      return {
        content: [
          {
            type: "text",
            text: formatStats(statsData),
          },
        ],
        structuredContent: statsData,
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
        version: docContextSchema.shape.version,
      }),
      outputSchema: PageResultSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ component, include_content, max_chars, version }) => {
      const context = resolveFixedDocsetContext(db, "self-hosted", version);
      if (!context) {
        return toolError("Provide a specific version (not 'all') for this tool.");
      }
      const base = `https://run-ai-docs.nvidia.com/self-hosted/${context.version}`;
      const urlMap: Record<string, string> = {
        "control-plane": `${base}/getting-started/installation/install-using-helm/install-control-plane`,
        cluster: `${base}/getting-started/installation/install-using-helm/helm-install`,
        preparations: `${base}/getting-started/installation/install-using-helm/preparations`,
        upgrade: `${base}/getting-started/installation/install-using-helm/upgrade`,
        uninstall: `${base}/getting-started/installation/install-using-helm/uninstall`,
      };
      const page = await fetcher.getPage(urlMap[component], context);
      if (!page) {
        return {
          content: [{ type: "text", text: `Page not found for component: ${component}. Run npm run scrape.` }],
          structuredContent: {
            kind: "not_found",
            query: { component, docset: context.docset, version: context.version },
            message: "Page not found",
          },
        };
      }
      const pageResult = pageWithContent(page, include_content, max_chars, context);
      return {
        content: [
          { type: "text", text: formatPageHeader(page, context) },
          toResourceLink(page, context),
        ],
        structuredContent: {
          kind: "page",
          page: pageResult,
          query: { component, docset: context.docset, version: context.version },
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
        version: docContextSchema.shape.version,
      }),
      outputSchema: PageResultSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ endpoint, include_content, max_chars, version }) => {
      const context = resolveFixedDocsetContext(db, "api", version);
      if (!context) {
        return toolError("Provide a specific version (not 'all') for this tool.");
      }
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
      const url = `https://run-ai-docs.nvidia.com/api/${context.version}/${categoryMap[endpoint]}`;
      const page = await fetcher.getPage(url, context);
      if (!page) {
        return {
          content: [{ type: "text", text: `API reference for ${endpoint} not found. Run npm run scrape.` }],
          structuredContent: {
            kind: "not_found",
            query: { endpoint, docset: context.docset, version: context.version },
            message: "Page not found",
          },
        };
      }
      const pageResult = pageWithContent(page, include_content, max_chars, context);
      return {
        content: [
          { type: "text", text: formatPageHeader(page, context) },
          toResourceLink(page, context),
        ],
        structuredContent: {
          kind: "page",
          page: pageResult,
          query: { endpoint, docset: context.docset, version: context.version },
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
        version: docContextSchema.shape.version,
      }),
      outputSchema: PageResultSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ component, include_content, max_chars, version }) => {
      const context = resolveFixedDocsetContext(db, "self-hosted", version);
      if (!context) {
        return toolError("Provide a specific version (not 'all') for this tool.");
      }
      const base = `https://run-ai-docs.nvidia.com/self-hosted/${context.version}`;
      const urlMap: Record<string, string> = {
        "support-matrix": `${base}/getting-started/installation/support-matrix`,
        "control-plane-requirements": `${base}/getting-started/installation/install-using-helm/cp-system-requirements`,
        "cluster-requirements": `${base}/getting-started/installation/install-using-helm/system-requirements`,
        network: `${base}/getting-started/installation/install-using-helm/network-requirements`,
      };
      const page = await fetcher.getPage(urlMap[component], context);
      if (!page) {
        return {
          content: [{ type: "text", text: `Requirements page not found. Run npm run scrape.` }],
          structuredContent: {
            kind: "not_found",
            query: { component, docset: context.docset, version: context.version },
            message: "Page not found",
          },
        };
      }
      const pageResult = pageWithContent(page, include_content, max_chars, context);
      return {
        content: [
          { type: "text", text: formatPageHeader(page, context) },
          toResourceLink(page, context),
        ],
        structuredContent: {
          kind: "page",
          page: pageResult,
          query: { component, docset: context.docset, version: context.version },
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
        version: docContextSchema.shape.version,
      }),
      outputSchema: PageResultSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ topic, include_content, max_chars, version }) => {
      const context = resolveFixedDocsetContext(db, "self-hosted", version);
      if (!context) {
        return toolError("Provide a specific version (not 'all') for this tool.");
      }
      const base = `https://run-ai-docs.nvidia.com/self-hosted/${context.version}`;
      const urlMap: Record<string, string> = {
        overview: `${base}/infrastructure-setup/authentication/overview`,
        roles: `${base}/infrastructure-setup/authentication/roles`,
        "access-rules": `${base}/infrastructure-setup/authentication/accessrules`,
        "service-accounts": `${base}/infrastructure-setup/authentication/service-accounts`,
        "cluster-auth": `${base}/infrastructure-setup/authentication/cluster-authentication`,
      };
      const page = await fetcher.getPage(urlMap[topic], context);
      if (!page) {
        return {
          content: [{ type: "text", text: `RBAC topic not found. Run npm run scrape.` }],
          structuredContent: {
            kind: "not_found",
            query: { topic, docset: context.docset, version: context.version },
            message: "Page not found",
          },
        };
      }
      const pageResult = pageWithContent(page, include_content, max_chars, context);
      return {
        content: [
          { type: "text", text: formatPageHeader(page, context) },
          toResourceLink(page, context),
        ],
        structuredContent: {
          kind: "page",
          page: pageResult,
          query: { topic, docset: context.docset, version: context.version },
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
        version: docContextSchema.shape.version,
      }),
      outputSchema: PageResultSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ topic, include_content, max_chars, version }) => {
      const context = resolveFixedDocsetContext(db, "self-hosted", version);
      if (!context) {
        return toolError("Provide a specific version (not 'all') for this tool.");
      }
      const base = `https://run-ai-docs.nvidia.com/self-hosted/${context.version}`;
      const urlMap: Record<string, string> = {
        introduction: `${base}/workloads-in-nvidia-run-ai/introduction-to-workloads`,
        "workloads-overview": `${base}/workloads-in-nvidia-run-ai/workloads`,
        "workload-types": `${base}/workloads-in-nvidia-run-ai/workload-types`,
        "native-workloads": `${base}/workloads-in-nvidia-run-ai/workload-types/native-workloads`,
        "supported-workload-types": `${base}/workloads-in-nvidia-run-ai/workload-types/supported-workload-types`,
        "supported-features": `${base}/workloads-in-nvidia-run-ai/workload-types/supported-features`,
        "extending-workload-support": `${base}/workloads-in-nvidia-run-ai/workload-types/extending-workload-support`,
        "submit-via-yaml": `${base}/workloads-in-nvidia-run-ai/submit-via-yaml`,
        "workload-templates": `${base}/workloads-in-nvidia-run-ai/workload-templates`,
        "using-workspaces": `${base}/workloads-in-nvidia-run-ai/using-workspaces`,
        "using-training": `${base}/workloads-in-nvidia-run-ai/using-training`,
        "train-models": `${base}/workloads-in-nvidia-run-ai/using-training/train-models`,
        "distributed-training": `${base}/workloads-in-nvidia-run-ai/using-training/distributed-training-models`,
        "using-inference": `${base}/workloads-in-nvidia-run-ai/using-inference`,
        "inference-overview": `${base}/workloads-in-nvidia-run-ai/using-inference/nvidia-run-ai-inference-overview`,
        "custom-inference": `${base}/workloads-in-nvidia-run-ai/using-inference/custom-inference`,
        "nim-inference": `${base}/workloads-in-nvidia-run-ai/using-inference/nim-inference`,
        "hugging-face-inference": `${base}/workloads-in-nvidia-run-ai/using-inference/hugging-face-inference`,
        "assets-overview": `${base}/workloads-in-nvidia-run-ai/assets/overview`,
        environments: `${base}/workloads-in-nvidia-run-ai/assets/environments`,
        "compute-resources": `${base}/workloads-in-nvidia-run-ai/assets/compute-resources`,
        datasources: `${base}/workloads-in-nvidia-run-ai/assets/datasources`,
        credentials: `${base}/workloads-in-nvidia-run-ai/assets/credentials`,
        "data-volumes": `${base}/workloads-in-nvidia-run-ai/assets/data-volumes`,
        "ai-applications": `${base}/ai-applications/ai-applications`,
      };
      const page = await fetcher.getPage(urlMap[topic], context);
      if (!page) {
        return {
          content: [{ type: "text", text: `Workload topic not found. Run npm run scrape.` }],
          structuredContent: {
            kind: "not_found",
            query: { topic, docset: context.docset, version: context.version },
            message: "Page not found",
          },
        };
      }
      const pageResult = pageWithContent(page, include_content, max_chars, context);
      return {
        content: [
          { type: "text", text: formatPageHeader(page, context) },
          toResourceLink(page, context),
        ],
        structuredContent: {
          kind: "page",
          page: pageResult,
          query: { topic, docset: context.docset, version: context.version },
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
        version: docContextSchema.shape.version,
      }),
      outputSchema: PageResultSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ topic, include_content, max_chars, version }) => {
      const context = resolveFixedDocsetContext(db, "self-hosted", version);
      if (!context) {
        return toolError("Provide a specific version (not 'all') for this tool.");
      }
      const base = `https://run-ai-docs.nvidia.com/self-hosted/${context.version}`;
      const urlMap: Record<string, string> = {
        "how-it-works": `${base}/platform-management/runai-scheduler/scheduling/how-the-scheduler-works`,
        "concepts-and-principles": `${base}/platform-management/runai-scheduler/scheduling/concepts-and-principles`,
        "workload-priority-control": `${base}/platform-management/runai-scheduler/scheduling/workload-priority-control`,
        "default-scheduler": `${base}/platform-management/runai-scheduler/scheduling/default-scheduler`,
        fractions: `${base}/platform-management/runai-scheduler/resource-optimization/fractions`,
        "dynamic-fractions": `${base}/platform-management/runai-scheduler/resource-optimization/dynamic-fractions`,
        "time-slicing": `${base}/platform-management/runai-scheduler/resource-optimization/time-slicing`,
        "node-level-scheduler": `${base}/platform-management/runai-scheduler/resource-optimization/node-level-scheduler`,
        "memory-swap": `${base}/platform-management/runai-scheduler/resource-optimization/memory-swap`,
        "dynamic-fractions-quickstart":
          `${base}/platform-management/runai-scheduler/resource-optimization/quick-starts/dynamic-gpu-fractions-quickstart`,
      };
      const page = await fetcher.getPage(urlMap[topic], context);
      if (!page) {
        return {
          content: [{ type: "text", text: `Scheduler topic not found. Run npm run scrape.` }],
          structuredContent: {
            kind: "not_found",
            query: { topic, docset: context.docset, version: context.version },
            message: "Page not found",
          },
        };
      }
      const pageResult = pageWithContent(page, include_content, max_chars, context);
      return {
        content: [
          { type: "text", text: formatPageHeader(page, context) },
          toResourceLink(page, context),
        ],
        structuredContent: {
          kind: "page",
          page: pageResult,
          query: { topic, docset: context.docset, version: context.version },
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
        version: docContextSchema.shape.version,
      }),
      outputSchema: PageResultSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ command, include_content, max_chars, version }) => {
      const context = resolveFixedDocsetContext(db, "self-hosted", version);
      if (!context) {
        return toolError("Provide a specific version (not 'all') for this tool.");
      }
      const base = `https://run-ai-docs.nvidia.com/self-hosted/${context.version}`;
      const urlMap: Record<string, string> = {
        install: `${base}/reference/cli/install-cli`,
        overview: `${base}/reference/cli/runai`,
        auth: `${base}/reference/cli/runai/runai_auth`,
        login: `${base}/reference/cli/runai/runai_login`,
        logout: `${base}/reference/cli/runai/runai_logout`,
        config: `${base}/reference/cli/runai/runai_config`,
        whoami: `${base}/reference/cli/runai/runai_whoami`,
        kubeconfig: `${base}/reference/cli/runai/runai_kubeconfig`,
        training: `${base}/reference/cli/runai/runai_training`,
        inference: `${base}/reference/cli/runai/runai_inference`,
        "inference-describe": `${base}/reference/cli/runai/runai_inference_describe`,
        workload: `${base}/reference/cli/runai/runai_workload`,
        workspace: `${base}/reference/cli/runai/runai_workspace`,
        pytorch: `${base}/reference/cli/runai/runai_pytorch`,
        mpi: `${base}/reference/cli/runai/runai_mpi`,
        tensorflow: `${base}/reference/cli/runai/runai_tensorflow`,
        jax: `${base}/reference/cli/runai/runai_jax`,
        xgboost: `${base}/reference/cli/runai/runai_xgboost`,
        cluster: `${base}/reference/cli/runai/runai_cluster`,
        node: `${base}/reference/cli/runai/runai_node`,
        nodepool: `${base}/reference/cli/runai/runai_nodepool`,
        project: `${base}/reference/cli/runai/runai_project`,
        compute: `${base}/reference/cli/runai/runai-compute`,
        datasource: `${base}/reference/cli/runai/runai-datasource`,
        department: `${base}/reference/cli/runai/runai-department`,
        environment: `${base}/reference/cli/runai/runai-environment`,
        template: `${base}/reference/cli/runai/runai-template`,
        pvc: `${base}/reference/cli/runai/runai_pvc`,
        diagnostics: `${base}/reference/cli/runai/runai-diagnostics`,
        version: `${base}/reference/cli/runai/runai_version`,
        upgrade: `${base}/reference/cli/runai/runai_upgrade`,
        report: `${base}/reference/cli/runai/runai_report`,
      };
      const page = await fetcher.getPage(urlMap[command], context);
      if (!page) {
        return {
          content: [{ type: "text", text: `CLI command not found. Run npm run scrape.` }],
          structuredContent: {
            kind: "not_found",
            query: { command, docset: context.docset, version: context.version },
            message: "Page not found",
          },
        };
      }
      const pageResult = pageWithContent(page, include_content, max_chars, context);
      return {
        content: [
          { type: "text", text: formatPageHeader(page, context) },
          toResourceLink(page, context),
        ],
        structuredContent: {
          kind: "page",
          page: pageResult,
          query: { command, docset: context.docset, version: context.version },
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
        version: docContextSchema.shape.version,
      }),
      outputSchema: PageResultSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ topic, include_content, max_chars, version }) => {
      const context = resolveFixedDocsetContext(db, "self-hosted", version);
      if (!context) {
        return toolError("Provide a specific version (not 'all') for this tool.");
      }
      const base = `https://run-ai-docs.nvidia.com/self-hosted/${context.version}`;
      const urlMap: Record<string, string> = {
        "policies-and-rules": `${base}/platform-management/policies/policies-and-rules`,
        "workload-policies": `${base}/platform-management/policies/workload-policies`,
        "scheduling-rules": `${base}/platform-management/policies/scheduling-rules`,
        "policy-yaml-reference": `${base}/platform-management/policies/policy-yaml-reference`,
        "policy-yaml-examples": `${base}/platform-management/policies/policy-yaml-examples`,
      };
      const page = await fetcher.getPage(urlMap[topic], context);
      if (!page) {
        return {
          content: [{ type: "text", text: `Policy topic not found. Run npm run scrape.` }],
          structuredContent: {
            kind: "not_found",
            query: { topic, docset: context.docset, version: context.version },
            message: "Page not found",
          },
        };
      }
      const pageResult = pageWithContent(page, include_content, max_chars, context);
      return {
        content: [
          { type: "text", text: formatPageHeader(page, context) },
          toResourceLink(page, context),
        ],
        structuredContent: {
          kind: "page",
          page: pageResult,
          query: { topic, docset: context.docset, version: context.version },
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

  const cache = new PageCache();
  const fetcher = new PageFetcher({
    db,
    cache,
    strategy: FETCH_STRATEGY,
    timeoutMs: LIVE_LOOKUP_TIMEOUT_MS,
    liveLookupEnabled: LIVE_LOOKUP_ENABLED,
  });

  const server = new McpServer({
    name: "runai-docs",
    version: "0.2.0",
    description: "Run:ai multi-version documentation and API reference MCP server",
  });

  registerResources(server, db, fetcher);
  registerTools(server, db, fetcher);

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
