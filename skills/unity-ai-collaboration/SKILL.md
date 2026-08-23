---
name: unity-ai-collaboration
description: Use when coordinating Unity Assistant, AI Gateway, Unity MCP servers, external coding agents, or read-only subagents on the same Unity project, especially when concurrent writes, paid generation, credentials, profiler evidence, or editor handoffs are possible.
license: MIT
tags: [unity, assistant, ai-gateway, mcp, codex, collaboration, profiler, quest]
agents: [claude-code, codex, autojack]
category: unity
metadata:
  version: "1.2.0"
capabilities:
  network: true
  filesystem: readwrite
  tools: [Bash, Read, Edit, Write]
resources:
  - path: story.md
    type: file
  - path: agents/openai.yaml
    type: file
  - path: references/responsibility-matrix.md
    type: file
  - path: references/safety-and-handoffs.md
    type: file
  - path: references/settings-and-research.md
    type: file
  - path: references/unity-ai-settings-baseline.json
    type: file
  - path: scripts/configure-unity-ai-settings
    type: file
  - path: scripts/test_configure_unity_ai_settings.py
    type: file
bin:
  configure-settings:
    command: scripts/configure-unity-ai-settings
    description: Audit or explicitly apply reviewed non-secret Unity and Meta AI user defaults.
    requires-tty: false
---

# Unity AI collaboration

Treat Unity Assistant as the in-editor AI surface and Unity Hub as the manager
for Editor installs, modules, licensing, organization linkage, and projects.
Do not describe Hub itself as the collaborating agent.

## Assign exactly one writer

Before any mutation, name one writer for the current phase. That writer owns
Unity serialization, imports, scene/prefab/asset changes, package resolution,
tests that mutate the project, builds, installs, and captures. Other agents may
research or inspect only. Read-only subagents must not call MCP tools with side
effects, enter Play Mode, trigger imports, or write files.

Use the project's cross-worktree Unity and deployment locks. Wait for imports,
compiles, tests, builds, and ADB operations to settle before handing ownership
to another writer. Never ask Unity Assistant and an external agent to edit the
same project concurrently.

## Use Assistant modes deliberately

- **Ask**: explain, inspect supplied context, answer API/tooling questions, and
  propose focused diagnostics. Keep it read-only unless the operator explicitly
  changes the task.
- **Plan**: explore the project read-only, define files/tools/evidence, identify
  risks, and produce an ordered plan. A Plan is not permission to execute it.
- **Agent**: execute an approved, bounded editor-local task as the assigned
  writer, then run relevant tests and report exact changes and evidence.

Start a new Assistant conversation after adding, changing, rescanning, allowing,
or denying an AI Skill. Old conversations retain their original skill context.
Read `references/responsibility-matrix.md` before combining surfaces.

The checked-in settings baseline deliberately does not choose an AI provider or
model. Choose those per project and per user after verifying entitlement, cost,
and the intended task; the settings helper rejects provider/service/model keys
before it can write EditorPrefs.

## Route by comparative advantage

- Use Unity Assistant for scene-aware, visual, asset, and short editor-local
  work where live Unity context matters.
- Use Unity Default/Lite for routine work. Use a higher-cost model only when the
  visual or architectural difficulty justifies it.
- Use AI Gateway's bundled Codex only for short editor-local tasks. Use Codex
  Desktop for repository-scale changes, history, scripts, broad filesystem
  context, and multi-file verification.
- Use the official Unity MCP relay for supported high-level operations,
  explicit project/PID targeting, and paid Unity AI generation
  (`Unity_AssetGeneration_GetModels` then `GenerateAsset`: materials + PBR,
  meshes with retopology/texture/rig, sprites/images/cubemaps, humanoid
  animation from text or video, sound). Prompts for materials/shaders must
  state the render pipeline (URP) and mobile/Quest target explicitly, or
  generation defaults to Standard-shader output that renders magenta on URP.
- Use IvanMurzak MCP for path-scoped reads, JSON patching, deep object/asset
  access, tests, profiler, screenshots, packages, particles, editor C#
  execution (`script-execute`, `reflection-method-*`), and other verified
  editor surfaces.
- Use the Meta XR runtime bridge (Meta XR Core SDK AI Tools) for Quest
  project-setup validation and auto-fix (`UPSTTools`), structured compile
  state (`CompilationTools`, `CodeAnalysisTools`), async test runs
  (`TestRunnerTools`), GameObject/component operations (`SceneObjectsTools`),
  Building Block install/config (`BuildingBlocksTools`), and editor-window
  capture/drive (`UIVerificationTools`, `InteractionTestingTools`).
