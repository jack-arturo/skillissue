# File outlines — identity.md and visual-language.md skeletons

These are the required-section skeletons the skill drafts against. Order matters — downstream skills read the bible top-to-bottom and depend on this layout.

Word-count targets are soft; treat them as anti-bloat hints, not hard limits.

---

## identity.md skeleton (~600 words)

```markdown
# <artist-name> — identity

**Version:** 1.0 (locked YYYY-MM-DD)
**Provenance:** <one-line: divergent run path + released art anchor + voice-ref triangulation source>

This file is the persona/voice contract. The visual language is in `visual-language.md`. Both must agree before any new asset is briefed.

---

## Persona — one line

**<one-sentence persona statement that captures the satirical/sincere/layered framing>**

## The premise — <descriptor like "satirical performative grief" or "earnest folk romanticism">

<2–4 paragraph bullets describing the premise, what the character commits to, and the audience contract. Concrete props, specific behaviors, not abstractions.>

## Voice references (N max, default 3)

| Reference | Why it lands |
|---|---|
| <Artist — Track / Era> | <one-line justification> |
| ... | ... |

## What <artist> IS

<5–7 bullets, each concrete and specific. Name observable choices rather than broad mood labels.>

## What <artist> IS NOT

<5–8 bullets covering the genre/aesthetic boundary. State the scope precisely when a broad tone restriction still permits a narrow visual technique.>

## Audience

- **Primary:** <one bullet>
- **Secondary:** <one bullet>
- **Not the audience:** <one bullet, the explicit alienation by design>

## Tone register

<Pick the shape that fits. Don't include both.>

**If brief.irony_layers === true (layered/satirical artists):**

```
## Tone register — the irony layers

<artist> operates across N deliberate interpretive layers, and the tension between them is the brand:

1. **Surface (sincere):** "..."
2. **Mid (knowing):** "..."
3. **Meta (the satire):** "..."

Briefs and lyrics should always carry at least N of these layers. <Threshold rule, e.g., "two or more = the brand">
```

**If brief.irony_layers === false (sincere artists):**

```
## Tone register

<One paragraph describing the artist's tone register. Be concrete about emotional weather, voice texture, distance to listener, and commitment level. Anchor every claim to the supplied voice references.>

Briefs and lyrics should match this register; deviations need a deliberate reason.
```

## Do-not-cross lines

<At least min_do_not_cross_lines bullets. Each line names a thematic/visual category and one sentence of why.>

- **No <category>.** <Why>
- **No <category>.** <Why>
- **No <category>.** <Why>

## Audience does-not-care list (optional, suppress for the brand)

<Things the artist will never discuss because they break character or aren't on-register. 4–6 bullets.>

---

## Continuity check before any new brief

Three quick tests before approving an image or lyric brief:

1. **<Test 1 derived from premise>** — e.g., "Two-layer test: does the asset operate on at least two of the three irony levels?"
2. **Specificity test.** Could this brief describe any artist in the genre, or only this artist? Specific props anchor the brand.
3. **Do-not-cross test.** Does the brief flirt with any do-not-cross line? If yes, rewrite or kill.

If a brief fails any test, do not generate. Send back with notes.
```

---

## visual-language.md skeleton (~1200 words)

```markdown
# <artist-name> — visual language

**Version:** 1.0 (locked YYYY-MM-DD)
**Provenance:** <released art + moodboard refs + divergent run path + N rounds, M hits, K winning picks>

This file is the **MJ-prompt-ready** visual contract. `identity.md` is the persona; this is how the persona looks. Both must agree before any new asset is briefed.

---

## 1. Palette

The brand has a **prompt-target palette** (what we tell MJ) and an **as-rendered palette** (what MJ actually produces when it hits). Both are recorded — the rendered colors are what the brand actually looks like.

| Role | Prompt target | As-rendered (hit) | Provenance |
|---|---|---|---|
| <role> | `#HEX` | <descriptor + range> | <round/pick/source> |
| ... | ... | ... | ... |

**Key palette rule:** <one-line palette failure mode that auto-mismarks a round>.

