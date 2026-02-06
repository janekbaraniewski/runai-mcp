#!/usr/bin/env node
import { createRequire } from "node:module";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DocsDatabase } from "./db/docs-db.js";
import { PageCache } from "./cache.js";
import { PageFetcher, type FetchStrategy } from "./fetch-strategy.js";
import {
  resolveContext,
  decodeResourceUrl,
  buildPageMarkdown,
  MAX_COMPLETE_RESULTS,
} from "./utils.js";
import {
  registerSearchTools,
  registerListingTools,
  registerDocsTools,
} from "./tools/index.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { name: string; version: string; description: string };

const FETCH_STRATEGY = (process.env.RUNAI_DOCS_FETCH_STRATEGY ?? "cache-first") as FetchStrategy;
const LIVE_LOOKUP_ENABLED = (process.env.RUNAI_DOCS_LIVE_LOOKUP ?? "1") !== "0";
const LIVE_LOOKUP_TIMEOUT_MS = Number(process.env.RUNAI_DOCS_LIVE_TIMEOUT_MS ?? "12000");

function registerResources(server: McpServer, db: DocsDatabase, fetcher: PageFetcher) {
  const template = new ResourceTemplate("runai-docs://{docset}/{version}/page/{url}", {
    list: undefined,
    complete: {
      url: (value) => {
        if (!value) return [];
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
      annotations: { audience: ["assistant", "user"] },
    },
    (uri, variables) => {
      const encoded = typeof variables.url === "string" ? variables.url : "";
      const docsetInput = typeof variables.docset === "string" ? variables.docset : "";
      const versionInput = typeof variables.version === "string" ? variables.version : "";
      if (!encoded) {
        throw new Error("Missing resource URL value");
      }
      const decoded = decodeResourceUrl(encoded);
      const context = resolveContext(db, { docset: docsetInput, version: versionInput });
      if (!context.docset || !context.version) {
        throw new Error("Missing docset or version for resource lookup");
      }
      const page = fetcher.getPageFromDb(decoded, { docset: context.docset, version: context.version });
      if (!page) {
        throw new Error(`Page not found for ${context.docset}/${context.version} URL: ${decoded}`);
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
  registerSearchTools(server, db, fetcher);
  registerListingTools(server, db);
  registerDocsTools(server, db, fetcher);
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
    version: pkg.version,
    description: pkg.description,
  });

  registerResources(server, db, fetcher);
  registerTools(server, db, fetcher);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Run:ai MCP server running on stdio");

  const shutdown = async () => {
    if (db) db.close();
    await server.close();
  };

  process.on("SIGINT", () => shutdown().catch(() => undefined));
  process.on("SIGTERM", () => shutdown().catch(() => undefined));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
