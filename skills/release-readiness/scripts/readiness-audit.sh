#!/usr/bin/env bash
#
# release-readiness :: read-only audit
#
# Gathers every fact the release-readiness skill needs to judge whether a repo
# is ready to tag, and prints it in clearly-delimited sections. This script
# NEVER mutates anything — no commits, no pushes, no writes to tracked files.
# It is safe to run at any time.
#
# Zero-config: it discovers the version source, the last release tag, the
# default (release) branch, and the work since that tag from the repo itself.
# Designed for WordPress plugins that carry the version in readme.txt "Stable
# tag" and tag releases as bare semver (e.g. 3.47.12), but degrades gracefully.
#
# It is deliberately BRANCH-AWARE: the "release set" is computed from the
# default branch (what actually ships), and commits that live only on the
# current branch are flagged as a blocker — they would miss the release unless
# merged first.
#
# Usage:  bash readiness-audit.sh [repo_path]
#         (defaults to the current directory's git root)

set -uo pipefail

REPO="${1:-$(pwd)}"
cd "$REPO" 2>/dev/null || { echo "ERROR: cannot cd to $REPO"; exit 1; }
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "ERROR: not a git repository"; exit 1; }
cd "$ROOT"

section() { printf '\n===== %s =====\n' "$1"; }

# --- Version source ---------------------------------------------------------
section "VERSION SOURCE"
README=""
for f in readme.txt README.txt readme.md README.md; do
  if [ -f "$f" ] && grep -qiE '^\s*Stable tag:' "$f"; then README="$f"; break; fi
done
if [ -n "$README" ]; then
  STABLE="$(grep -iE '^\s*Stable tag:' "$README" | head -1 | sed -E 's/.*[Ss]table tag:[[:space:]]*//' | tr -d '\r')"
  echo "version_source: $README (Stable tag)"
  echo "current_stable_tag: $STABLE"
else
  echo "version_source: NOT FOUND (no readme.txt Stable tag) — confirm version source with the user"
  echo "current_stable_tag: unknown"
fi

# --- Last release tag -------------------------------------------------------
section "LAST RELEASE TAG"
# Prefer bare-semver tags; ignore archive/* and other namespaced tags.
LAST_TAG="$(git tag --sort=-v:refname 2>/dev/null | grep -E '^v?[0-9]+\.[0-9]+(\.[0-9]+)?$' | head -1)"
if [ -z "$LAST_TAG" ]; then
  LAST_TAG="$(git describe --tags --abbrev=0 2>/dev/null || true)"
fi
echo "last_tag: ${LAST_TAG:-<none found>}"
if [ -n "$LAST_TAG" ]; then
  echo "last_tag_date: $(git log -1 --format=%ci "$LAST_TAG" 2>/dev/null || echo unknown)"
fi

# --- Default (release) branch ----------------------------------------------
DEFAULT_BR="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's@^origin/@@')"
DEFAULT_BR="${DEFAULT_BR:-master}"
if git rev-parse --verify --quiet "$DEFAULT_BR" >/dev/null 2>&1; then
  DEFAULT_REF="$DEFAULT_BR"
elif git rev-parse --verify --quiet "origin/$DEFAULT_BR" >/dev/null 2>&1; then
  DEFAULT_REF="origin/$DEFAULT_BR"
else
  DEFAULT_REF="HEAD"
fi
CUR_BR="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"

# --- Release set (what actually ships) -------------------------------------
section "RELEASE SET — commits on $DEFAULT_BR since $LAST_TAG (this is what ships)"
if [ -n "$LAST_TAG" ]; then
  REL_COUNT="$(git rev-list "${LAST_TAG}..${DEFAULT_REF}" --count 2>/dev/null || echo 0)"
  echo "release_commit_count: $REL_COUNT  (counted on $DEFAULT_REF, not the current branch)"
  git log "${LAST_TAG}..${DEFAULT_REF}" --oneline 2>/dev/null
  echo "--- #refs in the release set (NOTE: may include issue/ticket numbers, not only PRs) ---"
  git log "${LAST_TAG}..${DEFAULT_REF}" --format='%s%n%b' 2>/dev/null \
    | grep -oE '#[0-9]+' | tr -d '#' | sort -un | sed 's/^/#/' | paste -sd' ' - 2>/dev/null
else
  echo "release_commit_count: unknown (no tag to diff against)"
fi

# --- Current-branch-only commits (release blocker) -------------------------
section "CURRENT-BRANCH-ONLY COMMITS — not on $DEFAULT_BR"
if [ "$CUR_BR" = "$DEFAULT_BR" ]; then
  echo "on the default branch ($DEFAULT_BR) — nothing branch-only"
