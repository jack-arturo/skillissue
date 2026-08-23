---
name: brand-bible-author
description: Codify a divergent Midjourney exploration + moodboard + voice context into a locked brand bible — `<project>/brand/{identity.md, visual-language.md, reference-pins/}` — that downstream image, packaging, and voice skills can share. Use after a Phase 0 divergent run has surfaced 3–5 winning picks and the operator has held a confirming taste conversation with the artist.
license: MIT
tags: [brand, design, midjourney, brand-bible, music, content-strategy]
agents: [claude-code, codex, autojack]
category: design
metadata:
  version: "0.1.0"
capabilities:
  network: false
  filesystem: readwrite
  tools: [Bash, Read, Write, Edit]
requires-secrets: []
resources:
  - path: story.md
    type: file
  - path: brief-schema.md
    type: file
  - path: outline.md
    type: file
  - path: coherence-check.md
    type: file
  - path: examples/generic-artist.brief.json
    type: file
  - path: bin/coherence-lint
    type: file
  - path: tests/run_all.sh
    type: file
  - path: tests/_lib.py
    type: file
  - path: tests/README.md
    type: file
  - path: tests/validate_locked_bible.py
    type: file
  - path: tests/validate_references.py
    type: file
  - path: tests/validate_schema.py
    type: file
---

# Brand Bible Author

Turn a Phase 0 divergent Midjourney run plus the artist's moodboard, prior released art, and voice references into a two-file brand bible plus a curated reference-pin library. The bible becomes the shared rubric every downstream skill (image production, packaging, voice) reads, so different assets stay coherent across a release campaign.

This skill **assumes the divergent exploration is done** — there are 3–5 winning picks with provenance and short iteration notes. If that has not happened, run divergent exploration first and come back.

## When to use

- An artist has just finished a Phase 0 divergent run (5+ varied prompts, taste-judged) and the operator wants to lock the direction before producing a release campaign of assets.
- The user is starting a multi-asset production effort (cover + selfies + IG + lyric cards + merch) and needs *one* document set the per-asset briefs can share — otherwise every brief reinvents the vocabulary.
- The user has prior released art (a single cover, a music video) and wants to make sure the new direction stays in continuity with what already exists.
- A second artist is being onboarded into a chain that already has a locked bible — same skill, different inputs.

## When NOT to use

- Before a divergent exploration. The skill needs picks + provenance to extract from. If there's nothing locked yet, run `midjourney-iteration` in a divergent shape first (or work outside the skill).
- For a single one-off asset that doesn't need to share vocabulary with anything else.
- For genres or art forms where the bible's MJ-prompt-ready visual contract doesn't apply (pure literary work, music with no visual identity, etc.). The schema is image-first.
- To refresh an existing locked bible. Editing `brand/{identity, visual-language}.md` directly is the right move once the bible exists — the skill is for the **first lock**, not for revisions. (Future versions may add a `--refresh` mode.)

## Prerequisites

- The artist's project folder exists at `<project_dir>` and is preferably a git repo (so the lock commit creates a clean baseline).
- A divergent session at `<divergent_session_path>` containing:
  - `picks.json` with `top_picks[]`, `concepts_tested[]`, and ideally `directions_to_park[]`.
  - Per-round prompt files (`round-*.prompt.txt`) the operator can read for exact MJ params.
  - The actual round screenshots so winning picks can be loaded as images.
- A moodboard directory (strongly recommended) at `<project_dir>/moodboard/` containing prior released art and any reference images the artist anchored on.
- Voice references the operator can articulate (1–3, with one-line "why it lands" each). These can come from the user directly, an in-conversation taste discussion, or AutoMem recall on the project.

## Why a structured author skill instead of a free-form draft

Two failure modes happen reliably when an operator drafts a brand bible solo:

1. **Trusting source labels.** `picks.json` names the directions used during iteration, but the moodboard or released work can reveal another canonical composition. Count modes from all confirmed sources, not only the iteration labels.
2. **Cross-file contradictions.** identity.md's IS-NOT line and visual-language.md's compositions can each be correct in isolation while conflicting together. The skill includes a required **cross-file coherence check** between draft and lock.

See `coherence-check.md` for the contradiction-check prompt.

## Workflow

### 1. Load the brief

