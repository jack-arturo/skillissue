---
name: unity-quest-build
description: Use when building, simulating, profiling, sideloading, or verifying Unity 6 Meta Quest applications, especially when XR state, Meta XR Simulator, passthrough cameras, ADB, MQDH, Vulkan, or on-device evidence is involved.
license: MIT
tags: [unity, quest, meta-xr, simulator, vr, mr, android, openxr, il2cpp, adb, mcp]
agents: [claude-code, codex, autojack]
category: xr
metadata:
  version: "2.2.0"
capabilities:
  network: true
  filesystem: readwrite
  tools: [Bash, Read, Edit, Write]
resources:
  - path: story.md
    type: file
  - path: agents/openai.yaml
    type: file
  - path: references/verification-ladder.md
    type: file
  - path: references/failure-modes.md
    type: file
  - path: scripts/audit-unity-quest-toolchain
    type: file
  - path: scripts/test_audit_unity_quest_toolchain.py
    type: file
bin:
  audit-toolchain:
    command: scripts/audit-unity-quest-toolchain
    description: Audit a Unity Quest project's installed and pinned toolchain without changing it.
    requires-tty: false
---

# Unity 6 Meta Quest delivery

Use a simulator-first, evidence-driven loop. A green compile is not a Quest
acceptance result.

## Platform contract

`scripts/audit-unity-quest-toolchain` currently supports **macOS only**. It
inspects macOS Unity Hub, Editor, Meta Quest Developer Hub, Simulator, and
licensing layouts and fails closed on Windows or Linux rather than reporting
those paths as missing. Run it on a macOS build machine, or perform an
equivalent platform-specific inventory outside this package.

## Start with the actual environment

1. Run `scripts/audit-unity-quest-toolchain --project <path> --json`.
2. Read project instructions, package pins, build scripts, current Git state,
   active Unity processes, and connected ADB devices.
3. Preserve a validated Unity/Meta combination. Evaluate newer Editor streams
   in an isolated worktree before changing the production pin.
4. Assign one mutation owner. Serialize Unity imports, MCP writes, builds,
   installs, captures, and other ADB operations.

The audit's `unity_license` section is limited to local Editor product
entitlements. Verify the Unity AI subscription, named-user seat assignment, and
project organization separately in the authenticated Unity Dashboard. Credits
alone do not prove AI Gateway or MCP entitlement.

Required Quest build settings are Android, IL2CPP, ARM64 only, OpenXR with the
Meta Quest feature group, Linear color, and Vulkan. Build enabled scenes with a
project-owned batch method and validate the APK package before installation.

## Route work to the right surface

| Need | Surface |
|---|---|
| Scene, prefab, asset work; paid AI asset generation | Unity Assistant or official Unity MCP (`Unity_AssetGeneration_GetModels` then `GenerateAsset`; consent + URP/mobile-explicit prompts) |
| Deep object/asset reads, JSON patch, tests, screenshots, profiler, packages, editor C# (`script-execute`) | IvanMurzak Unity MCP |
| Quest project-setup validation/auto-fix, compilation status, async test runs, GameObject/component ops, Building Blocks install | Meta XR runtime bridge (`UPSTTools`, `CompilationTools`, `TestRunnerTools`, `SceneObjectsTools`, `BuildingBlocksTools`) |
| Editor-window capture and UI drive (visual verification of editor state) | Meta XR runtime bridge (`UIVerificationTools`, `InteractionTestingTools`) |
| Runtime interaction with a RUNNING XR session: pose/input injection, composited capture, spatial entities | Meta XR Operator (Core SDK v205+; Play Mode or Simulator session required) |
| Reproducible build, manifest/APK inspection, Git, locks | Project shell scripts |
| Production-scene XR iteration | Meta XR Simulator and Synthetic Environment Server |
| Install, logs, casting, timed Perfetto | ADB and MQDH (or HZDB / Meta VR CLI where installed — one install path only, duplicates double-register tools) |
| Comfort, real hands, compositor/PCA alignment, Quest GPU | Physical headset |

MCP drives a live Editor — and every server in the table drives the SAME
Editor. Serialize mutations across servers, not per server: an
IvanMurzak `tests-run` and a `TestRunnerTools` run hit the same Test Runner
and collide. Keep the deterministic CLI build path authoritative. Use
path-scoped reads and patch only the intended fields instead of serializing
or rewriting whole Unity objects.

When a Quest build or runtime misbehaves, check `UPSTTools.GetStatus` before
hand-auditing settings — it reports Required/Recommended/Optional setup
issues with previewable fixes (`PreviewFix` before `FixTask`; never blind
`FixAll` on a pinned project).

## Follow the verification ladder

Read `references/verification-ladder.md` before choosing a test surface or
accepting a build. The required order is:

1. Static checks and EditMode tests.
2. PlayMode tests using production scenes.
3. Meta XR Simulator with Quest 3/OpenXR and real stereo structure. With Core
   SDK v205+, drive this rung agent-side via Meta XR Operator: inject head and
   controller poses, hold inputs across frames, capture the composited image,
   and assert on it — closed-loop runtime verification without a human in the
   headset. Operator evidence is simulator-grade, not device-grade.
