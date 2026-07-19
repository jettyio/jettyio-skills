# Jetty — Machine Context

Orientation for an agent operating Jetty: the mental model, the named operations,
and the traps — plus **where the authoritative, always-current details live**. If
you only want the pasteable onboarding trigger, read
[`agent-instructions.md`](./agent-instructions.md).

Jetty runs **runbooks**: plain-markdown files that tell a coding agent how to do a
long, multi-step job end-to-end in a fresh sandbox, capturing every step as a
replayable **trajectory**. You (the agent) either author a runbook, run one, or
check on a run.

> **Single source of truth.** This file is a map, not the API reference. Exact
> endpoints, request/response shapes, and the runbook schema live in the skills —
> copying them here just invites drift, so this file points at them instead:
> - **`jetty` skill** — the full API surface (collections, tasks, runs,
>   trajectories, labels, routines) and MCP tools.
> - **`create-runbook` skill** — runbook templates, evaluation patterns, validator.
> - **`jetty-setup` skill** (+ its `scripts/jetty_simulate.py`) — the hosted
>   no-account demo and email-as-signup flow.
>
> Reading this over HTTP without the skills installed? They're bundled at the
> plugin/repo root and served at `https://jetty.io/agent-instructions.md`.

---

## Base facts

- **API host:** `https://flows-api.jetty.io` — all API calls. (`https://jetty.io`
  is the web app; never hit it for API calls. The hosted demo/onboarding endpoints
  under `jetty.io/api/…` are the one exception — see `jetty simulate` below.)
- **Auth:** a collection-scoped token starting with `mlc_`, sent as
  `Authorization: Bearer <token>`. Stored at `~/.config/jetty/token` (chmod 600).
- **Never print, echo, or log the token.** Refer to it redacted (`mlc_…xxxx`).
- **Collection:** the user's workspace namespace. **Do not make the user name or
  reason about collections** — treat it as an internal detail; read it from the API
  when you need it, don't prompt.

---

## State model

There's no local session state beyond the token file — everything else is a server
read. "Where the user is" comes from three checks, in order:

1. **Token present & valid?** — list collections with the stored token: data back →
   connected; no token / 401 → not connected.
2. **Provider keys or trial?** — the collection's configured env-var **names** (never
   values); if none, an activated **trial** supplies Jetty keys with capped runs.
3. **Runs so far?** — the task's past trajectories, the history the web app replays.

The exact endpoints for each check are in the **`jetty` skill** (Core Operations).

---

## CLI verb emulation

Jetty has no standalone `jetty` binary yet; these verbs are **named procedures** you
perform via the API, written so a future real CLI can back the same names. Each has
a human meaning and a stable `--json` result; the **exact endpoints and
request/response shapes live in the skill named for each** — restating them here
only invites drift.

- **`jetty run <runbook>`** — *live.* Execute a runbook on Jetty and return where its
  results live (trajectory id + `results_dir` / `trajectory_url`). Done via the
  chat-completions endpoint with a `jetty` block whose fields come from the runbook's
  frontmatter. → **`jetty` skill** (Run Workflows).
- **`jetty status <trajectory_id>`** — *live.* Report a run's progress/outcome
  (status, steps, error, `trajectory_url`). → **`jetty` skill** (Trajectories).
  Note: trajectory **steps are objects keyed by step name** (e.g. `.steps.run`), not
  an array.
- **`jetty simulate <name>`** — *live (hosted onboarding).* Run a pre-built example
  (e.g. `conference-abstracts`) so a brand-new user sees real output with **no
  account and no token**, via a rate-limited demo endpoint on `jetty.io`. Surface the
  returned `pdf_urls` (the source PDFs) while it runs. → implemented end-to-end by the
  **`jetty-setup` skill** + `scripts/jetty_simulate.py` (`run`).
- **`jetty init`** — *live (hosted onboarding).* Turn the email captured after a
  `jetty simulate` run into a workspace (the email is the account; the demo run is
  attached; claim later in the web app). Requires the `run_id` from a completed
  simulate run. Stores the minted `mlc_` key at `~/.config/jetty/token` (chmod 600),
  redacted — never echo it. → **`jetty-setup` skill** + `scripts/jetty_simulate.py`
  (`claim`).

Any non-2xx / failed status on the hosted demo/init calls is **not fatal** — fall
back to the connect-and-build path. The demo is a bonus, never a gate.

---

## Runbook file format

A runbook is YAML frontmatter + a body of numbered steps. Frontmatter declares
`version`, `evaluation` (`programmatic` | `rubric`), `agent`, `model` +
`model_provider`, `snapshot`, `primary_outputs`, and `secrets`. The body runs, in
order: **Objective → required output files** (always incl. `validation_report.json`
+ `summary.md`) **→ parameters → dependencies → numbered steps → evaluation →
bounded iteration → validation report → final checklist**.

The **authoritative frontmatter schema, section templates, and structural validator
ship in the `create-runbook` skill** — scaffold and validate with it rather than
hand-writing to this summary. The `conference-abstracts` example is a complete,
runnable runbook.

---

## Anti-patterns (these bite)

- **Printing the token.** Read it into a shell var from the file; never echo it,
  never put it in a generated command, heredoc, or MCP argument.
- **Hitting `jetty.io` for API calls.** Use `flows-api.jetty.io` (the `jetty.io/api/…`
  demo/onboarding endpoints are the only exception).
- **Asking the user to name a collection.** Read it from the API; keep it invisible.
- **Asking the user to paste provider keys into the agent.** Provider keys
  (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, …) live server-side in the collection's
  environment, added in the web app — or supplied by an activated trial. The only
  secret an agent handles is the `mlc_` Jetty token.
- **Pre-registering a runbook task as a `passthrough`/`completion` stub.** A runbook
  task's workflow must be a real runbook step (`steps: ["run"]`, `activity: runbook`)
  or the first run dies before the sandbox boots.
- **Crossing the two file-upload flows.** A `file-…` id from `POST /api/v1/files`
  goes in `jetty.files`; a storage path from `POST /api/v1/sandbox/upload` goes in
  `jetty.file_paths`. Swapping them silently drops the file.
- **Silent retries on failure.** If a run fails, report it honestly with the error
  the runbook surfaced. Don't loop invisibly.
- **Treating trajectory steps as a list.** They're keyed by step name.

---

## Where to go deeper

- `agent-instructions.md` — the pasteable onboarding trigger (start here).
- The **`jetty` skill** — the authoritative API surface (collections, tasks, runs,
  trajectories, labels, routines) and the MCP tool set.
- The **`create-runbook` skill** — runbook templates, evaluation patterns, validator.
- The **`jetty-setup` skill** — onboarding + the hosted demo/init flow
  (`scripts/jetty_simulate.py`).
- The `conference-abstracts` example — a complete, runnable runbook.
