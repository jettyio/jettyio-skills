---
name: jetty-setup
description: "Set up Jetty for the first time. Guides the user through account creation, API key configuration, and introduces runbooks — human-readable markdown files that tell an agent how to accomplish multi-step tasks with measurable outcomes. Use this skill whenever the user wants to set up, configure, or get started with Jetty — including 'set up jetty', 'configure jetty', 'jetty setup', 'get started with jetty', 'install jetty', 'connect to jetty', 'jetty onboarding', 'I am new to jetty', 'how do I start with jetty', or even just 'jetty' if they do not appear to have a token yet. Also trigger if the user mentions needing an API key for Jetty or storing their OpenAI/Gemini key in Jetty."
argument-hint:
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, AskUserQuestion
metadata:
  short-description: "Set up Jetty for the first time"
---

# Jetty Setup Wizard

You are guiding a user through first-time Jetty setup. The goal is to get them from zero to running their first AI workflow in under 5 minutes. Follow these steps IN ORDER. Be friendly and concise.

## Security Guidelines

- **Never echo, print, or log API tokens or keys** in output. Use redacted forms (e.g., `mlc_...xxxx`) when referring to tokens in messages to the user.
- **Never store tokens in project files** like `CLAUDE.md` that may be committed to version control. Use the user-scoped config directory `~/.config/jetty/`.
- **Pipe sensitive data via stdin** to avoid exposing tokens in process argument lists. Use `cat <<'BODY' | curl --data-binary @- ...` patterns instead of `-d '{...key...}'`.
- **Confirm with the user before each API call** that sends credentials to an external service.
- **Never store provider API keys locally** — they are sent directly to the Jetty API for server-side storage and are not written to any local file.

---

## Step 1: Check for Existing Token

Check if a Jetty API token already exists:

1. Check `~/.config/jetty/token` for a stored token
2. Also check the project's `CLAUDE.md` file (for backward compatibility) for a token starting with `mlc_`
3. If found in `CLAUDE.md` but not in `~/.config/jetty/token`, migrate it (see "Save the Token" below) and remove it from `CLAUDE.md`
4. If found, validate it:

```bash
TOKEN="$(cat ~/.config/jetty/token 2>/dev/null)"
curl -s -H "Authorization: Bearer $TOKEN" "https://flows-api.jetty.io/api/v1/collections/" | head -c 200
```

If the response contains collection data (not an error), the token is valid. Tell the user (with token redacted):
> "Found a valid Jetty token (`mlc_...{last 4 chars}`). You're already connected!"

Then use AskUserQuestion:
- Header: "Setup"
- Question: "You already have a Jetty token configured. What would you like to do?"
- Options:
  - "Create my first runbook" / "Learn about runbooks and build one"
  - "Reconfigure" / "Start fresh with a new token or provider"
  - "I'm good" / "No further setup needed"

If they choose "Create my first runbook", skip to **Step 4**.
If they choose "Reconfigure", continue to **Step 2** but skip the signup part.
If they choose "I'm good", end the setup.

If no valid token is found, continue to **Step 2**.

---

## Step 2: Account Creation

Use AskUserQuestion:
- Header: "Account"
- Question: "Do you already have a Jetty account?"
- Options:
  - "Yes, I have an API key" / "I have a Jetty account and can paste my API key"
  - "No, I need to sign up" / "Open the Jetty signup page in my browser"

### If "Yes, I have an API key":
Ask the user to paste their API key using AskUserQuestion:
- Header: "API Key"
- Question: "Please paste your Jetty API key (starts with mlc_):"
- Options:
  - "I'll type it in" / "Let me enter my API key" (they will use the "Other" option to type it)
  - "I need to find it" / "Open flows.jetty.io so I can get my key"

If they need to find it, open the browser:
```bash
open "https://flows.jetty.io/settings" 2>/dev/null || xdg-open "https://flows.jetty.io/settings" 2>/dev/null
```

### If "No, I need to sign up":
Tell the user:
> "Opening Jetty in your browser. Here's what to do:
> 1. Click **Get started free** to create your account
> 2. Complete the onboarding (pick a collection name — this is your workspace)
> 3. Once you're on the dashboard, go to **Settings** to find your API key
> 4. Copy the API key and come back here to paste it"

