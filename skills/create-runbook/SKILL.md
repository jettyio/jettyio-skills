---
name: create-runbook
description: "Create a new runbook with guided assistance. A runbook is a structured markdown document that tells a coding agent how to accomplish a complex, multi-step task with evaluation loops and quality gates. Use this skill whenever the user wants to create, build, scaffold, or write a runbook — including 'create runbook', 'new runbook', 'build a runbook', 'make a runbook', 'runbook wizard', 'help me write a runbook', 'I need a runbook for...', 'automate this task with a runbook', or 'turn this into a runbook'. Also trigger when the user describes a multi-step agent task that would benefit from structured evaluation and iteration loops, even if they don't use the word 'runbook' — for example, 'I want to build an automated pipeline that evaluates its own output' or 'create a repeatable process with quality gates'."
argument-hint: "[optional task description]"
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, AskUserQuestion
metadata:
  short-description: "Create a new runbook with guided assistance"
---

# Runbook Creation Wizard

You are guiding a user through creating their first runbook. A runbook is a structured markdown document that tells a coding agent (Claude Code, Cursor, Codex, etc.) how to accomplish a complex, multi-step task end-to-end — with built-in evaluation loops, iteration, and quality gates.

Follow these steps IN ORDER. Be friendly and concise. At each decision point, use AskUserQuestion to let the user choose.

## Cross-Agent Compatibility

This skill uses `AskUserQuestion` for interactive choices. If you are running in an environment where `AskUserQuestion` is not available (e.g., Codex CLI, Gemini CLI, Cursor, Antigravity), replace each AskUserQuestion call with a direct question to the user in your text output. Ask the user to reply with their choice. The wizard flow is the same — only the interaction mechanism differs.

**Antigravity-specific note:** Antigravity skills are triggered semantically by the `description` frontmatter, not by slash commands. Users will say "create a runbook for X" or similar — there is no `/create-runbook` slash invocation. References to other slash commands in this skill (e.g., "run `/jetty-setup`") should be presented to the Antigravity user as natural-language asks ("ask me to set up Jetty"), since slash discovery doesn't apply.

For non-interactive / batch execution (e.g., Codex with `--quiet`), the user should pass the required context as the skill argument:
```
create-runbook "NL-to-SQL regression evaluator, programmatic evaluation, save to ./RUNBOOK.md"
```
Parse the argument to extract: task description, evaluation pattern (programmatic/rubric), and file path. Skip the AskUserQuestion steps and proceed directly to scaffolding.

---

## Step 1: Orientation

First, check that the user has Jetty set up:

```bash
test -f ~/.config/jetty/token && echo "JETTY_OK" || echo "NO_TOKEN"
```

If `NO_TOKEN`, tell the user:
> "You'll need a Jetty account first. Run `/jetty-setup` to get started, then come back here."

End the skill.

If `JETTY_OK`, briefly explain what they're about to build:

> **What's a runbook?**
>
> | | Skill | Workflow | Runbook |
> |---|---|---|---|
> | **Format** | Markdown (SKILL.md) | JSON (step configs) | Markdown (RUNBOOK.md) |
> | **Executed by** | Coding agent | Jetty engine | Coding agent, calling workflows/APIs |
> | **Complexity** | Single tool or short procedure | Fixed pipeline | Multi-phase process with judgment |
> | **Iteration** | None — one-shot | None — runs to completion | Built-in: evaluate → refine → re-evaluate |
>
> A skill says *"here's how to call the Jetty API."*
> A runbook says *"here's how to pull data, process it, evaluate the results, iterate until they're good enough, and produce a report — and here's how to know when you're done."*
>
> Let's build one.

---

## Step 2: Gather Context

### 2a: Task Description

Use AskUserQuestion:
- Header: "Task"
- Question: "What task do you want to automate? Describe it in a sentence or two — what goes in, what processing happens, and what comes out."
- Options:
  - "I'll describe it" / "Let me type a description" (user types in the text field)
  - "Show me examples first" / "Show example runbook tasks before I decide"

**If "Show me examples first"**, display these real-world examples:

