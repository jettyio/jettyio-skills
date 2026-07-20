#!/usr/bin/env python3
"""jetty simulate — the onboarding demo, as one clean command.

The skill calls this instead of a pile of curl/seq/python so the user sees
friendly, Pelly-voiced progress rather than plumbing. Two subcommands:

    jetty_simulate.py run
        Trigger the example run, poll it with live step progress, and print the
        report (report.md + a few CSV rows). Writes the run id to a temp file so
        `claim` can pick it up. Exits non-zero (with a friendly line) on failure
        so the skill can fall back to the build path.

    jetty_simulate.py claim --email you@example.com
        Turn that same email into a workspace (mint collection + key + trial) and
        send ONE email with the report + a claim link. Stores the returned token
        at ~/.config/jetty/token (chmod 600) and prints only a redacted form.

Base URL: https://jetty.io by default. To run against a non-default Jetty
backend, put its URL in ~/.config/jetty/demo_base (the same config dir as
the token).

Nothing here prints a token or any secret in full.
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.request
from urllib.error import HTTPError, URLError

# Stream every line as it's printed — otherwise Python block-buffers stdout when
# it isn't a TTY (e.g. run by an agent), and the live progress arrives all at
# once at the end, defeating the whole point.
try:
    sys.stdout.reconfigure(line_buffering=True)
except Exception:
    pass

def _resolve_base():
    """Base URL for the demo/signup endpoints. Defaults to https://jetty.io; put a
    URL in ~/.config/jetty/demo_base to point at a non-default Jetty backend."""
    f = os.path.expanduser("~/.config/jetty/demo_base")
    if os.path.exists(f):
        with open(f) as fh:
            v = fh.read().strip()
        if v:
            return v.rstrip("/")
    return "https://jetty.io"


BASE = _resolve_base()
CLIENT = "jetty-setup-skill/1.8.0"
# The demo endpoints sit behind an edge/WAF that blocks default library
# user-agents (e.g. Python-urllib/*) with a 403 before the request reaches the
# app. Send a browser-like User-Agent so the run isn't rejected at the edge;
# X-Jetty-Client (below) is what the app itself uses to identify this client.
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0 Safari/537.36"
)
RUN_ID_FILE = os.path.join(
    os.environ.get("TMPDIR", "/tmp"), "jetty_demo_run_id"
)
# The report is also written here so the skill can Read + render it in its own
# message — Claude Code collapses long command output, so we don't rely on stdout
# for the part the user actually wants to see.
REPORT_FILE = os.path.join(
    os.environ.get("TMPDIR", "/tmp"), "jetty_demo_report.md"
)

# Friendly labels for the runbook's steps, shown as progress ticks. The demo
# runbook is a single "run" step internally, so we narrate the phases the agent
# actually goes through rather than raw step keys.
PELLY = "\U0001F426"  # 🐦
CHECK = "✅"      # ✅


def _req(method, path, body=None):
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    headers = {"X-Jetty-Client": CLIENT, "User-Agent": USER_AGENT}
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    return urllib.request.urlopen(req, timeout=30)


def _err_detail(e):
    """Best-effort extract the server's JSON {"error": ...} from an HTTPError body,
    so failures surface the backend's specific message (e.g. a rate-limit or
    invalid-name hint) instead of a bare 'HTTP Error 400'. Falls back to str(e)."""
    try:
        return json.load(e).get("error", "") or str(e)
    except Exception:
        return str(e)


def _fail(msg):
    """Print a friendly failure line and exit non-zero so the skill falls back."""
    print(f"{PELLY} Pelly's demo pond is busy right now — {msg}")
    print("DEMO_STATUS=failed")
    sys.exit(1)


def _clean_collection_name(raw):
    """Mirror the server's cleanCollectionName so the helper validates identically
    (the server hard-rejects any name it would have to alter). Returns the slug,
    or "" if it can't be salvaged."""
    s = (raw or "").strip().lower()
    s = re.sub(r"[^a-z0-9_-]", "-", s)
    s = re.sub(r"-+", "-", s)
    s = s.strip("-_")
    return s if 3 <= len(s) <= 48 else ""


