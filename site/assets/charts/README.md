# Phase 1 charts — skills-are-the-new-mcp-bloat

Self-contained SVG charts for the skillissue essay. Dark-friendly palette
(`#0f1419` bg, mint `#5ad6c0`, blue `#7aa2ff`, warn `#f0b429`).

## Generation

```bash
node scripts/generate-charts.mjs
```

Authoritative data: [`content/data/tool-timeline.json`](../../data/tool-timeline.json)

| Field | Value |
|-------|-------|
| Generated | 2026-07-20 |
| Data `generatedAt` | 2026-07-20T10:53:28.597583Z |
| HEAD date | 2026-07-20 |
| HEAD fullSha | `4920cbb010716700cce19370784ec6483b2a7e1d` |
| Repo harvested | `verygoodplugins/autohub` |
| Method | Sample git rev-list --before each date; parse config/tool-filters.json and config/mcp-tools.json. Deduped consecutive identical metric tuples. |

## Charts

| File | What | Data source |
|------|------|-------------|
| `c1-registered-tools.svg` | Multi-series: mcpTools (when present), groups, contextRules over time | `timeline[]` git samples of mcp-tools.json + tool-filters.json |
| `c2-filter-surface.svg` | groups / profiles / contextRules line chart | `timeline[]` tool-filters.json only |
| `c3-floor-vs-registry.svg` | Bar: 813 registered vs 23 essential | `current.mcpTools`, `current.tf_essentialTools` |
| `c4-offline-tool-eval.svg` | Grouped bars: correctTool + loopCompletion for 3 models | `offlineBenchmarks.spike_2026_06_16.models` |
| `c5-architecture.svg` | Flow: Registry → Profile → Intent rules → escape hatch → lazy start | Conceptual architecture; counts from HEAD |
| `c6-skills-nonmonotonic.svg` | Conceptual inverted-U (peak ~2–3 skills) | **Not measured** — SkillsBench-inspired shape |

## Spot-check values (must match JSON)

- Registered tools (HEAD): **813**
- Essential always-on: **23**
- Groups / profiles / rules: **60** / **16** / **60**
- Servers: **32**
- hermes3:8b correctTool: **89%**, loopCompletion: **100%** → GO
- qwen3.6-abliterated correctTool: **100%**, loopCompletion: **22%** → NO
- qwen3-coder:30b correctTool: **78%**, loopCompletion: n/a → NO
- Voice core LOCAL_NATIVE_CORE_TOOLS: **20**

## Timeline highlights baked into C1/C2

| Date | mcpTools | groups | essential | notes |
|------|----------|--------|-----------|-------|
| 2025-09-15 | — | 12 | 5 | pre-registry |
| 2025-10-15 | — | 18 | 14 | |
| 2025-12-15 | 494 | 22 | 16 | first mcp-tools.json |
| 2026-02-15 | 779 | 26 | 18 | mid peak |
| 2026-03-01 | 552 | 33 | 19 | registry cleanup |
| 2026-06-26 | 723 | 57 | 23 | essential → 23 |
| 2026-07-20 | 813 | 60 | 23 | HEAD |

## Design notes

- ViewBox ~720–880 × 360–440; system font stack; no external CSS/fonts
- Transparent-safe dark strokes; solid charcoal background for blog embeds
- C1 dual-axis: mcpTools left (0–900), groups/rules right (0–70)
- C6 explicitly labeled conceptual — do not treat as measured AutoHub data
- C4 omits loopCompletion bar when JSON has `null` (qwen3-coder)

## External citations (C6)

- SkillsBench: https://arxiv.org/html/2602.12670v1
- Agent skills survey: https://arxiv.org/html/2602.12430v3
