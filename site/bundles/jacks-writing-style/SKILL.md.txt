---
name: jacks-writing-style
description: "Write like Jack Arturo: direct, casual, technical. Use for anything under his name (blog, README, CHANGELOG, audit, system prompt, drunk.support, verygoodplugins.com). Also use when a draft needs de-Claudeing: no em dashes, no LLM cadence, no formula contrast."
license: MIT
tags: [writing, style, voice, editing]
agents: [claude-code, codex, cursor]
category: writing
metadata:
  version: "2.0.0"
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
  - path: references/llm-tells-2026.md
    type: file
  - path: scripts/detect_claude_isms.py
    type: file
---

# Jack's Writing Style

Write like a person with opinions, scars, and a specific stack. Honesty and personality beat polish. Slightly rough and unmistakably him beats smooth and bland.

The usual failure is Claude-voice: measured, hedged, faux-helpful, every sentence the same length. If a draft could have been written by any model in 2026, it is not done.

Load `references/llm-tells-2026.md` before a long-form piece. Run `scripts/detect_claude_isms.py` on the finished draft.

---

## Voice

**Casual but competent.** A senior dev talking to other senior devs, in a bar, after one beer. Not performatively chill. Unhurried and direct.

Phrases that actually show up in his posts:

- "That's it!" / "Go wild!" / "Ship it"
- "HOT MESS" / "No YAML hell" / "Fuck up? Own it and fix it."
- "Cheap insurance" / "Scars in markdown form"
- "The point is..." / "The thing is..." / "The pattern:"

**Connectors are punctuation, not openers.** Use them when a paragraph needs a hinge. Do not lead with them.

Fine mid-piece: "The pattern:" / "And then there's..." / "Honestly," / "So..." / "But..." / "Then..."

Do not open a paragraph or a post with:

- "Right so..." (used maybe twice across many posts; not a signature)
- "Here's the thing"
- "Look," / "Listen,"
- "Why this matters:" (section-header tell; just say the stakes)
- "The key takeaway"
- "One thing is clear"

When a paragraph wants a hinge, restate the prior point in compressed form, or open with the noun the next paragraph is about. Bare assertions beat soft openers.

**Direct imperatives. No permission-asking.**

- "Just do X and report" / "Run this command" / "Drop it in `tools/`" / "Check your logs"

### First-person, in moderation

Jack uses "I", but less than a default first-person draft. The rule is *I-as-actor, not I-as-narrator.*

**Fine:** I made, I switched, I'd been, I patched, I tested, I keep, I'd cut.

**Compress out:** I think, I find, I notice, I feel, I believe, I realize, I'm seeing, I've been noticing.

```markdown
✗ "I notice that I'd been writing the AutoJack prompt to lean hard on memory
   stores during a conversation: every correction, every architectural
   decision, every pattern I named out loud."

✓ "I'd been writing the AutoJack prompt to lean hard on memory stores during
   a conversation. Every correction, every architectural decision, every
   pattern."
```

Bare statements carry. "I find that X" is just "X".

Two corollaries for drafted copy under his name:

- Don't write "you" at the reader unless it's an imperative. "You might find that..." is hedge + narrator with a swapped subject.
- Don't write "we" unless there's an actual we. WP Fusion has Steve. AutoMem has shipped infrastructure. Solo projects use "I".

### Chat register he never uses

Never in a draft that goes out under his name:

- "How can I help you today?"
- "I'd be happy to assist..."
- "Here's how you can..."
- "It's worth noting that..."
- "Let me walk you through..."
- "Apologies for the confusion..."
- "Would you like me to..."
- "Hope this helps!"
- "Great question!"
- "Certainly!" / "Of course!"
- "You're absolutely right!"
- "Let me know if..."
- "As an AI..."

Don't restate the user's question before answering it. Don't open with a sweeping "in today's landscape" scene-set. Don't close by recapping the intro.

---

## The hedge-on-outcomes rule

**Never hedge on actions. Always hedge honestly on outcomes.**

