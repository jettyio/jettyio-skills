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

Follow these steps IN ORDER. Be friendly and concise — a light 🪽 Pelly touch is welcome, but keep it out of the way of the actual steps. At each decision point, use AskUserQuestion to let the user choose.

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

**Default to `claude-code` + `anthropic/claude-sonnet-4.6` routed through OpenRouter (`model_provider: openrouter`) without asking.** This is the right choice for the vast majority of users — strong reasoning, broad tool support, and a single `OPENROUTER_API_KEY` gives unified billing and provider failover. Only fall back to AskUserQuestion when the user has explicitly asked for a different agent in their task description (e.g., "route Claude through Anthropic directly", "use Codex", "I only have a Gemini key").

Before defaulting silently, do a quick check to confirm the user's collection has a usable key for the encouraged config. Run:

```bash
TOKEN="$(cat ~/.config/jetty/token)"
COLLECTION="{collection from Step 2a or jetty whoami default}"

# Org-level provider keys
COLL=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "https://flows-api.jetty.io/api/v1/collections/$COLLECTION/environment")
read HAS_OPENROUTER HAS_ANTHROPIC <<< "$(echo "$COLL" | python3 -c "
import sys, json
evars = json.load(sys.stdin).get('environment_variables', {})
print('OPENROUTER_API_KEY' in evars, 'ANTHROPIC_API_KEY' in evars)
")"

# Trial status
TRIAL=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "https://flows-api.jetty.io/api/v1/trial/$COLLECTION")
TRIAL_ACTIVE=$(echo "$TRIAL" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('active', False))")
```

Decision (every path keeps the `claude-code` agent):
- `HAS_OPENROUTER == True` → **encouraged path**: `claude-code` + `anthropic/claude-sonnet-4.6` + `model_provider: openrouter`. One line: *"Using Claude Code on OpenRouter (anthropic/claude-sonnet-4.6) — your org has OPENROUTER_API_KEY set."*
- No OpenRouter key, but `HAS_ANTHROPIC == True` **or** `TRIAL_ACTIVE == True` → fall back to `claude-code` + `claude-sonnet-4-6` + `model_provider: anthropic`. One line: *"Using Claude Code via Anthropic (claude-sonnet-4-6) — your trial covers it."* or *"…your org has ANTHROPIC_API_KEY set."*
- Neither → still default to the encouraged OpenRouter path, but tell the user: *"Defaulting to Claude Code on OpenRouter (anthropic/claude-sonnet-4.6). Add an OPENROUTER_API_KEY in Jetty before running — or tell me to route Claude through Anthropic instead."*

Only use AskUserQuestion when the user's task description explicitly names a different runtime, or they push back on the default. When you do ask:
- Header: "Agent Runtime"
- Question: "Which agent will run this runbook on Jetty?"
- Options:
  - "Claude Code on OpenRouter (Recommended)" / "Runs the Claude Code agent on anthropic/claude-sonnet-4.6 routed through OpenRouter. One OPENROUTER_API_KEY — unified billing and provider failover."
  - "Claude Code via Anthropic" / "Runs Claude Code on claude-sonnet-4-6 directly via Anthropic. Requires an ANTHROPIC_API_KEY."
  - "Codex (OpenAI)" / "Uses gpt-5.5 — strong at code generation. Requires an OPENAI_API_KEY."
  - "Gemini CLI (Google)" / "Uses gemini-3.1-pro-preview — free tier available. Requires a GOOGLE_API_KEY."

(The opencode agent on OpenRouter is also supported — see the agents-and-models reference — but Claude Code is the default runtime.)

Save the agent, model, and provider choice. The mapping is:
- Claude Code on OpenRouter → agent: `claude-code`, model: `anthropic/claude-sonnet-4.6`, model_provider: `openrouter`
- Claude Code via Anthropic → agent: `claude-code`, model: `claude-sonnet-4-6`, model_provider: `anthropic`
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

Read the template using the Read tool. **If the template cannot be read** (not found, or the Read is denied because the skill directory is outside the allowed paths), stop and tell the user: the runbook structure comes from the template and from nowhere else, so do not improvise one. They can re-run with the skill directory allowed (for example `--add-dir`) or copy the templates next to the working directory.

Now customize the template using the task description from Step 2a:

1. **Title**: Replace `{Task Name}` with a concise name derived from the task description
2. **Objective**: Write a 2-5 sentence objective based on what the user described — input, processing, output
3. **Output manifest**: Propose specific output files based on the task (replace `{primary_output}` with a real filename like `results.csv`, `output.json`, `report.html`, etc.). Replace it **everywhere it appears** (use replace_all): the REQUIRED OUTPUT FILES table, the `primary_outputs:` frontmatter list, the `outputs-exist` check, the Code Checks `{TODO:}` line and the report example. A `{primary_output}` left in a check is a validation error, because the check would look for a file literally named that. `primary_outputs` is what lets spot surface the right file as the "Main output" when a run completes; list only headline deliverables (never `summary.md` or `validation_report.json`), most important first.
4. **Parameters**: Propose parameters based on inputs mentioned in the task description. Always keep `{{results_dir}}`.
5. **Agent/model/model_provider/snapshot**: Write the choices from Step 2c into the frontmatter fields. Include `model_provider` so routing is explicit (claude-code → `openrouter` by default, or `anthropic` for direct routing; codex → `openai`; gemini-cli → `google`).
6. **Steps 2-3**: Rename and briefly describe the processing steps based on the task
7. **Code Checks and Checklist**: keep the `outputs-exist` check and make its file list match the REQUIRED OUTPUT FILES table (minus `validation_report.json`). Leave the `{TODO: ...}` line under Code Checks for Step 4h; it is prose before the first `###` heading, which Jetty's parser ignores, so it never runs.

