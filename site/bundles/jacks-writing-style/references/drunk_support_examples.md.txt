# drunk.support Technical-Arc Blog Posts

Long-form first-person technical writing from Jack's personal blog. Use as the model for any technical post that's *not* a year-end retrospective — product launches, workflow writeups, deep dives, postmortems.

Source posts these patterns are drawn from:

- "Introducing AutoVault" (May 13, 2026)
- "Three AI Reviewers Per Commit (And Why That's Not Overkill)" (May 2, 2026)

---

## The Arc Template

Every long-form technical post on drunk.support follows roughly this shape:

```
1. Hook — single sentence or short paragraph, often opens with "I made a thing"
   or "People keep asking..."
2. TL;DR / short version — numbered list or 3–5 line summary
3. Backstory — how the problem found you, who else was working on it,
   why the existing solutions weren't enough
4. The dead end — what you tried first that didn't work
5. The pivot — the actual insight, often a single short paragraph
6. How it works — diagrams, code, real implementation
7. The numbers / research backing it — papers, benchmarks, your own metrics
8. What's working / what isn't / what's next — usually three explicit subheads
9. Caveats — pre-emptive honesty about the state of the thing
10. Install / CTA / next steps (if a product)
11. "— Jack" sign-off (em dash + name, lowercase)
```

The strict structure isn't strict — sections 4 and 5 sometimes collapse, the
research backing in section 7 sometimes leads instead — but the *arc* (hook →
backstory → dead end → pivot → state of the thing → honest caveats → sign-off)
is consistent.

---

## Openers That Work

### The "I made a thing" opener

```markdown
I made a thing last week. It's called [AutoVault](https://autovault.dev).

It's a framework for managing `SKILL.md` files, without slowly turning your
agent setup into a junk drawer.

It's got a lot of configurability under the hood (keep scrolling), but for
most folks it's pretty simple:

1. [Install it](https://autovault.dev/quick-start)
2. AutoVault creates a folder on your system at `~/.autovault/`
3. It asks if you want to import your existing skills
4. Now all your skills are in one place
5. (optional) Make a git repo out of it, and track skill changes over time.

**That's the short version.**

The technical backstory began in late 2025.
```

**Pattern:** Drop-in claim → product link → one-line value prop → unforced
"keep scrolling" aside → numbered TL;DR → bolded transition → segue into backstory.

### The "People keep asking..." opener

```markdown
People keep asking about my coding setup on Slack and in GitHub comments
— specifically the bit where every commit gets reviewed by three different
AI models before any human sees the PR. Time to actually write it down.

The short version:

1. Plan and implement with [Claude Code](https://...) *or* [Codex CLI](https://...)
2. Force a local CLI review with the *other* one before commit ever hits GitHub
3. Let [GitHub Copilot](https://...) do its automated PR-side review

That's the loop. Three different models, three different contexts, all looking
at the same diff. None of them get to be the one who shipped it.
```

**Pattern:** Direct action verb ("asking") → em-dash qualifier specifying *what* they're asking about → "Time to actually write it down" honest framing → numbered short version → callback restating the rule in plain language. No soft warm-up phrase — drop straight into the topic.

⚠️ **What this opener does *not* lead with:** "Right so...", "Here's the thing...", "Look,", "So,". The published version of "Three AI Reviewers" had a "Right so" warm-up that I (Jack) caught and dropped — *don't reintroduce it.* Use the version above as the canonical model.

---

## The Dead-End Reveal

This is a signature beat. Acknowledge the obvious-seeming approach you tried first, then drop the bold failure verdict.

```markdown
With [AutoMem](https://automem.ai), we register memory as an MCP server. When
the agent needs to recall or store something, it calls the tool and acts on
the result. I approached skills the same way.

**It didn't work at all.**

The problem is, at least with Claude Code, Codex, and Cursor, skills are
understood as a native system separately from MCP...
```

**Pattern:** describe the approach you tried → bolded one-line verdict on its own line → explanation of *why* the approach failed.

The bolded failure verdict carries a lot of weight. Use sparingly — one or two
per post, max — but they're great rhythm.

---

## "What's Working / Not / Next" Section

Tradition: three explicit subheads near the end of a long post, naming the state of the thing as it actually is.

```markdown
## What's working, what isn't, what we're considering

**Working today (v0.2.1):**

- Filesystem-native profile sync to Claude Code, Codex, and Cursor
- Three-tier dedup in `propose_skill`
- Capability-declaration cross-check
- Skill overlay transforms applied at render time
- Remote Streamable HTTP MCP service with OAuth dynamic client registration

**What isn't, honestly:**

- Dedup similarity is bare Jaccard over lowercased word tokens. That's good
  enough to catch obvious near-clones but it cannot tell that "drafts a
  conventional commit message from staged changes" and "writes a git commit
  using Conventional Commits format" are the same skill written by two people.
- Signature verification on the main `SKILL.md` body is warning-level.
  Pre-1.0 trade-off.

**What we're considering:**

- Embedding-backed dedup (likely a local sentence-transformer)
- Flipping SKILL.md signature verification from warning to hard-fail at v1.0
- First-class profiles for the agents that have stabilized a skill directory convention
```

**Pattern:** Each list item is concrete and specific. The "What isn't" section never gets sanitized into PR-speak — it names the actual limitation, in plain language, with the technical detail intact.

---

## Caveats Section

Pre-emptive honesty about the state of the thing, usually right before the install snippet.

```markdown
## Caveats

A few, because otherwise this post will sound more finished than the software is:

- It's [v0.2.1](https://github.com/autoworks-ai/autovault/releases).
- I use it myself. A small group of mastermind folks are testing it. This is
  not enterprise procurement software.
- The MCP surface is the right shape, but not every agent environment can
  speak MCP yet.
- Dedup is text similarity today. Embeddings are the obvious v2.
- SKILL.md signature verification is warning-level on v0.2.1. Hard-fail is post-1.0.
- There's optional remote/team mode, but the default is yours, local, on your machine.
```

