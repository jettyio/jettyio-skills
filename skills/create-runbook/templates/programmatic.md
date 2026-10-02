---
version: "1.0.0"
evaluation: programmatic
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
  # executor: jetty                   # jetty (default): Jetty runs command checks after the agent exits | agent: the agent runs them too
  # timeout_sec: 120                  # per check, max 900
  # sources:                          # cloned to {{checks_dir}}/<name> (/app/checks/<name>) after the agent exits
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

One `### <id> — <name>` heading per check (id: letters, digits, `.`, `_`, `-`), followed by exactly one fenced block. The fence's language is the check's kind:

- **Command check**, `bash` fence: a shell command run with `bash -e -o pipefail` (every line must succeed; exit 0 is pass, any other exit fails) with `RESULTS_DIR`, `CHECKS_DIR` and `ASSETS_DIR` in its environment and `{{results_dir}}`, `{{checks_dir}}`, `{{assets_dir}}` substituted. A `yaml` fence instead names a built-in: `use:` one of `file_exists`, `min_size`, `json_valid`, `regex_present`, `regex_absent`, `markdown_relative_links_resolve`, with paths relative to the results directory.
- **Agent check**, `agent` fence: an instruction only you can carry out (one that needs an MCP server or your live state): what to do, with which tools, and what passing means.

**On Jetty, command checks are run by Jetty itself after you finish, in this sandbox; you do not run them and you write no report entries for them.** A note appended to this runbook at run time names the ids you run (agent checks) and the ids Jetty runs; follow it. Without such a note (running locally), run every check yourself and record each. Scripts a check needs come from `code_checks.sources` in the frontmatter, cloned to `{{checks_dir}}/<name>`. **A failing check fails the run's verdict.**

Keep `outputs-exist`; its file list must match the REQUIRED OUTPUT FILES table minus `validation_report.json`, which is written after the steps. {TODO: add 1-3 checks specific to {primary_output} after outputs-exist, e.g. a yaml fence with `use: json_valid` and `path: {primary_output}`, or a bash fence running `python {{checks_dir}}/checks/validate_schema.py {{results_dir}}/{primary_output}` from a declared source. Delete this line when done.}

### outputs-exist — Every required output file exists and is non-empty

```bash
test -s {{results_dir}}/{primary_output} && test -s {{results_dir}}/summary.md
```

---

## Checklist

Observable conditions you confirm by inspection before writing the report. Placeholder text means `{...}` or `TODO` left in any output file. Record each item in the validation report as `kind: checklist`. **A failed item fails the run's verdict.**

- [ ] `{primary_output}` meets the format in the REQUIRED OUTPUT FILES table and the PASS criteria in Step 4
- [ ] summary.md has the required sections
- [ ] No placeholder text remains

---

## Write Validation Report

Write `{{results_dir}}/validation_report.json` **last**. One entry in `checks` per step (`kind: step`), per Checklist item (`kind: checklist`), per agent check you ran (`kind: code_check`, `id` exactly as its heading) and, only when the runbook grades against a rubric, per criterion (`kind: judge`). Write no entries for the command checks Jetty runs: Jetty appends those after you finish (each with `details.runner: "jetty"`), drops any `code_check` entry whose id it does not expect, and computes the verdict from the merged `checks`; the `verdict` you write is a hint. Report every check you ran, including the ones that still fail.

A checklist `id` is the item text lower-cased with every run of non-alphanumeric characters replaced by `-` and leading or trailing `-` trimmed (`summary.md has the required sections` → `summary-md-has-the-required-sections`); `name` is the item text verbatim.

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
    }
  ],
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
  "rubric_scores": {}
}
```

`version` is the integer `2`. `kind` is one of `step | code_check | checklist | judge`; `status` is one of `pass | fail | skipped | error`. `overall_score` and `pass_threshold` belong to rubric reports and are omitted here. An agent check you ran is one entry, `{"kind": "code_check", "id": "<heading id>", "name": "<heading name>", "status": "pass|fail", "message": "<one line>"}`; an agent check you did not report is recorded by Jetty as `skipped`, or as `error` (failing the run) when `strict_evaluation` is on. When you ran a command check yourself (locally, or under `code_checks.executor: agent`), record it the same way with `details.command`, `details.exit_code` and `details.stdout_tail`. `stages`, `results` and `rubric_scores` are v1 mirrors kept for the existing report panel: derive `stages` from the `step` entries, `results` from the Step 4 status tally and `rubric_scores` from the `judge` entries (`{}` when there are none). Never edit a mirror separately from `checks`.

**If a checklist item or a check you ran fails, go back and fix the output (within the iteration cap), re-check, then rewrite the report. Do NOT finish before the report is written.**

---

## Tips

- {Domain-specific gotcha or API quirk}
- {Common mistake and how to avoid it}
- {Performance or rate-limiting guidance}
