#!/usr/bin/env bash
# ask-autojack.sh — delegate one request to autojack (AutoHub chat server).
#
# Usage:
#   ask-autojack.sh "<your natural-language request>"
#   ask-autojack.sh --timeout 300 "<request>"
#   ask-autojack.sh --conversation-id my-cc-session "<request>"
#   ask-autojack.sh --json "<request>"           # full JSON instead of just .content
#
# Exit codes:
#   0  ok — autojack returned a response
#   2  autohub not running (health check failed)
#   3  bad CLI usage
#   N  HTTP status code from chat server on non-2xx

set -euo pipefail

CHAT_SERVER="${CHAT_SERVER_URL:-http://localhost:8767}"
TIMEOUT=180
CONVERSATION_ID="cc-$(hostname -s 2>/dev/null || echo host)-$$-$(date +%s)"
RETURN_JSON=0
REQUEST=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --timeout)
      TIMEOUT="$2"; shift 2;;
    --conversation-id)
      CONVERSATION_ID="$2"; shift 2;;
    --json)
      RETURN_JSON=1; shift;;
    -h|--help)
      sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
      exit 0;;
    --*)
      echo "ask-autojack: unknown flag: $1" >&2
      exit 3;;
    *)
      if [[ -z "$REQUEST" ]]; then
        REQUEST="$1"
      else
        echo "ask-autojack: only one positional <request> allowed (got extra: $1)" >&2
        exit 3
      fi
      shift;;
  esac
done

if [[ -z "$REQUEST" ]]; then
  echo "ask-autojack: missing <request>. Usage: ask-autojack.sh \"<request>\"" >&2
  exit 3
fi

# --- Health probe ---------------------------------------------------------
if ! curl -sS --max-time 2 "${CHAT_SERVER}/health" >/dev/null 2>&1; then
  cat >&2 <<EOF
ask-autojack: AutoHub not reachable at ${CHAT_SERVER}.
Start it:
  cd <HOME> && npm run chat:dev
Then retry. (Or set CHAT_SERVER_URL=http://host:port if it's running elsewhere.)
EOF
  exit 2
fi

# --- Build payload --------------------------------------------------------
USER_TAG="cc-$(hostname -s 2>/dev/null || echo host)-$$"

PAYLOAD=$(jq -n \
  --arg content   "$REQUEST" \
  --arg user      "$USER_TAG" \
  --arg conv_id   "$CONVERSATION_ID" \
  '{
    messages:        [{role: "user", content: $content}],
    model:           "claude-sonnet-4-6",
    stream:          false,
    tools_profile:   "extended",
    max_tokens:      4000,
    source:          "claude-code",
    user:            $user,
    conversation_id: $conv_id
  }')

# --- Call -----------------------------------------------------------------
TMP_BODY=$(mktemp)
trap 'rm -f "$TMP_BODY"' EXIT

HTTP_CODE=$(curl -sS --max-time "$TIMEOUT" \
  -o "$TMP_BODY" \
  -w '%{http_code}' \
  -X POST "${CHAT_SERVER}/v1/chat/completions" \
  -H 'Content-Type: application/json' \
  -d "$PAYLOAD") || {
    echo "ask-autojack: curl failed (timeout? network?) after ${TIMEOUT}s" >&2
    cat "$TMP_BODY" >&2 || true
    exit 1
  }

if [[ "$HTTP_CODE" -lt 200 || "$HTTP_CODE" -ge 300 ]]; then
  echo "ask-autojack: chat server returned HTTP ${HTTP_CODE}" >&2
  cat "$TMP_BODY" >&2
  exit "$HTTP_CODE"
fi

# --- Emit -----------------------------------------------------------------
if [[ "$RETURN_JSON" -eq 1 ]]; then
  cat "$TMP_BODY"
else
  jq -r '.choices[0].message.content // empty' "$TMP_BODY"
fi
