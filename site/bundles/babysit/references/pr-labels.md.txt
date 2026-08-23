# PR Label Protocol (`babysit:*` status labels)

The five exclusive `babysit:*` labels are how PR status is visible from the
`gh pr list` view without opening each PR. Every workflow step (preflight,
Codex review, CI gate, final readiness) calls the helpers defined here to
set/clear status — this file is their single source.

## Status labels (list-view SSOT)

These five labels are **mutually exclusive**. Always remove the other four when
setting one. Create them on first use if missing.

| Label | Color | Meaning | When to set |
|-------|-------|---------|-------------|
| `babysit:active` | `1D76DB` | Agent is **working** (reading threads, coding, local checks, committing/pushing, resolving) | Ownership start; while fixing findings or conflicts; while applying local work |
| `babysit:waiting-codex` | `FBCA04` | **Waiting on Codex** for the current head | While polling for a review of `headRefOid` — during the baseline wait, the post-push auto-review grace window, or an explicitly re-requested review |
| `babysit:waiting-ci` | `BFDADC` | **Waiting on CI** | After a push when checks are pending/queued/in progress, or while re-polling CI before final readiness |
| `babysit:blocked` | `D93F0B` | **Non-looping, unresolved** — needs human | Agent stops without green: wait-cap, human decision, out-of-scope Codex finding, unrelated CI, merge conflict of intent, missing Codex reaction, draft/closed surprise, ambiguous related-path set |
| `babysit:ready` | `0E8A16` | **Codex all clear** + gates pass; human may merge | Final readiness criteria all met (step 7). Agent still does **not** merge |

Filter without opening PRs:

```bash
gh pr list --label 'babysit:active' --state open
gh pr list --label 'babysit:waiting-codex' --state open
gh pr list --label 'babysit:waiting-ci' --state open
gh pr list --label 'babysit:blocked' --state open
gh pr list --label 'babysit:ready' --state open
# or combined:
gh pr list --state open --search 'label:babysit:active OR label:babysit:waiting-codex OR label:babysit:waiting-ci OR label:babysit:blocked OR label:babysit:ready'
```

### Ensure labels exist

Run once per repo (or whenever a create fails with "not found"). Prefer
`--force` so color/description stay canonical:

```bash
BABYSIT_LABELS=(
  'babysit:active'
  'babysit:waiting-codex'
  'babysit:waiting-ci'
  'babysit:blocked'
  'babysit:ready'
)

ensure_babysit_labels() {
  gh label create 'babysit:active' \
    --color '1D76DB' \
    --description 'Babysit agent is actively working this PR' \
    --force
  gh label create 'babysit:waiting-codex' \
    --color 'FBCA04' \
    --description 'Babysit waiting for Codex review on current head' \
    --force
  gh label create 'babysit:waiting-ci' \
    --color 'BFDADC' \
    --description 'Babysit waiting for CI checks on current head' \
    --force
  gh label create 'babysit:blocked' \
    --color 'D93F0B' \
    --description 'Babysit stopped; unresolved blocker needs human' \
    --force
  gh label create 'babysit:ready' \
    --color '0E8A16' \
    --description 'Codex all clear + gates pass; human may merge' \
    --force
}
```

### Set exclusive status (transition-only)

```bash
# status is one of: active | waiting-codex | waiting-ci | blocked | ready
# Keep LAST_BABYSIT_STATUS in the working note; no-op if unchanged.
set_babysit_status() {
  local status="$1"
  local label="babysit:${status}"
  if [[ "${LAST_BABYSIT_STATUS:-}" == "$status" ]]; then
    return 0
  fi
  # Tolerate missing labels on remove (gh exits non-zero if not present).
  for l in "${BABYSIT_LABELS[@]}"; do
    gh pr edit "$PR_NUMBER" --remove-label "$l" 2>/dev/null || true
  done
  gh pr edit "$PR_NUMBER" --add-label "$label" || return 1
  LAST_BABYSIT_STATUS="$status"
}
```

If label create/edit fails (permissions), log once and continue the review loop —
labels are UX, not a hard gate. Do **not** invent alternate label names.

