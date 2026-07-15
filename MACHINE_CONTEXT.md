# Jetty — Machine Context

Deep reference for an agent operating Jetty. If you only want the pasteable
onboarding trigger, read [`agent-instructions.md`](./agent-instructions.md) — this
file is what that one points to when it needs detail.

Jetty runs **runbooks**: plain-markdown files that tell a coding agent how to do a
long, multi-step job end-to-end in a fresh sandbox, capturing every step as a
replayable **trajectory**. You (the agent) either author a runbook, run one, or
check on a run.

---

## Base facts

- **API host:** `https://flows-api.jetty.io` — all API calls. (`https://jetty.io`
  is the web app only; never hit it for API calls.)
- **Auth:** a collection-scoped token starting with `mlc_`, sent as
  `Authorization: Bearer <token>`. Stored at `~/.config/jetty/token` (chmod 600).
- **Never print, echo, or log the token.** Refer to it redacted (`mlc_…xxxx`).
- **Collection:** the user's workspace namespace. **Do not make the user name or
  reason about collections** — treat it as an internal detail. Read the collection
  name from the API (`GET /api/v1/collections/`) when you need it; don't prompt.

---

## State model

An agent's understanding of "where the user is" comes from three checks, in order:

1. **Token present & valid?** `GET /api/v1/collections/` with the stored token
   returns collection data (not an error) → connected. No token / 401 → not
   connected.
2. **Provider keys or trial?** `GET /api/v1/collections/{collection}/environment`
   lists configured env-var **names** (never values). If empty, the collection
   can still run via an activated **trial** (Jetty-provided keys, capped runs).
3. **Runs so far?** `GET /api/v1/trajectories/{collection}/{task}` lists past
   trajectories for a task — this is the history the web app replays.

There is no local session state beyond the token file. Everything else is a
server read.

---

## CLI verb emulation

Jetty has no standalone `jetty` binary yet. These verbs are **named procedures**
you perform via the API. They are written as stable contracts so a future real CLI
can back the same names without changing this doc or anything that references it.
Each verb has a **human meaning**, an **exact procedure**, and a **JSON output
contract** (what you report back / would print with `--json`).

### `jetty run <runbook> --json`  — live today

**Meaning:** execute a runbook on Jetty and return where its results live.

**Procedure:** POST the runbook markdown as the system prompt to the
chat-completions endpoint with a `jetty` block. The block's fields come straight
from the runbook's frontmatter.

```bash
TOKEN="$(cat ~/.config/jetty/token)"
curl -s -X POST "https://flows-api.jetty.io/v1/chat/completions" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d @- <<'JSON'
{
  "model": "anthropic/claude-sonnet-4.6",
  "messages": [
    {"role": "system", "content": "<full runbook markdown>"},
    {"role": "user", "content": "Execute the runbook."}
  ],
  "jetty": {
    "runbook": true,
    "collection": "<collection>",
    "task": "<task-name>",
    "agent": "claude-code",
    "model_provider": "openrouter",
    "snapshot": "python312-uv",
    "template_variables": {},
    "file_paths": []
  }
}
JSON
```

**Output contract:**
```json
{ "status": "completed|failed|running", "trajectory_id": "…",
  "collection": "…", "task": "…",
  "primary_output": "<results_dir>/<first primary_outputs entry>",
  "results_files": ["…"], "trajectory_url": "https://jetty.io/…" }
```

### `jetty status <trajectory_id> --json`  — live today

**Meaning:** report progress/outcome of a run.

**Procedure:** `GET /api/v1/trajectories/{collection}/{task}` returns
`{"trajectories":[…]}`; find the one whose id matches, or `GET
/api/v1/trajectories/{collection}/{task}/{folder}/{trajectory_id}` for one run.
Trajectory **steps are objects keyed by step name** (e.g. `.steps.run`), not an
array.

**Output contract:**
```json
{ "status": "completed|failed|running",
  "steps_completed": 4, "steps_total": 6,
  "trajectory_url": "https://jetty.io/…", "error": null }
```

