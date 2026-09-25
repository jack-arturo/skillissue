---
name: github-agent-identity
description: >
  Use when a coding agent (Claude Code, Codex) should act on GitHub under its
  own bot account instead of the human's: commits, pull requests, comments,
  reviews and labels. Sets up one GitHub App per agent, mints one-hour tokens
  per command, configures Claude Code and Codex, and checks for the silent
  fallbacks that put the human's name on agent work.
license: MIT
compatibility: Requires Node 20+, git and the GitHub CLI (gh). Written for github.com; set GHAPP_API_URL for GitHub Enterprise Server.
category: git
tags: [github, github-app, identity, accountability, claude-code, codex]
agents: [claude-code, codex]
metadata:
  author: jack-arturo
  version: "1.0.0"
capabilities:
  network: true
  filesystem: readwrite
  tools: [Bash, Read, Edit, Write]
resources:
  - path: references/app-setup.md
    type: file
  - path: references/claude-code.md
    type: file
  - path: references/codex.md
    type: file
  - path: references/troubleshooting.md
    type: file
  - path: scripts/mint-token.mjs
    type: file
  - path: scripts/ghapp
    type: file
  - path: scripts/verify.sh
    type: file
---

# GitHub Agent Identity

Give each coding agent its own GitHub account, so every commit, pull request,
comment and label shows which tool did it. The human's name then appears only
on what the human did, usually the merge.

Each agent gets a **GitHub App**. The App's private key stays on the machine.
Before each GitHub command the agent trades the key for a token that lasts an
hour, and GitHub records the action as `<app-name>[bot]`.

## When to use this skill

- Setting up a new agent identity, for yourself or a teammate.
- A PR, comment or commit from an agent shows up under a person's name.
- Adding Claude Code or Codex to a repo that already uses agent identities.
- Reviewing whether an existing setup still works (run `scripts/verify.sh`).

Skip it for CI bots. GitHub Actions already has `github-actions[bot]`.

## The moving parts

| Piece | Where it lives | Holds |
|---|---|---|
| GitHub App | GitHub, one per agent per person | Name, permissions, installations |
| Private key | `~/.config/github-agent-identity/<profile>.pem` | The only secret |
| Profile | `~/.config/github-agent-identity/<profile>.env` | Client ID, key path, installation id, bot login |
| `GH_AGENT_IDENTITY` | Agent settings | Which profile this agent uses |
| `GIT_AUTHOR_NAME` / `GIT_AUTHOR_EMAIL` | Agent settings | Who commits are authored by |
| `ghapp` | `~/.local/bin` | `gh` with a freshly minted App token |

Nothing secret goes into an environment variable. Agent harnesses filter and
log environments in ways that are hard to predict, so the key stays in a file
and the token exists only inside a single `ghapp` call.

## Setup

Work through these in order. Each step links to the detail.

1. **Create the App**, install it on the repos, save the key, and write the
   profile. [references/app-setup.md](references/app-setup.md)
2. **Copy the scripts** to `~/.local/bin`: `mint-token.mjs`, `ghapp`,
   `verify.sh`.
3. **Get the author email** with `mint-token.mjs --bot-email`. The number in it
   is the bot's user id. It is not the App id.
4. **Wire up the agent**:
   [Claude Code](references/claude-code.md) or [Codex](references/codex.md).
   Both need the three environment variables and one instruction line telling
   the agent to use `ghapp` for GitHub writes. Codex also needs network access
   in its sandbox.
5. **Verify from inside the agent**: ask it to run
   `verify.sh owner/repo`. Every line should say PASS.

## Daily rules for the agent

- Use `ghapp` for anything that writes to GitHub: `ghapp pr create`,
  `ghapp pr comment`, `ghapp issue create`, `ghapp pr edit --add-label`.
  Plain `gh` acts as the human.
- Never export `GH_TOKEN`. An expired exported token makes `gh` fail instead of
  falling back, and a fresh one leaks into every later command.
- Leave `GIT_COMMITTER_*` alone. The agent is the author and the human's machine
  is the committer, which is what those two fields mean.
- When several people or tools share one App, name the tool in the PR body.

## When something is off

Most failures don't raise an error. GitHub completes the action and puts
the human's name on it, so check the result rather than waiting for an
error. The symptom tables are in
[references/troubleshooting.md](references/troubleshooting.md).

Quick checks:

```bash
ghapp pr view 123 --json author --jq .author.login   # app/<name>, not a person
git log -1 --format='%an <%ae>'                      # <name>[bot] <id+name[bot]@...>
verify.sh owner/repo                                 # all PASS
```
