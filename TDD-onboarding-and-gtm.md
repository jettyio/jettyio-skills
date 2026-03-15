# TDD: Jetty Plugin Onboarding & Go-to-Market

**Author:** Claude | **Date:** 2026-02-17 | **Status:** Draft for Review

---

## 1. Executive Summary

Transform the Jetty agent skill into a polished Claude Code **plugin** with a 3-5 minute onboarding flow. A new user should be able to: install the plugin, sign up via browser, get an API key, choose OpenAI or Gemini, and run a "cute feline detector" workflow (prompt → image → judge) — all guided from the terminal.

---

## 2. Current State

### What Exists Today

| Component | Status | Location |
|-----------|--------|----------|
| Skill definition (SKILL.md) | Working | `agent-skill/skill/SKILL.md` |
| CLI helpers (jetty-cli.sh) | Working | `agent-skill/skill/jetty-cli.sh` |
| 8 workflow templates | Working | `agent-skill/skill/templates/` |
| Clerk auth (web signup) | Working | `spot/` frontend |
| Onboarding flow (web) | Working | `spot/src/app/onboarding/` |
| Collection creation API | Working | `flows-api POST /api/v1/collections/` |
| API key generation API | Working | `flows-api POST /api/v1/api-keys/` |
| Collection env vars API | Working | `flows-api PATCH /api/v1/collections/{name}/environment` |
| Plugin packaging | **Missing** | No `.claude-plugin/plugin.json` |
| CLI onboarding skill | **Missing** | No setup wizard |
| BYOK flow | **Missing** | No guided key storage |
| Trial/free-tier | **Missing** | No run-limited trial |
| Feline detector template | **Missing** | No prompt→image→judge template |

### Architecture Overview

```
User's Terminal (Claude Code)
  └── /jetty plugin
        ├── skills/jetty/SKILL.md        (main skill)
        ├── skills/jetty-setup/SKILL.md  (onboarding wizard - NEW)
        └── .claude-plugin/plugin.json

Browser (flows.jetty.io)
  └── Clerk signup → Onboarding form → Collection created

Backend
  └── flows-api.jetty.io — all API operations (collections, tasks, workflows, trajectories, files)
```

---

## 3. Target User Journey (3-5 minutes)

```
Step 1: Install Plugin                              [30s]
  $ claude plugin add github:jetty-ai/jetty-plugin

Step 2: Run /jetty setup                            [60s]
  → "Welcome! Let's get you set up."
  → "Do you already have a Jetty account?"
     [Yes, I have an API key] → paste key → skip to Step 4
     [No, let me sign up] → opens browser to flows.jetty.io/sign-up

Step 3: Browser Signup                              [60s]
  → Clerk signup (email/Google/GitHub)
  → Onboarding form: org name, collection name, free plan
  → Redirected to dashboard with API key visible
  → Copy API key, return to terminal
  → Paste API key into Claude Code prompt

Step 4: Choose Provider                             [30s]
  → "Which image generation provider?"
     [OpenAI (DALL-E 3)]
     [Google Gemini]
  → "Paste your API key for {provider}:"
  → Key stored in collection env vars via API
  OR
  → [Try with 10 free runs] → uses pre-configured trial key

Step 5: Run Demo Workflow                           [60s]
  → Deploys "cute-feline-detector" workflow to user's collection
  → Runs it with sample prompt "a fluffy orange tabby cat"
  → Shows: generated image URL, judge verdict, explanation
  → "Your first workflow is complete! Here's what happened..."

Step 6: Download & Summary                          [30s]
  → Downloads generated image to local machine
  → Prints summary: workflow structure, run stats, next steps
```

---

## 4. Systems to Touch

### 4.1 Agent Skill → Plugin Conversion (`agent-skill/`)

**Gap:** Currently a bare skill directory. Needs full plugin packaging.

