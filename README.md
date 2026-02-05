# Run:ai MCP Server

An MCP (Model Context Protocol) server that exposes NVIDIA Run:ai v2.24 documentation and API references to AI assistants via tools and resources.

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

## Configuration

- `RUNAI_DOCS_DB`: optional path to `runai-docs.db` if you want to override the default lookup.

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
