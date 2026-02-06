# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

An MCP (Model Context Protocol) server that provides multi-version Run:ai documentation and API references to AI assistants. It exposes tools over stdio that query a pre-scraped SQLite database with FTS5 full-text search across docsets (self-hosted, SaaS, multi-tenant, API, legacy).

## Commands

```bash
npm run build          # Compile TypeScript (tsc) → dist/
npm run dev            # Run directly with tsx (no build needed)
npm start              # Run compiled dist/index.js
npm run scrape         # Re-scrape Run:ai docs (all docsets/versions) into SQLite + markdown files
npm run verify-urls    # HEAD-request all configured URLs and report failures
```

There are no linting or formatting scripts configured.

## Architecture

**Core modules:**

- `src/index.ts` — MCP server. Registers tools with `McpServer` from `@modelcontextprotocol/sdk`, validates inputs with Zod, queries `DocsDatabase`, returns results over `StdioServerTransport`.
- `src/db/docs-db.ts` — Read-only SQLite wrapper. `DocsDatabase` class with search, page retrieval, category listing, and version/docset introspection.
- `src/scraper/scrape.ts` + `src/scraper/urls.ts` + `src/scraper/docsets.ts` — Offline scraper (not part of server runtime). Builds a multi-version docset manifest, fetches HTML from Run:ai docs, converts to markdown via JSDOM + `node-html-markdown`, stores in SQLite with FTS5 triggers, and saves `.md` files to `src/data/docs/{docset}/{version}/`.
- `src/scraper/verify-urls.ts` — URL verification script. HEAD-requests all configured URLs and reports failures.

**Data files in `src/data/`:**

- `runai-docs.db` — SQLite database with `pages` table + `pages_fts` virtual table (FTS5)
- `docs/` — markdown files organized by docset/version/category/subcategory
- `helm-reference.md` — Helm command reference
- `runai-api-v2.24-management-spec.md` — Full REST API spec (66KB)

## Key Technical Details

- **Pure ES Modules** — `"type": "module"` in package.json, ES2022 target/module in tsconfig
- **Database lives in `src/data/`, not `dist/`** — The compiled `dist/` code resolves the DB path back to `src/data/runai-docs.db` via project root resolution
- **Path resolution** — Uses `fileURLToPath(import.meta.url)` (not `import.meta.dirname` which is undefined in some environments)
- **MCP SDK v1.26.0** — Uses newline-delimited JSON over stdio (not Content-Length framing)
- **Zod 4.x** — Compatible with MCP SDK 1.26.0
- **Read-only at runtime** — Server opens DB with `{ readonly: true }`, all writes happen only during scraping

## Documentation Categories

Categories and subcategories are derived from the configured URL lists and stored per docset/version. Base URL definitions live in `src/scraper/urls.ts`, and version/docset expansion logic lives in `src/scraper/docsets.ts`.
