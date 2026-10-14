#!/usr/bin/env python3
"""Register the Jetty task an evals v2 runbook runs under, before a remote run.

Usage: register_runbook_task.py RUNBOOK.md COLLECTION TASK

Jetty runs a runbook's Code Checks, appends the note naming who runs which
check, and computes the verdict only on a run whose task carries
``init_params.runbook_evals_version: 2``; any other run is read as v1. The run
step also reads ``code_checks``, ``strict_evaluation``, ``mcp_servers`` and
``snapshot`` from the task's ``init_params`` only. A task the chat-completions
endpoint auto-creates on a first remote run carries none of them, so this
script registers the task first:

- a runbook without a ``## Code Checks`` section (v1) is left alone;
- no task yet: create it with the workflow built from the frontmatter, the
  same one create-runbook's Step 5b registers;
- a task holding the chat-flow stub (``completion`` / ``passthrough``):
  replace the stub with that workflow;
- a task with a runbook workflow: stamp it v2 and add the frontmatter's
  ``code_checks``, ``strict_evaluation`` and ``mcp_servers`` (with their
  ``*_path`` entries) where it has none, keeping everything else it has;
- any other workflow is not a runbook task, and is left alone with a warning.

The token is read from ``JETTY_API_TOKEN`` or ``~/.config/jetty/token``. Needs
PyYAML (``uv run --with pyyaml python3 ...`` when it is not installed).
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import yaml

JETTY_API = os.getenv("JETTY_API", "https://flows-api.jetty.io").rstrip("/")
EVALS_VERSION = 2
CODE_CHECKS_HEADING = re.compile(r"^##\s+(step\s+\d+\s*[:.]\s*)?code checks\s*$", re.I)
# Cloudflare in front of the API rejects urllib's default User-Agent (error 1010)
USER_AGENT = "jetty-skill-register-runbook-task/1.0"
SECRET_KEY = re.compile(r"auth|token|secret|password|api[-_]?key|cookie", re.I)


def frontmatter(text: str) -> dict:
    m = re.match(r"^---\s*\n(.*?)\n---\s*(\n|$)", text, re.S)
    fm = (yaml.safe_load(m.group(1)) if m else None) or {}
    return fm if isinstance(fm, dict) else {}


def is_evals_v2(text: str) -> bool:
    """A v2 runbook has a ``## Code Checks`` section (outside any fence)."""
    fence = None
    for line in text.splitlines():
        marker = re.match(r"^\s*(```|~~~)", line)
        if marker:
            if fence is None:
                fence = marker.group(1)
            elif marker.group(1) == fence and not line.strip()[3:].strip():
                fence = None
            continue
        if fence is None and CODE_CHECKS_HEADING.match(line):
            return True
    return False


def build_workflow(fm: dict) -> dict:
    """The runbook workflow create-runbook's Step 5b registers (keep the two in step)."""
    init: dict = {
        "agent": fm.get("agent") or "claude-code",
        "model": fm.get("model") or "anthropic/claude-sonnet-4.6",
        "snapshot": fm.get("snapshot") or "python312-uv",
    }
    provider = fm.get("model_provider") or (None if fm.get("model") else "openrouter")
    if provider:
        init["model_provider"] = provider
    # MCP servers: the top-level block and code_checks.mcp_servers (the top level wins a clash),
    # credentials dropped, because a definition is stored with the task
    cc = fm.get("code_checks") if isinstance(fm.get("code_checks"), dict) else {}
    servers: dict = {}
    for block in (fm.get("mcp_servers"), cc.get("mcp_servers")):
        for name, definition in (block or {}).items() if isinstance(block, dict) else []:
            if name in servers or not isinstance(definition, dict):
                continue
            definition = dict(definition)
            for key in ("headers", "env"):
                if isinstance(definition.get(key), dict):
                    kept = {k: v for k, v in definition[key].items() if not SECRET_KEY.search(str(k))}
                    if kept:
                        definition[key] = kept
                    else:
                        definition.pop(key)
            servers[name] = definition
    if servers:
        init["mcp_servers"] = servers
    if "code_checks" in fm:
        init["code_checks"] = {"sources": cc.get("sources") or [], "timeout_sec": cc.get("timeout_sec") or 120}
    if isinstance(fm.get("strict_evaluation"), bool):
        init["strict_evaluation"] = fm["strict_evaluation"]
    init.update({"runbook_evals_version": EVALS_VERSION, "vars": {}, "file_paths": []})

    run = {
        "activity": "runbook",
        "agent_path": "init_params.agent",
        "model_path": "init_params.model",
        "snapshot_path": "init_params.snapshot",
        "instruction_path": "init_params.instruction",
        "template_variables_path": "init_params.vars",
        "files_path": "init_params.file_paths",
        "mcp_servers_path": "init_params.mcp_servers",
        "code_checks_path": "init_params.code_checks",
        "strict_evaluation_path": "init_params.strict_evaluation",
        "cpus": 4,
        "memory": "8G",
        "timeout_sec": 1200,
        "network_enabled": True,
    }
    if "model_provider" in init:
        run["model_provider_path"] = "init_params.model_provider"
    return {"init_params": init, "steps": ["run"], "step_configs": {"run": run}}