4. Fresh IL2CPP/ARM64/Vulkan APK on Quest with runtime and human evidence.

Do not weaken production tracking or permission checks to satisfy a simulator.
Use an Editor/test-only seam when a deterministic CI profile intentionally does
not publish tracked head state.

Meta XR Simulator 201 with Meta XR SDK 203 can expose PCA extensions and
swapchains without advancing live camera images. In that combination, use an
Editor/test-only deterministic pair of distinct synthetic eye textures to prove
topology, eye targeting, and composition. Label them synthetic and reserve live
freshness, intrinsics, resume, and camera/compositor evidence for a standalone
Quest build; Meta's PCA Camera API is not supported over Quest Link.

### `-nographics` breaks pixel-assertion tests

Batchmode EditMode/PlayMode tests that assert on rendered pixels fail under
`-batchmode -nographics` with "rendered 0 visible pixels" — the flag removes
the graphics device the assertion needs. Drop `-nographics` for any test run
that includes shader/renderer contract tests; a headless CI profile that must
stay `-nographics` should exclude that fixture class explicitly rather than
read the failure as a regression.

Before attributing new test failures to new code, run two independent
controls, not one: (1) remove the new files and re-run — same failures means
the new code isn't the cause; (2) vary the suspected environment flag (e.g.
drop `-nographics`) and re-run. Either control alone is suggestive; both
together are proof.

## Build and install deterministically

- Use the exact Editor version pinned by `ProjectVersion.txt`; verify its
  Android SDK, NDK, OpenJDK, and AndroidPlayer modules.
- Acquire the project's cross-worktree Unity/deployment lock before import,
  tests, build, or ADB mutation.
- Remove stale output before building. Require Unity exit zero, a non-empty new
  APK, expected embedded package ID, and restored protected project settings.
- If multiple Android devices exist, require `ANDROID_SERIAL`. Never restart an
  ADB daemon owned by another active tool; use the established endpoint.
- Install the exact accepted APK, launch its explicit package, then verify the
  process and resumed activity. Old installed builds are not evidence.
- Inspect the generated Android manifest, not only Unity templates. Re-add and
  validate required deep-link filters after Meta manifest processing.

### Never kill a transactional build mid-flight

A build script that swaps project settings — render pipeline asset, application
identifier, product name, vendor/XR config — and restores them in a `finally`
leaves the project mutated when the run is killed. The compounding part is
worse than the mutation: the restore is snapshot-based, so the NEXT build takes
the mutated state as its own baseline and faithfully restores *that*. One kill
becomes permanent, and no later build reports anything wrong.

It surfaces as "new" failures in build and render-contract tests plus stray
generated assets, which read as regressions in whatever code was being worked
on at the time. If a build must be stopped, let it reach its own cleanup;
otherwise diff the protected settings against HEAD afterwards and restore by
hand.

### Working-tree config can be load-bearing — do not `git checkout` it clean

Editor plugins write state the committed baseline does not carry: scripting
define symbols a package needs in order to compile, and package-manifest
versions whose binaries have already self-healed forward. Reverting those files
to HEAD to tidy the tree breaks compilation — `CS0246` on the missing define,
`CS0115` when a manifest is rolled back underneath newer DLLs.

Corollary worth knowing before diagnosing: a test that asserts the committed
ProjectSettings baseline will fail locally whenever such a plugin is active,
because the plugin requires symbols the baseline forbids committing. That red is
the environment, not a regression. Confirm by checking whether the file appears
in the branch diff at all before attributing it to work in progress.

## Capture trustworthy evidence

- Bind every capture to the foreground package before and after acquisition.
- Require present, tracked, and pose-valid as separate XR conditions.
- For live passthrough cameras on hardware, finish normal XR warmup and wait for
  a synchronized left/right pair. Camera feeds can arrive at 60 Hz while the
  headset renders at 72 Hz, so an arbitrary render frame is invalid evidence.
- After resume, require both eyes to advance beyond their pre-resume frame and
  timestamp baselines. A young frame can still be pre-resume.
- Require distinct left/right textures or XR array slices and fail closed on
  mono or left-eye-only rendering.
- Reject empty, uniform, or opaque-black eye images. The visual oracle must find
  the intended effect bounds/layers in both eyes, not merely hands, UI, or any
  nonzero pixels. Bound GPU readback and fail on timeout.
- Reject malformed or implausible eye baselines/projections; do not repair them
  into evidence with a fabricated default.
- Record an atomic bundle: package, build identity, frame token, per-eye hashes,
  timestamps/poses/intrinsics, visual oracle, logs, and performance trace.
- Use MQDH timed Perfetto capture for 72 Hz acceptance. Use MQDH casting when
  Android `screencap` or `scrcpy` returns black or zero-byte output.

Read `references/failure-modes.md` when imports, shaders, simulator tracking,
PCA, ADB, screenshots, or resume behavior is abnormal.

## Acceptance contract

Simulator evidence is sufficient for scene wiring, placement, interaction
contracts, stereo topology, shader/material state, and most PCA iteration.
Physical Quest evidence remains mandatory for binocular comfort, real-hand
ergonomics, real compositor/camera alignment, lifecycle recovery, and final GPU
performance. Report which rung passed and which evidence is still missing.
