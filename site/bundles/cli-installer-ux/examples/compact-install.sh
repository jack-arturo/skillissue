#!/bin/sh
set -eu

QUIET="${APP_QUIET:-0}"
VERBOSE="${APP_VERBOSE:-0}"
STEP=0
TOTAL=4
TMP_DIR="$(mktemp -d)"
LOG_COUNT=0

cleanup() {
  [ -n "${TMP_DIR:-}" ] && [ -d "$TMP_DIR" ] && rm -r "$TMP_DIR"
}
trap cleanup EXIT INT TERM

plain() { [ "$QUIET" = "1" ] || printf '%s\n' "$*"; }
info() { [ "$QUIET" = "1" ] || printf '  > %s\n' "$*"; }
ok() { [ "$QUIET" = "1" ] || printf '  + %s\n' "$*"; }
fail() { printf 'x %s\n' "$*" >&2; exit 1; }

step() {
  [ "$QUIET" = "1" ] && return 0
  STEP=$((STEP + 1))
  printf 'stage %s/%s  %-8s %s\n' "$STEP" "$TOTAL" "$1" "$2"
}

run_quiet() {
  label="$1"
  shift
  LOG_COUNT=$((LOG_COUNT + 1))
  log_file="$TMP_DIR/step-$LOG_COUNT.log"
  if "$@" >"$log_file" 2>&1; then
    [ "$VERBOSE" = "1" ] && [ -s "$log_file" ] && tail -20 "$log_file"
    return 0
  fi
  printf 'x %s failed\n' "$label" >&2
  [ -s "$log_file" ] && tail -40 "$log_file" >&2
  return 1
}

plain "App installer"
plain "Install plan"
info "app     ${APP_HOME:-$HOME/.app}"
info "state   ${APP_STATE:-fresh install}"
info "target  ${APP_TARGET:-latest}"

step detect "checking prerequisites"
command -v node >/dev/null 2>&1 || fail "missing node"
ok "node $(node --version)"

step fetch "preparing source"
run_quiet "prepare source" sh -c 'printf ready'
ok "source ready"

step build "installing dependencies and compiling"
run_quiet "build" sh -c 'printf built'
ok "build complete"

step path "installing command shim"
ok "shim installed"
plain "next  app doctor"
