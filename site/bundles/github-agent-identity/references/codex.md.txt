# Codex

The CLI, the IDE extension and the desktop app share `~/.codex/config.toml`,
so one setup covers all three. Three changes: environment, network, and
instructions.

## 1. Environment

Codex builds a fresh environment for every command it runs. Add the identity
to it:

```toml
[shell_environment_policy]
set = { GH_AGENT_IDENTITY = "codex-alice", GIT_AUTHOR_NAME = "codex-alice[bot]", GIT_AUTHOR_EMAIL = "123456789+codex-alice[bot]@users.noreply.github.com" }
```

If the table already exists, add the `set` line to it instead of writing a second
`[shell_environment_policy]`.

Filters can undo this. `inherit = "none"` or `"core"` drops your `PATH`, which
can hide `ghapp`, `node` and `gh`. An include filter removes `set` values it
doesn't list. If you use either, include `PATH`, `HOME` and the three variables
above.

Codex can also strip any variable with `KEY`, `SECRET` or `TOKEN` in its name
(`ignore_default_excludes = false`). This setup doesn't care: the private key
lives in a file and `ghapp` mints its token inside the command.

## 2. Network

Codex's default `workspace-write` sandbox has **network access turned off**.
Minting a token needs to reach `api.github.com`, and so does `gh`. Either
approve each GitHub command when Codex asks to run it outside the sandbox, or
turn network on for the sandbox:

```toml
[sandbox_workspace_write]
network_access = true
```

The failure without it reads `could not reach https://api.github.com (…). Is
network access allowed here?`

## 3. Instructions

Add this to `~/.codex/AGENTS.md`, which Codex reads in every repo:

```markdown
## GitHub identity

Use `ghapp` instead of `gh` for anything that writes to GitHub: opening pull
requests, comments, reviews, labels, issues, releases. Plain `gh` acts as the
human. Reads can use either. Never export GH_TOKEN yourself.
```

## 4. Check it

Start a new Codex session and ask it to run `verify.sh your-org/your-repo`.

## Codex as the reviewer

Separate from the above: OpenAI's Codex code review posts as
`chatgpt-codex-connector[bot]`. If the team relies on it, open **Codex →
Settings → Code review**, pick the repository, and set **Auto code review** to
**Review all PRs**. The personal-preference options can skip PRs opened by bots,
which is every PR this skill produces.