**Changes:**
```
agent-skill/
├── .claude-plugin/
│   └── plugin.json                    # NEW: plugin manifest
├── skills/
│   ├── jetty/
│   │   ├── SKILL.md                   # MOVE from skill/SKILL.md
│   │   ├── jetty-cli.sh              # MOVE from skill/jetty-cli.sh
│   │   ├── templates/                 # MOVE from skill/templates/
│   │   └── examples/                  # MOVE from skill/examples/
│   └── jetty-setup/
│       └── SKILL.md                   # NEW: onboarding wizard
├── templates/
│   └── cute-feline-detector.json      # NEW: demo workflow
├── README.md                          # UPDATE: plugin install instructions
└── LICENSE
```

**`plugin.json`:**
```json
{
  "name": "jetty",
  "description": "Build, run, and monitor AI/ML workflows on Jetty — from prompt to production.",
  "version": "0.1.0",
  "author": {
    "name": "Jetty AI",
    "url": "https://jetty.io"
  }
}
```

### 4.2 Onboarding Skill (`skills/jetty-setup/SKILL.md`)

**Gap:** No guided setup experience.

**New skill that:**
1. Checks if a Jetty API token already exists in CLAUDE.md
2. If not, asks: "Have an account?" → Yes (paste key) / No (open browser)
3. Opens `flows.jetty.io/sign-up` via `open` (macOS) / `xdg-open` (Linux)
4. Prompts user to paste their API key after signup
5. Validates the key against `GET /api/v1/collections/`
6. Writes the token to the project's `CLAUDE.md` (or creates one)
7. Asks: OpenAI or Gemini? → Paste provider key
8. Stores provider key in collection env vars via `PATCH /api/v1/collections/{name}/environment`
9. Deploys the cute-feline-detector template to their collection
10. Runs it and shows results

**Trigger:** `/jetty-setup` or `/jetty setup` or "set up jetty"

### 4.3 Cute Feline Detector Workflow Template

**Gap:** No prompt→image→judge demo template.

**Two variants needed (OpenAI and Gemini):**

#### OpenAI Variant (`cute-feline-detector-openai.json`):
```json
{
  "init_params": {
    "prompt": "a fluffy orange tabby cat sitting in a sunbeam",
    "judge_instruction": "Is this image of a cute feline (cat)? Evaluate cuteness on a scale of 1-5 where 1=not cute at all, 5=extremely cute. Also confirm whether the image actually contains a cat."
  },
  "step_configs": {
    "generate_image": {
      "activity": "litellm_image_generation",
      "model": "dall-e-3",
      "prompt_path": "init_params.prompt",
      "size": "1024x1024",
      "quality": "standard",
      "n": 1
    },
    "judge_image": {
      "activity": "simple_judge",
      "model": "gpt-4o",
      "item_path": "generate_image.outputs.images[0].path",
      "instruction_path": "init_params.judge_instruction",
      "score_range": {"min": 1, "max": 5},
      "explanation_required": true,
      "temperature": 0.1
    }
  },
  "steps": ["generate_image", "judge_image"]
}
```

#### Gemini Variant (`cute-feline-detector-gemini.json`):
```json
{
  "init_params": {
    "prompt": "a fluffy orange tabby cat sitting in a sunbeam",
    "judge_instruction": "Is this image of a cute feline (cat)? Evaluate cuteness on a scale of 1-5 where 1=not cute at all, 5=extremely cute. Also confirm whether the image actually contains a cat."
  },
  "step_configs": {
    "generate_image": {
      "activity": "gemini_image_generator",
      "prompt_path": "init_params.prompt"
    },
    "judge_image": {
      "activity": "simple_judge",
      "model": "gemini/gemini-2.0-flash",
      "item_path": "generate_image.outputs.images[0].path",
      "instruction_path": "init_params.judge_instruction",
      "score_range": {"min": 1, "max": 5},
      "explanation_required": true,
      "temperature": 0.1
    }
  },
  "steps": ["generate_image", "judge_image"]
}
```

**Note:** Need to verify that `litellm_image_generation` exists as a step template. If not, we may need to use `replicate_text2image` for the OpenAI variant or add a new step template. The Gemini variant uses the known `gemini_image_generator`.

### 4.4 MLCBakery API Changes (`flows-api/`)

**Gap assessment:** Most capabilities exist, but we need:

#### 4.4.1 CLI Token Exchange Endpoint (NEW)
**Purpose:** Allow the browser signup flow to pass a token back to the CLI without the user manually copying.

