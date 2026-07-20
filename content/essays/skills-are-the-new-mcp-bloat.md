---
title: Skills Are the New MCP Bloat
description: Progressive disclosure fixes skill bodies. It does not fix skill catalogs. What AutoHub learned starving models of tools — short version, with the lab notebook on drunk.support.
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
3. **AutoHub already solved the MCP side** with a lean baseline, intent rules, a scanned registry, lazy server start, and an escape hatch when routing misses.
4. **The skills wave is replaying 2025.** Public catalogs fill with clones; research is measuring non-monotonic returns past a handful of skills; agents that dump every description into the system prompt are back at square one.
5. **The durable pattern:** inventory big, **load small**, escalate only when intent is clear — whether the unit is an MCP tool or a `SKILL.md`.

## Inventory is not context

On this machine's AutoHub config (July 2026), the honest inventory looks like this:

| Surface | Count |
|---|---|
| MCP servers registered | **32** |
| Tools in the scanned registry | **813** |
| Tool groups | **60** |
| Context / intent rules | **60** |
| Profiles | **16** |
| Always-on *essential* tools | **23** |
| Local AutoVault skills | **~108** |
| Public packages on [skillissue.sh](https://skillissue.sh) | **30** |

If I dumped every MCP tool definition into every turn, the conversation would be over before it started. The registry file alone is about **1.5 MB** of catalog JSON. That's inventory.

**Inventory is not context.**

![813 tools registered vs 23 always-on](/assets/charts/c3-floor-vs-registry.svg)

Those counts aren't a marketing slide. They're sampled from git history on the AutoHub repo — `tool-filters.json` since late August 2025, `mcp-tools.json` from December 2025. Essential tools barely moved after mid-October (14 → 23 over nine months) while the registry climbed past eight hundred. The full time series and methodology live in the deep writeup.

![Registered tools and filter surface over time](/assets/charts/c1-registered-tools.svg)

## Same movie, skills edition

Progressive disclosure **does** help. Anthropic's [Agent Skills design](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) is explicit: frontmatter is cheap; the body loads when triggered. Claude's docs describe the same three-level model.

That solves "I don't want a 40k-token brand bible in every turn."

It does **not** solve forty skills whose descriptions all vaguely match "deploy," clone families in public catalogs, or the phase transition where selection accuracy collapses past a critical library size ([survey](https://arxiv.org/html/2602.12430v3), [SkillsBench](https://arxiv.org/html/2602.12670v1)).

> Skills aren't free because they're markdown. Metadata still competes for attention. Bad catalog design is just MCP bloat wearing a friendlier hat.

That's also why [AutoVault](https://autovault.dev) is a **filesystem vault with profile sync**, not another skill MCP marketplace — and why its homepage names six problems that compound the more skills you keep around: **drift, supply chain, duplicates, platform forks, context bloat, and no scoping**.

## What "load small" looks like in practice

The hub never pretends the model can see everything:

| Layer | Job |
|---|---|
| Registry | Know everything |
| Profile baseline | Pay for almost nothing |
| Intent rules | Pay a little when speech matches |
| Escape hatch (`request_tool_group`) | Pay on demand when the model notices a gap |
| Lazy server start | Don't boot heavy MCP processes until needed |

Same shape for skills if you do it right: catalog wide, activate narrow. [skillissue.sh](https://skillissue.sh) is deliberately **not** a dump of all ~108 local vault skills. Thirty public packages with stories. The rest stay offline until they earn a page.

**Publish is not the same as load.**

## The lab notebook

This page is the friendly overview.

The homework — git-derived tool-count timelines, offline model tool-calling benches (hermes3:8b ~89% correct tool / 100% loop completion vs a warm Qwen that selected perfectly and only finished the loop ~22% of the time; stable ~20-tool voice core after we stopped thrashing the tool set mid-conversation), architecture diagrams, and the full mapping onto AutoVault's six pains — is drafted for drunk.support:

**[Inventory Is Not Context: How AutoHub Learned to Starve Models of Tools](https://drunk.support)** *(deep post; permanent slug after publish)*

Until that post is live, the data and chart sources are in this repo: [`content/data/tool-timeline.json`](https://github.com/jack-arturo/skillissue/blob/main/content/data/tool-timeline.json) and [`content/assets/charts/`](https://github.com/jack-arturo/skillissue/tree/main/content/assets/charts).

## If you're drowning

Stop adding. Start routing.

- Don't install every marketplace skill into every agent profile.
- Keep a baseline. Expand on intent. Give the model an explicit way to ask for more.
- Prefer fewer, better skills over seventeen near-clones of `extract-pdf`.
- When someone says "skills fixed MCP context bloat," ask: **for the body, or for the catalog?** Only one of those is automatic.

— Jack

### Further reading

- Deep post (this story with charts) — [drunk.support](https://drunk.support) *(Inventory Is Not Context)*
- [AutoVault](https://autovault.dev) — the six problems + vault model
- Anthropic — [Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills), [context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- SkillsBench — [arXiv](https://arxiv.org/html/2602.12670v1)
- Survey — [Agent Skills for LLMs](https://arxiv.org/html/2602.12430v3)
- Install skills from this site — [/install/](/install/)
