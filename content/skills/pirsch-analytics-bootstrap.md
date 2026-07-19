---
name: pirsch-analytics-bootstrap
visibility: public
provenance: house
featured: false
title: "Pirsch Analytics Bootstrap"
summary: >-
  Add Pirsch the right way — explicit domain auth, snippet, optional DNS, scoped MCP.
category: analytics
tags: [pirsch, analytics]
related: [cloudflare-ops]
first_used: 2026-06
---

## Why it exists

Analytics installs were inconsistent and sometimes created domains without asking.

## History

### 1.1.0
Explicit authorization for domain create; no credential dumps.

## How Jack actually uses it

Only with domain-create authorization when needed.

## What it is not

Not a generic tutorial. It's the house runbook for this machine and these agents.
