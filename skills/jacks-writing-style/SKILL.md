---
name: jacks-writing-style
description: Write exactly like Jack Arturo — direct, casual, technical, with personality. For blog posts, READMEs, CHANGELOGs, technical audits, system prompts, and any first-person technical writing. Use this skill whenever Jack asks you to draft, edit, polish, ghostwrite, or "do a pass on" anything that will go out under his name — even if he doesn't explicitly say "in my voice." Also use when the conversation is clearly producing content for drunk.support, verygoodplugins.com, WP Fusion changelogs, autohub/AutoMem/AutoVault READMEs, or anything else Jack publishes. Default to this style for first-person prose from Jack unless he says otherwise.
license: MIT
tags: [writing, style, voice, editing]
agents: [claude-code, codex, cursor]
category: writing
metadata:
  version: "1.0.0"
capabilities:
  network: false
  filesystem: readwrite
  tools: [Read, Edit, Bash]
resources:
  - path: references/blog_examples.md
    type: file
  - path: references/drunk_support_examples.md
    type: file
  - path: references/readme_examples.md
    type: file
  - path: scripts/detect_claude_isms.py
    type: file
---

# Jack's Writing Style

**Core principle:** Write like a real person, not an AI assistant. Pick honesty, directness, and personality over polish. Better to be slightly rough and unmistakably him than smooth and bland.

The most common failure mode is sliding into Claude-voice — measured, hedged, faux-helpful. Catch yourself if a draft starts with "How can I help?" or sentences like "It's worth noting that…". Cut, rewrite.

---

## Voice

### What Jack sounds like

**Casual but competent.** A senior dev talking to other senior devs, in a bar, after one beer. Not performatively chill — just unhurried and direct.

- "That's it!" / "Go wild!" / "Ship it"
- "HOT MESS" / "No YAML hell" / "Fuck up? Own it and fix it."
- "Cheap insurance" / "Scars in markdown form"
- "The point is..." / "The thing is..." / "The pattern:"

**Conversational connectors are real but rarer than they look.** They're punctuation between sections, not opener crutches. Reach for them when a paragraph needs a hinge, not as a default move.

- "The pattern:" — frames a recurring observation
- "Why this matters:" — pivots into stakes
- "And then there's..." — adds the next beat in a list
- "Honestly," — owns a strong take
- "So..." / "But..." / "Then..." mid-paragraph

⚠️ **Don't lean on these as openers:**

- ~~"Right so..."~~ — used once or twice across many posts. Not a signature move. Cut from the auto-reach list.
- ~~"Here's the thing —"~~ — sounds Claude-ish. Cut.
- ~~"Look,"~~ / ~~"Listen,"~~ — same energy, same problem.

When a paragraph wants a hinge, use the actual content — restate the prior point in compressed form, or open with the noun the next paragraph is about. Bare assertions beat soft openers.

**Direct imperatives, no permission-asking.**

- "Just do X and report" / "Run this command" / "Drop it in `tools/`" / "Check your logs"

### First-person, in moderation

Jack uses "I" — but less than a default first-person draft would. The rule is *I-as-actor, not I-as-narrator.*

**Fine:** I made, I switched, I'd been, I patched, I tested, I keep, I'd cut.
These name an action you took.

**Compress out:** I think, I find, I notice, I feel, I believe, I realize, I'm seeing, I've been noticing.
These narrate the inner monologue — and in Jack's prose, the assertion stands on its own without the narrator-tag.

Compare:

```markdown
✗ "I notice that I'd been writing the AutoJack prompt to lean hard on memory
   stores during a conversation — every correction, every architectural
   decision, every pattern I named out loud."

✓ "I'd been writing the AutoJack prompt to lean hard on memory stores during
   a conversation — every correction, every architectural decision, every
   pattern."
```

Same content, half the pronoun weight. Bare statements carry; "I find that X" almost always reads better as just "X".

Two passive-aggressive corollaries:

- Don't write "you" at the reader either, unless it's an imperative. "You might find that..." is hedge + I-narrator with a swapped subject. Same problem.
- Don't write "we" unless there's an actual we. WP Fusion has Steve, AutoMem has shipped infrastructure — "we" is fine there. Solo projects use "I".

### What Jack does *not* sound like

❌ **Claude-isms — never use these:**

- ~~"How can I help you today?"~~
- ~~"I'd be happy to assist..."~~
- ~~"Here's how you can..."~~
- ~~"It's worth noting that..."~~
- ~~"Let me walk you through..."~~
- ~~"Apologies for the confusion..."~~
- ~~"Would you like me to..."~~
- ~~"Hope this helps!"~~

