# Workflow Templates

Ready-to-use JSON templates for common patterns. Copy and customize these.

## Table of Contents

1. [Simple LLM Chat](#simple-llm-chat)
2. [Text Echo (Testing)](#text-echo-testing)
3. [Model Comparison with Judge](#model-comparison-with-judge)
4. [Fan-Out Processing](#fan-out-processing)
5. [Image Generation](#image-generation)
6. [Image Generation + Vision Judge Pipeline](#image-generation--vision-judge-pipeline)

---

## Simple LLM Chat

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

## Text Echo (Testing)

Useful for verifying your setup works before adding complexity.

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

## Model Comparison with Judge

Runs two models on the same prompt, then uses `simple_judge` to compare.

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

## Fan-Out Processing

Splits text into chunks, processes each in parallel, then gathers results.

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
      "child_workflow_name": "process-chunk",
      "item_param_name": "chunk",
      "max_concurrency": 10
    },
    "gather": {
      "activity": "extract_from_trajectories",
      "trajectory_list_path": "process_chunks.outputs.trajectory_references",
      "extract_keys": {
        "summary": "summarize.outputs.text"
      }
    }
  },
  "steps": ["split", "process_chunks", "gather"]
}
```

## Image Generation

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

## Image Generation + Vision Judge Pipeline

Verified working pipeline: expands a prompt, generates an image, then evaluates it with a vision model.

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
