---
version: "1.0.0"
evaluation: rubric
strict_evaluation: false              # true: a declared Code Check or Checklist item the agent did not report counts as failed, not skipped
agent: claude-code                    # Agent runtime: claude-code | opencode | codex | gemini-cli
model: anthropic/claude-sonnet-4.6   # Model for the agent (see agents-and-models reference)
model_provider: openrouter           # Routes the model through OpenRouter (requires OPENROUTER_API_KEY)
snapshot: python312-uv                # Sandbox: python312-uv | prism-playwright | custom image
# Headline deliverable(s), relative to results_dir, in priority order. spot
# surfaces the first of these as the "Main output" when a run completes; if
# omitted it falls back to the first file written.
primary_outputs:
  - "{primary_output}"
secrets:                              # Optional — declare sensitive params here
  # EXAMPLE_API_KEY:
  #   env: EXAMPLE_API_KEY            # Collection env var name on Jetty / OS env var locally
  #   description: "API key for ..."
  #   required: true
code_checks:                          # Optional — resources the Code Checks section needs
  # sources:                          # cloned to /app/checks/<name> before the agent starts
  #   - name: checks
  #     type: git
  #     url: https://github.com/acme/output-checks
  #     ref: main
  #     secret: GITHUB_TOKEN          # must also be declared under secrets:
  # mcp_servers: {}                   # merged into the run's MCP servers
  # references: []                    # URLs the agent may read while checking
---

# {Task Name} — Agent Runbook

## Objective

{Describe the end-to-end task in 2-5 sentences. What is the input? What creative or complex output does it produce? What quality bar must it meet?}

---

## REQUIRED OUTPUT FILES (MANDATORY)

**You MUST write all of the following files to `{{results_dir}}`.
The task is NOT complete until every file exists and is non-empty. No exceptions.**

| File | Description |
|------|-------------|
| `{{results_dir}}/{primary_output}` | {The main deliverable — describe format and contents} |
| `{{results_dir}}/summary.md` | Executive summary with scores, feedback, and recommendations |
| `{{results_dir}}/validation_report.json` | Evaluation report v2: every step, code check, checklist item and judge as a typed `checks[]` entry |

If you finish your work but have not written all files, go back and write them before stopping.

---

## Parameters

| Parameter | Template Variable | Default | Description |
|-----------|------------------|---------|-------------|
| Results directory | `{{results_dir}}` | `/app/results` (Jetty) / `./results` (local) | Output directory for all results |
| {Input content} | `{{prompt}}` | — | {The source material or instructions to work from} |
| {Parameter 1} | `{{param_1}}` | {default} | {What this controls} |

---

## Dependencies

| Dependency | Type | Required | Description |
|------------|------|----------|-------------|
| {dependency} | {Jetty workflow / External API / Credential / Python package} | Yes | {What it does or provides} |

---

## Step 1: Environment Setup

```bash
# Install dependencies
pip install {packages}

# Create output directories
mkdir -p {{results_dir}}

# Verify required secrets are available (declared in frontmatter)
# for var in SECRET_NAME_1 SECRET_NAME_2; do
#   if [ -z "${!var}" ]; then
#     echo "ERROR: $var is not set"
#     exit 1
#   fi
# done
```

Verify all required inputs and assets are available before proceeding.

---

## Step 2: {Parse Input / Prepare Content}

{Describe how to interpret the input and prepare for generation.}

Extract from `{{prompt}}`:
- {Component 1}
- {Component 2}
- {Component 3}

---

## Step 3: {Generate / Create Output}

{Describe the core creative or generative step.}

Requirements:
- {Requirement 1}
- {Requirement 2}
- {Requirement 3}

Save the output to `{{results_dir}}/{primary_output}`.

---

## Step 4: Evaluate Against Rubric

Score the output against each criterion on a 1-5 scale:

### Rubric