> **Example runbook tasks:**
>
> 1. **NL-to-SQL Regression** — Pull failed queries from Langfuse, replay them against the NL-to-SQL API, execute on Snowflake, evaluate pass/fail, produce a regression report
> 2. **PDF-to-Metadata Conversion** — Extract metadata from academic PDFs, generate Croissant JSON-LD, validate against the schema, iterate on errors
> 3. **Branded Social Graphics** — Parse a text script, generate an AI image via Jetty workflow, compose HTML with text overlays, judge against a brand rubric, iterate
> 4. **Clinical Training Content** — Parse competency documents, generate training scenarios with rubric-scored quality, produce learning plans
> 5. **Data Extraction Pipeline** — Extract structured data from documents into multiple formats, validate schema compliance, produce quality report

Then re-ask the question (same AskUserQuestion, minus the "Show me examples" option).

Save the user's task description for use in all subsequent steps.

### 2b: Evaluation Pattern

**Default to `rubric`.** Most runbooks produce content where quality is multi-dimensional, and rubric scoring is the more general-purpose pattern. Only choose `programmatic` when the task description **clearly** describes a coding/structured-output task. Skip the question entirely in those clear cases — just pick and tell the user what you picked and why (one line).

Pick `programmatic` without asking when the task description clearly involves any of:
- Schema validation, JSON Schema, OpenAPI, Croissant, JSON-LD
- SQL, query execution, database regression
- Unit tests, test suites, lint, type-check, build, compile
- API response shape checks, HTTP status assertions
- Code generation where the success criterion is "the code compiles / passes tests"
- File/data format conversion with a strict target spec (CSV with N columns, etc.)

Pick `rubric` without asking for everything else (content generation, creative output, reports, training material, image composition, summarization, classification quality, UX/brand checks).

Only fall back to AskUserQuestion when the task is genuinely ambiguous (e.g., "extract data from PDFs" — could be schema-validated or rubric-scored on completeness). When you ask:
- Header: "Evaluation"
- Question: "Your task could go either way. Programmatic = strict pass/fail against a schema or test. Rubric = 1–5 scoring across quality dimensions. Which fits?"
- Options:
  - "Quality rubric" / "Score against multiple criteria (1-5 scale)"
  - "Programmatic checks" / "Validate with code, schema, or tests (objective pass/fail)"

Save the chosen evaluation pattern: `programmatic` or `rubric`. When you skip the question, tell the user in one short line: *"I'm using a rubric for this — your output is {reason}."* or *"Going with programmatic — {reason}."*

### 2c: Agent Runtime & Snapshot

**Default to `opencode` + `anthropic/claude-sonnet-4.6` (routed via OpenRouter) without asking.** OpenRouter gives unified billing, provider failover, and a single key (`OPENROUTER_API_KEY`) that unlocks Sonnet, GPT, Gemini, and any other catalog model — so it's the right starting point for the vast majority of users. Only fall back to AskUserQuestion when the user has explicitly asked for a different agent in their task description (e.g., "use claude-code directly", "use Codex", "I only have a Gemini key").

Before defaulting silently, do a quick check to confirm the choice is safe — the user should not be steered to OpenRouter if they have no key configured. Run:

```bash
TOKEN="$(cat ~/.config/jetty/token)"
COLLECTION="{collection from Step 2a or jetty whoami default}"

# Trial status
TRIAL=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "https://flows-api.jetty.io/api/v1/trial/$COLLECTION")
TRIAL_ACTIVE=$(echo "$TRIAL" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('active', False))")

# Org-level OPENROUTER_API_KEY presence
COLL=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "https://flows-api.jetty.io/api/v1/collections/$COLLECTION")
HAS_OPENROUTER=$(echo "$COLL" | python3 -c "
import sys, json
d = json.load(sys.stdin)
evars = d.get('environment_variables', {})
print('OPENROUTER_API_KEY' in evars)
")
```

Decision:
- `TRIAL_ACTIVE == True` **or** `HAS_OPENROUTER == True` → silently pick `opencode` + `anthropic/claude-sonnet-4.6` + `model_provider: openrouter`. Tell the user in one line: *"Using opencode + anthropic/claude-sonnet-4.6 via OpenRouter — your trial covers it."* or *"Using opencode + anthropic/claude-sonnet-4.6 via OpenRouter — your org has OPENROUTER_API_KEY set."*
- Neither → still default to `opencode` + `anthropic/claude-sonnet-4.6` + `model_provider: openrouter`, but tell the user: *"Defaulting to opencode + anthropic/claude-sonnet-4.6 via OpenRouter. You'll need to add an OPENROUTER_API_KEY in Jetty before running — or tell me to use a different agent."*

