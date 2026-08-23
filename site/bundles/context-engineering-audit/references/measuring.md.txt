# Measuring what a session loads

The goal is a per-source table that sums to a real total, not an estimate from
file sizes. Token estimate: chars / 4.

## Sources, roughly in size order

| Source | Where to find it |
|---|---|
| Imported instruction file | The repo file `CLAUDE.md` imports (often `AGENTS.md`). Both may load — see the double-load note below. |
| Skill listing | Every visible skill's frontmatter `description`, concatenated. Always loaded, whether or not a skill is used. |
| Global instruction file | `~/.claude/CLAUDE.md` — often a symlink; check where it really points before editing. |
| Deferred tool names | The tool-search name list, if the host defers tool schemas. |
| Agent listing | Every subagent's frontmatter `description`. |
| MCP instruction blocks | Per-server `instructions` text, injected at connect. Not always on disk — some are runtime-provided. |
| Hook output | Anything a SessionStart hook writes to stdout. |

## Reading the transcript

Hosts that record attachment records in a session JSONL give exact byte counts
per source. Look for records describing the skill listing, agent listing,
deferred-tool deltas, and MCP instruction blocks, and sum their payload sizes.
This beats guessing, and it catches sources you didn't know existed.

Instruction files usually land in the *system prompt*, not the transcript — if
grepping the transcript for a distinctive line from `AGENTS.md` returns nothing,
that is expected, and the file's own size is the number to use.

## Counting per-file

```bash
wc -c CLAUDE.md AGENTS.md
grep -c '^#\{1,3\} ' AGENTS.md        # section count
```

For a section-by-section table, split on headings and measure each:

```bash
awk '/^## /{name=$0; next} {len[name]+=length($0)+1} END{for (n in len) print len[n], n}' AGENTS.md | sort -rn
```

## Imperative density

Measure before assuming a file is coercive:

```bash
grep -oE '\b(NEVER|ALWAYS|MUST|CRITICAL|MANDATORY|BANNED)\b' AGENTS.md | wc -l
```

Divide by (chars / 1000). Under ~1 per 1k chars is already judgment-framed;
the problem there is volume, not tone.

## Two things that distort the total

- **Possible double-load.** If `CLAUDE.md` imports `@AGENTS.md` *and* the host also reads `AGENTS.md` natively, that content may be counted twice. Confirm with `/context` rather than assuming either way.
- **Suppressed entries.** Skill and plugin overrides can hide a large fraction of the listing. Measure what is actually visible in the session, not what exists on disk.
