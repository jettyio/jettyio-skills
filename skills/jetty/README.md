# Jetty Claude Code Skill

A comprehensive Claude Code skill for managing Jetty AI/ML workflows from the command line.

## Features

- **Full API Coverage**: Collections, tasks, datasets, models, and more
- **Workflow Execution**: Run workflows sync/async with file uploads
- **Monitoring**: Trajectories, logs, and statistics
- **Shell Helper Functions**: Convenient CLI functions for common operations
- **Workflow Templates**: Ready-to-use patterns for common use cases

## Installation

### For Claude Code Users

1. Copy this skill directory to your Claude Code skills folder:
   ```bash
   cp -r .claude/skills/jetty ~/.claude/skills/
   ```

2. Run `/jetty-setup` to configure your API token (stored securely in `~/.config/jetty/token`).

3. Use the `/jetty` command in Claude Code to interact with the Jetty platform.

### For CLI Usage (Shell Functions)

1. Source the helper script in your shell:
   ```bash
   source ~/.claude/skills/jetty/jetty-cli.sh
   ```

2. Or add to your shell profile (`~/.bashrc` or `~/.zshrc`):
   ```bash
   # Jetty CLI
   source ~/.claude/skills/jetty/jetty-cli.sh
   ```

   The CLI reads your token from `~/.config/jetty/token`. Run `/jetty-setup` first, or manually create it:
   ```bash
   mkdir -p ~/.config/jetty && chmod 700 ~/.config/jetty
   printf '%s' 'mlc_your_token_here' > ~/.config/jetty/token && chmod 600 ~/.config/jetty/token
   ```

3. Run `jetty_help` for available commands.

## Quick Start

### Using Claude Code

```
/jetty list collections
/jetty list tasks in myproject
/jetty run myproject/my-task with prompt="Hello"
/jetty show trajectory for myproject/my-task
```

### Using Shell Functions

```bash
# Check setup
jetty_health

# List resources
jetty_collections
jetty_tasks myproject

# Run workflows
jetty_run_sync myproject my-task '{"prompt": "Hello"}'

# Monitor
jetty_trajectories myproject my-task
jetty_last_output myproject my-task
```

## Getting Your API Token

1. Log in to [dock.jetty.io](https://dock.jetty.io)
2. Go to **Settings** → **API Tokens**
3. Click **Create Token**
4. Copy the token (format: `mlc_xxxxxxxxxxxxx`)

## Available Commands

### Collections
| Function | Description |
|----------|-------------|
| `jetty_collections` | List all accessible collections |
| `jetty_collection <coll>` | Get collection details |

### Tasks (Workflows)
| Function | Description |
|----------|-------------|
| `jetty_tasks <coll>` | List tasks in collection |
| `jetty_task <coll> <task>` | Get task details |
| `jetty_workflow <coll> <task>` | Get just the workflow JSON |
| `jetty_create_task <coll> <name> <file>` | Create task from JSON file |
| `jetty_update_task <coll> <name> <file>` | Update task workflow |
| `jetty_delete_task <coll> <task>` | Delete a task |

### Running Workflows
| Function | Description |
|----------|-------------|
| `jetty_run <coll> <task> [params]` | Run async |
| `jetty_run_sync <coll> <task> [params]` | Run sync (waits) |
| `jetty_run_with_file <coll> <task> <file>` | Run with file upload |

### Monitoring
| Function | Description |
|----------|-------------|
| `jetty_logs <workflow_id>` | Get workflow logs |
| `jetty_trajectories <coll> <task>` | List recent trajectories |
| `jetty_trajectory <coll> <task> <id>` | Get trajectory details |
| `jetty_last_output <coll> <task>` | Get last step output |
| `jetty_stats <coll> <task>` | Get workflow statistics |

### Step Templates
| Function | Description |
|----------|-------------|
| `jetty_templates` | List all step templates |
| `jetty_template <activity>` | Get template details |
| `jetty_search_templates <keyword>` | Search templates |

## Workflow Templates

The `templates/` directory contains ready-to-use workflow JSON files:

- `simple-chat.json` - Basic LLM chat workflow
- `text-echo.json` - Simple echo for testing
- `model-comparison.json` - Compare multiple LLMs
- `fan-out-processing.json` - Parallel chunk processing
- `image-generation.json` - Generate images with Replicate

### Using Templates

```bash
# Create a task from a template
jetty_create_task myproject my-chat templates/simple-chat.json "My chat workflow"

# Run it
jetty_run_sync myproject my-chat '{"prompt": "Hello!"}'
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JETTY_API_TOKEN` | **Required**. Your API token | - |
| `JETTY_FLOWS_API` | Flows API URL | `https://flows-api.jetty.io` |
| `JETTY_DOCK_API` | Dock API URL | `https://dock.jetty.io` |
| `JETTY_CHAT_TASK` | Task for `jetty_chat` | `quick-chat` |

## Troubleshooting

### "Invalid or expired token"
- Regenerate your token in Settings → API Tokens
- Ensure the full token including `mlc_` prefix is set

### "Access denied to collection"
- Verify the collection name matches exactly
- Check your token has access to that collection

### "jq: command not found"
- Install jq: `brew install jq` (macOS) or `apt install jq` (Linux)

### Workflow fails silently
- Check `jetty_logs <workflow_id>` for errors
- Review trajectory: `jetty_trajectory <coll> <task> <traj_id>`
- Ensure required API keys are set in Jetty Settings → Secrets

## API Documentation

For complete API documentation, see:
- [Jetty Documentation](https://docs.jetty.io)
- [API Reference](https://docs.jetty.io/api/overview)

## License

MIT License - feel free to use, modify, and distribute.
