# Codex Review-Thread Handling (steps 3-5)

The Codex review gate: wait for automatic review first, post one guarded
baseline fallback only when the initial head receives neither a human request
nor a Codex completion, wait out a short grace window on later pushes, fetch
active review threads, and resolve only direct contract breaches or regressions
introduced by a babysit fix. This is the largest and highest-stakes part of the
workflow — the marker-parsing and timestamp-field gotchas below have each
caused real false timeouts/false all-clears in production and are not optional
reading.

Calls into helpers defined elsewhere:
- `set_babysit_status` (`waiting-codex`, `active`, `blocked`) and
  `post_babysit_stop_comment` — defined in [pr-labels.md](pr-labels.md).
- `codex_local_review` — defined in
  [preflight-and-pr-creation.md](preflight-and-pr-creation.md); reused here
  for the pre-push check.

Step 6 (CI gate) and step 7 (final readiness), which this section's fix loop
returns into after every push, are covered in
[ci-and-final-readiness.md](ci-and-final-readiness.md).

### 3. Codex Review: Automatic First, One Baseline Fallback, Then Smart Auto-Review

The review gate has three distinct modes. Conflating them is what produces a
comment storm:

| Mode | When | Babysit posts a comment? | Expiry means |
|------|------|--------------------------|--------------|
| **Initial auto-review grace** | PR just created or taken over with no Codex completion and no human request | **No** | Move to guarded baseline fallback |
| **Baseline fallback** | Initial grace expired with neither a completion nor human request | **Yes — exactly one** | Real timeout → `babysit:blocked` |
| **Auto-review grace** | Every later head (including after a fix push) | **No, never** | Codex declined to review → **proceed** |

Smart auto-review gets the first chance on every PR. The baseline fallback
exists only to establish that Codex can review a previously untouched PR at all.
After that, Codex decides on its own whether a new head is worth reviewing —
that is the setting's entire job, and duplicating it with a manual tag on every
push is what caused reviews to fire every ~20 minutes for hours.

Codex completion can appear as:

- a PR review by `chatgpt-codex-connector` or
  `chatgpt-codex-connector[bot]` whose body carries the reviewed-commit marker;
- an issue comment by either connector login with the same reviewed-commit
  marker;
- a `👍` PR reaction by either connector login, created after babysit observed
  the exact current `headRefOid`; or
- a clean-result Codex issue comment without a reviewed-commit marker when it
  clearly says there are no major issues and was created after the current head
  commit.

A Codex `👀` reaction created after babysit observed the exact current
`headRefOid` means **in progress**, not clean. Do not post a fallback or mark
the head skipped while that reaction remains active. PR reactions carry no
commit SHA, so a reaction observed before this exact-head boundary never
completes or blocks review of that head.

**The marker is markdown, and matching it literally is the #1 cause of false
timeouts.** The body contains:

```
**Reviewed commit:** `78ec7d93ba`
```

Bold delimiters around `Reviewed commit:`, backticks around the sha, and the
sha **truncated to 10 characters**. A grep for `Reviewed commit: <full-sha>`
matches none of that and will report "no review" while Codex has in fact
already reviewed on time. Always strip the decoration and compare by prefix in
the direction *marker is a prefix of `headRefOid`* — never the reverse.

Fetch PR state:

```bash
gh pr view "$PR_NUMBER" --json headRefOid,commits,reviews,latestReviews,comments --jq '.'
```

Detect a review of the current head with this (handles both reviews and issue
comments, and both connector logins):

```bash
codex_reviewed_head() {
  local head
  head=$(gh pr view "$PR_NUMBER" --json headRefOid --jq '.headRefOid')
  # Pipe into a real jq. `gh --jq` takes exactly one expression and does NOT
  # accept `--arg`: `gh pr view … --jq --arg head "$h" '<expr>'` dies with
  # "accepts at most 1 arg(s), received 4" — which reads as "not reviewed"
  # and produces the very false timeout this section exists to prevent.
  gh pr view "$PR_NUMBER" --json comments,reviews \
    | jq -r --arg head "$head" '
        ([.reviews[]?  | select(.author.login | test("chatgpt-codex-connector")) | .body]
         + [.comments[]? | select(.author.login | test("chatgpt-codex-connector")) | .body])
        | map(strings)
        | map(capture("Reviewed commit:\\*{0,2}\\s*`?(?<sha>[0-9a-f]{7,40})`?"; "i").sha)
        | any(. as $s | $head | startswith($s))
      '
}
# prints "true" when Codex has reviewed the current head
```