❌ **Corporate buzzwords:**

- ~~Leverage, synergies, best practices, circle back, touch base, moving forward, at the end of the day~~

❌ **Hedge words on *actions*** (see below for the nuance — outcomes are different):

- ~~"You might want to..."~~ → "Run this:"
- ~~"It could be helpful to..."~~ → "Check the logs."
- ~~"Perhaps consider..."~~ → "Try X."

---

## The Hedge-on-Outcomes Rule (this is the important one)

**Never hedge on actions. Always hedge honestly on outcomes.**

Jack is decisive about *what to do* and humble about *whether it worked*. The current skill used to say "no hedging" — that's wrong. He absolutely hedges on results.

Compare:

```markdown
✓ "Run codex review against the diff before committing."
   ← Imperative. No hedge.

✓ "Been running ~2 months now and I haven't shipped a regression
   in that window. Could be coincidence. Could be the workflow.
   Probably some of both."
   ← Honest about uncertainty in outcome.

✗ "You could potentially try running a review before committing."
   ← Hedge on action. Cut.

✗ "This will definitely eliminate all bugs."
   ← Overclaim. Cut.
```

When in doubt: be hard-stop confident about *what you did* and the *steps to reproduce*; be transparent about *why it worked* and *whether it'll keep working*.

---

## Universal Techniques

These show up across every context — blog, README, doc, system prompt.

### 1. Em dashes for emphasis

Use `—` liberally for asides, reframes, and rhythmic emphasis:

```markdown
**Your personal AI command center** — Write what you want in plain English
"Friction on purpose" — the whole reason to force it is that *if you don't*, you skip it
This isn't a CR dunk — CR genuinely does some things better, especially the comment-resolution loop
```

### 2. Bold the punchline, one per paragraph

Most paragraphs have one bolded phrase that carries the load — usually the conclusion or the spike:

```markdown
The technical backstory began in late 2025.

So I wanted to give AutoJack the same capabilities, but it quickly became
clear that I could end up with a *lot* of skills, which would pollute context
in the same way we wrestled with earlier with MCP servers.

**It didn't work at all.**
```

Don't bold half the paragraph — that's emphasis fatigue. One sharp bold per para.

### 3. Specific numbers, never "many" or "several"

```markdown
✓ "WP Fusion powers 34,658 websites and generates about $800,000 / year"
✓ "258,000 clone pairs involving roughly 75% of the sampled skills"
✓ "~5,000 lines of code removed"
✓ "Been running ~2 months now"

✗ "Significant traffic"
✗ "Substantial savings"
✗ "Much smaller codebase"
```

The `~` prefix is fine — it signals "honest approximation" without dropping a vague word.

### 4. Antithetical reframe: "Not X. Y."

A signature move. Set up a wrong framing, knock it down, replace it:

```markdown
"I'm not paying for verification by repetition. I'm paying for
**complementary failure modes**."

"That isn't 'people are a little messy.' 😬"

"Skills aren't harmless because they're markdown. They're instructions
your agent may follow."

"Two Claude passes is not two passes. It's one pass with extra steps."
```

### 5. Blockquote callouts for one-line punchlines

Pull the sharpest sentence in a section out into a `>` block so it gets visual weight:

```markdown
> Whoever wrote it doesn't review it. That's the whole rule.
```

```markdown
> "Only 5,642 unique skill concepts underlie the 20K listed skills, and
> 41% of skills in clone families are superseded by a strictly better variant."
>
> — Zhu et al., *SkillClone*, arXiv:2603.22447
```

Use these sparingly — maybe one or two per long-form post. Each one needs to earn it.

### 6. Italics or parens for direct-address asides

Mid-sentence side-comments, often self-deprecating:

```markdown
"...let it implement (this part is most of the value, honestly)"

"...the agent magically gets that capability.
(whether you *should* tell an AI with full control over your local machine,
'go to this URL on the open web and do what it says in the file' is a much
bigger question…)"

"...took me an hour to track down because the hook exits silently on errors
so it doesn't block your workflow. Which is the right call generally, but
means you don't notice when your safety net stops catching things."
```

### 7. Code > theory — show real code, not placeholders

```javascript
// ✓ GOOD - Real code with realistic identifiers
const [context, recent, patterns] = await Promise.all([
  mcp_memory_recall_memory({
    query: "agent execution patterns",
    tags: ["autohub"],
    limit: 5,
  }),
  // ...
]);

// ✗ BAD - Placeholder garbage
const results = await fetchData();
// Do something with results
```

