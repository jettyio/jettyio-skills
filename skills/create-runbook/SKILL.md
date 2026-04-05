---
name: create-runbook
description: "Create a new runbook with guided assistance. A runbook is a structured markdown document that tells a coding agent how to accomplish a complex, multi-step task with evaluation loops and quality gates. Use this skill whenever the user wants to create, build, scaffold, or write a runbook — including 'create runbook', 'new runbook', 'build a runbook', 'make a runbook', 'runbook wizard', 'help me write a runbook', 'I need a runbook for...', 'automate this task with a runbook', or 'turn this into a runbook'. Also trigger when the user describes a multi-step agent task that would benefit from structured evaluation and iteration loops, even if they don't use the word 'runbook' — for example, 'I want to build an automated pipeline that evaluates its own output' or 'create a repeatable process with quality gates'."
argument-hint: [optional task description]
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, AskUserQuestion
---

# Runbook Creation Wizard

You are guiding a user through creating their first runbook. A runbook is a structured markdown document that tells a coding agent (Claude Code, Cursor, Codex, etc.) how to accomplish a complex, multi-step task end-to-end — with built-in evaluation loops, iteration, and quality gates.

Follow these steps IN ORDER. Be friendly and concise. At each decision point, use AskUserQuestion to let the user choose.

## Cross-Agent Compatibility

This skill uses `AskUserQuestion` for interactive choices. If you are running in an environment where `AskUserQuestion` is not available (e.g., Codex CLI, Gemini CLI, Cursor), replace each AskUserQuestion call with a direct question to the user in your text output. Ask the user to reply with their choice. The wizard flow is the same — only the interaction mechanism differs.

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

Use AskUserQuestion:
- Header: "Evaluation"
- Question: "How will you know when the output is good enough?"
- Options:
  - "Programmatic checks" / "I can validate with code, a schema, tests, or an API (objective pass/fail)"
  - "Quality rubric" / "I need to score against multiple criteria (subjective quality on a 1-5 scale)"
  - "Help me decide" / "Not sure which fits my task"

**If "Help me decide"**, explain:

> **Programmatic** is right when:
> - Your output is structured data (JSON, CSV, SQL)
> - You can validate with a schema, test suite, or API call
> - Pass/fail is objective — it either works or it doesn't
> - *Examples: schema validation, SQL execution, test suites, API response checks*
>
> **Rubric** is right when:
> - Your output is creative or complex (text, images, reports, designs)
> - Quality is subjective across multiple dimensions
> - You need a numeric score to track improvement
> - *Examples: content quality, brand compliance, UX evaluation, report comprehensiveness*

Then re-ask (same question, minus "Help me decide").

Save the chosen evaluation pattern: `programmatic` or `rubric`.

### 2c: File Location

Use AskUserQuestion:
- Header: "Location"
- Question: "Where should I create the RUNBOOK.md file?"
- Options:
  - "Here" / "Create ./RUNBOOK.md in the current directory"
  - "Custom path" / "Let me specify where to put it" (user types a path)

Save the target file path.

### 2d: Agent Runtime & Snapshot

Use AskUserQuestion:
- Header: "Agent Runtime"
- Question: "Which agent will run this runbook on Jetty?"
- Options:
  - "Claude Code (Anthropic)" / "Uses claude-sonnet-4-6 — strong at reasoning and tool use. Requires an Anthropic API key."
  - "Codex (OpenAI)" / "Uses gpt-5.4 — strong at code generation. Requires an OpenAI API key."
  - "Gemini CLI (Google)" / "Uses gemini-3.1-pro-preview — free tier available. Requires a Google AI API key."

Save the agent and model choice. The mapping is:
- Claude Code → agent: `claude-code`, model: `claude-sonnet-4-6`
- Codex → agent: `codex`, model: `gpt-5.4`
- Gemini CLI → agent: `gemini-cli`, model: `gemini-3.1-pro-preview`

Then ask about the sandbox:

Use AskUserQuestion:
- Header: "Sandbox"
- Question: "Will your runbook need a web browser (Playwright)?\nExamples: taking screenshots, web scraping, OAuth flows, testing web UIs"
- Options:
  - "Yes, I need a browser" / "Use prism-playwright snapshot (Python 3.12, uv, Playwright + Chromium pre-installed)"
  - "No browser needed" / "Use python312-uv snapshot (lighter, faster startup)"

Save the snapshot choice. These values will be written into the runbook frontmatter in Step 3.

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
5. **Agent/model/snapshot**: Write the choices from Step 2d into the frontmatter fields
5. **Steps 2-3**: Rename and briefly describe the processing steps based on the task

Leave `{TODO: ...}` markers, `{How to fix it}`, and similar placeholders in sections that require detailed domain input from the user (evaluation criteria, common fixes, tips, dependencies).

Write the customized runbook to the path chosen in Step 2c using the Write tool.

Tell the user:

> "I've created a runbook scaffold at `{path}`. It has the full structure with your task details filled in and placeholder markers where I need your input. Let's walk through each section."

---

## Step 4: Customize Sections

Walk through each section that needs user input. For each, show the user what's currently in the runbook and ask for their refinement. Use the Edit tool to apply changes.

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

Use AskUserQuestion:
- Header: "Common Fixes"
- Question: "Do you know the typical failure modes for this task? If so, describe them and I'll build a fix table. If not, you can fill this in after your first few runs."
- Options:
  - "I know some" / "Let me describe common issues" (user types)
  - "Skip for now" / "I'll fill this in after running the runbook"

If they provide issues, populate the Common Fixes table via Edit. If skipped, leave the placeholder rows.

### 4i: Tips (optional)

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

Replace `THE_RUNBOOK_PATH` with the actual path from Step 2c.

**If there are errors**, tell the user what needs to be fixed and guide them through the fixes using Edit. Re-run validation after fixes.

**If valid**, tell the user:

> "Your runbook passes structural validation! {N warnings if any — mention them briefly.}"

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
> **Deploy as a Jetty task:**
> `/jetty create task` — paste the runbook content as the task's agent instructions, and set parameters via `init_params`
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
