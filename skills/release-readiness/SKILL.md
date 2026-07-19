---
name: release-readiness
description: >-
  Use when preparing to tag or cut a release of a WordPress plugin (or any repo
  that carries its version in readme.txt "Stable tag" and tags releases as bare
  semver). Triggers on "is this ready to tag", "prep the release", "release
  readiness", "get the release ready", "release preflight", "what's left before
  we ship X.Y.Z", or any moment just before a release tag. Audits everything
  merged since the last git tag, surfaces the gaps (undocumented features,
  missing changelog entries, dirty working tree, stale branches/worktrees, open
  PRs, version not bumped, failing tests), then — after one approval — closes
  the in-repo gaps it can (drafts the changelog, bumps the version, dispatches
  the repo's docs/verification agents, runs the suite behind a safety guard) and
  stops at a green "ready to tag" state. It NEVER pushes, tags, or publishes
  anything: every action that leaves the repo stays the human's decision.
agents: [claude-code]
metadata:
  version: "1.0.0"
tags: [release, wordpress, changelog, preflight, ci, git, wp-fusion]
category: workflow
license: proprietary
capabilities:
  network: true
  filesystem: readwrite
resources:
  - path: scripts/readiness-audit.sh
    type: file
---

# Release Readiness

The pre-flight checklist you run when you're about to tag a release. It answers
one question — **"is everything that should ship in this release actually
accounted for, clean, documented, and working?"** — and then gets the release
prepped to the point where all that's left is your hand on the trigger.

## The one rule that defines this skill

**Never do anything that leaves the repo.** Pushing, `git tag`, `npm run
release`, publishing a live doc draft on the website — those are the human's
release trigger, and they're hard to reverse. This skill audits, fixes things
*inside* the working copy, and stops. When prep is done you hand back a green
"ready to tag" state plus an explicit list of the leave-the-repo steps that are
now the user's to take.

Everything in-repo and reversible is fair game after approval (editing
`readme.txt`, running the version-sync task, committing on the current branch).
Everything outward-facing is flagged, never done.

## Workflow

Work through four phases in order. Phases 0–1 are read-only and need no
permission. Phase 2 is the single approval gate. Phase 3 only runs after the
user approves.

---

### Phase 0 — Orient (zero-config)

Run the bundled audit script from the repo you're releasing. It is read-only and
discovers everything from the repo itself, so there is no per-plugin setup:

```bash
bash <skill-dir>/scripts/readiness-audit.sh [repo-path]
```

It reports: the version source (`readme.txt` Stable tag), the last release tag,
every commit and merged-PR number since that tag, changelog status, working-tree
cleanliness, worktrees, branch sync, unmerged local branches, open PRs/issues
(via `gh`), the quality tooling available (`composer test`/`phpstan`/`phpcs`,
the gulp `version:update`/`release` scripts), and the **dispatchable agents and
commands this repo has** in `.claude/agents` + `.claude/commands`.

You do not need to re-run the individual git/gh commands — read the script's
output and reason from it.

**Discovering what you can dispatch.** The script lists this repo's agents with
their descriptions. Map roles by reading those descriptions, don't hardcode
names:

- a **docs** agent (e.g. `wpf-docs-writer`) — writes/updates documentation,
  usually stopping at a draft
- a **runtime/integration verifier** (e.g. `wpf-integration-verifier`) — drives
  a feature against the live dev site and returns an evidence report
- commands like `update-wordpress-docs` may wrap the same capability

If a role has no matching agent in this repo, skip that remediation and report
it as a manual step instead. That is what keeps the skill portable across
plugins without configuration.

---

### Phase 1 — Audit → readiness report

Turn the script output into a **green / yellow / red report**. Investigate
anything ambiguous (read the actual files; don't guess). Cover:

1. **Branch & merge state.** The audit reports two distinct sets: the **RELEASE
   SET** (commits on the default branch since the tag — what actually ships) and
   **CURRENT-BRANCH-ONLY** commits. The changelog and version bump always
   describe the RELEASE SET, never the current branch's tip. Any
   current-branch-only commits come back as a `>>> BLOCKER` — they would miss
   the release unless merged first. Flag them loudly and resolve in Phase 2
   before drafting anything. Note unpushed commits.
2. **Working tree & worktrees.** Is `git status` clean? Any orphaned
   `git worktree` entries pointing at deleted branches? Stale local branches?
   Note: squash-merged branches show as "not merged" even though their work
   shipped — treat those as cleanup candidates, not missing work, and say so
   rather than alarming the user.
3. **Open PRs / issues.** Any open PR that's meant for this release (still
   unmerged, draft, or unmergeable)? Any issue milestoned for this version still
   open? These either block the release or should be consciously deferred.
4. **Unreleased work vs changelog.** Cross-check every merged PR since the last
   tag against the changelog. The gap is exactly the set of entries you'll
   draft in Phase 3.
5. **Version status.** If the changelog's top entry, the `Stable tag`, and the
   last git tag are all the same version, the version still needs a bump and an
   unreleased changelog entry — that's the normal mid-cycle state.
6. **Documentation gaps.** For each merged *feature / integration* PR since the
   tag, is there a doc? New integrations and new public hooks/filters are the
   usual offenders. Note any doc drafts already parked waiting on this release
   (these get published *by the human* on release, per the one rule).
7. **Tests / quality.** Note current static-analysis state and that the suite
   will run in Phase 3 behind the guard below.

Present the report compactly. Then present the **remediation plan**: the
specific gap-closing actions you propose, in order, naming which agent (if any)
you'll dispatch for each. Distinguish clearly between **in-repo actions you'll
take after approval** and **leave-the-repo steps you're handing back**.

---

### Phase 2 — One approval gate

Show the report + plan and get a single approval. After that, execute the whole
in-repo plan autonomously and report back — don't stop to confirm each step.
The boundary that stays sacred is outward-facing actions, not in-repo ones.

If the audit found a **blocker** (e.g. release-bound commits sit only on a
feature branch, or an unmerged PR belongs in the release), surface it as a
decision for the user *before* doing prep — you can't sensibly write a changelog
for work that isn't on the release branch yet.

---

### Phase 3 — Prep (autonomous, in-repo only)

Do these after approval. All are reversible and stay inside the working copy.

**Changelog.** Draft entries into the `readme.txt` changelog from the merged PRs
since the last tag. Match the house format exactly — newest entry on top, under
`== Changelog ==`:

```
= X.Y.Z - M/D/YYYY =
* Added <thing> ...
* Improved - <thing> ...
* Fixed <thing> ...
```

Use today's date. Categorize each bullet as **Added / Improved - / Fixed**.
Write in the user's voice — invoke the `jacks-writing-style` skill if available,
and study the existing entries for tone (concrete, specific about what changed
and why it matters, no fluff). Default the new version to a **patch** bump
(`3.47.12 → 3.47.13`); propose **minor** instead only if the work includes
notable new integrations or features, and let the user confirm if unsure.

**Link new integrations / documented features to their docs.** When a bullet
announces a *new integration*, or a new feature that gets its own documentation
section, link the integration/feature name in Markdown to its docs page —
that's the house convention, visible all through the existing changelog:

```
* Added [SureDash integration](https://wpfusion.com/documentation/learning-management/suredash/) for syncing course and lesson completions
* Added a [Sender.net CRM integration](https://wpfusion.com/crm/sender/)
* Improved - Added support for field mapping using the [generic field mapping UI in Gravity Forms](https://wpfusion.com/documentation/lead-generation/gravity-forms/#feed-settings)
```

The URL is `https://wpfusion.com/documentation/<category>/<slug>/` (or
`/crm/<slug>/` for a CRM), deep-linked to a `#section` anchor when the bullet
describes one sub-feature of a larger doc. Get the real URL from the doc the
repo's docs agent wrote/updated for this feature — do **not** invent a slug. If
the doc is still a parked draft (not yet published — the human publishes it on
release per the one rule), use the URL the draft *will* live at and flag in the
handoff that the link goes live only once the draft is published. Routine fixes
and improvements to already-documented things don't need a link — only
new integrations and genuinely new, separately-documented features do.

**Only ship user-facing entries.** Curate the release set down to changes a site
owner would actually notice. Exclude internal / dev-only commits — anything that
only touches `.claude/` (agents, commands), `tests/`, CI configs, build/release
tooling, fixture ledgers, or the dev harness. Commits like "Harden the
runtime-verification harness" or "Add feature-request pipeline agents" are
invisible to users and must NOT appear in the changelog. When unsure whether a
commit is user-facing, look at what files it changed. A WP Fusion release of ~20
commits typically yields a handful fewer changelog lines for exactly this reason.

**Version bump.** Set the new version in the `Stable tag` line of `readme.txt`,
then run the repo's version-sync task so the plugin header and version constant
match — e.g. `npm run version:update` (gulp `updatePHPDocs updateMainPluginFile
updateVersionConstant`). That task is also what replaces the `x.x.x` `@since`
placeholders with the real version — so do **not** hand-edit those, just let the
task do it (the last tagged release tree has zero `x.x.x` left, confirming this
is the intended path).

**Verify the bump actually propagated — don't assume the sync worked.** After
running the task, confirm the new version appears in ALL THREE places and they
agree: the `readme.txt` `Stable tag`, the plugin header `Version:` line, and the
version constant (`*_VERSION`). WP Fusion's gulp tasks rewrite the header and the
constant in the *same file in parallel* and can race, leaving the header stale at
the old version while the constant updates — a real, observed failure. If the
three disagree, STOP, fix the lagging one by hand, and report it: a tag built on
a mismatched version is a broken release.

**Documentation.** For each documentation gap, dispatch the repo's docs agent
(the one you mapped in Phase 0). That agent stops at a draft by design — let it.
Report which drafts now exist and are ready for the human to publish on release.
If there's no docs agent in this repo, list the docs work as a manual step.

**Runtime verification (when relevant).** If the repo has an integration
verifier and the release includes integration work whose runtime behavior isn't
already proven, dispatch it to confirm those features work on the dev site, and
fold its evidence into the report. Otherwise note it as a manual check.

**Tests.** Run static analysis first — `composer phpcs` and `composer phpstan`
— always safe (no DB). Then run the unit suite behind the guard below.

**Commit.** Stage and commit the changelog + version-bump changes on the
*current branch* with a clear message (e.g. `Prep release X.Y.Z`). Committing is
in-repo and reversible. **Do not push and do not tag** — that's the trigger.

---

### Phase 4 — Ready-to-tag handoff

Close with:

- A final **green / red** summary of every audit item.
- The **your-move list** — the leave-the-repo steps the skill deliberately did
  not take, in the order to do them. Typically: merge any release-bound branch
  into `master`, push, publish the parked doc drafts, `git tag X.Y.Z`, and
  `npm run release` (or the repo's deploy). Quote the exact commands.
- Anything still **blocked or unverified**, stated plainly. Don't claim green on
  something you couldn't check — say what you skipped and why.

---

## The test safety guard

The suite runs against the **live local dev database** — there is no separate
test DB — so a careless test can mutate real dev-site settings (a tearDown once
blanked the CRM connection option and silently disconnected the site). The
**restore** path, not the snapshot, is the hard part: read access is easy, write
access takes a beat to wire up. Protect the dev site like this:

1. **Static analysis first** (`composer phpcs`, `composer phpstan`) — no DB, high
   signal, zero risk. Always run these. Note that `phpcs` reports against whole
   files, so a legacy codebase shows a large baseline count; judge the release by
   *regression*, not the absolute number — scope phpcs to the changed files and
   confirm net-new files are clean and modified files didn't gain violations
   (compare a file's count at the last tag vs. now).

2. **Snapshot the settings rows the suite can touch — and fingerprint the
   critical one.** For WP Fusion snapshot *every* `option_name LIKE 'wpf%'` row in
   `wp_options` (it's ~120 rows, and the CRM connection, available tags, and
   migration flags all live in there — don't snapshot only `wpf_options` +
   `wpf_available_tags`). Capture an `MD5(option_value)` of the `wpf_options` row
   before and after so you can *prove* the CRM connection round-tripped. The
   `local-wp` MCP `mysql_query` reads fine but is **read-only
   (SELECT/SHOW/DESCRIBE only)** — good for the fingerprint, useless for restore.

3. **Get a real WRITE path — on a standard Local install there almost always is
   one.** Local bundles its own `mysql`/`mysqldump` client; you don't need `wp` or
   a system `mysql` on PATH (usually neither is). Discover it:
   - **Socket + DB:** `local-wp` MCP `mysql_current_site` → `socketPath` (and the
     DB is `local`, prefix `wp_`).
   - **Client binary:** `find "$HOME/Library/Application Support/Local/lightning-services" -name mysql -type f` — pick the matching `…/bin/<platform>/bin/mysql` (e.g. `mysql-8.4.0/bin/darwin-arm64/bin/`). `mysqldump` sits beside it. Local's default creds are `root` / `root`.
   - **Idempotent snapshot:** dump the rows in REPLACE mode so re-running the file
     overwrites any changed values straight back:
     `mysqldump --socket=… -uroot -proot --no-create-info --skip-extended-insert --replace --where="option_name LIKE 'wpf%'" local wp_options > snapshot.sql`
   - **A write path does NOT authorize an unattended run.** The suite still
     mutates the live dev DB, so running it requires the user's explicit
     risk-acceptance — and a permission/auto-mode layer will (correctly) block
     `composer test` against a live local DB until they grant it. So even with the
     snapshot ready, do not fire the suite on your own: prepare the net (snapshot +
     fingerprint), then ask. The write path is what makes the run *safe once
     authorized*; it is not the authorization.
   - **Once the user green-lights it:** run `composer test` → re-apply
     `snapshot.sql` → re-read the `wpf_options` MD5 and confirm it equals the
     pre-run fingerprint. Also diff the `wpf%` key set before/after to catch any row
     a test newly created (delete the extras the snapshot won't). If anything
     critical changed and didn't restore, raise a LOUD alert with the captured
     original value. Only call the suite "passing" once the fingerprint matches
     again.
   - **If a host genuinely has no write path** (non-Local environment, no bundled
     client, read-only MCP): the bar is the same *plus* you can't even self-heal —
     report the unit suite as a manual step and, if the user runs it, immediately
     re-read the snapshot rows by whatever read path exists so a silent mutation
     doesn't go unnoticed.
   - **Sequencing:** if a dev-site-driving agent (docs/screenshots, runtime
     verifier) is running against the same Local site, let it finish before you run
     the destructive suite — a test mid-mutating an option while the agent
     screenshots is a corrupted-evidence risk.

4. A green checkmark is never worth a broken dev site — confidence you can't get
   safely is confidence you report as "not run," not as passing.

## Notes

- **Portability.** This skill assumes the house conventions shared across these
  plugins: version in `readme.txt` Stable tag, bare-semver tags, `composer`
  quality scripts, a gulp version-sync task, and project-local `.claude/agents`.
  It auto-detects all of these and degrades to "manual step" when something is
  absent, so pointing it at a new plugin needs no setup. Per-plugin config
  overrides are intentionally out of scope for now.
- **Honesty over green.** The value of this skill is catching the thing that
  would have shipped broken or undocumented. Resist the urge to mark things
  green to look finished. A truthful yellow with a clear next step beats a
  hopeful green every time.
