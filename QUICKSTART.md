# Jetty Quickstart (Any Agent CLI)

This guide works with **any MCP-compatible agent** — no skill execution required.
For Claude Code users, run `/jetty-setup` instead for a guided experience.

## 1. Get Your API Token

Sign up at [flows.jetty.io/sign-up](https://flows.jetty.io/sign-up) → Settings → API Tokens → Create Token.

Your token starts with `mlc_`.

## 2. Install the MCP Server

The Jetty MCP server gives your agent 16 tools for managing workflows.

Configure your agent (pick one):

**Cursor** — add to `.cursor/mcp.json`:
```json
{"mcpServers": {"jetty": {"command": "npx", "args": ["-y", "jetty-mcp-server"], "env": {"JETTY_API_TOKEN": "mlc_your_token"}}}}
```

**VS Code Copilot** — add to `.vscode/mcp.json`:
```json
{"servers": {"jetty": {"command": "npx", "args": ["-y", "jetty-mcp-server"], "env": {"JETTY_API_TOKEN": "mlc_your_token"}}}}
```

**Codex CLI** — add to `~/.codex/config.json`:
```json
{"mcpServers": {"jetty": {"command": "npx", "args": ["-y", "jetty-mcp-server"], "env": {"JETTY_API_TOKEN": "mlc_your_token"}}}}
```

**Gemini CLI**:
```bash
gemini extensions install https://github.com/jettyio/jettyio-skills
```

**Windsurf** — add to `~/.codeium/windsurf/mcp_config.json`:
```json
{"mcpServers": {"jetty": {"command": "npx", "args": ["-y", "jetty-mcp-server"], "env": {"JETTY_API_TOKEN": "mlc_your_token"}}}}
```

**Any other MCP client**:
```bash
JETTY_API_TOKEN=mlc_your_token npx -y jetty-mcp-server
```

## 3. Store Your AI Provider Key

Before running workflows, store your API key in your Jetty collection.

Ask your agent:

> Use the `set-environment-vars` tool to set OPENAI_API_KEY (or GEMINI_API_KEY) on my collection.

Or via curl:
```bash
TOKEN=mlc_your_token
COLLECTION=your-collection-name

curl -s -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "https://flows-api.jetty.io/api/v1/collections/$COLLECTION/environment" \
  -d '{"environment_variables": {"OPENAI_API_KEY": "sk-your-key"}}'
```

## 4. Deploy and Run the Demo

Ask your agent:

> Use `create-task` to create a task called "cute-feline-detector" in my collection with this workflow, then run it with `run-workflow`:

```json
{
  "init_params": {
    "prompt": "a fluffy orange tabby cat sitting in a sunbeam",
    "judge_instruction": "Is this a cute cat? Rate 1-5 for cuteness."
  },
  "step_configs": {
    "generate_image": {
      "activity": "litellm_image_generation",
      "model": "dall-e-3",
      "prompt_path": "init_params.prompt",
      "size": "1024x1024"
    },
    "judge_image": {
      "activity": "simple_judge",
      "model": "gpt-4o",
      "item_path": "generate_image.outputs.images[0].path",
      "instruction_path": "init_params.judge_instruction",
      "score_range": {"min": 1, "max": 5}
    }
  },
  "steps": ["generate_image", "judge_image"]
}
```

## 5. Check Results

Ask your agent:

> Use `list-trajectories` for cute-feline-detector, then `get-trajectory` to show the results.

## Agent Compatibility

| Agent CLI | MCP Tools | Skill Support | Runbook Execution |
|-----------|-----------|---------------|-------------------|
| Claude Code | Full | Full | Full |
| Cursor | Full | N/A | Via API |
| VS Code Copilot | Full | N/A | Via API |
| Codex CLI | Full | N/A | Full (`codex` agent) |
| Gemini CLI | Full | Partial | Full (`gemini-cli` agent) |
| Windsurf | Full | N/A | Via API |
| Zed | Full | N/A | Via API |

## Next Steps

- **Build a runbook**: Copy a [runbook template](skills/create-runbook/templates/) and customize it
- **Browse step templates**: Ask your agent to use `list-step-templates`
- **Full docs**: [docs.jetty.io](https://docs.jetty.io)