**Option A: Polling-based (simpler, recommended for v1)**
```
POST /api/v1/cli/auth-request
  → Returns { request_id, auth_url, expires_at }
  → auth_url = flows.jetty.io/cli-auth?request_id=xxx

GET /api/v1/cli/auth-request/{request_id}
  → Returns { status: "pending" | "completed", api_key?: "mlc_..." }
```

The browser flow completes signup, creates a collection + API key, and writes the key to the auth-request record. The CLI polls until completed.

**Option B: Manual paste (no backend changes needed)**
User copies the API key from the dashboard and pastes it into the terminal. This is the MVP approach.

**Recommendation:** Start with Option B (zero backend changes). Add Option A in v2 for a smoother experience.

#### 4.4.2 BYOK Key Storage via Environment Variables (EXISTS)
The `PATCH /api/v1/collections/{name}/environment` endpoint already supports storing arbitrary env vars. We can use this to store:
- `OPENAI_API_KEY` for OpenAI/DALL-E
- `GEMINI_API_KEY` for Google Gemini

**No backend changes needed** — just need the skill to call this endpoint.

#### 4.4.3 Trial/Free-Tier (DEFERRED)
For the "10 free runs" trial:
- **Option A:** Pre-provision a shared API key with rate limiting → requires metering enforcement
- **Option B:** Use Jetty's own keys for trial runs, tracked per collection → requires metering
- **Option C (MVP):** Skip trial, require BYOK → simplest, ship faster

**Recommendation:** Ship with BYOK-only for v1. Add trial in v2 once metering is enforced.

### 4.5 Spot Frontend Changes (`spot/`)

**Gap:** No CLI-auth callback page.

#### For Option A (polling-based auth):
- New page: `/cli-auth?request_id=xxx`
- After signup + onboarding, auto-creates API key and writes to auth-request
- Shows "You can return to your terminal now" message

#### For Option B (manual paste, MVP):
- **No frontend changes needed**
- Existing onboarding flow works as-is
- Add a prominent "Copy API Key" button on the dashboard (may already exist)

**Recommendation:** Check if the dashboard already shows API keys. If not, add a post-onboarding screen that shows the key with a copy button.

### 4.6 Post-Onboarding Dashboard Enhancement (`spot/`)

**Nice-to-have:** After onboarding, show a "Claude Code Setup" card:
```
┌─────────────────────────────────────────┐
│ Set up Claude Code                      │
│                                         │
│ Your API key: mlc_abc...  [Copy]        │
│                                         │
│ Run in your terminal:                   │
│ $ claude plugin add github:jetty/plugin │
│ $ claude "/jetty setup"                 │
└─────────────────────────────────────────┘
```

---

## 5. Alternate Flows

### 5.1 Existing User (has API key)
```
/jetty setup
  → "Do you already have a Jetty account?"
  → [Yes, I have an API key]
  → Paste key
  → Validate against API
  → Skip to provider selection
  → Deploy demo workflow
```

### 5.2 Existing User (token in CLAUDE.md already)
```
/jetty setup
  → Detects token in CLAUDE.md
  → "Found existing Jetty token. Want to set up a demo workflow?"
  → [Yes] → provider selection → deploy → run
  → [No, reconfigure] → full setup flow
```

### 5.3 OAuth/SSO Sign-In (Clerk handles this)
```
/jetty setup
  → Opens flows.jetty.io/sign-up
  → User clicks "Continue with Google" or "Continue with GitHub"
  → Clerk handles OAuth flow
  → Onboarding form → collection created
  → User copies API key → returns to terminal
```
Clerk already supports Google and GitHub OAuth. No additional work needed.

### 5.4 Team/Org Invite Flow
```
/jetty setup
  → User has been invited to an existing org
  → Signs in (not up) → already has a collection
  → Copies API key from settings → pastes in terminal
  → Provider key may already be configured by org admin
```

### 5.5 Provider Key Already Set
```
/jetty setup
  → After pasting Jetty API key
  → Checks collection env vars for OPENAI_API_KEY / GEMINI_API_KEY
  → "Found existing OpenAI key in your collection. Use it?"
  → [Yes] → skip to demo workflow
```

