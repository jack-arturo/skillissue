---
name: video-toolkit
description: Plan and verify a local video-production workflow with explicit tool choices, review gates, and render evidence.
license: MIT
tags: [video, media, remotion, production, verification]
agents: [autojack, claude-code, codex, cursor]
category: media
metadata:
  version: "1.0.0"
capabilities:
  network: false
  filesystem: readwrite
  tools: [Bash, Read, Edit]
requires-secrets: []
resources:
  - path: story.md
    type: file
  - path: references/setup.md
    type: file
  - path: references/project-workflow.md
    type: file
  - path: references/asset-generation.md
    type: file
  - path: references/composition-patterns.md
    type: file
  - path: references/troubleshooting.md
    type: file
---

# Video Toolkit

This is a public, tool-agnostic production workflow—not an installable renderer or cloud-GPU client. Choose tools that are already available in the project or explicitly approved by the user. Do not assume a local checkout, command layout, container image, provider account, or environment variable exists.

## Workflow

1. Write an approved brief: audience, claims, runtime, aspect ratio, visual source plan, audio plan, rights constraints, and acceptance checks.
2. Inventory available tools and their costs before generating anything. If a provider needs credentials, let the user configure it through its own secret manager; do not name, request, or persist credentials here.
3. Work in a project-approved scratch directory. Keep generated media, prompts, and transient metadata out of the repository unless the user explicitly requests assets in version control.
4. Generate or collect one asset class at a time. Record source, rights status, and any simulation/redaction note beside the scratch artifact.
5. Assemble the edit in the project's chosen editor or renderer. If the project uses Remotion, follow its installed documentation and conventions; this package supplies no code or command wrapper.
6. Verify duration, resolution, frame zero, readable text, audio presence/mix, captions, and basic playback before review. Use a human review gate before publishing.

## Boundaries

- Never invent commands for an unbundled toolkit.
- Never assume a hosted generation provider is authorized or free.
- Keep provider secrets out of prompts, code, logs, and reports.
- Label generated or simulated footage honestly.

Read the references for planning checklists, composition decisions, and recovery steps rather than executable commands.
