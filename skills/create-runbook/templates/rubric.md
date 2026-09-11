---
version: "1.0.0"
evaluation: rubric
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

**Pass threshold: overall average >= 4.0, no individual criterion below 3.**

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

Deterministic scripts run against `{{results_dir}}` after the steps finish. One `### <id> — <name>` heading per check, followed by exactly one fenced command; exit code 0 means pass. **A failing code check fails the run's verdict.**

### outputs-exist — Every required output file exists and is non-empty

```bash
RESULTS_DIR="{{results_dir}}"
for f in "$RESULTS_DIR/{primary_output}" "$RESULTS_DIR/summary.md" "$RESULTS_DIR/validation_report.json"; do
  if [ ! -s "$f" ]; then echo "FAIL: $f is missing or empty"; exit 1; fi
  echo "PASS: $f ($(wc -c < "$f") bytes)"
done
```

### {check_id} — {What it verifies, in one sentence}

```bash
{command that exits non-zero on failure, e.g. python /app/checks/check_format.py {{results_dir}}/{primary_output}}
```

---

## Checklist

Observable conditions you confirm by inspection after the code checks. Record each as `pass` or `fail` in the validation report. **A failed item fails the run's verdict.**

- [ ] `{primary_output}` meets the quality bar (rubric >= 4.0, no criterion below 3)
- [ ] `summary.md` has rubric scores and the iteration history
- [ ] No placeholder text (`{...}`, `TODO`) remains in any output

---

## Write Validation Report

Write `{{results_dir}}/validation_report.json` last. One entry in `checks` per step (`kind: step`), per Code Check (`kind: code_check`, `id` = the heading id), per Checklist item (`kind: checklist`, `id` = the slugified item text) and per rubric criterion (`kind: judge`). Report every check you ran, including the ones that still fail — Jetty computes the verdict from `checks`; the `verdict` you write is a hint.

```json
{
  "version": "2.0.0",
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
      "message": "Processed N items"
    },
    {
      "kind": "code_check",
      "id": "outputs-exist",
      "name": "Every required output file exists and is non-empty",
      "status": "pass",
      "message": "3 files present",
      "details": {
        "command": "bash /app/checks/outputs_exist.sh {{results_dir}}",
        "exit_code": 0,
        "stdout_tail": "PASS: 3 files\n",
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
      "id": "summary-has-required-sections",
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
      "threshold": 4,
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
      "message": "Processed N items"
    }
  ],
  "results": {
    "pass": 0,
    "partial": 0,
    "fail": 0
  },
  "rubric_scores": {
    "clarity": {
      "score": 4,
      "notes": "Clear and well organised"
    }
  }
}
```

`kind` is one of `step | code_check | checklist | judge`; `status` is one of `pass | fail | skipped | error`. One `judge` entry per rubric criterion, with `score`, `max_score` and `threshold` (= `pass_threshold`). `stages`, `results` and `rubric_scores` mirror the checks for older readers; keep them in sync.

**If a code check or checklist item fails, go back and fix the output (within the iteration cap), re-run the checks, then rewrite the report. Do NOT finish before the report is written.**

---

## Tips

- {Domain-specific gotcha or quality insight}
- {Common mistake and how to avoid it}
- {Guidance on subjective criteria interpretation}
