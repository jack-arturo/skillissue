# Quest verification ladder

## 1. Static and EditMode

- Compile all relevant assemblies and run the complete EditMode suite. When
  the Meta XR runtime bridge is attached, `CompilationTools`
  (GetCompilationStatus/GetCompilationErrors/WaitForCompilation) and
  `CodeAnalysisTools` give structured compile/diagnostic state without log
  scraping, and `TestRunnerTools.RunFiltered` returns a runId for async runs.
- Validate package pins, Android/IL2CPP/ARM64/Vulkan/OpenXR settings, enabled
  scenes, package IDs, permissions, and deep-link requirements. Start from
  `UPSTTools.GetReport` — it enumerates Required/Recommended/Optional Quest
  setup issues with UIDs; `PreviewFix` before any `FixTask`.
- Treat exact known MCP disconnect messages with a narrow allowlist; do not
  suppress broad warning or error categories.

## 2. Production-scene PlayMode

- Load the production scene rather than a test-only reconstruction.
- Exercise spawn, placement, manipulation, scaling, scene persistence, and
  pause/resume seams.
- Confirm visual roots remain unit scale and trial-specific renderers are
  active without weakening runtime fail-closed behavior.

## 3. Meta XR Simulator

- With Meta XR Core SDK + Simulator v205+, prefer Meta XR Operator for
  agent-driven verification of this rung: `openxr_set_head_pose` /
  `openxr_set_controller_pose` (use `duration` for smooth motion),
  `openxr_set_controller_input` (hold values across frames — a 1-then-0 in
  the same instant is missed by `Update()`), `openxr_capture_composited_image`
  for the visual oracle, `openxr_list_spatial_entities` for scene state.
  Operator tools error when no XR session is running; that is a session
  problem, not a tool problem. Convert coordinates with the provided
  `convert_*_pose` tools — OpenXR is right-handed (−Z forward), Unity is
  left-handed (+Z forward).
- Verify via data AND pixels: query poses/scene data first, then confirm with
  a composited capture. Operator evidence is simulator-grade; it never
  substitutes for rung 4 device/human evidence.
- Assert `XR_RUNTIME_JSON`, `XR_SELECTED_RUNTIME_JSON`, and the selected Meta
  simulator configuration point to existing files.
- Use the Quest 3 profile, OpenXR, single-pass stereo, target refresh rate, and
  the required passthrough/camera extensions.
- Use an Editor/test-only deterministic pose source only when the CI profile
  explicitly reports present and pose-valid but not tracked.
- Use Synthetic Environment Server for the scene and environment. Meta XR
  Simulator 201 with SDK 203 can expose PCA extensions/swapchains without
  advancing live camera frames. Treat that state as an explicit compatibility
  limitation, not a green PCA-feed result.
- Use an Editor/test-only deterministic pair of distinct synthetic eye textures
  to validate PCA selection, eye targeting, bounded composition, and shader
  values. Do not claim live timestamps, freshness, intrinsics, or resume
  recovery from synthetic textures.
- Test a concrete supported camera resolution/aspect ratio. Do not select the
  largest format automatically.

## 4. Physical Quest

- Use a standalone Quest build for live PCA; the PCA Camera API is not supported
  over Quest Link.
- Build a fresh development APK with IL2CPP, ARM64, Vulkan, and the expected
  package ID; inspect the packaged manifest and permissions.
- Install, launch, verify process and resumed activity, then collect package-
  bound logs and stereo evidence.
- Exercise grab, distance grab, pinch/scale, placement, sleep/wake, pause/resume,
  permission recovery, and any deep-link evidence trigger.
- Judge binocular comfort, real-hand ergonomics, and actual passthrough/compositor
  alignment in-headset.
- Require enabled/playing live left and right PCA feeds, synchronized timestamps,
  distinct-eye content, tested format, and post-resume advancement on hardware.
- Capture timed MQDH/Perfetto evidence and require sustained 72 Hz without
  unhandled runtime, shader, or camera errors.

## Promotion rule

Promote a new Editor, Meta SDK, simulator, AI package, MCP package, or build
script only when every previously green rung remains green. Record an explicit
compatibility exception instead of silently upgrading around a failed rung.
