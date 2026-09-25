# Claude Code

Two changes: environment variables so the agent knows who it is, and one line
of instructions so it uses `ghapp` for GitHub writes.

## 1. Settings

Put the identity in **your own** settings file, `~/.claude/settings.json`:

```json
{
  "env": {
    "GH_AGENT_IDENTITY": "claude-alice",
    "GIT_AUTHOR_NAME": "claude-alice[bot]",
    "GIT_AUTHOR_EMAIL": "123456789+claude-alice[bot]@users.noreply.github.com"
  }
}
```

Merge the keys into your existing `env` block if you have one. For a
per-repo identity, use `<repo>/.claude/settings.local.json`, which git ignores.

**Never put this in `<repo>/.claude/settings.json`.** That file is committed. Every
colleague who pulls it starts committing as your bot.

Set `GIT_AUTHOR_*` only. Leave `GIT_COMMITTER_*` alone. Git's two names mean
different things: the agent authored the change, and your machine committed it.

Restart Claude Code after editing settings. A running session keeps the old
environment.

## 2. Instructions

Add this to `~/.claude/CLAUDE.md`:

```markdown
## GitHub identity

Use `ghapp` instead of `gh` for anything that writes to GitHub: opening pull
requests, comments, reviews, labels, issues, releases. Plain `gh` acts as the
human. Reads can use either. Never export GH_TOKEN yourself.
```

Optionally allow it without a prompt, in the same settings file:

```json
{
  "permissions": { "allow": ["Bash(ghapp:*)"] }
}
```

## 3. Check it

Ask Claude Code to run `verify.sh your-org/your-repo`. All lines should say PASS.
Running it in your own terminal proves nothing about the agent, because the
settings only apply inside Claude Code.

## What this does not cover

`git push` uses your normal git credentials. That is fine: GitHub shows each
commit under its author, so the pushes still read as the bot's work. Pushing as
the App is possible with an `x-access-token` remote URL, but it puts a token into
git's config and buys very little.