| # | Criterion | 5 (Excellent) | 3 (Acceptable) | 1 (Poor) |
|---|-----------|---------------|-----------------|----------|
| 1 | {Criterion 1} | {What excellent looks like} | {What acceptable looks like} | {What poor looks like} |
| 2 | {Criterion 2} | {What excellent looks like} | {What acceptable looks like} | {What poor looks like} |
| 3 | {Criterion 3} | {What excellent looks like} | {What acceptable looks like} | {What poor looks like} |
| 4 | {Criterion 4} | {What excellent looks like} | {What acceptable looks like} | {What poor looks like} |
| 5 | {Criterion 5} | {What excellent looks like} | {What acceptable looks like} | {What poor looks like} |

**Pass threshold: overall average >= 4.0, no individual criterion below 3.** Each criterion becomes a `judge` entry in the validation report with `threshold: 3`; the average is checked by the first Checklist item.

Record your scores and reasoning for each criterion.

---

## Step 5: Iterate on Weak Criteria (max 3 rounds)

If the rubric score is below the pass threshold:

1. Identify the **lowest-scoring criteria** (below 3 first, then below 4)
2. Consult the Common Fixes table below for targeted improvements
3. Make focused edits — change only what addresses the weak criteria
4. Re-score with Step 4 rubric
5. Repeat up to 3 times total

After 3 rounds, keep the best-scoring version and note remaining weaknesses in the summary.

### Common Fixes

| Weak Criterion | Common Issue | Fix |
|----------------|-------------|-----|
| {Criterion 1} | {Typical problem} | {Specific action to improve} |
| {Criterion 2} | {Typical problem} | {Specific action to improve} |
| {Criterion 3} | {Typical problem} | {Specific action to improve} |
| {Criterion 4} | {Typical problem} | {Specific action to improve} |
| {Criterion 5} | {Typical problem} | {Specific action to improve} |

---

## Step 6: Write Executive Summary

Write `{{results_dir}}/summary.md` with the following structure:

```markdown
# {Task Name} — Results

## Overview
- **Date**: {run date}
- **Input**: {brief description of input}
- **Iterations**: {how many rounds of refinement}

## Rubric Scores

| # | Criterion | Score | Notes |
|---|-----------|-------|-------|
| 1 | {Criterion 1} | X/5 | {Brief justification} |
| 2 | {Criterion 2} | X/5 | {Brief justification} |
| 3 | {Criterion 3} | X/5 | {Brief justification} |
| 4 | {Criterion 4} | X/5 | {Brief justification} |
| 5 | {Criterion 5} | X/5 | {Brief justification} |
| | **Overall** | **X.X/5** | |

## Output Description
{2-3 sentences describing the final output}

## Iteration History
{What changed in each round and why}

## Recommendations
- {What could be improved with more iteration}
- {Upstream changes that would improve quality}

## Limitations
- {What the rubric does not capture}
- {Subjective aspects that may need human review}
```

---

## Code Checks

Deterministic commands run against `{{results_dir}}` after Step 6 and before the Checklist. One `### <id> — <name>` heading per check, followed by exactly one fenced command; exit code 0 means pass. Every check runs exactly as written and is recorded in the validation report. **A failing code check fails the run's verdict.**

Keep `outputs-exist`; its file list must match the REQUIRED OUTPUT FILES table minus `validation_report.json`, which is written after the checks run. {TODO: add 1-3 checks specific to {primary_output} after outputs-exist, one `### <id> — <name>` heading and one fenced command each, e.g. `python /app/checks/check_format.py {{results_dir}}/{primary_output}` (scripts under /app/checks come from code_checks.sources in the frontmatter). Delete this line when done.}

### outputs-exist — Every required output file exists and is non-empty

```bash
test -s {{results_dir}}/{primary_output} && test -s {{results_dir}}/summary.md
```

---

## Checklist

Observable conditions you confirm by inspection after the code checks. Placeholder text means `{...}` or `TODO` left in any output file. Record each item in the validation report as `kind: checklist`. The per-criterion floor of 3 is enforced by the `judge` entries; the first item below enforces the average. **A failed item fails the run's verdict.**

- [ ] Overall rubric average is at least 4.0
- [ ] summary.md has the rubric scores and the iteration history
- [ ] No placeholder text remains

---

## Write Validation Report

