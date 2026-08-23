---
name: creating-plugins
visibility: public
provenance: house
featured: false
title: "Creating EmDash Plugins"
summary: >-
  The extension map for EmDash plugins: hooks, storage, admin UI, API routes, and Portable Text blocks.
category: web
tags: [emdash, plugins, typescript]
related: [building-emdash-site, emdash-cli]
first_used: 2026-08
---

## Why

Plugins become hard to maintain when runtime, admin, and storage boundaries are treated as one blob.

## How

Choose the plugin shape first, then use the focused reference for the extension point you are actually adding. Store secrets in the platform's secret setting type, never in code.

## Related

See [Building an EmDash Site](../building-emdash-site/story.md) and [EmDash CLI](../emdash-cli/story.md).
