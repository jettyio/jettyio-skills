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
| `check-secrets` | Compare a collection's env vars with what a runbook needs |
| `set-environment-vars` | Set env vars on a collection |
| `get-trial-status` / `activate-trial` | Trial keys for a collection |
| `list-routines` / `get-routine` / `create-routine` / `update-routine` / `delete-routine` / `pause-routine` / `resume-routine` / `run-routine-now` / `list-routine-runs` | Scheduled runs (the API calls a schedule a *routine*) |

## Use as a library

Version 1.1.0 splits the package into importable pieces (all ESM):

| Import | Runs in | What it gives you |
|--------|---------|-------------------|
| `jetty-mcp-server` | Node | `JettyClient` (token from env / `~/.config/jetty/token`), `registerTools`, the catalog, and the WebMCP helpers |
| `jetty-mcp-server/api-client` | Browser + Node | `JettyApiClient` — the API client with the token, origin and URL builder passed in |
| `jetty-mcp-server/tool-definitions` | Browser + Node | `JETTY_TOOLS` — every tool as data: name, description, zod input shape, annotations, handler |
| `jetty-mcp-server/tools` | Node | `registerTools(server, client)` for an `McpServer` |
| `jetty-mcp-server/webmcp` | Browser + Node | The catalog as WebMCP tools (see below) |

`npx jetty-mcp-server` still starts the stdio server; nothing changes for editor setups.

## WebMCP: the same tools in the browser

[WebMCP](https://webmachinelearning.github.io/webmcp/) lets a web page hand tools to an
in-browser agent through `navigator.modelContext`. A site that already knows who the
visitor is can register the whole Jetty catalog, executed with the visitor's own session:

```ts
import { JettyApiClient } from "jetty-mcp-server/api-client";
import { findModelContext, registerJettyWebMcpTools } from "jetty-mcp-server/webmcp";

const modelContext = findModelContext(); // document.modelContext, then navigator.modelContext
if (modelContext) {
  const client = new JettyApiClient({
    token: () => session.getToken(),               // called on every request
    buildUrl: (path) => `/api/mise${path.slice("/api/v1".length)}`, // a same-origin proxy
  });
  const controller = new AbortController();
  registerJettyWebMcpTools(modelContext, client, {
    signal: controller.signal,      // abort to unregister
    readOnly: false,                // or true for list/get tools only
    include: ["list-tasks", "run-workflow"], // optional allow-list
  });
}
```

Each WebMCP tool carries the MCP tool's name, description, a JSON-Schema `inputSchema`
derived from the zod shape, MCP-style `annotations` (`readOnlyHint`, `destructiveHint`),
and an `execute` that validates input, calls the API, and returns the same
`{ content: [{ type: "text", text }] }` envelope the MCP server returns (with
`isError: true` on failure instead of throwing). Both API shapes are supported:
`registerTool(tool, { signal })` and the earlier `provideContext({ tools })`.

`flows-api.jetty.io` sends no CORS headers, so a page must call it through a proxy on its
own origin (hence `buildUrl`) or a backend that adds the bearer token. jetty.io does this
for signed-in users on its app pages.

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
