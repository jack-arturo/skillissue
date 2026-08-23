# Cross-file coherence check — between draft and lock

This is a **required** step in the brand-bible-author workflow (SKILL.md §9). Skipping it produces bibles that ship contradictions a solo author would not catch reading either file alone.

## Why this step exists

When the operator drafts identity.md and visual-language.md, each file gets reviewed in isolation. identity.md gets read for "does the persona feel right?" and visual-language.md gets read for "do the compositions match the picks?" — each pass succeeds.

The contradictions live **between** the files, in places where words used in identity.md's IS-NOT line could plausibly describe an asset visual-language.md includes. The most common shape:

> identity.md IS-NOT bans `cute, kawaii, candy-coded`. visual-language.md Composition 2A's reference imagery is unambiguously cute-coded (frilly dress, pink bows). The bible contradicts itself.

A solo author misses this because they wrote both files; the words feel consistent in their head. A reviewer pass forces the read **across** the files.

## The procedure

Run after drafts of both files exist and reference-pins are written. Before lock.

### Step 1 — Enumerate the IS-NOT bullets

From identity.md, list every IS-NOT bullet verbatim. For example:

```
- Genuinely fragile or asking for sympathy
- Cute, kawaii, or candy-coded
- A horror character or villain
- Vaporwave, lofi, or chillwave
- A literal Y2K throwback
- A real artist on a real meltdown
```

### Step 2 — Enumerate visual elements

From visual-language.md, list every:

- Composition section heading + the key visual elements named in its rules.
- Reference-pin filename (the slugs are descriptive: `mood-02-topdown-body-pink-milk-a.png` is a visual claim).
- Banned-vocabulary entry (these are intended-to-conflict by design — they're the artist's negative space).
- Preferred-vocabulary entry (these are intended-to-affirm by design — explicit positive vocabulary).

### Step 3 — For each IS-NOT bullet, ask the contradiction question

> Could any word in this IS-NOT bullet plausibly describe an asset, composition, or reference-pin in visual-language.md?

If yes, you have a candidate contradiction. Examples of the shape:

| IS-NOT bullet | Visual element | Contradiction? |
|---|---|---|
| "cute, kawaii, candy-coded" | `mood-02-topdown-body-pink-milk-a.png` shows pink frilly dress, bows | **Yes** — the moodboard ref is cute-coded |
| "vaporwave, lofi, chillwave" | Composition 2C palette is `magenta strobe, BLOWN HIGHLIGHTS` | No — magenta strobe is loud, not retro-quiet |
| "horror character or villain" | smashed-luxury still-life, broken iPhone | No — wreckage is bratty, not threatening |

### Step 4 — Reconcile each candidate contradiction

Three resolutions, in priority order:

a. **Register-vs-medium clarification.** The most common resolution. The IS-NOT is banning a *register* (cute as a *feeling/tone*) but the visual element is a *medium* (a frilly dress as a *garment*). Patch identity.md IS-NOT to make the distinction explicit:

> "Cute, kawaii, or candy-coded *in register*. Girly *garments* (frills, pink bows, ribbon dresses) are fair game when paired with deadpan affect or destruction props — they read as flex, not as twee."

This is one acceptable resolution pattern.

b. **Drop the visual element.** If the IS-NOT is actually load-bearing and the visual element shouldn't be in the bible, remove the reference-pin or the composition rule. Common when moodboard refs are pre-brand-lock and should age out.

c. **Drop the IS-NOT bullet.** If the contradiction reveals that the IS-NOT was over-broad and the artist actually does want the thing, narrow the IS-NOT or remove it.

In all three resolutions, **patch both files in the same review pass and bump the version**. The bible's invariant is that identity.md and visual-language.md must agree at every locked version.

### Step 5 — Surface the review-pass result to the operator

Output to the operator:

```
Coherence check: <N candidates flagged>, <M reconciled>, <K none-found>.

Patches applied:
- identity.md IS-NOT bullet on "cute" expanded to register-vs-garment distinction
- visual-language.md §2A wardrobe rule added (operator-decision per brief, neutral nouns only)
- visual-language.md §3 banned-vocab "cute" row expanded with twee/sweet/soft/innocent

Version bumped to 1.1.
Ready to lock.
```

If candidates were flagged but the operator deferred reconciliation, lock at the prior version with a `## Open contradictions` section appended to both files. Do not silently lock with known contradictions.

## Other common contradiction shapes

Register-vs-medium is common in satirical or layered artists, but other shapes show up too. Watch for:

- **Genre-vs-instrumentation.** "We're not folk" + an instrument list with banjo/dulcimer. The genre ban is about lineage and audience; the instrument may still serve a non-folk arrangement. Resolve like register-vs-medium.
- **Era-vs-aesthetic.** "Not a Y2K throwback" + visual language full of 2002 codes. The era ban is about nostalgia register; the codes may be in service of a 2026 satirical reading. Clarify in IS-NOT.
- **Audience-vs-tone.** Audience says "people fluent in irony"; tone register is sincere-flat. One of them is miscast — usually the audience description is the one that drifted in drafting.

If none of these shapes match, name the new shape in the friction notes — it's a finding worth carrying back into the skill on the next revision.

## Why register-vs-medium contradictions are the most common

Operator-authors think in feelings ("the brand is not *cute*") and codify them as IS-NOT bullets. They think in props ("the moodboard has frilly dresses") and codify them as visual references. These two mental models live in different working memory and routinely produce statements that contradict each other when read in pair.

The check exists to force the read in pair before any downstream skill consumes the bible.

## What this step does NOT cover

- Internal consistency within identity.md (one IS-NOT bullet contradicting another). That's a single-file proofread, separate concern.
- Internal consistency within visual-language.md (Composition 2A rule contradicting Composition 2B rule). Also single-file.
- Voice-vs-visual consistency (e.g., voice references suggest a tone the visual language doesn't render). Worth flagging as a separate review pass; not in scope here.

The cross-file coherence check is **only** for IS-NOT bullets vs visual elements. That's where the contradictions cluster, and a focused pass catches them reliably.
