---
title: Inventory Is Not Context
subtitle: How AutoHub Learned to Starve Models of Tools
alt_title: "800 Tools, 23 Always-On: Tool Routing Before Skills Bloat"
description: AutoHub grew from a handful of essential tools to an 800+ tool MCP registry. The fix was not better prompt engineering — it was starving the model of tools by default, loading packages by intent, and treating inventory as something separate from context. Git-harvested numbers, offline model experiments, and the map to AutoVault's six homepage problems.
date: 2026-07-20
status: draft
destination: drunk.support
related:
  - https://skillissue.sh/essays/skills-are-the-new-mcp-bloat/
  - https://autovault.dev
---

# Inventory Is Not Context

## How AutoHub Learned to Starve Models of Tools

I can put about eight hundred tools in front of a frontier model.

I *shouldn't*.

That is the whole post, if you only have a minute. Everything below is how we got there, what we tried first, what the git history actually says, and why the skills wave is replaying the same movie with friendlier file extensions.

The short friendly version lives on skillissue: [Skills Are the New MCP Bloat](https://skillissue.sh/essays/skills-are-the-new-mcp-bloat/). This is the long technical cut for people who want the tables, the dead ends, and the config shapes.

---

## Short version

1. **MCP made inventory cheap.** Wire another server, get another dozen tools, feel powerful. Context cost is deferred until the next slow, wrong answer.
2. **Context is not inventory.** AutoHub keeps a scanned registry of every tool it *knows about* (`mcp-tools.json`, ~1.5 MB). It does **not** dump that into the model every turn.
3. **The product is the filter.** Profiles + tool groups + intent rules + a floor of always-on tools. Today: **813** registered tools, **23** essential, **60** groups, **60** context rules, **16** profiles.
4. **Escape hatches must stay eager.** `request_tool_group` is how the model recovers when baseline + regex miss. Bury it under deferred/BM25 tool search and you cold-start nothing (PR #719).
5. **Local models only work on curated catalogs.** hermes3:8b went GO on ~10 tools; the big warm voice model selected tools perfectly and then failed to finish the loop. Different jobs, different models.
6. **Skills reintroduce the same tax.** Progressive disclosure fixes body bloat. It does not fix selection bloat when the catalog is huge, cloned, or contradictory. Research already sees non-monotonic returns.
7. **Architecture sentence:** *A small model (or a dumb intent layer) decides which package of tools/skills the big model is allowed to see.*

---

## Backstory: September 2025 → now

When [Model Context Protocol](https://modelcontextprotocol.io/) landed, the pitch was clean: one standard for connecting models to tools. Wire GitHub, memory, browser, home automation, FreeScout, Stream Deck, Google Workspace — the agent just *has* capabilities.

That works until every tool's name, description, and JSON schema sit in the context window whether you use them or not. Anthropic's own context-engineering writing keeps making the same point: polluted context does not only cost money — **it degrades decisions**.

I was not optimizing an academic eval harness. I was running a desk agent that was supposed to remember things, dim lights, open PRs, answer support tickets, and not invent calendar events when the calendar server was cold.

`config/tool-filters.json` has existed since **2025-08-29**. Early on it was a small list of groups and a handful of "essential" tools. The scanned registry (`config/mcp-tools.json`) did not even exist until **2025-12-02** — before that we filtered what we had without a full inventory file.

Then the inventory grew.

### Git-harvested timeline

Method: sample `git rev-list --before=<date>` on the AutoHub repo, parse `config/tool-filters.json` (`toolGroups`, `contextRules`, `profiles`, `essential`) and `config/mcp-tools.json` (`servers.*.tools`). Consecutive identical metric tuples were deduped. Full harvest lives in `content/data/tool-timeline.json`.

| Date | Groups | Essential | Rules | Profiles | MCP tools | MCP servers |
|------|--------|-----------|-------|----------|-----------|-------------|
| 2025-09-15 | 12 | 5 | 10 | 4 | — | — |
| 2025-10-01 | 13 | 5 | 12 | 4 | — | — |
| 2025-10-15 | 18 | 14 | 13 | 3 | — | — |
| 2025-11-01 | 20 | 15 | 15 | 3 | — | — |
| 2025-12-15 | 22 | 16 | 23 | 5 | 494 | 19 |
| 2026-01-15 | 23 | 17 | 23 | 6 | 683 | 26 |
| 2026-02-15 | 26 | 18 | 24 | 10 | 779 | 28 |
| 2026-03-01 | 33 | 19 | 30 | 10 | 552 | 23 | ← registry cleanup dip |
| 2026-05-15 | 51 | 19 | 46 | 13 | 706 | 29 |
| 2026-06-26 | 57 | 23 | 57 | 15 | 723 | 29 | ← voice core / essential expansion |
| 2026-07-20 | 60 | 23 | 60 | 16 | 813 | 32 | HEAD |

Read that table left to right and you see the real product: **filter surface grew with inventory**. Essential tools barely moved after mid-October 2025 (14 → 23 over nine months). Registered tools went to eight hundred. The floor stayed a floor.

March 1 is a dip, not a miracle: registry cleanup dropped dead/duplicate tool entries while groups and rules kept expanding. Inventory can shrink when you delete junk. Context discipline is what keeps the model sane either way.

![Registered tools over time](/assets/charts/c1-registered-tools.svg)

![Filter surface growth](/assets/charts/c2-filter-surface.svg)

![Floor vs registry](/assets/charts/c3-floor-vs-registry.svg)

That third chart is the punchline in one picture: a flat-ish essential line under a climbing registry. **Inventory is not context.**

---

## Dead ends

### 1. "Just load everything"

First instinct with MCP: register it all. Same first instinct with skills later: install the marketplace, symlink the vault, hope progressive disclosure saves you.

It does not. Tool definitions are expensive *attention*, not just tokens. When fifty vaguely relevant tools compete with the one that would have worked, models do what they always do under ambiguity: invent a plausible answer, pick a near-neighbor tool, or thrash.

### 2. "Smarter prompts will route better"

I tried telling the model about groups, about when to escalate, about not fabricating tools. Helpful until the catalog was large enough that the model spent more context *reading the policy* than using tools. Prompt text is not a substitute for not putting the wrong tools in the payload.

### 3. "Defer tools / search tools natively and cold-start will work"

Anthropic-style tool deferral and BM25-ish tool search are great at ranking among definitions **already in the request**. They cannot invent a schema for a server that never started. We learned this the expensive way in AutoHub PR **#719**: if `request_tool_group` is deferred into the same soft-search pool as everything else, the escape hatch loses positional priority to hot tools and the model never recovers the lazy groups. The hatch has to stay **eager**. Lazy MCP cold-start is a host concern, not a ranking problem.

### 4. "Skills as another MCP server"

I tried treating skills like tools: register a skill server, call `get_skill`. That is the wrong interface for Claude Code / Codex / Cursor-shaped hosts. They want files on disk in known skill directories, not another always-on schema. That dead end is why [AutoVault](https://autovault.dev) is a **filesystem vault with profile sync**, not a skill MCP marketplace.

### 5. "One local model for chat *and* tools"

Voice made this obvious. A warm, abliterated Qwen that sounds great on chat can score 100% on tool *selection* and still fail to close a multi-step tool loop. Selection accuracy without loop completion is a voice that says "timer set" without setting a timer. More on the numbers below.

---

## Pivot

The reframe that stuck:

> **Not "how do we help the model choose among 800 tools?"**  
> **"How do we make sure the model only ever sees ~20–40 tools that could plausibly be relevant right now?"**

Three files split the work:

| File | Job |
|------|-----|
| `config/mcp-servers.json` | Process inventory — how to start servers, credentials, lazy vs always-on. Ops config, not prompt content. |
| `config/mcp-tools.json` | Scanned registry of every tool name/schema the hub knows (~1.5 MB). Resolve names when a group is enabled. **Not** dumped every turn. |
| `config/tool-filters.json` | Profiles + groups + context rules + always-enabled floor. **This is the product.** |

Pattern: **registered ≠ callable**. A tool can sit in the registry forever and never enter the prompt until a baseline group, an intent rule, or an explicit `request_tool_group` says so.

![Architecture](/assets/charts/c5-architecture.svg)

---

## How it works

### Profiles: who is speaking, what is the floor

Owner chat (`owner-auto`) is not the kitchen sink. Guest WhatsApp is almost nothing. Voice is its own profile. Simplified from live config:

```json
{
  "owner-auto": {
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
  },
  "guest": {
    "description": "Shared guest profile — conversational + web search + weather ONLY",
    "groups": ["guest_search", "weather"],
    "ownerFeatures": {
      "allowFullOnRequest": false,
      "expandIntentServers": false
    }
  }
}
```

Guest does **not** get `essential` (which bundles memory + comms). Guest search is deliberately a thin group so private GitHub search tools never leak through a shared "search" label. Permission scoping is a filter concern, not a system-prompt paragraph.

### Tool groups: packages, not individual tools

Sixty groups map names to concrete tool IDs. `essential` is the always-on floor — **23** tools as of 2026-07-20 (memory CRUD, fetch, people lookup, a few messaging primitives). Groups exist so intent rules can say `enableGroups: ["email"]` instead of listing fifteen Google Workspace schemas.

### Context rules: speech → package

When the user's words match a pattern, enable groups and optionally **start** lazy MCP servers:

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
  "id": "home-assistant-intent",
  "pattern": "\\b(home assistant|smart home|lights|thermostat|hvac|garage door)\\b",
  "enableGroups": ["home_assistant"],
  "startServers": ["home-assistant"],
  "priority": 5
}
```

```json
{
  "id": "timer-intent",
  "pattern": "\\bset (?:a |an )?timer\\b|\\btimer for\\b|\\bremind me in\\b",
  "enableGroups": ["timers"],
  "startServers": ["automation-hub"]
}
```

Regex is undignified and effective. It does not require a classifier call. It fails open into the escape hatch when speech is weird. That is fine — weird speech is exactly when you want the model to *ask for a group* instead of inventing tools.

### The escape hatch: `request_tool_group`

When baseline is wrong and no rule fired, the model requests a group. Not a free-form "please invent a tool named calendar_create_event_v2." A named package the host already knows how to grant and start.

Critical constraints we learned in production:

1. **Eager, always.** Do not defer the hatch into soft tool search.
2. **Reachable from every tool loop that can starve.** Offline/local native loops could not call it when it lived only as a Claude server-tool outside `mcpClient` — the model was fabricating results. On 2026-06-26 usage data it was the **4th most-used tool overall (277 calls)** and still unreachable from the offline path until we wired `onToolGroupRequest` mid-loop merge.
3. **Mid-loop grant must expand the live tool set**, not just log a wish. Changing the tool block mid-conversation has cache costs (MLX prompt cache busts when the tool list thrashs) — so the *core* set should stay stable and grants should be additive, not thrashing 2→5→17 tools every turn.

### Global settings (the boring knobs that matter)

```json
{
  "globalSettings": {
    "maxToolsPerRequest": 100,
    "enableContextAwareness": true,
    "defaultMode": "contextual",
    "lazyServerStartup": true,
    "assistantIntentExpansion": true
  }
}
```

Hard cap at 100 tools per request is a backstop, not a strategy. The strategy is never approaching the cap on a normal turn.

### Voice: local turn router + local native tools

Voice made cost and latency undeniable. Cloud Sonnet with a fat tool list is wrong for "set a timer" and "what's the weather." Local Qwen/MLX is cheap and private — only if you starve it the same way.

- `local-turn-router.js` classifies a turn against the **same** `tool-filters.json` intent source of truth (not a second hard-coded keyword list that drifts).
- Casual chat → stay local, minimal tools.
- Memory-shaped → local + memory tools.
- Search / research / messaging-shaped → escalate to cloud with the right groups.
- Experimental local tool loop (`local-native-tools.js`, gated by `VOICE_LOCAL_NATIVE_TOOLS`) → only allowlisted groups on-device; multi-round tool loop; force a final spoken answer when the model wants to tool-call forever.

Architecture in one sentence, again:

> **A small model decides which package of tools/skills the big model is allowed to see.**

Sometimes the "small model" is literally hermes3:8b. Sometimes it is a regex table. The important part is the **package boundary**, not the classifier IQ.

---

## Numbers / charts

The charts under `content/assets/charts/` (uploaded to WP later as assets):

| Chart | File | What it shows |
|-------|------|----------------|
| Registered tools | `c1-registered-tools.svg` | MCP tool count over time, cleanup dip visible |
| Filter surface | `c2-filter-surface.svg` | Groups, rules, profiles climbing with inventory |
| Floor vs registry | `c3-floor-vs-registry.svg` | Essential tools flat; registry large |
| Offline eval | `c4-offline-tool-eval.svg` | hermes vs qwen family on the 2026-06-16 spike |
| Architecture | `c5-architecture.svg` | Inventory → filter → package → model |
| Skills non-monotonic | `c6-skills-nonmonotonic.svg` | Conceptual: few skills help, more can hurt (external research shape) |

![Offline tool eval](/assets/charts/c4-offline-tool-eval.svg)

![Skills non-monotonic (conceptual)](/assets/charts/c6-skills-nonmonotonic.svg)

HEAD snapshot (2026-07-20, sha `4920cbb01071`):

| Surface | Count |
|---------|------:|
| MCP servers in registry | 32 |
| Tools in `mcp-tools.json` | 813 |
| Tool groups | 60 |
| Context rules | 60 |
| Profiles | 16 |
| Essential tools | 23 |
| Always-enabled subset | 5 |
| Explicitly disabled | 120 |

Always-enabled is even tighter than essential: memory store/recall/associate, fetch, and one house-specific tool. Essential is the owner floor; always-enabled is the nuclear "never strip these even if a profile is weird" list.

---

## Offline model experiments

Spike notes (AutoMem + AutoHub, **2026-06-16**): 13-prompt eval, real stdio MCP (filesystem + everything), curated ~10-tool read-only catalog, M5 Max.

| Model | correctTool | correctArgs | loopCompletion | Notes |
|-------|------------:|------------:|---------------:|-------|
| **hermes3:8b** | 89% | 78% | **100%** | ~1.2s/turn — **GO** for curated ~10-tool catalog |
| qwen3.6-abliterated (warm voice) | **100%** | 100% | **22%** | Cannot reuse for tools — fails to close the loop |
| qwen3-coder:30b | 78% | — | — | Systematic blind spots; heavier |

Conclusion we actually shipped against: local grunt-work function calling is feasible **only** with a separate small FC-tuned model (or a carefully constrained loop) plus a curated catalog. The chat model that "feels smart" is not automatically the tool model.

**2026-06-26** voice-core follow-up:

- Stabilized `LOCAL_NATIVE_CORE_TOOLS` at ~**20** tools every local native turn (plus `request_tool_group`).
- Tool-set thrash had been swinging **2 → 5 → 17** tools and producing **fake tool calls** when follow-ups starved.
- Changing the tool block mid-stream busts the **MLX prompt cache** — another reason the core set must be stable.
- `request_tool_group` was 4th most-used overall (**277** calls) but unreachable from the offline loop until wired as a live mid-loop grant.

I am not claiming offline replaces cloud for hard multi-server workflows. I am claiming: **if you want local tools, starve first, then measure loop completion, not just selection accuracy.**

---

## Map to AutoVault's six homepage problems

[AutoVault](https://autovault.dev) frames six problems for the skills era. They are not new. They are MCP scars with a `SKILL.md` haircut.

### 1. Skill drift

**MCP scar:** every host and every profile accumulated slightly different tool lists, disabled flags, and "temporary" always-on exceptions. Without a single filter file, drift was the default.

**Skills recurrence:** the same `SKILL.md` copy-pasted across repos and adapted locally — vendored code without a lockfile. AutoVault's answer is one canonical vault path + signatures. AutoHub's answer for tools was one `tool-filters.json` as source of truth for *visibility*, not seventeen router forks.

### 2. Supply chain attacks

**MCP scar:** any server you add can expose tools that read secrets, mutate prod, or exfiltrate via a friendly description. Registry admission without review is how you get 800 tools and a bad day.

**Skills recurrence:** the same class of attacks that hit package registries will hit skill marketplaces. Gate before admission. Do not "install all."

### 3. Duplicate explosion

**MCP scar:** overlapping tools across servers (three ways to search, two ways to send a message). Models pick near-neighbors.

**Skills recurrence:** seventeen variants of `extract-pdf-text`. Agents write skills mid-conversation with no dedup. Selection accuracy dies even if each body is progressive-disclosed.

### 4. Platform inconsistency

**MCP scar:** tool names differ by server; profiles differ by surface (Discord guest ≠ owner chat ≠ voice).

**Skills recurrence:** Claude Code wants `read`, Codex wants `file_read`, Cursor wants `fs_read`. Fork once, maintain three — unless something renders per caller from one canonical skill (AutoVault's job).

### 5. Context bloat

**MCP scar:** this entire post. 813 tools in registry, 23 on the floor.

**Skills recurrence:** every agent loading every skill *description* at startup is MCP schema spam with markdown lipstick. Progressive disclosure fixes bodies. Metadata still competes. SkillsBench-style results show **2–3 skills help most**, more can flatten or reverse gains ([SkillsBench](https://arxiv.org/html/2602.12670v1)); surveys note selection phase transitions at library scale ([Agent Skills survey](https://arxiv.org/html/2602.12430v3)).

I will not claim skills "fixed" context bloat. They changed *where* the bloat lives.

### 6. No permission scoping

**MCP scar:** guest profiles that accidentally inherit `essential` and get memory + private messaging. Context rules that `startServers` with a `*` wildcard and bypass role filters. Owner-only mutations that must be enforced at the filter layer because tool handlers may not receive caller identity.

**Skills recurrence:** skills load globally; dev-machine skills leak into prod; client A skills leak to client B. Scoping is not optional product polish — it is the same "who is speaking" problem profiles already solved for tools.

---

## What's working / isn't / next

### Working

- **Floor vs registry discipline.** Essential stayed ~15–23 while tools went 0 → 800+.
- **Intent rules as config, not code.** Adding Stream Deck or FreeScout is a group + rule + lazy server entry, not a router rewrite.
- **Eager `request_tool_group`.** High-usage escape hatch; cold-start for lazy MCP is real.
- **Profile-scoped surfaces.** Guest/collaborator/owner/voice actually get different tools.
- **Offline GO path on curated catalogs.** hermes3:8b at ~1.2s/turn with full loop completion on a ~10-tool set.
- **Same filter file for voice and chat.** One intent source of truth.

### Isn't (yet)

- **Regex intent is not language understanding.** Multilingual speech, indirect asks, and multi-intent turns still fall through to the hatch or escalate too early/late.
- **Local native tools still default-off** until live multi-turn voice validation is done. Tool-trained models will claim success without calling tools if you let them.
- **Skills activation is less mature than tool activation.** Hosts that load all skill metadata from a directory still tax every session; vault sync helps inventory hygiene more than per-turn starvation today.
- **Filter complexity is itself a product.** 60 rules and 60 groups need review, tests, and ownership — or they become the new bloat.

### Next

- Tighter skill **packages** that mirror tool groups (activate a small set by intent, not "all descriptions always").
- Better offline routing without thrashing tool lists (stable core + additive grants only).
- Continued registry hygiene — March-style cleanup should be routine, not a panic.
- Measuring selection quality the way we measure offline loop completion: not vibes, not "the model seemed to know."

---

## Caveats

- **Numbers are from one repo's git history** (`verygoodplugins/autohub`), sampled at specific dates. Your inventory curve will differ. The shape — floor vs registry — is the transferable claim.
- **Offline benchmarks are a spike**, not a leaderboard paper. 13 prompts, specific hardware, curated catalog. Do not cite them as universal model rankings.
- **Skills non-monotonic chart is conceptual**, grounded in external research (SkillsBench, agent-skills survey), not an AutoHub production A/B.
- **I am not claiming** progressive disclosure is useless. It is necessary. It is not sufficient at catalog scale.
- **I am not claiming** skills fixed context bloat completely. They moved the problem.

---

## Links

- Short version: [Skills Are the New MCP Bloat](https://skillissue.sh/essays/skills-are-the-new-mcp-bloat/)
- [AutoVault](https://autovault.dev) — the six problems, signed vault, per-caller render
- [Model Context Protocol](https://modelcontextprotocol.io/)
- Anthropic: [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- Anthropic: [Equipping agents for the real world with agent skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- [SkillsBench (arXiv)](https://arxiv.org/html/2602.12670v1)
- [Agent Skills for Large Language Models — survey (arXiv)](https://arxiv.org/html/2602.12430v3)

Chart sources for this post: `/assets/charts/c1-registered-tools.svg` … `c6-skills-nonmonotonic.svg`. Data harvest: `content/data/tool-timeline.json`.

— Jack