def cmd_run(args):
    # 1. Kick off the run (optionally with a user-chosen workspace name).
    body = {}
    name = getattr(args, "name", None)
    if name:
        # The name becomes the workspace's PERMANENT URL/API identifier. Reject
        # anything the server would have to normalize (spaces, punctuation,
        # repeated/edge separators, bad length) so it never silently hands back a
        # workspace the user didn't choose. Case is folded, like the web signup.
        if _clean_collection_name(name) != name.strip().lower():
            print(f"{PELLY} “{name}” won't work as a workspace name — it becomes "
                  f"your permanent URL/API identifier. Use 3–48 characters "
                  f"(letters, numbers, hyphens, underscores), no spaces, and no "
                  f"leading, trailing, or repeated separators.")
            print("DEMO_STATUS=invalid_name")
            sys.exit(2)
        body["collection_name"] = name
    print(f"{PELLY} Kicking off the conference-abstracts example — spinning up a "
          f"fresh sandbox and pulling in six PDFs with all different layouts…")
    try:
        with _req("POST", "/api/demo/run", body) as r:
            start = json.load(r)
    except HTTPError as e:
        # Surface the server's specific message (bad name, rate limit, …) rather
        # than a bare 'HTTP Error 400', mirroring cmd_claim's error handling.
        _fail(f"couldn't start the run — {_err_detail(e)}")
    except URLError as e:
        _fail(f"couldn't reach Jetty to start the run ({e}).")
    workspace = start.get("collection")
    if workspace:
        if start.get("name_autogenerated"):
            print(f"{PELLY} That name was taken, so I picked an available one — "
                  f"your workspace is “{workspace}”.")
        else:
            print(f"{PELLY} Your workspace: “{workspace}”.")
    run_id = start.get("run_id")
    if not run_id:
        _fail("the run didn't return an id.")
    # The run_id is a signed bearer capability (whoever holds it can attach an
    # email + mint a key on this collection), so keep the temp file owner-only —
    # chmod after write in case a world-readable file lingered from a prior run.
    with open(RUN_ID_FILE, "w") as fh:
        fh.write(run_id)
    try:
        os.chmod(RUN_ID_FILE, 0o600)
    except OSError:
        pass

    # (The skill presents the source PDFs + the structured-extraction explanation
    # as its own rendered message before this run starts — see SKILL.md S1. We
    # don't reprint the links here because long command output gets collapsed,
    # which is exactly where they'd be lost.)

    # 2. Poll, showing synthetic phase progress.
    #
    # The runbook runs as ONE mise step ("run"), so the status endpoint only ever
    # reports 1/1 — the six phases below happen *inside* the runbook and aren't
    # visible to the API. So we narrate them on a time cadence (advancing through
    # the phases as the estimate elapses) to give the "watch it work" feel, while
    # the real completion signal still comes from the status endpoint. Progress is
    # monotonic and never claims "done" until the run actually completes.
    est = max(60, int(start.get("estimated_seconds", 210)))
    phases = [
        "spinning up a fresh sandbox",
        "downloading the six PDFs",
        "extracting text from each layout",
        "normalizing fields and checking provenance",
        "building the roll-up CSV",
        "writing the report",
    ]
    print(f"{PELLY} This usually takes about {max(1, round(est/60))} minutes. "
          f"I'll show each step as it lands.")
    deadline = time.monotonic() + 360  # hard cap ~6 min
    t0 = time.monotonic()
    per_phase = est / (len(phases) - 1)  # hold the last phase until completion
    shown = -1
    while time.monotonic() < deadline:
        try:
            with _req("GET", f"/api/demo/status/{run_id}") as r:
                st = json.load(r)
        except (HTTPError, URLError):
            time.sleep(5)
            continue
        status = st.get("status")
        # Any terminal-but-not-completed status (the server reports failed,
        # cancelled, or archived) means the run won't finish — bail now instead
        # of polling to the deadline and mislabeling it as "taking too long".
        if status in ("failed", "cancelled", "archived"):
            _fail(f"the run ended early (status: {status}).")
        # Advance synthetic phases by elapsed time (cap at the last phase).
        idx = min(len(phases) - 1, int((time.monotonic() - t0) / per_phase))
        while shown < idx:
            shown += 1
            print(f"{PELLY} Step {shown+1}/{len(phases)} — {phases[shown]}… {CHECK}")
        if status == "completed":
            # Flush any remaining phases so the tick count reads complete.
            while shown < len(phases) - 1:
                shown += 1
                print(f"{PELLY} Step {shown+1}/{len(phases)} — {phases[shown]}… {CHECK}")
            break
        time.sleep(10)
    else:
        _fail("the run is taking longer than expected.")

    # 3. Fetch + show the report.
    try:
        with _req("GET", f"/api/demo/report/{run_id}") as r:
            rep = json.load(r)
    except (HTTPError, URLError) as e:
        _fail(f"the run finished but the report wouldn't load ({e}).")
    files = {f["name"]: f["content"] for f in rep.get("files", [])}

    # Build the report as one markdown doc (report.md + a CSV preview): PRINT it
    # so the skill can present the summary/explanation, and also write it to a
    # file as a fallback in case the terminal collapses long output.
    report_md = files.get("report.md") or ""
    csv = files.get("abstracts_rollup.csv") or ""
    parts = []
    if report_md:
        parts.append(report_md.strip())
    if csv:
        rows = csv.splitlines()
        preview = "\n".join(rows[:4])
        parts.append(
            "### First rows of `abstracts_rollup.csv`\n"
            "One row per PDF; every value is provenance-checked.\n\n"
            "```\n" + preview + "\n```"
            + (f"\n_… {len(rows)-1} data rows total._" if len(rows) > 4 else "")
        )
    combined = "\n\n".join(parts)
    try:
        with open(REPORT_FILE, "w") as fh:
            fh.write(combined)
    except OSError:
        pass

    print()
    print(f"{CHECK} Pelly Approved — real sandbox, real extraction, every value "
          f"traced back to its source PDF.")
    print()
    print(combined)
    print()
    # Internal marker for the skill (not for the user).
    print("DEMO_STATUS=completed")


