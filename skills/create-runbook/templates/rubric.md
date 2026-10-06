---
version: "1.0.0"
evaluation: rubric
strict_evaluation: false              # true: an agent check the agent did not report is recorded as error (fails the run) instead of skipped
agent: claude-code                    # Agent runtime: claude-code | opencode | codex | gemini-cli
model: anthropic/claude-sonnet-4.6   # Model for the agent (see agents-and-models reference)
model_provider: openrouter           # Routes the model through OpenRouter (requires OPENROUTER_API_KEY)
snapshot: python312-uv                # Sandbox: python312-uv | prism-playwright | custom image
# Headline deliverable(s), relative to results_dir, in priority order. spot
# surfaces the first of these as the "Main output" when a run completes; if
# omitted it falls back to the first file written.
primary_outputs:
  - "{primary_output}"
secrets:                              # Optional — declare sensitive params here (names only, never values)
  # EXAMPLE_API_KEY:
  #   env: EXAMPLE_API_KEY            # Collection env var name on Jetty / OS env var locally
  #   description: "API key for ..."
  #   required: true
  #   expose_to_agent: false          # optional — withhold from the agent's environment (default: forwarded, unless a source or MCP server consumes it)
  #   expose_to_checks: true          # optional — give a withheld secret to the code checks Jetty runs
code_checks:                          # Optional — how the Code Checks run and what they need (a task default a run may override)
  # timeout_sec: 120                  # per check, max 900
  # sources:                          # cloned to {{checks_dir}}/<name> (/app/checks/<name>) after the agent exits; also before it, when a check the agent runs refers to them
  #   - name: checks
  #     type: git
  #     url: https://github.com/acme/output-checks
  #     ref: main                     # branch, tag or commit SHA
  #     secret: GITHUB_TOKEN          # must also be declared under secrets:; consumed by Jetty, withheld from the agent
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

One `### <id> — <name>` heading per check (id: letters, digits, `.`, `_`, `-`), followed by exactly one fenced block. The fence's language is the check's kind:

- **Command check**, `bash` fence: a shell command run with `bash -e -o pipefail` (every line must succeed; exit 0 is pass, any other exit fails) with `RESULTS_DIR`, `CHECKS_DIR` and `ASSETS_DIR` in its environment and `{{results_dir}}`, `{{checks_dir}}`, `{{assets_dir}}` substituted. Parameters from the Parameters table are substituted into a check at run time exactly as they are elsewhere in the runbook, so reference a parameter rather than hardcoding its value. A `yaml` fence instead names a built-in: `use:` one of `file_exists`, `min_size`, `json_valid`, `regex_present`, `regex_absent`, `markdown_relative_links_resolve`, with paths relative to the results directory.
- **Agent check**, `agent` fence: an instruction only you can carry out (one that needs an MCP server or your live state): what to do, with which tools, and what passing means.

**Who runs a check is declared on its fence.** A command check is Jetty's unless its fence says otherwise: on Jetty, Jetty runs it itself after you finish, in this sandbox; you do not run it and you write no report entry for it. A command check whose fence reads ` ```bash executor=agent ` is yours to run and report, because it tests state only your live session has (a server a step started, which is gone by the time Jetty's checks run). An `agent` fence is always yours; `executor=jetty` on one, or any other value, is an error Jetty records. A note appended to this runbook at run time names the ids you run and the ids Jetty runs; follow it. **Without such a note, whether you are running locally or on a Jetty run that appended none, run every check yourself and record each as `kind: code_check`.** Scripts a check needs come from `code_checks.sources` in the frontmatter, cloned to `{{checks_dir}}/<name>` (before you start as well, when a check you run refers to them). **A failing check fails the run's verdict.**

Keep `outputs-exist`; its file list must match the REQUIRED OUTPUT FILES table minus `validation_report.json`, which is written after the steps. {TODO: add 1-3 checks specific to {primary_output} after outputs-exist, e.g. a yaml fence with `use: regex_present`, `glob: {primary_output}` and the pattern a valid output must contain, or a bash fence running `python {{checks_dir}}/checks/check_format.py {{results_dir}}/{primary_output}` from a declared source. Delete this line when done.}

### outputs-exist — Every required output file exists and is non-empty

```bash
test -s {{results_dir}}/{primary_output} && test -s {{results_dir}}/summary.md
```

---

## Checklist

Observable conditions you confirm by inspection before writing the report. Placeholder text means `{...}` or `TODO` left in any output file. Record each item in the validation report as `kind: checklist`. The per-criterion floor of 3 is enforced by the `judge` entries; the first item below enforces the average. **A failed item fails the run's verdict.**

- [ ] Overall rubric average is at least 4.0
- [ ] summary.md has the rubric scores and the iteration history
- [ ] No placeholder text remains

---

## Write Validation Report

Write `{{results_dir}}/validation_report.json` **last**. One entry in `checks` per step (`kind: step`), per Checklist item (`kind: checklist`), per agent check you ran (`kind: code_check`, `id` exactly as its heading) and per rubric criterion (`kind: judge`, `id` = the slugified criterion name, `score` 1-5, `max_score: 5`, `threshold: 3`). Write no entries for the command checks Jetty runs: Jetty appends those after you finish (each with `details.runner: "jetty"`), drops any `code_check` entry whose id it does not expect, and computes the verdict from the merged `checks`; the `verdict` you write is a hint. Report every check you ran, including the ones that still fail.

A checklist `id` is the item text lower-cased with every run of non-alphanumeric characters replaced by `-` and leading or trailing `-` trimmed (`Overall rubric average is at least 4.0` → `overall-rubric-average-is-at-least-4-0`); `name` is the item text verbatim.

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
      "kind": "checklist",
      "id": "overall-rubric-average-is-at-least-4-0",
      "name": "Overall rubric average is at least 4.0",
      "status": "pass"
    },
    {
      "kind": "checklist",
      "id": "summary-md-has-the-rubric-scores-and-the-iteration-history",
      "name": "summary.md has the rubric scores and the iteration history",
      "status": "fail",
      "message": "Iteration history missing"
    },
    {
      "kind": "checklist",
      "id": "no-placeholder-text-remains",
      "name": "No placeholder text remains",
      "status": "pass"
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

### Report fields

`version` is the integer `2`. `kind` is one of `step | code_check | checklist | judge`; `status` is one of `pass | fail | skipped | error`. A `judge` entry fails when `score < threshold`; `overall_score` is the average of the judge scores and `pass_threshold` is `4.0`. An agent check you ran is one entry, `{"kind": "code_check", "id": "<heading id>", "name": "<heading name>", "status": "pass|fail", "message": "<one line>"}`; an agent check you did not report is recorded by Jetty as `skipped`, or as `error` (failing the run) when `strict_evaluation` is on. When you ran a command check yourself (locally, or one marked `executor=agent`), record it the same way with `details.command`, `details.exit_code` and `details.stdout_tail`. `stages`, `results` and `rubric_scores` are v1 mirrors kept for the existing report panel: derive `stages` from the `step` entries and `rubric_scores` from the `judge` entries; `results` is the Step 4 status tally in a programmatic runbook and stays at zeros here. Never edit a mirror separately from `checks`.

**If a checklist item, a judge or a check you ran fails, go back and fix the output (within the iteration cap), re-check, then rewrite the report. Do NOT finish before the report is written.**

---

## Tips

- {Domain-specific gotcha or quality insight}
- {Common mistake and how to avoid it}
- {Guidance on subjective criteria interpretation}