- Use Meta XR Operator (Core SDK v205+, OpenXR API layer) to drive and verify
  a RUNNING XR session: head/controller pose injection, controller input,
  composited-image capture, spatial entities. Runtime-only — its tools error
  outside an active session, and its evidence is simulator-grade.
- Use shell scripts for deterministic builds, manifests/APKs, Git, locks, and
  reproducible audits. Use Meta XR Simulator, MQDH, and physical Quest hardware
  for progressively stronger runtime evidence.

All of these surfaces drive the same live Editor. The single-writer rule
applies across servers, not per server: overlapping tools (IvanMurzak
`tests-run` vs `TestRunnerTools`; `gameobject-*` vs `SceneObjectsTools`)
share underlying Editor state — pick one surface per phase and serialize.

For PCA work, Simulator can prove surrounding XR/stereo plumbing and synthetic
eye composition but cannot replace advancing live-camera evidence. Require a
standalone Quest build for real PCA; Meta's PCA Camera API is not supported over
Quest Link.

Do not add `[AgentTool]`, `[McpTool]`, or IvanMurzak `[AiTool]` APIs (via
`unity-skill-create`) until repeated evaluation proves a missing operation.
Do not duplicate an official, Ivan, or Meta-bridge tool. Keep
`com.ivanmurzak.unity.mcp` and its companion packages (`.particlesystem`,
`.animation`) version-locked — a mismatch is a project-wide compile failure.

## Protect credentials and paid operations

Keep MCP credentials out of repositories, prompts, logs, generated skills, and
screenshots. Configure Assistant extensions locally and keep real `.mcp.json`
and `UserSettings/mcp.json` ignored. Commit localhost-only examples with no
headers or tokens. Verify the Unity organization seat is assigned and the
project is linked to that organization; owned credits alone do not prove AI
Gateway or MCP entitlement. The local Licensing Client lists Editor products,
not the cloud Unity AI named-user seat; verify each surface independently.

Before asset generation, obtain explicit operator consent for the proposed
provider, asset type/count, destination, and expected credit use. Bound the wait,
preserve generation provenance and license/usage metadata, inspect the result,
and remove disposable smoke assets. Never interpret a long generation wait as
permission for an unbounded retry.

## Checkpoint and profiler policy

Keep Unity Assistant checkpoints disabled while external agents or another
writer may touch the project. Enable checkpoints only on a clean isolated branch
where Assistant is the sole writer and recovery behavior has been tested.
With Assistant 2.14, `CheckpointEnabled: false` alone does not prevent the
first-time discovery banner from auto-initializing and enabling checkpoints.
Persist the package's explicit discovery user-disabled/dismissed opt-out fields
and verify them after import.

Capture a safe Git checkpoint before a risky package, scene, prefab, or generated
asset mutation. Use Unity Profiler counters and Ivan/MQDH/Perfetto evidence for
performance claims; visual inspection alone is not a frame-time result.

## Audit user settings instead of copying Preferences

Run `scripts/configure-unity-ai-settings --project <path>` before an Assistant
or Meta bridge canary. Add `--apply` only when the operator has approved the
reviewed baseline and this Editor is the sole writer. The baseline keeps normal
project reads available but approval-gates external reads, project writes,
third-party tools, Play Mode, screen capture, generated code, and paid asset
generation. Meta's remote and MCP listeners do not auto-start, which prevents
LAN exposure, port collisions, and wrong-project routing across open Editors.

Never serialize a whole Unity Preferences file. Do not read, copy, diff, or set
access tokens, provider credentials, account disclaimers, enabled providers, or
model choices. Those remain local, per-user consent and entitlement decisions.
Read `references/settings-and-research.md` before changing the baseline or
automating tooling research.

## Handoff contract

At every writer change, record the exact project path and Editor/PID, branch and
Git state, active lock/import/build status, packages changed, tests already run,
remaining task, evidence paths, and credentials/credits that were intentionally
not transferred. The next writer must re-check those facts before mutation.

Read `references/safety-and-handoffs.md` for the preflight and acceptance
checklists. If writer ownership is ambiguous, stop mutations and continue only
with read-only inspection until ownership is explicit.
