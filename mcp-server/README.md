# jetty-mcp-server

MCP server for the [Jetty](https://jetty.io) AI/ML workflow platform. Works with Claude Code, Cursor, Gemini CLI, Codex, and any MCP-compatible tool.

## Quick Start

```bash
npx -y jetty-mcp-server
```

Set your API token:

```bash
export JETTY_API_TOKEN="mlc_your_token_here"
```

Get a token at [jetty.io](https://jetty.io) → Settings → API Tokens.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JETTY_API_TOKEN` | Yes | — | Your Jetty API token (`mlc_...`) |
| `JETTY_API_URL` | No | `https://flows-api.jetty.io` | API base URL |

## Configuration

### Claude Code

```bash
claude mcp add jetty -- npx -y jetty-mcp-server
```

Or add to `.mcp.json`:

```json
{
  "mcpServers": {
    "jetty": {
      "command": "npx",
      "args": ["-y", "jetty-mcp-server"],
      "env": { "JETTY_API_TOKEN": "mlc_your_token" }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "jetty": {
      "command": "npx",
      "args": ["-y", "jetty-mcp-server"],
      "env": { "JETTY_API_TOKEN": "mlc_your_token" }
    }
  }
}
```

### Gemini CLI

```bash
gemini extensions install jetty-extension.json
```

### Generic MCP Client

```bash
JETTY_API_TOKEN=mlc_your_token npx -y jetty-mcp-server
```

## Tools

| Tool | Description |
|------|-------------|
| `list-collections` | List all collections |
| `get-collection` | Get collection details + env var keys |
| `list-tasks` | List tasks in a collection |
| `get-task` | Get task details + workflow definition |
| `create-task` | Create a task with a workflow |
| `update-task` | Update a task's workflow or description |
| `run-workflow` | Run a workflow asynchronously |
| `run-workflow-sync` | Run a workflow synchronously (blocks until done) |
| `list-trajectories` | List recent workflow runs |
| `get-trajectory` | Get full run details |
| `get-stats` | Get execution statistics |
| `add-label` | Label a trajectory (e.g., quality=high) |
| `list-step-templates` | List available step templates |
| `get-step-template` | Get template details and schema |

## Development

```bash
cd mcp-server
npm install
npm run build
JETTY_API_TOKEN=mlc_... node dist/index.js
```

Test with [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## License

MIT
