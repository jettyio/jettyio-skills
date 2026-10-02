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

If `model_provider` is omitted, Jetty auto-defaults in this order: `openrouter` when `OPENROUTER_API_KEY` is available and the agent supports it → `bedrock` when `AWS_BEARER_TOKEN_BEDROCK` is set → legacy inference from `agent` (`claude-code` → `anthropic`, `opencode` → `openrouter`, `codex` → `openai`, `gemini-cli` → `google`). Always set it explicitly in frontmatter to avoid surprises.

> **Trial runs route through OpenRouter.** Jetty trial keys include `OPENROUTER_API_KEY`, so a trial run with no explicit `model_provider` auto-defaults to `openrouter` — progress shows `Running agent: claude-code via openrouter`. That's Jetty's trial routing (same model), not your provider choice being ignored. To pin a provider, set `model_provider` in the runbook frontmatter, or pass `jetty.model_provider` on the chat-completions request (honored by current mise; older deployments only read the frontmatter).

**Recommended:** route `claude-code` through `openrouter` (`model: anthropic/claude-sonnet-4.6` + `OPENROUTER_API_KEY`) — one key, unified billing, and provider failover. Anthropic-direct routing (`model: claude-sonnet-4-6` + `model_provider: anthropic` + `ANTHROPIC_API_KEY`) is fully supported if you prefer it.

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
strict_evaluation: false  # optional — see below
agent: claude-code
model: anthropic/claude-sonnet-4.6
model_provider: openrouter
snapshot: python312-uv
primary_outputs:          # optional — headline deliverable(s), relative to results_dir
  - report.html
secrets:
  GITHUB_TOKEN:           # consumed by the source below: withheld from the agent
    env: GITHUB_TOKEN
code_checks:              # optional — how the ## Code Checks run and what they need
  executor: jetty         # jetty (default) runs command checks after the agent exits; agent hands them to the agent
  timeout_sec: 120        # per check, max 900
  sources:
    - name: checks
      type: git
      url: https://github.com/acme/output-checks
      ref: main             # branch, tag or commit SHA
      secret: GITHUB_TOKEN  # must also be declared under secrets:
---
```

`agent`, `model`, `model_provider`, `snapshot`, `mcp_servers`, `code_checks` and `strict_evaluation` are **task defaults**: mise copies them into the task's `init_params` when the task is created, and a run may override any of them per top-level key. `secrets:` is a declaration the run must satisfy (names only, never values) and is never copied.

These fields are read by the `/jetty` skill when launching a runbook-mode run via the chat completions API. The create-runbook templates set the recommended config — `claude-code` + `anthropic/claude-sonnet-4.6` + `model_provider: openrouter`. If you omit `model_provider` entirely, Jetty falls back to agent-based inference (`claude-code` → `anthropic`), so set it explicitly.

### `primary_outputs`

Optional. An ordered list of the runbook's headline deliverable(s), each given as a path **relative to `results_dir`** (e.g. `report.html` or `images/final.png`) — a single string is also accepted. After a run completes, mise resolves these declarations to their stored artifacts and emits them as `primary_files` on the `run` step output, in declaration order. The web app (spot) surfaces the **first** resolved entry as the run's "Main output" instead of guessing from filesystem walk order. When `primary_outputs` is omitted, behavior is unchanged: the first non-special results file is used. Keep the first entry in sync with the first row of the **REQUIRED OUTPUT FILES** table. Do not list `summary.md` or `validation_report.json` here — those are surfaced in their own dedicated panels.

### `strict_evaluation`

Optional, default `false`. A `## Code Checks` entry with an `agent` fence is the agent's to run and report. One the agent did not report is written into `validation_report.json` by Jetty as `skipped`; with `strict_evaluation: true` it is written as `error`, which fails the run. Command checks are unaffected: Jetty runs those itself.

### `code_checks`

Optional. How the `## Code Checks` run and what they need. Under v2 each `### <id> — <name>` heading is followed by one fenced block whose language is the check's kind: a `bash` fence (also `sh`, `shell` or no language) is a command run under `bash -e -o pipefail` with `RESULTS_DIR`, `CHECKS_DIR` and `ASSETS_DIR` set and `{{results_dir}}` / `{{checks_dir}}` / `{{assets_dir}}` substituted; a `yaml` (or `check`) fence is a built-in (`use:` one of `file_exists`, `min_size`, `json_valid`, `regex_present`, `regex_absent`, `markdown_relative_links_resolve`, paths relative to the results directory); an `agent` fence is an instruction only the agent can carry out. Exit 0 is `pass`; a timeout, a built-in with a bad spec, a command the shell cannot run or a heading with no usable fence is `error`; any other exit is `fail`. Every entry Jetty writes carries `details.runner: "jetty"`.

- `executor` — `jetty` (default): Jetty runs the command checks in the run's sandbox after the agent process has exited, and its entries replace any the agent wrote for them. `agent`: the agent runs the command checks too and its entries stand. Malformed and unreported checks are recorded by Jetty either way.
- `timeout_sec` — per check, default 120, max 900.
- `sources` — repositories cloned to `/app/checks/<name>` (`type: git`, `https://` `url`, optional `ref` as a branch, tag or commit SHA, optional `secret` naming an entry in `secrets:`). Each source is probed from the worker before the sandbox exists, so a bad URL, dead token or missing ref fails the run before anything is paid for. Under the `jetty` executor the clone happens after the agent exits, so the agent never sees the check code and an agent check must not reference `/app/checks`; under `executor: agent` it is cloned before the agent. A source's `secret` is consumed by Jetty and withheld from the agent's environment.
- `mcp_servers` — merged into the run's MCP servers.
- `references` — URLs the agent may read while checking; not provisioned.

### Secret exposure

A `secrets:` entry (`NAME: {env: VAR}`) is forwarded to the agent's environment unless a `code_checks.sources[]` entry or an MCP server names it with `secret:`, in which case Jetty consumes it and withholds it from the agent. `expose_to_agent: true|false` overrides either default. The code checks Jetty runs receive the secrets the agent itself received and no other; `expose_to_checks: true` opts a withheld secret in. Declared secret values are scrubbed from check output before it is recorded.

## API Key Storage

Agent runtime API keys are stored in your collection's environment variables on the Jetty server — never locally.

Use the MCP tools `check-secrets` and `set-environment-vars`, or the `/jetty` skill:
```
/jetty check secrets for ANTHROPIC_API_KEY in my-collection
/jetty set ANTHROPIC_API_KEY in my-collection
```

## Multimodal Generation in the Sandbox

When an agent runs inside a runbook sandbox, mise auto-forwards a curated set of multimodal-generation keys from the trajectory environment into the agent's process env. Any of these keys, when present on the collection (user-supplied) or available via the Jetty trial fallback, will be readable from the agent's code as a normal env var:

| Key | Typical use |
|---|---|
| `REPLICATE_API_TOKEN` | Image/video generation (Flux, Seedance, Sora), segmentation, embeddings |
| `GEMINI_API_KEY` | Imagen image generation, Gemini vision inputs |
| `OPENAI_API_KEY` | DALL·E, gpt-image-1, GPT-4 vision |

No frontmatter declaration is required for these three keys — the auto-forward applies to every runbook run. Declare them in the runbook's `secrets:` block anyway if you want the verification block in Step 1 to flag missing setup early; explicit `secrets:` entries take precedence over auto-forward and double as documentation.

Other keys (e.g. `GITHUB_PAT`, `HUGGINGFACE_TOKEN`, `STRIPE_API_KEY`) are *not* auto-forwarded and must be declared in `secrets:` to reach the sandbox.
