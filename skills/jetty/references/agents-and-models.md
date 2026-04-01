# Agent Runtimes & Models

Jetty runs agent code inside sandboxed environments. When running a runbook, you choose an **agent runtime** (the coding agent CLI), a **model** (the LLM powering it), and a **snapshot** (the container environment).

## Supported Agent Runtimes

| Agent | Runtime ID | Default Model | API Key Env Var | Best For |
|-------|-----------|--------------|-----------------|----------|
| Claude Code | `claude-code` | `claude-sonnet-4-6` | `ANTHROPIC_API_KEY` | Reasoning, tool use, complex multi-step tasks |
| Codex | `codex` | `gpt-5.4` | `OPENAI_API_KEY` | Code generation, OpenAI ecosystem |
| Gemini CLI | `gemini-cli` | `gemini-3.1-pro-preview` | `GOOGLE_API_KEY` | Google ecosystem, free tier available |

### Model Options

**Anthropic (claude-code)**:
- `claude-sonnet-4-6` — Fast, cost-effective, recommended default
- `claude-opus-4-6` — Most capable, higher cost

**OpenAI (codex)**:
- `gpt-5.4` — Latest, most capable
- `gpt-4.1` — Stable, lower cost
- `o4-mini` — Fast reasoning
- `o3` — Advanced reasoning

**Google (gemini-cli)**:
- `gemini-3.1-pro-preview` — Latest preview
- `gemini-2.5-pro` — Stable
- `gemini-2.5-flash` — Fast, lower cost

### Agent Inference

If you don't specify an agent in your runbook frontmatter, Jetty infers it from the model name:
- `claude-*` or `anthropic/*` → `claude-code`
- `gpt-*`, `o1-*`, `o3-*`, `o4-*` → `codex`
- `gemini-*` or `gemini/*` → `gemini-cli`

## Sandbox Snapshots

The snapshot determines what's pre-installed in the agent's sandbox.

| Snapshot | Includes | Startup | Use When |
|----------|----------|---------|----------|
| `python312-uv` | Python 3.12, uv package manager, network access | ~5s | Most tasks: data processing, API calls, code gen, file manipulation |
| `prism-playwright` | Everything in python312-uv + Playwright + Chromium | ~10s | Browser automation: screenshots, web scraping, OAuth, HTML rendering |

### Custom Images

You can also provide a custom container image instead of a snapshot. See [Custom Sandbox Images](https://docs.jetty.io/guides/custom-sandbox-images) for details.

Set the `image` parameter in your runbook frontmatter or Jetty API call:
```yaml
image: ghcr.io/myorg/my-env:v1.2
```

Supported registries: Docker Hub, GHCR, Google Artifact Registry, ECR Public.

## Runbook Frontmatter

Declare your agent, model, and snapshot in the runbook's YAML frontmatter:

```yaml
---
version: "1.0.0"
evaluation: programmatic
agent: claude-code
model: claude-sonnet-4-6
snapshot: python312-uv
---
```

These fields are read by the `/jetty` skill when launching a runbook-mode run via the chat completions API. If omitted, defaults are: agent=claude-code, model=claude-sonnet-4-6, snapshot=python312-uv.

## API Key Storage

Agent runtime API keys are stored in your collection's environment variables on the Jetty server — never locally.

Use the MCP tools `check-secrets` and `set-environment-vars`, or the `/jetty` skill:
```
/jetty check secrets for ANTHROPIC_API_KEY in my-collection
/jetty set ANTHROPIC_API_KEY in my-collection
```
