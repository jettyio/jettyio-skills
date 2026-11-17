# Workflow Templates

Ready-to-use JSON templates for common patterns. Copy and customize these.

## Table of Contents

1. [Simple LLM Chat](#simple-llm-chat)
2. [Text Echo (Testing)](#text-echo-testing)
3. [Image Generation](#image-generation)
4. [Image Generation + Vision Judge Pipeline](#image-generation--vision-judge-pipeline)

---

## Simple LLM Chat

```json
{
  "init_params": {
    "prompt": "Hello, how are you?",
    "model": "gpt-5.6-terra"
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
      "model": "gpt-5.6-terra",
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
      "model": "gpt-5.6-sol",
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