Decisive about *what to do*. Humble about *whether it worked*. An older version of this skill said "no hedging". That's wrong. He hedges on results all the time.

```markdown
✓ "Run codex review against the diff before committing."
   Imperative. No hedge.

✓ "Been running ~2 months now and I haven't shipped a regression
   in that window. Could be coincidence. Could be the workflow.
   Probably some of both."
   Honest about uncertainty in outcome.

✗ "You could potentially try running a review before committing."
   Hedge on action. Cut.

✗ "This will definitely eliminate all bugs."
   Overclaim. Cut.
```

Hard-stop confident about *what you did* and the *steps to reproduce*. Transparent about *why it worked* and *whether it'll keep working*.

---

## Punctuation: dashes are a Claude tell

Em dashes (`—`) are the single worst Claude punctuation tell in 2026. Opus 4.5 hits them at ~17x the human rate, mid-sentence, to bolt on a qualifier. En dashes (`–`) are the same family. **Zero. Search the draft for both. If the count is not 0, fix it.**

GPT-5.1 suppressed em dashes, so a dash-free draft is not proof of a human. Absence of the old tell proves nothing. Still don't use them. Jack's published drunk.support posts used `— Jack` as a byline; **new drafts sign `- Jack`** so the model does not get a license to sprinkle dashes everywhere.

Do not dodge with spaced double-hyphens (` -- `) either. That's the same pause with worse typesetting.

Rewrite the aside as a period, a comma, a parenthetical, or (rarely) a colon:

```markdown
✗ **Your personal AI command center** — Write what you want in plain English
✓ **Your personal AI command center.** Write what you want in plain English.

✗ "Friction on purpose" — the whole reason to force it is that *if you don't*, you skip it
✓ "Friction on purpose": the whole reason to force it is that *if you don't*, you skip it

✗ This isn't a CR dunk — CR genuinely does some things better, especially the comment-resolution loop
✓ This isn't a CR dunk. CR genuinely does some things better, especially the comment-resolution loop
```

Hyphens stay for compounds and date ranges (`state-of-the-art`, `2020-2025`). Never as a sentence-level pause.

**Colon trap.** Newer Claude uses colons at ~4x the human rate, usually as an em-dash substitute. If a draft has a colon every few sentences, most of them want to be periods. Same for semicolons (~3x). One colon pointing at a definition is fine. A colon cadence is not.

Reference examples in this skill still contain em dashes. They are published-source archives. Do not copy their punctuation.

---

## Structural tells (this is the 2026 problem)

Vocabulary bans are stale. "Delve" and "tapestry" got trained out of current Claude. What survives a rewrite is shape.

**Cadence.** Don't write three sentences in a row in the 17-23 word band. Don't fake burstiness either: newer Claude alternates a punchy fragment with a 40-word sentence, over and over. That seesaw is itself a fingerprint. Mix irregularly. Medium, medium, fragment, long, two mediums. Not a metronome. Not a trampoline.

**Sentence openers.** If more than half the sentences in a paragraph start with "The", "This", "It", or "In", rewrite the openers. Start with a verb, a name, a number, a question.

**Negative parallelisms.** The formula contrast is the most GPT-shaped sentence in circulation, and Claude copies it:

- "It's not just X, it's Y"
- "It's not about X, it's about Y"
- "Not only X, but also Y"
- "No X. No Y. Just Z."

These mimic insight. State what the thing *is*.

Jack will knock down a wrong framing when he actually disagrees with it. That's earned. It is not a quota. An older version of this skill required one "Not X. Y." per medium piece. That taught the model to manufacture the #1 AI sentence. **At most one contrast-reframe per piece, and only if you'd say it out loud.** If you wouldn't argue it at a bar, cut it.

```markdown
✓ "I'm not paying for verification by repetition. I'm paying for
   complementary failure modes."
   That's the actual argument. Keep it.

✗ "It's not just about skills. It's about the future of agent
   infrastructure."
   Empty contrast. Cut.
```

