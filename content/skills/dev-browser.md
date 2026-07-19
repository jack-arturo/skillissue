---
name: dev-browser
visibility: public
provenance: house
featured: true
title: "Dev Browser"
summary: >-
  Drive the real authenticated Chrome — extension relay first, headless connect as fallback.
category: browser
tags: [browser, chrome, automation]
related: [docs-screenshot-packager]
first_used: 2026-05
---

## Why it exists

Sandbox Chromium has no cookies. Real work needs the logged-in browser. This skill encodes Path A (extension relay) vs Path B (debug port) so agents stop asking which to use.

## History

### 0.3.x
Chrome 136+ killed debug ports on the default profile; Path A became structural. Autonomy contract documents gotchas so future runs do not re-ask.

## How Jack actually uses it

Default Path A. Reach for Path B only for multi-step scripts, file uploads, or dedicated profiles.

## What it is not

Not a generic tutorial. It's the house runbook for this machine and these agents.