Briefs are structured JSON — see `brief-schema.md`. At minimum: `project_dir` (absolute), `divergent_session_path` (absolute, contains `picks.json`). Optional: `moodboard_dir`, `voice_references[]`, `released_art_paths[]`, `iteration_notes_path`.

If the user passed prose, convert to the structured shape first and confirm with them before running.

**Session log location.** Resolve once at the start:

- `<project_dir>/sessions/brand-bible-author/<timestamp>-<slug>/`

The session log captures the friction notes — every taste call the operator made, every surprise from reading the picks vs the prompts, every coherence-check finding. This file is the source material for evolving the skill itself; do not skip it.

### 2. Mechanical extraction (no judgment, just reading)

Read in parallel:

- `<divergent_session_path>/picks.json` — extract `top_picks[]`, `concepts_tested[]`, and `directions_to_park[]`.
- `<divergent_session_path>/round-*.prompt.txt` — for each winning round, regex out `--ar X:Y --s NN --c NN` and any `--style` flag. These are brand defaults if both winning rounds share them.
- `<divergent_session_path>/eval-notes.jsonl` — only as cross-check on dominant miss modes.
- `<moodboard_dir>/*.png` (if provided) — list filenames; do not interpret yet.
- `<iteration_notes_path>` (if provided) — for capturing concise iteration evidence alongside vocabulary decisions.

From this extraction, produce a **mechanical-facts block** — the inputs the operator-decision steps will reference. Do not write it into the bible directly; surface it to the operator first.

### 3. Read winning picks as images (REQUIRED)

Load the top 2 picks from `picks.json` as actual images into context. **Text descriptions of picks lie.** A prompt-target color can render visibly differently; the bible must record the rendered result rather than the hoped-for one.

If the iteration skill produced 4 picks, read at least 2; reading all 4 is preferred. Also read 1–3 moodboard images if a moodboard is provided.

### 4. Discover compositional modes

Count modes from picks **and** moodboard, not just picks. A released cover may establish a canonical composition that the divergent run never named. The bible needs all confirmed modes, not just the iteration outcomes.

Surface to the operator: "I see N compositional modes (list them, each with provenance). Confirm or correct before I draft."

### 5. Operator-decision prompts

Run these in the order below. Each prompts the operator for a taste call that cannot be auto-derived from the picks. Skipping any of these produces a generic bible.

a. **Persona one-liner.** "In 2–3 sentences, what does this artist *do* and what would they refuse to do?"

b. **Satirical / sincere premise.** "Is the persona ironic, sincere, satirical, or layered? If layered, articulate the layers."

c. **Voice references (1–3, max).** "List 1–3 reference artists/tracks/aesthetics with a one-line *why it lands* each. Mark which is thesis-match vs visual-match vs vocabulary-match."

d. **Audience.** "Primary audience (one bullet). Secondary audience (one bullet). Not-the-audience (one bullet)."

e. **Do-not-cross lines.** "What thematic or visual material is off for this artist? The skill enforces a minimum of 3 lines; add more if needed."

f. **Palette hexes — prompt target AND as-rendered.** For each signature color, the operator looks at the picks and answers: "what hex does MJ actually produce when it hits?" These will both go into the visual-language.md palette table; never elide the divergence.

### 6. Draft identity.md

Use `outline.md` § "identity.md skeleton". Target ~600 words. Required sections:

- Header (version, provenance one-liner)
- Persona one-line
- Premise (the satirical/sincere/layered framing from step 5b)
- Voice references table (1–3 rows)
- What the artist IS (bulleted)
- What the artist IS NOT (bulleted — anchor the genre/aesthetic ban here)
- Audience
- Tone register (the irony layers if applicable)
- Do-not-cross lines
- Continuity-check tests (3 quick tests for any future brief)

### 7. Draft visual-language.md

Use `outline.md` § "visual-language.md skeleton". Target ~1200 words. Required sections:

1. Palette table — prompt-target hex + as-rendered descriptor + provenance
2. Signature compositions (one § per mode discovered in step 4) — composition rules, sub-modes if any, MJ failure modes documented
3. Banned vocabulary (with evidence from the picks, moodboard, or iteration notes)
4. Preferred vocabulary substitutions
5. Aspect ratios per asset type
6. MJ defaults for the brand (`--ar`, `--s`, `--c`, `--v`, raw-vs-default)
7. Reference-pin index (filenames mapped to source + what each confirms)
8. When to update this file + changelog

### 8. Build reference-pins/

