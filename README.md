# Run:ai MCP Server

An MCP (Model Context Protocol) server that exposes NVIDIA Run:ai documentation and API references across multiple versions and docsets (self-hosted, SaaS, multi-tenant, API, legacy).

## Install (npm registry)

- Global install:
  `npm install -g runai-mcp-server`
- One-off run:
  `npx -y runai-mcp-server`

## Install (from source)

1. `npm install`
2. `npm run build`

## Run

- `npm start` (runs the compiled server)
- `npm run dev` (runs from TypeScript sources via tsx)

## Refresh Docs

- `npm run scrape` (re-scrape docs and rebuild the SQLite database)
- `npm run verify-urls` (validate the configured doc URLs)
- Default scrape scope is latest docs only (`2.24`) for `self-hosted`, `api`, `saas`, and `multi-tenant`.
- Non-cached versions are fetched dynamically at runtime when a specific page/tool request needs them.

## Release Build

- `npm run release:prepare`
- Runs scraper + TypeScript build + stages `dist/data/runai-docs.db` for npm packaging.
- GitHub release workflow runs this command before `npm pack`, so published package is runnable out of the box.

## Configuration

- `RUNAI_DOCS_DB`: optional path to `runai-docs.db` if you want to override the default lookup.
- `RUNAI_DOCS_DOCSET`: default docset for tools that accept a docset (default: `self-hosted`).
- `RUNAI_DOCS_VERSION`: default version for tools that accept a version (default: `latest`).
- `RUNAI_DOCS_LATEST_VERSION`: fallback numeric version when `latest` cannot be resolved (default: `2.24`).
- `RUNAI_DOCS_DOCSETS`: scraper-only, comma-separated list of docsets to include (default: `self-hosted,api,saas,multi-tenant`).
- `RUNAI_DOCS_VERSIONS`: scraper-only, comma-separated list of versions to include (default: `2.24`).
- `RUNAI_DOCS_DISCOVER_LINKS`: scraper-only, set to `0` to disable internal link discovery (default: enabled).
- `RUNAI_DOCS_MAX_PAGES`: scraper-only, max pages to collect including discovered links (default: `2000`).
- `RUNAI_DOCS_MAX_LINKS_PER_PAGE`: scraper-only, cap discovered links per page (default: `200`).
- `RUNAI_DOCS_LIVE_LOOKUP`: runtime live fallback for uncached pages (`1` enabled by default, set `0` to disable).
- `RUNAI_DOCS_LIVE_TIMEOUT_MS`: timeout for runtime live fallback requests (default: `12000`).

## MCP Client Setup

### OpenAI Codex

Add via CLI:

```bash
codex mcp add runai-docs -- runai-mcp-server
```

Or edit `~/.codex/config.toml` (or project-scoped `.codex/config.toml`):

```toml
[mcp_servers.runai-docs]
command = "runai-mcp-server"
args = []
# env = { RUNAI_DOCS_DB = "/absolute/path/to/runai-docs.db" }
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "runai-docs": {
      "type": "stdio",
      "command": "runai-mcp-server",
      "args": [],
      "env": {
        "RUNAI_DOCS_DB": "/absolute/path/to/runai-docs.db"
      }
    }
  }
}
```

Common config locations:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

### OpenCode

Config file locations:

- Global: `~/.config/opencode/opencode.json`
- Project: `opencode.json` in the repo root

Add to `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "runai-docs": {
      "type": "local",
      "command": ["runai-mcp-server"],
      "enabled": true,
      "environment": {
        "RUNAI_DOCS_DB": "/absolute/path/to/runai-docs.db"
      }
    }
  }
}
```

### Cursor

Create or edit `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project):

```json
{
  "mcpServers": {
    "runai-docs": {
      "type": "stdio",
      "command": "runai-mcp-server",
      "args": [],
      "env": {
        "RUNAI_DOCS_DB": "/absolute/path/to/runai-docs.db"
      }
    }
  }
}
```