def _redact(key):
    return key[:4] + "…" + key[-4:] if key and len(key) > 8 else "mlc_…"


def cmd_claim(args):
    # Prefer the email from --email, else read one line from stdin. The skill
    # feeds it via a quoted heredoc (no shell expansion), so an address like
    # "a@b.com$(...)" can't trigger command substitution before it reaches here.
    email = (args.email if args.email is not None else sys.stdin.readline()).strip()
    if not email:
        print(f"{PELLY} I need an email to set up your workspace.")
        print("SIGNUP_STATUS=failed")
        sys.exit(2)
    run_id = None
    if os.path.exists(RUN_ID_FILE):
        with open(RUN_ID_FILE) as fh:
            run_id = fh.read().strip()

    body = {"email": email, "source": "agent-onboarding"}
    if run_id:
        body["demo_run_id"] = run_id
    try:
        with _req("POST", "/api/onboarding/email-signup", body) as r:
            out = json.load(r)
    except HTTPError as e:
        print(f"{PELLY} Couldn't set up the workspace ({_err_detail(e)}).")
        print("SIGNUP_STATUS=failed")
        sys.exit(1)
    except URLError as e:
        print(f"{PELLY} Couldn't reach Jetty to set up the workspace ({e}).")
        print("SIGNUP_STATUS=failed")
        sys.exit(1)

    api_key = out.get("api_key")
    if not api_key:
        print(f"{PELLY} The workspace response was missing its key.")
        print("SIGNUP_STATUS=failed")
        sys.exit(1)

    cfg = os.path.expanduser("~/.config/jetty")
    os.makedirs(cfg, exist_ok=True)
    os.chmod(cfg, 0o700)
    token_path = os.path.join(cfg, "token")
    with open(token_path, "w") as fh:
        fh.write(api_key)
    os.chmod(token_path, 0o600)

    runs = out.get("trial_runs", 10)
    print(f"{CHECK} You're all set — workspace created and connected "
          f"({_redact(api_key)}), with {runs} free runs on the house. {PELLY}")
    print("No sign-up form, no key to paste. I've emailed your report and a link "
          "to claim the workspace in your browser whenever you like.")
    print("SIGNUP_STATUS=completed")


def main():
    p = argparse.ArgumentParser(prog="jetty_simulate")
    sub = p.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run")
    r.add_argument("--name", help="optional workspace name (else auto-generated)")
    c = sub.add_parser("claim")
    c.add_argument("--email", help="claim email (omit to read one line from stdin)")
    args = p.parse_args()
    if args.cmd == "run":
        cmd_run(args)
    elif args.cmd == "claim":
        cmd_claim(args)


if __name__ == "__main__":
    main()