Copy each `picks.json.top_picks[i].path` to `<project_dir>/brand/reference-pins/pick-NN-<slugified-note>.png`. Slug from the pick's `note` field, kebab-case.

Copy moodboard files to `<project_dir>/brand/reference-pins/mood-NN-<filename-derived-slug>.png`. The operator should rename the slug if filename-derived doesn't read clearly.

Filenames are stable once written — downstream skills resolve refs by exact filename. Do not rename after lock.

### 9. Cross-file coherence check (REQUIRED before lock)

This step is load-bearing. See `coherence-check.md` for the full prompt. Concretely:

- Read every IS-NOT bullet in identity.md.
- Read every Composition section in visual-language.md AND every reference-pin filename.
- For each IS-NOT bullet, ask: "could any word in this bullet plausibly describe an asset the bible includes?"
- Surface every flag to the operator. Reconcile before lock.

Register-vs-medium distinctions are the most common failure mode: banning a feeling is different from banning a prop. Reconcile those conflicts explicitly at this step.

### 10. Lock and commit

- Set version to `1.0` in both files. (Refreshing an existing locked bible is out of scope — see "When NOT to use".)
- Append a changelog line in visual-language.md.
- Write the friction notes to `<session-log-dir>/notes.md` covering: inputs used, surprises, taste-judgment moments, mechanical extractions performed, coherence-check findings.
- If `<project_dir>` is a git repo, the operator commits the bible. The skill does NOT auto-commit — the lock is a deliberate human moment.

## Output

Return a concise summary to the user:

- The two files written (`brand/identity.md`, `brand/visual-language.md`) with word counts.
- Reference-pin count and rename map.
- Coherence-check findings: contradictions reconciled vs none.
- Pointer to the session-log directory for the friction notes.
- A "ready to lock" or "needs another pass" verdict.

## Anti-patterns

- Do **not** draft from picks.json alone. Read the actual winning images. Text descriptions of picks lie about palette and register.
- Do **not** trust the source naming for compositional modes. Count modes from picks AND moodboard; the released-art canonical comp is often missing from the iteration outcomes.
- Do **not** skip the cross-file coherence check. It is the only step that catches contradictions between identity.md's IS-NOT and visual-language.md's compositions/refs.
- Do **not** auto-commit the lock. The bible commit is the deliberate human moment that creates the baseline downstream skills will reference. The operator should review the diff and write the message.
- Do **not** bake brand-specific vocabulary into the skill files. A worked example is not a template; the skill must produce a coherent bible for a different artist without forcing them into the same shape.
- Do **not** add irony-layer tone register if the artist is sincere. Schema offers it as an optional section.
- Do **not** rename reference-pins after lock. Downstream skills resolve refs by exact filename; rename breaks every brief that referenced the old name.
- Do **not** elide as-rendered palette divergence. Record both the prompt target and observed output when they differ.

## Tests and benchmarks

This skill ships deterministic regression coverage. Run after editing `SKILL.md`,
`brief-schema.md`, `outline.md`, or any locked bible.

**Tier 1 — static contract validators** (`tests/run_all.sh`, <2s):
- Schema validity for every `examples/*.brief.json`.
- Reference integrity: every backtick-wrapped relative path in `SKILL.md` resolves.
- Locked-bible structure: required H2 sections, IS-NOT and do-not-cross bullet
  counts vs brief constraints, reference-pin filenames present on disk.

```bash
bash tests/run_all.sh --project /path/to/artist --brief examples/<brief>.json
```

**Tier 2 — coherence partial-check** (`bin/coherence-lint`, on-demand):
Tokenizes IS-NOT bullets from `identity.md`, locates each in `visual-language.md`,
applies intentional-vocabulary filters (§3 banned, §4 preferred, Changelog,
backtick-quoted declarations), and reports the remainder as candidate
contradictions for human review. Exit code is always 0 — flags are not failures.

```bash
bin/coherence-lint /path/to/artist/brand/
```

The coherence linter can report generic-English overlap. Treat its output as a
review queue; compare a revised bible with its own prior run rather than aiming
for zero flags.

**Tier 3 — behavioral-quality benchmarks**: deferred. Tier 1+2 catches the
contract-drift regressions we've seen. LLM-judge benchmarks earn their token
cost only after we have enough revision history to see Tier 1+2 miss something.

Operators can invoke the Tier 1 validators and Tier 2 linter directly.
