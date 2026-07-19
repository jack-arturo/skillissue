---
name: automem
description: Recall, store, and associate memories via the AutoMem MCP server (mcp__memory__*). Invoke on user corrections ("actually", "no, I prefer", "stop doing X", "we decided X already", "I told you before"), decisions that stabilize after a round of pushback ("let's go with X", "ship it", "yeah that's the plan", "do it that way"), or articulated patterns ("I always X", "every time", "my thing is"). Also invoke when storing any fact that needs to outlive the session, or when a recalled memory needs to be updated, invalidated, or associated. Covers storage discipline, the atomic recall-store-verify-associate ritual, temporal validity, the never-store list, and the silent-fail verification workaround.
license: MIT
tags: [memory, automem, mcp, meta]
agents: [claude-code, codex, autojack]
category: meta
metadata:
  version: "1.0.0"
capabilities:
  network: false
  filesystem: readonly
  tools: []
---

# AutoMem Memory Discipline

The AutoMem MCP server (tools: `mcp__memory__*`) is the only persistent memory
on this machine. This skill is the canonical operational guide for using it
well: when to store, what to store, how to associate, how to verify a store
landed, and what NOT to store.

This skill does **not** cover session-start recall. That is delivered by the
runtime: a shell hook (`~/.claude/hooks/automem-session-start.sh`) in Claude
Code, or prose at the top of `~/.codex/AGENTS.md` in Codex. Both fire before
any skill can load.

## When to use

Invoke on any of these three trigger families. Listen for the literal phrases
— pattern-matching silently is how memory hygiene degrades.

1. **User correction or override.** Phrases: "actually", "no, I prefer", "not
   X, Y", "that's wrong", "stop doing X", "never do X", "I told you before",
   "we decided X already", "you keep doing Y". Store as `Preference`,
   importance 0.9, confidence 0.95. Associate `INVALIDATED_BY` to the prior
   memory it overrides. Store this turn, not later.
2. **Decision stabilizes after at least one round of discussion.** Phrases:
   "let's go with X", "yeah that's the plan", "do it that way", "ship it",
   "okay let's do that". Signal: the decision survived pushback. One-turn
   ideas don't qualify. Store as `Decision`, importance 0.85–0.9. If
   alternatives came up, associate `PREFERS_OVER` against them.
3. **Pattern articulated, not inferred.** Phrases: "I always do X", "every
   time", "this is how I usually", or you observing "you tend to do X" and
   the user confirming. Patterns get stored when **articulated**, not when
   you pattern-match silently. Store as `Pattern`, importance 0.8. Associate
   `EXEMPLIFIES` to concrete examples.

Also invoke when you need to update a fact (URL, version, deployment state)
or invalidate one (a deprecation), even without a trigger phrase.

## The atomic ritual — every store runs all four steps

1. **Recall** with a tight query (`limit: 5`) to find what this relates to.
2. **Store** with `type`, `importance`, `tags`, and a non-default `confidence`.
3. **Verify** with a recall on a distinctive phrase from the content you just
   stored. Retry the store once if verify misses (silent-fail insurance —
   `store_memory` can return success while failing to persist).
4. **Associate** to the memory found in step 1, if plausible (`INVALIDATED_BY`,
   `PREFERS_OVER`, or `EXEMPLIFIES` per the trigger family above).

Step 4 is where the graph gets built. Skipping it is the #1 reason AutoMem
degrades into a flat bag of notes. Skip association only if the step-1
related-memory search returns nothing plausible.

## Storage call shape

```
mcp__memory__store_memory({
  content: "Brief title. Context + reasoning. Outcome.",   // 150–300 chars
  type: "Decision",     // Decision | Pattern | Preference | Style | Habit | Insight | Context
  tags: ["<category>", "<project-slug>", "<language>"],     // bare strings
  importance: 0.85,
  confidence: 0.9
})
```

### Required tags

Use **bare** tags. The corpus has 9,000+ memories tagged this way; namespace
prefixes (`project/<slug>`, `lang/<x>`) silently bifurcate recall.

- One category tag when applicable: `preference` | `decision` | `pattern` |
  `bugfix` | `solution` | `milestone` | `deployment` | `build` | `test`.
- Project slug (bare) when project-specific, e.g., `mcp-automem`. Omit if
  the slug collides with a common topic word (`video`, `test`, `api`).
- Language tag (bare): `typescript`, `python`, `go`, etc.

Hierarchical entity tags the server injects (`entity:people:jack`) use
colons — do not author these by hand.

