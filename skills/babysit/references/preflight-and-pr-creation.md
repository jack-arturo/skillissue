# Preflight & PR Creation (steps 1-2)

Covers resolving or creating the target PR and taking babysit ownership of
it before any Codex or CI work begins.

Calls into helpers defined elsewhere:
- `ensure_babysit_labels`, `set_babysit_status`, `sweep_stale_babysit_labels`,
  `post_babysit_stop_comment` — defined in [pr-labels.md](pr-labels.md).
- `request_codex_baseline_review`, `codex_lifetime_rounds` — defined in
  [codex-review-threads.md](codex-review-threads.md) (steps 3/5).

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
`ensure_babysit_labels`, `sweep_stale_babysit_labels`, and
`set_babysit_status active` (skip all three in dry-run).

#### Size gate

Measure the diff before committing to the loop — changed lines, additions plus
deletions. Existing PR: `gh pr view "$PR_NUMBER" --json additions,deletions`.
Create-PR mode: `git diff --shortstat "$BASE_REF"...HEAD` plus staged/unstaged
work in the related-path set.

- **Over 700 changed lines and no `--allow-large`:** stop. Recommend splitting
  (the split-to-prs skill) and name the natural seams if they are obvious. On
  an existing PR, `post_babysit_stop_comment size "<detail>"` then
  `set_babysit_status blocked`; in create-PR mode, do not create the PR —
  report instead. Loop data: 700+ line PRs take 3+ review rounds 58-84% of the
  time and block at 4-6x the overall rate; no sub-100-line PR ever blocked.
- **400-700:** proceed, but flag the size and the multi-round risk in the
  working note and final report.

#### Lifetime remediation budget (existing PR takeover)

Before doing any thread work on a PR that already has Codex history, derive
the spent budget from the PR itself — `codex_lifetime_rounds` (step 5). A PR
whose lifetime rounds are already at the ceiling is **not** entitled to more
fixes just because this is a fresh invocation: unless `--reset-budget` was
passed, treat it as `nonconvergent`, post the stop comment naming the human
decision needed, and stop before editing anything.

Also record in the working note whether a Codex review request already exists
on this PR (`codex_review_already_requested`, step 3). Taking over a PR that
was already requested/reviewed — including one a previous babysit run
handled — does **not** earn a new `@codex review` comment.

### 2. Create a PR When Needed

Build an explicit related-path list from status, diffs, and the user request.
Leave unrelated dirty files unstaged.

Run focused local checks that match the changed files. If the repo has no
obvious focused check, run the narrowest existing test/lint command or record
`local checks not configured`.

Create a short conventional branch from the default branch unless the current
branch is already an appropriate feature branch, and commit only related paths.

#### Local pre-PR review gate

Run one local Codex review of the branch **before pushing and opening the
PR** — every finding caught here is a GitHub review round that never happens
(no push, no CI run, no thread to reply/resolve, no ~6-minute round-trip).
Skip silently when `--skip-local-review` was passed or the runner is absent,
and note the skip in the report.

```bash
# Resolve the codex plugin's companion script; empty means "gate unavailable".
codex_companion_path() {
  command -v codex >/dev/null 2>&1 || return 0
  ls -d "$HOME"/.claude/plugins/cache/openai-codex/codex/*/ 2>/dev/null \
    | sort -V | tail -1 | sed 's|$|scripts/codex-companion.mjs|'
}

# codex_local_review [extra args...] — one bounded local review pass.
codex_local_review() {
  local companion
  companion="$(codex_companion_path)"
  [[ -n "$companion" && -f "$companion" ]] || { echo "local review unavailable"; return 0; }
  node "$companion" review --wait "$@"
}
```

1. `codex_local_review --base "$BASE_REF" --scope branch` — default model
   (matches the GitHub reviewer's depth; effort follows `~/.codex/config.toml`;
   do not pass `-m spark` — the built-in reviewer rejects it, verified
   2026-08-12). A failed run ("Reviewer failed to output a response") is a
   skip, not a blocker — note it and continue.
2. Triage its findings exactly like GitHub threads (step 5's Review Contract /
   Threat Model gate). Fix what qualifies, amend or commit.
3. At most **one** follow-up local review to confirm substantial fixes. Two
   local iterations is the hard cap — then open the PR regardless; the GitHub
   review is the authoritative gate, and local review is an accelerant, not a
   second loop to get stuck in.

With `--adversarial`, additionally run
`node "$companion" adversarial-review --wait --base "$BASE_REF" --scope branch [focus...]`
once. Its design/approach findings are **reported to the human, never
auto-fixed** — an adversarial challenge to the chosen approach is by
definition the scope/product territory babysit escalates. Correctness findings
it happens to surface triage normally.

Then push and open a ready PR:

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
`set_babysit_status active`. Do not post a review request here. Step 3 first
waits for smart auto-review, then posts a single guarded baseline fallback only
when there is neither a Codex completion nor a human review request.
