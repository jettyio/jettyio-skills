---
version: "1.0.0"
evaluation: rubric
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

{Describe the end-to-end task in 2-5 sentences. What is the input? What creative or complex output does it produce? What quality bar must it meet?}

---

## REQUIRED OUTPUT FILES (MANDATORY)

**You MUST write all of the following files to `{{results_dir}}`.
The task is NOT complete until every file exists and is non-empty. No exceptions.**

| File | Description |
|------|-------------|
| `{{results_dir}}/{primary_output}` | {The main deliverable — describe format and contents} |
| `{{results_dir}}/summary.md` | Executive summary with scores, feedback, and recommendations |
| `{{results_dir}}/validation_report.json` | Structured validation results with rubric scores and overall_passed |

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

## Step 7: Write Validation Report

Write `{{results_dir}}/validation_report.json`:

```json
{
  "version": "1.0.0",
  "run_date": "2026-01-01T00:00:00Z",
  "parameters": {
    "prompt": "...",
    "param_1": "value"
  },
  "stages": [
    { "name": "setup", "passed": true, "message": "Environment ready" },
    { "name": "input_parsing", "passed": true, "message": "Input parsed successfully" },
    { "name": "generation", "passed": true, "message": "Output generated" },
    { "name": "evaluation", "passed": true, "message": "Rubric score: X.X/5" },
    { "name": "report_generation", "passed": true, "message": "All output files written" }
  ],
  "rubric_scores": {
    "criterion_1": { "score": 5, "notes": "..." },
    "criterion_2": { "score": 4, "notes": "..." },
    "criterion_3": { "score": 4, "notes": "..." },
    "criterion_4": { "score": 5, "notes": "..." },
    "criterion_5": { "score": 4, "notes": "..." }
  },
  "overall_score": 4.4,
  "pass_threshold": 4.0,
  "iterations": 1,
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

- [ ] `{primary_output}` exists and meets quality bar (rubric >= 4.0, no criterion below 3)
- [ ] `summary.md` exists with rubric scores and iteration history
- [ ] `validation_report.json` exists with `rubric_scores`, `overall_score`, and `overall_passed`
- [ ] Verification script printed PASS for all files

**If ANY item fails, go back and fix it. Do NOT finish until all items pass.**

---

## Tips

- {Domain-specific gotcha or quality insight}
- {Common mistake and how to avoid it}
- {Guidance on subjective criteria interpretation}