`map(strings)` is load-bearing, not tidiness: `gh` emits `"body": null` for a
review submitted without one, and `null | capture(…)` aborts the **whole**
filter with `null (null) cannot be matched` — one bodiless Codex review would
otherwise make every subsequent poll report "not reviewed". A body that simply
lacks the marker is already safe: `capture` yields zero outputs and `map` drops
it.

#### The marker-less clean result (fourth bullet above)

`codex_reviewed_head` answers only the two **marker** cases. Codex's third
completion shape — a clean result posted with no reviewed-commit marker —
makes it return `false`, because `capture` yields nothing and `any` over an
empty array is `false`. Treating that `false` as "not reviewed" is a false
timeout on a PR Codex already signed off. Surface those candidates too:

```bash
codex_unmarked_after_head() {
  local head_date
  head_date=$(gh pr view "$PR_NUMBER" --json commits \
                --jq '.commits[-1].committedDate')
  gh pr view "$PR_NUMBER" --json comments,reviews \
    | jq -r --arg since "$head_date" '
        ([.reviews[]?   | select(.author.login | test("chatgpt-codex-connector"))
                        | {at: .submittedAt, body}]
         + [.comments[]? | select(.author.login | test("chatgpt-codex-connector"))
                        | {at: .createdAt,   body}])
        | map(select((.body | type == "string") and (.at != null)))
        | map(select((.body | test("Reviewed commit:"; "i")) | not))
        | map(select(.at > $since))
        | .[] | "\(.at)\n\(.body)\n---"
      '
}
# prints each marker-less connector post newer than the head commit
```

#### Current-head Codex reaction

`👍` is a clean result and `👀` means Codex is working. Reactions have no
commit SHA, so only use a reaction created after the current head commit; read
the latest such Codex reaction, not merely any historical reaction:

```bash
codex_current_reaction() {
  local head_date observed_at
  head_date=$(gh pr view "$PR_NUMBER" --json commits \
                --jq '.commits[-1].committedDate')
  observed_at="${CURRENT_HEAD_OBSERVED_AT:?record when this head was first observed}"
  gh api "repos/$OWNER/$REPO/issues/$PR_NUMBER/reactions?per_page=100" \
    | jq -r --arg since "$head_date" --arg observed "$observed_at" '
        [.[]
         | select((.user.login // "") | test("chatgpt-codex-connector"))
         | {content, at: .created_at}
         | select(.at >= $since and .at >= $observed)]
        | sort_by(.at) | last // {} | "\(.content // "")\t\(.at // "")"
      '
}
# prints "+1<TAB>timestamp", "eyes<TAB>timestamp", or an empty pair
```

- `+1` → treat the current head as a clean Codex completion and continue to
  thread/CI readiness checks.
- `eyes` → keep `babysit:waiting-codex` until Codex removes or replaces it;
  never post a fallback or mark this head skipped while it remains active.

Record the exact-head boundary immediately after every PR creation or head
change, before checking reactions:

```bash
CURRENT_HEAD_OID=$(gh pr view "$PR_NUMBER" --json headRefOid --jq '.headRefOid')
CURRENT_HEAD_OBSERVED_AT=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
```

**The two timestamp fields are not interchangeable, and `gh` populates exactly
one per type:** `reviews[]` carries `submittedAt` and has **no** `createdAt`;
`comments[]` carries `createdAt` and has **no** `submittedAt`. Read the wrong
one and you get `null`, `null > $since` is `false` in jq, and the check
silently matches nothing forever — a false timeout that looks like a clean
negative. Verify with
`gh pr view N --json comments,reviews | jq '{r:(.reviews[0]|keys), c:(.comments[0]|keys)}'`
before trusting either field.

This helper deliberately does **not** decide whether a surfaced comment is a
clean result — it hands you the candidates and you read them. Auto-matching
prose like "no major issues" risks the one error worse than a false timeout:
declaring the head reviewed when it was not, which retires the review gate and
can carry `babysit:ready` onto unreviewed code. A false timeout costs a human
glance; a false all-clear ships.

