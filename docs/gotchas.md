# Known Gotchas and Workarounds

This document covers common pitfalls when working with the Jetty platform and this skill.

## `simple_judge` parameter names

The step template documentation lists `content` / `content_path` as parameters, but at runtime the activity requires:

- `item` / `item_path` (or `items` / `items_path` for multiple items) -- **not** `content`
- `instruction` / `instruction_path` -- **not** `criteria`

Both `instruction` and `item`/`items` are **required** at runtime even though the template schema shows them differently.

```json
{
  "activity": "simple_judge",
  "items_path": "chat.outputs.text",
  "instruction": "Evaluate clarity and accuracy",
  "judge_type": "categorical",
  "categories": ["excellent", "good", "fair", "poor"]
}
```

## `simple_judge` scale mode

The `score_range` parameter doesn't produce a numeric score in categorical mode. It uses the range values as category labels (e.g., `"1"` through `"5"` as string labels). If you need true numeric scoring, use `judge_type: "scale"` with `scale_range`.

## URL disambiguation

- **`flows-api.jetty.io`** — The API for all operations: running workflows, managing collections/tasks/datasets/models, trajectories, file downloads. Use this for all API calls.
- **`flows.jetty.io`** — The web frontend. Do NOT use this for API calls — it returns HTML, not JSON.

## API token usage

The token must be passed directly in the `Authorization` header:

```bash
curl -H "Authorization: Bearer mlc_your_token_here" ...
```

Don't rely on `$JETTY_API_TOKEN` being available in subshells unless it's explicitly exported. When using the shell helper functions, ensure you've exported it:

```bash
export JETTY_API_TOKEN="mlc_your_token_here"
```

## Trajectories API response shape

The trajectories list endpoint returns an object, not an array:

```json
{
  "trajectories": [...],
  "total": 100,
  "limit": 20,
  "page": 1,
  "has_more": true
}
```

Access the actual trajectory list via `.trajectories`, not directly from the response root.

## String-encoded numbers in labels

Jetty label values are always strings, even when they represent numbers (e.g., `"2.5"`, `"1"`). When using Spot's reports view, you may need to enable "Treat as numeric" type coercion to use these values in scatter plots and other numeric visualizations.

## Collection-scoped tokens

API tokens are scoped to specific collections. A token that works for collection A may return 403 for collection B. If you get access denied errors, verify your token has permissions for the target collection.

## Path expression wildcards

The `[*]` wildcard in path expressions returns an array of all matching values:

```
step1.outputs.items[*].id    # Returns ["id1", "id2", ...]
```

This is different from `[0]` which returns a single value. Make sure downstream steps expect the right data shape.

## `run-sync` timeout

The `/api/v1/run-sync/` endpoint has a server-side timeout. For long-running workflows, use the async `/api/v1/run/` endpoint instead and poll for completion via the trajectories API.

## File uploads

When running workflows with file uploads, use multipart form data (`-F`) not JSON body (`-d`):

```bash
# Correct
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -F 'init_params={"question": "What is this?"}' \
  -F "files=@document.pdf" \
  "https://flows-api.jetty.io/api/v1/run/collection/task"

# Incorrect (won't work for file uploads)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"init_params": {...}}' \
  "https://flows-api.jetty.io/api/v1/run/collection/task"
```

## Step order matters

Steps in the `steps` array execute sequentially. A step cannot reference outputs from a step that runs after it. If step B needs data from step A, step A must appear first in the array.

## Snapshot Selection

Two pre-built snapshots are available for runbook sandboxes:

| Snapshot | Use When |
|----------|----------|
| `python312-uv` | Default for most tasks — data processing, API calls, code generation |
| `prism-playwright` | Browser needed — screenshots, web scraping, OAuth, HTML rendering |

If your runbook uses Playwright, set `snapshot: prism-playwright` in the frontmatter. The default `python312-uv` does NOT include Playwright or Chromium.

You can also use a custom container image — see [docs.jetty.io/guides/custom-sandbox-images](https://docs.jetty.io/guides/custom-sandbox-images).