Leave `{TODO: ...}` markers, `{How to fix it}`, and similar placeholders in sections that require detailed domain input from the user (evaluation criteria, common fixes, tips, dependencies).

Write the customized runbook to `./RUNBOOK.md` (always — do not ask the user for a different path) using the Write tool.

Tell the user:

> "I've created a runbook scaffold at `./RUNBOOK.md`. It has the full structure with your task details filled in and placeholder markers where I need your input. Let's walk through each section."

---

## Step 4: Customize Sections

Walk through each section that needs user input. For each, show the user what's currently in the runbook and ask for their refinement. Use the Edit tool to apply changes.

### Authoring sandbox shortcut

If you are running inside a Jetty authoring sandbox — detected by either `AUTHORING_MISSION` being set in the environment or `/app/MISSION.md` existing on disk — **skip sub-steps 4d (Dependencies), 4i (Common Fixes), and 4j (Tips)**. These three sections are best filled in *after* the runbook has been executed at least once, when real failure modes, real dependencies, and real gotchas are known. Leave the placeholder rows in `RUNBOOK.md` as-is; they signal "fill in after first run". Walk through 4a, 4b, 4c, 4e, 4f, 4g, 4h only.

```bash
if [ -n "${AUTHORING_MISSION:-}" ] || [ -f /app/MISSION.md ]; then
  AUTHORING_SANDBOX=1
else
  AUTHORING_SANDBOX=0
fi
```

Outside the authoring sandbox (local CLI / IDE), walk through all ten sub-steps below (4a-4j).

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

Apply changes via Edit. Ensure `validation_report.json` and `summary.md` always remain in the manifest. When the user adds, removes, or renames a headline deliverable, update the `primary_outputs:` frontmatter to match — its first entry should be the file the user considers the main result (it becomes the "Main output" surfaced in spot). Any change to the manifest also goes into the `outputs-exist` check under Code Checks (one `test -s {{results_dir}}/<file>` per file, every file except `validation_report.json`) and into the `output_files` list of the validation report example. A check that still names an old file fails every run.

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

**Multimodal pre-fill.** If the task description involves images, video, vision, OCR, screenshots, image generation, or similar multimodal work, pre-populate the `secrets:` block *without* asking — and tell the user which keys you added in a single line. Pick from:

- `REPLICATE_API_TOKEN` — Flux, Seedance, Sora, segmentation, embeddings. The default choice for image/video generation.
- `GEMINI_API_KEY` — Imagen image generation, Gemini vision inputs.
- `OPENAI_API_KEY` — DALL·E, gpt-image-1, GPT-4 vision.

You only need to declare the ones the task actually uses (e.g., a "generate product hero images" task gets `REPLICATE_API_TOKEN` alone; "describe what's in this PDF" gets `GEMINI_API_KEY` or `OPENAI_API_KEY`). These three keys are also **auto-forwarded by Jetty** when present on the trajectory, so a trial-eligible collection will get usable tokens even without the explicit declaration — but declaring them keeps the runbook self-documenting and makes the verification block in Step 1 catch missing setup early.

### 4f: Processing Steps

Based on the task description, propose a sequence of processing steps. Show the user your proposed outline. Use AskUserQuestion:
- Header: "Processing Steps"
- Question: "Here's the step sequence I'm proposing:\n\n{numbered list of steps}\n\nWant to adjust?"
- Options:
  - "Looks good" / "This sequence works"
  - "Add a step" / "I need an additional step"
  - "Change order" / "The steps need reordering"
  - "Remove a step" / "One of these isn't needed"

Apply changes via Edit. Every `## Step N:` heading is numbered in order, the three closing sections (Code Checks, Checklist, Write Validation Report) included, so renumber every later heading when a step is added or removed. For each confirmed step, write a skeleton with:
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

### 4h: Code Checks & Checklist

Code Checks are run by Jetty after the agent finishes (command checks, unless marked `executor=agent` on the fence) or by the agent (agent checks and the marked ones), exactly as written, and a failing one fails the run, so the runbook must not ship with a placeholder check. Show the user the `outputs-exist` check and the `{TODO: ...}` line under the Code Checks heading (`## Step N: Code Checks`; its number follows the last processing step), then use AskUserQuestion:
- Header: "Code Checks"
- Question: "Which properties of `{primary_output}` can be verified? Each becomes a `### <id> — <name>` heading with one fenced block: a `bash` command that exits non-zero on failure (schema validation, row counts, a test suite), a `yaml` built-in (`use: file_exists | min_size | json_valid | regex_present | regex_absent | markdown_relative_links_resolve`), or an `agent` instruction for something only the agent can check (an MCP server, its live state). Scripts you already have can be cloned from a git repo via `code_checks.sources` in the frontmatter."
- Options:
  - "I'll describe them" / "Let me list what to check" (user types)
  - "Draft them" / "Propose 1-3 checks from the output format and I'll review"
  - "Only outputs-exist" / "Keep just the file-existence check for now"

