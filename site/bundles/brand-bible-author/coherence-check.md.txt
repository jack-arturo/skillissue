# Cross-file coherence check — before the first lock

Run this required review after drafting both `identity.md` and
`visual-language.md`, before setting the first locked version. It checks the
places where a restriction in one file can quietly contradict a rule or
reference in the other.

## Procedure

1. Copy every bullet from the `What <artist> IS NOT` section into a review
   list.
2. List the visual-language composition rules, reference-pin filenames, banned
   vocabulary, and preferred vocabulary.
3. For each restriction, ask: could this description also apply to a proposed
   composition, visual element, or reference pin?
4. Record every plausible conflict for operator review. The check surfaces
   candidates; it does not decide taste.

## Generic example

| Restriction | Visual rule | Candidate conflict? |
| --- | --- | --- |
| "Avoid nostalgic styling" | "Use era-specific props" | Yes — define whether the props are reference material or a visual requirement. |
| "Avoid high-contrast scenes" | "Use a dark subject against a bright background" | Yes — clarify the intended contrast range. |
| "Avoid literal storytelling" | "Show a named narrative event" | Yes — keep the scene abstract or narrow the restriction. |

## Resolve candidates

For each real contradiction, choose one explicit outcome:

- Clarify scope: distinguish a broad tone restriction from a narrowly permitted
  visual technique.
- Remove or change the visual rule/reference if the restriction is
  load-bearing.
- Narrow or remove the restriction if the visual direction is the actual
  decision.

Patch both files in the same review pass and bump the version. Do not lock a
known contradiction without documenting it as an open decision in both files.

## Report format

```text
Coherence check: <candidates flagged>, <reconciled>, <open>.

Changes:
- <identity restriction clarified or changed>
- <visual rule or reference changed>

Lock status: ready / needs operator decision.
```

This check is only for cross-file conflicts. Proofread the individual files and
run the deterministic linter separately.
