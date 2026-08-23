---
name: quest-passthrough-camera-capture
description: Use when reading Meta Quest Passthrough Camera Access (PCA) frames into a Unity texture — freezing a room snapshot, feeding a shader, or piping camera pixels to generation/inference — especially when the feed's lifetime, permission gating, color space, or a blocking readback is in play.
license: MIT
tags: [unity, quest, passthrough, pca, mixed-reality, meta-xr, rendertexture, shader]
agents: [claude-code, codex]
category: xr
metadata:
  version: "1.0.0"
capabilities:
  network: false
  filesystem: readwrite
  tools: [Read, Edit, Write]
requires-secrets: []
resources:
  - path: story.md
    type: file
---

# Reading passthrough camera frames on Quest

`PassthroughCameraAccess` (Meta XR Core / MRUK) hands you the headset's real
camera feed. It is a native-written texture owned by a component with its own
lifecycle — treat it as a borrowed handle, never as an asset.

## Never bind the feed's texture to a renderer

`GetTexture()` returns the texture the feed writes into from the render thread
and stops writing the moment the feed is disabled. Anything that disables the
feed — a controller's `OnDisable`, a withdrawn permission, a torn-down scene —
leaves a bound quad showing a live room that freezes, goes black, or references
a destroyed native handle, depending on timing.

Blit into a `RenderTexture` **you** allocate and release:

```csharp
_target = new RenderTexture(source.width, source.height, 0, source.graphicsFormat);
Graphics.Blit(source, _target);
```

Sizing and format both matter:

- Size from the source texture each time, not once at startup.
  `CurrentResolution` is what the device *granted*, not what you requested, and
  it can differ from the request or change mid-session.
- Match `source.graphicsFormat`. The feed is `R8G8B8A8_SRGB`; blitting into a
  linear target darkens the whole image subtly enough to read as "the capture
  is murky" rather than as a color-space bug.

## Guard every access on `enabled && IsPlaying`

`GetTexture()` internally validates state and **logs an error** when the
component is disabled or unpermitted. An unguarded per-frame call produces a
per-frame error line and returns null. Check `feed.enabled && feed.IsPlaying`
first.

## Never call `GetColors()` in a frame path

It is `AsyncGPUReadback.RequestIntoNativeArray(...).WaitForCompletion()` — a
blocking stall, and its own docs say so. If pixels must reach the CPU, issue a
non-blocking `AsyncGPUReadback` and consume it a frame or more later. For
display or shader input, the pixels never need to leave the GPU at all.

## Capture continuously, freeze by stopping

When you want a frame at a specific moment (an entry, a trigger, a gesture),
do not capture *at* that moment — allocation plus copy on the one frame the
user is watching is the worst possible placement. Instead blit on a slow
cadence beforehand into a texture nothing samples, and on the trigger simply
stop blitting. The last frame taken becomes the frozen one.

The freeze then has no separate flag to fall out of sync with: not capturing
*is* frozen.

## Do not create a second feed

If anything else in the project already runs `PassthroughCameraAccess`
components (a stereo lens, a CV pipeline), find and read the existing one
rather than adding your own — they contend for the same camera. Search the
scene with a bounded retry; the feed may not exist on the frame your component
lands, because composition is often permission-gated.

## Design for the feed being absent

PCA is device-only and permission-gated. In the Editor, in tests, on an
unsupported headset, or after a denied camera permission there is simply no
feed. That path must be a designed outcome with a bundled fallback asset — not
an error state — because it is the path every non-device run takes.

Keep "has a target" and "has a frame" as separate questions. An
allocated-but-never-blitted `RenderTexture` is a perfectly valid `Texture` full
of nothing, and preferring it over a fallback turns every permission-denied
session into a black rectangle.

## What testing can and cannot reach

Extract the copy into a source-agnostic method (`LatchFrom(Texture)`) so an
ordinary `Texture2D` can stand in for the feed. That gives real coverage of
sizing, creation, release, and whether the blit moves pixels — assert a known
color reads back from the target, because a latch that sizes perfectly and
copies nothing looks identical to a working one from every angle except the
user's.

What no desktop test can answer: **whether the live frame arrives upright.**
The feed is native-written and `Graphics.Blit` follows the platform's
texture-origin convention, which a `Texture2D` stand-in gets right for reasons
a native handle may not. Put "is it flipped or mirrored, and on which axis?" on
the device checklist explicitly.

## Related

`OVRPassthroughLayer.textureOpacity` dims what the *wearer sees* through the
compositor. It does not affect the raw PCA feed at all — a frame captured while
the passthrough layer is fully dimmed still shows the lit room.
