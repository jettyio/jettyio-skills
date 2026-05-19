# Step Template Reference

Complete catalog of available step templates (activities) for Jetty workflows.

## AI Models

| Activity | Purpose | Key Parameters |
|----------|---------|----------------|
| `litellm_chat` | Universal LLM chat | `model`, `prompt`/`prompt_path`, `system_prompt`, `temperature` |
| `litellm_vision` | Image analysis with LLM | `model`, `prompt`, `image_path_expr` (storage) or `image_url_path` (URL) |
| `gemini_prompt` | Google Gemini | `model`, `prompt`, `temperature` |
| `gemini_image_generator` | Gemini image generation | `model`, `prompt`/`prompt_path` |
| `replicate_text2image` | Text-to-image via Replicate | `model`, `prompt`/`prompt_path`, `width`, `height` |
| `replicate_text2video` | Text-to-video via Replicate | `model`, `prompt`/`prompt_path` |
| `replicate_run` | Generic Replicate model run | `model`, `input` (model-specific) |

## Control Flow

| Activity | Purpose | Key Parameters |
|----------|---------|----------------|
| `list_emit_await` | Fan-out parallel execution | `items_path`, `child_workflow_name`, `max_concurrency` |
| `extract_from_trajectories` | Fan-in gather results | `trajectory_list_path`, `extract_keys` |
| `conditional_branch` | Conditional branching | `condition_path`, `true_step`, `false_step` |

Runtime note: some API schema responses and older examples still mention
`trajectory_ids_path` and `extract_paths`. The current runtime requires
`trajectory_list_path` and `extract_keys`.

## Data Processing

| Activity | Purpose | Key Parameters |
|----------|---------|----------------|
| `text_echo` | Pass through text | `text` or `text_path` |
| `text_template` | Template text with variables | `template`, variable paths |
| `text_concatenate` | Concatenate text | `texts_path` |
| `text_split` | Split text into chunks | `text_path`, `chunk_size`, `overlap` |

## Evaluation

| Activity | Purpose | Key Parameters |
|----------|---------|----------------|
| `simple_judge` | LLM-as-judge (text + images) | `item`/`item_path`, `instruction`, `model`, `score_range` |

## Discovering Templates at Runtime

```bash
# List all available step templates
curl -s "https://flows-api.jetty.io/api/v1/step-templates" | jq '[.templates[] | .activity_name]'

# Get details for a specific activity
curl -s "https://flows-api.jetty.io/api/v1/step-templates" | jq '.templates[] | select(.activity_name == "litellm_chat")'
```

The step templates API response is `{templates: [...], categories: [...], total_count: N}`.