Only use AskUserQuestion when the user's task description explicitly names a different runtime, or they push back on the default. When you do ask:
- Header: "Agent Runtime"
- Question: "Which agent will run this runbook on Jetty?"
- Options:
  - "opencode + OpenRouter (Recommended)" / "Uses anthropic/claude-sonnet-4.6 routed through OpenRouter. Single key (OPENROUTER_API_KEY) unlocks any catalog model with unified billing and provider failover."
  - "Claude Code (Anthropic)" / "Uses claude-sonnet-4-6 directly via Anthropic. Requires an ANTHROPIC_API_KEY."
  - "Codex (OpenAI)" / "Uses gpt-5.5 — strong at code generation. Requires an OPENAI_API_KEY."
  - "Gemini CLI (Google)" / "Uses gemini-3.1-pro-preview — free tier available. Requires a GOOGLE_API_KEY."

Save the agent, model, and provider choice. The mapping is:
- opencode + OpenRouter → agent: `opencode`, model: `anthropic/claude-sonnet-4.6`, model_provider: `openrouter`
- Claude Code → agent: `claude-code`, model: `claude-sonnet-4-6`, model_provider: `anthropic`
- Codex → agent: `codex`, model: `gpt-5.5`, model_provider: `openai`
- Gemini CLI → agent: `gemini-cli`, model: `gemini-3.1-pro-preview`, model_provider: `google`

Then pick the sandbox. **Don't ask** if the task obviously needs a browser — just pick `prism-playwright` and tell the user in one line. Browser is obvious when the task description mentions any of: web scraping, scrape, screenshot, browser, Playwright, Selenium, OAuth flow, web UI testing, e2e, HTML rendering, page navigation, crawl/crawler, login flow, or specific URLs/web apps.

If the task is clearly text/data-only (no browser cues), default to `python312-uv` and tell the user in one line.

Only ask when ambiguous (e.g., "fetch data from a website" — could be HTTP scraping or browser scraping). When you ask:
- Header: "Sandbox"
- Question: "Will your runbook need a real browser (Playwright + Chromium), or is HTTP enough?"
- Options:
  - "Browser" / "Use prism-playwright snapshot (Playwright + Chromium pre-installed)"
  - "No browser" / "Use python312-uv snapshot (lighter, faster startup)"

Save the snapshot choice. These values will be written into the runbook frontmatter in Step 3.

The runbook file will always be written as `./RUNBOOK.md` in the current working directory — do not ask the user where to save it.

---

## Step 3: Scaffold the Runbook

Read the appropriate starter template based on the evaluation pattern chosen in Step 2b:

- **Programmatic**: Read `templates/programmatic.md` from the skill's directory
- **Rubric**: Read `templates/rubric.md` from the skill's directory

To find the templates, locate this skill's directory:

```bash
find ~/.claude -path "*/create-runbook/templates/programmatic.md" 2>/dev/null | head -1
```

If not found there, also check the working directory:

```bash
find . -path "*/create-runbook/templates/programmatic.md" 2>/dev/null | head -1
```

Read the template using the Read tool.

Now customize the template using the task description from Step 2a:

1. **Title**: Replace `{Task Name}` with a concise name derived from the task description
2. **Objective**: Write a 2-5 sentence objective based on what the user described — input, processing, output
3. **Output manifest**: Propose specific output files based on the task (replace `{primary_output}` with a real filename like `results.csv`, `output.json`, `report.html`, etc.)
4. **Parameters**: Propose parameters based on inputs mentioned in the task description. Always keep `{{results_dir}}`.
5. **Agent/model/model_provider/snapshot**: Write the choices from Step 2c into the frontmatter fields. Include `model_provider` so routing is explicit (opencode → `openrouter`, claude-code → `anthropic`, codex → `openai`, gemini-cli → `google`).
6. **Steps 2-3**: Rename and briefly describe the processing steps based on the task