Via Edit: add each check after `outputs-exist` (an id of letters, digits, `.`, `_`, `-` that no other check uses, since Jetty keeps only the first of two checks with one id; a one-sentence name; one fenced block whose language is `bash`, `yaml` or `agent`), then delete the `{TODO: ...}` line. If the user chose "Only outputs-exist", delete the line anyway. Prefer a built-in or a `bash` fence: Jetty runs those itself, so the agent cannot skip or misreport them. A command that only the agent's live session can run (a request to a server a step started, which is gone by the time Jetty's checks run) is marked on its fence, ` ```bash executor=agent `, and the agent runs and reports it; who runs a check is declared per check, there is no runbook-wide executor setting. A `bash` fence runs under `bash -e -o pipefail` with `RESULTS_DIR`, `CHECKS_DIR` and `ASSETS_DIR` set and `{{results_dir}}` / `{{checks_dir}}` / `{{assets_dir}}` substituted; the per-check timeout is `code_checks.timeout_sec` (default 120 s). If a check needs a script from a git repo, uncomment `code_checks.sources` in the frontmatter, fill in `name`/`url`/`ref`, declare its `secret` under `secrets:` too, and reference the clone as `{{checks_dir}}/<name>/...`. Jetty's checks read a fresh clone made after the agent exits; a check the agent runs may reference it too, and then the sources are also cloned before the agent starts.

Then review the items under the Checklist heading (the step after Code Checks) with the user: 3-6 `- [ ]` conditions a reviewer confirms by inspection, each a short phrase (its slug becomes the report `id`), no `{...}` placeholders. A failed item fails the run, so keep only conditions the agent can actually verify from the outputs.

### 4i: Common Fixes (optional)

**Skip this sub-step entirely if `AUTHORING_SANDBOX=1` (see Step 4 shortcut).** Leave the Common Fixes table placeholder rows intact — they get filled in after the first real run surfaces actual failure modes.

Use AskUserQuestion:
- Header: "Common Fixes"
- Question: "Do you know the typical failure modes for this task? If so, describe them and I'll build a fix table. If not, you can fill this in after your first few runs."
- Options:
  - "I know some" / "Let me describe common issues" (user types)
  - "Skip for now" / "I'll fill this in after running the runbook"

If they provide issues, populate the Common Fixes table via Edit. If skipped, leave the placeholder rows.

### 4j: Tips (optional)

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

if [ ! -r "$FILE" ]; then
  echo "ERROR: $FILE not found or not readable"
  echo ""
  echo "Result: INVALID (1 error(s), 0 warning(s))"
  exit 1
fi

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

# v1 runbooks (Final Checklist + stages report) do not validate as v2. Say so once, up front.
if grep -qE "FINAL OUTPUT VERIFICATION|^## (Step [0-9]+: )?Final Checklist" "$FILE"; then
  echo "ERROR: v1 runbook — replace the Final Checklist / verification script with '## Code Checks' + '## Checklist' and the stages report with the v2 checks[] report (see the create-runbook templates)"
  ERRORS=$((ERRORS+1))
fi

# Check required sections. Headings may carry a "Step N:" prefix (the templates number the closing sections as the
# last steps; Jetty drops the prefix when it looks a section up). Jetty finds Code Checks and Checklist by their exact
# name (any case), so nothing may follow it there: '## Step 7: Code Checks (MANDATORY)' leaves the run with no checks.
STEP_PREFIX='([Ss][Tt][Ee][Pp][[:space:]]+[0-9]+[[:space:]]*[:.][[:space:]]*)?'
for section in "Objective" "REQUIRED OUTPUT FILES" "Code Checks" "Checklist" "Write Validation Report"; do
  case $section in
    "Code Checks"|"Checklist") EXACT=1 ;;
    *) EXACT=0 ;;
  esac
  if [ $EXACT = 1 ] && grep -iqE "^## $STEP_PREFIX$section[[:space:]]*\$" "$FILE"; then
    echo "PASS: '$section' section found"
  elif [ $EXACT = 1 ] && grep -iqE "^## $STEP_PREFIX$section([^[:alnum:]]|\$)" "$FILE"; then
    echo "ERROR: The '$section' heading has text after the name — Jetty finds it only as exactly '## [Step N: ]$section'"
    ERRORS=$((ERRORS+1))
  elif [ $EXACT = 0 ] && grep -qE "^## $STEP_PREFIX$section" "$FILE"; then
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

# Check primary_outputs declaration (drives spot's "Main output" selection)
if grep -q "^primary_outputs:" "$FILE"; then
  echo "PASS: primary_outputs declared in frontmatter"
else
  echo "WARN: No primary_outputs in frontmatter — spot will fall back to filesystem order to pick the main output"
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

# Check for the outputs-exist code check
if grep -q "^### outputs-exist" "$FILE"; then
  echo "PASS: outputs-exist code check found"
else
  echo "ERROR: No outputs-exist code check under ## Code Checks"
  ERRORS=$((ERRORS+1))
fi

# Fence-aware section reader: the lines of '## [Step N: ]<name>' up to the next '## ' outside a fence, each
# prefixed T (text), O (fence opener), F (inside a fence) or C (fence closer). A '## ' or '### ' inside a fence is text.
# The heading matches in any case; with "exact" nothing may follow the name (how Jetty finds Code Checks and Checklist).
# A fence line may be indented, as Jetty reads it.
section_lines() {
  awk -v name="$1" -v exact="$2" '
    function fence_len(s, ch,   n) { n = 0; while (substr(s, n + 1, 1) == ch) n++; return n }
    /^[[:space:]]*(```|~~~)/ {
      line = $0; sub(/^[[:space:]]+/, "", line)
      ch = substr(line, 1, 1); len = fence_len(line, ch); info = substr(line, len + 1); gsub(/[[:space:]]/, "", info)
      if (!infence) { infence = 1; fch = ch; flen = len; if (on) print "O " line; next }
      if (ch == fch && len >= flen && info == "") { infence = 0; if (on) print "C " line; next }
    }
    infence { if (on) print "F " $0; next }
    /^## / { if (on) exit; on = (tolower($0) ~ ("^## (step[[:space:]]+[0-9]+[[:space:]]*[:.][[:space:]]*)?" tolower(name) (exact ? "[[:space:]]*$" : "([[:space:]]|$)"))); next }
    on { print "T " $0 }
    END { if (on && infence) print "U unterminated fence" }
  ' "$FILE"
}
CC=$(section_lines "Code Checks" exact)
CL=$(section_lines "Checklist" exact)
# A fence that never closes swallows the later sections as fence content (up to the next bare closing fence, or the end of the
# file); a runbook section heading ('## Step N: ...' or a closing section's name) or a check heading ('### <id> — <name>')
# inside a fence is the symptom. Say so instead of reporting the sections or checks missing. Any other '## ' or '### '
# line in a fence is text, such as a '## comment' in a bash check.
if printf '%s\n' "$CC" "$CL" | grep -qiE '^U |^F ## (step[[:space:]]+[0-9]+[[:space:]]*[:.]|(code checks|checklist|write validation report|tips)[[:space:]]*$)|^F ### [a-z0-9][a-z0-9._-]*[[:space:]]+(—|–|-)[[:space:]]+[^[:space:]]'; then
  echo "ERROR: An unterminated fence under ## Code Checks / ## Checklist — every fenced block needs a closing \`\`\` line"
  ERRORS=$((ERRORS+1))
