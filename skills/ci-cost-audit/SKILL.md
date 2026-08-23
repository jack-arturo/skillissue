---
name: ci-cost-audit
description: Audit GitHub Actions (and Xcode Cloud) CI spend for an org or user — find which repos consumed the included minutes, why, and what to change. Use when someone asks "what's burning my Actions minutes", hits the included-minutes cap, sees CI jobs refuse to start for billing reasons, or wants to check CI cost before adding a workflow.
license: MIT
tags: [ci, github-actions, billing, cost, xcode-cloud, gh-cli, audit]
agents: [codex]
category: devops
metadata:
  version: "1.0.0"
capabilities:
  network: true
  filesystem: readonly
  tools: [Bash]
requires-secrets: []
resources:
  - path: story.md
    type: file
---

# CI Cost Audit

Answer "what burned my CI minutes, and what do I change?" with measurements
rather than guesses. Most wrong answers to this question come from four
specific traps, each of which this skill checks explicitly.

## When to use

- "What's using all my Actions minutes?" / "I ran out this month."
- CI jobs start failing or refusing to run and billing is suspected.
- Before adding a workflow, to check whether there is headroom.
- Deciding whether to move a workflow to a self-hosted runner.

## The four traps

Check each one before reporting a number. Skipping any of them produces a
confidently wrong answer.

1. **Public repos are free and unlimited.** Only *private* repos draw down
   the included allowance. Aggregate minute totals routinely overstate real
   consumption by 2x or more. Always split by repo visibility.
2. **Self-hosted runners cost nothing** and do not appear in billing at all.
   A repo missing from the report is not a mystery — check whether its
   workflows use `runs-on: [self-hosted, ...]`.
3. **Billing is per job, rounded up to the minute.** A 5-job matrix with a
   1.8-minute wall clock bills ~10 minutes, not 2. Matrix width multiplies
   cost; wall-clock duration understates it.
4. **OS multipliers.** Linux 1x, Windows 2x, macOS 10x. A little macOS goes
   a long way.

## Getting the data

The classic endpoint is retired. `/{owner}/settings/billing/actions` returns
**410 Gone** for orgs on the enhanced billing platform. Use the usage report:

```bash
gh api "/organizations/<org>/settings/billing/usage?year=<yyyy>&month=<m>" > billing.json
```

Notes:

- For a personal account the path is `/users/<user>/settings/billing/usage`,
  and it needs the `user` scope — `gh auth refresh -h github.com -s user`.
- Line items carry `product`, `sku`, `unitType`, `quantity`, `repositoryName`,
  `grossAmount`, `discountAmount`, `netAmount`.
- Filter to `unitType == "Minutes"`; ignore `GigabyteHours` (storage) unless
  storage is the question.
- `netAmount: 0` across the board usually means a $0 spending limit, i.e.
  work is *blocked* at the cap rather than billed. That is what "I ran out"
  normally means — the symptom is jobs refusing to start, not an invoice.

## Method

1. **Pull the report** for the month in question.
2. **Classify every repo by visibility** — this is the step people skip:

   ```bash
   gh api repos/<org>/<repo> --jq .visibility
   ```

3. **Weight by OS multiplier** (Linux 1, Windows 2, macOS 10) and total
   *private repos only*. Compare against the plan allowance: Free 2,000 /
   Team 3,000 / Enterprise 50,000 minutes per month for private repos.
4. **Rank private repos by weighted minutes.** Usually one dominates.
5. **Find the driver in the top repo** — count runs and jobs-per-run:

   ```bash
   gh api "repos/<org>/<repo>/actions/runs?created=>=<yyyy-mm-01>&per_page=100" \
     --paginate --jq '.workflow_runs[] | [.name, .created_at[0:10]] | @tsv' \
     | cut -f1 | sort | uniq -c | sort -rn

   gh api repos/<org>/<repo>/actions/runs/<run_id>/jobs --jq .total_count
   ```

   Cost per run ≈ jobs × ceil(job minutes) × OS multiplier.
6. **Check for a recent workflow change before recommending anything.** Run
   counts by day and by workflow name will show a rename or rewrite. A repo
   can look catastrophic on the month's total while its *current* burn rate
   is already fine — recommending a fix for a problem that was solved last
   week is the most common failure of this audit.

   ```bash
   gh api "repos/<org>/<repo>/actions/runs?created=>=<yyyy-mm-01>&per_page=100" \
     --paginate --jq '.workflow_runs[] | [.created_at[0:10], .name] | @tsv' \
     | sort | uniq -c
   ```

   Report the post-change daily rate and project *that* forward, not the
   month's average.

## Levers, in the order worth trying

1. **Make the repo public** if that is acceptable — instantly free.
2. **Narrow triggers.** Label-gated or path-filtered runs cut run count,
   which is almost always the dominant term.
3. **Move to a self-hosted runner** — takes a repo to $0. Weigh it against
   availability: a single desk machine that sleeps or drops off becomes a
   hard CI outage, and queued jobs are cancelled after 24h. Do not put a
   high-merge-rate repo on a machine whose uptime you do not control.
4. **Collapse a wide matrix** — usually a false economy. Five 2-minute jobs
   bill ~10 minutes; the same work sequentially bills ~9 while taking 5x the
   wall clock. Say so rather than recommending it by reflex.

## Xcode Cloud (if Apple platforms are involved)

Separate system, separate allowance — 25 compute hours/month included with
the Apple Developer Program; not GitHub minutes. Workflows are configured in
App Store Connect, **not** in the repo, so "remove it from CI" is a manual
ASC edit and never a commit.

- Per-PR checks appear as status contexts named `<app> | <workflow>` plus a
  check per action, e.g. `<app> | <workflow> | Archive - macOS`.
- Estimate from check-run timestamps:

  ```bash
  gh api repos/<org>/<repo>/commits/<sha>/check-runs \
    --jq '.check_runs[] | [.name, .conclusion, .started_at, .completed_at] | @tsv'
  ```

  Split on tabs, not `|` — Xcode Cloud check names *contain* ` | `.
- Biggest lever is usually the workflow's **Clean** checkbox. Enabled, it
  skips derived-data/cache restore; Apple's own UI warns builds "may take
  significantly longer." For a project with large SPM binary dependencies
  that is most of the build time.
- Second lever: narrow **Start Conditions** to the default branch instead of
  any-branch. Note the tradeoff — a platform-specific compile break then
  lands post-merge. If a pre-merge gate matters, add that platform's build to
  an existing self-hosted job instead, where it costs nothing.

## Reporting

- Give the private-repo weighted total against the allowance, and name the
  date the cap was crossed if it was.
- Name the top repo and the mechanism (run count x matrix width x rounding),
  not just the number.
- State explicitly which repos cost nothing and why (public, or self-hosted).
- If the burn rate already changed, lead with the current rate.

## Anti-patterns

- Quoting an aggregate minute total without splitting public vs private.
- Assuming a repo absent from billing has no CI.
- Reading wall-clock run duration as billed minutes.
- Recommending a migration without checking whether a recent workflow change
  already fixed the burn.
- Moving CI to a self-hosted runner purely for cost, ignoring the
  availability risk that creates.
- Recommending matrix collapse as a cost saving without doing the rounding
  math.
