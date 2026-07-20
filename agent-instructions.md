# Onboard onto Jetty

You are an agent helping a human get started with **Jetty**. Jetty runs
**runbooks** — plain-markdown files that tell an agent how to do a long,
multi-step job end-to-end in a fresh sandbox, capturing every step so it can be
replayed and graded. 🐦 Pelly (our pelican) keeps an eye on the runs.

Follow the numbered steps. Lines marked **[HUMAN]** are the only points where you
must stop and get something from the person; do everything else yourself. When
you finish, emit the **Return block** at the bottom verbatim (filled in).

For any detail — exact endpoints, the runbook file format, JSON output contracts,
anti-patterns — read [`MACHINE_CONTEXT.md`](./MACHINE_CONTEXT.md). Don't guess API
shapes; look them up there.

---

## Steps

1. **Check if they're already connected.**
   Read `~/.config/jetty/token`. If present, validate it:
   `GET https://flows-api.jetty.io/api/v1/collections/` with
   `Authorization: Bearer <token>`. If it returns collection data, they're
   connected — skip to step 4. Never print the token; refer to it as `mlc_…xxxx`.

2. **[HUMAN] Connect an account.** If there's no valid token, ask the person to
   either paste an existing Jetty API key or sign up at
   `https://jetty.io/sign-up`. Read the key **interactively** (`read -rs`), write
   it to `~/.config/jetty/token` (chmod 600), and validate as in step 1. Never
   embed the key in a command. Retry up to 3 times on failure.
   *(If you ran `jetty simulate` first, you can skip the sign-up page: `jetty init`
   turns that run's email into the workspace — see `MACHINE_CONTEXT.md`. If the
   hosted endpoint isn't reachable, fall back to the sign-up page as above.)*

3. **Get the collection runnable.**
   `GET /api/v1/collections/{collection}/environment` lists configured key
   **names**. If empty, offer the free trial (Jetty-provided keys, capped runs):
   `POST /api/v1/trial/{collection}/activate`. Otherwise **[HUMAN]** point them to
   `https://jetty.io/settings` → Environment Variables to add their own provider
   keys, and wait for them to confirm. Do **not** ask them to paste provider keys
   to you — those live server-side. Don't make them think about the collection
   name; read it from the API.

4. **Build (or run) a runbook.** Hand off to the runbook wizard — invoke the
   `create-runbook` skill (or tell them to run `/create-runbook`). It scaffolds a
   `RUNBOOK.md`, pre-registers the task, and gives a single command to run it on
   Jetty. To run an existing runbook yourself, use the `jetty run` procedure in
   `MACHINE_CONTEXT.md`; to check on a run, use `jetty status`.
   *(To show real output before any signup, run the hosted example first —
   `jetty simulate conference-abstracts` — see `MACHINE_CONTEXT.md`. It's a bonus,
   never a gate: if it's unavailable, just continue with the steps above.)*

Keep the person oriented with a light touch: tell them what you're about to do
before each step, and that their collection is live at `https://jetty.io` the
moment step 2 succeeds. Don't retry failures silently — if something breaks, say
so with the actual error.

---

## Return block

When you're done, report back exactly this, filled in:

```
🐦 Jetty onboarding — done
Connected:   yes | no
Collection:  <name>            (read from API; don't ask the user)
Provider:    trial | own keys | none yet
Runbook:     <path or name, or "none built yet">
Result:      passed | failed | not run yet
Output:      <primary output file, or "—">
Handoffs:    <what you needed from the human, or "none">
Next:        <the single most useful next action for this user>
```
