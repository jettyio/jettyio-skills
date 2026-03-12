---
name: jetty
description: Manage Jetty workflows and assets. Use when the user wants to create/edit/run workflows, manage collections, tasks, datasets, or models on Jetty. Triggers include "run workflow", "create task", "list collections", "check trajectory", "label trajectory", "add label", "deploy workflow", or any Jetty/mise/dock operations.
argument-hint: [command] [args]
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, AskUserQuestion
---

# Jetty Workflow Management Skill

## FIRST STEP: Ask for the Collection

Before doing any work, you MUST ask the user which collection to use. Use AskUserQuestion with the header "Collection" and ask "Which Jetty collection should I use?". If you already know the collection from the user's message or prior context, you can skip this step.

---

This skill enables you to interact with the Jetty platform to manage and run AI/ML workflows. Jetty provides two main APIs:

| Service | Base URL | Purpose |
|---------|----------|---------|
| **Flows API** | `https://flows-api.jetty.io` | Run workflows, view logs, trajectories, download files |
| **Dock API** | `https://dock.jetty.io` | Manage collections, tasks, datasets, models |
| **Frontend** | `https://flows.jetty.io` | Web UI only — do NOT use for API calls |

---

## CRITICAL: Authentication

**Read the API token from `~/.config/jetty/token` and set it as a shell variable at the start of every bash command block.**

The token file is created during setup (`/jetty-setup`). If it doesn't exist, check the project's `CLAUDE.md` for a token starting with `mlc_` (legacy location) and migrate it:

```bash
# Read token from secure config location
TOKEN="$(cat ~/.config/jetty/token 2>/dev/null)"

# If empty, check CLAUDE.md as fallback — then migrate it
# TOKEN="mlc_FOUND_TOKEN"
# mkdir -p ~/.config/jetty && chmod 700 ~/.config/jetty
# printf '%s' "$TOKEN" > ~/.config/jetty/token && chmod 600 ~/.config/jetty/token
```

**Security rules:**
- Never echo, print, or log the full token. Use redacted forms (`mlc_...xxxx`) in user-facing output.
- Never hardcode the token directly in curl commands. Always read from file into a shell variable.
- Pipe sensitive request bodies via stdin (`cat <<'BODY' | curl --data-binary @-`) to avoid exposing secrets in process argument lists.

API keys are scoped to specific collections. Your token only works with collections it has access to.

## CRITICAL: URL Disambiguation

- **`flows-api.jetty.io`** — The API for running workflows, logs, trajectories, files. Use this.
- **`flows.jetty.io`** — The web frontend. Do NOT use this for API calls (returns HTML 404).
- **`dock.jetty.io`** — The API for managing collections, tasks, datasets, models.

```bash
# Health check both APIs
curl -s "https://flows-api.jetty.io/api/v1/health" | jq
curl -s "https://dock.jetty.io/api/v1/health" | jq
```

---

## Core Operations Reference

**In all examples below, `$TOKEN` must be set at the start of your bash command block: `TOKEN="$(cat ~/.config/jetty/token)"` then use `$TOKEN` in curl.**

### Collections

```bash
# List all collections
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://dock.jetty.io/api/v1/collections/" | jq

# Get collection details
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://dock.jetty.io/api/v1/collections/{COLLECTION}" | jq

# Create a collection
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "https://dock.jetty.io/api/v1/collections/" \
  -d '{"name": "my-collection", "description": "My workflows"}' | jq
```

### Tasks (Workflows)

```bash
# List tasks in a collection
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://dock.jetty.io/api/v1/tasks/{COLLECTION}/" | jq

# Get task details (includes workflow definition)
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://dock.jetty.io/api/v1/tasks/{COLLECTION}/{TASK}" | jq

# Search tasks
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://dock.jetty.io/api/v1/tasks/{COLLECTION}/search?q={QUERY}" | jq

# Create task
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "https://dock.jetty.io/api/v1/tasks/{COLLECTION}" \
  -d '{
    "name": "my-task",
    "description": "Task description",
    "workflow": {
      "init_params": {},
      "step_configs": {},
      "steps": []
    }
  }' | jq

# Update task
curl -s -X PUT -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "https://dock.jetty.io/api/v1/tasks/{COLLECTION}/{TASK}" \
  -d '{"workflow": {...}, "description": "Updated"}' | jq

# Delete task
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" \
  "https://dock.jetty.io/api/v1/tasks/{COLLECTION}/{TASK}" | jq
```

