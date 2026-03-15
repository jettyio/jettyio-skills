#!/bin/bash
# Jetty CLI Helper Functions
# Source this file to use Jetty from the command line:
#   source /path/to/jetty-cli.sh
#
# Prerequisites:
#   - JETTY_API_TOKEN environment variable set
#   - jq installed for JSON parsing
#   - curl for API requests

# =============================================================================
# Configuration
# =============================================================================

JETTY_API_URL="${JETTY_API_URL:-https://flows-api.jetty.io}"

# Colors for output
_JETTY_RED='\033[0;31m'
_JETTY_GREEN='\033[0;32m'
_JETTY_YELLOW='\033[0;33m'
_JETTY_BLUE='\033[0;34m'
_JETTY_NC='\033[0m' # No Color

# =============================================================================
# Internal Helpers
# =============================================================================

_jetty_check_token() {
  if [ -z "$JETTY_API_TOKEN" ]; then
    echo -e "${_JETTY_RED}Error: JETTY_API_TOKEN is not set${_JETTY_NC}" >&2
    echo "Set it with: export JETTY_API_TOKEN='mlc_your_token'" >&2
    return 1
  fi
  return 0
}

_jetty_check_jq() {
  if ! command -v jq &> /dev/null; then
    echo -e "${_JETTY_RED}Error: jq is not installed${_JETTY_NC}" >&2
    echo "Install it with: brew install jq (macOS) or apt install jq (Linux)" >&2
    return 1
  fi
  return 0
}

_jetty_auth_header() {
  echo "Authorization: Bearer $JETTY_API_TOKEN"
}

# =============================================================================
# Health & Status
# =============================================================================

# Check if Jetty APIs are available
jetty_health() {
  echo -e "${_JETTY_BLUE}Checking Jetty API health...${_JETTY_NC}"

  echo -n "API: "
  if curl -sf "$JETTY_API_URL/api/v1/health" > /dev/null 2>&1; then
    echo -e "${_JETTY_GREEN}OK${_JETTY_NC} ($JETTY_API_URL)"
  else
    echo -e "${_JETTY_RED}UNAVAILABLE${_JETTY_NC}"
  fi

  echo -n "Token:     "
  if [ -n "$JETTY_API_TOKEN" ]; then
    echo -e "${_JETTY_GREEN}Set (${JETTY_API_TOKEN:0:10}...)${_JETTY_NC}"
  else
    echo -e "${_JETTY_RED}NOT SET${_JETTY_NC}"
  fi
}

# =============================================================================
# Collections
# =============================================================================

# List all accessible collections
# Usage: jetty_collections
jetty_collections() {
  _jetty_check_token || return 1
  _jetty_check_jq || return 1

  curl -sf -H "$(_jetty_auth_header)" \
    "$JETTY_API_URL/api/v1/collections/" | jq -r '.[] | "\(.name)\t\(.description // "No description")"' | column -t -s $'\t'
}

# Get collection details
# Usage: jetty_collection <collection>
jetty_collection() {
  local collection="$1"
  if [ -z "$collection" ]; then
    echo "Usage: jetty_collection <collection>" >&2
    return 1
  fi

  _jetty_check_token || return 1
  _jetty_check_jq || return 1

  curl -sf -H "$(_jetty_auth_header)" \
    "$JETTY_API_URL/api/v1/collections/$collection" | jq
}

# =============================================================================
# Tasks (Workflows)
# =============================================================================

# List tasks in a collection
# Usage: jetty_tasks <collection>
jetty_tasks() {
  local collection="$1"
  if [ -z "$collection" ]; then
    echo "Usage: jetty_tasks <collection>" >&2
    return 1
  fi

  _jetty_check_token || return 1
  _jetty_check_jq || return 1

  curl -sf -H "$(_jetty_auth_header)" \
    "$JETTY_API_URL/api/v1/tasks/$collection/" | jq -r '.[] | "\(.name)\t\(.description // "No description")"' | column -t -s $'\t'
}

