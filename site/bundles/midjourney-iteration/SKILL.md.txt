---
name: midjourney-iteration
description: Iterate on Midjourney prompts in a closed loop — generate, vision-evaluate the result grid against a structured brief, refine the prompt, re-roll — when a user wants album art, music video stills, social-post imagery, or any other MJ output that benefits from autonomous taste-driven iteration rather than one-shot prompting.
license: MIT
tags: [midjourney, image-generation, social-assets, browser-hand, design, iteration, social]
agents: [claude-code, codex, autojack]
category: design
metadata:
  version: "0.1.0"
capabilities:
  network: true
  filesystem: readwrite
  tools: [Bash, Read, Write, Edit]
requires-secrets: []
resources:
  - path: story.md
    type: file
  - path: workflow.md
    type: file
  - path: brief-schema.md
    type: file
  - path: eval-rubric.md
    type: file
  - path: refine-patterns.md
    type: file
  - path: examples/product-hero.brief.json
    type: file
  - path: bin/preflight
    type: file
  - path: bin/relaunch-chrome
    type: file
bin:
  preflight:
    command: bin/preflight
    description: Verify Browser Hand's remote-debug fallback, Chrome CDP on port 9222, and a logged-in midjourney.com tab.
    requires-tty: true
---

# Midjourney Iteration

Drive Midjourney through a closed-loop generate → vision-evaluate → refine → re-roll cycle, attached to the user's existing logged-in Chrome session. Returns the top picks with the prompts that produced them, plus a session log.

## When to use

- The user is working on cover art, music-video stills, IG posts, mood-board pieces, or any MJ output where one-shot prompting won't get them to the brief.
- The user describes a brief that has *taste constraints* worth iterating on (composition, palette, negatives) — not just "make me a picture of X."
- The user asks to "iterate on a Midjourney prompt", "find a generation that hits the brief", or "run an MJ loop until it lands."
- A written creative brief is available, including the intended subject, composition, style, and constraints.

## When NOT to use

- One-shot generations the user can do faster manually.
- Tasks that need the user's subjective taste in real time — this skill is for unattended iteration with a clear written brief.
- Anything that requires scraping other artists' work or downloading from `/explore`.
- Continuous farms / 24-7 generation loops. This skill is for bursty creative sessions only.
- **Divergent / discovery phases.** This skill converges on ONE composition described by a structured brief. If the user is still trying to figure out the broad creative direction (e.g., "explore 5 different concepts for this character"), they need a *different* shape: 1 round per prompt across N varied prompts, then the agent reports which directions hit. That mode is on the roadmap (see `roadmap` section in `refine-patterns.md`), not yet implemented as a separate orchestration path. For now, run multiple briefs serially or work outside the skill until divergent-mode lands.

## Prerequisites

- Load `browser-hand` and use its documented remote-debug fallback. That
  implementation currently requires the upstream `dev-browser` CLI
  (`npm install -g dev-browser` and `dev-browser install`).
- Google Chrome **launched with `--remote-debugging-port=9222` AND `--user-data-dir=<non-default path>`** and a logged-in `midjourney.com` tab. The skill attaches to that tab via Chrome DevTools Protocol — no Chrome extension is involved despite older docs that mention one.
  - The `--user-data-dir` is REQUIRED on Chrome 136+ (May 2025): Chrome silently ignores `--remote-debugging-port` on the default profile as a security hardening. `bin/relaunch-chrome` provisions a dedicated profile under the user state directory; the user signs in there once and the profile persists across sessions.
- `bin/preflight` verifies all three. If Chrome isn't on the debug port, it prints the relaunch command and follows `MJ_ITER_BROWSER_MODE=prompt|never|always`.

## Why Browser Hand's remote-debug fallback specifically

Cloudflare bot-detection on Midjourney passes a real Chrome with the user's real session/fingerprint and rejects fresh Playwright/Chromium. CDP-attaching to user-Chrome is load-bearing — do not "simplify" by switching to plain Playwright.

## Workflow

### 1. Run preflight

```bash
bin/preflight
```

Exit non-zero means stop and surface the remediation message. Do not try to work around a missing Chrome debug port by spawning a fresh browser — see "Why Browser Hand's remote-debug fallback specifically".

### 2. Load the brief

Briefs are structured JSON — see `brief-schema.md` for the full shape. At minimum: `subject`, `composition`, `style`, `negative`. Optional: `palette`, `references`, `max_rounds` (default 8), `starting_prompt`, and `output_dir`.