Open the signup page:
```bash
open "https://flows.jetty.io/sign-up" 2>/dev/null || xdg-open "https://flows.jetty.io/sign-up" 2>/dev/null
```

Then wait for them to come back and paste the key. Use AskUserQuestion:
- Header: "API Key"
- Question: "Once you've signed up, paste your Jetty API key here (starts with mlc_):"
- Options:
  - "I'll type it in" / "Let me paste my API key" (they will use the "Other" option)
  - "I'm stuck" / "I need help finding my API key"

If they're stuck, provide guidance:
> "Your API key is at flows.jetty.io → Settings → API Tokens. Click Create Token, copy it, and paste it here."

### Validate the Key

Once you have the key, save it to the secure config location first, then validate using the stored file — never assign the raw token to a shell variable:

```bash
mkdir -p ~/.config/jetty && chmod 700 ~/.config/jetty
# Write the pasted token directly to the config file (do NOT embed it in a variable or command)
cat > ~/.config/jetty/token <<'TOKEN_EOF'
mlc_THE_PASTED_TOKEN
TOKEN_EOF
chmod 600 ~/.config/jetty/token
# Now validate using the stored file
curl -s -H "Authorization: Bearer $(cat ~/.config/jetty/token)" "https://flows-api.jetty.io/api/v1/collections/"
```

**If validation fails (401 or error):**
Tell the user the key didn't work and let them try again (up to 3 attempts). After 3 failures, suggest visiting https://flows.jetty.io/settings to verify.

**If validation succeeds:**
1. Parse the response to find the collection name(s)
2. Tell the user which collections they have access to

### Save the Token

The token was already saved during validation above. If validation failed and the user provided a corrected key, overwrite the file the same way (write directly to the file, never embed the raw token in a shell variable or command argument).

If `CLAUDE.md` contains an old token line (`I have a production jetty api token mlc_...`), remove that line from `CLAUDE.md` to avoid leaving credentials in project files.

Tell the user:
> "Your API token is saved to `~/.config/jetty/token` (user-scoped, outside your project directory). It won't be accidentally committed to git."

---

## Step 3: Choose Provider & Store API Key

### Step 3a: Check for Existing Keys & Offer Trial

First, check whether the collection already has AI provider keys configured:

```bash
TOKEN="$(cat ~/.config/jetty/token)"
RESPONSE=$(curl -s "https://flows-api.jetty.io/api/v1/collections/$COLLECTION" \
  -H "Authorization: Bearer $TOKEN")
echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); evars=d.get('environment_variables',{}); print('Configured keys:', list(evars.keys()) if evars else 'none')"
```

Parse `environment_variables` from the response. If **all four** of `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, and `REPLICATE_API_TOKEN` are missing (i.e., none of them are present), offer the trial option below. If any of those keys are already configured, **skip this check entirely** and proceed to the provider selection prompt below.

Use AskUserQuestion:
- Header: "Getting Started"
- Question: "Your collection doesn't have any AI provider keys configured yet.\n\nWould you like to:"
- Options:
  - "Try Jetty free" / "Get 10 free runs (up to 60 minutes) using Jetty-provided AI keys. No third-party signup needed."
  - "Add your own keys" / "Configure your OpenAI, Anthropic, Gemini, or Replicate API keys now."

**If the user chooses "Try Jetty free":**

Activate the trial:

```bash
TOKEN="$(cat ~/.config/jetty/token)"
curl -s -X POST "https://flows-api.jetty.io/api/v1/trial/$COLLECTION/activate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if d.get('active') or d.get('status') == 'active':
    print(f'Trial activated! Runs remaining: {d.get(\"runs_remaining\", \"?\")}, Minutes remaining: {d.get(\"minutes_remaining\", \"?\")}')
else:
    print('Error:', json.dumps(d))