### Run Workflows

```bash
# Run async (returns immediately with workflow_id)
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -F "bakery_host=https://dock.jetty.io" \
  -F 'init_params={"key": "value"}' \
  "https://flows-api.jetty.io/api/v1/run/{COLLECTION}/{TASK}" | jq

# Run sync (waits for completion)
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -F "bakery_host=https://dock.jetty.io" \
  -F 'init_params={"key": "value"}' \
  "https://flows-api.jetty.io/api/v1/run-sync/{COLLECTION}/{TASK}" | jq

# Run with file upload
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -F "bakery_host=https://dock.jetty.io" \
  -F 'init_params={"prompt": "Analyze this document"}' \
  -F "files=@/path/to/file.pdf" \
  "https://flows-api.jetty.io/api/v1/run/{COLLECTION}/{TASK}" | jq
```

### Monitor Workflows

```bash
# Get workflow logs
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://flows-api.jetty.io/api/v1/workflows-logs/{WORKFLOW_ID}" | jq

# List trajectories (execution history)
# IMPORTANT: Response is {"trajectories": [...], "total": N, "page": N, "limit": N, "has_more": bool}
# Access the array via .trajectories, NOT the top-level object
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://flows-api.jetty.io/api/v1/db/trajectories/{COLLECTION}/{TASK}?limit=20" | jq '.trajectories'

# Get trajectory details (returns a single trajectory object)
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://flows-api.jetty.io/api/v1/db/trajectory/{COLLECTION}/{TASK}/{TRAJECTORY_ID}" | jq

# Get workflow statistics
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://flows-api.jetty.io/api/v1/db/stats/{COLLECTION}/{TASK}" | jq
```

### Download Files

Generated files (images, JSON outputs, etc.) can be downloaded using their full path from trajectory data.

```bash
# Download a generated file (e.g., image from replicate_text2image)
# The path comes from trajectory: .steps.{STEP}.outputs.images[0].path or .outputs.files[].path
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://flows-api.jetty.io/api/v1/file/{FULL_FILE_PATH}" \
  -o output_file.jpg

# Example: download an image from a trajectory
# Path: "jettyio/my-task/0000/abc123.generate_image.0000.jpg"
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://flows-api.jetty.io/api/v1/file/jettyio/my-task/0000/abc123.generate_image.0000.jpg" \
  -o image.jpg
```

### Update Trajectory Status

Batch update trajectory statuses. Useful for fixing stuck trajectories (e.g., showing "running" after a failed cancel) or manually marking trajectories as cancelled/failed/archived.

```bash
# Batch update statuses for one or more trajectories
# Valid statuses: "pending", "completed", "failed", "cancelled", "archived"
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "https://flows-api.jetty.io/api/v1/trajectory/{COLLECTION}/{TASK}/statuses" \
  -d '{"TRAJECTORY_ID_1": "cancelled", "TRAJECTORY_ID_2": "cancelled"}' | jq

# Example: fix stuck "running" trajectories after cancel
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "https://flows-api.jetty.io/api/v1/trajectory/{COLLECTION}/{TASK}/statuses" \
  -d '{"abc123": "cancelled"}' | jq
```

Response:
```json
{
  "results": [
    {"trajectory_id": "abc123", "new_status": "cancelled", "updated": "2026-01-01T00:00:00", "storage_path": "...", "error": null}
  ],
  "updated_count": 1
}
```

### Labels

Labels allow you to annotate trajectories with key-value metadata for categorization, tracking, and filtering.

