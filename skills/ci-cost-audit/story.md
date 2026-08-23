---
name: ci-cost-audit
visibility: public
provenance: house
featured: false
title: "CI Cost Audit"
summary: >-
  A measurement-first audit for finding the workflows that actually consume CI minutes and deciding what to change.
category: devops
tags: [ci, github-actions, cost]
related: [cloudflare-ops]
first_used: 2026-08
---

## Why

CI billing is full of misleading totals. The expensive workflow is often not the loudest one.

## How

Separate billable work from everything else, weight it correctly, find the dominant workflow, and recommend the smallest change backed by the numbers.

## Related

See [Cloudflare Ops](../cloudflare-ops/story.md) for deployment-side operational checks.
