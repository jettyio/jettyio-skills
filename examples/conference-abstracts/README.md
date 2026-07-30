# Conference Abstracts — Jetty example runbook

A ready-to-run Jetty runbook that turns a bucket of messy PDFs into structured,
human-verifiable data. It's a good first thing to run to see what Jetty does:
inputs go in, evaluated structured output comes out.

## What it does

Six conference-abstract PDFs — each laid out differently, on purpose — live in a
public bucket. The runbook downloads them, extracts text, and normalizes each into
one shared JSON schema where **every field carries a provenance pointer** (the page
and a verbatim source quote). It writes:

- `abstracts/<slug>.json` — one normalized record per PDF, with per-field provenance
- `abstracts_rollup.csv` — one row per PDF, so you can verify everything at a glance
- `report.md`, `summary.md`, `validation_report.json`

The programmatic evaluation asserts that every provenance quote is a **verbatim
substring** of the source text — so the result isn't just extraction, it's
extraction you can audit.

## Files

| Path | Role |
|------|------|
| `runbook.md` | The runbook itself |
| `fixtures/*.pdf` | The six input abstract PDFs |

## The inputs are deliberately diverse

The six layouts differ so extraction can't just pattern-match one shape:

1. Two-column, serif, header metadata, keyword line
2. Single-column, sans, structured sections (Background/Methods/Results/Conclusion)
3. Single-column, serif, metadata in a **footer** block
4. Two-column, sans, authors woven into the **abstract prose** (no author line)
5. Single-column, sans, labeled header block (`Authors:`, `Conference:`)
6. Single-column, serif, **no keyword line** — correct output is `keywords: null`

## Run it

Point any agent at the runbook and let it work:

> *"Follow the runbook in ./runbook.md. Use results_dir=./results."*

Or run it on Jetty with the chat-completions endpoint and a `jetty` block (see the
[create-runbook guide](../../skills/create-runbook/SKILL.md) for the exact call).
The runbook's frontmatter already encodes the recommended config — Claude Code on
`anthropic/claude-sonnet-4.6` via OpenRouter — so it runs as-is. The default PDF
URLs are public, so no file upload is needed.
