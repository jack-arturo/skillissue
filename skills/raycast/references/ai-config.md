# AI: providers, skills, commands, agents

Read this when the task is: **point Raycast AI at a model/provider**, **write
a Raycast AI Skill**, **draft/import AI Commands**, or **change an Agent
(preset)'s instructions**. For launching commands/deeplinks or Script
Commands see `control-surfaces.md`.

---

### Providers (`providers.yaml`) — agent-writable

Path: `~/.config/raycast/ai/providers.yaml`
Template: `~/.config/raycast/ai/providers.template.yaml`

Jack already points an **AutoJack (Local)** provider at
`http://localhost:8767` with Claude/local model ids. Edit model list /
`base_url` with care; **never echo api_keys**.

After edits, relaunch Raycast or re-open AI settings if models do not
refresh.

### AI Skills — preferred programmable prompts

Raycast scans (defaults):

- `~/.claude/skills`
- `~/.config/agents/skills`
- `~/.config/raycast/skills`
- `~/.agents/skills`

Layout:

```text
~/.config/raycast/skills/<name>/SKILL.md
```

`SKILL.md` needs YAML frontmatter with `name` + `description` (Agent
Skills style). Folder name must match `name`. Raycast caches ~60s.

```bash
mkdir -p ~/.config/raycast/skills/my-skill
# write SKILL.md with name: my-skill and a when-to-use description
```

Skills apply in **AI Chat / Quick AI** (tool-capable models), not in
AI Commands. Mention with `@` or rely on auto-discovery.

**AutoVault overlap:** many `~/.claude/skills/*` are already visible to
Raycast if that folder is enabled. Prefer writing Jack-specific Raycast
AI packs under `~/.config/raycast/skills` so they are not confused with
Claude Code operator skills.

### AI Commands — one-shot prompts

- Create: Root Search → **Create AI Command**
- Manage: **Search AI Commands** (edit ⌘E, duplicate ⌘D, share)
- **Import AI Commands** accepts a JSON file of commands

Agent workflow for bulk prompt packs:

1. Author a JSON pack (export one command from Raycast once to learn shape, or use Import docs).
2. Save under a project path (no secrets).
3. Open **Import AI Commands** (deeplink if known, else tell Jack to run it) and select the file.

Placeholders in prompts: `{selection}`, `{argument name="…"}`,
clipboard/date placeholders — see Dynamic Placeholders manual.
`@extension` mentions pull AI Extensions into a command.

### Agents (ex-Presets) — mostly UI

Settings → AI → Agents: name, instructions (system prompt), model,
scoped AI Extensions. Community: [ray.so/presets](https://ray.so/presets).

Agents do **not** have a documented local file CRUD API. Skill can
draft instruction text for Jack to paste, open Agents settings via
UI navigation, or install from a share link — not silent rewrite.

### Personalization — UI

Profile + Memory under Settings → AI → Personalization. Do not scrape
encrypted DB.

### PromptLab (installed)

Extension `promptlab` / author `HelloImSteven` — community prompt lab
with create/search/import/chat commands. Useful when Jack wants
PromptLab-native flows; still secondary to first-party AI Skills for
file-based agent control.

```bash
open 'raycast://extensions/HelloImSteven/promptlab/search-commands'
open 'raycast://extensions/HelloImSteven/promptlab/import-commands'
```
