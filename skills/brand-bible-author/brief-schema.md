# Brief schema — brand-bible-author

Briefs are JSON. The skill normalizes any partial brief by filling defaults, but `project_dir` and `divergent_session_path` are required. Pass a brief by path (`brief.json`) or inline.

## Full schema

```jsonc
{
  "title": "string (required) — short human-readable name; used to slug the session-log dir (e.g., 'artist-phase-0-lock')",

  "project_dir": "string (required) — absolute path to the artist's project folder. The bible is written to <project_dir>/brand/{identity.md, visual-language.md, reference-pins/}. The session log is written to <project_dir>/sessions/brand-bible-author/<timestamp>-<slug>/notes.md.",

  "divergent_session_path": "string (required) — absolute path to a Phase 0 divergent run directory. Must contain picks.json with top_picks[], concepts_tested[], refine_patterns_observed[], and ideally directions_to_park[]; per-round prompt files (round-*.prompt.txt); and the round screenshots referenced from picks.json[].path.",

  "moodboard_dir": "string (optional but strongly recommended) — absolute path to a directory of moodboard reference images. Required when the artist has prior released material — the skill counts compositional modes from picks AND moodboard, and the released-art canonical comp is often visible only in the moodboard.",

  "released_art_paths": [
    "string — absolute path to a piece of prior released art (single cover, music video still, official press shot). The skill anchors the bible to the released material so the new direction stays in continuity. If no prior released art, omit this field — the bible will lock from the divergent run + moodboard alone."
  ],

  "voice_references": [
    {
      "reference": "string — a track, artist, or aesthetic the operator considers a thesis match",
      "why_it_lands": "string — one-line justification for the match",
      "kind": "thesis | visual | vocabulary"
    }
  ],

  "iteration_skill_refine_patterns_path": "string (optional) — absolute path to a refine-patterns.md file. When provided, the bible's banned-vocabulary table cross-links entries to their source pattern.",

  "max_voice_references": 3,        // optional, default 3; hard cap

  "irony_layers": "boolean (optional, default false) — when true, identity.md includes a tone-register section listing articulated irony layers. When false, identity.md uses a flat tone description.",

  "audience_required": true,        // optional, default true; require primary/secondary/not-the-audience

  "min_do_not_cross_lines": 3,      // optional, default 3; minimum number of do-not-cross bullets

  "notes": "string (optional) — free-form notes the operator wants on the run (e.g., 'this artist has a single released cover; anchor heavily to it')."
}
```

## Field semantics

### Required pair: `project_dir`, `divergent_session_path`

These are the load-bearing inputs. If either is absent the orchestrator stops and asks for it before running.

- `project_dir` → where the bible is written.
- `divergent_session_path` → where the picks come from.

### `moodboard_dir`

Optional but strongly recommended. The skill reads filenames AND can read 1–3 representative images into context to verify mental model. Required for any artist with prior released material — the released-art canonical composition is often visible only in the moodboard, not in the divergent run.

### `released_art_paths`

When provided, the bible includes a "Provenance" line in both files that names the released art as a brand anchor, and `reference-pins/` includes a `mood-01-released-<title>.png` entry. When absent, the bible locks from divergent + moodboard alone.

### `voice_references`

1–3 entries (capped by `max_voice_references`). Each entry is an object with `reference`, `why_it_lands`, and `kind`. The skill puts these into a table in identity.md so future operators can re-test fit. The operator must provide these — they cannot be auto-derived from picks. Memory recall on the project slug is a good way to surface candidates the user has previously tagged.

### `iteration_skill_refine_patterns_path`

When set, the banned-vocabulary table in visual-language.md cross-links each entry to its source refine-pattern (e.g., `content-drift-occult`, `style-drift-altrock-cinema`). This makes the bible legible to future operators who haven't read the iteration history.

### `irony_layers`

Set `true` only if the operator can articulate distinct irony layers. For sincere artists, leave `false` and identity.md uses a flat tone description.

### `audience_required`

Default true. The audience section is load-bearing for downstream voice/caption skills — they need to know who's listening to write captions on-register. If you genuinely cannot describe the audience yet, set false and the bible omits the section, but plan to add it before the first caption-author run.

### `min_do_not_cross_lines`

Default 3. The do-not-cross lines are load-bearing for content safety in downstream skills — at least 3 forces the operator to articulate boundaries explicitly. Common categories: real distress imagery, audience mocking, real-brand defamation, occult coding, sexualized imagery.

## Minimal valid brief

```json
{
  "title": "Locked direction for new artist",
  "project_dir": "/path/to/artist-project",
  "divergent_session_path": "/path/to/artist-project/sessions/midjourney-iteration/phase-0"
}
```

This minimal brief will run, but the skill will prompt the operator inline for voice references, audience, and do-not-cross lines because those are required for the bible. The recommendation is to fill them in the brief upfront.

## Examples

See `examples/generic-artist.brief.json` for a complete generic brief.
