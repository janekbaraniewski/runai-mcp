import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DocsDatabase } from "../db/docs-db.js";
import {
  docContextSchema,
  ListSectionsOutputSchema,
  ListPagesOutputSchema,
  ListDocsetsOutputSchema,
  ListVersionsOutputSchema,
  StatsOutputSchema,
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
} from "../schemas.js";
import {
  resolveContext,
  normalizeDocset,
  isAll,
  pageToRef,
  toResourceLink,
  DEFAULT_DOCSET,
  DEFAULT_FALLBACK_VERSION,
} from "../utils.js";
import {
  formatSections,
  formatPageList,
  formatDocsets,
  formatVersions,
  formatStats,
} from "../formatter.js";

export function registerListingTools(server: McpServer, db: DocsDatabase) {
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
}
