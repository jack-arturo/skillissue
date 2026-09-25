#!/usr/bin/env bash
# Check that this shell acts on GitHub as the agent, not as you.
#
# Run it the way the agent runs commands (inside Claude Code or Codex), because
# that is where the settings have to be in effect:
#
#   verify.sh                 identity, token, and commit author
#   verify.sh owner/repo      also confirm the App can reach that repository
set -uo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
failures=0
pass() { printf 'PASS  %s\n' "$1"; }
miss() { printf 'FAIL  %s\n' "$1"; failures=$((failures + 1)); }

if [ -n "${GH_AGENT_IDENTITY:-}" ]; then
  pass "GH_AGENT_IDENTITY is ${GH_AGENT_IDENTITY}"
else
  miss "GH_AGENT_IDENTITY is not set in this shell"
fi

errfile="$(mktemp)"
token="$(node "$script_dir/mint-token.mjs" 2>"$errfile")"
if [ -n "$token" ]; then
  pass "minted an installation token"
else
  miss "could not mint a token: $(cat "$errfile")"
fi
rm -f "$errfile"

if [ -n "$token" ]; then
  # Only an App installation token can call this endpoint, so a number here
  # proves gh is not quietly using your personal login.
  count="$(GH_TOKEN="$token" gh api /installation/repositories --jq .total_count 2>/dev/null)"
  if [[ "$count" =~ ^[0-9]+$ ]]; then
    pass "token belongs to an App installation covering $count repositories"
  else
    miss "the token did not work as an App installation token"
  fi
  if [ -n "${1:-}" ]; then
    if GH_TOKEN="$token" gh api "repos/$1" --jq .full_name >/dev/null 2>&1; then
      pass "the App can reach $1"
    else
      miss "the App cannot reach $1 (install the App on it, or check the repository list)"
    fi
  fi
fi

author="$(git var GIT_AUTHOR_IDENT 2>/dev/null | sed -E 's/ [0-9]+ [+-][0-9]{4}$//')"
if [[ "$author" == *"[bot]"*"[bot]@users.noreply.github.com>" ]]; then
  pass "commits will be authored as $author"
else
  miss "commits will be authored as '${author:-unknown}', not the bot (set GIT_AUTHOR_NAME and GIT_AUTHOR_EMAIL)"
fi

if [ -n "${GH_AGENT_IDENTITY:-}" ] && [[ "$author" == *"@users.noreply.github.com>" ]]; then
  expected="$(node "$script_dir/mint-token.mjs" --bot-email 2>/dev/null)"
  if [ -n "$expected" ] && [[ "$author" == *"<$expected>" ]]; then
    pass "author email matches the bot's user id"
  elif [ -n "$expected" ]; then
    miss "author email should be $expected (the bot user id, not the App id)"
  fi
fi

if [ "$failures" -eq 0 ]; then
  echo "All checks passed."
else
  echo "$failures check(s) failed."
  exit 1
fi