# Get task details (workflow definition)
# Usage: jetty_task <collection> <task>
jetty_task() {
  local collection="$1"
  local task="$2"
  if [ -z "$collection" ] || [ -z "$task" ]; then
    echo "Usage: jetty_task <collection> <task>" >&2
    return 1
  fi

  _jetty_check_token || return 1
  _jetty_check_jq || return 1

  curl -sf -H "$(_jetty_auth_header)" \
    "$JETTY_API_URL/api/v1/tasks/$collection/$task" | jq
}

# Get just the workflow JSON from a task
# Usage: jetty_workflow <collection> <task>
jetty_workflow() {
  local collection="$1"
  local task="$2"
  if [ -z "$collection" ] || [ -z "$task" ]; then
    echo "Usage: jetty_workflow <collection> <task>" >&2
    return 1
  fi

  _jetty_check_token || return 1
  _jetty_check_jq || return 1

  curl -sf -H "$(_jetty_auth_header)" \
    "$JETTY_API_URL/api/v1/tasks/$collection/$task" | jq '.workflow'
}

# Create a new task
# Usage: jetty_create_task <collection> <task_name> <workflow_json_file> [description]
jetty_create_task() {
  local collection="$1"
  local task_name="$2"
  local workflow_file="$3"
  local description="${4:-}"

  if [ -z "$collection" ] || [ -z "$task_name" ] || [ -z "$workflow_file" ]; then
    echo "Usage: jetty_create_task <collection> <task_name> <workflow_json_file> [description]" >&2
    return 1
  fi

  if [ ! -f "$workflow_file" ]; then
    echo -e "${_JETTY_RED}Error: File not found: $workflow_file${_JETTY_NC}" >&2
    return 1
  fi

  _jetty_check_token || return 1
  _jetty_check_jq || return 1

  local workflow
  workflow=$(cat "$workflow_file")

  local payload
  payload=$(jq -n \
    --arg name "$task_name" \
    --arg desc "$description" \
    --argjson workflow "$workflow" \
    '{name: $name, description: $desc, workflow: $workflow}')

  curl -sf -X POST -H "$(_jetty_auth_header)" \
    -H "Content-Type: application/json" \
    "$JETTY_API_URL/api/v1/tasks/$collection" \
    -d "$payload" | jq
}

# Update a task's workflow
# Usage: jetty_update_task <collection> <task_name> <workflow_json_file>
jetty_update_task() {
  local collection="$1"
  local task_name="$2"
  local workflow_file="$3"

  if [ -z "$collection" ] || [ -z "$task_name" ] || [ -z "$workflow_file" ]; then
    echo "Usage: jetty_update_task <collection> <task_name> <workflow_json_file>" >&2
    return 1
  fi

  if [ ! -f "$workflow_file" ]; then
    echo -e "${_JETTY_RED}Error: File not found: $workflow_file${_JETTY_NC}" >&2
    return 1
  fi

  _jetty_check_token || return 1
  _jetty_check_jq || return 1

  local workflow
  workflow=$(cat "$workflow_file")

  local payload
  payload=$(jq -n --argjson workflow "$workflow" '{workflow: $workflow}')

  curl -sf -X PUT -H "$(_jetty_auth_header)" \
    -H "Content-Type: application/json" \
    "$JETTY_API_URL/api/v1/tasks/$collection/$task_name" \
    -d "$payload" | jq
}

# Delete a task
# Usage: jetty_delete_task <collection> <task>
jetty_delete_task() {
  local collection="$1"
  local task="$2"
  if [ -z "$collection" ] || [ -z "$task" ]; then
    echo "Usage: jetty_delete_task <collection> <task>" >&2
    return 1
  fi

  _jetty_check_token || return 1

  echo -e "${_JETTY_YELLOW}Deleting task: $collection/$task${_JETTY_NC}"
  read -p "Are you sure? (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    curl -sf -X DELETE -H "$(_jetty_auth_header)" \
      "$JETTY_API_URL/api/v1/tasks/$collection/$task" | jq
    echo -e "${_JETTY_GREEN}Task deleted${_JETTY_NC}"
  else
    echo "Cancelled"
  fi
}

# =============================================================================
# Run Workflows
# =============================================================================

