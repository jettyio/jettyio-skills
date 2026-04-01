---
name: optimize-runbook
description: Analyze previous Jetty workflow runs and propose targeted improvements to your runbook. Use when the user wants to optimize, improve, or debug a runbook based on past execution results — including "optimize runbook", "improve runbook", "why is my runbook failing", "analyze my runs", "runbook not working well", "make my runbook better", "debug runbook performance", or "learn from past runs". Also trigger when the user mentions trajectory analysis, run patterns, or evaluation score improvements.
argument-hint: [collection/task_name] [--trajectories t1,t2,t3] [--last N]
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, AskUserQuestion
---

# Optimize Runbook

You are analyzing previous Jetty workflow runs to identify patterns and propose targeted improvements to a local runbook. The goal is to produce specific, evidence-backed changes — not generic advice.

## Cross-Agent Compatibility

This skill uses `AskUserQuestion` for interactive choices. If running in an environment where `AskUserQuestion` is not available, replace each call with a direct question in your text output.

---

## Step 1: Identify the Runbook

1. Look for runbook files in the current directory:

```bash
ls -la RUNBOOK*.md 2>/dev/null
```

2. If multiple runbooks are found, use AskUserQuestion:
   - Header: "Runbook"
   - Question: "Multiple runbooks found. Which one do you want to optimize?"
   - Options: list each filename

3. Read the chosen runbook with the Read tool. Extract from frontmatter:
   - `version`, `evaluation` (programmatic or rubric)
   - `agent`, `model`, `snapshot` (if present)

4. Parse the evaluation section:
   - **Programmatic**: extract the PASS/PARTIAL/FAIL criteria table
   - **Rubric**: extract the rubric table (criteria, score descriptions, pass threshold)

5. Identify the collection and task name. Check the skill argument first, then look in the runbook for Jetty API references. If not found, use AskUserQuestion:
   - Header: "Collection/Task"
   - Question: "Which Jetty collection and task does this runbook run as? (format: collection/task_name)"
   - Options:
     - "I'll type it" / "Let me enter the collection and task name"

---

## Step 2: Fetch Trajectories

Parse the skill argument for trajectory IDs or `--last N`. If not provided:

Use AskUserQuestion:
- Header: "Trajectories"
- Question: "How many recent runs should I analyze?"
- Options:
  - "Last 5 runs" / "Analyze the 5 most recent trajectories"
  - "Last 10 runs" / "Analyze the 10 most recent trajectories"
  - "Specific IDs" / "I'll paste trajectory IDs"

Fetch the trajectory list:

```bash
TOKEN="$(cat ~/.config/jetty/token)"
COLLECTION="the-collection"
TASK="the-task"
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://flows-api.jetty.io/api/v1/db/trajectories/$COLLECTION/$TASK?limit=$LIMIT"
```

Parse the response — format is `{"trajectories": [...], "total": N}`.

For each trajectory, fetch full details:

```bash
TOKEN="$(cat ~/.config/jetty/token)"
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://flows-api.jetty.io/api/v1/db/trajectory/$COLLECTION/$TASK/$TRAJECTORY_ID"
```

Extract and record for each:
- **Status**: completed / failed / timed_out
- **Duration**: total execution time
- **Step outputs**: iterate over `.steps` object keys
- **Errors**: any error messages in failed steps
- **Labels**: any quality labels applied

Download output files where available (validation_report.json, summary.md):

```bash
TOKEN="$(cat ~/.config/jetty/token)"
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://flows-api.jetty.io/api/v1/file/$FILE_PATH"
```

---

## Step 3: Build Analysis Summary

Create and display a summary table:

```markdown
| # | Trajectory ID | Status | Duration | Iterations | Score/Result | Key Issue |
|---|---------------|--------|----------|------------|-------------|-----------|
```

Fill in from trajectory data. Present to the user.

---

## Step 4: Pattern Analysis

Analyze trajectories against the runbook for these patterns:

### 4a: Consistent Failures
Evaluation criteria scoring below threshold across multiple runs.
- Rubric: criteria scoring < 4 in more than half of runs
- Programmatic: stages showing FAIL/PARTIAL across runs

### 4b: Iteration Waste
Steps that consistently need 2-3 retry rounds. Predictable first-attempt failures that could be prevented with better instructions or templates.

### 4c: Timeout Patterns
Runs that timed out or took disproportionately long. Which steps are the bottlenecks?

### 4d: Divergent Agent Behavior
Cases where the agent interpreted instructions differently across runs. Structurally different outputs suggesting ambiguous instructions.

### 4e: Missing Guardrails
Errors not caught by evaluation criteria. Environment setup issues (wrong versions, missing tools).

### 4f: Score Plateaus (rubric only)
Criteria that iterate but don't improve — suggesting the Common Fixes table lacks actionable guidance.

Present each pattern found with supporting evidence (trajectory IDs, scores, error messages).

---

## Step 5: Generate Proposed Changes

For each pattern, propose a specific change to the RUNBOOK.md:

```markdown
## Proposed Changes

### Change 1: {Brief title} (addresses: {pattern})

**Section:** {Which runbook section}
**Current:**
> {Exact current text}

**Proposed:**
> {Replacement text}

**Evidence:** {Trajectory IDs, scores, errors that support this change}
```

Guidelines:
- Changes must be **specific** — quote exact sections, provide exact replacements
- Changes must be **evidence-backed** — cite trajectories, scores, or errors
- Prefer **additive** changes (add a Common Fix, add a tip, strengthen descriptions)
- If frontmatter fields are missing (agent, model, snapshot), propose adding them
- Don't fabricate evidence — only cite patterns actually observed

---

## Step 6: Apply Changes

Use AskUserQuestion:
- Header: "Apply Changes"
- Question: "I found {N} proposed improvements. Which should I apply?"
- Options:
  - "Apply all" / "Apply all {N} changes to the runbook"
  - "Let me choose" / "I'll approve each change individually"
  - "Save as report" / "Don't modify the runbook — save analysis to a file"

**If "Apply all"**: Apply each change using Edit. Bump the version (patch increment).

**If "Let me choose"**: For each change, ask approve/skip/modify.

**If "Save as report"**: Write to `./runbook-optimization-report.md`.

---

## Step 7: Summary

```markdown
## Optimization Summary

- **Runbook**: {filename}
- **Trajectories analyzed**: {count}
- **Patterns identified**: {count}
- **Changes applied**: {count} / {total}
- **Version**: {old} → {new}

### Recommended next steps
- Run the updated runbook 2-3 times to verify improvements
- Run `/jetty optimize-runbook` again after new runs to measure progress
```

---

## Important Notes

- **Read the token from file**: `TOKEN="$(cat ~/.config/jetty/token)"` at the start of each bash block.
- **URL**: Use `flows-api.jetty.io` for API calls. Never `flows.jetty.io`.
- **Trajectories shape**: `{"trajectories": [...]}` — access via `.trajectories[]`.
- **Steps are objects**: keyed by name, not indexed.
- **Minimum trajectories**: Works with 1+, but 3+ gives better patterns.
- **Don't fabricate**: Only report patterns actually observed in the data.
