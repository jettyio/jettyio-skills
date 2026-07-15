---
version: "1.0.0"
evaluation: programmatic
agent: claude-code
model: anthropic/claude-sonnet-4.6
model_provider: openrouter
snapshot: python312-uv
primary_outputs:
  - "report.md"
  - "abstracts_rollup.csv"
secrets: {}
---

# Conference Abstract Extraction — Agent Runbook

## Objective

Six conference-abstract PDFs live in a public cloud bucket. Each was laid out by a
different venue — two-column and single-column, serif and sans, header- and
footer-metadata, structured and narrative — so no single parsing rule fits them
all. Download each PDF, read its text, and normalize it into one shared JSON
schema. **Every extracted value must carry a provenance pointer** — the page it
came from and a verbatim quote from the source text — so a human can audit any
field in seconds. Write one JSON file per PDF, a single roll-up CSV of all rows
for manual verification, and a short report. This demonstrates the core Jetty
loop: a bucket of messy inputs goes in, structured and verifiable data comes out.

---

## REQUIRED OUTPUT FILES (MANDATORY)

**You MUST write all of the following to `{{results_dir}}`. The task is NOT
complete until every file exists and is non-empty. No exceptions.**

| File | Description |
|------|-------------|
| `{{results_dir}}/abstracts/<slug>.json` | One per PDF — the normalized record with per-field provenance |
| `{{results_dir}}/abstracts_rollup.csv` | One row per PDF, flattened, for human verification |
| `{{results_dir}}/report.md` | Human-readable summary: what was extracted, provenance-check results, anything flagged |
| `{{results_dir}}/summary.md` | Executive summary with run metadata and results breakdown |
| `{{results_dir}}/validation_report.json` | Structured validation results with stages, results, and `overall_passed` |

If you finish extraction but have not written all files, go back and write them
before stopping.

---

## Parameters

| Parameter | Template Variable | Default | Description |
|-----------|------------------|---------|-------------|
| Results directory | `{{results_dir}}` | `/app/results` (Jetty) / `./results` (local) | Output directory for all results |
| PDF source URLs | `{{pdf_urls}}` | The six public URLs below | Newline- or comma-separated list of PDF URLs to extract |

Default `{{pdf_urls}}` (public, no credentials required):

```
https://storage.googleapis.com/jetty-demo-fixtures/conference-abstracts/01_okonkwo_provenance_extraction.pdf
https://storage.googleapis.com/jetty-demo-fixtures/conference-abstracts/02_whitfield_judge_drift.pdf
https://storage.googleapis.com/jetty-demo-fixtures/conference-abstracts/03_ramanathan_sandbox_isolation.pdf
https://storage.googleapis.com/jetty-demo-fixtures/conference-abstracts/04_kowalski_eligibility_normalization.pdf
https://storage.googleapis.com/jetty-demo-fixtures/conference-abstracts/05_vasquez_constrained_decoding.pdf
https://storage.googleapis.com/jetty-demo-fixtures/conference-abstracts/06_mbeki_verification_loops.pdf
```

---

## Dependencies

| Dependency | Type | Required | Description |
|------------|------|----------|-------------|
| `pypdf` | Python package | Yes | Extract text from each PDF |
| `requests` | Python package | Yes | Download the PDFs from the bucket |
| PDF bucket | External URL | Yes | Public GCS bucket holding the six fixtures |

No secrets or API tokens are needed — the fixtures are public and extraction runs
locally in the sandbox.

---

## Target Schema

Every per-PDF JSON file MUST match this shape. Each leaf value is an object with a
`value` and a `provenance` pointer. `provenance.quote` MUST be a substring that
appears **verbatim** in the text extracted from that PDF (this is what the
evaluation checks).

```json
{
  "source_file": "01_okonkwo_provenance_extraction.pdf",
  "title":       { "value": "…", "provenance": { "page": 1, "quote": "…" } },
  "authors":     [ { "value": "…", "provenance": { "page": 1, "quote": "…" } } ],
  "affiliations":[ { "value": "…", "provenance": { "page": 1, "quote": "…" } } ],
  "conference":  { "value": "…", "provenance": { "page": 1, "quote": "…" } },
  "abstract":    { "value": "…", "provenance": { "page": 1, "quote": "…" } },
  "keywords":    [ { "value": "…", "provenance": { "page": 1, "quote": "…" } } ]
}
```

Rules:
- `page` is 1-indexed.
- For a field whose value spans a long passage (e.g. `abstract`), the `quote` may
  be a representative verbatim fragment of at least 12 words — it does not have to
  be the entire value, but it must appear verbatim in the source text.