else
  ONLY_COUNT="$(git rev-list "${DEFAULT_REF}..HEAD" --count 2>/dev/null || echo 0)"
  echo "current_branch: $CUR_BR   commits_not_on_${DEFAULT_BR}: $ONLY_COUNT"
  if [ "${ONLY_COUNT:-0}" != "0" ]; then
    echo ">>> BLOCKER: these commits are NOT on $DEFAULT_BR and would miss the release unless merged first:"
    git log "${DEFAULT_REF}..HEAD" --oneline 2>/dev/null | sed 's/^/    /'
  fi
fi

# --- Changelog status -------------------------------------------------------
section "CHANGELOG STATUS"
if [ -n "$README" ]; then
  echo "--- top changelog entries (most recent first) ---"
  awk '/== Changelog ==/{f=1} f{print; n++} n>=8{exit}' "$README" | grep -E '^= ' | head -5
  TOP_ENTRY="$(awk '/== Changelog ==/{f=1} f && /^= /{print; exit}' "$README" 2>/dev/null)"
  echo "top_changelog_version_line: ${TOP_ENTRY:-<none>}"
  echo "note: if top_changelog_version_line == current_stable_tag == last_tag, an UNRELEASED entry still needs to be written + version bumped"
else
  echo "no readme changelog found"
fi

# --- Working tree -----------------------------------------------------------
section "WORKING TREE"
DIRTY="$(git status --porcelain 2>/dev/null)"
if [ -z "$DIRTY" ]; then echo "clean: yes"; else echo "clean: no"; echo "$DIRTY"; fi

# --- Worktrees --------------------------------------------------------------
section "WORKTREES"
git worktree list 2>/dev/null

# --- Branch sync ------------------------------------------------------------
section "BRANCH SYNC"
echo "current_branch: $CUR_BR"
echo "default_branch: $DEFAULT_BR  (release ref used: $DEFAULT_REF)"
if UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null)" && [ "$UPSTREAM" != "@{u}" ]; then
  set -- $(git rev-list --left-right --count "${UPSTREAM}...HEAD" 2>/dev/null)
  echo "upstream: $UPSTREAM  behind: ${1:-?}  ahead: ${2:-?}"
else
  echo "upstream: <none — this branch is not pushed/tracked>"
fi

# --- Local branches not merged ---------------------------------------------
section "UNMERGED LOCAL BRANCHES (cleanup candidates)"
echo "note: squash-merged branches also show here even though their work shipped — treat as prune candidates, not missing work"
git branch --no-merged "$DEFAULT_BR" 2>/dev/null | sed 's/^/  not-merged: /' || true

# --- GitHub: open PRs & issues ---------------------------------------------
section "GITHUB OPEN PRS"
if command -v gh >/dev/null 2>&1; then
  gh pr list --state open --limit 30 \
    --json number,title,isDraft,headRefName,mergeable \
    --template '{{range .}}#{{.number}} [{{if .isDraft}}DRAFT{{else}}ready{{end}}/{{.mergeable}}] {{.headRefName}} — {{.title}}{{"\n"}}{{end}}' 2>/dev/null \
    || echo "(gh pr list failed — check auth/rate limit)"
else
  echo "(gh not installed)"
fi

section "GITHUB OPEN ISSUES (milestoned / recent)"
if command -v gh >/dev/null 2>&1; then
  gh issue list --state open --limit 30 \
    --json number,title,milestone,labels \
    --template '{{range .}}#{{.number}} {{if .milestone}}[{{.milestone.title}}] {{end}}{{.title}}{{"\n"}}{{end}}' 2>/dev/null \
    || echo "(gh issue list failed)"
else
  echo "(gh not installed)"
fi

# --- Quality tooling present ------------------------------------------------
section "QUALITY TOOLING"
if [ -f composer.json ]; then
  echo "--- composer scripts ---"
  grep -E '"(test|phpstan|phpcs|phpcbf)"' composer.json 2>/dev/null | sed 's/^/  /'
fi
if [ -f package.json ]; then
  echo "--- npm version-sync / release scripts ---"
  grep -E '"(version:update|release|build)"' package.json 2>/dev/null | sed 's/^/  /'
fi

# --- Dispatchable agents / commands in this repo ----------------------------
section "DISPATCHABLE AGENTS"
if [ -d .claude/agents ]; then
  for a in .claude/agents/*.md; do
    [ -e "$a" ] || continue
    desc="$(awk -F': ' '/^description:/{ $1=""; print substr($0,2); exit }' "$a" 2>/dev/null | cut -c1-100)"
    echo "agent: $(basename "$a" .md) — ${desc:-(no description)}"
  done
else
  echo "(.claude/agents not present)"
fi
if [ -d .claude/commands ]; then
  for c in .claude/commands/*.md; do
    [ -e "$c" ] || continue
    echo "command: $(basename "$c" .md)"
  done
fi

section "AUDIT COMPLETE"
