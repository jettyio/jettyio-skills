---
name: jetty-setup
description: "Set up Jetty for the first time. Guides the user through account creation, API key configuration, and introduces runbooks — human-readable markdown files that tell an agent how to accomplish multi-step tasks with measurable outcomes. Use this skill whenever the user wants to set up, configure, or get started with Jetty — including 'set up jetty', 'configure jetty', 'jetty setup', 'get started with jetty', 'install jetty', 'connect to jetty', 'jetty onboarding', 'I am new to jetty', 'how do I start with jetty', or even just 'jetty' if they do not appear to have a token yet. Also trigger if the user mentions needing an API key for Jetty or storing their OpenAI/Gemini key in Jetty."
argument-hint:
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, AskUserQuestion
metadata:
  short-description: "Set up Jetty for the first time"
---

# Jetty Setup Wizard

You are guiding a user through first-time Jetty setup. The goal is to get them from zero to their first runbook in under 3 minutes.

## Cross-Agent Compatibility

This skill uses `AskUserQuestion` for interactive choices. If you are running in an environment where `AskUserQuestion` is not available (Codex CLI, Gemini CLI, Cursor, Antigravity), replace each AskUserQuestion call with a direct text-mode question and have the user reply in chat. The wizard flow is unchanged — only the interaction mechanism differs.

**Antigravity-specific notes:**
- Skills are triggered by semantic match on the frontmatter `description`, not by slash commands. The handoff to `/create-runbook` in Step 3 should be phrased as "ask me to create your first runbook" rather than telling the user to type a slash command.
- The token path `~/.config/jetty/token` works (Antigravity is a desktop app, not sandboxed). The MCP server runs from `~/.gemini/antigravity/mcp_config.json`, not the repo's `.mcp.json` — if the user's MCP tools aren't responding, point them at the README's Antigravity install section.

---

## What's about to happen (show this first)

Before running any commands, orient the user with this message:

> **Welcome to Jetty.** Jetty exists to run **runbooks** — plain-markdown files you write once that tell a coding agent how to do a long, multi-step job end-to-end. Think of a runbook like a recipe, except the agent (Claude Code, Codex, or Gemini CLI) is the cook, the kitchen is a fresh sandbox we spin up for every run, and Jetty captures every step it takes so you can replay or grade it later.
>
> **A few examples of what people put in a runbook:**
> - *"Pull yesterday's failed SQL queries from Langfuse, replay them against our NL-to-SQL API, and produce a regression report."*
> - *"Take this CSV of product names, generate a branded social graphic for each one, and rate them against our brand rubric until they all score 4+."*
> - *"Extract structured metadata from these academic PDFs and validate it against the Croissant schema — iterate on errors until everything passes."*
>
> **Why runbooks (not just a chat or a script):**
> - **Plain markdown** — readable, editable, version-controllable like any doc
> - **Long-running** — minutes, not a chat turn (runs go up to 60 min)
> - **Always end with something concrete** — a dataset, a report, a passing test suite, a manifest
> - **Self-evaluating** — the runbook tells the agent how to grade its own output and iterate until it's good enough
> - **Reach any system** whose keys live in your Jetty collection
>
> **Here's the 3-minute plan:**
> 1. **Connect your Jetty account** (~30s) — I'll check for an existing token or open the signup page
> 2. **Add AI provider keys** (~1 min) — at **jetty.io → Settings → Environment Variables**, in your browser
> 3. **Build your first runbook** (~2 min) — I'll hand you to the runbook wizard, which walks you through it interactively
>
> Your collection appears in the Jetty web app at **https://jetty.io** as soon as step 1 finishes. Every run, trajectory, and result will land there too.

Then proceed to Step 1.

---

## Security Guidelines

- **Never echo, print, or log API tokens or keys** in output. Use redacted forms (e.g., `mlc_...xxxx`) when referring to tokens in messages to the user.
- **Never store tokens in project files** like `CLAUDE.md` that may be committed to version control. Use the user-scoped config directory `~/.config/jetty/`.
- **Read secrets interactively with `read -rs`** so the raw value never appears in generated commands, tool-call logs, or shell history.
- **Never ask the user to paste provider API keys (OpenAI, Anthropic, Gemini, Replicate) into this skill.** Those keys belong in the Jetty web app under Settings → Environment Variables. This skill only handles the Jetty API token itself.

