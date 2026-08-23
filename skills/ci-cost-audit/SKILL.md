---
name: ci-cost-audit
description: "Audit GitHub Actions and Xcode Cloud CI spend: identify the billable SKUs, the workflows responsible, and the smallest defensible change."
license: MIT
tags: [ci, github-actions, billing, cost, xcode-cloud, gh-cli, audit]
agents: [claude-code, codex]
category: devops
metadata:
  version: "1.0.0"
capabilities:
  network: true
  filesystem: readwrite
  tools: [Bash]
requires-secrets: []
resources:
  - path: story.md
    type: file
---

# CI Cost Audit

Answer “what burned CI budget, and what should change?” from current billing
evidence rather than runner folklore. Pricing, included usage, and product SKUs
change, so verify the current official GitHub billing and Actions documentation
before calculating or recommending a cost change.

## When to use

- Included CI usage is exhausted or jobs are blocked for billing reasons.
- A team needs to explain a monthly Actions charge.
- A workflow or runner change needs a cost comparison.
- An Apple-platform project also uses Xcode Cloud.

## Billing facts to verify live

Do not hard-code rates, allowances, operating-system multipliers, or billing
endpoint behavior. Confirm these in the current official documentation and the
account's billing report:

1. Standard GitHub-hosted runners are free for public repositories.
2. Larger GitHub-hosted runners are billed, including when used by public
   repositories.
3. Hosted-runner cost is calculated from the billing report's SKU and current
   per-SKU rate, not from a guessed global multiplier.
4. Self-hosted runners remove GitHub-hosted runner charges but still have
   infrastructure, administration, availability, and security costs.

## Gather current evidence

Use the account or organization billing experience and its supported API/export
for the month under review. Save a redacted copy only when the user has asked
for an artifact; it is billing data, so keep it out of commits.

```bash
gh api "/organizations/<org>/settings/billing/usage?year=<yyyy>&month=<m>" \
  > billing-usage.json
```

For a personal account, use the corresponding supported user billing route and
the required GitHub CLI scope. If the endpoint changes or returns an error, use
the documented billing UI/export rather than guessing an undocumented
replacement.

For every line item, retain the product, SKU, quantity, amount, repository (if
available), and time window. Separate Actions compute from storage, data
transfer, and non-GitHub services before drawing conclusions.

## Method

1. Pull the current-month report and identify each Actions-related SKU.
2. Classify the runner behind each costly SKU as standard hosted, larger hosted,
   or self-hosted. Use workflow `runs-on` labels and the current runner
   configuration; repository visibility alone is insufficient.
3. Rank line items by recorded cost and quantity. Use the report's own SKU rate
   and amount—do not apply historical OS multipliers.
4. For the top repository/workflow, inspect run count, jobs per run, matrix
   width, queue time, and job duration.
5. Compare the current daily rate with the period before and after any workflow
   change. A historical spike may already be fixed.
6. State uncertainty plainly when the report cannot attribute shared usage to a
   repository or workflow.

Useful workflow evidence:

```bash
gh api "repos/<org>/<repo>/actions/runs?created=>=<yyyy-mm-01>&per_page=100" \
  --paginate --jq '.workflow_runs[] | [.name, .created_at[0:10]] | @tsv' \
  | cut -f1 | sort | uniq -c | sort -rn

gh api repos/<org>/<repo>/actions/runs/<run_id>/jobs --jq .total_count
```

## Levers

Choose the smallest change justified by the data:

1. Narrow triggers with paths, labels, concurrency, or an intentional schedule.
2. Remove unnecessary matrix entries or duplicate jobs after checking coverage.
3. Reduce slow work through caching, test partitioning, or targeted checks.
4. Move suitable work to a standard runner when a larger runner is not needed.
5. Consider self-hosted capacity only with an explicit operational-cost and
   reliability comparison.

Never recommend making a repository public solely for cost without explicit
product and security approval. Never promise a runner choice is free without
checking its current billing class and the account's plan.

## Xcode Cloud

Treat Xcode Cloud as a separate billing system. Check its current plan,
included compute, and pricing in Apple's official documentation and the account
console. Its workflows are managed in App Store Connect, so changes may require
an operator action rather than a repository commit.

## Reporting

Report the month/time window, each relevant SKU, billed quantity and amount,
the top workflow driver, current versus historical burn rate, and the proposed
change with its trade-off. Name the source and retrieval time for every billing
claim.

## Anti-patterns

- Applying stale multiplier tables or included-minute allowances.
- Treating all public-repository work as free without checking for larger
  runners.
- Inferring cost from wall-clock duration when the billing report has SKU data.
- Calling self-hosted infrastructure free because GitHub does not bill its
  compute minutes.
- Recommending a fix without checking whether a recent workflow change already
  altered the current burn rate.