Leave `{TODO: ...}` markers, `{How to fix it}`, and similar placeholders in sections that require detailed domain input from the user (evaluation criteria, common fixes, tips, dependencies).

Write the customized runbook to `./RUNBOOK.md` (always — do not ask the user for a different path) using the Write tool.

Tell the user:

> "I've created a runbook scaffold at `./RUNBOOK.md`. It has the full structure with your task details filled in and placeholder markers where I need your input. Let's walk through each section."

---

## Step 4: Customize Sections

Walk through each section that needs user input. For each, show the user what's currently in the runbook and ask for their refinement. Use the Edit tool to apply changes.

### Authoring sandbox shortcut

If you are running inside a Jetty authoring sandbox — detected by either `AUTHORING_MISSION` being set in the environment or `/app/MISSION.md` existing on disk — **skip sub-steps 4d (Dependencies), 4h (Common Fixes), and 4i (Tips)**. These three sections are best filled in *after* the runbook has been executed at least once, when real failure modes, real dependencies, and real gotchas are known. Leave the placeholder rows in `RUNBOOK.md` as-is; they signal "fill in after first run". Walk through 4a, 4b, 4c, 4e, 4f, 4g only.

```bash
if [ -n "${AUTHORING_MISSION:-}" ] || [ -f /app/MISSION.md ]; then
  AUTHORING_SANDBOX=1
else
  AUTHORING_SANDBOX=0
fi
```

Outside the authoring sandbox (local CLI / IDE), walk through all nine sub-steps below.

### 4a: Review Objective

Show the user the Objective section you drafted. Use AskUserQuestion:
- Header: "Objective"
- Question: "Here's the objective I drafted:\n\n{show the objective text}\n\nDoes this capture your task accurately?"
- Options:
  - "Looks good" / "Move on to the next section"
  - "Needs changes" / "Let me refine it" (user types corrections)

If they want changes, apply via Edit and move on.

### 4b: Output Files

Show the proposed output manifest. Use AskUserQuestion:
- Header: "Output Files"
- Question: "These are the files the runbook will produce:\n\n{list the files}\n\nDoes this look right?"
- Options:
  - "Looks good" / "This manifest is correct"
  - "Add a file" / "I need an additional output file"
  - "Change a file" / "One of these needs to be different"

Apply changes via Edit. Ensure `validation_report.json` and `summary.md` always remain in the manifest.

### 4c: Parameters

Show proposed parameters. Use AskUserQuestion:
- Header: "Parameters"
- Question: "These are the configurable inputs:\n\n{list parameters}\n\nAnything to add or change?"
- Options:
  - "Looks good" / "These parameters are sufficient"
  - "Add more" / "I need additional parameters" (user describes them)

Apply changes via Edit.

### 4d: Dependencies

**Skip this sub-step entirely if `AUTHORING_SANDBOX=1` (see Step 4 shortcut).** Leave the Dependencies table placeholder row intact for later.

Use AskUserQuestion:
- Header: "Dependencies"
- Question: "What does your runbook need beyond the base environment?"
- Options:
  - "Jetty workflows" / "I'll call Jetty workflows as sub-steps"
  - "External APIs" / "I call non-Jetty APIs (REST, GraphQL, etc.)"
  - "Python/Node packages" / "I need specific libraries installed"
  - "None" / "No special dependencies — just standard tools"

For each selected category, ask a follow-up for specifics (workflow names, API URLs, package names). Populate the Dependencies table and the Step 1 setup script via Edit.

### 4e: Secrets (Optional)

Use AskUserQuestion:
- Header: "Secrets"
- Question: "Does this runbook need any API keys, tokens, or other credentials?"
- Options:
  - "Yes" / "I need to declare secrets for API keys or credentials"
  - "No" / "No sensitive parameters needed"

If yes, for each secret collect via AskUserQuestion:
- Logical name (e.g., `OPENAI_API_KEY`)
- Collection environment variable name (usually same as logical name)
- Description
- Required or optional

Populate the `secrets` block in frontmatter with the collected values. For example:

```yaml
secrets:
  OPENAI_API_KEY:
    env: OPENAI_API_KEY
    description: "OpenAI API key for embeddings"
    required: true
```

Also add a verification block in Step 1 (Environment Setup) that checks each required secret is available as an environment variable.

### 4f: Processing Steps

