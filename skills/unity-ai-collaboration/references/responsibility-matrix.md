# Unity AI responsibility matrix

| Surface | Best use | Mutation boundary |
|---|---|---|
| Unity Hub | Install Editors/modules, licensing, organization/project linkage | Never treat Hub as an AI authoring agent |
| Assistant Ask | Explanations, diagnostics, API and project questions | Read-only by default |
| Assistant Plan | Explore and design an ordered editor-local change | Planning is not execution permission |
| Assistant Agent | Bounded scene/asset/editor task with live context | Only when named as the sole writer |
| AI Gateway Codex | Short editor-local coding task | Avoid repository-scale ownership |
| Official Unity MCP relay | Supported high-level editor operations | Target the intended project/PID explicitly |
| IvanMurzak MCP | Deep reads, patches, tests, profiler, screenshots, packages, particles, editor C# execution | Prefer path scope and JSON patch; serialize writes; keep core + companion package versions locked |
| Meta XR runtime bridge | UPST validate/fix, compile state, async test runs, scene objects, Building Blocks, editor-window capture/drive | Same single-writer rule as every other editor surface; overlapping tools (tests, gameobjects) share Editor state with Ivan MCP |
| Meta XR Operator | Drive/verify a running XR session: pose and input injection, composited capture, spatial entities | Runtime-only (errors without an active session); evidence is simulator-grade, never device acceptance |
| HZDB / Meta VR CLI | Device docs search, logcat, screenshots, Perfetto over ADB | Install via exactly one path; duplicate installs double-register tools |
| External Codex Desktop | Repository-scale code, scripts, Git, docs, broad verification | Do not overlap a live Assistant writer |
| Shell | Deterministic audit, build, APK/manifest inspection, locks | Project scripts are authoritative for reproducibility |
| Meta XR Simulator | Production-scene XR/stereo plus synthetic PCA topology/composition | Simulator evidence and synthetic eye textures do not prove live camera delivery |
| MQDH/ADB/standalone Quest | Install, live PCA, lifecycle, cast, logs, Perfetto, comfort and GPU evidence | Serialize device operations and bind evidence to package; PCA is not supported over Quest Link |

## Typical phase ownership

1. External agent audits the repository and writes scripts/docs while Unity is
   closed or idle.
2. Ownership moves to Assistant Agent for a bounded scene/asset edit.
3. Ownership returns to the external agent for deterministic tests/builds.
4. One operator owns simulator and device evidence collection.

Read-only Ask/Plan conversations may coexist only when they cannot trigger
imports, Play Mode, package resolution, MCP mutation, or file writes.