fi
CHECK_INTRO=$(printf '%s\n' "$CC" | awk '/^T ### /{exit} /^T /{print substr($0, 3)}')
CHECK_HEADINGS=$(printf '%s\n' "$CC" | grep '^T ### ' | cut -c3-)
CHECK_COUNT=$(printf '%s\n' "$CHECK_HEADINGS" | grep -c '^### ')
CHECK_CMDS=$(printf '%s\n' "$CC" | awk '/^T ### /{f=1} f && /^F /{print substr($0, 3)}')

# The template's {TODO:} line under ## Code Checks (before the first ### heading) marks checks not yet chosen; Step 4h deletes it.
if printf '%s\n' "$CHECK_INTRO" | grep -q '{TODO:'; then
  echo "ERROR: The {TODO:} line under ## Code Checks is still there — add the output-specific checks (Step 4h) and delete it"
  ERRORS=$((ERRORS+1))
fi

# Code Checks run exactly as written: a placeholder heading or command fails every run.
# A template placeholder is {Words like this} or {TODO: ...}; {{var}}, ${var} and JSON-looking braces ({"k": ...}) are not.
PLACEHOLDER='(^|[^{$])\{(TODO:[^}]*|[A-Za-z_][^{}"'"'"':]*)\}'
if printf '%s\n' "$CHECK_HEADINGS" | grep -qE "$PLACEHOLDER"; then
  echo "ERROR: A Code Check heading still contains a {placeholder} — replace it with a real '### <id> — <name>' or delete the check"
  ERRORS=$((ERRORS+1))
fi
if printf '%s\n' "$CHECK_CMDS" | grep -qE '\{primary_output\}|\{TODO:'; then
  echo "ERROR: A Code Check command still contains {primary_output} or a {TODO:} marker — the check would fail every run"
  ERRORS=$((ERRORS+1))
elif printf '%s\n' "$CHECK_CMDS" | grep -vE "(^|[^A-Za-z0-9_])([rR]?[fF]|[fF][rR])\\\\?[\"']" | grep -qE "$PLACEHOLDER"; then
  # (a line holding a Python f-string is skipped: its {name} braces are code. The f must start a word, so a path
  # ending in .pdf" or .conf' is still scanned)
  echo "WARN: A Code Check command contains {text like this} — make sure it is not an unfilled placeholder"
  WARNINGS=$((WARNINGS+1))
