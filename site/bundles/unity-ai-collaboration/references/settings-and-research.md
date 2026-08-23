# Reviewed settings and research loop

## Scope the settings correctly

- Unity Assistant permissions and Meta XR bridge preferences are user-level
  `EditorPrefs` values. They already apply to every compatible project on the
  machine; audit them from a live, explicitly targeted Editor.
- Assistant checkpoints and custom instructions are project settings. Commit a
  reviewed `ProjectSettings/Packages/com.unity.ai.assistant/Settings.json`.
- Package pins, OpenXR, Android, graphics, and runtime behavior are project
  settings. Promote them through the Quest verification ladder.
- Tokens, provider credentials, account disclaimers, organization seats, model
  choices, and provider enablement are private user/account state. Never copy or
  auto-accept them.

The reviewed machine baseline is
`unity-ai-settings-baseline.json`. Audit without changes:

```bash
configure-unity-ai-settings --project /absolute/project --json
```

Apply only with one named writer:

```bash
configure-unity-ai-settings --project /absolute/project --apply --json
```

## Why the bridge servers are on demand

Meta XR Core 203 defaults the authenticated AI Tools Bridge to auto-start, but
its listener binds all interfaces and uses one fixed port. Multiple open Unity
Editors can collide on that port, leaving an agent connected to a different
project than intended. Keep both Meta remote-server auto-start settings off;
start the required bridge for one targeted project and stop it at handoff.

Meta Agent Bridge currently offers Claude Code and Gemini CLI. The reviewed
baseline retains a locally validated Claude Code route, while Unity Assistant
and AI Gateway remain separate Unity surfaces. Do not describe Meta Agent
Bridge, Unity Assistant, AI Gateway, official Unity MCP, or Ivan MCP as one
interchangeable service.

## Research without autonomous production mutation

Run the drift scout weekly and after package, Editor, MQDH, Simulator, Horizon
OS, or Quest SDK releases. Search in this order:

1. Installed package source, manifests, changelogs, and live tool schemas.
2. Official Unity, Meta, Khronos/OpenXR, Android, and vendor release notes or
   documentation.
3. Reproducible upstream issues and maintainers' discussions.
4. Social posts, forums, videos, and news as discovery signals only.

Every recommendation records source URL, publication and event dates, affected
version range, local applicability, security/credit implications, confidence,
and a falsifiable canary. A social claim never changes the baseline by itself;
confirm it in primary material or reproduce it in an isolated compatibility
worktree.

The scout may update a research report and prepare a review branch. It must not
rotate credentials, accept terms, spend generation credits, change production
package pins, start a LAN listener, rewrite Git history, force-push, or promote
an Editor/SDK/Simulator combination. Promotion requires a human-reviewed diff,
clean secret scan, skill/settings validation, repeated Assistant evaluation,
simulator suite, deterministic build, and hardware acceptance where relevant.