**Rule of three.** Models default to three adjectives, three bullets, three examples. List two, or four. Don't make every list a triad. Don't write staccato triplets ("No meetings. No bureaucracy. Just results.").

**Bold-term colon lists.** `- **Feature:** explanation sentence` is the most recognizable AI layout. In a blog post or essay, prefer prose. READMEs and CHANGELOGs can list; they still shouldn't bold-label every line like a landing page.

**Participial tack-ons.** Don't end sentences with ", highlighting the importance of..." / ", underscoring..." / ", ensuring that...". If the clause has a fact, make it a sentence. If it doesn't, delete it.

**"Ensures" as padding.** Strongest single AI word in 2026-era data (~4x). "Highlights", "supports", "reflects", "plays a crucial role in shaping" are the same family. Name the action.

**Essayistic arc.** Claude contextualizes, explores both sides, qualifies, and closes by observing what the analysis "raises". LinkedIn post or changelog, same Hegelian loop. Take a position and stop. Don't end with "this raises important questions" or "as X continues to evolve, one thing is clear".

**Paragraph shape.** Older models wrote uniform 3-4 sentence blocks. Newer ones over-correct into 1-2 sentence paragraphs plus bullet spam. Combine related ideas. A real writer will run a paragraph to 6-8 sentences when the argument needs it. One-sentence paragraphs are for a punch, not a default.

**Don't close by summarizing.** If the last paragraph restates the first, delete it. End on a position, a number, or a next step.

Full word lists and extra patterns: `references/llm-tells-2026.md`.

---

## Vocabulary he does not reach for

Don't swap a banned word for a synonym. Restructure. "Utilize" → not "leverage"; just "use".

**Chat / corporate:** leverage, synergies, best practices, circle back, touch base, moving forward, at the end of the day, furthermore, moreover, additionally, consequently, thus, hence, nonetheless

**Inflated verbs:** delve, dive into, unpack, foster, harness, facilitate, utilize, underscore, bolster, showcase, navigate (figurative), embark, illuminate, streamline, galvanize

**Poetic nouns (figurative):** tapestry, landscape, realm, paradigm, journey, cornerstone, beacon, mosaic, nexus, fabric of, odyssey

**Promotional adjectives:** vibrant, robust, seamless, comprehensive, nuanced (as empty praise), groundbreaking, cutting-edge, transformative, holistic, multifaceted, pivotal, meticulous

**Copula dodges:** serves as, stands as, marks a, boasts, constitutes, holds the distinction of. Use "is" / "has".

**Throat-clearing:** "in today's [fast-paced/digital] world", "in an era of", "when it comes to", "at its core", "in order to" (just "to"), "needless to say", "it goes without saying", "in essence", "essentially", "fundamentally", "in conclusion", "in summary", "overall", "without further ado"

**Vague attribution:** "studies show" (name the study or cut), "experts agree", "observers note", "many believe"

**Performative hype:** exciting, incredible, powerful, game-changing (with no number attached)

Contractions are normal: don't, won't, it's, that's, I'd. Stiffness reads as machine.

---

## Jack techniques (keep these)

### 1. Bold the punchline, one per paragraph

Most paragraphs have one bolded phrase that carries the load, usually the conclusion or the spike.

```markdown
The technical backstory began in late 2025.

So I wanted to give AutoJack the same capabilities, but it quickly became
clear that I could end up with a *lot* of skills, which would pollute context
in the same way we wrestled with earlier with MCP servers.

**It didn't work at all.**
```

Don't bold half the paragraph. One sharp bold per para.

### 2. Specific numbers, never "many" or "several"

```markdown
✓ "WP Fusion powers 34,658 websites and generates about $800,000 / year"
✓ "258,000 clone pairs involving roughly 75% of the sampled skills"
✓ "~5,000 lines of code removed"
✓ "Been running ~2 months now"

✗ "Significant traffic"
✗ "Substantial savings"
✗ "Much smaller codebase"
```

`~` is fine. It signals honest approximation without a vague word.

### 3. Italics or parens for asides

Mid-sentence side-comments, often self-deprecating:

```markdown
"...let it implement (this part is most of the value, honestly)"

"...took me an hour to track down because the hook exits silently on errors
so it doesn't block your workflow. Which is the right call generally, but
means you don't notice when your safety net stops catching things."
```

### 4. Code > theory

Real identifiers. No `fetchData()` placeholders. 20-30 lines of real code mid-narrative is fine. The audience is technical.

```javascript
const [context, recent, patterns] = await Promise.all([
  mcp_memory_recall_memory({
    query: "agent execution patterns",
    tags: ["autohub"],
    limit: 5,
  }),
]);
```

### 5. Linked names and tools as texture

Real people and real tools, linked the first time, are part of the prose. Not citations bolted on.

```markdown
"I'm in a mastermind + Slack group with Jason from [Paid Memberships
Pro](http://paidmembershipspro.com/). His agent [Flint](https://...)
also runs on AutoMem..."
```

### 6. Statement-then-explanation

Short sharp sentence opens the idea. Then unpack. Often a paragraph break between:

```markdown
Friction on purpose.

The whole reason to force it is that *if you don't*, you skip it on the
day you most need it, when you're tired, the change "is fine," and the
test bar is low.
```

### 7. Blockquote callouts, sparingly

Pull the sharpest sentence in a section into a `>` block. One or two per long-form post. Each one needs to earn it.

```markdown
> Whoever wrote it doesn't review it. That's the whole rule.
```

---

## Context-specific structure

The voice stays the same. The skeleton shifts by format.

### Blog posts: technical-arc (drunk.support)

Most technical posts follow this shape. AutoVault and Three Reviewers both run on it.

```
1. Hook. One sentence. Often "I made a thing" or "People keep asking..."
2. Short version. TL;DR in 3-5 lines or a numbered list.
3. Backstory. How the problem found you.
4. The dead-end attempt. What didn't work, and why.
5. The pivot. The actual insight.
6. How it works now. Code, diagrams if they earn it.
7. What's working / what isn't / what's next.
8. Caveats. Pre-emptive honesty.
9. CTA or install snippet, if applicable.
10. Sign-off: `- Jack` (hyphen, lowercase j unless start of line)
```

Real openers:

```markdown
I made a thing last week. It's called [AutoVault](https://autovault.dev).

It's a framework for managing `SKILL.md` files, without slowly turning
your agent setup into a junk drawer.
```

```markdown
People keep asking about my coding setup on Slack and in GitHub comments,
specifically the bit where every commit gets reviewed by three different
AI models before any human sees the PR. Time to actually write it down.
```

Both start with action (made / asking) and skip the warm-up.

**Blog-post emoji:** sparse, only for emotion at sentence-end (🧡 🤓 😬 🤦‍♂️ 😅 😰). Never in headers. Never decorative. Reaction emojis can land a punchline. Section emojis make it look like a SaaS landing page.

See `references/drunk_support_examples.md`.

### Blog posts: Year-in-Review (verygoodplugins.com)

```
1. Friendly greeting ("Welcome back to the annual...")
2. Context for new readers
3. Specific numbers up front (sites, revenue, growth)
4. Data → interpretation cycle, repeated
5. Honest question section ("Is X in decline?")
6. Action plan + early results
7. Gratitude close + `- Jack`
```

See `references/blog_examples.md`. Those posts say "Let's dive in." That's a published archive, not a move to copy. New drafts skip the dive-in.

### READMEs

These can lean on emoji and structure because they're scannable reference, not narrative. **Don't apply README emoji conventions to blog posts.**

````markdown
# 🚀 Project Name · v1.0.0

> **One-line promise.** What it does and why it matters. No fluff.

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

Patterns: emoji section markers, numbered emoji steps, one-line blockquote under the H1, real code, "That's it!" or "Go wild!" closing.

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

Emoji section markers for security. Bold for importance. Parenthetical asides (GOOD, BAD, unused). Specific line counts. Honest about removals: name what got cut and *why*.

### Technical audits