If the user passed a prose brief, convert it to the structured shape first and confirm with them before running the loop.

**Session output location.** Resolve the session-log dir from `brief.output_dir` once at the start of the run:

- If `output_dir` is set: `<output_dir>/<timestamp>-<slug>/`
- Otherwise: `${XDG_STATE_HOME:-$HOME/.local/state}/midjourney-iteration/<timestamp>-<slug>/`

Use that path for every subsequent round's prompt file, screenshot copy, `eval-notes.jsonl`, and `picks.json`. The Chrome user-data-dir is independent and set by `MJ_ITER_CHROME_PROFILE_DIR`.

### 3. Attach to the Midjourney tab

```bash
dev-browser --connect <<'EOF'
const tabs = await browser.listPages();
const mj = tabs.find(t => t.url && t.url.includes('midjourney.com'));
if (!mj) { console.error('NO_MJ_TAB'); throw new Error('Open midjourney.com in Chrome and sign in.'); }
const page = await browser.getPage(mj.id);
console.log(JSON.stringify({ id: mj.id, origin: new URL(mj.url).origin }));
EOF
```

The page is now attached through Browser Hand's low-level fallback; subsequent invocations re-attach the same `mj.id`.

### 4. Run rounds

Each round is **three separate low-level `dev-browser --connect` invocations** because a single MJ generation takes 45–90s and the fallback's per-script timeout caps at 120s. See `workflow.md` for the verbatim three-script contract.

For each round:

a. **Submit prompt.** Use `page.snapshotForAI()` to find the prompt textarea and Generate button (cheap accessible-tree read). Paste the prompt, click Generate.

b. **Wait for grid.** Loop `page.waitForSelector(<grid-selector>, { timeout: 80000 })` until the 4-image grid renders.

c. **Screenshot the grid.** `await saveScreenshot(buf, 'round-N.png')` — returns a path inside `~/.dev-browser/tmp/`. Copy that file into the session log directory (see step 6).

### 5. Vision-evaluate the grid

Load the screenshot. Score each of the 4 images against `eval-rubric.md`. Record per-image hit/miss plus the dominant failure mode.

A round wins if **≥2 of the 4 images** pass the rubric.

### 6. Decide: continue, refine, or stop

- **Stop early** if this round won AND total accumulated hits ≥3.
- **Stop hard** if `round_index >= brief.max_rounds`.
- **Otherwise refine.** Match the dominant failure mode against `refine-patterns.md`, apply the prompt-edit recipe, and loop back to step 4.

After every round, append the round's prompt + screenshot path + per-image scores to `<session-log-dir>/log.jsonl` (or `eval-notes.jsonl`), where `<session-log-dir>` was resolved in §2 from `brief.output_dir`.

### 7. Return the top 3 picks

Sort all hit images across all rounds by rubric score; return the top 3 with:
- The prompt that produced each
- The screenshot path
- A one-line note on what made it a hit

Save the final ranking to `picks.json` in the session-log directory.

## Output

Return a concise summary to the user:

- Rounds run, total hits, early-stop reason if any
- Top 3 picks with prompts and image paths
- Pointer to the session-log directory for full history
- Any new refine-patterns observed (so they can be appended to `refine-patterns.md`)

## Anti-patterns

- Do **not** scrape other artists' work or download from `/explore`. This skill is for the user's own generations only.
- Do **not** run continuous generation farms — bursty iteration sessions only. ToS-safe is what humans do during creative work.
- Do **not** open Chrome without printing the relaunch command first. `bin/preflight` and `bin/relaunch-chrome` honor `MJ_ITER_BROWSER_MODE`; the agent should not bypass that.
- Do **not** skip the vision evaluation step. If you can't load the screenshot for any reason, **stop the loop and report** — never keep firing prompts blind.
- Do **not** add a project, artist, or client aesthetic to the base rubric. Keep those constraints in the user-provided brief.
- Do **not** swap Browser Hand's CDP fallback for fresh Playwright/Chromium. Cloudflare blocks it and MJ won't be logged in. The CDP attach is load-bearing.
- Do **not** try to fold the three per-round invocations into one script. The fallback's 120s timeout cap is real; one MJ generation often exceeds it.
- Do **not** auto-quit the user's running Chrome to relaunch with `--remote-debugging-port=9222` — it will lose their other tabs. Print the command and ask.