---

## Step 1: Connect Your Jetty Account

### 1a: Check for an Existing Token

Check `~/.config/jetty/token` and, for backward compatibility, the project's `CLAUDE.md` for a line containing a token starting with `mlc_`. If found in `CLAUDE.md` but not in `~/.config/jetty/token`, migrate it and remove that line from `CLAUDE.md`.

If a token exists, validate it:

```bash
TOKEN="$(cat ~/.config/jetty/token 2>/dev/null)"
curl -s -H "Authorization: Bearer $TOKEN" "https://flows-api.jetty.io/api/v1/collections/" | head -c 200
```

If the response contains collection data (not an error), tell the user (redacted):
> "Found a valid Jetty token (`mlc_...{last 4 chars}`). You're connected — your collection is live at https://jetty.io."

Parse the response to find the collection name and save it for Step 2. Then skip directly to **Step 2**.

If no valid token exists, continue to 1b.

### 1b: Sign Up or Paste Existing Key

Use AskUserQuestion:
- Header: "Jetty Account"
- Question: "Do you already have a Jetty account?"
- Options:
  - "Yes, I have an API key" / "I'll paste my Jetty API key"
  - "No, I need to sign up" / "Open the Jetty signup page in my browser"

**If "No, I need to sign up":**

Tell the user:
> "Opening Jetty in your browser. Steps:
> 1. Click **Get started free** to create your account
> 2. Pick a collection name (this is your workspace)
> 3. Once on the dashboard, go to **Settings → API Tokens** and create a token
> 4. Copy it and come back here"

```bash
open "https://jetty.io/sign-up" 2>/dev/null || xdg-open "https://jetty.io/sign-up" 2>/dev/null
```

**In both cases, read the Jetty API token interactively and save it.** Never embed it in a generated command:

```bash
mkdir -p ~/.config/jetty && chmod 700 ~/.config/jetty
echo "Paste your Jetty API token (starts with mlc_) and press Enter:"
read -rs JETTY_TOKEN && printf '%s' "$JETTY_TOKEN" > ~/.config/jetty/token && unset JETTY_TOKEN
chmod 600 ~/.config/jetty/token
curl -s -H "Authorization: Bearer $(cat ~/.config/jetty/token)" "https://flows-api.jetty.io/api/v1/collections/"
```

If validation fails (401 or error), let them retry up to 3 times. If still failing, point to https://jetty.io/settings.

On success, parse the response for the collection name (save it as `COLLECTION` for Step 2). Tell the user:
> "Connected. Token saved to `~/.config/jetty/token` (user-scoped, won't be committed to git). Your collection `{name}` is live at https://jetty.io — you can open it in your browser anytime."

If `CLAUDE.md` still has an old `mlc_...` line, remove it.

---

## Step 2: Add AI Provider Keys in the Web App

Runbooks need API keys to reach AI providers (OpenAI, Anthropic, Gemini) and any other services your workflows call. Those keys live **server-side** in your Jetty collection's environment variables — you add them once in the web app and every workflow/runbook in that collection can use them.

### 2a: Check What's Already Configured

```bash
TOKEN="$(cat ~/.config/jetty/token)"
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://flows-api.jetty.io/api/v1/collections/$COLLECTION" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); evars=d.get('environment_variables',{}); print('Configured keys:', list(evars.keys()) if evars else 'none')"
```

### 2b: If No Keys Are Configured, Offer the Trial

If **all four** of `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, and `REPLICATE_API_TOKEN` are missing, offer the trial as a zero-friction option.

Use AskUserQuestion:
- Header: "Getting Started"
- Question: "Your collection has no AI provider keys yet. How would you like to proceed?"
- Options:
  - "Try Jetty free" / "Activate 10 free runs (up to 60 minutes) using Jetty-provided keys. No third-party signup needed."
  - "I'll add my own keys" / "Open jetty.io → Settings → Environment Variables to add my keys now"

**If "Try Jetty free":**

```bash
TOKEN="$(cat ~/.config/jetty/token)"
curl -s -X POST "https://flows-api.jetty.io/api/v1/trial/$COLLECTION/activate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if d.get('active') or d.get('status') == 'active':
    print(f'Trial activated. Runs remaining: {d.get(\"runs_remaining\", \"?\")}, Minutes remaining: {d.get(\"minutes_remaining\", \"?\")}')