Write `{{results_dir}}/validation_report.json` **last**; it is the one required file the code checks do not test. One entry in `checks` per step (`kind: step`), per Code Check (`kind: code_check`, `id` = the heading id, `details.command` = the command exactly as you ran it), per Checklist item (`kind: checklist`) and per rubric criterion (`kind: judge`, `id` = the slugified criterion name, `score` 1-5, `max_score: 5`, `threshold: 3`). Report every check you ran, including the ones that still fail: Jetty computes the verdict from `checks`, and the `verdict` you write is a hint.

A checklist `id` is the item text lower-cased with every run of non-alphanumeric characters replaced by `-` (`summary.md has the required sections` → `summary-md-has-the-required-sections`); `name` is the item text verbatim.

```json
{
  "version": 2,
  "run_date": "2026-01-01T00:00:00Z",
  "parameters": {
    "param_1": "value",
    "param_2": "value"
  },
  "verdict": "fail",
  "overall_passed": false,
  "iterations": 2,
  "checks": [
    {
      "kind": "step",
      "id": "setup",
      "name": "Environment Setup",
      "status": "pass",
      "message": "Environment ready"
    },
    {
      "kind": "step",
      "id": "processing",
      "name": "Processing",
      "status": "pass",
      "message": "Processed 12 items"
    },
    {
      "kind": "code_check",
      "id": "outputs-exist",
      "name": "Every required output file exists and is non-empty",
      "status": "pass",
      "message": "2 files present",
      "details": {
        "command": "test -s {{results_dir}}/{primary_output} && test -s {{results_dir}}/summary.md",
        "exit_code": 0,
        "stdout_tail": "",
        "duration_seconds": 0.1
      }
    },
    {
      "kind": "code_check",
      "id": "schema-valid",
      "name": "Output JSON validates against the declared schema",
      "status": "fail",
      "message": "2 errors",
      "details": {
        "command": "python /app/checks/validate_schema.py {{results_dir}}/{primary_output}",
        "exit_code": 1,
        "stdout_tail": "items[3].date: not a date\nitems[7].url: missing\n",
        "duration_seconds": 0.8
      }
    },
    {
      "kind": "checklist",
      "id": "no-placeholder-text-remains",
      "name": "No placeholder text remains",
      "status": "pass"
    },
    {
      "kind": "checklist",
      "id": "summary-md-has-the-required-sections",
      "name": "summary.md has the required sections",
      "status": "fail",
      "message": "Recommendations section missing"
    },
    {
      "kind": "judge",
      "id": "clarity",
      "name": "Clarity",
      "status": "pass",
      "score": 4,
      "max_score": 5,
      "threshold": 3,
      "message": "Clear and well organised"
    }
  ],
  "overall_score": 4.0,
  "pass_threshold": 4.0,
  "output_files": [
    "{{results_dir}}/{primary_output}",
    "{{results_dir}}/summary.md",
    "{{results_dir}}/validation_report.json"
  ],
  "stages": [
    {
      "name": "setup",
      "passed": true,
      "message": "Environment ready"
    },
    {
      "name": "processing",
      "passed": true,
      "message": "Processed 12 items"
    }
  ],
  "results": {
    "pass": 10,
    "partial": 1,
    "fail": 1
  },
  "rubric_scores": {
    "clarity": {
      "score": 4,
      "notes": "Clear and well organised"
    }
  }
}
```

`version` is the integer `2`. `kind` is one of `step | code_check | checklist | judge`; `status` is one of `pass | fail | skipped | error`. A `judge` entry fails when `score < threshold`; `overall_score` is the average of the judge scores and `pass_threshold` is `4.0`. `stages`, `results` and `rubric_scores` are v1 mirrors kept for the existing report panel: derive `stages` from the `step` entries and `rubric_scores` from the `judge` entries; `results` is the Step 4 status tally in a programmatic runbook and stays at zeros here. Never edit a mirror separately from `checks`.

**If a code check, checklist item or judge fails, go back and fix the output (within the iteration cap), re-run the checks, then rewrite the report. Do NOT finish before the report is written.**

---

## Tips

- {Domain-specific gotcha or quality insight}
- {Common mistake and how to avoid it}
- {Guidance on subjective criteria interpretation}
