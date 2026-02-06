import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DocsDatabase } from "../db/docs-db.js";
import type { PageFetcher } from "../fetch-strategy.js";
import { docContextSchema, contentOptionsSchema, PageResultSchema } from "../schemas.js";
import {
  resolveFixedDocsetContext,
  pageWithContent,
  toResourceLink,
  toolError,
} from "../utils.js";
import { formatPageHeader } from "../formatter.js";
import {
  buildBaseUrl,
  helmInstallRoutes,
  systemRequirementsRoutes,
  rbacRoutes,
  workloadRoutes,
  schedulerRoutes,
  cliRoutes,
  policyRoutes,
  apiCategoryRoutes,
} from "../routes.js";

type ToolContext = { docset: string; version: string };

async function fetchDocPage(
  fetcher: PageFetcher,
  url: string,
  context: ToolContext,
  includeContent: boolean,
  maxChars: number,
  notFoundMessage: string,
  queryKey: string,
  queryValue: string
) {
  const page = await fetcher.getPage(url, context);
  if (!page) {
    return {
      content: [{ type: "text" as const, text: notFoundMessage }],
      structuredContent: {
        kind: "not_found" as const,
        query: { [queryKey]: queryValue, docset: context.docset, version: context.version },
        message: "Page not found",
      },
    };
  }
  const pageResult = pageWithContent(page, includeContent, maxChars, context);
  return {
    content: [
      { type: "text" as const, text: formatPageHeader(page, context) },
      toResourceLink(page, context),
    ],
    structuredContent: {
      kind: "page" as const,
      page: pageResult,
      query: { [queryKey]: queryValue, docset: context.docset, version: context.version },
    },
  };
}

export function registerDocsTools(server: McpServer, db: DocsDatabase, fetcher: PageFetcher) {
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
      const url = `${buildBaseUrl(context.docset, context.version)}/${helmInstallRoutes[component]}`;
      return fetchDocPage(
        fetcher, url, context, include_content, max_chars,
        `Page not found for component: ${component}. Run npm run scrape.`,
        "component", component
      );
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
            "clusters", "departments", "projects", "nodepools", "nodes", "tenant",
            "access-rules", "access-keys", "roles", "users", "service-accounts",
            "applications", "permissions", "tokens", "idps", "org-unit",
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
      const url = `https://run-ai-docs.nvidia.com/api/${context.version}/${apiCategoryRoutes[endpoint]}`;
      return fetchDocPage(
        fetcher, url, context, include_content, max_chars,
        `API reference for ${endpoint} not found. Run npm run scrape.`,
        "endpoint", endpoint
      );
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
      const url = `${buildBaseUrl(context.docset, context.version)}/${systemRequirementsRoutes[component]}`;
      return fetchDocPage(
        fetcher, url, context, include_content, max_chars,
        `Requirements page not found. Run npm run scrape.`,
        "component", component
      );
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
      const url = `${buildBaseUrl(context.docset, context.version)}/${rbacRoutes[topic]}`;
      return fetchDocPage(
        fetcher, url, context, include_content, max_chars,
        `RBAC topic not found. Run npm run scrape.`,
        "topic", topic
      );
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
            "introduction", "workloads-overview", "workload-types", "native-workloads",
            "supported-workload-types", "supported-features", "extending-workload-support",
            "submit-via-yaml", "workload-templates", "using-workspaces", "using-training",
            "train-models", "distributed-training", "using-inference", "inference-overview",
            "custom-inference", "nim-inference", "hugging-face-inference", "assets-overview",
            "environments", "compute-resources", "datasources", "credentials",
            "data-volumes", "ai-applications",
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
      const url = `${buildBaseUrl(context.docset, context.version)}/${workloadRoutes[topic]}`;
      return fetchDocPage(
        fetcher, url, context, include_content, max_chars,
        `Workload topic not found. Run npm run scrape.`,
        "topic", topic
      );
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
            "how-it-works", "concepts-and-principles", "workload-priority-control",
            "default-scheduler", "fractions", "dynamic-fractions", "time-slicing",
            "node-level-scheduler", "memory-swap", "dynamic-fractions-quickstart",
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
      const url = `${buildBaseUrl(context.docset, context.version)}/${schedulerRoutes[topic]}`;
      return fetchDocPage(
        fetcher, url, context, include_content, max_chars,
        `Scheduler topic not found. Run npm run scrape.`,
        "topic", topic
      );
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
            "install", "overview", "auth", "login", "logout", "config", "whoami",
            "kubeconfig", "training", "inference", "inference-describe", "workload",
            "workspace", "pytorch", "mpi", "tensorflow", "jax", "xgboost", "cluster",
            "node", "nodepool", "project", "compute", "datasource", "department",
            "environment", "template", "pvc", "diagnostics", "version", "upgrade", "report",
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
      const url = `${buildBaseUrl(context.docset, context.version)}/${cliRoutes[command]}`;
      return fetchDocPage(
        fetcher, url, context, include_content, max_chars,
        `CLI command not found. Run npm run scrape.`,
        "command", command
      );
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
            "policies-and-rules", "workload-policies", "scheduling-rules",
            "policy-yaml-reference", "policy-yaml-examples",
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
      const url = `${buildBaseUrl(context.docset, context.version)}/${policyRoutes[topic]}`;
      return fetchDocPage(
        fetcher, url, context, include_content, max_chars,
        `Policy topic not found. Run npm run scrape.`,
        "topic", topic
      );
    }
  );
}