### 5.6 Invalid API Key
```
/jetty setup
  → User pastes invalid key
  → API returns 401
  → "That key doesn't seem to work. Please check and try again."
  → Re-prompt (max 3 attempts)
  → "Need help? Visit flows.jetty.io/settings to manage your keys."
```

### 5.7 Workflow Already Exists
```
/jetty setup
  → Tries to deploy cute-feline-detector
  → Task name already taken
  → "Demo workflow already exists in your collection. Run it?"
  → [Yes, run it] / [Deploy with different name] / [Skip]
```

---

## 6. Implementation Plan

### Phase 1: Plugin Packaging (Day 1)

1. Create `.claude-plugin/plugin.json`
2. Restructure directories: `skill/` → `skills/jetty/`
3. Create the cute-feline-detector template (both variants)
4. Update README with `claude plugin add` instructions
5. Test installation via `claude --plugin-dir ./agent-skill`

### Phase 2: Setup Skill (Day 1-2)

1. Create `skills/jetty-setup/SKILL.md` with the onboarding wizard logic
2. Implement the full flow:
   - Token detection in CLAUDE.md
   - Browser launch (`open` / `xdg-open`)
   - API key validation
   - Provider selection + BYOK
   - Env var storage via collection API
   - Template deployment
   - Demo run + results display
3. Handle all alternate flows (existing user, invalid key, etc.)

### Phase 3: Verify Step Templates (Day 2)

1. Confirm `litellm_image_generation` step template exists and works with DALL-E 3
2. If not, identify the correct activity for OpenAI image generation
3. Test both workflow variants end-to-end
4. Verify `simple_judge` works with image paths from both generators

### Phase 4: Frontend Polish (Day 2-3)

1. Ensure API key is visible and copyable post-onboarding in `spot/`
2. Add "Claude Code Setup" card to dashboard (optional)
3. Test the full browser → terminal round-trip

### Phase 5: GTM Launch (Day 3-4)

1. Publish plugin to GitHub as `jetty-ai/jetty-plugin` (or similar)
2. Submit to Anthropic's official plugin directory via `clau.de/plugin-directory-submission`
3. List on community aggregators (see Section 8)
4. Write launch blog post / README walkthrough

---

## 7. Open Questions

| # | Question | Impact | Default |
|---|----------|--------|---------|
| 1 | Does `litellm_image_generation` exist as a step template? | Determines OpenAI workflow design | Verify via `GET /api/v1/step-templates` |
See https://flows.jetty.io/dock/task/jetty-onboarding-templates/onboarding-creative-image-openai
| 2 | Should we support trial runs in v1? | Scope — adds metering requirement | No, BYOK-only for v1 |
Agreed, BYOK only 
| 3 | GitHub org name for the plugin repo? | GTM — `claude plugin add github:???/jetty-plugin` | `jetty-ai` or `jettyai` |
yes I like jetty-plugin. org is jettyio
| 4 | Should `/jetty setup` and `/jetty` be the same skill or separate? | UX — one install vs two commands | Separate skills, one plugin |
agreed
| 5 | Do we need the polling-based CLI auth (Option A) for v1? | UX polish vs. backend work | No, manual paste for v1 |
manual paste
| 6 | Where should the token be stored — CLAUDE.md or .env? | Security — .env is gitignored, CLAUDE.md may be committed | CLAUDE.md (matches current pattern, but warn about .gitignore) |
yes that works for now
| 7 | Should we store provider keys in collection env vars or locally? | Security — collection env vars are server-side | Collection env vars (already used by workflows at runtime) |
in the collection env vars

---

## 8. Go-to-Market Plan

### Distribution Channels (Priority Order)

#### 1. GitHub Plugin Repository (Required, Day 1)
- Publish as `github:jetty-ai/jetty-plugin`
- Users install: `claude plugin add github:jetty-ai/jetty-plugin`
- Include compelling README with GIF/screenshot of the onboarding flow
- This is the foundation all other channels depend on

