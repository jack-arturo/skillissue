# Safety and handoff checklists

## Before mutation

- Confirm the exact project path, branch, Git state, Unity version, Editor PID,
  current writer, and cross-worktree locks.
- Confirm imports, compilation, Play Mode, tests, builds, and ADB work are idle.
- Select the smallest capable surface and verify its current tool inventory.
- Create a recoverable Git checkpoint for risky mutations.
- Keep checkpoints disabled unless Assistant is sole writer on a clean isolated
  branch.
- On Assistant 2.14, verify both the disabled flag and the discovery-banner
  opt-out fields; the first-time discovery flow can otherwise initialize and
  enable checkpoints.

## Before generation or expensive models

- State provider/model, asset type and count, destination, intended use, and
  expected credit impact.
- Obtain explicit operator consent.
- Set a bounded wait and retry limit.
- Preserve provider/model/prompt provenance and applicable license/usage data.
- Inspect output in Unity and delete disposable smoke assets.

## Before handoff

- Wait for Unity and device operations to settle and release locks.
- Record files/packages changed and any generated `.meta` files.
- Record tests, profiler frames, screenshots, builds, and remaining failures.
- State the next allowed mutation and the writer receiving ownership.
- Never transfer credentials through the handoff; describe only where the next
  writer should obtain them locally.

## Acceptance

- Tool routing matched the task and no two writers overlapped.
- Scene/prefab changes were saved and reloaded before acceptance.
- Tests and evidence are tied to the intended project, Editor/PID, package, and
  build identity.
- Performance claims include Profiler or timed MQDH/Perfetto evidence.
- Repository and logs contain no credentials.
- After any batchmode/headless Unity run, diff ProjectSettings before committing:
  a degraded or offline license can silently drop an entitlement-gated scripting
  define (e.g. a Sentis/AI-analytics define) from `ProjectSettings.asset`. Restore
  the baseline; never let a headless side effect ride along in a feature commit.
- Batchmode runs may also write untracked package-local settings (e.g. the Unity
  AI Assistant `ProjectSettings/Packages/.../Settings.json`); leave them
  uncommitted.
- Prefer graphics-enabled batchmode when a headless run must exercise rendering
  contracts: EditMode tests that call `camera.Render()` (pixel/warmth/isolation
  checks) silently produce nothing under `-nographics`. Reserve `-nographics` for
  pure asset generation (mesh/material regen).