```bash
# Add a label to a trajectory
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "https://flows-api.jetty.io/api/v1/trajectory/{COLLECTION}/{TASK}/{TRAJECTORY_ID}/labels" \
  -d '{
    "key": "review-status",
    "value": "approved",
    "author": "reviewer@example.com"
  }' | jq

# Common label examples
# Quality rating
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "https://flows-api.jetty.io/api/v1/trajectory/{COLLECTION}/{TASK}/{TRAJECTORY_ID}/labels" \
  -d '{"key": "quality", "value": "high", "author": "user@example.com"}' | jq

# Classification tag
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "https://flows-api.jetty.io/api/v1/trajectory/{COLLECTION}/{TASK}/{TRAJECTORY_ID}/labels" \
  -d '{"key": "category", "value": "production", "author": "user@example.com"}' | jq

# Feedback annotation
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "https://flows-api.jetty.io/api/v1/trajectory/{COLLECTION}/{TASK}/{TRAJECTORY_ID}/labels" \
  -d '{"key": "feedback", "value": "needs-improvement", "author": "user@example.com"}' | jq
```

| Field | Description | Required |
|-------|-------------|----------|
| `key` | Label identifier (e.g., "status", "quality", "category") | Yes |
| `value` | Label value (e.g., "approved", "high", "production") | Yes |
| `author` | Email of the person adding the label | Yes |

### Step Templates

```bash
# List all available step templates
curl -s "https://flows-api.jetty.io/api/v1/step-templates" | jq

# Get details for a specific activity
curl -s "https://flows-api.jetty.io/api/v1/step-templates/{ACTIVITY}" | jq
```

### Datasets

```bash
# List datasets
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://dock.jetty.io/api/v1/datasets/{COLLECTION}" | jq

# Get dataset details
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://dock.jetty.io/api/v1/datasets/{COLLECTION}/{DATASET}" | jq

# Create dataset
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "https://dock.jetty.io/api/v1/datasets/{COLLECTION}" \
  -d '{"name": "my-dataset", "description": "Dataset description"}' | jq
```

### Models

```bash
# List models
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://dock.jetty.io/api/v1/models/{COLLECTION}/" | jq

# Get model details
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://dock.jetty.io/api/v1/models/{COLLECTION}/{MODEL}" | jq
```

---

## Workflow Structure

A Jetty workflow is a JSON document with three main sections:

```json
{
  "init_params": {
    "param1": "default_value",
    "param2": 123
  },
  "step_configs": {
    "step_name": {
      "activity": "activity_name",
      "param1": "static_value",
      "param2_path": "init_params.param2"
    }
  },
  "steps": ["step_name"]
}
```

### Key Concepts

| Component | Description |
|-----------|-------------|
| `init_params` | Default input parameters for the workflow |
| `step_configs` | Configuration for each step, keyed by step name |
| `steps` | Ordered list of step names to execute |
| `activity` | The step template to use |
| `*_path` suffix | Dynamic reference to data from init_params or previous steps |

### Path Expressions

Reference data from different sources:

```
init_params.prompt              # Input parameter
step1.outputs.text              # Output from step1
step1.outputs.items[0].name     # Array index access
step1.outputs.items[*].id       # Wildcard (returns array of all ids)
step1.inputs.prompt             # Input that was passed to step1
```

---

## CRITICAL: Runtime Parameter Gotchas

The step template documentation and the actual runtime parameters **differ** for several activities. These mismatches will cause silent failures. Always use the runtime names below.

### `litellm_chat`
- Use `prompt` / `prompt_path` (NOT `user_prompt` / `user_prompt_path`)
- `system_prompt` / `system_prompt_path` works as documented

### `replicate_text2image`
- Outputs are at **`.outputs.images[0].path`** (NOT `.outputs.storage_path` or `.outputs.image_url`)
- The `.path` value is a storage path like `collection/task/0000/abc123.step_name.0000.webp`
- Also available: `.outputs.images[0].extension`, `.outputs.images[0].content_type`