"
```

- On success: Tell the user their trial is activated, show remaining runs and minutes, then **skip directly to Step 4** (Deploy the Demo Workflow). The trial provides all necessary AI keys server-side.
- On error: Inform the user the trial could not be activated, then fall through to the "Add your own keys" flow below.

**If the user chooses "Add your own keys":**

Continue with the provider selection prompt below.

---

### Step 3b: Choose Provider

Use AskUserQuestion:
- Header: "Provider"
- Question: "Which AI provider would you like to configure for your workflows?"
- Options:
  - "OpenAI" / "GPT models, DALL-E image generation, and more"
  - "Google Gemini" / "Gemini models for text, vision, and image generation"

Based on their choice, ask for the provider API key using AskUserQuestion:
- Header: "Provider Key"
- Question: "Paste your {OpenAI/Google} API key:"
- Options:
  - "I'll type it in" / "Let me paste my API key" (they will use the "Other" option)
  - "Where do I get one?" / "Help me find or create an API key"

If they need help getting a key:
- **OpenAI**: "Get your API key at https://platform.openai.com/api-keys"
  ```bash
  open "https://platform.openai.com/api-keys" 2>/dev/null || xdg-open "https://platform.openai.com/api-keys" 2>/dev/null
  ```
- **Gemini**: "Get your API key at https://aistudio.google.com/apikey"
  ```bash
  open "https://aistudio.google.com/apikey" 2>/dev/null || xdg-open "https://aistudio.google.com/apikey" 2>/dev/null
  ```

### Step 3c: Store the Provider Key in Collection Environment Variables

First, identify which collection to use. If the user has multiple collections, ask them to choose. If they have one, use it automatically.

Before storing, confirm with the user using AskUserQuestion:
- Header: "Confirm"
- Question: "I'll now send your {provider} API key to Jetty's server so your workflows can use it. The key is stored server-side in your collection's environment variables and is NOT saved locally. Proceed?"
- Options:
  - "Yes, store it" / "Send my API key to Jetty"
  - "Cancel" / "Don't store the key"

If the user cancels, skip this step and warn them the demo won't work without a provider key.

Then store the key using a temporary file to avoid exposing it in shell history or process arguments. **Never assign the provider key to a shell variable or embed it in a heredoc.**

**For OpenAI:**
```bash
COLLECTION="the-collection-name"
# Write the JSON payload to a temp file (agent: substitute the real key into this file write)
cat > /tmp/.jetty_env_payload <<'PAYLOAD'
{"environment_variables": {"OPENAI_API_KEY": "sk-THE_OPENAI_KEY"}}
PAYLOAD
chmod 600 /tmp/.jetty_env_payload
curl -s -X PATCH -H "Authorization: Bearer $(cat ~/.config/jetty/token)" \
  -H "Content-Type: application/json" \
  "https://flows-api.jetty.io/api/v1/collections/$COLLECTION/environment" \
  --data-binary @/tmp/.jetty_env_payload
rm -f /tmp/.jetty_env_payload
```

**For Gemini:**
```bash
COLLECTION="the-collection-name"
cat > /tmp/.jetty_env_payload <<'PAYLOAD'
{"environment_variables": {"GEMINI_API_KEY": "THE_GEMINI_KEY"}}
PAYLOAD
chmod 600 /tmp/.jetty_env_payload
curl -s -X PATCH -H "Authorization: Bearer $(cat ~/.config/jetty/token)" \
  -H "Content-Type: application/json" \
  "https://flows-api.jetty.io/api/v1/collections/$COLLECTION/environment" \
  --data-binary @/tmp/.jetty_env_payload