else:
    print('Error:', json.dumps(d))
"
```

On success, skip to **Step 3**. On failure, fall through to "I'll add my own keys".

### 2c: Direct the User to the Web App

Tell the user:

> **Add your keys in the Jetty web app:**
>
> 1. Open **https://jetty.io/settings** (I'll open it for you)
> 2. Go to **Environment Variables**
> 3. Add whichever keys your runbooks will need:
>    - `OPENAI_API_KEY` — for OpenAI models (GPT, DALL-E) — [get one](https://platform.openai.com/api-keys)
>    - `ANTHROPIC_API_KEY` — for Claude models, and for running Claude Code as the agent runtime — [get one](https://console.anthropic.com/settings/keys)
>    - `GEMINI_API_KEY` / `GOOGLE_API_KEY` — for Gemini models, and for the Gemini CLI agent runtime — [get one](https://aistudio.google.com/apikey)
>    - Plus any other service keys your runbooks need (Snowflake, Langfuse, etc.)
> 4. Come back here when you're done and I'll verify them

```bash
open "https://jetty.io/settings" 2>/dev/null || xdg-open "https://jetty.io/settings" 2>/dev/null
```

Wait for the user to confirm they're done. Use AskUserQuestion:
- Header: "Keys"
- Question: "Have you added your keys at jetty.io → Settings → Environment Variables?"
- Options:
  - "Yes, keys added" / "Verify the keys are configured"
  - "Skip for now" / "I'll add keys later — continue to the runbook wizard"

**If "Yes, keys added":** re-run the check from 2a and list the configured key names (never values). Confirm which runtime keys are present. If the user added keys but the check shows nothing, they may not have saved them — ask them to verify in the web app and re-check.

**If "Skip for now":** warn that runbooks won't execute without keys, and continue.

---

## Step 3: Build Your First Runbook

This is the part that matters — your account exists to run runbooks. Hand off to the `/create-runbook` skill now.

Tell the user:

> "You're connected. Now the main event: **building your first runbook.** I'm handing you to the runbook wizard, which will:
>
> 1. Ask what task you want to automate (or show example tasks if you want inspiration)
> 2. Pick the right evaluation pattern (rubric scoring or programmatic checks) and sandbox for you
> 3. Scaffold a `RUNBOOK.md` with your task, parameters, evaluation criteria, and output manifest
> 4. Pre-register the task on Jetty with file-upload support so you can drop in CSVs/PDFs/images at run time
> 5. Optionally walk through a dry run before you execute it for real
>
> When you eventually trigger the runbook, you'll watch the trajectory appear live at **https://jetty.io** — every step, input, and output captured for replay and grading."

Then invoke `/create-runbook`. If the agent platform doesn't support skill invocation, tell the user:

> "Run `/create-runbook` to start building your runbook."

---

## What's Next (show after the handoff completes, or if the user returns later)

> **Useful commands:**
>
> - `/jetty run-runbook <path>` — run a runbook on Jetty
> - `/create-runbook` — build another runbook
> - `/optimize-runbook` — analyze past runs and suggest improvements
> - `/jetty list tasks` — see everything in your collection
> - `/jetty show trajectories` — past runs and results
>
> **In the web app at https://jetty.io:**
> - Your collection, workflows, and tasks
> - Live trajectories for every run (step-by-step replay)
> - Settings → Environment Variables for managing provider keys
> - Settings → API Tokens for managing Jetty tokens

---

## Important Notes

- **Read the token from file**: Use `TOKEN="$(cat ~/.config/jetty/token)"` at the start of each bash block. Environment variables don't persist across bash invocations.
- **Never log credentials**: Don't echo, print, or include tokens/keys in output. Use redacted forms like `mlc_...xxxx`.
- **Read secrets interactively via `read -rs`**: Never embed secrets in generated commands, heredocs, or temp files. Always `unset` after use.
- **Provider keys go in the web app, not this skill.** The only secret this skill handles is the Jetty API token itself.
- **URL disambiguation**: Use `flows-api.jetty.io` for all API calls. `jetty.io` is the web frontend.
- **Trajectories response shape**: The list endpoint returns `{"trajectories": [...]}`.
- **Steps are objects, not arrays**: Trajectory steps are keyed by step name (e.g., `.steps.expand_prompt`), not by index.
