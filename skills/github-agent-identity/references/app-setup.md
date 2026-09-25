# Creating the GitHub App for one agent

One App per agent per person. If Alice runs Claude Code and Codex, she makes
`claude-alice` and `codex-alice`. Shared Apps work too, but then the PR body has
to say which tool ran, and the avatar alone stops being the answer.

## 1. Create the App

Pick who owns it:

| Owner | Where | When |
|---|---|---|
| Your personal account | Settings → Developer settings → GitHub Apps → New GitHub App | Your own repos, or any org that will let you install it |
| An organization | Org settings → Developer settings → GitHub Apps → New GitHub App | The org's repos. Needs an org owner or a GitHub App manager |

Form fields that matter:

- **GitHub App name.** Becomes the bot login with `[bot]` appended, so
  `claude-alice` shows up as `claude-alice[bot]`. Names are global across GitHub
  and max out at 34 characters.
- **Homepage URL.** Anything. Your profile URL is fine.
- **Webhook.** Untick **Active**. Nothing here listens for events.
- **Where can this GitHub App be installed?** "Only on this account" when the App
  and the repos share an owner. A personal App that has to go on an org's repos
  needs "Any account". Only the holder of the private key can act as the App,
  so a public listing lets other people install it but not use it.

Repository permissions:

| Permission | Access | Why |
|---|---|---|
| Contents | Read and write | Push branches, read files |
| Pull requests | Read and write | Open PRs, comment, request review |
| Issues | Read and write | File follow-up issues, add labels |
| Metadata | Read | Required, set automatically |
| Actions | Read | Optional. Read CI runs and logs |
| Checks, Commit statuses | Read | Optional. Read check results |
| Workflows | Read and write | Only if agents edit `.github/workflows/` |

Grant the minimum and add more when a `403 Resource not accessible by
integration` shows up. Every permission you add later has to be **accepted on
each installation** before it applies (see troubleshooting).

## 2. Keep the private key

On the App's settings page:

1. Copy the **Client ID** (starts with `Iv23`). The numeric App ID works too,
   but GitHub recommends the Client ID for signing.
2. Under **Private keys**, click **Generate a private key**. A `.pem` downloads.

Move it somewhere private and lock it down:

```bash
mkdir -p ~/.config/github-agent-identity
mv ~/Downloads/claude-alice.*.private-key.pem ~/.config/github-agent-identity/claude-alice.pem
chmod 600 ~/.config/github-agent-identity/claude-alice.pem
```

Never commit it, paste it into a chat, or put it in an environment variable.
Anyone holding it can act as the bot on every repo the App is installed on.

## 3. Install the App

From the App's public page (**Install App** in the sidebar), pick the account and
choose **Only select repositories**. Add repos as you need them.

## 4. Write the profile

```bash
cat > ~/.config/github-agent-identity/claude-alice.env <<'EOF'
GHAPP_CLIENT_ID=Iv23liExampleClientId
GHAPP_PEM=~/.config/github-agent-identity/claude-alice.pem
GHAPP_BOT_LOGIN=claude-alice[bot]
GHAPP_INSTALLATION_ID=
EOF
chmod 600 ~/.config/github-agent-identity/claude-alice.env
```

Find the installation id with the script (it only needs the Client ID and the
key), then paste it in:

```bash
GH_AGENT_IDENTITY=claude-alice node mint-token.mjs --find-installation your-org/your-repo
```

The id is also the number at the end of the installation's settings URL.

## 5. Get the commit author email

```bash
GH_AGENT_IDENTITY=claude-alice node mint-token.mjs --bot-email
# 123456789+claude-alice[bot]@users.noreply.github.com
```

**The number is the bot's user id, not the App id.** They are different numbers.
With the App id, commits still say `claude-alice[bot]` but GitHub can't link them
to the bot account, so they show no avatar.

## 6. Install the scripts

```bash
mkdir -p ~/.local/bin
cp mint-token.mjs ghapp verify.sh ~/.local/bin/
chmod +x ~/.local/bin/ghapp ~/.local/bin/verify.sh ~/.local/bin/mint-token.mjs
```

`ghapp` looks for `mint-token.mjs` in its own folder, so keep them together, and
make sure `~/.local/bin` is on your `PATH`.

Then wire it into the agent: [Claude Code](claude-code.md), [Codex](codex.md).