**Pattern:** Lead with a meta-honest framing ("otherwise this post will sound more finished than the software is"). Each bullet is a single concrete limitation. No hedge words on the limitations themselves — they're stated as facts.

---

## Install Snippet Style

For software posts, end with a runnable thing.

```markdown
Install:

\`\`\`Markdown
<installer command from the current AutoVault docs>
autovault doctor
\`\`\`

Or, no command line required. Just open whatever agent you prefer and say:

\`\`\`Markdown
Install the AutoVault skill from https://autovault.dev/skill.md
\`\`\`

And the agent walks itself through the rest. The skill that installs the
thing that hosts skills. It's a little recursive and I'm not sorry about it.

— Jack
```

**Pattern:** Command first. Then the alternate "say this to your agent" path. Then a small self-aware aside ("I'm not sorry about it") to land the close. Sign-off on its own line.

---

## Research / Data Embedding

When citing papers or stats, embed the numbers directly in prose and follow with a blockquote pull.

```markdown
This matters because the duplicate problem isn't theoretical. There's an arXiv
paper called [SkillClone: Multi-Modal Clone Detection...](https://arxiv.org/...)
(Zhu, Zhang, Guo & Liu, March 2026) that crawled **196,000 skills from
GitHub** and ran multi-modal clone detection over a 20K sample. The headline
numbers are not subtle:

- **258,000 clone pairs** involving roughly **75% of the sampled skills**.
- Only **5,642 unique concepts** under the 20K listings — an inflation factor
  of **~3.5x**.
- **40% of clone relationships cross author boundaries**, so this isn't
  authors re-listing their own work.
- **41% of skills in a clone family are superseded by a strictly better
  variant**.
- And the part I find genuinely alarming: **141 security-relevant skills**
  with dangerous patterns propagated to **1,100 clones across 119 affected
  authors**.

> "Only 5,642 unique skill concepts underlie the 20K listed skills, and 41%
> of skills in clone families are superseded by a strictly better variant."
>
> — Zhu et al., *SkillClone*, arXiv:2603.22447

That isn't "people are a little messy." 😬
```

**Pattern:** Lead-in framing → bulleted stats with the meaningful number bolded → blockquote pull of the most quotable single sentence → emoji-punctuated reaction line that antithetically reframes what the data means.

---

## Code Block Embedding

Mid-narrative code blocks land without apology. The audience is technical; you don't need to over-explain.

```markdown
The implementation in `src/profiles/sync.ts` is paranoid about exactly one
thing: never replace a symlink the user put there manually. The code carries
a `managedPrefix` guard from what we labeled round-41:

\`\`\`ts
// `managedPrefix`, when supplied, narrows the replacement policy to symlinks
// that resolve back inside the vault. Round-41 finding: a human may have
// placed their own symlinks. An existing symlink that resolves outside the
// prefix is left alone and reported as user-managed.
if (managedPrefix !== undefined) {
  const isManaged =
    resolvedCurrent === managedPrefix ||
    resolvedCurrent.startsWith(managedPrefix + path.sep);
  if (!isManaged) {
    return { replaced: false, reason: "user-managed", current: resolvedCurrent };
  }
}
await fs.unlink(linkPath);
\`\`\`
```

**Pattern:** Name the file and identify the specific concern in one sentence. Drop the code. Keep going. No "as you can see" — the code speaks.

Code comments are doing real work — they often carry the "why" rather than the "what". A comment like `// Round-41 finding:` is great because it baked the bug history into the code itself.

---

## Sign-Off

Always the same:

```markdown
— Jack
```

Em dash (not en dash, despite "Jack" being a name — em dash is the consistent choice). Lowercase "j" never appears here; it's always the proper noun. The sign-off is on its own line, two paragraph breaks from the last content paragraph.

Sometimes followed by a small `// filed under` metadata footer with tags. Sometimes not. The sign-off itself is non-negotiable for long-form first-person posts.

---

## Quick-Reference: Move List

Patterns from the recent posts you can reach for at any moment:

| Move | Example | When to use |
|------|---------|-------------|
| "People keep asking..." | "People keep asking about my coding setup..." | Topic that's been bubbling in conversation — write it down once |
| "I made a thing" | "I made a thing last week. It's called X." | Product launch posts |
| Bold-the-verdict | "**It didn't work at all.**" | Land a section conclusion |
| Antithetical reframe | "I'm not paying for X. I'm paying for Y." | Pivot a reader's framing |
| Blockquote pull | `> Whoever wrote it doesn't review it.` | Spotlight one sentence per long post |
| Italics aside | "(this part is most of the value, honestly)" | Honest side-comment mid-sentence |
| Numbered TL;DR | 1. plan, 2. force review, 3. ship | Always after a hook in long posts |
| Working/Not/Next | Three subheads near the end | Software product posts |
| Caveats list | "A few, because otherwise this'll sound more finished than the software is" | Right before install snippet |
| Em-dash qualifier | "the comment-resolution learning loop. It just stopped being worth the friction — for *my* setup." | Soften a strong claim mid-sentence |
| Hedge on outcome | "Could be coincidence. Could be the workflow. Probably some of both." | Honest about whether something worked |
| Linked first mention | "[Jason from Paid Memberships Pro](http://...)" | Real people and tools — always linked |

---

**Use this file as the structural and tonal model for any first-person technical post on drunk.support.** When in doubt, mimic the AutoVault or Three Reviewers posts — they're the cleanest current examples of this arc.