### `litellm_vision`
- To pass a **storage path** from a previous step, use `image_path_expr` (NOT `image_url_path`)
- `image_url_path` is for external HTTP URLs only
- Example: `"image_path_expr": "generate_image.outputs.images[0].path"`

### `simple_judge`
- Use `item` / `item_path` (NOT `content` / `content_path`)
- Use `instruction` / `instruction_path` (NOT `criteria` / `criteria_path`)
- For multiple items use `items` / `items_path`
- **Supports images**: pass a storage path (e.g., `.webp`, `.png`, `.jpg`) as `item_path` and it auto-converts for vision models
- `score_range` in categorical mode uses range values as category labels, not numeric scores

---

## Common Step Templates

### AI Models

| Activity | Purpose | Key Parameters |
|----------|---------|----------------|
| `litellm_chat` | Universal LLM chat | `model`, `prompt`/`prompt_path`, `system_prompt`, `temperature` |
| `litellm_vision` | Image analysis with LLM | `model`, `prompt`, `image_path_expr` (storage) or `image_url_path` (URL) |
| `gemini_prompt` | Google Gemini | `model`, `prompt`, `temperature` |
| `replicate_text2image` | Text-to-image via Replicate | `model`, `prompt`/`prompt_path`, `width`, `height` |
| `replicate_text2video` | Text-to-video via Replicate | `model`, `prompt`/`prompt_path` |

### Control Flow

| Activity | Purpose | Key Parameters |
|----------|---------|----------------|
| `list_emit_await` | Fan-out parallel execution | `items_path`, `child_workflow_name`, `max_concurrency` |
| `extract_from_trajectories` | Fan-in gather results | `trajectory_ids_path`, `extract_paths` |
| `conditional_branch` | Conditional branching | `condition_path`, `true_step`, `false_step` |

### Data Processing

| Activity | Purpose | Key Parameters |
|----------|---------|----------------|
| `text_echo` | Pass through text | `text` or `text_path` |
| `text_template` | Template text with variables | `template`, variable paths |
| `text_concatenate` | Concatenate text | `texts_path` |
| `split_text` | Split text into chunks | `text_path`, `chunk_size`, `overlap` |

### Evaluation

| Activity | Purpose | Key Parameters |
|----------|---------|----------------|
| `simple_judge` | LLM-as-judge (text + images) | `item`/`item_path`, `instruction`, `model`, `score_range` |

---

## Workflow Templates

### Template 1: Simple LLM Chat

```json
{
  "init_params": {
    "prompt": "Hello, how are you?",
    "model": "gpt-4o-mini"
  },
  "step_configs": {
    "chat": {
      "activity": "litellm_chat",
      "model_path": "init_params.model",
      "system_prompt": "You are a helpful assistant.",
      "prompt_path": "init_params.prompt",
      "temperature": 0.7
    }
  },
  "steps": ["chat"]
}
```

### Template 2: Text Echo (Testing)

```json
{
  "init_params": {
    "text": "Hello, Jetty!"
  },
  "step_configs": {
    "echo": {
      "activity": "text_echo",
      "text_path": "init_params.text"
    }
  },
  "steps": ["echo"]
}
```

### Template 3: Model Comparison (with simple_judge)

```json
{
  "init_params": {
    "prompt": "Explain quantum computing in simple terms"
  },
  "step_configs": {
    "model_a": {
      "activity": "litellm_chat",
      "model": "gpt-4o",
      "prompt_path": "init_params.prompt",
      "temperature": 0.7
    },
    "model_b": {
      "activity": "litellm_chat",
      "model": "claude-3-sonnet-20240229",
      "prompt_path": "init_params.prompt",
      "temperature": 0.7
    },
    "compare": {
      "activity": "simple_judge",
      "items_path": ["model_a.outputs.text", "model_b.outputs.text"],
      "instruction": "Compare these responses for clarity and accuracy",
      "model": "gpt-4o",
      "score_range": {"min": 1, "max": 5},
      "explanation_required": true
    }
  },
  "steps": ["model_a", "model_b", "compare"]
}
```

