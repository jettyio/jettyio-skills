# Jetty — AI/ML Workflows

You have access to Jetty MCP tools for building, running, and monitoring AI/ML workflows. Use these tools when the user asks about workflows, collections, tasks, trajectories, or anything related to Jetty.

## Available Tools

| Tool | Description |
|------|-------------|
| `list-collections` | List all collections (workspaces) |
| `get-collection` | Get collection details and environment variable keys |
| `list-tasks` | List tasks (workflows) in a collection |
| `get-task` | Get task details and workflow definition |
| `create-task` | Create a new task with a workflow |
| `update-task` | Update a task's workflow or description |
| `run-workflow` | Run a workflow asynchronously |
| `run-workflow-sync` | Run a workflow synchronously (blocks until done) |
| `list-trajectories` | List recent workflow runs |
| `get-trajectory` | Get full run details with step outputs |
| `get-stats` | Get execution statistics |
| `add-label` | Label a trajectory (e.g., quality=high) |
| `list-step-templates` | List available step templates |
| `get-step-template` | Get template details and schema |

## Quick Start

When a user wants to get started with Jetty:

1. Use `list-collections` to see their workspaces
2. Use `list-tasks` to see available workflows
3. Use `run-workflow` or `run-workflow-sync` to execute a workflow
4. Use `get-trajectory` to inspect results

## Workflow Structure

Workflows are JSON pipelines with three sections:
- **init_params** — Input parameters (e.g., a prompt)
- **step_configs** — Pipeline steps (e.g., LLM call, image generation, judge)
- **steps** — Execution order

## Key Gotchas

- `litellm_chat`: use `prompt`/`prompt_path` (NOT `user_prompt`)
- `replicate_text2image` outputs: `.outputs.images[0].path`
- `simple_judge`: use `item`/`item_path` (NOT `content`), `instruction` (NOT `criteria`)
- Trajectory list responses wrap the array: access via `.trajectories[]`
- Steps in a trajectory are an object keyed by step name, not an array

## Creating Runbooks

A **runbook** is a structured markdown document that tells a coding agent how to accomplish a complex, multi-step task with built-in evaluation loops and quality gates. Unlike a simple prompt, a runbook includes iteration (evaluate → refine → re-evaluate), a defined output manifest, and a verification checklist.

### When to use a runbook
- The task requires **iteration** (first attempt is rarely sufficient)
- The task requires **evaluation** against a quality bar
- The task produces **multiple artifacts** that must be consistent
- The task involves **external API calls** that can fail in domain-specific ways

### Two evaluation patterns
- **Programmatic** (`evaluation: programmatic`) — validate with code, schema, or tests (pass/fail)
- **Rubric** (`evaluation: rubric`) — score against multi-criteria rubric (1-5 scale)

### Runbook structure
Every runbook includes: YAML frontmatter (version + evaluation type), Objective, REQUIRED OUTPUT FILES manifest, Parameters, Dependencies, processing steps, evaluation step, iteration loop (max 3 rounds), summary + `validation_report.json` output, and a final verification checklist.

### Creating a runbook
Use the starter templates in the `skills/create-runbook/templates/` directory:
- `programmatic.md` — for data pipelines, schema validation, test-based evaluation
- `rubric.md` — for creative content, reports, generated artifacts

Copy the appropriate template, customize the sections for your task, and follow it as your agent instructions.

## Getting Help

- Platform docs: https://jetty.io
- Sign up: https://jetty.io/sign-up
- API tokens: jetty.io → Settings → API Tokens