# Run a workflow asynchronously
# Usage: jetty_run <collection> <task> [init_params_json]
jetty_run() {
  local collection="$1"
  local task="$2"
  local params="${3:-{}}"

  if [ -z "$collection" ] || [ -z "$task" ]; then
    echo "Usage: jetty_run <collection> <task> [init_params_json]" >&2
    return 1
  fi

  _jetty_check_token || return 1
  _jetty_check_jq || return 1

  curl -sf -X POST -H "$(_jetty_auth_header)" \
    -F "init_params=$params" \
    "$JETTY_API_URL/api/v1/run/$collection/$task" | jq
}

# Run a workflow synchronously (waits for completion)
# Usage: jetty_run_sync <collection> <task> [init_params_json]
jetty_run_sync() {
  local collection="$1"
  local task="$2"
  local params="${3:-{}}"

  if [ -z "$collection" ] || [ -z "$task" ]; then
    echo "Usage: jetty_run_sync <collection> <task> [init_params_json]" >&2
    return 1
  fi

  _jetty_check_token || return 1
  _jetty_check_jq || return 1

  echo -e "${_JETTY_BLUE}Running $collection/$task (sync)...${_JETTY_NC}"
  curl -sf -X POST -H "$(_jetty_auth_header)" \
    -F "init_params=$params" \
    "$JETTY_API_URL/api/v1/run-sync/$collection/$task" | jq
}

# Run a workflow with a file upload
# Usage: jetty_run_with_file <collection> <task> <file_path> [init_params_json]
jetty_run_with_file() {
  local collection="$1"
  local task="$2"
  local file_path="$3"
  local params="${4:-{}}"

  if [ -z "$collection" ] || [ -z "$task" ] || [ -z "$file_path" ]; then
    echo "Usage: jetty_run_with_file <collection> <task> <file_path> [init_params_json]" >&2
    return 1
  fi

  if [ ! -f "$file_path" ]; then
    echo -e "${_JETTY_RED}Error: File not found: $file_path${_JETTY_NC}" >&2
    return 1
  fi

  _jetty_check_token || return 1
  _jetty_check_jq || return 1

  echo -e "${_JETTY_BLUE}Running $collection/$task with file upload...${_JETTY_NC}"
  curl -sf -X POST -H "$(_jetty_auth_header)" \
    -F "init_params=$params" \
    -F "files=@$file_path" \
    "$JETTY_API_URL/api/v1/run/$collection/$task" | jq
}

# =============================================================================
# Monitoring & Trajectories
# =============================================================================

# Get workflow logs
# Usage: jetty_logs <workflow_id>
jetty_logs() {
  local workflow_id="$1"
  if [ -z "$workflow_id" ]; then
    echo "Usage: jetty_logs <workflow_id>" >&2
    return 1
  fi

  _jetty_check_token || return 1
  _jetty_check_jq || return 1

  curl -sf -H "$(_jetty_auth_header)" \
    "$JETTY_API_URL/api/v1/workflows-logs/$workflow_id" | jq
}

# List recent trajectories for a task
# Usage: jetty_trajectories <collection> <task> [limit]
jetty_trajectories() {
  local collection="$1"
  local task="$2"
  local limit="${3:-10}"

  if [ -z "$collection" ] || [ -z "$task" ]; then
    echo "Usage: jetty_trajectories <collection> <task> [limit]" >&2
    return 1
  fi

  _jetty_check_token || return 1
  _jetty_check_jq || return 1

  curl -sf -H "$(_jetty_auth_header)" \
    "$JETTY_API_URL/api/v1/db/trajectories/$collection/$task?limit=$limit" | jq -r '.trajectories[] | "\(.trajectory_id)\t\(.status)\t\(.created // "N/A")"' | column -t -s $'\t'
}

# Get trajectory details
# Usage: jetty_trajectory <collection> <task> <trajectory_id>
jetty_trajectory() {
  local collection="$1"
  local task="$2"
  local trajectory_id="$3"

  if [ -z "$collection" ] || [ -z "$task" ] || [ -z "$trajectory_id" ]; then
    echo "Usage: jetty_trajectory <collection> <task> <trajectory_id>" >&2
    return 1
  fi

  _jetty_check_token || return 1
  _jetty_check_jq || return 1

  curl -sf -H "$(_jetty_auth_header)" \
    "$JETTY_API_URL/api/v1/db/trajectory/$collection/$task/$trajectory_id" | jq
}