When clearing all babysit labels (merged/closed PR with no follow-up):

```bash
clear_babysit_labels() {
  for l in "${BABYSIT_LABELS[@]}"; do
    gh pr edit "$PR_NUMBER" --remove-label "$l" 2>/dev/null || true
  done
  LAST_BABYSIT_STATUS=""
}
```

### Stale-label sweep (run once at preflight)

Labels are cleared when babysit itself sees a PR close, but the human owner
merges PRs while no run is watching — those keep their last `babysit:*` label
forever and rot the list view (at one audit, 25 PRs wore `babysit:blocked`
while only 6 were genuinely blocked and open). Sweep once per run, right after
`ensure_babysit_labels`, across both closed and merged PRs:

```bash
sweep_stale_babysit_labels() {
  local n
  for l in "${BABYSIT_LABELS[@]}"; do
    for state in closed merged; do
      gh pr list --state "$state" --label "$l" --limit 100 --json number \
        --jq '.[].number'
    done
  done | sort -u | while read -r n; do
    [[ -n "$n" ]] || continue
    for l in "${BABYSIT_LABELS[@]}"; do
      gh pr edit "$n" --remove-label "$l" 2>/dev/null || true
    done
  done
}
```

Skip in `--dry-run`. Sweep failures are logged and ignored — like all label
work, this is UX, not a gate.

### Mandatory stop comment (before `blocked`)

A `babysit:blocked` label with no explanation on the PR is a defect — the
human sees the red label in the list and still has to reconstruct why. Post
the stop comment **first**, then set the label:

```bash
# post_babysit_stop_comment <class> <detail>
#   class: decision | scope | nonconvergent | wait | ci | conflict | quota | size
#   detail: the exact decision needed or reason, one short paragraph
post_babysit_stop_comment() {
  local class="$1" detail="$2"
  if [[ "${DRY_RUN:-0}" == "1" ]]; then
    echo "dry-run: would post stop comment (class=$class): $detail"
    return 0
  fi
  gh pr comment "$PR_NUMBER" --body "**Babysit stopped — \`$class\`.** $detail"
}
```

Every `set_babysit_status blocked` call site must be preceded by
`post_babysit_stop_comment` with the blocker class from the Output section's
taxonomy and, for a `decision`/`scope` stop, the exact unresolved question.

### Transition rules

| Event | Label action |
|-------|----------------|
| PR number resolved and babysit starts (create or take over) | `ensure_babysit_labels`, `sweep_stale_babysit_labels`, then `set_babysit_status active` |
| Entering any step 3 wait: baseline request, post-push auto-review grace, or explicit re-request | `set_babysit_status waiting-codex` **once** when wait begins — not each 60s poll |
| Auto-review grace expires with no review (no findings arrived) | `set_babysit_status active` (or straight to step 6/7) — **not** `blocked`, and **not** a new `@codex review` comment |
| Codex review for current head arrives; reading/classifying threads or coding fixes | `set_babysit_status active` |
| After push, CI checks pending/queued/in_progress | `set_babysit_status waiting-ci` **once** when wait begins |
| CI finished (pass/fail/skip) and agent is fixing or re-checking | `active` on fix work; after a failing-but-in-scope CI fix push, may return to `waiting-ci` then later `waiting-codex` |
| Agent stops without final readiness (any blocker or wait-cap) | `post_babysit_stop_comment <class> <detail>` then `set_babysit_status blocked`, **before** the final report |
| Final readiness green (step 7) | `set_babysit_status ready` |
| Target PR already **merged/closed** mid-flow and work ends (or follow-up PR opened) | `clear_babysit_labels` on the closed/merged PR; set status on the follow-up if one is opened |
| `--dry-run` | never create, add, or remove labels |

Typical cycle (cheap — ~one label write per phase, not per poll):

`active` → `waiting-codex` (baseline, **one** `@codex review`) → `active` (fix)
→ push → `waiting-ci` → `waiting-codex` (grace, **no** new comment) → … →
`ready`

Exactly one `@codex review` comment appears in that whole cycle, at the first
arrow. Every later `waiting-codex` is a passive wait on smart auto-review.
