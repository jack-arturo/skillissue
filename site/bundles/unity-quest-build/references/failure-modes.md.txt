# Quest workflow failure modes

| Symptom | Check and response |
|---|---|
| Pink/magenta bands | Inspect the active material/shader and device Vulkan logs. A batch/headless Metal result does not prove the Quest shader path. |
| Build succeeds but nothing useful launches | Validate enabled scenes, embedded package ID, manifest, installed package, process, and resumed activity. |
| Wrong trial/app in a capture | Bind the capture to foreground package before and after; use a package-aware watcher when apps can switch. |
| Zero-byte or black screenshot | Keep the headset awake, stop competing ADB streams, then fall back to MQDH compositor casting. |
| ADB disconnects during build/capture | Serialize ADB users, preserve the active daemon/port, set `ANDROID_SERIAL`, and use a non-streaming install path. |
| Simulator refuses to spawn | Inspect present, tracked, and pose-valid separately. Use a test-only pose seam; never relax production checks. |
| Simulator exposes PCA swapchains but frames never advance | Record the Simulator 201 / SDK 203 live-PCA limitation. Test stereo plumbing with distinct synthetic eye textures and reserve live freshness/intrinsics/resume evidence for hardware. |
| PCA appears ready after resume but capture fails | Compare both eye frame IDs and timestamps with pre-resume baselines; wait for a new synchronized pair. |
| Stereo proof is identical or one eye is empty | Assert distinct textures/array slices, both-eye camera targeting, and per-eye hashes; fail closed on mono. |
| Uniform black image passes the pixel oracle | Require variance/content plus the intended effect bounds and layer in both eyes; hands, UI, or arbitrary nonzero pixels are not proof. |
| GPU readback never completes | Apply a bounded readback timeout, record the failure, and retry the atomic capture rather than waiting indefinitely. |
| Eye baseline/projection is malformed | Fail closed and preserve the diagnostic. Never synthesize or repair a baseline solely to make evidence pass. |
| Unity Standalone reimport breaks compilation | Scope globally auto-referenced Roslyn/NuGet DLLs away from runtime/Standalone assemblies. |
| Unity test runner fails on MCP noise | Disconnect unused MCP sessions or allowlist only the exact expected transport message. |
| Multiple worktrees interfere | Use one writer, one Unity operation lock, and one deployment/ADB lock across all project worktrees. |
| MQDH legacy stats are incomplete | Use timed `hzdb perf`/Perfetto and process the trace with the bundled Perfetto processor when wrappers reject an absolute path. |
| Project-wide CS0234/compile failure originating in `Packages/com.ivanmurzak.*` | Core and companion MCP packages (`.particlesystem`, `.animation`) drifted out of version lockstep, or a package folder is untracked/half-upgraded. Check `manifest.json` pins resolve from the registry as a matched set; do not debug it as project code. |
| Every MCP bridge times out but bridge processes are alive | The Editor crashed and left the bridges orphaned listening. `pgrep` the Unity Editor process before blaming a bridge; relaunch the Editor, not the servers. |
| A `tests-run` request stalls or is refused | Another run is in progress (single-flight lock) or an open scene is dirty. Wait or save; do not fire the same run from a second MCP surface — they share the one Test Runner. |
| Meta XR Operator tools all error | No active XR session. Enter Play Mode with the Simulator (or launch on device) first; this is a session-state condition, not a tool failure. |
