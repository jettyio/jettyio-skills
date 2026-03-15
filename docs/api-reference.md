# Jetty API Reference

Jetty exposes a single REST API at `https://flows-api.jetty.io`. All endpoints require a Bearer token in the `Authorization` header unless otherwise noted.

```bash
curl -H "Authorization: Bearer $JETTY_API_TOKEN" <URL>
```

---

## Flows API (`https://flows-api.jetty.io`)

### Health

```
GET /api/v1/health
```

No authentication required.

### Run Workflow (Async)

```
POST /api/v1/run/{collection}/{task}
Content-Type: multipart/form-data

Fields:
  init_params  = {"key": "value"}       (JSON string)
  files         = @/path/to/file         (optional, repeatable)
```

Returns immediately with a `workflow_id`.

### Run Workflow (Sync)

```
POST /api/v1/run-sync/{collection}/{task}
Content-Type: multipart/form-data

Fields:
  init_params  = {"key": "value"}
```

Blocks until the workflow completes and returns the full trajectory.

### Workflow Logs

```
GET /api/v1/workflows-logs/{workflow_id}
```

### Trajectories

```
GET /api/v1/db/trajectories/{collection}/{task}?limit=20&page=1
```

Response shape:
```json
{
  "trajectories": [...],
  "total": 100,
  "limit": 20,
  "page": 1,
  "has_more": true
}
```

### Single Trajectory

```
GET /api/v1/db/trajectory/{collection}/{task}/{trajectory_id}
```

### Workflow Statistics

```
GET /api/v1/db/stats/{collection}/{task}
```

### Labels

Add a label to a trajectory:

```
POST /api/v1/trajectory/{collection}/{task}/{trajectory_id}/labels
Content-Type: application/json

{
  "key": "review-status",
  "value": "approved",
  "author": "reviewer@example.com"
}
```

### Download Files

Download generated files (images, JSON outputs, etc.) using their full path from trajectory data.

```
GET /api/v1/file/{full_file_path}
```

The file path comes from trajectory step outputs, e.g. `.steps.generate_image.outputs.images[0].path`.

### Step Templates

```
GET /api/v1/step-templates          # List all
GET /api/v1/step-templates/{name}   # Get details
```

No authentication required.

### Collections

```
GET    /api/v1/collections/                         # List all
GET    /api/v1/collections/{collection}              # Get details
POST   /api/v1/collections/                          # Create
         Body: {"name": "...", "description": "..."}
```

### Tasks

```
GET    /api/v1/tasks/{collection}/                   # List tasks
GET    /api/v1/tasks/{collection}/{task}              # Get task details
GET    /api/v1/tasks/{collection}/search?q={query}    # Search tasks
POST   /api/v1/tasks/{collection}                     # Create task
         Body: {"name": "...", "description": "...", "workflow": {...}}
PUT    /api/v1/tasks/{collection}/{task}              # Update task
         Body: {"workflow": {...}, "description": "..."}
DELETE /api/v1/tasks/{collection}/{task}              # Delete task
```

### Datasets

```
GET    /api/v1/datasets/{collection}                  # List datasets
GET    /api/v1/datasets/{collection}/{dataset}         # Get details
POST   /api/v1/datasets/{collection}                   # Create
         Body: {"name": "...", "description": "..."}
```

### Models

```
GET    /api/v1/models/{collection}/                   # List models
GET    /api/v1/models/{collection}/{model}             # Get details
```

---

## Error Codes

| Status | Meaning | Resolution |
|--------|---------|------------|
| 401 | Invalid or expired token | Regenerate at flows.jetty.io -> Settings -> API Tokens |
| 403 | Access denied | Token doesn't have access to this collection |
| 404 | Not found | Check collection/task name spelling |
| 422 | Validation error | Check request body format and required fields |
| 429 | Rate limited | Back off and retry |
| 500 | Server error | Retry with exponential backoff |
