---
name: session-consolidate
description: Run at a natural stopping point or via the /consolidate command to harvest durable learnings from the current session into AutoMem (store, associate, update, invalidate) and to create, update, merge, deduplicate, or simplify AutoVault skills. Enumerates candidates for veto first, requires explicit per-item confirmation before any destructive skill change, and ends with a short summary of what was created, updated, and consolidated.
agents: [claude-code, codex]
metadata:
  version: "1.1.0"
tags: [automem, autovault, memory, skills, consolidation, meta]
category: meta
---

# Session Consolidate

A checkpoint sweep that turns what a session *learned* into durable state:

1. **Memory pass** — persist durable learnings into AutoMem.
2. **Skill pass** — fold reusable procedure into AutoVault skills.

This skill is an **orchestration checklist**. It deliberately does not restate
the storage or skill rules — it defers to two canonical skills you MUST have
in context:

- `automem` — how to store / associate / update / verify memories.
- `autovault-skill` — how to search / propose / update / merge skills.

If either isn't already loaded this session, invoke it (Skill tool) before
acting, then follow the order below.

## When to use

- The user runs `/consolidate` (the thin slash command wraps this skill).
- A natural stopping point: a feature shipped, a bug root-caused, a decision
  settled, a work session wrapping up.
- NOT after every turn. This is a checkpoint, not a reflex.

## Guardrails — read before doing anything

- **Abstain by default.** The end of a session is exactly when the `automem`
  never-store list is most tempting to violate. If nothing durable happened,
  say so and stop. An empty consolidation is a correct outcome, not a failure.
- **Never store** session summaries, progress recaps, task-result dumps,
  confirmations, or "context that might matter later" (see `automem`). This
  skill running is *not* a reason to manufacture a memory.
- **The two passes carry different risk.** Memory writes are additive and
  decay on their own. Skill writes that *merge, dedupe, simplify, overwrite,
  or delete* are effectively irreversible and hit skills shared across BOTH
  claude-code and codex. They get a higher confirmation bar (Pass 2, step 2).

## Pass 1 — Memory harvest

1. **Enumerate candidates.** Scan the session for durable learnings and list
   them to the user as a short numbered list. For each, name its `automem`
   trigger family and the proposed `type` / `importance` / `confidence` / tags:
   - user correction or override → `Preference` (tags include `correction`)
   - decision that stabilized after pushback → `Decision`
   - pattern the user articulated → `Pattern`
   - root-cause insight or fix → `Insight` (tags include `bugfix`, `solution`)
   If the list is empty, report "nothing durable this session" and go to Pass 2.
2. **Take the veto.** Let the user strike or edit any candidate before writing.
   Running non-interactively (e.g. from a Stop nudge): apply the `automem`
   never-store list strictly and store only clearly-durable, high-confidence
   items.
3. **Run the atomic ritual per surviving candidate** — recall → store → verify
   → associate — exactly as `automem` specifies. Recall first; prefer
   `update_memory` over a near-duplicate when a related memory already exists.
4. **Update / invalidate** any memory this session proved stale (deprecated
   URL, superseded decision, changed version) via `update_memory` plus the
   right association (`INVALIDATED_BY` or `EVOLVED_INTO`).

## Pass 2 — Skill maintenance

1. **Search first, then classify.** For each reusable procedure the session
   produced or refined, call `mcp__autovault__get_skill({query})` (or review
   the already-visible skills) to find anything that overlaps. Pick one action:
   - **No overlap → CREATE.** Draft a SKILL.md, run
     `propose_skill({ skill_md, check: true })` (dry run) first, show the user
     the name + description, then propose for real. Handle every outcome:
     `accepted`, `would_accept`, `duplicate` (inspect `existing_match`, pick a
     merge option), `invalid` (fix schema, resubmit), `security_blocked`
     (rewrite to drop the flagged pattern).
   - **Overlap, existing skill is stale or thin → UPDATE.**
   - **Two skills cover the same ground → MERGE / DEDUPE.**
   - **A skill has drifted or bloated → SIMPLIFY.**
2. **Destructive skill changes need explicit per-item confirmation.** An
   overwriting UPDATE, MERGE, DEDUPE, SIMPLIFY, or DELETE all mutate or remove
   a skill synced to both agents. Before executing each one:
   - Show the **specific** change — which skill, what is being replaced or
     removed, a before/after of the frontmatter and the affected sections.
   - Get an explicit yes for *that item*. No batch "yes to all".
   - Only then call `update_skill` / `delete_skill`. For SKILL.md-only edits,
     use `update_skill({ source: "inline", reuse_existing_resources: true })`.
3. **Prefer the least-destructive option.** Extending an existing skill beats
   spawning a sibling; a targeted UPDATE beats a MERGE; leaving a good skill
   alone beats "simplifying" it. When genuinely unsure, propose and let the
   user decide rather than overwriting.

## Report — always emit, even on a no-op

Close every run with a short, legible summary of what changed. **Name the
items — don't just count them.** Group under the three outcomes plus deferrals:

- **Created:** each new memory or skill, by title — or "none".
- **Updated:** each memory or skill changed in place, by title + what changed
  (e.g. version bump, invalidated, re-associated) — or "none".
- **Consolidated:** merges, dedupes, simplifications, and new associations
  between existing items, by title — or "none".
- **Deferred:** anything flagged but not acted on, awaiting a user decision —
  or "none".

Keep it to a handful of lines. If the whole sweep was a no-op, collapse it to
one line: "Nothing durable this session — no memories or skills changed."

Do **not** store this report as a memory — that is the summary dump the
guardrails forbid.