# Get the output from the last step of the most recent trajectory
# Usage: jetty_last_output <collection> <task>
jetty_last_output() {
  local collection="$1"
  local task="$2"

  if [ -z "$collection" ] || [ -z "$task" ]; then
    echo "Usage: jetty_last_output <collection> <task>" >&2
    return 1
  fi

  _jetty_check_token || return 1
  _jetty_check_jq || return 1

  local traj_id
  traj_id=$(curl -sf -H "$(_jetty_auth_header)" \
    "$JETTY_API_URL/api/v1/db/trajectories/$collection/$task?limit=1" | jq -r '.trajectories[0].trajectory_id')

  if [ -z "$traj_id" ] || [ "$traj_id" == "null" ]; then
    echo -e "${_JETTY_RED}No trajectories found${_JETTY_NC}" >&2
    return 1
  fi

  curl -sf -H "$(_jetty_auth_header)" \
    "$JETTY_API_URL/api/v1/db/trajectory/$collection/$task/$traj_id" | jq '.steps | to_entries | last | .value.outputs'
}

# Get workflow statistics
# Usage: jetty_stats <collection> <task>
jetty_stats() {
  local collection="$1"
  local task="$2"

  if [ -z "$collection" ] || [ -z "$task" ]; then
    echo "Usage: jetty_stats <collection> <task>" >&2
    return 1
  fi

  _jetty_check_token || return 1
  _jetty_check_jq || return 1

  curl -sf -H "$(_jetty_auth_header)" \
    "$JETTY_API_URL/api/v1/db/stats/$collection/$task" | jq
}

# =============================================================================
# Step Templates
# =============================================================================

# List all available step templates
# Usage: jetty_templates
jetty_templates() {
  _jetty_check_jq || return 1

  curl -sf "$JETTY_API_URL/api/v1/step-templates" | jq -r '.[] | "\(.name)\t\(.description // "No description")"' | column -t -s $'\t'
}

# Get details for a step template
# Usage: jetty_template <activity_name>
jetty_template() {
  local activity="$1"
  if [ -z "$activity" ]; then
    echo "Usage: jetty_template <activity_name>" >&2
    return 1
  fi

  _jetty_check_jq || return 1

  curl -sf "$JETTY_API_URL/api/v1/step-templates/$activity" | jq
}

# Search step templates by keyword
# Usage: jetty_search_templates <keyword>
jetty_search_templates() {
  local keyword="$1"
  if [ -z "$keyword" ]; then
    echo "Usage: jetty_search_templates <keyword>" >&2
    return 1
  fi

  _jetty_check_jq || return 1

  curl -sf "$JETTY_API_URL/api/v1/step-templates" | jq -r ".[] | select(.name | contains(\"$keyword\") or (.description // \"\" | contains(\"$keyword\"))) | \"\(.name)\t\(.description // \"No description\")\""  | column -t -s $'\t'
}

# =============================================================================
# Datasets & Models
# =============================================================================

# List datasets
# Usage: jetty_datasets <collection>
jetty_datasets() {
  local collection="$1"
  if [ -z "$collection" ]; then
    echo "Usage: jetty_datasets <collection>" >&2
    return 1
  fi

  _jetty_check_token || return 1
  _jetty_check_jq || return 1

  curl -sf -H "$(_jetty_auth_header)" \
    "$JETTY_API_URL/api/v1/datasets/$collection" | jq -r '.[] | "\(.name)\t\(.description // "No description")"' | column -t -s $'\t'
}

# List models
# Usage: jetty_models <collection>
jetty_models() {
  local collection="$1"
  if [ -z "$collection" ]; then
    echo "Usage: jetty_models <collection>" >&2
    return 1
  fi

  _jetty_check_token || return 1
  _jetty_check_jq || return 1

  curl -sf -H "$(_jetty_auth_header)" \
    "$JETTY_API_URL/api/v1/models/$collection/" | jq -r '.[] | "\(.name)\t\(.description // "No description")"' | column -t -s $'\t'
}