### `jetty simulate <name> --json`  — rolling out (hosted onboarding)

**Meaning:** run a pre-built example runbook (e.g. `conference-abstracts`) so a
brand-new user sees real output before they have any account. Backed by a hosted,
rate-limited demo endpoint on `jetty.io` — no token required, nothing to install.

**Status:** the hosted endpoint is being rolled out. Until it is live, onboard via
`agent-instructions.md`'s connect-and-build path. When live, the contract is:
```json
{ "run_id": "…", "task": "conference-abstracts",
  "status": "completed|failed|running",
  "steps": ["…"], "report_files": ["report.md", "abstracts_rollup.csv"] }
```

### `jetty init --json`  — rolling out (hosted onboarding)

**Meaning:** create a workspace from just an email — no separate signup. Returns a
stored token; the email doubles as the account. Backed by a hosted endpoint.

**Status:** rolling out. Until live, use the sign-up flow in `agent-instructions.md`.
When live, the contract is:
```json
{ "collection": "<auto-generated>", "trial_runs": 10,
  "dashboard_url": "https://jetty.io/…" }
```
The `api_key` is written to `~/.config/jetty/token` and **never returned in
printed output**.

---

## Runbook file format

Frontmatter (YAML) + a body of numbered steps. Minimal frontmatter:

```yaml
---
version: "1.0.0"
evaluation: programmatic        # or: rubric
agent: claude-code              # claude-code | opencode | codex | gemini-cli
model: anthropic/claude-sonnet-4.6
model_provider: openrouter      # anthropic | openrouter | openai | google | bedrock
snapshot: python312-uv          # sandbox image
primary_outputs:                # headline deliverables, most important first
  - report.md
secrets: {}                     # declare sensitive params; resolve from env at runtime
---
```

Body, in order: **Objective** → **REQUIRED OUTPUT FILES** (always includes
`validation_report.json` and `summary.md`) → **Parameters** (every `{{var}}` is
declared here) → **Dependencies** → numbered **Steps** (setup first) →
**Evaluation** (a PASS/PARTIAL/FAIL table for `programmatic`, or a 1–5 rubric) →
bounded **Iteration** (state a max number of rounds) → **Validation Report**
(`validation_report.json` with `stages`, `results`, `overall_passed`) → **Final
Checklist** with a verification script.

To scaffold or validate one, use the `create-runbook` skill; it ships the
authoritative templates and a structural validator.

---

## Anti-patterns (these bite)

- **Printing the token.** Read it into a shell var from the file; never echo it,
  never put it in a generated command, heredoc, or MCP argument.
- **Hitting `jetty.io` for API calls.** Use `flows-api.jetty.io`.
- **Asking the user to name a collection.** Read it from the API; keep it invisible.
- **Asking the user to paste provider keys into the agent.** Provider keys
  (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, …) live server-side in the collection's
  environment, added in the web app — or supplied by an activated trial. The only
  secret an agent handles is the `mlc_` Jetty token.
- **Pre-registering a runbook task as a `passthrough`/`completion` stub.** A
  runbook task's workflow must be a real runbook step (`steps: ["run"]`,
  `activity: runbook`) or the first run dies before the sandbox boots.
- **Crossing the two file-upload flows.** A `file-…` id from `POST /api/v1/files`
  goes in `jetty.files`; a storage path from `POST /api/v1/sandbox/upload` goes in
  `jetty.file_paths`. Swapping them silently drops the file.
- **Silent retries on failure.** If a run fails, report it honestly with the
  error the runbook surfaced. Don't loop invisibly.
- **Treating trajectory steps as a list.** They're keyed by step name.

---

## Where to go deeper

- `agent-instructions.md` — the pasteable onboarding trigger (start here).
- The `jetty` skill — full API surface (collections, tasks, runs, trajectories,
  labels, routines) and the MCP tool set.
- The `create-runbook` skill — runbook templates, evaluation patterns, validator.
- The `conference-abstracts` example — a complete, runnable runbook.
