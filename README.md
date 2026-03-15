# Jetty — AI/ML Workflows for Any Agent

Build, run, and monitor AI/ML workflows on [Jetty](https://jetty.io) from any AI coding tool. Works with Claude Code, Cursor, VS Code Copilot, Windsurf, Zed, Gemini CLI, Codex CLI, and any MCP-compatible agent.

## Quick Start (Claude Code)

```bash
claude plugin marketplace add jettyio/agent-skill
claude plugin install jetty@jetty
```

Then run `/jetty-setup` to create an account, configure your API key, and run your first workflow in under 5 minutes.

## Install in Your Tool

Jetty uses the [Model Context Protocol](https://modelcontextprotocol.io) (MCP) to connect to your agent. Pick your tool below.

### Claude Code

**Plugin (recommended)** — includes guided setup wizard, workflow skills, and MCP tools:

```bash
claude plugin marketplace add jettyio/agent-skill
claude plugin install jetty@jetty
```

Then run `/jetty-setup` to get started interactively.

**MCP server only:**

```bash
claude mcp add jetty -- npx -y jetty-mcp-server
```

Or add to your project's `.mcp.json`:

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

Add to `.cursor/mcp.json` in your project root:

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

### VS Code Copilot

Add to `.vscode/mcp.json` in your project root:

```json
{
  "servers": {
    "jetty": {
      "command": "npx",
      "args": ["-y", "jetty-mcp-server"],
      "env": { "JETTY_API_TOKEN": "mlc_your_token" }
    }
  }
}
```

Or run `MCP: Add Server` from the Command Palette.

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

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

### Zed

Add to your Zed settings (`~/.config/zed/settings.json`):

```json
{
  "context_servers": {
    "jetty": {
      "command": {
        "path": "npx",
        "args": ["-y", "jetty-mcp-server"],
        "env": { "JETTY_API_TOKEN": "mlc_your_token" }
      }
    }
  }
}
```

### Gemini CLI

```bash
gemini extensions install https://github.com/jettyio/agent-skill
```

During installation, you'll be prompted for your Jetty API token. The extension registers the MCP server and loads context automatically.

To install from a local clone instead:

```bash
gemini extensions install --path /path/to/agent-skill
```

### Codex CLI

Add to `~/.codex/config.json`:

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

### Any Other MCP Client

```bash
JETTY_API_TOKEN=mlc_your_token npx -y jetty-mcp-server
```

The server communicates over stdio using the MCP protocol.

---

## Get Your API Token

1. Sign up at [flows.jetty.io](https://flows.jetty.io/sign-up)
2. Go to **Settings → API Tokens**
3. Create a token (starts with `mlc_`)
4. Add it to your tool's config as shown above

---

## First-Time Setup

Once connected, ask your agent to help you get started. This works in **any** MCP-connected tool — just paste the prompt below into your agent's chat:

> Set up Jetty for me. List my collections, then deploy the cute-feline-detector demo workflow using the `create-task` tool with [this workflow JSON](skills/jetty/templates/cute-feline-detector-openai.json). Then run it with `run-workflow` using the prompt "a fluffy orange tabby cat sitting in a sunbeam". Poll `list-trajectories` until it completes, then show me the results with `get-trajectory`.

Before running the demo, store your AI provider key in your collection's environment variables. Ask your agent:

> Use the Jetty `get-collection` tool to check my collection's environment variables. I need to add my OpenAI API key (or Gemini API key) so workflows can use it.

**Claude Code users:** Just run `/jetty-setup` instead — the guided wizard handles all of this automatically.

---

## Available MCP Tools

Once connected, your agent has access to 14 tools:

| Tool | Description |
|------|-------------|
| `list-collections` | List all collections (workspaces) |
| `get-collection` | Get collection details and environment variable keys |
| `list-tasks` | List tasks (workflows) in a collection |
| `get-task` | Get task details and workflow definition |
| `create-task` | Create a new task with a workflow |
| `update-task` | Update a task's workflow or description |
| `run-workflow` | Run a workflow asynchronously |
| `run-workflow-sync` | Run a workflow synchronously (blocks until done) |
| `list-trajectories` | List recent workflow runs |
| `get-trajectory` | Get full run details with step outputs |
| `get-stats` | Get execution statistics |
| `add-label` | Label a trajectory (e.g., quality=high) |
| `list-step-templates` | List available step templates |
| `get-step-template` | Get template details and schema |

---

## Claude Code Skills

The plugin adds two skills for richer Claude Code integration:

### `/jetty-setup` — Guided Onboarding
Interactive wizard that handles account creation, API key storage, provider selection (OpenAI or Gemini), and runs a demo workflow — all in under 5 minutes.

### `/jetty` — Natural Language Workflow Management

```
/jetty list collections
/jetty list tasks in my-project
/jetty run my-project/my-task with prompt="Hello, world!"
/jetty show the last trajectory for my-project/my-task
/jetty create a task called test-echo in my-project using text_echo
/jetty add label quality=high to trajectory abc123 in my-project/my-task
```

---

## Workflow Templates

Ready-to-use templates are in [`skills/jetty/templates/`](skills/jetty/templates/):

| Template | Description |
|----------|-------------|
| **cute-feline-detector-openai** | Prompt → DALL-E 3 image → GPT-4o cuteness judge |
| **cute-feline-detector-gemini** | Prompt → Gemini image → Gemini Flash cuteness judge |
| simple-chat | Basic LLM chat with system prompt |
| model-comparison | Compare two LLM responses with an AI judge |
| image-generation | Text-to-image with Replicate/FLUX |
| batch-processor | Fan-out parallel processing |
| document-summarizer | Configurable document summarization |

Use the `create-task` MCP tool to deploy any template to your collection.

---

## Shell Functions (Standalone CLI)

For direct terminal usage without any AI tool:

```bash
export JETTY_API_TOKEN="mlc_your_token_here"
source path/to/skills/jetty/jetty-cli.sh

jetty_health                                    # Check connectivity
jetty_collections                               # List collections
jetty_run_sync my-project my-task '{"prompt": "Hello"}'  # Run a workflow
jetty_trajectories my-project my-task           # View execution history
jetty_help                                      # Full command reference
```

---

## How It Works

Jetty runs AI/ML workflows defined as JSON pipelines. Each workflow has:
- **init_params** — Input parameters (e.g., a prompt)
- **step_configs** — Pipeline steps (e.g., LLM call → image generation → judge)
- **steps** — Execution order

Results are stored as **trajectories** with full step-by-step outputs, downloadable files, and labeling support.

## Platform

| Service | URL | Purpose |
|---------|-----|---------|
| Jetty API | `flows-api.jetty.io` | All operations: workflows, collections, tasks, datasets, trajectories, files |
| Web UI | `flows.jetty.io` | Dashboard and management |

## Prerequisites

- Node.js 18+ (for the MCP server via `npx`)
- A Jetty API token ([get one here](https://flows.jetty.io/sign-up))
- An OpenAI or Google Gemini API key (for image generation workflows)

## Documentation

- [AI Tool Integrations](docs/integrations.md)
- [API Reference](docs/api-reference.md)
- [Workflow Building Guide](docs/workflow-guide.md)
- [Known Gotchas](docs/gotchas.md)

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Invalid or expired token" | Regenerate at flows.jetty.io → Settings → API Tokens |
| "Access denied" | Verify your token has access to the collection |
| MCP tools not showing up | Restart your editor/agent after config changes |
| Workflow fails | Use `get-trajectory` to inspect step-by-step outputs |
| `/jetty-setup` not found | Claude Code only — reinstall: `claude plugin marketplace add jettyio/agent-skill && claude plugin install jetty@jetty` |

## License

MIT — see [LICENSE](LICENSE) for details.