Based on the task description, propose a sequence of processing steps. Show the user your proposed outline. Use AskUserQuestion:
- Header: "Processing Steps"
- Question: "Here's the step sequence I'm proposing:\n\n{numbered list of steps}\n\nWant to adjust?"
- Options:
  - "Looks good" / "This sequence works"
  - "Add a step" / "I need an additional step"
  - "Change order" / "The steps need reordering"
  - "Remove a step" / "One of these isn't needed"

Apply changes via Edit. For each confirmed step, write a skeleton with:
- Step name as header
- 2-3 sentence description of what to do
- Placeholder for API calls or code snippets: `{TODO: add API call examples and expected response format}`
- Placeholder for error handling: `{TODO: add error handling for common failures}`

### 4g: Evaluation Criteria

This is the most important section. Branch based on the evaluation pattern:

**For programmatic:**

Use AskUserQuestion:
- Header: "Pass/Fail Criteria"
- Question: "Define what PASS, PARTIAL, and FAIL mean for your outputs. What makes an output correct? What makes it partially correct? What's a failure?"
- Options:
  - "I'll define them" / "Let me describe each status" (user types)
  - "Use defaults" / "Keep the template defaults and I'll refine later"

If they define criteria, update the status table via Edit.

**For rubric:**

Use AskUserQuestion:
- Header: "Rubric Criteria"
- Question: "What criteria matter for your output quality? Name 3-7 dimensions you'd score on a 1-5 scale.\n\nExamples: accuracy, completeness, clarity, brand compliance, technical correctness, creativity, formatting"
- Options:
  - "I'll list them" / "Let me name my criteria" (user types)
  - "Use 5 defaults" / "Start with generic criteria and I'll customize later"

If they provide criteria, build the rubric table with rows for each. For each criterion, ask (in a single AskUserQuestion):
- Header: "Rubric Details"
- Question: "For each criterion, briefly describe what 5 (excellent) and 1 (poor) look like. Or just list the criteria names and I'll draft reasonable descriptions.\n\n{list their criteria}"
- Options:
  - "I'll describe them" / "Let me define the scale for each" (user types)
  - "You draft them" / "Write reasonable descriptions and I'll review"

Update the rubric table via Edit.

### 4h: Common Fixes (optional)

**Skip this sub-step entirely if `AUTHORING_SANDBOX=1` (see Step 4 shortcut).** Leave the Common Fixes table placeholder rows intact — they get filled in after the first real run surfaces actual failure modes.

Use AskUserQuestion:
- Header: "Common Fixes"
- Question: "Do you know the typical failure modes for this task? If so, describe them and I'll build a fix table. If not, you can fill this in after your first few runs."
- Options:
  - "I know some" / "Let me describe common issues" (user types)
  - "Skip for now" / "I'll fill this in after running the runbook"

If they provide issues, populate the Common Fixes table via Edit. If skipped, leave the placeholder rows.

### 4i: Tips (optional)

**Skip this sub-step entirely if `AUTHORING_SANDBOX=1` (see Step 4 shortcut).** Leave the Tips section's placeholder bullets intact — they get filled in after the first run reveals real gotchas.

Use AskUserQuestion:
- Header: "Tips"
- Question: "Any domain-specific gotchas, API quirks, or hard-won lessons you want to capture? These help the agent avoid known pitfalls."
- Options:
  - "Yes" / "I have some tips to add" (user types)
  - "Skip" / "Nothing comes to mind — I'll add tips later"

If they provide tips, update the Tips section via Edit.

---

## Step 5: Validate the Runbook

Run structural validation checks on the completed runbook. Write a validation script to a temp file and execute it:

```bash
cat > /tmp/validate_runbook.sh << 'VALIDATE_EOF'
#!/bin/bash
FILE="$1"
ERRORS=0
WARNINGS=0

echo "=== RUNBOOK VALIDATION: $FILE ==="

# Check frontmatter
if head -5 "$FILE" | grep -q "^---"; then
  VERSION=$(grep "^version:" "$FILE" | head -1 | sed 's/version: *//' | tr -d '"')
  EVAL=$(grep "^evaluation:" "$FILE" | head -1 | sed 's/evaluation: *//' | tr -d '"')
  if [ -n "$VERSION" ] && [ -n "$EVAL" ]; then
    echo "PASS: Frontmatter (version: $VERSION, evaluation: $EVAL)"
  else
    echo "ERROR: Frontmatter missing version or evaluation field"
    ERRORS=$((ERRORS+1))
  fi
  if [ "$EVAL" != "programmatic" ] && [ "$EVAL" != "rubric" ]; then
    echo "ERROR: evaluation must be 'programmatic' or 'rubric', got '$EVAL'"
    ERRORS=$((ERRORS+1))
  fi
else
  echo "ERROR: No YAML frontmatter found"
  ERRORS=$((ERRORS+1))
fi

# Check required sections
for section in "## Objective" "## REQUIRED OUTPUT FILES" "## Final Checklist"; do
  if grep -q "$section" "$FILE"; then
    echo "PASS: '$section' section found"
  else
    echo "ERROR: '$section' section missing"
    ERRORS=$((ERRORS+1))
  fi
done

# Check validation_report.json in manifest
if grep -q "validation_report.json" "$FILE"; then
  echo "PASS: validation_report.json in output manifest"
else
  echo "ERROR: validation_report.json not found in output manifest"
  ERRORS=$((ERRORS+1))
fi

# Check summary.md in manifest
if grep -q "summary.md" "$FILE"; then
  echo "PASS: summary.md in output manifest"
else
  echo "WARN: summary.md not found in output manifest (recommended)"
  WARNINGS=$((WARNINGS+1))
fi

# Check for evaluation step
if grep -q "Evaluate" "$FILE" || grep -q "Rubric" "$FILE"; then
  echo "PASS: Evaluation step found"
else
  echo "ERROR: No evaluation step found"
  ERRORS=$((ERRORS+1))
fi

# Check for iteration with max rounds
if grep -qiE "max [0-9]+ round|iterate.*max|up to [0-9]+" "$FILE"; then
  echo "PASS: Iteration step with bounded rounds found"
else
  echo "ERROR: No bounded iteration step found (must specify max rounds)"
  ERRORS=$((ERRORS+1))
fi

# Check for verification script
if grep -q "FINAL OUTPUT VERIFICATION" "$FILE" || grep -q "Verification Script" "$FILE"; then
  echo "PASS: Verification script found"
else
  echo "ERROR: No verification script in Final Checklist"
  ERRORS=$((ERRORS+1))
fi

# Check Parameters section if template vars exist
VARS=$(grep -oE '\{\{[a-z_]+\}\}' "$FILE" | sort -u | tr -d '{}')
if [ -n "$VARS" ]; then
  if grep -q "## Parameters" "$FILE"; then
    echo "PASS: Parameters section found"
    # Check each template var is declared
    for var in $VARS; do
      if grep -q "$var" "$FILE" | grep -cq "Template Variable\|Parameter"; then
        true  # declared
      fi
    done
  else
    echo "ERROR: Template variables found but no Parameters section"
    ERRORS=$((ERRORS+1))
  fi
fi

# Check for Dependencies section
if grep -q "## Dependencies" "$FILE"; then
  echo "PASS: Dependencies section found"
else
  echo "WARN: No Dependencies section (add if runbook uses external APIs/workflows)"
  WARNINGS=$((WARNINGS+1))
fi

# Check for Tips section
if grep -q "## Tips" "$FILE"; then
  echo "PASS: Tips section found"
else
  echo "WARN: No Tips section (recommended for domain-specific guidance)"
  WARNINGS=$((WARNINGS+1))
fi

# Check for remaining TODO markers
TODO_COUNT=$(grep -c "{TODO:" "$FILE" 2>/dev/null || echo 0)
if [ "$TODO_COUNT" -gt 0 ]; then
  echo "WARN: $TODO_COUNT {TODO:} markers remain — fill these in before running"
  WARNINGS=$((WARNINGS+1))
fi

echo ""
if [ $ERRORS -eq 0 ]; then
  echo "Result: VALID ($WARNINGS warning(s))"
else
  echo "Result: INVALID ($ERRORS error(s), $WARNINGS warning(s))"
fi
VALIDATE_EOF
chmod +x /tmp/validate_runbook.sh
bash /tmp/validate_runbook.sh "THE_RUNBOOK_PATH"
```

