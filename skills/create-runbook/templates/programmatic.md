---
version: "1.0.0"
evaluation: programmatic
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

{Describe the end-to-end task in 2-5 sentences. What is the input? What processing stages does it go through? What is the final output and who consumes it?}

---

## REQUIRED OUTPUT FILES (MANDATORY)

**You MUST write all of the following files to `{{results_dir}}`.
The task is NOT complete until every file exists and is non-empty. No exceptions.**

| File | Description |
|------|-------------|
| `{{results_dir}}/{primary_output}` | {The main deliverable — describe format and contents} |
| `{{results_dir}}/summary.md` | Executive summary with run metadata, results breakdown, and recommendations |
| `{{results_dir}}/validation_report.json` | Evaluation report v2: every step, code check, checklist item and judge as a typed `checks[]` entry |

If you finish your analysis but have not written all files, go back and write them before stopping.

---

## Parameters

| Parameter | Template Variable | Default | Description |
|-----------|------------------|---------|-------------|
| Results directory | `{{results_dir}}` | `/app/results` (Jetty) / `./results` (local) | Output directory for all results |
| {Parameter 1} | `{{param_1}}` | {default} | {What this controls} |
| {Parameter 2} | `{{param_2}}` | {default} | {What this controls} |

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

Verify all required credentials and inputs are available before proceeding.

---

## Step 2: {Data Collection / Input Processing}

{Describe what data to fetch or what input to process.}

### API Call

```bash
curl -s {API_ENDPOINT} \
  -H "Authorization: Bearer ${{secrets.API_TOKEN}}" \
  -H "Content-Type: application/json"
```

> **Note:** `{{secrets.*}}` values resolve to environment variables at runtime — collection env vars on Jetty, OS env vars locally. They are declared in the `secrets` frontmatter block and never appear in `init_params` or trajectories.

### Expected Response

```json
{
  "data": []
}
```

### Record

For each item, extract and store:
- {field 1}
- {field 2}
- {field 3}

---

## Step 3: {Core Processing}

{Describe the main transformation, generation, or analysis step.}

For each item from Step 2:
1. {Action}
2. {Action}
3. Record the result

---

## Step 4: Evaluate Outputs

For each output, assign an evaluation status:

| Status | Criteria |
|--------|----------|
| `PASS` | {What qualifies as success — be specific} |
| `PARTIAL` | {What qualifies as partial success} |
| `FAIL` | {What qualifies as failure} |

---

## Step 5: Iterate on Errors (max 3 rounds)

If any outputs received `FAIL` or `PARTIAL` status:

1. Read the specific error message or failure reason
2. Apply the targeted fix from the Common Fixes table below
3. Re-run the failed item through Step 3
4. Re-evaluate with Step 4 criteria
5. Repeat up to 3 times total

After 3 rounds, keep the best result and flag remaining failures in the summary.

### Common Fixes

| Issue | Fix |
|-------|-----|
| {Common failure 1} | {How to fix it} |
| {Common failure 2} | {How to fix it} |
| {Common failure 3} | {How to fix it} |

---

## Step 6: Write Executive Summary

Write `{{results_dir}}/summary.md` with the following structure:

```markdown
# {Task Name} — Results

## Overview
- **Date**: {run date}
- **Parameters**: {key parameter values}
- **Items processed**: {count}

## Results Summary

| Status | Count | % |
|--------|-------|---|
| PASS | ... | ... |
| PARTIAL | ... | ... |
| FAIL | ... | ... |

## Sample Outputs

### Successes
{2-3 representative successful outputs}

### Failures
{2-3 representative failures with root cause}

## Recommendations
- {What to fix or investigate}
- {Patterns observed}

## Limitations
- {What could not be evaluated}
- {Caveats}
```

---

## Code Checks

Deterministic commands run against `{{results_dir}}` after Step 6 and before the Checklist. One `### <id> — <name>` heading per check, followed by exactly one fenced command; exit code 0 means pass. Every check runs exactly as written and is recorded in the validation report. **A failing code check fails the run's verdict.**

Keep `outputs-exist`; its file list must match the REQUIRED OUTPUT FILES table minus `validation_report.json`, which is written after the checks run. {TODO: add 1-3 checks specific to {primary_output} after outputs-exist, one `### <id> — <name>` heading and one fenced command each, e.g. `python /app/checks/validate_schema.py {{results_dir}}/{primary_output}` (scripts under /app/checks come from code_checks.sources in the frontmatter). Delete this line when done.}

### outputs-exist — Every required output file exists and is non-empty

```bash
test -s {{results_dir}}/{primary_output} && test -s {{results_dir}}/summary.md
```

---

## Checklist

Observable conditions you confirm by inspection after the code checks. Placeholder text means `{...}` or `TODO` left in any output file. Record each item in the validation report as `kind: checklist`. **A failed item fails the run's verdict.**

- [ ] `{primary_output}` meets the format in the REQUIRED OUTPUT FILES table and the PASS criteria in Step 4
- [ ] summary.md has the required sections
- [ ] No placeholder text remains

---

## Write Validation Report

Write `{{results_dir}}/validation_report.json` **last**; it is the one required file the code checks do not test. One entry in `checks` per step (`kind: step`), per Code Check (`kind: code_check`, `id` = the heading id, `details.command` = the command exactly as you ran it), per Checklist item (`kind: checklist`) and, only when the runbook grades against a rubric, per criterion (`kind: judge`). Report every check you ran, including the ones that still fail: Jetty computes the verdict from `checks`, and the `verdict` you write is a hint.

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

`version` is the integer `2`. `kind` is one of `step | code_check | checklist | judge`; `status` is one of `pass | fail | skipped | error`. `stages`, `results` and `rubric_scores` are v1 mirrors kept for the existing report panel: derive `stages` from the `step` entries, `results` from the Step 4 status tally and `rubric_scores` from the `judge` entries (`{}` when there are none). Never edit a mirror separately from `checks`.

**If a code check or checklist item fails, go back and fix the output (within the iteration cap), re-run the checks, then rewrite the report. Do NOT finish before the report is written.**

---

## Tips

- {Domain-specific gotcha or API quirk}
- {Common mistake and how to avoid it}
- {Performance or rate-limiting guidance}
