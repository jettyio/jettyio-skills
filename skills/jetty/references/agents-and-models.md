# Agent Runtimes & Models

Jetty runs agent code inside sandboxed environments. When running a runbook, you choose an **agent runtime** (the coding agent CLI), a **model** (the LLM powering it), and a **snapshot** (the container environment).

## Supported Agent Runtimes

| Agent | Runtime ID | Default Model | API Key Env Var | Best For |
|-------|-----------|--------------|-----------------|----------|
| **Claude Code** ⭐ | `claude-code` | `claude-sonnet-4-6` | `ANTHROPIC_API_KEY` | **Recommended default** — strong reasoning, broad tool support, native MCP/tool-use ergonomics |
| opencode | `opencode` | `anthropic/claude-sonnet-4.6` | `OPENROUTER_API_KEY` | Routes through OpenRouter for unified billing, provider failover, and one key for any catalog model |
| Codex | `codex` | `gpt-5.5` | `OPENAI_API_KEY` | Code generation, OpenAI ecosystem |
| Gemini CLI | `gemini-cli` | `gemini-3.1-pro-preview` | `GOOGLE_API_KEY` | Google ecosystem, free tier available |

### Model Options

**Anthropic (claude-code)** — recommended:
- `claude-sonnet-4-6` — Fast, cost-effective, default
- `claude-opus-4-6` — Most capable, higher cost

**OpenRouter (opencode)**:
- `anthropic/claude-sonnet-4.6` — Default opencode model. Note the OpenRouter slug uses dot-versioning (`4.6`) and the `anthropic/` vendor prefix; the Anthropic-internal `claude-sonnet-4-6` spelling is *not* a valid OpenRouter model id.
- Any other OpenRouter-catalog id (e.g. `anthropic/claude-opus-4.6`, `openai/gpt-5.5`, `google/gemini-2.5-pro`) — opencode passes the model id straight through to OpenRouter.

**OpenAI (codex)**:
- `gpt-5.5` — Latest, most capable
- `gpt-5.4` — Stable, prior generation
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

> **Heads up:** the inference above will route `anthropic/claude-sonnet-4.6` to `claude-code`, not `opencode`. If you want opencode + OpenRouter, set `agent: opencode` and `model_provider: openrouter` explicitly in frontmatter — don't rely on inference.

### Routing Through a Provider (`model_provider`)

`model_provider` controls *how* the model id is resolved at runtime. Set it in runbook frontmatter or pass it as an `init_param` on the workflow.

| Provider | Use With | Required Env Var |
|----------|----------|------------------|
| `openrouter` | Any agent that supports it (`opencode`, `claude-code`, `gemini-cli`) | `OPENROUTER_API_KEY` |
| `anthropic` | `claude-code` | `ANTHROPIC_API_KEY` |
| `openai` | `codex` | `OPENAI_API_KEY` |
| `google` | `gemini-cli` | `GOOGLE_API_KEY` |
| `bedrock` | `claude-code` (and others) | `AWS_BEARER_TOKEN_BEDROCK` |

If `model_provider` is omitted, Jetty infers it from `agent`: `claude-code` → `anthropic`, `opencode` → `openrouter`, `codex` → `openai`, `gemini-cli` → `google`. Always set it explicitly in frontmatter to avoid surprises.

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
model_provider: anthropic
snapshot: python312-uv
---
```

These fields are read by the `/jetty` skill when launching a runbook-mode run via the chat completions API. If omitted, defaults are: agent=claude-code, model=claude-sonnet-4-6, model_provider=anthropic, snapshot=python312-uv.

## API Key Storage

Agent runtime API keys are stored in your collection's environment variables on the Jetty server — never locally.

Use the MCP tools `check-secrets` and `set-environment-vars`, or the `/jetty` skill:
```
/jetty check secrets for ANTHROPIC_API_KEY in my-collection
/jetty set ANTHROPIC_API_KEY in my-collection
```