rm -f /tmp/.jetty_env_payload
```

Verify the key was stored (only print key names, never values):
```bash
TOKEN="$(cat ~/.config/jetty/token)"
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://flows-api.jetty.io/api/v1/collections/$COLLECTION" | python3 -c "import sys,json; d=json.load(sys.stdin); evars=d.get('environment_variables',{}); print('Stored keys:', list(evars.keys()) if evars else 'none')"
```

Tell the user:
> "Your {provider} API key has been stored in your Jetty collection's server-side environment. Workflows will use it automatically. The key was not saved to any local file."

### Step 3d: Agent Runtime Key (for Runbooks)

Runbooks execute inside a coding agent on Jetty. The agent needs its own API key (separate from the image generation provider key above).

Use AskUserQuestion:
- Header: "Agent Runtime"
- Question: "Jetty runbooks run inside a coding agent. Which will you use?"
- Options:
  - "Claude Code" / "Anthropic's claude-sonnet-4-6. Needs an Anthropic API key (~$3/MTok input)"
  - "Codex" / "OpenAI's gpt-5.4. Needs an OpenAI API key"
  - "Gemini CLI" / "Google's gemini-3.1-pro-preview. Needs a Google AI API key"
  - "Skip for now" / "I'll configure this later when I need runbooks"

If the user chooses "Skip", move on to Step 4.

Otherwise, check if the required key already exists in the collection env vars:
- Claude Code → `ANTHROPIC_API_KEY`
- Codex → `OPENAI_API_KEY` (may already exist from provider step above)
- Gemini CLI → `GOOGLE_API_KEY` (may already exist from provider step above)

```bash
TOKEN="$(cat ~/.config/jetty/token)"
COLLECTION="the-collection-name"
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://flows-api.jetty.io/api/v1/collections/$COLLECTION" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); evars=d.get('environment_variables',{}); print('Stored keys:', list(evars.keys()) if evars else 'none')"
```

If the key exists, tell the user:
> "Your {agent} API key is already configured. You're ready to run runbooks!"

If the key is missing, ask the user to paste it and store it using the same secure pattern as the provider key (temp file → curl PATCH → cleanup).

Help links if they need a key:
- **Anthropic**: "Get your key at https://console.anthropic.com/settings/keys"
  ```bash
  open "https://console.anthropic.com/settings/keys" 2>/dev/null || xdg-open "https://console.anthropic.com/settings/keys" 2>/dev/null
  ```
- **OpenAI**: "Get your key at https://platform.openai.com/api-keys"
- **Google**: "Get your key at https://aistudio.google.com/apikey"

---

## Step 4: Introduce Runbooks

Now that the user has a working Jetty account and API keys, introduce the concept of runbooks.

Tell the user:

> **What's a runbook?**
>
> A runbook is a **human-readable markdown file** that describes a series of steps for a coding agent to follow — like a recipe for automation. Here's what makes them powerful:
>
> - **Plain markdown** — You can read, edit, and version-control them just like any other document
> - **Agent-executed** — A coding agent (Claude Code, Codex, Gemini CLI) reads the runbook and carries out each step autonomously
> - **Measurable outcomes** — Every runbook ends with a concrete, verifiable result (a report, a dataset, a set of passing tests)
> - **Multi-step with judgment** — Runbooks can include evaluation loops where the agent checks its own work and iterates until the result meets a quality bar
> - **API-connected** — Tasks can interact with any system you give them access to via API keys stored in your Jetty collection. They can call external APIs, query databases, process files, and more
> - **Long-running** — Unlike a quick chat response, runbook tasks typically run for **several minutes** (up to 60), working through complex multi-step processes end to end
>
> Think of a runbook as the difference between asking someone a question and handing them a detailed project brief.

---

## Step 5: Suggest a Starter Runbook

Use AskUserQuestion:
- Header: "Your First Runbook"
- Question: "What kind of task would you like to automate? Pick a starter template or describe your own."
- Options:
  - "Data extraction" / "Extract structured data from documents, validate against a schema, and produce a quality report"
  - "Content generation" / "Generate content from a brief, score it against a rubric, and iterate until it meets a quality bar"
  - "Testing & regression" / "Run a test suite or replay queries against an API, evaluate pass/fail, and produce a regression report"
  - "Something else" / "I'll describe what I want to automate"

### If the user picks a template:

Briefly describe what the chosen template does:

**Data extraction:**
> "This runbook will pull data from a source you specify (documents, APIs, web pages), extract structured fields, validate them against a schema, and iterate on any errors — then produce a summary report."

**Content generation:**
> "This runbook will take a brief or prompt, generate content (text, images, code — whatever you need), evaluate the output against quality criteria you define, and refine it until it's good enough."

**Testing & regression:**
> "This runbook will run a set of test cases against an API or system, compare results to expected outcomes, and produce a pass/fail regression report with details on any failures."

Then ask for specifics using AskUserQuestion:
- Header: "Describe Your Task"
- Question: "Now describe your specific use case in a sentence or two. What goes in, what processing happens, and what comes out? For example: 'Pull product descriptions from our CSV, translate them to Spanish, and check that each translation preserves the brand name and key specs.'"
- Options:
  - "I'll describe it" / "Let me type my use case" (user types in the text field)

### If the user chose "Something else":

Use AskUserQuestion:
- Header: "Describe Your Task"
- Question: "Describe the task you'd like to automate in simple terms. What goes in, what processing happens, and what should come out at the end? Remember — any system you can reach via an API key, the agent can interact with too."
- Options:
  - "I'll describe it" / "Let me type a description" (user types in the text field)
  - "Show me more examples" / "I'd like to see more ideas first"

**If "Show me more examples"**, display:

> **Example runbook tasks people have built:**
>
> 1. **NL-to-SQL Regression** — Pull failed queries from a log, replay them against an NL-to-SQL API, execute on a database, evaluate pass/fail, produce a regression report
> 2. **PDF-to-Metadata Conversion** — Extract metadata from academic PDFs, generate structured JSON-LD, validate against a schema, iterate on errors
> 3. **Branded Social Graphics** — Parse a text script, generate AI images, compose HTML with overlays, judge against a brand rubric, iterate until on-brand
> 4. **Clinical Training Content** — Parse competency documents, generate training scenarios, score with a rubric, produce learning plans
> 5. **API Health Monitor** — Hit a list of endpoints, compare response shapes to expected schemas, flag regressions, produce a status report

Then re-ask the description question.

Save the user's task description for use in the next step.

---

## Step 6: Hand Off to Create-Runbook

Now that you have the user's task description, hand off to the create-runbook skill to scaffold their runbook.

Tell the user:

> "Great — I have enough to get started. I'm going to hand you off to the **runbook creation wizard**, which will walk you through building your runbook step by step."

Then invoke the `/create-runbook` skill with the user's task description as the argument. If the agent platform doesn't support skill invocation, tell the user:

> "Run `/create-runbook <their task description>` to start building your runbook."

---

## Step 7: Next Steps

After the runbook is created (or if the user wants to come back later), tell the user:

> "You're all set! Here's what you can do next:
>
> **Run your runbook on Jetty:**
> `/jetty run-runbook <path-to-your-runbook>`
> Use a fresh task name when prompted. If the runbook needs browser automation or screenshots, choose the `prism-playwright` snapshot.
>
> **Create another runbook:**
> `/create-runbook` — the wizard will guide you through it
>
> **Optimize a runbook after a few runs:**
> `/optimize-runbook` — analyzes past executions and suggests improvements
>
> **Manage your workflows and tasks:**
> `/jetty list tasks` — see everything in your collection
>
> **Check execution history:**
> `/jetty show trajectories` — see all past runs and their results
>
> The `/jetty` command is your gateway to the full Jetty platform. Just describe what you want in natural language."

---

## Important Notes

- **Read the token from file**: Use `TOKEN="$(cat ~/.config/jetty/token)"` at the start of each bash command block. Environment variables do not persist between bash invocations.
- **Never log credentials**: Do not echo, print, or include tokens/keys in output shown to the user. Use redacted forms like `mlc_...xxxx`.
- **Pipe sensitive payloads via stdin**: Use `cat <<'BODY' | curl ... --data-binary @-` instead of inline `-d '{...secret...}'` to avoid exposing secrets in process argument lists.
- **URL disambiguation**: Use `flows-api.jetty.io` for all API calls (workflows, collections, tasks, trajectories, files). NEVER use `flows.jetty.io` for API calls (it's the web frontend).
- **Trajectories response shape**: The list endpoint returns `{"trajectories": [...]}` — always access via `.trajectories[]`.
- **Steps are objects, not arrays**: Trajectory steps are keyed by step name (e.g., `.steps.expand_prompt`), not by index.