Replace `THE_RUNBOOK_PATH` with `./RUNBOOK.md`.

**If there are errors**, tell the user what needs to be fixed and guide them through the fixes using Edit. Re-run validation after fixes.

**If valid**, tell the user:

> "Your runbook passes structural validation! {N warnings if any — mention them briefly.}"

---

## Step 5b: Pre-register the Task with File Uploads Enabled

Most runbooks benefit from accepting file uploads at trigger time — users frequently want to attach a CSV, PDF, image, or dataset when running. Pre-register the Task row server-side now so the Jetty web app shows the file-upload affordance on the very first run, before any chat-completions call has materialized the row.

Derive the task name from the runbook title (kebab-case, e.g., `nl-to-sql-regression`) and the agent/snapshot from the frontmatter you wrote in Step 3.

Detect the user's collection from their token:

```bash
TOKEN="$(cat ~/.config/jetty/token)"
COLLECTION=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "https://flows-api.jetty.io/api/v1/collections/" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); cols=d.get('collections',d) if isinstance(d,dict) else d; print(cols[0]['name'] if cols else '')")
echo "Collection: $COLLECTION"
```

If multiple collections are returned, ask the user which one with AskUserQuestion (Header: "Collection", Question: "Which collection should this runbook live in?", Options: one per collection name).

Now upsert the Task row with `has_file_uploads=true` and `is_chat_flow=true`. Try `PUT` first (works whether the task exists or not via auto-create on chat-completions); if that returns 404, fall back to `POST`:

```bash
TASK_NAME="REPLACE_WITH_KEBAB_TASK_NAME"
TOKEN="$(cat ~/.config/jetty/token)"

# Try update first
HTTP=$(curl -s -o /tmp/task_resp.json -w "%{http_code}" -X PUT \
  "https://flows-api.jetty.io/api/v1/tasks/$COLLECTION/$TASK_NAME" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"has_file_uploads": true, "is_chat_flow": true}')

if [ "$HTTP" = "404" ]; then
  curl -s -X POST "https://flows-api.jetty.io/api/v1/tasks/$COLLECTION" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(python3 -c "import json; print(json.dumps({
      'name': '$TASK_NAME',
      'workflow': {'init_params': {}, 'step_configs': {'completion': {'activity': 'passthrough'}}, 'steps': ['completion']},
      'description': 'Runbook task (pre-registered with file uploads enabled)',
      'has_file_uploads': True,
      'is_chat_flow': True,
      'is_private': True,
      'entity_type': 'task'
    }))")
fi
```

Tell the user (one line):
> "Pre-registered task `{collection}/{task_name}` with file uploads enabled — you can attach files when triggering runs from the web app or via the API."

If pre-registration fails (network, auth, etc.), don't block — log a warning and tell the user the task will auto-register on first run; they can manually flip `has_file_uploads` later via `PUT /api/v1/tasks/{collection}/{task_name}` or in the web app.

Save `TASK_NAME` and `COLLECTION` for use in Step 7.

---

## Step 6: Optional Dry Run

Use AskUserQuestion:
- Header: "Test"
- Question: "Want me to do a dry run? I'll read through your runbook step by step and list what each step would do — flagging any missing credentials, unavailable APIs, or potential issues — without actually executing anything."
- Options:
  - "Yes, dry run" / "Walk through the plan without executing"
  - "Skip" / "I'll test it myself later"

**If "Yes, dry run":**

Read the completed runbook with the Read tool. Then produce a walkthrough:

1. List all parameters and whether they have values or need to be provided at runtime
2. For each step, describe what the agent would do:
   - Which APIs or services it would call
   - What data it would process
   - What files it would write
3. Flag potential issues:
   - Parameters without defaults that need values
   - External APIs or credentials referenced
   - Jetty workflows that need to exist
   - Packages that need to be installed
4. Estimate the rough scope (number of API calls, expected outputs)

Present this as a formatted summary to the user. If the runbook has a `{{results_dir}}`, create the results directory and write the walkthrough to `{results_dir}/plan.md`:

```bash
mkdir -p ./results
```

Write `./results/plan.md` with the walkthrough using the Write tool.

---

## Step 7: Next Steps

Tell the user:

> **Your runbook is ready!** Here's how to use it:
>
> **Run it locally:**
> Open the runbook in a new conversation and tell the agent to follow it:
> *"Follow the runbook in ./RUNBOOK.md. Use these parameters: results_dir=./results, {other params}..."*
>
> **Run it on Jetty (recommended):**
> Use the chat-completions endpoint with a `jetty` block — this is the single API call that configures *everything*: which agent runs it, which collection it belongs to, and what files to upload into the sandbox.
>
> ```bash
> curl -X POST "https://flows-api.jetty.io/v1/chat/completions" \
>   -H "Authorization: Bearer $JETTY_API_TOKEN" \
>   -H "Content-Type: application/json" \
>   -d '{
>     "model": "{model from frontmatter}",
>     "messages": [
>       {"role": "system", "content": "<contents of your RUNBOOK.md>"},
>       {"role": "user", "content": "Execute the runbook."}
>     ],
>     "stream": true,
>     "jetty": {
>       "runbook": true,
>       "collection": "{your-collection}",
>       "task": "{task-name}",
>       "agent": "{agent from frontmatter}",
>       "model_provider": "{model_provider from frontmatter}",
>       "snapshot": "{snapshot from frontmatter}",
>       "template_variables": {
>         "sample_size": "10"
>       },
>       "file_paths": ["uploads/2026/04/my-input.csv"]
>     }
>   }'
> ```
>
> **Attaching files at run time:** This task was pre-registered with `has_file_uploads=true`, so the Jetty web app shows a file-upload control on the task page. Files dropped there are stored and their storage paths are passed to the runbook in `init_params.file_paths`. You can also pass `jetty.file_paths` directly in the API call (as shown) or upload via `multipart/form-data` to `/v1/files` and pass the returned file IDs as `jetty.files`.
>
> The `jetty` block fields map directly to your runbook's frontmatter:
> | Frontmatter field | `jetty` block field | Purpose |
> |---|---|---|
> | `agent` | `jetty.agent` | Which agent CLI runs the runbook (`opencode`, `claude-code`, `codex`, `gemini-cli`) |
> | `model` | `model` (top-level) | Which LLM the agent uses (e.g. `anthropic/claude-sonnet-4.6` for opencode + OpenRouter) |
> | `model_provider` | `jetty.model_provider` | How the model id is routed: `openrouter`, `anthropic`, `openai`, `google`, `bedrock` |
> | `snapshot` | `jetty.snapshot` | Sandbox environment: `python312-uv` or `prism-playwright` |
> | parameters | `jetty.template_variables` | Key-value pairs for `{{var}}` substitution in the runbook |
> | — | `jetty.collection` | Namespace that holds your env vars and secrets |
> | — | `jetty.task` | Task name for grouping trajectories |
> | — | `jetty.file_paths` | Files to upload into the sandbox workspace |
>
> Or use `/jetty run runbook` to have the agent build this request for you interactively.
>
> **Iterate on the runbook:**
> After your first few runs, come back and:
> - Add entries to the **Common Fixes** table based on failures you observe
> - Add **Tips** for gotchas the agent encountered
> - Tighten **evaluation criteria** as your quality bar becomes clearer
> - Bump the **version** when you make structural changes
>
> **Re-validate after changes:**
> Run `/create-runbook` again on an existing RUNBOOK.md to re-validate it, or run the validation script from Step 5 manually.

---

## Important Notes

- **Always keep `validation_report.json` in the output manifest.** This is the standardized machine-readable results filename across all Jetty runbooks. Never use `scores.json`, `results.json`, or other variants.
- **The `{{results_dir}}` parameter** defaults to `/app/results` when running on Jetty and `./results` when running locally.
- **Bound iteration.** Every iteration loop must specify a maximum round count (typically 3). Without bounds, the agent may loop indefinitely.
- **Use imperative language** in the output manifest and final checklist. Agents tend to wrap up early when they encounter errors — strong language like "Do NOT finish until all items pass" overrides this.
- **Don't over-specify intermediate steps.** The agent should have room to adapt. Specify *what* each step must produce, not every line of code.
- **Don't mix evaluation patterns.** Programmatic validation for structured output, rubric scoring for creative output. Don't rubric-score a JSON file or schema-validate a social graphic.
