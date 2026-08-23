# brand-bible-author tests

Tier-1 static contract validators. Run on every edit to `SKILL.md`,
`brief-schema.md`, `outline.md`, or to a locked bible's `identity.md` /
`visual-language.md`.

Wall-clock target: under 2 seconds on canonical inputs.

## Run

```bash
# Full run (validates schema, references, and a locked bible)
bash tests/run_all.sh \
  --project /path/to/artist \
  --brief examples/generic-artist.brief.json

# Just schema + references (skips locked-bible check; useful in CI without artist projects)
bash tests/run_all.sh

# Machine-readable output for an agent or pipeline
bash tests/run_all.sh --project /path/to/artist --json
```

Returns `0` on pass, `1` on any failure.

## What each check covers

| File | Checks | Triggered by |
|---|---|---|
| `validate_schema.py` | Every `examples/*.brief.json` validates against the JSON Schema in `_lib.py:BRIEF_SCHEMA`. Required fields present, types match, `voice_references[].kind` is one of the enum. | Edit to `brief-schema.md` or any example brief. |
| `validate_references.py` | Every backtick-wrapped relative reference in `SKILL.md` (sibling `.md` files, `examples/...`, `bin/...`, `tests/...`) resolves to an existing file. | Rename, move, or remove a file the SKILL.md prose points at. |
| `validate_locked_bible.py` | A locked bible at `<project>/brand/` has the required H2 sections in `identity.md`, the §§ 1–8 in `visual-language.md`, satisfies brief constraints (`min_do_not_cross_lines`, `max_voice_references`), and every `pick-NN-*.png` / `mood-NN-*.png` referenced exists in `reference-pins/`. | Edit to a locked bible after authoring. |

## Add a check

1. Write `tests/<my_check>.py` using `_lib.emit()` to format output (supports `--json`).
2. Add a `run_check` line to `tests/run_all.sh`.
3. Document its trigger in this README.

The `_lib.py` schema dict mirrors `brief-schema.md` by hand. If the schema doc evolves, update both — the validator does NOT auto-derive the schema from prose.

## What this layer does NOT cover

- **Behavioral quality.** A bible could pass all checks and still be a worse bible than v1.0. That's Tier 3 (LLM-judge benchmarks) and is deferred.
- **Cross-file coherence.** That's `bin/coherence-lint` (Tier 2) — not part of `run_all.sh`. Run it explicitly:
  ```bash
  bin/coherence-lint /path/to/artist/brand/
  ```
  Treat output as **candidate flags for human review**, not auto-failures. The
  Generic English nouns can produce candidate flags when IS-NOT bullets overlap
  with visual-language.md. A real regression looks like a new unexpected token;
  compare with the previous run, not zero.
- **Multi-artist regression.** The locked-bible check takes `--project`. When a second artist ships, run it against both projects.