**Before declaring a wait-cap timeout, re-check PR state manually.** This
applies to a **baseline** timeout — a grace-window expiry is not a timeout at
all and never blocks. A false timeout has happened repeatedly; treat a timeout
as "verify by hand", not as grounds to set `babysit:blocked` on its own. A
timeout is only real when `codex_reviewed_head` prints `false`,
`codex_unmarked_after_head` prints nothing you can read as a clean result, and
`codex_current_reaction` is neither a current-head `+1` nor an active `eyes`.
Also re-read `state` at that moment — the human owner may have merged while the
poll was running.

#### Announced quota skip

When Codex is rate-limited it does not silently vanish — the connector posts
an issue comment on the PR saying the usage limit for code reviews was
reached. Waiting out the grace or wait-cap after that comment is pure wasted
wall-clock, and mislabeling it a timeout points the human at the wrong fix:

```bash
# Latest connector quota-limit comment created after the current head commit.
codex_quota_skip_since_head() {
  local head_date
  head_date=$(gh pr view "$PR_NUMBER" --json commits \
                --jq '.commits[-1].committedDate')
  gh pr view "$PR_NUMBER" --json comments \
    | jq -r --arg since "$head_date" '
        [.comments[]?
         | select((.author.login // "") | test("chatgpt-codex-connector"))
         | select((.body // "") | strings
                  | test("reached your Codex usage limits"; "i"))
         | .createdAt]
        | map(select(. > $since)) | max // ""
      '
}
```

Check it on every wait poll alongside `codex_reviewed_head`. When it returns a
timestamp:

- **Baseline mode** (PR has no Codex review at all): the review gate cannot be
  satisfied this run. `post_babysit_stop_comment quota "<detail>"`, set
  `babysit:blocked`, and stop — the human decides whether to wait for the
  limit window, enable credits, or merge on their own judgment.
- **Later-head grace mode**: treat like a grace expiry — proceed to step 6/7 —
  but record the head as **quota-skipped, not reviewed** in the working note
  and final report. A quota skip is capacity, not a smart-trigger judgment
  that the change needed no review; the human should know which heads carry
  neither an explicit pass nor a deliberate skip.

#### Has a review already been requested?

The one-request-per-PR rule has to survive babysit restarts, context
compaction, and a second operator picking the PR up — so it is derived from the
PR's own comments, not from a variable in the working note:

```bash
# True when an "@codex review" / "/codex review" request already exists on this
# PR, posted by any non-Codex author (a previous babysit run, or the human).
codex_review_already_requested() {
  gh pr view "$PR_NUMBER" --json comments \
    | jq -r '
        [.comments[]?
         | select(((.author.login // "") | test("chatgpt-codex-connector")) | not)
         | (.body // "") | strings
         | select(test("(^|[^`[:alnum:]_])[@/]codex[[:space:]]+review\\b"; "i"))]
        | length > 0
      '
}