def is_chat_stub(workflow: dict) -> bool:
    return (
        workflow.get("steps") == ["completion"]
        and ((workflow.get("step_configs") or {}).get("completion") or {}).get("activity") == "passthrough"
    )


# What an existing runbook task gains from the frontmatter: the evals settings only. Its agent,
# model, provider and snapshot stay as stored (adding a model_provider would change its routing)
EVALS_KEYS = ("code_checks", "strict_evaluation", "mcp_servers")


def fill_in(stored: dict, built: dict) -> list[str]:
    """Stamp a stored runbook workflow v2 and add the evals settings it lacks, in place.

    Returns what changed.
    """
    changed = []
    init = stored.setdefault("init_params", {})
    if init.get("runbook_evals_version") != EVALS_VERSION:
        init["runbook_evals_version"] = EVALS_VERSION
        changed.append("init_params.runbook_evals_version")
    for key in EVALS_KEYS:
        if key in built["init_params"] and key not in init:
            init[key] = built["init_params"][key]
            changed.append(f"init_params.{key}")
    for name, cfg in (stored.get("step_configs") or {}).items():
        if not isinstance(cfg, dict) or cfg.get("activity") != "runbook":
            continue
        for key in EVALS_KEYS:
            # A literal value on the step, or an existing path, wins
            if key in init and key not in cfg and f"{key}_path" not in cfg:
                cfg[f"{key}_path"] = f"init_params.{key}"
                changed.append(f"step_configs.{name}.{key}_path")
    return changed


def request(method: str, path: str, token: str, body: dict | None = None) -> tuple[int, dict]:
    req = urllib.request.Request(
        f"{JETTY_API}{path}",
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json", "User-Agent": USER_AGENT},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, {"detail": e.read().decode(errors="replace")[:500]}


def main() -> int:
    if len(sys.argv) != 4:
        print(__doc__.split("\n\n")[1], file=sys.stderr)
        return 2
    runbook, collection, task = sys.argv[1:]
    text = Path(runbook).read_text(encoding="utf-8")
    if not is_evals_v2(text):
        print(f"{runbook} has no Code Checks section (a v1 runbook): task left as is")
        return 0
    token = os.getenv("JETTY_API_TOKEN") or Path("~/.config/jetty/token").expanduser().read_text().strip()
    built = build_workflow(frontmatter(text))
    path = f"/api/v1/tasks/{urllib.parse.quote(collection, safe='')}/{urllib.parse.quote(task, safe='')}"

    status, existing = request("GET", path, token)
    if status == 404:
        status, body = request("POST", f"/api/v1/tasks/{urllib.parse.quote(collection, safe='')}", token, {
            "name": task,
            "workflow": built,
            "description": "Runbook task (registered with file uploads enabled)",
            "has_file_uploads": True,
            "is_chat_flow": True,
            "is_private": True,
            "entity_type": "task",
        })
        action = "created the task"
    elif status == 200:
        workflow = existing.get("workflow") or {}
        if is_chat_stub(workflow):
            status, body = request("PUT", path, token, {"workflow": built})
            action = "replaced its chat-flow stub with the runbook workflow"
        elif any(isinstance(c, dict) and c.get("activity") == "runbook"
                 for c in (workflow.get("step_configs") or {}).values()):
            changed = fill_in(workflow, built)
            if not changed:
                print(f"{collection}/{task} is already registered as runbook evals v2")
                return 0
            status, body = request("PUT", path, token, {"workflow": workflow})
            action = f"added {', '.join(changed)}"
        else:
            print(f"warning: {collection}/{task} has no runbook step; left as is, and its runs stay v1",
                  file=sys.stderr)
            return 0
    else:
        print(f"error: GET {path} returned {status}: {existing.get('detail')}", file=sys.stderr)
        return 1

    if status not in (200, 201):
        print(f"error: registering {collection}/{task} failed: {status} {body.get('detail')}", file=sys.stderr)
        return 1
    print(f"{collection}/{task}: {action}; its runs are runbook evals v2")
    return 0


if __name__ == "__main__":
    sys.exit(main())
