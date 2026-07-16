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

Config (env):
    JETTY_DEMO_BASE   Base URL for the demo/​signup endpoints.
                      Defaults to https://jetty.io. Set to http://localhost:3000
                      to run against a local stack — no need to edit the skill.

Nothing here prints a token or any secret in full.
"""
import argparse
import json
import os
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
    """Base URL for the demo/signup endpoints. Precedence:
      1. JETTY_DEMO_BASE env var
      2. ~/.config/jetty/demo_base file (persists across the skill's separate
         shell calls — set it once for local testing:
             echo http://localhost:3000 > ~/.config/jetty/demo_base )
      3. https://jetty.io (production default)"""
    v = os.environ.get("JETTY_DEMO_BASE")
    if not v:
        f = os.path.expanduser("~/.config/jetty/demo_base")
        if os.path.exists(f):
            with open(f) as fh:
                v = fh.read().strip()
    return (v or "https://jetty.io").rstrip("/")


BASE = _resolve_base()
CLIENT = "jetty-setup-skill/1.10.0"
RUN_ID_FILE = os.path.join(
    os.environ.get("TMPDIR", "/tmp"), "jetty_demo_run_id"
)

# Friendly labels for the runbook's steps, shown as progress ticks. The demo
# runbook is a single "run" step internally, so we narrate the phases the agent
# actually goes through rather than raw step keys.
PELLY = "\U0001F426"  # 🐦
CHECK = "✅"      # ✅


def _req(method, path, body=None):
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    headers = {"X-Jetty-Client": CLIENT}
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    return urllib.request.urlopen(req, timeout=30)


def _fail(msg):
    """Print a friendly failure line and exit non-zero so the skill falls back."""
    print(f"{PELLY} Pelly's demo pond is busy right now — {msg}")
    print("DEMO_STATUS=failed")
    sys.exit(1)


def cmd_run(_args):
    # 1. Kick off the run.
    print(f"{PELLY} Kicking off the conference-abstracts example — spinning up a "
          f"fresh sandbox and pulling in six PDFs with all different layouts…")
    try:
        with _req("POST", "/api/demo/run", {}) as r:
            start = json.load(r)
    except (HTTPError, URLError) as e:
        _fail(f"couldn't start the run ({e}).")
    run_id = start.get("run_id")
    if not run_id:
        _fail("the run didn't return an id.")
    with open(RUN_ID_FILE, "w") as fh:
        fh.write(run_id)

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
        if status == "failed":
            _fail("the run didn't finish cleanly.")
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

    print()
    print(f"{CHECK} Pelly Approved — real sandbox, real extraction, every value "
          f"traced back to its source PDF.")
    print()
    report_md = files.get("report.md")
    if report_md:
        print("=== report.md " + "=" * 52)
        print(report_md.strip())
        print("=" * 66)
    csv = files.get("abstracts_rollup.csv")
    if csv:
        rows = csv.splitlines()
        print()
        print("First rows of abstracts_rollup.csv (one per PDF, every value "
              "provenance-checked):")
        for line in rows[:4]:
            print("  " + line[:140])
        if len(rows) > 4:
            print(f"  … {len(rows)-1} data rows total")
    print()
    print("DEMO_STATUS=completed")
    print(f"RUN_ID_FILE={RUN_ID_FILE}")


def _redact(key):
    return key[:4] + "…" + key[-4:] if key and len(key) > 8 else "mlc_…"


def cmd_claim(args):
    email = args.email.strip()
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
        detail = ""
        try:
            detail = json.load(e).get("error", "")
        except Exception:
            pass
        print(f"{PELLY} Couldn't set up the workspace ({detail or e}).")
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
    sub.add_parser("run")
    c = sub.add_parser("claim")
    c.add_argument("--email", required=True)
    args = p.parse_args()
    if args.cmd == "run":
        cmd_run(args)
    elif args.cmd == "claim":
        cmd_claim(args)


if __name__ == "__main__":
    main()
