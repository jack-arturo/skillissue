---
name: cloudflare-ops
visibility: public
provenance: house
featured: true
title: "Cloudflare Ops"
summary: >-
  Pages/Workers preflights, D1 pairs, tunnels, and DNS ops without pasting tokens into chat.
category: deployment
tags: [cloudflare, pages, d1]
related: [cloudflare-lead-capture, cloudflare-commerce-deploy]
first_used: 2026-05
---

## Why it exists

Every AutoHub-adjacent deploy was re-discovering the same wrangler gotchas. This skill is the operator runbook: one canonical deploy path, preview D1 isolation, no split-brain pages deploys.

## History

### 1.0.0–1.0.5
Grew from Autohub deploy scripts into a signed AutoVault skill. Preview D1/KV pairs and the GitHub-connected Pages rule landed after split-brain incidents.

## How Jack actually uses it

Use before any Cloudflare mutation. Prefer `git push` on GitHub-connected Pages. Never `wrangler pages deploy` against those projects.

## What it is not

Not a generic tutorial. It's the house runbook for this machine and these agents.
