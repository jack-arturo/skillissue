---
name: babysit
description: Create or take over a GitHub pull request, require Codex review on the current head, address valid Codex P0/P1 review threads, fix scoped CI failures, and leave the PR merge-ready without merging. Maintains exclusive babysit:* PR labels (active, waiting-codex, waiting-ci, blocked, ready) so status is visible from the PR list without opening each PR. Use when the user asks to babysit a PR, create a PR and review it, address Codex comments, or get a PR green.
license: MIT
tags: [git, github, pull-request, codex, ci, review, automation, general, labels]
agents: [claude-code, codex, cursor]
category: git
metadata:
  version: "1.2.0"
capabilities:
  network: true
  filesystem: readwrite
  tools: [Bash, Read, Edit, Grep, Glob]
requires-secrets: []
argument-hint: "[pr-number-or-url] [--dry-run] [--wait-cap <duration>] [--only <path-glob>]"
---

# Babysit

Create or take over a GitHub PR and keep working until it is merge-ready. Green
means ready for the user to merge, not merged by the agent.

PR status is always reflected with **exclusive** `babysit:*` labels so the PR
list shows loop state at a glance — no need to open each PR.

## When to Use

- The user says "babysit this PR", "get this PR green", "create a PR and
  review it", "address Codex comments", or "fix Codex feedback".
- The user provides a PR number or URL.
- The current branch has local work that should become a PR and pass review.

## Preconditions

1. Current directory is inside a git repository with a GitHub remote.
2. `gh auth status` succeeds.
3. Codex review is enabled for the repository. If Codex does not react within
   the wait cap, stop and report that blocker.
4. Default wait cap is 45 minutes per external review/check wait unless
   `--wait-cap` is supplied.

## Guardrails

- Never merge the PR, enable auto-merge, delete the branch, force-push, reset,
  stash, clean, discard, or overwrite unrelated user work.
- Stage only paths that are clearly part of the requested change. Stop if the
  related-path set is ambiguous.
- Codex is the automated review gate. Do not request Copilot or Bugbot review
  unless the user explicitly asks.
- Human comments, Bugbot comments, and subjective comments are reported, not
  resolved, unless the user explicitly puts them in scope.
- Do not treat an empty review-thread list as green until Codex has completed
  a review for the current `headRefOid`.
- Resolve a Codex thread only after replying and only when the fix landed or
  the concern is demonstrably moot.
- If a Codex thread is security-sensitive, subjective, or requires a broad
  refactor outside PR scope, stop for human input.
- **Labels:** keep exactly one of the exclusive `babysit:*` status labels on
  the PR while babysitting (or none only when labels cannot be written). Never
  leave a stale waiting/active label after the agent stops. Skip all label
  mutations in `--dry-run`.
- **Label overhead:** change labels only on **state transitions**, never every
  poll tick. Cache the last applied status in the working note and no-op when
  unchanged.

## Status labels (list-view SSOT)

These five labels are **mutually exclusive**. Always remove the other four when
setting one. Create them on first use if missing.

| Label | Color | Meaning | When to set |
|-------|-------|---------|-------------|
| `babysit:active` | `1D76DB` | Agent is **working** (reading threads, coding, local checks, committing/pushing, resolving) | Ownership start; while fixing findings or conflicts; while applying local work |
| `babysit:waiting-codex` | `FBCA04` | **Waiting on Codex** for the current head | After `@codex review` (or when review is missing/stale) and while polling for a review of `headRefOid` |
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

### Transition rules

| Event | Label action |
|-------|----------------|
| PR number resolved and babysit starts (create or take over) | `ensure_babysit_labels` then `set_babysit_status active` |
| Entering step 3 wait: review missing/stale; after `@codex review` | `set_babysit_status waiting-codex` **once** when wait begins — not each 60s poll |
| Codex review for current head arrives; reading/classifying threads or coding fixes | `set_babysit_status active` |
| After push, CI checks pending/queued/in_progress | `set_babysit_status waiting-ci` **once** when wait begins |
| CI finished (pass/fail/skip) and agent is fixing or re-checking | `active` on fix work; after a failing-but-in-scope CI fix push, may return to `waiting-ci` then later `waiting-codex` |
| Agent stops without final readiness (any blocker or wait-cap) | `set_babysit_status blocked` **before** the final report |
| Final readiness green (step 7) | `set_babysit_status ready` |
| Target PR already **merged/closed** mid-flow and work ends (or follow-up PR opened) | `clear_babysit_labels` on the closed/merged PR; set status on the follow-up if one is opened |
| `--dry-run` | never create, add, or remove labels |

