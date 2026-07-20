---
title: Skills Are the New MCP Bloat
description: Progressive disclosure is necessary and not sufficient. Here's what AutoHub learned loading tools by intent — and what that means now that everyone's drowning in SKILL.md files.
date: 2026-07-20
visibility: public
---

# Skills Are the New MCP Bloat

I keep hearing the same story I was telling myself about MCP servers last fall.

Skills are great. Until you have ten bad ones. Or forty highly optimized ones. Then the model starts guessing wrong, burning tokens on descriptions it will never use, and confidently skipping the skill that would have saved the turn.

**It's the same failure mode. Different file extension.**

## Short version

1. **MCP taught us** that "register everything and hope the model picks correctly" dies at scale — tool definitions are expensive, always-on context is radioactive, and selection accuracy falls off a cliff.
2. **Skills sell progressive disclosure** — name + description always loaded, body on demand. That fixes *definition* bloat. It does **not** fix *selection* bloat when the catalog is huge, cloned, or contradictory.
3. **AutoHub already solved the MCP side** with a lean baseline, regex intent rules in `tool-filters.json`, a scanned registry in `mcp-tools.json`, lazy server start, and `request_tool_group` as the escape hatch. Voice adds a local model that routes turns before the cloud model ever sees the full toolbox.
4. **The skills wave is replaying 2025.** Public catalogs are full of clones; research is already measuring non-monotonic returns past a handful of skills; agents that dump every skill description into the system prompt are back at square one.
5. **The durable pattern:** inventory big, **load small**, escalate only when intent is clear — whether the unit of capability is an MCP tool or a `SKILL.md`.

## Backstory: MCP in September