### Template 4: Fan-Out Processing

```json
{
  "init_params": {
    "text": "Long document text here...",
    "chunk_size": 1000
  },
  "step_configs": {
    "split": {
      "activity": "text_split",
      "text_path": "init_params.text",
      "chunk_size_path": "init_params.chunk_size",
      "overlap": 100
    },
    "process_chunks": {
      "activity": "list_emit_await",
      "items_path": "split.outputs.chunks",
      "child_workflow_name": "{COLLECTION}/process-chunk",
      "item_param_name": "chunk",
      "max_concurrency": 10
    },
    "gather": {
      "activity": "extract_from_trajectories",
      "trajectory_ids_path": "process_chunks.outputs.trajectory_ids",
      "extract_paths": ["summarize.outputs.text"]
    }
  },
  "steps": ["split", "process_chunks", "gather"]
}
```

### Template 5: Image Generation (replicate_text2image)

```json
{
  "init_params": {
    "prompt": "A serene mountain landscape at sunset"
  },
  "step_configs": {
    "generate": {
      "activity": "replicate_text2image",
      "model": "black-forest-labs/flux-schnell",
      "prompt_path": "init_params.prompt",
      "width": 1024,
      "height": 768,
      "num_outputs": 1
    }
  },
  "steps": ["generate"]
}
```

**Output path**: `generate.outputs.images[0].path` (storage path for the image file)

### Template 6: Image Generation + Vision Judge Pipeline

This is a verified, working pipeline that generates an image and evaluates it with a vision model.

```json
{
  "init_params": {
    "prompt": "a detective in the rain"
  },
  "step_configs": {
    "expand_prompt": {
      "activity": "litellm_chat",
      "model": "gpt-4o-mini",
      "system_prompt": "You are a scene writer. Expand the prompt into a vivid visual description for image generation. Output ONLY the description, under 200 words.",
      "prompt_path": "init_params.prompt",
      "temperature": 0.9,
      "max_tokens": 300
    },
    "generate_image": {
      "activity": "replicate_text2image",
      "model": "black-forest-labs/flux-schnell",
      "prompt_path": "expand_prompt.outputs.text",
      "width": 1024,
      "height": 768,
      "num_outputs": 1
    },
    "judge_image": {
      "activity": "simple_judge",
      "model": "gpt-4o",
      "item_path": "generate_image.outputs.images[0].path",
      "instruction": "Evaluate the quality of this generated image. Score 1-5.",
      "score_range": {"min": 1, "max": 5},
      "explanation_required": true,
      "temperature": 0.1
    }
  },
  "steps": ["expand_prompt", "generate_image", "judge_image"]
}
```

---

## Common Workflows

### Workflow: Create and Test a Task

```bash
# 1. Create the task
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "https://dock.jetty.io/api/v1/tasks/{COLLECTION}" \
  -d '{
    "name": "test-echo",
    "description": "Simple echo test",
    "workflow": {
      "init_params": {"text": "Hello!"},
      "step_configs": {
        "echo": {"activity": "text_echo", "text_path": "init_params.text"}
      },
      "steps": ["echo"]
    }
  }' | jq

# 2. Run it synchronously
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -F "bakery_host=https://dock.jetty.io" \
  -F 'init_params={"text": "Test message"}' \
  "https://flows-api.jetty.io/api/v1/run-sync/{COLLECTION}/test-echo" | jq

# 3. Check the result in trajectory (.trajectories[0] to get first result)
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://flows-api.jetty.io/api/v1/db/trajectories/{COLLECTION}/test-echo?limit=1" | jq '.trajectories[0]'
```

### Workflow: Debug a Failed Run

