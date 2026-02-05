# Run:ai MCP Server

An MCP (Model Context Protocol) server that exposes NVIDIA Run:ai v2.24 documentation and API references to AI assistants via tools and resources.

## Install

1. `npm install`
2. `npm run build`

## Run

- `npm start` (runs the compiled server)
- `npm run dev` (runs from TypeScript sources via tsx)

## Refresh Docs

- `npm run scrape` (re-scrape docs and rebuild the SQLite database)
- `npm run verify-urls` (validate the configured doc URLs)

## Configuration

- `RUNAI_DOCS_DB`: optional path to `runai-docs.db` if you want to override the default lookup.