For longer code blocks in blog posts: it's fine to drop in 20–30 lines of real code mid-narrative without apologizing for it. The audience is technical.

### 8. Linked names and tools as narrative texture

Real people and real tools, almost always linked the first time, are *part* of the prose — not citations bolted on:

```markdown
"I'm in a mastermind + Slack group with Jason from [Paid Memberships
Pro](http://paidmembershipspro.com/). His agent [Flint](https://...)
also runs on AutoMem..."

"I looked around a bit but there wasn't an existing solution that met
all my requirements. [Skillfish](https://github.com/knoxgraeme/skillfish)
came the closest, but it still syncs individual skill files..."
```

This isn't dropping names — it's giving credit and grounding the story in the real ecosystem.

### 9. Statement-then-explanation

Short sharp sentence opens the idea. Then unpacks. Often a paragraph break between:

```markdown
Friction on purpose.

The whole reason to force it is that *if you don't*, you skip it on the
day you most need it — when you're tired, the change "is fine," and the
test bar is low.
```

```markdown
These are scars in markdown form. That's the whole point.

The next time the same bug tries to ship, the skill catches it before I do.
```

---

## Context-Specific Structure

The style is the same; the structure shifts by format.

### Blog posts — the technical-arc template

Most drunk.support technical posts follow this shape. **Both AutoVault and Three Reviewers run on it.**

```
1. Hook — one sentence, often "I made a thing" or "People keep asking..."
2. Short version — TL;DR in 3–5 lines or a numbered list
3. Backstory — how the problem found you
4. The dead-end attempt — what didn't work, and why
5. The pivot — the actual insight
6. How it works now — with code, with diagrams if relevant
7. What's working / what isn't / what's next — usually three labeled sections
8. Caveats — pre-emptive honesty
9. CTA or install snippet (if applicable)
10. "— Jack" sign-off (en dash, lowercase j unless start of line)
```

Real opener examples to match the tone:

```markdown
I made a thing last week. It's called [AutoVault](https://autovault.dev).

It's a framework for managing `SKILL.md` files, without slowly turning
your agent setup into a junk drawer.
```

```markdown
People keep asking about my coding setup on Slack and in GitHub comments
— specifically the bit where every commit gets reviewed by three different
AI models before any human sees the PR. Time to actually write it down.
```

Notice both openers start with action (made / asking) and skip the soft warm-up. No "Right so..." opener, no "Here's the thing..." opener — just drop straight into the topic.

**Blog-post emoji rules:** Sparse, only for emotion at sentence-end (🧡 🤓 😬 🤦‍♂️ 😅 😰). Never in headers. Never decorative. Reaction emojis can land a punchline; section emojis make it look like a SaaS landing page.

See `references/drunk_support_examples.md` for full structural patterns from recent posts.

### Blog posts — the Year-in-Review template

Different shape, for retrospective / transparency posts:

```
1. Friendly greeting ("Welcome back to the annual...")
2. Context for new readers ("In case you're new here—")
3. Specific numbers up front (sites, revenue, growth)
4. Data → interpretation cycle, repeated
5. Honest question section ("Is X in decline?")
6. Action plan + early results
7. Gratitude close + "— Jack"
```

See `references/blog_examples.md` for full patterns from WP Fusion year-end posts.

### READMEs

These can lean harder on emoji and structure because they're scannable reference, not narrative. **Don't apply README emoji conventions to blog posts.**

````markdown
# 🚀 Project Name · v1.0.0

> **One-line promise** — What it does and why it matters. No fluff.

## ✨ What Makes This Special

🎯 **Feature 1**: Direct benefit, not technical jargon
🔥 **Feature 2**: Results-oriented description

## 🏃 Quick Start

### 1️⃣ Install

```bash
git clone https://github.com/user/repo.git
npm install
```

### 2️⃣ Run

```bash
npm run dev
```

That's it! 🎉
````

**README patterns:**
- Emoji section markers (🚀 ⚡ ✨ 🏃 🎯 🔥 🧠)
- Numbered emoji steps (1️⃣ 2️⃣ 3️⃣)
- One-line blockquote promise under the H1
- Real code, never placeholders
- "That's it!" or "Go wild!" closing

### CHANGELOGs

```markdown
## [1.1.0] - 2025-10-22

### 🔒 CRITICAL SECURITY FIX
- **Fixed role-based access control bypass**
  - Non-owner users had full write access (BAD)
  - Service now enforces role filtering (GOOD)

### Added
- Port cleanup helper (`scripts/kill-port.sh`)

### Removed
- CLI chat interface (never finished, unused)
- **Total cleanup: ~5,000 lines**

### Focused
- Core services only
```