# ISO timestamp of the most recent such request ("" when there is none).
codex_review_requested_at() {
  gh pr view "$PR_NUMBER" --json comments \
    | jq -r '
        [.comments[]?
         | select(((.author.login // "") | test("chatgpt-codex-connector")) | not)
         | select(((.body // "") | strings
                   | test("(^|[^`[:alnum:]_])[@/]codex[[:space:]]+review\\b"; "i")))
         | .createdAt]
        | max // ""
      '
}
```

`select(... | not)` on the author guards against Codex's own posts echoing the
phrase back and making babysit believe the human asked. The `[^`[:alnum:]_]`
prefix keeps a fenced/inline `` `@codex review` `` in prose — including this
skill quoted in a PR body — from counting as a request.

Post the baseline through this wrapper, never with a bare `gh pr comment`:

```bash
# request_codex_baseline_review [force]
#   force=1 only for an explicit human ask (--request-review). Never pass 1
#   because the head moved.
request_codex_baseline_review() {
  local force="${1:-0}"
  if [[ "${DRY_RUN:-0}" == "1" ]]; then
    echo "dry-run: would request Codex baseline review (force=$force)"
    return 0
  fi
  if [[ "$force" != "1" && "$(codex_review_already_requested)" == "true" ]]; then
    echo "codex review already requested on this PR; not re-tagging"
    return 0
  fi
  gh pr comment "$PR_NUMBER" --body "@codex review"
  CODEX_REQUESTS_THIS_RUN=$(( ${CODEX_REQUESTS_THIS_RUN:-0} + 1 ))
}
```

`CODEX_REQUESTS_THIS_RUN` is what you report in the Output section. If it ever
exceeds 1, a caller is re-tagging on push — the exact bug this design removes.

#### Choosing the mode

```bash
# The guarded fallback is owed only when the initial automatic-review grace has
# expired, Codex has never engaged with this PR, and nobody has asked yet. A
# moved head is NOT a trigger.
codex_needs_baseline() {
  [[ "$(codex_review_already_requested)" != "true" ]] \
    && [[ -z "$(codex_any_prior_review)" ]]
}

# Any Codex review/comment ever on this PR, regardless of head.
codex_any_prior_review() {
  gh pr view "$PR_NUMBER" --json comments,reviews \
    | jq -r '
        ([.reviews[]?  | select((.author.login // "") | test("chatgpt-codex-connector"))]
         + [.comments[]? | select((.author.login // "") | test("chatgpt-codex-connector"))])
        | if length > 0 then "yes" else "" end
      '
}
```

- `--request-review` passed → `request_codex_baseline_review 1` **once at run
  start** (the user is explicitly asking for another), then wait in baseline
  mode. Once per run, not per push.
- Initial PR head with no Codex completion and no human request → begin
  **initial auto-review grace**, with no comment. At expiry, re-check both
  conditions; only if `codex_needs_baseline` remains true, post the one
  fallback and wait in baseline mode.
- A human `@codex review` / `/codex review` comment exists → someone already
  asked; **do not add your own comment**. Wait for that request to complete
  within the normal wait cap.
- Any later head **after Codex has completed at least one review** (the common
  case: babysit just pushed a fix) → **grace mode**, no comment.
- If the head moves before Codex has completed its first review and no human
  request exists, remain in initial-auto-review/baseline mode for the new head.
  The one baseline fallback is still owed after that head's grace period.

#### Waiting

All three modes poll identically — `set_babysit_status waiting-codex` **once**
when the wait begins, then `codex_reviewed_head` and `codex_current_reaction`
every 60 seconds, never re-labeling per tick. A current-head `+1` completes the
wait; an active `eyes` keeps it pending until Codex replaces or removes it. They otherwise
differ only in the deadline and in what expiry means:

- **Initial auto-review grace** — deadline is `--codex-grace` (default 10m).
  On expiry, re-check `codex_needs_baseline`: if it is true, post the single
  fallback and enter baseline mode. If a human request or Codex completion now
  exists, do not post; wait for that review or proceed as appropriate.
- **Baseline mode** — deadline is the wait cap (default 45m). On expiry, apply
  the manual false-timeout re-check above; a genuine timeout sets
  `babysit:blocked` and stops.
- **Later-head grace mode** — deadline is `--codex-grace` (default 10m). On expiry,
  **Codex chose not to review this head, which is a normal outcome**: log
  `codex smart auto-review did not fire for <head>`, set `active`, and continue
  to step 6/7. Do **not** set `babysit:blocked`, and do **not** post a comment
  to force one. Note it in the final report so the human knows which heads
  carry an explicit Codex pass versus an auto-review skip.

In any mode, if a review for the current head arrives, proceed to step 4/5
(`set_babysit_status active` when thread work starts).

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

### 4.5 Boundary Sweep for Deployed Integrations

Before the first remediation push, run this bounded sweep when the PR changes
or a finding concerns a deployed integration: public routes, OAuth, webhooks,
proxying, external configuration, monitoring, or a third-party SDK. Its
purpose is to batch the finite neighboring contract into one fix instead of
discovering one endpoint or deployment variable per review wave.

1. Read the provider's authoritative metadata or documentation and enumerate
   the finite public contract it advertises: routes, callback URLs, issuer or
   origin values, registration endpoints, and required configuration.
2. Compare that contract with the Worker/proxy routing, checked-in deployment
   configuration, runbook, and tests. Add focused checks for the entire finite
   set, rather than only the single route or variable named in a review.
3. Trace monitoring or alerting to its actual destination. A configured value
   is not proof of delivery; use the repository's controlled live-smoke or
   fault-injection path when the verification standard permits it.
4. Batch every direct contract breach found by this sweep into the current
   remediation push, with focused deterministic tests and required live
   evidence. Do not make a sequence of one-route-at-a-time pushes.
5. Stop as `babysit:blocked` before editing if the sweep requires choosing a
   notification destination, provisioning a secret, selecting an
   authentication or persistence architecture, or otherwise making a product
   or deployment decision. State the exact decision in the thread and final
   report; do not spend another review wave guessing.

This is a targeted preflight, not an invitation to broaden the PR. It examines
only the finite interface implied by the changed integration and its existing
Review Contract.

### 5. Triage Against the Review Contract and Threat Model, Then Resolve

While classifying and fixing, keep `babysit:active` (set once when work starts).

Before editing, read the PR's **Review Contract**. If it is absent for a
behavior or state-machine change, record that no new semantic policy may be
inferred during review; only existing documented or tested invariants can be
treated as direct breaches.

For each active Codex thread, **classify before writing any code**:

1. Read the cited file, surrounding code, `diffHunk`, and any relevant tests.
2. **Threat Model triage gate** — if the target repo's `AGENTS.md` has a
   Threat Model section (in-scope / out-of-scope lists), check the finding
   against it *first*, before classifying correctness:
   - Matches the **out-of-scope** list (capability/grant narrowing,
     privilege-escalation or injection hardening, intent-gate bypass
     hardening, defense-in-depth, multi-tenant reasoning, etc.) → **close it**
     per the out-of-scope path below. Do not implement it, and do not stop
     the run for it.
   - Matches the **in-scope** list (correctness, races, data loss,
     state-machine errors, crashes, leaks, secret exposure, regression of an
     existing invariant) → continue to normal classification (step 3 below).
   - Repo has no Threat Model section → skip this gate, fall through to
     normal classification.
3. Classify the remaining finding as exactly one of:
   - **Direct contract breach** — reproducibly violates a Review Contract
     acceptance criterion or existing documented/tested invariant.
   - **Fix-introduced regression** — a previous babysit fix caused the
     reproducible break.
   - **Disproven or moot** — the cited path cannot reproduce the claimed
     behavior, or a landed change already removes it.
   - **Threat-model exclusion** — the finding is explicitly out of scope under
     the repo's Threat Model.
   - **Scope expansion** — it is a plausible new NLP, idempotency,
     compatibility, retry, retention, or architecture policy not required by
     the Review Contract or an existing invariant.
4. Auto-fix only direct contract breaches and fix-introduced regressions. Run
   the boundary sweep above when it applies, then batch all resulting direct
   fixes into **one push per review wave**, with a focused test that reproduces
   each fixed behavior before the push.

   **Pre-push check:** after the focused tests pass and before pushing, run
   one local review of the remediation batch —
   `codex_local_review --scope working-tree` (skip silently under
   `--skip-local-review` or when the runner is absent; a failed run —
   "Reviewer failed to output a response" — is also a skip, not a blocker).
   Use the default model: the built-in reviewer rejects `-m spark`
   (verified 2026-08-12, fails with no output), and a default-model review of
   a small diff measures ~30s. Loop data shows rounds 2+ carry 76% of all
   findings, dominated by regressions the previous fix introduced — the exact
   class a working-tree review of the batch catches before it becomes a
   "Fresh evidence" thread. Fix what it proves broken, re-run the focused
   tests, then push. **One pass per push, never a local loop**, and its
   findings triage through this same classification — a local nitpick does
   not earn a fix any more than a GitHub one does.
5. For a disproven/moot finding, reply with the concrete evidence and resolve
   it. For a Threat Model exclusion, use the canned rationale below and resolve
   it.
6. For a scope expansion, reply with the **exact unresolved product decision**,
   leave the thread open, set `babysit:blocked`, and stop. Do not silently
   resolve it, create follow-up work, or broaden the PR.
7. Count only babysit-authored remediation pushes after the initial review.
   Human-directed validation commits, base merges, and a user's explicit
   follow-up do not consume this budget, but still require the current-head
   review/CI gates.

   **The budget is per-PR lifetime, derived from the PR — not from this run's
   memory.** A run that starts on a PR with prior babysit history inherits
   whatever budget that history already spent; re-invocation after `blocked`
   is not a reset (#1255 reached 12 review rounds and #1040 reached 15 through
   per-run counting). Derive it:

   ```bash
   # ISO timestamp of the most recent explicit budget-reset marker ("" if none).
   babysit_budget_reset_at() {
     gh pr view "$PR_NUMBER" --json comments \
       | jq -r '
           [.comments[]?
            | select((.body // "") | strings
                     | test("<!-- babysit:budget-reset -->"))
            | .createdAt]
           | max // ""
         '
   }

   # Distinct Codex reviewed-commit markers since the last budget reset —
   # the PR's lifetime review windows. Ceiling: 6 total review windows.
   codex_lifetime_rounds() {
     local reset_at
     reset_at=$(babysit_budget_reset_at)
     gh pr view "$PR_NUMBER" --json comments,reviews \
       | jq -r --arg since "${reset_at:-1970-01-01T00:00:00Z}" '
           ([.reviews[]?  | select((.author.login // "") | test("chatgpt-codex-connector"))
                          | {at: .submittedAt, body}]
            + [.comments[]? | select((.author.login // "") | test("chatgpt-codex-connector"))
                          | {at: .createdAt,   body}])
           | map(select((.body | type == "string") and (.at != null) and (.at > $since)))
           | map(.body | capture("Reviewed commit:\\*{0,2}\\s*`?(?<sha>[0-9a-f]{7,40})`?"; "i").sha)
           | unique | length
         '
   }
   ```

   `codex_lifetime_rounds` is the **safety ceiling, not the stop rule**. At or
   above **6**, stop regardless: a loop that has run that long is pathological
   even if it still looks productive. Only an explicit human `--reset-budget`
   grants more — post the marker so every later run counts from it:

   ```bash
   gh pr comment "$PR_NUMBER" --body "<!-- babysit:budget-reset -->
   **Babysit budget reset** — fresh remediation budget explicitly granted by the operator."
   ```

   #### The convergence test (what actually decides whether to continue)

   Below the ceiling, continue or stop on **convergence**, not on a count. Keep
   a per-round record in the working note: threads closed, threads opened, and
   the `path` + mechanism of each new finding.

   - **Converging → keep going.** The round closed findings *and* the new ones
     land in new territory (a different file, or the same file via a different
     mechanism). Do not stop a loop that is winning: #1139 was halted with
     *zero* open threads and its human override then closed everything in three
     commits; #1233 closed a real GPU-process leak in a single pass once
     unblocked.
   - **Respawning → stop now**, even with budget left. The same `path` *and*
     mechanism resurfaces across two consecutive rounds. That is one unmade
     decision being re-litigated, and more rounds structurally cannot resolve
     it — #1085 spent 8 rounds and #1255 spent 12 on exactly this. Post the
     stop comment with class `nonconvergent`, naming the decision itself rather
     than the individual findings.
   - **Every remaining finding must still qualify** for an automated push: a
     direct contract breach or a fix-introduced regression, each with a
     reproducible focused test; no product, deployment, secret, retention,
     authentication, persistence, or architecture choice; nothing that expands
     the PR's Review Contract. Any one of those stops the run immediately no
     matter how healthy the convergence trend looks.

   Record the per-round verdict (`converging` / `respawn` / `clean`) in the
   final report, so a regression back to blind round-counting is visible.

**Closing a Threat Model out-of-scope finding** — reply with this verbatim,
substituting the bracketed category, then resolve. Do not soften, apologize,
or improvise the wording; an apologetic close reads as an opening for Codex to
re-raise it:

```
Out of scope per the repo's threat model (`AGENTS.md` → *Threat Model*).
This repo is a private, single-operator hub: one user, one machine, no untrusted
accounts, no public API. Local privilege boundaries between the operator and his
own agents are ergonomics, not a security control, so [capability narrowing /
injection hardening / intent-gate bypass] is explicitly listed as out of scope.
Not implementing. If you believe this is a correctness bug that would occur with a
single fully-trusted user, re-raise it on those terms and it will be fixed.
```

Reply to a thread using the root comment `databaseId`. The route needs the PR
number as well as the comment id. `pulls/comments/{id}/replies` — without
`$PR_NUMBER` — is not a GitHub route and returns 404:

```bash
gh api -X POST \
  "repos/$OWNER/$REPO/pulls/$PR_NUMBER/comments/$COMMENT_DATABASE_ID/replies" \
  -f body="$REPLY_BODY"
```

Resolve the review thread — required for both a landed fix and a Threat Model
close. A reply alone does not clear the thread from "unresolved," and an
unresolved thread still reads as a blocker:

```bash
gh api graphql -F thread="$THREAD_ID" -f query='
mutation($thread:ID!) {
  resolveReviewThread(input:{threadId:$thread}) {
    thread { id isResolved }
  }
}'
```

After a batched code change, commit and push the scoped fixes, then return to
step 3 in **later-head grace mode**. The new head does not justify a new
`@codex review` comment; smart auto-review will post one if it judges the
change worth reviewing, and babysit only waits `--codex-grace` for it. After
push, run the **combined post-push wait** from
[ci-and-final-readiness.md](ci-and-final-readiness.md): CI checks and the
Codex grace window share the same starting clock (the push), so poll both in
one loop instead of waiting them out back to back.

**Escalate to the human — for a tracked residual finding, file the verified
issue below; for a scope expansion, leave its live thread open without filing
follow-up work. Then `post_babysit_stop_comment <class> <detail>`,
`set_babysit_status blocked`, and stop — when:**
- a finding is classified as a scope expansion; reply with the exact product
  decision that must be made and leave the thread open;
- the finding needs a product, deployment, secret, authentication,
  persistence, or architecture decision;
- the convergence test reports **respawn** (same path *and* mechanism across two
  consecutive rounds), the safety ceiling is reached
  (`codex_lifetime_rounds` ≥ 6 without a fresh `--reset-budget`), or any
  remaining finding fails to qualify for an automated push; or
- Codex **re-raises** a finding babysit already closed as out-of-scope *and* the
  re-raise implies a genuine policy disagreement — that is signal the repo's
  Threat Model exclusion list needs a new named entry, which is a human call.
  **Not** when the re-raise carries a small, mechanical, already-known fix: apply
  it (the trivial-fix exception) rather than spending a human round on a
  one-liner.

A first-pass Threat Model exclusion is never itself a reason to stop the run.

#### Verify the tracker before handing tracked work off

A residual finding that babysit hands off as tracked work must leave behind a
*real* issue, not a claim that one exists. A scope-expansion decision is not a
handoff: leave its review thread open, state the exact decision in the stop
comment, and do not file follow-up work. Both observed handoff failures were
claims: #1266's findings were
declared "tracked in #1267" when that issue covered different files entirely and
both defects stayed live on `main`, and #1254's answered decision was reported
implemented in commit `8958d8b`, which does not exist.

```bash
# file_residual_finding <title> <body> — prints the issue number, or "" on failure.
file_residual_finding() {
  local title="$1" body="$2" url num
  if [[ "${DRY_RUN:-0}" == "1" ]]; then
    printf 'dry-run: would file issue: %s\n' "$title" >&2; return 0
  fi
  url=$(gh issue create --title "$title" --body "$body" 2>/dev/null) || return 1
  num="${url##*/}"
  # Read it back: a create that printed something is not proof it exists.
  gh issue view "$num" --json number --jq '.number' >/dev/null 2>&1 || return 1
  printf '%s' "$num"
}
```

Quote the finding, its `path:line`, and the repro in the body. Link the returned
number in **both** the stop comment and the thread reply, and report it. If the
issue cannot be filed or read back, say so plainly in the stop comment rather
than implying tracking that does not exist.

Then set the label **by finding class, not by budget**: with tracking verified, a
residual *non-correctness* finding (coverage gap, hardening) sets
`babysit:ready` with an advisory note — it does not change the merge decision,
and 5 of 8 such PRs were merged over anyway. A residual *real correctness*
finding sets `babysit:blocked`.
