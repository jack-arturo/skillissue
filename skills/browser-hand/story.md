---
name: browser-hand
visibility: public
provenance: house
featured: true
title: "Browser Hand"
summary: >-
  Drive your real logged-in Chrome from an agent — extension bridge, no remote
  debugging port on the default profile, background-first so focus stays with you.
category: browser
tags: [browser, chrome, extension, automation, agent]
related: [autovault-skill, docs-screenshot-packager, automem]
first_used: 2026-07
---

## Why it exists

Remote debugging and WebDriver-style attach are a bad fit for everyday Chrome:
modern Chrome blocks debug ports on the default profile, many sites (including
Google OAuth) treat debugger sessions as hostile, and automation steals OS focus.
Sandbox Chromium has none of your cookies.

Browser Hand uses a small Chrome extension and a local relay so agents drive the
**same profile you already use**. It is a loadable **skill**, not an MCP server —
no always-on tool tax; agents pull it in when the task needs a real browser.

## History

### 0.6.x
Public skill package for [verygoodplugins/browser-hand](https://github.com/verygoodplugins/browser-hand).
AutoVault-first install, background focus, soft recovery for password-manager
wedges, agent obstacle course.

### Earlier (as house `dev-browser`)
Extension-relay vs debug-port paths lived under AutoHub-coupled runbooks.
Productized as Browser Hand under Very Good Plugins.

## How Jack actually uses it

Default to the extension CLI for signed-in work. Install the skill with AutoVault;
keep the relay and extension running locally. Reach for headless/remote-debug only
for CI or throwaway profiles.

## What it is not

Not Playwright-in-a-box for empty Chromium. Not an MCP browser server. For durable
agent memory across sessions, see AutoMem; for skill packaging, see AutoVault.