# =============================================================================
# Quick Actions
# =============================================================================

# Quick chat with an LLM through Jetty
# Usage: jetty_chat <collection> <prompt> [model]
jetty_chat() {
  local collection="$1"
  local prompt="$2"
  local model="${3:-gpt-4o-mini}"

  if [ -z "$collection" ] || [ -z "$prompt" ]; then
    echo "Usage: jetty_chat <collection> <prompt> [model]" >&2
    return 1
  fi

  _jetty_check_token || return 1
  _jetty_check_jq || return 1

  local params
  params=$(jq -n --arg prompt "$prompt" --arg model "$model" '{prompt: $prompt, model: $model}')

  # Try to find a chat task, or use litellm-chat if it exists
  local chat_task="${JETTY_CHAT_TASK:-quick-chat}"

  echo -e "${_JETTY_BLUE}Sending to $model...${_JETTY_NC}"
  local result
  result=$(curl -sf -X POST -H "$(_jetty_auth_header)" \
    -F "init_params=$params" \
    "$JETTY_API_URL/api/v1/run-sync/$collection/$chat_task" 2>/dev/null)

  if [ $? -ne 0 ]; then
    echo -e "${_JETTY_YELLOW}Note: Create a 'quick-chat' task or set JETTY_CHAT_TASK${_JETTY_NC}" >&2
    return 1
  fi

  echo "$result" | jq -r '.steps | to_entries | last | .value.outputs.text // .value.outputs.content // .value.outputs'
}

# =============================================================================
# Help
# =============================================================================

jetty_help() {
  cat << 'EOF'
Jetty CLI Helper Functions
==========================

SETUP
  jetty_health              Check API connectivity and token status

COLLECTIONS
  jetty_collections         List all accessible collections
  jetty_collection <coll>   Get collection details

TASKS (WORKFLOWS)
  jetty_tasks <coll>                           List tasks in collection
  jetty_task <coll> <task>                     Get task details (full JSON)
  jetty_workflow <coll> <task>                 Get just the workflow JSON
  jetty_create_task <coll> <name> <file> [desc]  Create task from JSON file
  jetty_update_task <coll> <name> <file>       Update task workflow
  jetty_delete_task <coll> <task>              Delete a task

RUNNING WORKFLOWS
  jetty_run <coll> <task> [params]             Run async (returns immediately)
  jetty_run_sync <coll> <task> [params]        Run sync (waits for result)
  jetty_run_with_file <coll> <task> <file>     Run with file upload

MONITORING
  jetty_logs <workflow_id>                     Get workflow logs
  jetty_trajectories <coll> <task> [limit]     List recent trajectories
  jetty_trajectory <coll> <task> <traj_id>     Get trajectory details
  jetty_last_output <coll> <task>              Get last step output
  jetty_stats <coll> <task>                    Get workflow statistics

STEP TEMPLATES
  jetty_templates                              List all step templates
  jetty_template <activity>                    Get template details
  jetty_search_templates <keyword>             Search templates

DATASETS & MODELS
  jetty_datasets <coll>                        List datasets
  jetty_models <coll>                          List models

QUICK ACTIONS
  jetty_chat <coll> <prompt> [model]           Quick LLM chat

Environment Variables:
  JETTY_API_TOKEN    - Required. Your API token (mlc_...)
  JETTY_API_URL      - Override API URL (default: https://flows-api.jetty.io)
  JETTY_CHAT_TASK    - Task name for jetty_chat (default: quick-chat)

Examples:
  # List your collections
  jetty_collections

  # List tasks in a collection
  jetty_tasks myproject

  # Run a workflow
  jetty_run_sync myproject my-task '{"prompt": "Hello"}'

  # Check recent runs
  jetty_trajectories myproject my-task 5
EOF
}

# Print welcome message when sourced
echo -e "${_JETTY_GREEN}Jetty CLI loaded.${_JETTY_NC} Run ${_JETTY_BLUE}jetty_help${_JETTY_NC} for available commands."