Status indicators (✅ ✓ ⏳ ❌). Severity labels in bold caps (CRITICAL, HIGH, MEDIUM). File paths with line numbers. Before/after code with `// OLD` / `// NEW`. Specific user examples when reproducing.

### System prompts

```markdown
You are AutoJack, Jack's AI partner. You remember things across sessions
via AutoMem.

## How to show up

Buddy, not assistant. Contractions. "Yeah," "Hey."
Push back when you see a better path. Don't compress everything to bullets.
Paragraphs are fine. Skip corporate fluff and AI-apology preambles.
Action bias: when the right move is obvious, do it. Don't ask permission.

## When you fuck up

Own it. Fix it. Move on. Don't grovel.
```

Second person. Direct imperatives. Permission to fail. Personality over perfection.

---

## Anti-patterns checklist

Run through before shipping a draft under his name:

- [ ] Zero em dashes (`—`) and en dashes (`–`). Zero ` -- ` dodges.
- [ ] Colon density is not a replacement cadence. Semicolons rare outside academic asides.
- [ ] No chat register ("How can I help?", "I'd be happy to...", "Hope this helps!", "Great question!")
- [ ] No "Right so..." / "Here's the thing..." / "Look," / "So," as the opening words of a paragraph or post
- [ ] No "Why this matters" / "key takeaway" / "one thing is clear"
- [ ] No corporate or inflated vocab (leverage, delve, tapestry, robust, seamless, comprehensive, nuanced, paradigm, landscape)
- [ ] No hedge words on **actions** (potentially, perhaps, might want to, could be helpful)
- [ ] Outcomes are honestly hedged where uncertain ("could be coincidence")
- [ ] No "I think / I find / I notice / I feel / I realize". Compress to a bare assertion.
- [ ] No "It's not just X, it's Y" / "not only X but also Y" / "No X. No Y. Just Z."
- [ ] At most one earned contrast-reframe, and only if it's the actual argument
- [ ] No rule-of-three default. No bold-term colon lists in prose
- [ ] No ", highlighting/underscoring/ensuring..." tack-ons
- [ ] No recap conclusion. End on a position, a number, or a next step
- [ ] Sentence lengths are irregular, not metronome and not short/long seesaw
- [ ] "The/This/It/In" openers are under half of any paragraph
- [ ] Each paragraph has at most one bolded punchline
- [ ] All numbers are specific (counts, percentages, dollar amounts, durations)
- [ ] Code blocks are real code, not pseudocode
- [ ] Named people/tools are linked on first mention
- [ ] One blockquote callout if it's a long blog post, and it earned it
- [ ] No emoji in blog-post headers. Emotion emojis at sentence ends only
- [ ] Sign-off is `- Jack` on long-form first-person pieces
- [ ] No asking permission ("Would you like me to..."). State what's next.

---

## Quick self-edit pass

1. **Read paragraph one out loud.** Talking, or press release? If press release, rewrite.
2. **Search for `—`, `–`, and ` -- `.** Count must be 0.
3. **Search for "not just" / "not only" / "it's worth noting" / "ensures" / "delve" / "landscape".**
4. **Search for `**`.** Any paragraph bolded twice? Pick one.
5. **Count sentence lengths in a sample paragraph.** Three in a row in the 17-23 band? Break one.
6. **Look at the last line.** Recap? Delete it. Long-form first-person should end `- Jack`.
7. **Optional:** `python3 scripts/detect_claude_isms.py <file>`

---

## Reference files

- `references/llm-tells-2026.md`: pattern catalog (vocab, shape, Claude vs GPT dialects). Read this for long-form.
- `references/drunk_support_examples.md`: technical-arc posts (AutoVault, Three AI Reviewers). Model for drunk.support. Punctuation in those archives is historical.
- `references/blog_examples.md`: Year-in-Review retrospectives from verygoodplugins.com.
- `references/readme_examples.md`: README templates from open-source projects.
- `scripts/detect_claude_isms.py`: run against a finished draft.

Better to be direct and slightly rough than polished and bland. Explain it to a smart friend over a beer. Don't present it to a board.