#### 2. Anthropic Official Plugin Directory (High Priority, Day 3)
- Submit via form at `clau.de/plugin-directory-submission`
- Aim for "Anthropic Verified" badge
- This is the highest-credibility channel and appears in Claude Code's default plugin discovery
- Review process may take days/weeks — submit early

#### 3. Community Aggregators (Medium Priority, Day 3-4)
Submit PRs / listings to:
- [awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) — curated list, high GitHub stars
- [awesome-claude-plugins](https://github.com/Chat2AnyLLM/awesome-claude-plugins) — 43+ marketplaces tracked
- [claudecodemarketplace.com](https://claudecodemarketplace.com) — web-based marketplace
- [skillsmp.com](https://skillsmp.com) — skills marketplace
- [awesome-claude-plugins](https://github.com/quemsah/awesome-claude-plugins) — tracks 5,194 repos

#### 4. Own Marketplace (Medium Priority, Week 2)
- Create `jetty-ai/jetty-marketplace` repo with `marketplace.json`
- Enables: `claude plugin marketplace add jetty-ai/jetty-marketplace`
- Useful as Jetty releases more plugins (e.g., jetty-monitor, jetty-deploy)
- Can be preconfigured in team settings via `extraKnownMarketplaces`

#### 5. npm Package (Low Priority, Week 2)
- Publish as `@jetty-ai/claude-plugin` on npm
- Enables `source: { "source": "npm", "package": "@jetty-ai/claude-plugin" }` in marketplaces
- Secondary channel, not primary

#### 6. MCP Server (Future, if needed)
- If the skill needs real-time tool execution beyond what SKILL.md instructions can provide
- Bundle in the plugin via `.mcp.json`
- List on Smithery and Glama for cross-tool discovery (works in Cursor, Windsurf too)

### Launch Messaging

**One-liner:** "Build AI workflows in your terminal — from prompt to production in 5 minutes."

**Key differentiators to highlight:**
- Terminal-native: no context switching to a web UI for workflow design
- Prompt→Image→Judge in one command
- BYOK: bring your own OpenAI or Gemini key
- Full workflow observability (trajectories, logs, labels)
- Works with any LLM provider via litellm

### Launch Checklist
- [ ] Plugin repo on GitHub with README + install instructions
- [ ] Working onboarding flow tested on fresh account
- [ ] GIF/video of the 3-5 minute onboarding experience
- [ ] Submit to Anthropic plugin directory
- [ ] PR to 3+ community aggregators
- [ ] Blog post / Twitter thread (optional but high-impact)
- [ ] Track installs via GitHub stars + API key creation rate

---

## 9. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `litellm_image_generation` doesn't exist as a template | Medium | High — blocks OpenAI variant | Verify first; fallback to `replicate_text2image` with FLUX |
| Clerk signup friction (email verification, etc.) | Low | Medium | Can't control Clerk UX; ensure good error messaging |
| User commits API key in CLAUDE.md to git | Medium | High | Add warning in setup flow; suggest .gitignore |
| Provider API key costs surprise users | Low | Medium | Show estimated cost per run (~$0.04 for DALL-E 3 + GPT-4o judge) |
| Plugin format changes in Claude Code | Low | Medium | Follow official spec; pin to known-working format |
| Rate limiting on Jetty free tier | Medium | Medium | Document limits; deferred to v2 |

---

## 10. Success Metrics

- **Time to first workflow run:** < 5 minutes from `claude plugin add`
- **Setup completion rate:** Track via API key creation → first workflow run
- **Plugin installs:** GitHub stars + clone count as proxy
- **Aggregator listings:** Accepted in 3+ directories within 2 weeks
- **User retention:** % of users who run > 1 workflow after setup

---

## 11. Summary of Changes by System

| System | Changes | Effort |
|--------|---------|--------|
| `agent-skill/` | Plugin packaging, dir restructure, new setup skill, new templates | Medium |
| `flows-api/` | None for v1 (all needed endpoints exist) | None |
| `spot/` (frontend) | Verify API key visibility post-onboarding; optional "Claude Code" card | Low |
| `flows-api/` | None (step templates already available) | None |

**Total estimated systems affected:** 1-2 (agent-skill is the main work; spot is optional polish)
