---
name: resend-cli
visibility: public
provenance: mixed
featured: false
title: "Resend CLI"
summary: >-
category: ops
tags: [resend, email]
related: [cloudflare-lead-capture]
first_used: 2026-06
---

## Why it exists

Email setup needed a vendor CLI skill with non-interactive agent flags.

## History

### Origin
Upstream Resend CLI patterns with house non-interactive notes (v2.3.x).

## How Jack actually uses it

Domain verify, send-only key create, piped into wrangler secrets — never print keys.

## What it is not

Not a generic tutorial. It's the house runbook for this machine and these agents.

## History

### Skill patch — Resend project domain (2026-07-20)

Agents must create/verify the **project** custom domain in Resend when the zone is on Cloudflare — not silently ship From on a sibling verified domain. See SKILL.md § domain / anti-patterns.
