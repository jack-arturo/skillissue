---
name: triage-autohub-runtime
description: Diagnose recent AutoHub runtime incidents from logs and live health evidence, separating first causes from retry cascades, process-local database poison, credential-copy drift, platform recipient or permission failures, and intentional fallbacks. Use when AutoHub logs show repeated errors, stuck writes, webhook retry storms, MCP authentication failures, or regressions after a restart.
license: MIT
tags:
  - autohub
  - incident-response
  - diagnostics
  - sqlite
  - telegram
  - mcp
agents:
  - claude-code
  - codex
  - cursor
  - autojack
category: operations
metadata:
  version: 1.0.1
capabilities:
  network: true
  filesystem: readwrite
  tools:
    - Bash
    - Read
resources:
  - path: scripts/collect-incident-evidence.js
    type: file
  - path: references/failure-signatures.md
    type: file
---

# Triage AutoHub Runtime

Use this incident-response workflow to diagnose an active or recent AutoHub
operational failure from current logs and health evidence.

## Safety contract

- Preserve dirty worktrees. Inspect before editing, isolate repairs in a clean
  worktree, and stage only incident-related files.
- Treat reads, local checks, self/test-target messages, and reversible
  restarts as green actions. Ask before third-party messages, credential
  rotation, deploys, pushes, merges, destructive recovery, or production-data
  mutation.
- Never print or store tokens, environment values, process command lines,
  message bodies, capability URLs, or full Telegram history.
- A transient `BEGIN IMMEDIATE; ROLLBACK` probe may acquire a write lock but
  must not change rows or schema.
- Do not infer WAL health from file size. Retained allocation is not proof of
  contention.

## 1. Resolve the runtime being diagnosed

1. Resolve the requested checkout, its canonical checkout, and any worktree
   gitdir.
2. Inspect `git status --short --branch` in every checkout that could receive
   edits.
3. Identify each running service by PID, port, cwd class, and loaded commit.
   Never inspect or print process command lines or environments.
4. Record which checkout owns `logs/dev-all.log`, `data/hub-unified.db`,
   and the active `.env`. Do not assume the current shell cwd is the runtime
   cwd.

## 2. Recall once, early

Perform exactly the standard two AutoMem recalls before analysis:

```javascript
mcp__memory__recall_memory({
  tags: ['preference'],
  limit: 20,
  sort: 'updated_desc',
  format: 'detailed',
});

mcp__memory__recall_memory({
  query:
    '<AutoHub modules, exact error strings, platform names, and incident nouns>',
  tags: ['autohub'],
  language: 'javascript',
  time_query: 'last 90 days',
  limit: 30,
  format: 'detailed',
});
```

Use one additional bugfix/solution recall only when a concrete error signature
needs historical disambiguation.

## 3. Collect structural evidence

Run the bundled collector from this skill directory:

```bash
node scripts/collect-incident-evidence.js --repo <autohub-root> --probe-write-lock
```

The report is allowlisted JSON. It may contain paths, PIDs, commit hashes,
counts, timestamps, SQLite header facts, and credential hash prefixes. It must
not contain raw log lines, messages, secrets, process commands, environment
values, URLs, or Telegram readback history.

If a real-surface smoke prints more than the necessary proof, retain only its
sentinel, standard/ephemeral IDs, mode, timestamp, and pass/fail result.

## 4. Establish the restart boundary

Find the latest complete process restart boundary before clustering errors.
Split evidence into:

- pre-boundary symptoms, which cannot prove the new process is unhealthy;
- startup/authentication results for the new process;
- post-boundary first error;
- downstream repeats, retries, and secondary failures.

A healthy HTTP readiness endpoint proves only readiness. It does not prove an
authenticated tool operation, and an authenticated tool operation does not
prove the user-facing surface. Capture all three layers when relevant.

## 5. Build a causal timeline

Order events by first occurrence after the boundary:

1. triggering input or operation;
2. first failing subsystem;
3. lock, retry, or fallback behavior;
4. downstream model, persistence, and reply failures;
5. recovery action and first green evidence.

Prefer the earliest mechanism that explains every later cluster. Count repeated
signatures, but do not let a high-volume retry cascade outrank its first cause.

Consult `references/failure-signatures.md` before classifying SQLite, Telegram,
Metal, or corruption signatures.

## 6. Classify before changing code

Assign every cluster to one of these buckets:

- code defect;
- process-local poisoned state;
- credential provenance/config-copy drift;
- external permission or recipient-resolution failure;
- upstream payload/contract drift;
- intentional fallback with successful downstream completion;
- unknown, requiring more evidence.

For credential failures, compare hash prefixes across the canonical `.env`,
copied host configs, and loaded process status. Never compare or print values.
Sync a stale host copy before proposing rotation.

For novel platform payloads, compare structural field names and semantics with
the current official upstream contract. Never log the raw payload. Telegram
`CHAT_WRITE_FORBIDDEN` is not automatically a bad credential: enumerate
`tg_dialogs`, require the exact dialog name, and treat fuzzy/read-only matches
as recipient-resolution failures until disproved. Do not send to a third party
to verify this.

An intentional fallback is healthy when its downstream operation completes.
For example, a successful Evernote fallback is not an incident by itself.

## 7. Repair the narrowest first cause

Write a deterministic failing test before changing implementation. Preserve
existing local-only/remote behavior boundaries. When state is poisoned and
cannot recover in-process, fix the ownership/release defect and restart the
affected process only after active work settles.

Run verification without temporary environment overrides. An override that
masks persisted config drift is not acceptance evidence.

## 8. Verify recovery on the real surface

Require:

1. focused lint and deterministic tests;
2. database `quick_check`, SHM active-frame facts, and an actual contention
   probe before declaring global SQLite contention;
3. a fresh process boundary when the old process was poisoned;
4. post-boundary absence of the cascade for the incident's observation window;
5. the real user/caller surface, using only a dedicated self/test target.

Use the repository's raw evidence block:

```markdown
## Verification Evidence
- Surface: <surface>
- Tier 1: <exact command> → <raw result>
- Tier 2: <exact command> → Observed: <allowlisted raw proof>
- Red→green: <before assertion failed; after assertion passed>
- Claim: <user-visible capability>
```

If the triggering Telegram update stopped retrying, use only a verified
self/test dialog for inbound proof. Otherwise state that ingress evidence is
unavailable; do not substitute a mock.

## 9. Store only the durable outcome

Invoke the `automem` skill after the root cause and repair survive
verification. Follow its atomic recall → store/update → verify → associate
ritual. Store one durable root-cause/fix memory, not a session summary, log
dump, progress note, PID, token hash, or test transcript. Associate it with the
most relevant prior incident or decision.

## Incident acceptance check

This workflow passes the motivating incident only if it identifies both:

- a timed-out adapter transaction poisoned a process-local Prisma mutex because
  forced rollback bypassed the adapter transaction's release path;
- an empty/unsupported Telegram update was acknowledged too late and drove a
  retry cascade.

It must not call retained WAL allocation global contention when `quick_check`,
SHM active-frame state, an external write-lock probe, and cross-process writes
are healthy.