Typical cycle (cheap — ~one label write per phase, not per poll):

`active` → `waiting-codex` → `active` (fix) → push → `waiting-ci` → `waiting-codex` → … → `ready`

## Workflow

### 1. Preflight

Run the inspection commands and keep a short working note of repo, branch,
dirty paths, PR number, wait cap, last babysit label status, and whether this
is existing-PR mode or create-PR mode.

```bash
git status --short --branch
git remote -v
git branch --show-current
gh auth status
gh repo view --json nameWithOwner,owner,name,defaultBranchRef --jq '.'
git diff --stat
git diff --cached --stat
git diff
git diff --cached
git ls-files --others --exclude-standard
```

Resolve the PR target in this order:

1. PR number or URL from arguments.
2. Existing PR for the current branch: `gh pr view --json number,url,state,isDraft,headRefName,headRefOid,baseRefName`.
3. If no PR exists and local related work exists, use create-PR mode.

Stop if the existing PR is draft, closed, or not from the current local branch
unless the user explicitly asked to work that PR. If stopping here after a PR
number was resolved, set `babysit:blocked` (unless dry-run).

If the target PR was **merged mid-flow** (the human owner can merge while you
work, sometimes before review findings are addressed), do not try to reopen or
re-push it — its branch is usually deleted. Instead check whether valid Codex
P0/P1 findings are still unresolved: those changes are now live on the base
branch. If so, treat it as create-PR mode — branch off the updated base,
cherry-pick or re-apply only the corrective commit, and open a clean follow-up
PR that references the merged one and the finding it closes. Reply on the
merged PR's threads pointing at the follow-up. Clear all `babysit:*` labels
from the merged PR; put `babysit:active` on the follow-up. If nothing valid is
unaddressed, report the merge, clear `babysit:*` on the merged PR, and stop.

Once a live PR number exists and babysit owns it, call
`ensure_babysit_labels` and `set_babysit_status active` (skip in dry-run).

### 2. Create a PR When Needed

Build an explicit related-path list from status, diffs, and the user request.
Leave unrelated dirty files unstaged.

Run focused local checks that match the changed files. If the repo has no
obvious focused check, run the narrowest existing test/lint command or record
`local checks not configured`.

Create a short conventional branch from the default branch unless the current
branch is already an appropriate feature branch. Commit only related paths,
push, and open a ready PR:

```bash
git add -- <related paths>
git commit -m "<type>(<scope>): <imperative summary>"
git push -u origin "$BRANCH"
gh pr create --base "$BASE_REF" --head "$BRANCH" \
  --title "<type>(<scope>): <imperative summary>" \
  --body "<summary, tests, risk notes>"
```

Then resolve:

```bash
gh pr view "$BRANCH" --json number,url,headRefOid,isDraft,state,mergeable --jq '.'
```

Immediately after the PR number is known: `ensure_babysit_labels` and
`set_babysit_status active`.

### 3. Require Codex Review on Current Head

Codex completion can appear as:

- a PR review by `chatgpt-codex-connector` or
  `chatgpt-codex-connector[bot]` whose body contains `Reviewed commit: <sha>`;
- an issue comment by either connector login with the same reviewed-commit
  marker;
- a clean-result Codex issue comment without a reviewed-commit marker when it
  clearly says there are no major issues and was created after the current head
  commit.

Fetch PR state:

```bash
gh pr view "$PR_NUMBER" --json headRefOid,commits,reviews,latestReviews,comments --jq '.'
```

Match the reviewed commit to the current `headRefOid` by prefix. If the review
is missing or stale, request exactly one fresh review with:

```bash
gh pr comment "$PR_NUMBER" --body "@codex review"
```

When entering the wait (review missing/stale after the request, or already
waiting for current head), call `set_babysit_status waiting-codex` **once**.
Poll every 60 seconds until the wait cap — **do not** re-apply the label each
tick. If Codex still has not reviewed the current head, set
`babysit:blocked`, stop, and report the blocker.

When a matching review for the current head is present, move on (typically
`set_babysit_status active` when starting thread work in step 4/5).

### 4. Fetch Active Codex Threads

Fetch every review-thread page; never stop at the first 100 threads.

