---
name: context-engineering-audit
description: Audit and cut what an agent loads before the user types — system prompts, CLAUDE.md/AGENTS.md, skill and tool descriptions. Use before trimming any instruction file, or after a model-generation change makes old prompt scaffolding counterproductive.
license: MIT
tags: [context-engineering, prompts, claude-code, agents, audit]
agents: [codex]
category: workflow
metadata:
  version: "1.0.0"
capabilities:
  network: false
  filesystem: readwrite
  tools: [Read, Edit, Bash, Grep]
resources:
  - path: story.md
    type: file
  - path: references/measuring.md
    type: file
  - path: references/coupling-check.md
    type: file
  - path: references/rewrite-patterns.md
    type: file
---

# Context Engineering Audit

Every agent session pays for its instructions before the user types a word. This
skill is a method for finding out what that costs, what it buys, and what to cut.

The order matters. Measuring before cutting keeps you honest about where the
tokens actually are; the coupling check keeps you from deleting a constraint
something depends on. Skip step 3 and you will eventually delete a rule that a
validator, a parser, or a test was relying on.

## 1. Measure before you cut

Get real numbers per injection source rather than guessing from file sizes.
Sources usually rank: the imported instruction file, the skill listing (every
skill's frontmatter description, always loaded), the global instruction file,
deferred tool names, the agent listing, MCP server instruction blocks, hook
output.

See `references/measuring.md` for where each lives and how to count it,
including reading the session transcript's attachment records.

Record the total. A restructure that doesn't move it is a restructure you can
skip.

## 2. Classify every section into four buckets

- **Gotcha** — non-obvious, expensive to rediscover, cheap to state. Keep upfront. ("Tags are a hard gate: they filter before scoring." "stdout is reserved for the MCP protocol.")
- **Runbook** — needed by a minority of sessions, in full when needed. Move to a doc or skill and link it.
- **Restates the tree** — a table of paths that a directory listing already shows. Delete.
- **Duplicate** — the same instruction in a second place. Pick one home.

The tell for a runbook is a command sequence. The tell for a duplicate is that
you've read it twice in one file.

## 3. Coupling-check before deleting anything

This is the step that pays for the skill. Prompt text is often load-bearing in
ways nothing documents.

Before cutting a rule, search for code that depends on it: response validators,
output parsers, harness branches, and tests asserting on prompt strings. Then
give each rule a verdict — load-bearing (keep the substance, change the
framing), format contract (move it into the schema or tool description), or
residue (delete).

Two failure modes worth knowing, both real:

- A prompt asserting something the harness doesn't actually do ("your work will not be delivered unless you call X" — when a fallback path exists). Fix the claim, don't preserve it.
- A prompt whose output is discarded downstream. Reasoning scaffolds are the usual case: check whether a sanitizer strips the very blocks you're asking for.

`references/coupling-check.md` has the search patterns and the verdict table.

## 4. Rewrite coercion as product-context facts

On current model generations, exhaustive prohibitions cost quality rather than
buying it. State what the system does and let the model reason.

> "CRITICAL: These tools are NOT optional. Your work will not be delivered!"
>
> becomes
>
> "The user sees your `present_result` payload — summary condensed for chat,
> content attached as a file. Exit without it and the harness falls back to
> condensing your raw final message."

Keep every constraint that survived step 3. Change only the register.
More before/after pairs in `references/rewrite-patterns.md`.

## 5. Add drift guards, then verify

Instruction files regrow. A size budget and an imperative-word budget as
ordinary tests will catch it:

```js
assert.ok(composed.length <= BUDGET, `${composed.length} chars, budget ${BUDGET}`);
assert.ok((text.match(/\b(NEVER|ALWAYS|MUST|CRITICAL|MANDATORY)\b/g) || []).length <= N);
```

Set the ceiling just above where you landed, with a comment on what earned the
headroom. **Watch the floor too:** cached prompt prefixes have a minimum below
which they silently stop caching, so cutting past it trades a small token saving
for a cache miss on every turn.

Verify with `/context` in a fresh session before and after, and re-run the
suites that touch prompt assembly.

## Notes from practice

- Rule density is often lowest in the files people suspect first. Measure imperatives per 1k chars before assuming an instruction file is the problem — the offender is frequently a plugin or a runtime prompt nobody reads.
- A repo's own history can tell you whether coercion worked. Commits that fix "the model hesitated" or "the model looped" are usually patching damage an earlier absolute rule caused.
- Moving content beats deleting it when a prior finding says a model generation still wants the structure. Progressive disclosure is generation-neutral; rule-density rewrites are not.