- If a field is genuinely absent from a PDF (for example, a document with no
  keyword line), set the field to `null` and do NOT invent a provenance quote.
  Missing-but-honest is a PASS; hallucinated is a FAIL.

---

## Step 1: Environment Setup

```bash
pip install pypdf requests
mkdir -p {{results_dir}}/abstracts {{results_dir}}/_pdfs {{results_dir}}/_text
```

---

## Step 2: Download the PDFs

For each URL in `{{pdf_urls}}`, download the file into `{{results_dir}}/_pdfs/`
using its basename as the filename. Confirm each download is a non-empty file
whose first bytes are `%PDF`. Record the list of downloaded files; the basename
minus `.pdf` is that document's `slug`.

```bash
# Example for one URL — loop over all of them
curl -sSL -o {{results_dir}}/_pdfs/01_okonkwo_provenance_extraction.pdf \
  "https://storage.googleapis.com/jetty-demo-fixtures/conference-abstracts/01_okonkwo_provenance_extraction.pdf"
```

---

## Step 3: Extract Text

For each downloaded PDF, extract per-page text with `pypdf` and save it to
`{{results_dir}}/_text/<slug>.txt`. You will use this saved text both to fill the
schema and to self-check your provenance quotes.

```python
from pypdf import PdfReader
reader = PdfReader(pdf_path)
pages = [p.extract_text() or "" for p in reader.pages]
full_text = "\n".join(pages)
```

---

## Step 4: Normalize Into the Schema

For each document, read the extracted text and populate the target schema. Layouts
vary deliberately — do not assume the title is always the first line, that authors
always follow the title, or that a keyword line always exists. Some documents label
their metadata (`Authors:`, `Conference:`), some place it in a footer, and some
weave author names into the abstract prose. Read for meaning, not position.

For every value you record, copy a **verbatim** span from the extracted text into
`provenance.quote` and note the 1-indexed `page`. Before moving on, self-check:
assert that each `quote` is actually a substring of that document's extracted text.
If it is not (often due to whitespace or hyphenation differences), adjust the quote
to match the source exactly.

Write each record to `{{results_dir}}/abstracts/<slug>.json`.

---

## Step 5: Build the Roll-up CSV

Write `{{results_dir}}/abstracts_rollup.csv` with one row per document so a human
can verify everything in a single scannable artifact. Use these columns:

```
source_file,title,authors,affiliations,conference,keywords,provenance_pages
```

Flatten list fields with `; ` between items. For `provenance_pages`, join the
distinct page numbers cited for that document. Include a header row.

---

## Step 6: Evaluate Outputs (programmatic)

Run these checks and assign each document a status:

| Status | Criteria |
|--------|----------|
| `PASS` | JSON matches the schema; every non-null field has a `provenance.quote` that is a verbatim substring of that document's extracted text; `page` is a valid page number |
| `PARTIAL` | Schema valid but one or more provenance quotes are not found verbatim, OR a clearly-present field was left null |
| `FAIL` | JSON missing or malformed, OR a field is populated with a provenance quote that does not appear in the source at all (hallucination) |

Do this with a script, not by eye:

```python
import json, glob, os
def check(doc_json, text):
    problems = []
    def leaf(node):
        if node is None: return
        q = node["provenance"]["quote"]
        if q not in text:
            problems.append(f"quote not verbatim: {q[:50]!r}")
    for key in ("title","conference","abstract"):
        leaf(doc_json.get(key))
    for key in ("authors","affiliations","keywords"):
        for item in (doc_json.get(key) or []):
            leaf(item)
    return problems
```

Count PASS / PARTIAL / FAIL across the six documents.

---

## Step 7: Iterate on Errors (max 2 rounds)

If any document is `PARTIAL` or `FAIL`:

1. Read the specific problem (e.g. "quote not verbatim").
2. Apply the matching fix below.
3. Re-run Step 4 for that document only, then re-check with Step 6.
4. Repeat at most twice total, then keep the best result and flag anything still
   failing in the report.

### Common Fixes

| Issue | Fix |
|-------|-----|
| Quote not found verbatim | Copy the span directly from the saved `_text/<slug>.txt`, including its exact spacing and any mid-word hyphenation, rather than retyping it |
| Wrong field picked up (e.g. venue read as affiliation) | Re-read the labeled lines; prefer explicit `Conference:` / `Affiliation:` labels when present |
| Keywords missing on a document that has none | Set `keywords` to `null` — this is correct, not an error |
| Author names run together across a line break | Split on the conjunction/comma pattern actually present in the text |