## 2. <N> signature compositions

Every brand-authentic asset extends one of these <N>. Don't invent a new mode without a divergent run.

### 2A. <Composition name>

**Origin:** <released cover / divergent run round / moodboard ref>. <Status: confirmed by hits, or pending a clean MJ hit.>

**Composition rules:**
- <camera/angle>
- <subject>
- <key visual element>
- <secondary elements>
- <mood>
- <wardrobe — if relevant; describe the observable garment, material, and silhouette without treating a broad mood label as a rule>

**Iteration evidence:** <list concise notes from iteration_notes_path, if supplied>.

### 2B. <Composition name>

<same shape as 2A>

### 2C. <Composition name>

<same shape as 2A>

## 3. Banned vocabulary (with provenance)

These phrases push MJ toward off-brand output. Push to `--no` in every brief and avoid in the positive prompt.

| Banned phrase | Pushes the result toward | Evidence |
|---|---|---|
| `<phrase>` | <off-brand direction> | <pick, moodboard, or iteration note> |
| ... | ... | ... |

## 4. Preferred vocabulary (replacements)

When the brief touches a banned territory, use these substitutions instead.

| Banned territory | Substitute vocabulary |
|---|---|
| <category> | `<replacement phrases>` |
| ... | ... |

## 5. Aspect ratios per asset type

| Asset type | `--ar` | Notes |
|---|---|---|
| Single cover art | `1:1` | <notes> |
| IG story / reel | `9:16` | <notes> |
| IG feed (non-square) | `4:5` | <notes> |
| Music video still | `16:9` | <notes> |
| Press / EPK | `4:5` or `3:4` | <notes> |
| Merch print | `1:1` | <notes> |

## 6. MJ defaults for the brand

<Pull from divergent winning prompts. If both winning rounds shared --s NN --c MM, those are brand defaults.>

| Flag | Value | Why |
|---|---|---|
| `--s` (stylize) | `NN` | <reasoning> |
| `--c` (chaos) | `MM` | <reasoning> |
| `--ar` | `<default>` | <reasoning> |
| `--style raw` | <default or NOT default> | <reasoning> |
| Version | `--v X` | <as of date> |

## 7. Reference-pin index

`reference-pins/` contains curated copies of the winning picks and the moodboard images. Filenames are stable; do not rename.

| File | Source | What it confirms |
|---|---|---|
| `pick-NN-<slug>.png` | <session>/round-X/img_Y.png | <comp + key element> |
| `mood-NN-<slug>.png` | <moodboard original> | <what it anchors> |
| ... | ... | ... |

## 8. When to update this file

Bump the version and append a "Changes" log line at the bottom whenever:

- New iteration evidence changes a confirmed visual rule.
- A new signature composition is confirmed by a divergent run.
- The palette evolves (new color hits, backdrop variant locks).
- A vocabulary trigger is discovered that wasn't in the prior version.

Do **not** update for one-off iteration findings that haven't been confirmed across at least two separate hits. Specificity is the value here; noise dilutes the contract.

---

## Changelog

- **1.0** (YYYY-MM-DD) — Initial lock. <One-paragraph summary of what's confirmed and what's pending.>
```

---

## Notes on filling the skeletons

- **Voice references vary in count.** Don't pad to 3 if 1 is the honest answer. Don't truncate to 3 if 5 are equally load-bearing — the brief's `max_voice_references` is the cap, but the operator can override on a per-bible basis with a note in the file.
- **Compositional modes vary in count.** A focused brand might have one; another may have several. Cover modes with a confirmed hit or a canonical released-art/moodboard reference.
- **The "as-rendered" palette column is mandatory.** Record both the prompt target and observed output. When they differ, the observed output is the downstream visual truth.
- **Banned vocabulary should cite evidence.** Identify whether a ban came from a pick, moodboard reference, iteration note, or operator decision. This keeps later editors from treating a temporary miss as a permanent rule.
- **Aspect ratios per asset type** should be explicit enough that a later asset brief can use the correct dimensions without guessing.