```bash
gh api graphql -F owner="$OWNER" -F repo="$REPO" -F pr="$PR_NUMBER" -f query='
query($owner:String!, $repo:String!, $pr:Int!, $cursor:String) {
  repository(owner:$owner, name:$repo) {
    pullRequest(number:$pr) {
      headRefOid
      reviewThreads(first:100, after:$cursor) {
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          comments(first:10) {
            nodes {
              id
              databaseId
              author { login }
              body
              diffHunk
              createdAt
              url
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}'
```

Repeat with `-F cursor="$END_CURSOR"` until `hasNextPage` is false.

Filter to active Codex root threads:

- `isResolved == false`
- `isOutdated == false`
- root comment author is `chatgpt-codex-connector` or
  `chatgpt-codex-connector[bot]`

### 5. Resolve Valid Codex P0/P1 Findings

While classifying and fixing, keep `babysit:active` (set once when work starts).

For each active Codex thread:

1. Read the cited file, surrounding code, `diffHunk`, and any relevant tests.
2. Classify the finding as correct, partial, not applicable, or out of scope.
3. Apply the smallest correct fix for valid P0/P1 issues.
4. Run focused local checks.
5. Reply with the specific fix or the concrete code path that makes it moot.
6. Resolve only after the reply and fix/mootness are in place.

Reply to a thread using the root comment `databaseId`. The route needs the PR
number as well as the comment id. `pulls/comments/{id}/replies` — without
`$PR_NUMBER` — is not a GitHub route and returns 404:

```bash
gh api -X POST \
  "repos/$OWNER/$REPO/pulls/$PR_NUMBER/comments/$COMMENT_DATABASE_ID/replies" \
  -f body="$REPLY_BODY"
```

Resolve the review thread:

```bash
gh api graphql -F thread="$THREAD_ID" -f query='
mutation($thread:ID!) {
  resolveReviewThread(input:{threadId:$thread}) {
    thread { id isResolved }
  }
}'
```

After any code change, commit and push the scoped fix, then return to step 3
for a fresh Codex review on the new head. After push, prefer step 6 CI wait
(`waiting-ci`) when checks are still running before re-requesting Codex; once
ready to wait on review, `waiting-codex`.

If stopping for human input on an out-of-scope / security / subjective finding,
set `babysit:blocked` before reporting.

### 6. CI and Mergeability Gate

Check PR checks:

```bash
gh pr checks "$PR_NUMBER" --json name,bucket,state,link
```

- If checks are pending/queued/in progress, `set_babysit_status waiting-ci`
  once, poll with a bounded wait, and do not re-label each tick.
- If checks pass or skip, continue (set `active` only if more agent work
  follows immediately; otherwise proceed toward step 7 / Codex as needed).
- If checks fail and are caused by the PR scope, set `active`, inspect logs,
  fix locally, verify, push, and return to step 3 (or re-enter `waiting-ci`
  after push).
- If checks fail for an unrelated reason, set `babysit:blocked` and report.
- If no checks appear after bounded discovery, report `CI not configured` and
  continue (not a block by itself).

Check mergeability:

```bash
gh pr view "$PR_NUMBER" --json state,isDraft,mergeable,reviewDecision,headRefOid,url,title --jq '.'
```

If `mergeable` is `CONFLICTING`, set `active`, merge the latest base into the
PR branch, and resolve conflicts while preserving both intents. If the intents
conflict, abort the merge, set `babysit:blocked`, and ask for clarification.
Do not force-push. After conflict resolution, push and return to step 3.

### 7. Final Readiness

Final handoff is green only when:

- PR is open and not draft.
- Codex reviewed the current head.
- No unresolved, non-outdated valid Codex P0/P1 threads remain.
- CI passes, skips, or is explicitly `CI not configured`.
- `mergeable` is not `CONFLICTING`.
- No merge was performed by the agent.

When all of the above hold, set `babysit:ready` (clears active / waiting /
blocked). That label is the list-view signal that Codex gave the all clear
and the human can merge.

## Output

Report branch, PR URL/title, mode used, local checks run, Codex review cycles,
Codex threads fixed/addressed/skipped, CI status, final mergeability, **current
`babysit:*` label**, files touched, commits pushed, and explicitly state that
no merge was performed.

Suggested closing line when green:

> Label: `babysit:ready` — Codex all clear; ready for you to merge (agent did
> not merge).
