---
name: cloudflare-emdash-cms-deploy
visibility: public
provenance: house
featured: false
title: "Cloudflare EmDash CMS Deploy"
summary: >-
category: deployment
tags: [emdash, astro, workers]
related: [building-emdash-site, cloudflare-ops]
first_used: 2026-06
---

## Why it exists

Pages-shaped deploys were serving raw source after Astro 6. This skill owns the Workers recipe and binding gotchas.

## History

### 1.4–1.10
Prerender=false, cloudflare:workers env import, migration/seed path.

## How Jack actually uses it

Workers only. If you see wrangler.jsonc downloading at the root, you put it on Pages by mistake.

## What it is not

Not a generic tutorial. It's the house runbook for this machine and these agents.
