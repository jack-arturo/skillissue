---
name: github-agent-identity
visibility: public
provenance: house
featured: false
title: "GitHub Agent Identity"
summary: >-
  One GitHub App per coding agent, so Claude Code and Codex commit, comment and
  open PRs as themselves. Your name stays on the merge button.
category: git
tags: [github, github-app, identity, claude-code, codex]
related: [babysit, commit-message]
first_used: 2026-09
---

## Why it exists

Every agent I run used to work through my GitHub login. Claude Code opened PRs as
me, Codex commented as me, AutoJack labelled issues as me. Scroll a PR timeline
and it looked like I'd been very busy at 4am.

That's fine until you need to know which tool did something. **The avatar is the
cheapest audit log there is**, and I was throwing it away.

So each agent got its own GitHub App: `claude-jack`, `autojack-bot`,
`cursor-jack`, `gemini-jack`. Codex already posts reviews as
`chatgpt-codex-connector[bot]`. Now a PR reads like a sign-in sheet. The bot wrote
it, Codex reviewed it, and the only line with a human on it is the merge. There's
a walkthrough of one real PR on [AutoJack Labs](https://autojack.ai/labs/agent-identities/).

## History

### 1.0.0
Pulled out of AutoHub, where the same thing runs through a hub-specific token
helper and a `gh` shim for the PR babysitter. This version has no AutoHub parts.
A dependency-free Node script mints tokens, `ghapp` wraps `gh`, and `verify.sh`
checks the result. Claude Code and Codex setup are included because that's what
the team runs.

## How Jack actually uses it

One App per agent. The key sits in `~/.config`, the agent's settings name the
profile, and the agent's instructions say `ghapp` for anything that writes. Tokens
last an hour and get minted per command, so a six-hour session never trips over an
expired one.

The part that took longest wasn't the App. It was finding the ways it
quietly falls back to my name. An agent that forgets `ghapp` opens the PR as me.
A missing author email makes me the author. A commit email with the App id
instead of the bot's user id gets no avatar. **None of these throw an error**,
which is why `verify.sh` exists.

## What it is not

Not a permissions sandbox. The App's permissions limit what its token can do,
but the agent still runs as you on your machine. Not for CI either, where
`github-actions[bot]` already has you covered.
