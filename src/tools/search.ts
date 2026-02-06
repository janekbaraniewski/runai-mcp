import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DocsDatabase } from "../db/docs-db.js";
import type { PageFetcher } from "../fetch-strategy.js";
import {
  docContextSchema,
  contentOptionsSchema,
  SearchOutputSchema,
  GetPageOutputSchema,
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
} from "../schemas.js";
import {
  resolveContext,
  pageToRef,
  toResourceLink,
  pageWithContent,
  toolError,
  MAX_MATCHES,
} from "../utils.js";
import { formatSearchResults, formatPageHeader } from "../formatter.js";

export function registerSearchTools(server: McpServer, db: DocsDatabase, fetcher: PageFetcher) {
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
}
