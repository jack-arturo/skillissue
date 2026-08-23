# CI Failure Triage & Final Readiness (steps 6-7)

The closing gate: check CI and mergeability, triage/fix in-scope failures,
and confirm every final-readiness condition before the PR is handed back to
the human as `babysit:ready`. Never merge — see the top-level Guardrails in
`SKILL.md`.

Calls into helpers defined elsewhere:
- `set_babysit_status` (`waiting-ci`, `active`, `blocked`, `ready`) — defined
  in [pr-labels.md](pr-labels.md).
- A base-branch merge or an in-scope CI fix push returns to the Codex
  baseline/grace-mode wait in
  [codex-review-threads.md](codex-review-threads.md) (step 3) — no new
  `@codex review` comment.

### 6. CI and Mergeability Gate

#### Combined post-push wait

After any babysit push, CI and Codex smart auto-review start from the same
clock — the push. Waiting them out sequentially (CI to completion, then a
fresh Codex grace) double-pays 2-10 minutes per round for nothing. Run one
loop:

- Record the push time; the Codex grace deadline (`--codex-grace`, default
  10m) and the CI wait cap (`--wait-cap`) both measure from it.
- Poll every 60 seconds: `gh pr checks` **and** `codex_reviewed_head` /
  `codex_current_reaction` / `codex_quota_skip_since_head` (step 3 helpers).
- Label by what is still pending — `waiting-ci` while checks run, then
  `waiting-codex` if the grace window is still open after checks finish —
  transition-only, never per tick.
- Exit when both are settled: checks concluded (pass/fail/skip), and the head
  is review-settled (reviewed, quota-skipped, or grace expired). A Codex
  review with findings that arrives mid-CI can be triaged (step 5 classify)
  while checks finish — don't idle on a wait that already has work in it.

Check PR checks:

```bash
gh pr checks "$PR_NUMBER" --json name,bucket,state,link
```

- If checks are pending/queued/in progress, `set_babysit_status waiting-ci`
  once, poll with a bounded wait, and do not re-label each tick.
- If checks pass or skip, continue (set `active` only if more agent work
  follows immediately; otherwise proceed toward step 7 / Codex as needed).
- If checks fail and are caused by the PR scope, set `active`, inspect logs,
  fix locally, verify, push, and return to step 3 in grace mode — no new
  `@codex` tag (or re-enter `waiting-ci` after push).
- If checks fail for an unrelated reason, post the stop comment (class `ci`),
  set `babysit:blocked`, and report.
- If no checks appear after bounded discovery, report `CI not configured` and
  continue (not a block by itself).

Check mergeability:

```bash
gh pr view "$PR_NUMBER" --json state,isDraft,mergeable,reviewDecision,headRefOid,url,title --jq '.'
```

If `mergeable` is `CONFLICTING`, set `active`, merge the latest base into the
PR branch, and resolve conflicts while preserving both intents. If the intents
conflict, abort the merge, set `babysit:blocked`, and ask for clarification.
Do not force-push. After conflict resolution, push and return to step 3 in
grace mode. A base merge is exactly the kind of head that smart auto-review is
there to judge — do not tag `@codex` for it.

### 7. Final Readiness

Final handoff is green only when:

- PR is open and not draft.
- **Codex has reviewed this PR at least once** (the baseline is satisfied — a PR
  Codex has never looked at is never `ready`).
- The current head is **review-settled**: either Codex reviewed this exact
  `headRefOid`, or the `--codex-grace` window elapsed after the push with no
  auto-review, meaning Codex declined to flag it. Both count as settled; only
  "still inside the grace window" does not. A **quota-skipped** head (step 3's
  announced-limit detection) also settles, but the final report must call it
  out — the human is merging a head Codex could not review, not one it chose
  not to.
- No unresolved, non-outdated valid Codex P0/P1 threads remain.
- CI passes, skips, or is explicitly `CI not configured`.
- `mergeable` is not `CONFLICTING`.
- No merge was performed by the agent.

When all of the above hold, set `babysit:ready` (clears active / waiting /
blocked). That label is the list-view signal that Codex gave the all clear
and the human can merge.

