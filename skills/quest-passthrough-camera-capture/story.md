---
name: quest-passthrough-camera-capture
visibility: public
provenance: house
featured: false
title: "Quest Passthrough Camera Capture"
summary: "Practical lifecycle rules for safely copying Meta Quest passthrough camera frames into Unity-owned textures."
category: xr
tags: [unity, quest, passthrough]
related: [unity-quest-build, unity-ai-collaboration]
first_used: 2026-08
---

## Why

A borrowed camera texture looks simple right up until permissions change or the native feed disappears mid-frame.

## How

Treat the feed as borrowed, copy it into a texture you own, keep CPU readback off the frame path, and build a credible no-camera fallback. The boring bits are the feature.

## Related

Follow [Unity Quest Build](/skills/unity-quest-build/) for device evidence and [Unity AI Collaboration](/skills/unity-ai-collaboration/) when more than one tool can touch the Editor.
