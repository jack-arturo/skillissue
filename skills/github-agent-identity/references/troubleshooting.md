# Troubleshooting

Most failures here are silent. GitHub rarely refuses the action. It does it
under someone else's name. Check for the wrong name, not for an error.

## Wrong name, no error

| Symptom | Cause | Fix |
|---|---|---|
| PR or comment shows your personal account | The agent ran plain `gh` | Add the instruction line from the Claude Code or Codex page. Check with `ghapp pr view <n> --json author` |
| Commit authored by you | `GIT_AUTHOR_NAME` / `GIT_AUTHOR_EMAIL` not set where the agent runs | Settings file (Claude Code) or `shell_environment_policy.set` (Codex), then restart the session |
| Commit says `name[bot]` but has no avatar | Author email uses the App id | Rerun `mint-token.mjs --bot-email` and use that exact address |
| A colleague's commits show your bot | Identity went into a committed `.claude/settings.json` | Move it to `~/.claude/settings.json` or `settings.local.json` |
| Codex doesn't review bot PRs | Auto code review follows personal preferences | Set the repo to **Review all PRs** |

## Loud failures

| Message | Cause | Fix |
|---|---|---|
| `no profile. Set GH_AGENT_IDENTITY` | Env var missing in the agent's shell | Check the settings, restart the session |
| `could not reach https://api.github.com` | Sandbox has no network (Codex default) | See the Codex page |
| `401 ... A JSON web token could not be decoded` | Wrong key file, or Client ID from another App | Match the `.pem` to the App whose Client ID is in the profile |
| `401 ... 'Expiration time' claim ('exp') is too far in the future` / `'Issued at' claim ... in the future` | Machine clock is off | Sync the clock |
| `404` on `/app/installations/<id>/access_tokens` | Wrong installation id, or the App was uninstalled | `mint-token.mjs --find-installation owner/repo` |
| `404` on `--find-installation` | App not installed on that repo | Install it, or add the repo to the installation |
| `403 Resource not accessible by integration` | App lacks a permission | Add it in the App settings, **then accept the new permissions on the installation** (the owner gets a prompt, and until it's accepted nothing changes) |
| `401 Bad credentials` from `gh` | Someone exported a `GH_TOKEN` that has expired | Unset it. `GH_TOKEN` beats your stored login, so an expired one fails instead of falling back |

## Things that look wrong but aren't

- `ghapp api user` returns 403. Installation tokens don't represent a user. Use
  `ghapp api /installation/repositories` to test instead.
- The committer on bot commits is you. That's intended: the bot authored it,
  your machine recorded it.
- Tokens last one hour. `ghapp` mints a new one per call, so long sessions never
  hit the expiry.