---

## Step 8: Write the Report and Summary

Write `{{results_dir}}/report.md`:

```markdown
# Conference Abstract Extraction — Report

Extracted **{N}** conference abstracts from a public bucket into a normalized,
provenance-checked schema.

## Provenance check
- Documents fully verified (all quotes verbatim): {pass_count}/{N}
- Fields flagged for review: {partial_field_count}
- Every value in the roll-up CSV links back to a page and a source quote.

## Per-document results
| Document | Title | Provenance | Status |
|----------|-------|-----------|--------|
| … | … | all verbatim | ✅ PASS |

## Flagged for human review
{Anything PARTIAL/FAIL, with the reason — or "None." }
```

Write `{{results_dir}}/summary.md`:

```markdown
# Conference Abstract Extraction — Results

## Overview
- **Date**: {run date}
- **Documents processed**: {N}
- **Source**: public GCS bucket (conference-abstracts fixtures)

## Results Summary
| Status | Count |
|--------|-------|
| PASS | … |
| PARTIAL | … |
| FAIL | … |

## Sample Output
{One representative record, showing a field with its provenance pointer}

## How to verify
Open `abstracts_rollup.csv`: each row is one abstract; every value is backed by a
page number and a verbatim source quote in the matching `abstracts/<slug>.json`.
```

---

## Step 9: Write Validation Report

Write `{{results_dir}}/validation_report.json`:

```json
{
  "version": "1.0.0",
  "run_date": "2026-01-01T00:00:00Z",
  "parameters": { "document_count": 6 },
  "stages": [
    { "name": "setup", "passed": true, "message": "Environment ready" },
    { "name": "download", "passed": true, "message": "Downloaded 6 PDFs" },
    { "name": "text_extraction", "passed": true, "message": "Extracted text from 6 PDFs" },
    { "name": "normalization", "passed": true, "message": "Wrote 6 schema records" },
    { "name": "provenance_check", "passed": true, "message": "All quotes verbatim" },
    { "name": "rollup", "passed": true, "message": "CSV written with 6 rows" },
    { "name": "report_generation", "passed": true, "message": "All output files written" }
  ],
  "results": { "pass": 6, "partial": 0, "fail": 0 },
  "overall_passed": true,
  "output_files": [
    "{{results_dir}}/abstracts_rollup.csv",
    "{{results_dir}}/report.md",
    "{{results_dir}}/summary.md",
    "{{results_dir}}/validation_report.json"
  ]
}
```

`overall_passed` is `true` only when there are zero `FAIL` documents and the CSV
row count equals the number of input PDFs.

---

## Step 10: Final Checklist (MANDATORY — do not skip)

```bash
echo "=== FINAL OUTPUT VERIFICATION ==="
RESULTS_DIR="{{results_dir}}"
json_count=$(ls "$RESULTS_DIR"/abstracts/*.json 2>/dev/null | wc -l | tr -d ' ')
echo "per-PDF JSON files: $json_count (expect 6)"
for f in "$RESULTS_DIR/abstracts_rollup.csv" "$RESULTS_DIR/report.md" \
         "$RESULTS_DIR/summary.md" "$RESULTS_DIR/validation_report.json"; do
  if [ ! -s "$f" ]; then echo "FAIL: $f is missing or empty"; else
    echo "PASS: $f ($(wc -c < "$f") bytes)"; fi
done
csv_rows=$(($(wc -l < "$RESULTS_DIR/abstracts_rollup.csv") - 1))
echo "CSV data rows: $csv_rows (expect 6)"
```

### Checklist
- [ ] Six `abstracts/<slug>.json` files exist and match the schema
- [ ] Every non-null field has a verbatim provenance quote and a valid page number
- [ ] `abstracts_rollup.csv` has one header row plus six data rows
- [ ] `report.md`, `summary.md`, and `validation_report.json` all exist and are non-empty
- [ ] Verification script printed PASS for all files

**If ANY item fails, go back and fix it. Do NOT finish until all items pass.**

---

## Tips

- The six PDFs use six different layouts on purpose. The one thing they share is
  that every field's value appears somewhere in the extracted text — so when in
  doubt, search the saved `_text/<slug>.txt` for the value and copy the quote from
  there.
- `pypdf`'s `extract_text()` sometimes joins words across line breaks or splits a
  hyphenated word. Always take provenance quotes from the extracted text, never
  from what you think the PDF "should" say.
- Document 06 has no keyword line. The correct result is `keywords: null`, not a
  guess. Honest nulls keep the provenance check meaningful.
