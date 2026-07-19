---
name: codex-review
description: Compatibility alias for babysit. Use when the user says "address Codex comments", "fix Codex feedback", or passes a PR number/URL with Codex review context; route to the unified babysit PR workflow.
license: MIT
tags: [github, codex, review, git, pull-request, ci, automation]
agents: [claude-code, codex, cursor]
category: review
metadata:
  version: "2.0.1"
capabilities:
  network: true
  filesystem: readwrite
  tools: [Bash, Read, Edit, Grep, Glob]
argument-hint: "[pr-number-or-url] [--dry-run] [--wait-cap <duration>] [--only <path-glob>]"
---

# codex-review

This skill is a compatibility alias. Use the `babysit` skill as the canonical
workflow for Codex PR review work.

When invoked:

1. Load `babysit`.
2. Use existing-PR mode unless no PR exists and the user asked to create one.
3. Preserve the original `codex-review` scope: only act on unresolved,
   non-outdated Codex connector review threads unless the user expands scope.
4. Follow `babysit` guardrails, especially: reply before resolving, require a
   fresh Codex review after every push, and never merge.