### Importance scale (how much this matters)

- `0.9–1.0` — user preferences, architectural decisions, prod deployments,
  critical bugs.
- `0.7–0.8` — features, non-critical bug fixes, articulated patterns.
- `0.5–0.6` — standard context, session milestones.
- `<0.5` — low-signal; let it decay.

### Confidence scale (how sure you are it's stable)

A separate dial. Don't default everything to 0.95 — it flattens the signal
the decay system uses to identify noise.

- `0.95` — user-stated facts, direct corrections, explicit preferences.
- `0.80` — observed patterns the user would recognize.
- `0.60` — tentative inference, not yet confirmed.

## Mandatory association pairings

| Trigger | Store | Then associate |
|---|---|---|
| User correction | `Preference`, importance 0.9, tags include `correction` | Find old memory → `INVALIDATED_BY` (strength 0.9) |
| Architectural decision | `Decision`, importance 0.9 | Find alternatives → `PREFERS_OVER` |
| Bug fix | `Insight`, importance 0.75, tags include `bugfix`, `solution` | Link to bug report → `LEADS_TO` |
| Pattern articulated | `Pattern`, importance 0.8 | Link to concrete example → `EXEMPLIFIES` |
| Knowledge evolved | `update_memory` old, store new | `EVOLVED_INTO` (old → new) |
| Deprecated info | `update_memory` (importance 0.1, `metadata.deprecated: true`) | `INVALIDATED_BY` (old ← new) |

## Update > duplicate

When a fact changes in place — a price, a URL, a version, a deployment
state — call `update_memory` on the existing memory. Reserve new-store +
`INVALIDATED_BY` for archaeology worth preserving for the record
("considered $15/mo before landing on $9/mo"). Casual updates ("dev URL
changed") are not archaeology.

Before storing on any topic, recall first. If a related memory exists,
prefer `update_memory` or an association over a near-duplicate node.

## Temporal validity

For facts with a shelf life, set `t_valid` (ISO 8601 UTC, usually now) and
`t_invalid` when known. These fields don't appear in `/recall` envelopes
but ARE persisted and queryable via `GET /memory/<id>`.

Use for: current deployment URL, active staging env, incident window,
feature-flag rollout, ongoing PR, current sprint focus.

```
mcp__memory__store_memory({
  content: "mcp-automem deployed to Railway at https://automem.up.railway.app",
  type: "Context", importance: 0.8,
  tags: ["deployment", "mcp-automem", "production", "railway"],
  t_valid: "2026-04-17T00:00:00Z",
  t_invalid: "2026-05-17T00:00:00Z"
})
```

## Content guidelines

- **Target:** 150–300 chars. One paragraph. Format: "Title. Context.
  Outcome."
- **Soft limit:** 500 chars (server auto-summarizes above).
- **Hard limit:** 2000 chars (rejected).
- **If more detail is needed:** split into atomic memories and associate.
- **Put structured data in `metadata`**, not `content`. Exit codes, file
  paths, commit SHAs, metrics belong there.

## Never store

- Secrets, credentials, API keys, private tokens, PII.
- Session summaries. Ever. "End of session, here's what we accomplished" is
  the pattern that creates most corpus garbage.
- Agent task-result dumps. Same family.
- "Useful context that might matter later." Speculative stores are noise.
  If unsure, skip.
- Things the user said they'll remember themselves — calendar, plans,
  casual opinions.
- Confirmations. "Great, that worked" doesn't need a memory. The decision
  that preceded it might.
- Anything stored to perform attentiveness. Memory is for future-you, not
  for showing the user you were listening.
- Temporary build output, logs, debug dumps.
- Large code blocks. Store the pattern or decision instead.
- Duplicate memories. Recall first.

## Known server quirk — verify after store

`store_memory` can return success while failing to persist (issue #97 A).
The atomic ritual's step 3 is not optional — after storing anything you
care about, do a quick recall on a distinctive phrase from the content. If
it doesn't come back, retry the store once.

## Anti-patterns

- Storing at the end of a session as a summary dump.
- Defaulting `confidence` to 0.95 for everything (flattens the decay signal).
- Using namespace-prefixed tags (`project/foo`, `lang/typescript`) — these
  silently bifurcate recall.
- Re-recalling mid-conversation when the topic hasn't shifted. The 1M
  context already holds turn-1's recall results.
- Storing a new memory when `update_memory` would have updated the old one
  in place.
- Skipping step 4 (association). A flat bag of notes is not a memory graph.
