#!/usr/bin/env bash
# brand-bible-author Tier 1 test orchestrator.
# Runs the three validators; exits non-zero on any failure.
#
# Usage:
#   bash tests/run_all.sh --project /path/to/artist
#   bash tests/run_all.sh --project /path/to/artist --brief examples/generic-artist.brief.json
#   bash tests/run_all.sh --project /path/to/artist --json
#
# Without --project, the locked-bible check is skipped (still validates schema + references).
set -uo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TESTS_DIR="${SKILL_DIR}/tests"

PROJECT=""
BRIEF=""
JSON_FLAG=""
EXTRA=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT="$2"; shift 2 ;;
    --brief)   BRIEF="$2"; shift 2 ;;
    --json)    JSON_FLAG="--json"; shift ;;
    *)         EXTRA+=("$1"); shift ;;
  esac
done

EXIT=0
RESULTS=()

run_check() {
  local name="$1"; shift
  local output
  if output="$("$@" 2>&1)"; then
    RESULTS+=("$output")
  else
    EXIT=1
    RESULTS+=("$output")
  fi
}

run_check schema      uv run --quiet "${TESTS_DIR}/validate_schema.py"     ${JSON_FLAG:+$JSON_FLAG}
run_check references  uv run --quiet "${TESTS_DIR}/validate_references.py" ${JSON_FLAG:+$JSON_FLAG}

if [[ -n "$PROJECT" ]]; then
  BRIEF_ARGS=()
  if [[ -n "$BRIEF" ]]; then
    # Resolve relative brief paths against SKILL_DIR.
    if [[ "$BRIEF" != /* ]]; then
      BRIEF="${SKILL_DIR}/${BRIEF}"
    fi
    BRIEF_ARGS+=(--brief "$BRIEF")
  fi
  run_check locked_bible uv run --quiet "${TESTS_DIR}/validate_locked_bible.py" \
    --project "$PROJECT" "${BRIEF_ARGS[@]}" ${JSON_FLAG:+$JSON_FLAG}
fi

if [[ -n "$JSON_FLAG" ]]; then
  printf '{"runner":"run_all","exit":%d,"checks":[%s]}\n' "$EXIT" "$(IFS=,; echo "${RESULTS[*]}")"
else
  for r in "${RESULTS[@]}"; do
    printf '%s\n' "$r"
  done
  if [[ $EXIT -eq 0 ]]; then
    printf '\nALL CHECKS PASSED\n'
  else
    printf '\nFAIL — see above\n' >&2
  fi
fi

exit "$EXIT"