fi
# Jetty reads a check heading as '### <id> <dash> <name>' (id: letters, digits, . _ -) and the first fence's language as its kind
if [ "${CHECK_COUNT:-0}" -gt 0 ] && printf '%s\n' "$CHECK_HEADINGS" | grep -vqE '^### [A-Za-z0-9][A-Za-z0-9._-]*[[:space:]]+(—|–|-)[[:space:]]+.+'; then
  echo "ERROR: A Code Check heading is not '### <id> — <name>' (id: letters, digits, . _ -)"
  ERRORS=$((ERRORS+1))
fi
# Each heading is read from the FIRST fence after it. Usable kinds: bare/bash/sh/shell (command), yaml/check (built-in), agent.
# None, or any other language, is reported by Jetty as error. An 'executor=' word after the language names who runs the
# check: jetty (the default for a command) or agent; an agent fence is always the agent's, so executor=jetty on one is an error too.
FENCE_PROBLEMS=$(printf '%s\n' "$CC" | awk '
  /^T ### / { if (id != "" && !ok) print "nofence " id; id = $3; ok = 0; seen = 0; next }
  /^O / { if (id != "" && !seen) { seen = 1; info = substr($0, 3); sub(/^[`~]+[[:space:]]*/, "", info); n = split(info, w, /[[:space:]]+/); lang = w[1]
          lang = tolower(lang)
          if (lang == "" || lang ~ /^(bash|sh|shell|yaml|check|agent)$/) ok = 1
          # Jetty reads the first word starting with "executor"; anything but executor=jetty / executor=agent is an error
          for (i = 2; i <= n; i++) if (tolower(w[i]) ~ /^executor/) { who = (tolower(w[i]) ~ /^executor=/) ? tolower(substr(w[i], 10)) : ""
            if (who != "jetty" && who != "agent") print "badexec " id " (" w[i] ")"; else if (who == "jetty" && lang == "agent") print "badexec " id " (an agent fence is always the agent'"'"'s)"
            break } } }
  END { if (id != "" && !ok) print "nofence " id }')
UNFENCED=$(printf '%s\n' "$FENCE_PROBLEMS" | awk '/^nofence /{print $2}')
BADEXEC=$(printf '%s\n' "$FENCE_PROBLEMS" | awk '/^badexec /{sub(/^badexec /, ""); print}')
if [ -n "$UNFENCED" ]; then
  echo "ERROR: Code Check(s) without a usable fence (bash/sh, yaml or agent) right after the heading: $(printf '%s' "$UNFENCED" | tr '\n' ' ')"
  ERRORS=$((ERRORS+1))
fi
if [ -n "$BADEXEC" ]; then
  echo "ERROR: Code Check(s) with a bad executor on the fence (write executor=jetty or executor=agent; never jetty on an agent fence): $(printf '%s' "$BADEXEC" | tr '\n' ' ')"
  ERRORS=$((ERRORS+1))
fi
# Jetty keeps only the first of two checks with one id and drops the agent's report entry for the other
DUP_IDS=$(printf '%s\n' "$CHECK_HEADINGS" | awk '/^### /{print $2}' | sort | uniq -d)
if [ -n "$DUP_IDS" ]; then
  echo "ERROR: Code Check id(s) used more than once: $(printf '%s' "$DUP_IDS" | tr '\n' ' ')"
  ERRORS=$((ERRORS+1))
fi
# outputs-exist must test the files the REQUIRED OUTPUT FILES table lists: a file it names that the table does not
# is one the agent is never told to write, so the check fails every run
MANIFEST=$(section_lines "REQUIRED OUTPUT FILES" | grep '^T |' | cut -c3-)
OE_FILES=$(printf '%s\n' "$CC" | awk '/^T ### /{f = ($3 == "outputs-exist")} f && /^F /' | grep -oE '\{\{results_dir\}\}/[^[:space:]"'"'"';&|)]+' | sed 's|{{results_dir}}/||' | sort -u)
for f in $OE_FILES; do
  if ! printf '%s\n' "$MANIFEST" | grep -qE "(^|[^[:alnum:]_.-])$(printf '%s' "$f" | sed 's/[]\\.[*^$()+?{}|]/\\&/g')([^[:alnum:]_.-]|\$)"; then
    echo "WARN: outputs-exist tests '$f', which the REQUIRED OUTPUT FILES table does not list — sync the check with the manifest"
    WARNINGS=$((WARNINGS+1))
  fi
done
if [ "${CHECK_COUNT:-0}" -lt 2 ]; then
  echo "WARN: Only outputs-exist under ## Code Checks — add at least one check specific to the output"
  WARNINGS=$((WARNINGS+1))
fi

# Checklist items: at least one '- [ ]' bullet, none still a placeholder (a failed item fails the run)
CHECKLIST_ITEMS=$(printf '%s\n' "$CL" | grep '^T ' | cut -c3- | grep -E '^[[:space:]]*[-*+][[:space:]]*\[( |x|X)\]')
ITEM_COUNT=$(printf '%s\n' "$CHECKLIST_ITEMS" | grep -c '\[')
if [ "${ITEM_COUNT:-0}" -ge 1 ]; then
  echo "PASS: Checklist has $ITEM_COUNT item(s)"
else
  echo "ERROR: ## Checklist has no '- [ ]' items"
  ERRORS=$((ERRORS+1))
fi
if printf '%s\n' "$CHECKLIST_ITEMS" | grep -qE "$PLACEHOLDER"; then
  echo "ERROR: A Checklist item still contains a {placeholder}"
  ERRORS=$((ERRORS+1))
fi

# Check the validation report is v2: integer version 2 and a checks[] array
if grep -qE '"version"[[:space:]]*:[[:space:]]*2([^0-9.]|$)' "$FILE" && grep -qE '"checks"[[:space:]]*:[[:space:]]*\[' "$FILE"; then
  echo "PASS: validation report v2 (checks[])"
else
  echo "ERROR: validation report example must be v2 (\"version\": 2, an integer) with a checks[] array"
  ERRORS=$((ERRORS+1))
fi

# Check Parameters section if template vars exist
VARS=$(grep -oE '\{\{[a-z_]+\}\}' "$FILE" | sort -u | tr -d '{}')
if [ -n "$VARS" ]; then
  if grep -q "## Parameters" "$FILE"; then
    echo "PASS: Parameters section found"
    # Each template variable needs a row in the Parameters table itself (checks_dir / assets_dir are run-time
    # substitutions, not parameters); a row in some other table does not count
    PARAM_ROWS=$(section_lines "Parameters" | grep '^T ' | cut -c3- | grep '^|')
    for var in $VARS; do
      case $var in checks_dir|assets_dir) continue;; esac
      if ! printf '%s\n' "$PARAM_ROWS" | grep -qE "^\|.*\{\{$var\}\}"; then
        echo "WARN: Template variable {{$var}} has no row in the Parameters table"
        WARNINGS=$((WARNINGS+1))
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
# grep -c prints "0" AND exits 1 on no match — don't `|| echo 0` (it would
# yield "0\n0" and break the -gt test)
TODO_COUNT=$(grep -c "{TODO:" "$FILE" 2>/dev/null)
if [ "${TODO_COUNT:-0}" -gt 0 ]; then
  echo "WARN: $TODO_COUNT {TODO:} markers remain — fill these in before running"
  WARNINGS=$((WARNINGS+1))
fi

echo ""
if [ $ERRORS -eq 0 ]; then
  echo "Result: VALID ($WARNINGS warning(s))"
else
  echo "Result: INVALID ($ERRORS error(s), $WARNINGS warning(s))"
  exit 1
fi
VALIDATE_EOF
chmod +x /tmp/validate_runbook.sh
bash /tmp/validate_runbook.sh "THE_RUNBOOK_PATH"
```

Replace `THE_RUNBOOK_PATH` with `./RUNBOOK.md`. The script exits 1 when the result is INVALID, so a non-zero exit from the Bash tool is expected in that case; read the `Result:` line.

**If there are errors**, tell the user what needs to be fixed and guide them through the fixes using Edit. Re-run validation after fixes.

### Migrating a v1 runbook

The first error reads `v1 runbook — replace the Final Checklist / verification script ...` when the runbook was written from an earlier version of this skill: a "Write Validation Report" step whose JSON has `stages` and `overall_passed` but no `checks`, followed by a "Final Checklist" step with a `FINAL OUTPUT VERIFICATION` script. Such a runbook **still runs on Jetty unchanged**: its report is read as v1 and its own `overall_passed` is the verdict. Migrate it to get Jetty-run checks and a computed verdict. Tell the user that, then, if they want the migration, apply these Edits (read the matching template first):

1. **Code Checks.** Replace the Final Checklist step with the template's Code Checks section, numbered as the step after the runbook's last processing step. The verification script's file loop becomes the `outputs-exist` check: its file list minus `validation_report.json`. Every other line in that script that tests output content (a `python` schema check, a row count, a link check) becomes its own `### <id> — <name>` heading with one `bash` fence. Delete the script.
2. **Checklist.** Add the template's Checklist section after it with the old checklist's `- [ ]` items, minus "exists" items (that is `outputs-exist` now) and the item about `stages` / `overall_passed`. Keep 3-6 items, no `{...}` placeholders. A rubric runbook gets `- [ ] Overall rubric average is at least 4.0`.
3. **Write Validation Report.** Replace the old step's JSON and prose with the template's Write Validation Report section, placed after the Checklist, keeping the runbook's own `parameters` keys in the example. The three headings continue the runbook's step numbering, so renumber them when it has more or fewer than six steps before them.
4. **Frontmatter.** Add `strict_evaluation: false` after `evaluation:` and the commented `code_checks:` block from the template. The old `version` and `secrets` stay as they are.
5. Re-run the validator, then walk sub-step 4h to add output-specific checks.

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

Now upsert the Task row with `has_file_uploads=true`, `is_chat_flow=true` and a workflow built from the runbook's frontmatter. Try `PUT` first (updates an existing row, including its workflow); if that returns 404, fall back to `POST`.

⚠️ **The pre-registered workflow must be a real runbook workflow** (`steps: ["run"]` with the `runbook` activity) — the shape Jetty builds when it creates a task from a runbook. Do NOT use a `completion`/`passthrough` stub: the engine executes the stored workflow on runbook runs, `passthrough` is not a runnable step, and the first run dies with `No step registered for 'completion'` before the sandbox boots.

The run step reads `code_checks`, `strict_evaluation`, `mcp_servers` and `snapshot` from the task's `init_params` only, never from the runbook text. So the frontmatter's values become the task's `init_params` defaults here, each with its `*_path` entry, or a run has no check sources (every check that uses `{{checks_dir}}` errors) and `strict_evaluation` is silently off. The task also records `runbook_evals_version: 2`: Jetty runs the Code Checks and computes the verdict only on a run whose task carries it, and reads any other run as v1. A task that the chat-completions endpoint auto-creates on a first `/jetty` remote run carries none of them, which is one more reason to register it here.

```bash
TASK_NAME="REPLACE_WITH_KEBAB_TASK_NAME"
RUNBOOK="./RUNBOOK.md"
TOKEN="$(cat ~/.config/jetty/token)"

# The workflow, from the runbook's frontmatter (the same defaults Jetty derives when it builds a task from a runbook)
cat > /tmp/build_runbook_task.py << 'BUILD_EOF'
import json, re, sys
import yaml

text = open(sys.argv[1], encoding="utf-8").read()
m = re.match(r"^---\s*\n(.*?)\n---\s*(\n|$)", text, re.S)
fm = (yaml.safe_load(m.group(1)) if m else None) or {}
fm = fm if isinstance(fm, dict) else {}

init = {
    "agent": fm.get("agent") or "claude-code",
    "model": fm.get("model") or "anthropic/claude-sonnet-4.6",
    "snapshot": fm.get("snapshot") or "python312-uv",
}
provider = fm.get("model_provider") or (None if fm.get("model") else "openrouter")
if provider:
    init["model_provider"] = provider
# MCP servers: the top-level block and code_checks.mcp_servers (the top level wins a clash), credentials dropped,
# because a definition is stored with the task; a server names a secrets: entry with `secret:` instead
cc = fm.get("code_checks") if isinstance(fm.get("code_checks"), dict) else {}
servers = {}
for block in (fm.get("mcp_servers"), cc.get("mcp_servers")):
    for name, definition in (block or {}).items() if isinstance(block, dict) else []:
        if name in servers or not isinstance(definition, dict):
            continue
        definition = dict(definition)
        for key in ("headers", "env"):
            if isinstance(definition.get(key), dict):
                kept = {k: v for k, v in definition[key].items()
                        if not re.search(r"auth|token|secret|password|api[-_]?key|cookie", str(k), re.I)}
                if kept:
                    definition[key] = kept
                else:
                    definition.pop(key)
        servers[name] = definition
if servers:
    init["mcp_servers"] = servers
if "code_checks" in fm:
    init["code_checks"] = {"sources": cc.get("sources") or [], "timeout_sec": cc.get("timeout_sec") or 120}
if isinstance(fm.get("strict_evaluation"), bool):
    init["strict_evaluation"] = fm["strict_evaluation"]
# The runbook evals version this runbook was written for. Jetty runs the Code Checks, appends the note naming who runs
# which check, and computes the verdict only on a run whose task carries it; without it the run is read as v1
init.update({"runbook_evals_version": 2, "vars": {}, "file_paths": []})

run = {
    "activity": "runbook",
    "agent_path": "init_params.agent",
    "model_path": "init_params.model",
    "snapshot_path": "init_params.snapshot",
    "instruction_path": "init_params.instruction",
    "template_variables_path": "init_params.vars",
    "files_path": "init_params.file_paths",
    "mcp_servers_path": "init_params.mcp_servers",
    "code_checks_path": "init_params.code_checks",
    "strict_evaluation_path": "init_params.strict_evaluation",
    "cpus": 4,
    "memory": "8G",
    "timeout_sec": 1200,
    "network_enabled": True,
}
if "model_provider" in init:
    run["model_provider_path"] = "init_params.model_provider"
print(json.dumps({"init_params": init, "steps": ["run"], "step_configs": {"run": run}}))
BUILD_EOF
if python3 -c 'import yaml' 2>/dev/null; then PY=python3; else PY="uv run --quiet --no-project --with pyyaml python3"; fi
WORKFLOW=$($PY /tmp/build_runbook_task.py "$RUNBOOK") || { echo "Could not read the frontmatter of $RUNBOOK"; exit 1; }

# Try update first
HTTP=$(curl -s -o /tmp/task_resp.json -w "%{http_code}" -X PUT \
  "https://flows-api.jetty.io/api/v1/tasks/$COLLECTION/$TASK_NAME" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(python3 -c 'import json, sys; print(json.dumps({"workflow": json.loads(sys.argv[1]), "has_file_uploads": True, "is_chat_flow": True}))' "$WORKFLOW")")

if [ "$HTTP" = "404" ]; then
  curl -s -X POST "https://flows-api.jetty.io/api/v1/tasks/$COLLECTION" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(python3 -c 'import json, sys; print(json.dumps({
      "name": sys.argv[1],
      "workflow": json.loads(sys.argv[2]),
      "description": "Runbook task (pre-registered with file uploads enabled)",
      "has_file_uploads": True,
      "is_chat_flow": True,
      "is_private": True,
      "entity_type": "task"
    }))' "$TASK_NAME" "$WORKFLOW")"
fi
```

When the user later changes `code_checks`, `strict_evaluation`, `mcp_servers`, `snapshot` or the agent/model in the frontmatter, re-run this block: a run reads those from the task, not from the runbook.

Tell the user (one line):
> "Pre-registered task `{collection}/{task_name}` with file uploads enabled — you can attach files when triggering runs from the web app or via the API."

If pre-registration fails (network, auth, etc.), don't block — log a warning and tell the user the task will auto-register on first run; they can manually flip `has_file_uploads` later via `PUT /api/v1/tasks/{collection}/{task_name}` or in the web app.

Save `TASK_NAME` and `COLLECTION` for use in Step 7.

---

## Step 6: Deploy to Jetty (skip the dry run)

**Don't gate the runbook behind a dry run — go straight to deploying it on Jetty (Step 7).** The fastest way to learn what a runbook actually does is to run it for real on the encouraged config (`claude-code` + `anthropic/claude-sonnet-4.6` + `model_provider: openrouter`). A live run surfaces the real failure modes, dependencies, and gotchas — exactly what Steps 4d/4i/4j want filled in afterward — which a hypothetical walkthrough can only guess at. Encourage the user to trigger the first run and watch the trajectory at https://jetty.io.

Only produce a dry run if the user explicitly asks for one ("walk me through it first", "dry run before we deploy"). If they do, read the completed runbook with the Read tool and produce a walkthrough:

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
> Use the chat-completions endpoint with a `jetty` block — this is the single API call that configures *everything*: which agent runs it, which collection it belongs to, and what files to upload into the sandbox. The frontmatter you scaffolded already encodes the encouraged config — Claude Code on `anthropic/claude-sonnet-4.6` via OpenRouter — so this call runs it as-is.
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
>       "file_paths": ["{your-collection}/_sandbox_uploads/<id>/my-input.csv"]
>     }
>   }'
> ```
>
> **Attaching files at run time:** This task was pre-registered with `has_file_uploads=true`, so the Jetty web app shows a file-upload control on the task page. Files dropped there are stored and their storage paths are passed to the runbook in `init_params.file_paths`. From the API you have two paired flows: (a) upload via `POST /api/v1/sandbox/upload` (multipart, form field `files`) and pass the returned **storage paths** in `jetty.file_paths` — these mount under `/app/assets/`; or (b) upload via `POST /api/v1/files` and pass the returned `file-…` ids in `jetty.files`. ⚠️ Don't cross them: a `file-…` id placed in `jetty.file_paths` is **silently dropped** (it's read as a raw storage key), so `init_params.file_paths` arrives empty and the file never reaches the sandbox. There is no `/api/v1/files/upload` endpoint.
>
> The `jetty` block fields map directly to your runbook's frontmatter:
> | Frontmatter field | `jetty` block field | Purpose |
> |---|---|---|
> | `agent` | `jetty.agent` | Which agent CLI runs the runbook (`claude-code`, `opencode`, `codex`, `gemini-cli`) |
> | `model` | `model` (top-level) | Which LLM the agent uses (e.g. `anthropic/claude-sonnet-4.6` for claude-code on OpenRouter, or `claude-sonnet-4-6` for claude-code via Anthropic) |
> | `model_provider` | `jetty.model_provider` | How the model id is routed: `anthropic`, `openrouter`, `openai`, `google`, `bedrock` |
> | `snapshot` | `jetty.snapshot` | Sandbox environment: `python312-uv` or `prism-playwright` |
> | parameters | `jetty.template_variables` | Key-value pairs for `{{var}}` substitution in the runbook |
> | — | `jetty.collection` | Namespace that holds your env vars and secrets |
> | — | `jetty.task` | Task name for grouping trajectories |
> | — | `jetty.file_paths` | Storage paths (from `POST /api/v1/sandbox/upload`) to mount under `/app/assets/`; **not** OpenAI `file-…` ids — those go in `jetty.files` |
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
> Run `/create-runbook` again on an existing RUNBOOK.md to re-validate it, or run the validation script from Step 5 manually. A runbook written before Code Checks existed keeps running as is; re-validating it offers the migration in Step 5.

---

## Important Notes

- **Always keep `validation_report.json` in the output manifest.** This is the standardized machine-readable results filename across all Jetty runbooks. Never use `scores.json`, `results.json`, or other variants.
- **Declare `primary_outputs` in the frontmatter.** List the headline deliverable(s) relative to `results_dir`, most important first. This is how the web app picks which file to surface as the "Main output" when a run finishes; without it, the choice falls back to arbitrary filesystem walk order. Keep the first entry aligned with the first row of the REQUIRED OUTPUT FILES table, and never list `summary.md` or `validation_report.json` here.
- **The `{{results_dir}}` parameter** defaults to `/app/results` when running on Jetty and `./results` when running locally.
- **Bound iteration.** Every iteration loop must specify a maximum round count (typically 3). Without bounds, the agent may loop indefinitely.
- **Use imperative language** in the output manifest, Code Checks and Checklist. Agents tend to wrap up early when they encounter errors — strong language like "Do NOT finish until all items pass" overrides this.
- **Don't over-specify intermediate steps.** The agent should have room to adapt. Specify *what* each step must produce, not every line of code.
- **Don't mix evaluation patterns.** Programmatic validation for structured output, rubric scoring for creative output. Don't rubric-score a JSON file or schema-validate a social graphic.