```bash
# 1. Get recent trajectories (note: response wraps array in .trajectories)
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://flows-api.jetty.io/api/v1/db/trajectories/{COLLECTION}/{TASK}?limit=5" \
  | jq '.trajectories[] | {trajectory_id, status, error}'

# 2. Get trajectory details (find the failed one)
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://flows-api.jetty.io/api/v1/db/trajectory/{COLLECTION}/{TASK}/{TRAJECTORY_ID}" | jq

# 3. Check workflow logs
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://flows-api.jetty.io/api/v1/workflows-logs/{WORKFLOW_ID}" | jq

# 4. Examine the step that failed (steps is an object keyed by step name, not an array)
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://flows-api.jetty.io/api/v1/db/trajectory/{COLLECTION}/{TASK}/{TRAJECTORY_ID}" \
  | jq '.steps | to_entries[] | select(.value.status == "failed") | {step: .key, error: .value}'
```

### Workflow: List Available Activities

```bash
# Get all step template names (note: response is {templates: [...], categories: [...], total_count: N})
curl -s "https://flows-api.jetty.io/api/v1/step-templates" | jq '[.templates[] | .activity_name]'

# Get details for a specific activity
curl -s "https://flows-api.jetty.io/api/v1/step-templates" | jq '.templates[] | select(.activity_name == "litellm_chat")'
```

---

## Error Handling

| Status | Meaning | Resolution |
|--------|---------|------------|
| 401 | Invalid/expired token | Regenerate token at dock.jetty.io → Settings → API Tokens |
| 403 | Access denied | Verify token has access to the collection |
| 404 | Not found | Check collection/task names for typos |
| 422 | Validation error | Check request body format and required fields |
| 429 | Rate limited | Reduce request frequency, implement backoff |
| 500 | Server error | Retry with exponential backoff |

---

## Best Practices

### Workflow Design

1. **Start simple** - Test with `text_echo` before adding complexity
2. **Use path expressions** - Reference data dynamically instead of hardcoding
3. **Set reasonable defaults** - Provide sensible `init_params` defaults
4. **Add descriptions** - Document what your task does

### Execution

1. **Use sync for testing** - `run-sync` is easier to debug
2. **Use async for production** - Better for long-running workflows
3. **Check trajectories** - Review execution history for issues
4. **Monitor statistics** - Use stats endpoint to track performance

### API Usage

1. **Always use jq** - Format responses for readability
2. **Quote JSON properly** - Escape special characters in curl
3. **Read token from file** - Set `TOKEN="$(cat ~/.config/jetty/token)"` at start of each bash command block
4. **Handle errors** - Check response status codes

---

## Batch Runs

When running multiple workflows (e.g., test suites), write a bash script to `/tmp` and execute it. The Bash tool has escaping issues with inline arrays and functions.

```bash
# Write script to /tmp, then run with: bash /tmp/batch_run.sh
#!/bin/bash
TOKEN="$(cat ~/.config/jetty/token)"

run_wf() {
  local prompt="$1"
  echo "--- $prompt"
  curl -s -X POST -H "Authorization: Bearer $TOKEN" \
    -F "bakery_host=https://dock.jetty.io" \
    -F "init_params={\"prompt\": \"$prompt\"}" \
    "https://flows-api.jetty.io/api/v1/run/{COLLECTION}/{TASK}" | jq -r '.workflow_id'
}

run_wf "test prompt 1"
run_wf "test prompt 2"
```

After launching, wait ~45-60 seconds, then check statuses:
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://flows-api.jetty.io/api/v1/db/trajectories/{COLLECTION}/{TASK}?limit=10" \
  | jq '[.trajectories[] | {id: .trajectory_id, status: .status}]'
```

---

## Tips

- Use `jq -r '.field'` to extract specific fields without quotes
- Use `jq '.trajectories[0]'` to get the first trajectory from list results
- Use `jq 'keys'` to see available fields in a response
- Pipe to `jq -C` for colored output
- Use `curl -v` for debugging request/response issues
- Always set `TOKEN="$(cat ~/.config/jetty/token)"` at the start of each bash command block — env vars do not persist across shell invocations
- When a workflow fails, check error logs first: `jq '.events[] | select(.level == "error")'`
- The `init_params` for a trajectory are at `.init_params.prompt`, NOT `.steps.{step}.inputs.prompt`
