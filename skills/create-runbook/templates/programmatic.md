---
version: "1.0.0"
evaluation: programmatic
agent: claude-code                    # Agent runtime: claude-code | codex | gemini-cli
model: claude-sonnet-4-6             # Model for the agent (see agents-and-models reference)
snapshot: python312-uv                # Sandbox: python312-uv | prism-playwright | custom image
secrets:                              # Optional — declare sensitive params here
  # EXAMPLE_API_KEY:
  #   env: EXAMPLE_API_KEY            # Collection env var name on Jetty / OS env var locally
  #   description: "API key for ..."
  #   required: true
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
| `{{results_dir}}/validation_report.json` | Structured validation results with stages, results, and overall_passed |

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

## Step 7: Write Validation Report

Write `{{results_dir}}/validation_report.json`:

```json
{
  "version": "1.0.0",
  "run_date": "2026-01-01T00:00:00Z",
  "parameters": {
    "param_1": "value",
    "param_2": "value"
  },
  "stages": [
    { "name": "setup", "passed": true, "message": "Environment ready" },
    { "name": "data_collection", "passed": true, "message": "Collected N items" },
    { "name": "processing", "passed": true, "message": "Processed N items" },
    { "name": "evaluation", "passed": true, "message": "All items evaluated" },
    { "name": "report_generation", "passed": true, "message": "All output files written" }
  ],
  "results": {
    "pass": 0,
    "partial": 0,
    "fail": 0
  },
  "overall_passed": true,
  "output_files": [
    "{{results_dir}}/{primary_output}",
    "{{results_dir}}/summary.md",
    "{{results_dir}}/validation_report.json"
  ]
}
```

---

## Step 8: Final Checklist (MANDATORY — do not skip)

### Verification Script

```bash
echo "=== FINAL OUTPUT VERIFICATION ==="
RESULTS_DIR="{{results_dir}}"
for f in "$RESULTS_DIR/{primary_output}" "$RESULTS_DIR/summary.md" "$RESULTS_DIR/validation_report.json"; do
  if [ ! -s "$f" ]; then
    echo "FAIL: $f is missing or empty"
  else
    echo "PASS: $f ($(wc -c < "$f") bytes)"
  fi
done
```

### Checklist

- [ ] `{primary_output}` exists and meets structural requirements
- [ ] `summary.md` exists and follows the template from Step 6
- [ ] `validation_report.json` exists with `stages`, `results`, and `overall_passed`
- [ ] Verification script printed PASS for all files

**If ANY item fails, go back and fix it. Do NOT finish until all items pass.**

---

## Tips

- {Domain-specific gotcha or API quirk}
- {Common mistake and how to avoid it}
- {Performance or rate-limiting guidance}