When [Model Context Protocol](https://modelcontextprotocol.io/) hit, the pitch was clean: one standard for connecting models to tools. Wire GitHub, memory, browser, home automation, analytics — the agent just *has* capabilities.

That works until it doesn't.

Each tool ships a name, description, and JSON schema. Those tokens sit in the context window **whether you use them or not**. Anthropic's own engineering writeups on context (see [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)) keep hammering the same point: polluted context doesn't just cost money — **it degrades decisions**.

On AutoHub I didn't have a cute academic problem. I had a working desk agent with home automation, FreeScout, Google Workspace, Stream Deck, Railway, X, GitHub, memory — and a model that would rather invent a plausible answer than request the right group.

Raw inventory today, for honesty:

| Surface | Count (this machine, July 2026) |
|---|---|
| MCP servers registered in AutoHub | **32** |
| Tools in the scanned registry (`mcp-tools.json`) | **~800+** |
| Tool groups in `tool-filters.json` | **60** |
| Context / intent rules | **60** |
| Profiles (owner, voice, guest, Discord, …) | **16** |
| Always-on "essential" tools | **23** (not 800) |
| Local AutoVault skills | **~108** |
| Public packages on [skillissue.sh](https://skillissue.sh) | **30** |

If I dumped every MCP tool definition into every turn, the conversation would be over before it started. `mcp-tools.json` alone is about **1.5 MB** of catalog JSON. That's inventory. **Inventory is not context.**

## The dead end: "just load everything"

First instinct with MCP: register it all. Same first instinct with skills: install the marketplace, symlink the whole vault, hope progressive disclosure saves you.

Progressive disclosure **does** help. Anthropic's [Agent Skills design](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) is explicit: frontmatter (name + description) is cheap; the body loads when triggered; references load on demand. Claude's platform docs describe the same three-level model ([Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)).

That solves "I don't want a 40k-token brand bible in every turn."

It does **not** solve:

- Forty skills whose descriptions all vaguely match "deploy" or "write" or "fix"
- Clone families where 41% of variants are strictly worse than a sibling ([SkillClone](https://www.researchgate.net/publication/403111607_SkillClone_Multi-Modal_Clone_Detection_and_Clone_Propagation_Analysis_in_the_Agent_Skill_Ecosystem)-style findings floating around the ecosystem — the clone problem is real even if your numbers differ)
- Selection phase transition: past a critical library size, routing accuracy drops hard (surveyed in [Agent Skills for Large Language Models](https://arxiv.org/html/2602.12430v3), citing Li on skill compilation / library scale)
- SkillsBench-style results where **2–3 skills help most**, **4+ skills help less**, and "comprehensive" skills can **hurt** ([SkillsBench](https://arxiv.org/html/2602.12670v1))

> Skills aren't free because they're markdown. Metadata still competes for attention. Bodies still compete once loaded. Bad catalog design is just MCP bloat wearing a friendlier hat.

I hit the same wall in late 2025 trying to treat skills like another MCP: "register the skill server, call the tool." **It didn't work** for Claude Code / Codex / Cursor-shaped hosts — they want files on disk, not another always-on tool schema. That dead end is why [AutoVault](https://autovault.dev) exists as a **filesystem vault with profile sync**, not a skill MCP marketplace. (I wrote that launch story on [drunk.support](https://drunk.support) as "Introducing AutoVault.")

## How AutoHub actually loads capabilities

The hub never pretends the model can see everything. Three files do the real work:

### 1. `config/mcp-servers.json` — process inventory

Which MCP servers exist, how to start them, credentials, auto-load vs lazy. This is ops config, not prompt content.

### 2. `config/mcp-tools.json` — scanned tool registry

After a scan, every tool name/schema the hub knows about. Large. **Not** dumped into the model every turn. Used to *resolve* names when a group is enabled.

### 3. `config/tool-filters.json` — what the model is allowed to see *now*

This is the product.

**Profiles** define a lean baseline. Owner chat (`owner-auto`) does **not** get Stream Deck, FreeScout, and the kitchen sink on every message. It gets something like:

```json
{
  "description": "Owner profile - contextual filtering with full expansion capabilities",
  "groups": [
    "essential",
    "memory",
    "search",
    "research",
    "github",
    "github_pr_write",
    "home_assistant",
    "railway_read",
    "x_api",
    "conversation_query",
    "task_queue"
  ],
  "ownerFeatures": {
    "allowFullOnRequest": true,
    "expandIntentServers": true
  }
}
```

**Tool groups** map names → concrete tool IDs (60 groups). `essential` is ~23 tools. That's the always-on floor.

**Context rules** expand groups when the *user's words* match a pattern — and can **start** lazy MCP servers only then:

```json
{
  "id": "streamdeck-intent",
  "pattern": "\\bstream\\s*deck\\b|\\bstreamdeck\\b",
  "enableGroups": ["streamdeck"],
  "startServers": ["streamdeck"],
  "priority": 5
}
```

```json
{
  "id": "email-intent",
  "pattern": "\\b(email|gmail|inbox|from:|mail)\\b",
  "enableGroups": ["email", "communication"],
  "startServers": ["google_workspace"],
  "priority": 5
}
```

```json
{
  "id": "artifact-intent",
  "pattern": "\\bartifacts?\\b|\\bcanvas\\b|...",
  "enableGroups": ["artifacts"],
  "priority": 4
}
```

Pattern: **registered ≠ callable**. A tool can sit in `mcp-tools.json` forever and never enter the prompt until a baseline group or an intent rule (or an explicit request) says so.

### The escape hatch: `request_tool_group`

When the baseline is wrong and no regex fired, the model can ask for a group — not invent tools that aren't there. That escape hatch has to stay **eager** in the tool list. We learned the hard way that Anthropic-style tool deferral / BM25 tool-search can bury the hatch under hot positional slots (AutoHub PR #719): native tool search only finds definitions **already in the payload**. It cannot cold-start a lazy MCP server. So `request_tool_group` is special-cased as always-eager, and low-value groups get kicked out of the owner baseline.

That's the whole game:

| Layer | Job |
|---|---|
| Registry | Know everything |
| Profile baseline | Pay for almost nothing |
| Intent rules | Pay a little when speech matches |
| `request_tool_group` | Pay on demand when the model notices a gap |
| Lazy `startServers` | Don't boot heavy MCP processes until needed |

Same shape for **skills** if you do it right: catalog wide, activate narrow.

## Local fast LLM: route before you bloat

Voice made the cost obvious. Cloud Sonnet with full tools is expensive and slow for "set a timer" and "what's on my calendar." Local Qwen/MLX is cheap and private — but only if you don't hand it the whole toolbox.

AutoHub's voice path uses `config/tool-filters.json` as the **intent source of truth** (not a second hard-coded keyword list in router code). `local-turn-router.js` classifies a turn:

- casual chat → stay local, minimal tools
- memory-shaped → local + memory tools
- search / research / messaging-shaped → escalate to cloud with the right groups
- experimental local tool loop → only groups on an allowlist (`memory`, `home_assistant`, timers, …)

The experimental loop in `local-native-tools.js` is a small multi-round tool loop **on the local model**: filtered tool definitions only, inject results, force a final spoken answer when the model wants to tool-call forever. Gated by `VOICE_LOCAL_NATIVE_TOOLS` — default off until live-validated, because tool-trained models will happily claim "timer set" without calling anything if you let them.

Architecture in one sentence:

> **A small model decides which package of tools/skills the big model is allowed to see.**

That is highly customized. It is also the only approach that still works when the catalog is hundreds of tools and a hundred skills. "Hope progressive disclosure picks the right description among 200 near-duplicates" is not a strategy — it's a prayer.

## Skills replaying the MCP movie

The public narrative around skills in 2025–2026 is optimistic progressive disclosure: ~30–50 tokens per skill at startup, body on trigger ([Claude docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview), [Anthropic engineering](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)). That's correct as far as it goes.

What's showing up in the wild:

- **Catalog pollution.** Marketplaces and GitHub forks fill with near-clones. If your agent loads every description, you're back to MCP schema spam. One ecosystem writeup put it bluntly: every request carrying tens of KB of skill descriptions whether needed or not ([DEV: context bloat in a skill ecosystem](https://dev.to/imaclaw/how-were-solving-context-window-bloat-in-an-ai-agent-skill-ecosystem-2265)).
- **Phase transitions.** Surveys of agent skills note selection accuracy collapsing past critical library size ([arXiv:2602.12430](https://arxiv.org/html/2602.12430v3)).
- **Non-monotonic benefit.** SkillsBench: a few skills help a lot; more skills can flatten or reverse gains; "comprehensive" skills can underperform compact ones ([arXiv:2602.12670](https://arxiv.org/html/2602.12670v1)).
- **Host differences.** AutoHub chat is filtered. Claude Code / Codex load skill *metadata* from the filesystem skill dir — install 100 skills and you've paid 100 descriptions every session. AutoVault's job is to keep that dir intentional (validated, signed, profile-scoped), not infinite.

[skillissue.sh](https://skillissue.sh) is deliberately **not** a dump of all 108 vault skills. Thirty public packages with stories. The rest stay offline until they earn a page. Same discipline as tool groups: **publish is not the same as load.**

## What "package the right thing" means in practice

When I say the local model selects a **package** — tools, skills, or a whole agent profile — I mean a bounded capability set:

```text
User utterance
    → intent match (regex / small classifier / both)
    → enableGroups + optional startServers
    → tool definitions for THIS turn only
    → (optional) skill bodies only if those skills are in the package
    → cloud or local executor
```

Concrete AutoHub behaviors that map 1:1 to skills:

| MCP lesson | Skills analogue |
|---|---|
| Don't put all tools in baseline | Don't install every marketplace skill into every agent profile |
| Intent rule enables a group | Route "deploy Cloudflare" → load `cloudflare-ops`, not the whole vault |
| Lazy startServers | Load skill body + references only when selected |
| `request_tool_group` | Explicit "use skill X" / router package request when automatic routing misses |
| Per-profile baselines | AutoVault profiles: Claude Code ≠ guest Discord ≠ voice |
| Tool-search can't start lazy servers | Metadata search can't invent a skill that isn't on disk / in the package |

Code-shaped example of the filter contract (simplified from real hub structure):

```javascript
// Pseudocode: what the model sees this turn
function toolsForTurn({ profile, userText, grantedGroups }) {
  const baseline = profiles[profile].groups; // e.g. owner-auto
  const matched = contextRules
    .filter((rule) => new RegExp(rule.pattern, 'i').test(userText))
    .flatMap((rule) => rule.enableGroups || []);

  const groups = unique([...baseline, ...matched, ...grantedGroups]);
  // request_tool_group may add to grantedGroups mid-conversation

  for (const rule of contextRules) {
    if (rule.startServers && groups overlap rule.enableGroups) {
      ensureMcpStarted(rule.startServers); // lazy
    }
  }

  return expandGroupsToToolDefs(groups, mcpToolsRegistry);
}
```

Skills version:

```javascript
// Pseudocode: progressive disclosure + intentional install set
function skillsForTurn({ profileSkillDir, userText, forcedSkills }) {
  const installed = listSkillFrontmatter(profileSkillDir); // name+description only
  const selected =
    forcedSkills.length > 0
      ? forcedSkills
      : rankByDescription(installed, userText).slice(0, MAX_SKILLS); // keep this small

  return {
    metadataTokens: installed, // already in system prompt on some hosts — keep the dir lean
    bodiesToRead: selected.map((s) => s.path), // bash-read only these
  };
}
```

The second function is where most people cheat: `MAX_SKILLS = Infinity` and a vault the size of npm.

## What's working

- **Intent-gated MCP on AutoHub** — owner chat stays usable with hundreds of tools registered.
- **Lazy MCP processes** — Stream Deck, FreeScout, Google Workspace boot when speech matches, not at hub boot.
- **AutoVault** — one vault, multi-agent profile sync, validation before junk lands in `~/.claude/skills`.
- **skillissue as a shelf, not a landfill** — install pins to git SHAs; narratives only for skills that earned them.
- **Research catching up** — progressive disclosure is mainstream; selection-at-scale is the open problem everyone is rediscovering.

## What isn't

- Regex intent is brittle. Great for "stream deck" and "gmail." Bad for novel phrasing. That's why the local classifier / tool loop and `request_tool_group` exist.
- Local models still hallucinate completed actions ("timer set") without tool calls — we guard that, but it's scars in code, not solved science.
- Skills hosts still differ. What Claude Code loads at startup is not what AutoHub injects into a Slack turn.
- No universal standard for "skill packages as routed units" across vendors yet — everyone invents progressive disclosure, few invent routing discipline.

## What's next

- Treat skill catalogs like tool groups: **baseline + intent + request**, not "install all."
- Keep using a small model (or structured router) to assemble the package before the frontier model runs.
- Publish fewer, better skills. Clone detection and strict public gates (skillissue uniqueness) beat infinite marketplaces.
- When someone says "skills fixed MCP context bloat," ask: **for the body, or for the catalog?** Only one of those is automatic.

## Caveats

This is one production hub's design, not a paper. Counts are from this machine's AutoHub config in July 2026 — your numbers will differ. Progressive disclosure remains the right default for skill *bodies*. I'm arguing it was never a complete answer for skill *libraries*, the same way MCP schemas were never free just because the server was "standard."

If you're drowning in skills the way I drowned in MCP tools: **stop adding. Start routing.**

— Jack

---

### Further reading

- Anthropic — [Equipping agents for the real world with Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- Anthropic — [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- Claude docs — [Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- Survey — [Agent Skills for Large Language Models](https://arxiv.org/html/2602.12430v3) (progressive disclosure, selection-at-scale)
- SkillsBench — [Benchmarking How Well Agent Skills Work](https://arxiv.org/html/2602.12670v1)
- Context bloat writeup — [The Two Context Bloat Problems](https://agenteer.com/blog/the-two-context-bloat-problems-every-ai-agent-builder-must-understand/)
- Ecosystem note — [Solving context window bloat in a skill ecosystem](https://dev.to/imaclaw/how-were-solving-context-window-bloat-in-an-ai-agent-skill-ecosystem-2265)
- Products in this story — [AutoVault](https://autovault.dev), [AutoMem](https://automem.ai), [skillissue.sh](https://skillissue.sh)
