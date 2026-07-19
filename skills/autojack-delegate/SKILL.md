---
name: autojack-delegate
description: >-
  Use when a Claude Code session needs a capability it doesn't have locally
  (Google Calendar/Gmail/Drive, Slack DM, Discord, WhatsApp, etc.) and the
  user's AutoHub server has the tool wired in. Delegates one natural-language
  request to autojack via the local chat API and returns the result.
tags:
  - delegation
  - autohub
  - google-workspace
  - slack
  - integration
agents:
  - claude-code
metadata:
  version: 1.0.0
resources:
  - path: bin/ask-autojack.sh
    type: file
  - path: examples/add-calendar-events.md
    type: file
---

# autojack-delegate

You are a Claude Code session running on Jack's machine. AutoHub (sibling repo at `<HOME>`) runs a long-lived chat server with autojack — a Claude agent that has Google Workspace, Slack, Discord, WhatsApp, and dozens of other MCP tools wired in. When you hit a capability gap, fire one shell call and let autojack execute it.

## When to use

Use this skill when **all three** are true:

1. The user's request needs a capability you don't have in this CC session.
2. The capability exists in AutoHub. Common ones: Google Calendar (add/list/move events), Gmail (send/draft/search), Google Drive (search/read), Slack (DM, post, channel ops), Discord, WhatsApp, web reads via autohub's browser stack.
3. The action is something autojack can do via natural-language instruction. If you need raw API output, ask for it inside the request (`"...and return the event IDs as a JSON array"`).

**Do NOT delegate** work you can do directly: reading/writing files, running code, web search, git ops, anything in the project's own MCP servers. Delegating local work is wasted latency.

## Prerequisites

- AutoHub chat server running on `http://localhost:8767`. Verify with `curl -sS http://localhost:8767/health`.
- For Google Workspace: OAuth tokens persisted in `~/.mcp-auth/` (one-time consent in a browser). If absent, autojack will return a "please authorize" message — relay it to the user.
- `jq` installed (Homebrew: `brew install jq`).

## Invocation

```bash
bash ~/.claude/skills/autojack-delegate/bin/ask-autojack.sh "<your natural-language request>"
```

Flags:
- `--timeout <seconds>` (default 180) — bump for multi-step ops (e.g. 8 calendar events takes ~30–60s).
- `--conversation-id <id>` — group multiple calls in autohub logs. Default: fresh per call.
- `--json` — return the full chat-completions JSON instead of just the message content.

Exit codes: `0` ok, `2` autohub down, `3` bad CLI args, otherwise the HTTP status from the chat server.

### Examples

Add calendar events:
```bash
bash ~/.claude/skills/autojack-delegate/bin/ask-autojack.sh "$(cat <<'EOF'
Add these to my calendar (default calendar, Europe/Berlin):
1. Mon May 25, 9:00 AM, 15 min — DK status check
2. Wed May 27, 10:00 AM, 30 min — Spotify editorial pitch
EOF
)"
```

Read calendar:
```bash
bash ~/.claude/skills/autojack-delegate/bin/ask-autojack.sh "list my next 5 calendar events"
```

Send a Gmail draft:
```bash
bash ~/.claude/skills/autojack-delegate/bin/ask-autojack.sh \
  "draft a Gmail to amy@example.com, subject 'trigger happy demo', body: hey wanted you to hear this first — [URL]. tell me if it lands."
```

Slack DM:
```bash
bash ~/.claude/skills/autojack-delegate/bin/ask-autojack.sh \
  "DM @lennard on Slack: 'made a thing — soundcloud.com/stacyoffline/trigger-happy. ear-curious?'"
```

## Response shape

The wrapper writes autojack's natural-language reply to stdout — the same text autojack would say in voice. Treat it as a receipt to summarize for the user, not as structured data.

If you need structured output (event IDs, message URLs, row counts), **ask for it inside the prompt**: `"...and return ONLY a JSON array of created event IDs, no prose."`

## Gotchas

- **autohub not running** → exit code 2 + a one-line start command. Relay to the user; don't try to start AutoHub yourself.
- **OAuth required** → autojack returns a message asking the user to authorize. Surface verbatim; the consent flow is one-time and lives outside CC.
- **Cold MCP start** → `google_workspace` is `autoLoad: false` in AutoHub's config, so the first call in a chat-server session warm-starts the MCP (~2–5s extra latency). Subsequent calls are fast. If a first call times out at 180s on something simple, bump `--timeout` and retry.
- **Multi-step ops are slow** → 8 calendar events ≈ 30–60s. A long Gmail thread search ≈ 10–20s. Pad `--timeout` accordingly.
- **One-shot only** — each invocation is its own conversation by default. If you need autojack to remember context across calls (e.g. "now move that one to 11am"), pass the same `--conversation-id` for both calls.
- **Source tagging** — every call records `source: "claude-code"` in autohub's logs, so Jack can audit which sessions delegated work.

## When NOT to use this skill

- The CC session already has an MCP for the capability (e.g. `mcp__autovault__*` is local — don't route it through autojack).
- You need a streaming response in a UI (autojack here is non-streaming; raycast handles that case separately).
- The action is destructive and the user hasn't explicitly approved it (deleting events, sending messages to non-test recipients, etc.). Same review-before-act discipline as direct tool use applies.
