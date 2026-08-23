# Coupling check

Before deleting a rule from a prompt, find out what depends on it. Prompt text
is frequently load-bearing without anything saying so.

## Search patterns

```bash
# Validators / scanners that inspect model output
grep -rn "validate\|violation\|integrity" src/ --include=*.js | head

# Parsers that expect a specific output shape
grep -rn "JSON.parse\|match(/\|FENCED" src/ | head

# Tests asserting on prompt strings — the ones that catch you
grep -rn "assert.*prompt\|toMatch(/.*prompt" test/ | head

# Sanitizers that may discard what the prompt asks for
grep -rn "replace(/<" src/ | head
```

Also read the git history for the rule. A commit that added it usually names the
incident, and a *later* commit may have patched a regression the rule caused.

## Verdict table

| Finding | Verdict | Action |
|---|---|---|
| A validator, parser, or harness branch depends on the behavior | **Load-bearing** | Keep the substance. Rewrite the framing as a fact about the system. |
| Only the output *shape* matters | **Format contract** | Move it into the JSON schema, enum, or tool description. Interfaces beat prose. |
| Nothing reads it; no incident behind it | **Residue** | Delete. |
| A test asserts the exact wording | **Spec** | Satisfy the test, or change the test deliberately in the same commit — never loosen an assertion just to make a rewrite pass. |

## Claims worth verifying rather than preserving

Prompts accumulate assertions about the harness that were true once, or never.
Check each before carrying it forward:

- "Your output will not be delivered unless you call X" — look for a fallback path. If one exists, the claim is false and the real reasons to call X are better arguments anyway.
- A required reasoning format — check whether a sanitizer strips those blocks before delivery. If so, the instruction costs prompt tokens *and* output tokens for text nobody sees.
- A mandated multi-step sequence — check whether the harness already performs those steps. Two sources of truth for one procedure will eventually contradict each other, and the prompt is the one that goes stale.

## Contradiction sweep

Render the fully composed prompt and read it end to end. Sections assembled from
different files can disagree — one telling the model to run a command another
forbids. Composition hides this; rendering reveals it.