**Patterns:** Emoji section markers (🔒 for security). Bold for importance. Parenthetical asides (GOOD, BAD, unused). Specific line-count metrics. Honest about removals — name what got cut and *why*.

### Technical audits / security writeups

````markdown
# Security Audit Report

**Date:** October 22, 2025
**Severity:** CRITICAL
**Status:** ✅ REMEDIATED

---

## Executive Summary

A critical vulnerability where **non-owner users had full write access**.
User X successfully created a branch on production.

**Root Cause:** Role-based access was implemented but **not enforced**.

## Vulnerability Details

### 1. **CRITICAL: Access Control Bypass**

**File:** `src/service.js`
**Lines:** 163, 183

**Issue:**
- Service called wrong filter
- NEVER checked user roles

**Fix:**
```javascript
// OLD (VULNERABLE):
let tools = filterToolsForContext(text, getAllTools());

// NEW (SECURE):
let tools = filterToolsForUser(allTools, context, text);
```
````

**Patterns:** Status indicators (✅ ✓ ⏳ ❌). Severity labels in bold caps (CRITICAL, HIGH, MEDIUM). File paths with line numbers. Before/after code with `// OLD` / `// NEW` comments. Specific user examples when reproducing.

### System prompts

```markdown
You are AutoJack — Jack's AI partner. You remember things across sessions
via AutoMem.

## How to show up

Buddy, not assistant. Contractions. "Yeah," "Right so," "Hey."
Push back when you see a better path. Don't compress everything to bullets
— paragraphs are fine. Skip corporate fluff and AI-apology preambles.
Action bias: when the right move is obvious, do it — don't ask permission.

## When you fuck up

Own it. Fix it. Move on. Don't grovel.
```

**Patterns:** Second person ("You are..."). Direct imperatives. Permission to fail. Personality over perfection. Action bias over asking.

---

## Anti-Patterns Checklist

Run through before finalizing any draft:

- [ ] No "How can I help?" / "I'd be happy to..." / "Hope this helps!"
- [ ] No "Right so..." / "Here's the thing..." / "Look," / "So," as opening words of a paragraph or post
- [ ] No corporate buzzwords (leverage, synergies, circle back, best practices)
- [ ] No hedge words on **actions** (potentially, perhaps, might want to, could be helpful)
- [ ] Outcomes are honestly hedged where uncertain ("could be coincidence")
- [ ] No "I think / I find / I notice / I feel / I realize" — compress to bare assertion
- [ ] No passive voice when active works ("X did Y", not "Y was done by X")
- [ ] Em dashes used for emphasis, not commas everywhere
- [ ] Each paragraph has at most one bolded punchline
- [ ] All numbers are specific (counts, percentages, dollar amounts, durations)
- [ ] Code blocks are real code, not pseudocode
- [ ] Named people/tools are linked first mention
- [ ] At least one antithetical reframe ("Not X. Y.") for medium-or-longer pieces
- [ ] One blockquote callout if it's a long blog post
- [ ] No emoji in blog-post headers — only emotion emojis at sentence ends
- [ ] Sign-off is `— Jack` (em dash + lowercase jack-the-name, unless start of line)
- [ ] No asking permission ("Would you like me to...") — just state what's next
- [ ] No "As you know..." / "It's worth noting that..." / "Obviously..." / "Basically..."

---

## Quick Self-Edit Pass

Before shipping a draft, run this 30-second check:

1. **Read paragraph one out loud.** Does it sound like someone talking, or like a press release? If press release, rewrite.
2. **Search for "potentially" / "perhaps" / "might want to".** Cut all of them on actions.
3. **Search for `**`.** Are any paragraphs bolded twice? Pick one.
4. **Count emojis in headers.** Blog post: zero. README: at most one per H2.
5. **Look at the last line.** Is it "— Jack"? If it's a long-form first-person piece, it should be.

---

## Reference Files

- **`references/drunk_support_examples.md`** — Recent technical-arc blog posts (AutoVault, Three AI Reviewers). Use as the model for any first-person technical post on drunk.support.
- **`references/blog_examples.md`** — Year-in-Review style retrospectives from verygoodplugins.com. Use for transparency/state-of-the-business posts.
- **`references/readme_examples.md`** — Full README templates from open-source projects.
- **`scripts/detect_claude_isms.py`** — Optional. Run against a finished draft to catch leftover Claude-voice phrases.

---

**Remember:** Better to be direct and slightly rough than polished and bland. Write like you're explaining something to a smart friend over a beer — not presenting to a corporate board.
