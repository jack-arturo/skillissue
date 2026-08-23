---
name: repo-demo-video-director
description: Plan truthful repository README demo videos and stop for human script/storyboard review before rendering. Use when a public repo needs a Remotion/product overview video brief, claim ledger, screenshot/terminal/audio asset plan, simulated-data plan, README placement guidance, and Remotion plugin handoff notes.
license: MIT
tags: [video, remotion, readme, marketing, github, repository, screenshots, terminal, audio, elevenlabs]
agents: [claude-code, codex, autojack]
category: media
metadata:
  version: "1.4.0"
capabilities:
  network: false
  filesystem: readonly
  tools: [Bash, Read]
requires-secrets: []
resources:
  - path: story.md
    type: file
---

# Repo Demo Video Director

Plan short repository README demo videos before any render or upload work. This skill owns truthful positioning, storyboard choices, screenshot/terminal/audio asset direction, simulated data, and the handoff brief. It does not render video, generate audio, upload assets, or edit README files; use `repo-demo-video-publisher` for that publishing layer after human approval.

A human review gate is mandatory. Stop after proposing the script/storyboard/render direction and ask the user to approve or revise it before any rendering, README editing, upload, or publisher workflow begins.

## When to use

- A user asks for a repository demo, trailer, launch video, README video, or product overview video.
- A README demo needs standardized public-repo positioning before a Remotion render.
- An existing video idea needs a claim check against the repo before publishing.
- A release update needs a demo video, but the repo's general value still needs to be clear first.

## Direction Principles

- Lead with the repo overview: what the project is, who it is for, and the core workflow it enables.
- Treat release notes, recent PRs, and commit-specific details as supporting proof points unless the user explicitly asks for a release-only video.
- Use real screenshots wherever possible: product UI, docs pages, GitHub pages, dashboards, setup screens, screenshots already in the repo, or browser-captured web interfaces.
- Use simulated data by default inside screenshots and terminal sessions; never require real credentials, account data, private messages, customer data, balances, or production traffic.
- Plan audio deliberately. Silence is acceptable; background music, UI sound effects, or voiceover should exist only when they improve the video and can be approved by a human before generation/rendering.
- Keep claims truthful, source-backed, and conservative.
- Do not impose an unrelated house style. Use the repository, organization, or product styling instead.
- Stop for human review at the script/storyboard milestone. Do not hand off an unapproved video direction as render-ready.

## Screenshot and Terminal Asset Direction

Screenshots should be preferred over invented UI when they can truthfully show the repo or product.

- Identify every web interface that could be captured: local dev app, docs site, GitHub README/issues/releases, dashboard, admin UI, OAuth setup page, CLI docs page, generated API docs, or public demo page.
- If `browser-hand` is available, recommend it for browser screenshots, especially authenticated or already-open Chrome contexts. If not available, use Playwright, the in-app browser, or another screenshot tool available to that agent.
- Specify exact page states to capture, viewport sizes, privacy redactions, and whether the screenshot is real, staged, or simulated.
- For terminal or agent-session visuals, prefer deterministic scripted sessions over live recordings. The preferred renderer is Charmbracelet VHS when available; it can render scripted terminal demos from `.tape` files into video/GIF outputs.
- If the video needs a browser-rendered terminal UI, recommend xterm.js-style simulated terminal components. This works well inside Remotion because the terminal can be styled and animated as React/browser UI.
- Asciinema is useful for real terminal recordings and web/player replays; use it when a true command transcript is more important than fully scripted polish. `agg` can render asciinema casts to GIFs when installed.
- Treat Terminalizer and termtosvg as fallback/special-purpose options: Terminalizer is customizable but GIF-focused; termtosvg is archived and should not be a default dependency.
- Never show raw real agent logs, prompts, secrets, API keys, phone numbers, local paths, or private account data. Use a sanitized transcript or simulated agent session.

## Audio Direction

Audio is part of the proposed video direction and must be reviewed with the script/storyboard.

- Decide explicitly whether the video should be silent, use background music, use subtle sound effects, use voiceover, or combine these.
- Default to lightweight background music or silence for README demos. Use voiceover only when it materially improves clarity and the user approves the narration script.
- Prefer ElevenLabs for generated audio when available: `music` for background tracks, `sound-effects` for UI/ambient cues, and `text-to-speech` for approved voiceover. If an ElevenLabs MCP server is exposed, the publisher may use it; otherwise it should use the local ElevenLabs skills or API workflow.
- Keep Suno as an explicit fallback or legacy option, not the default, unless the user specifically asks for it or an existing Suno asset is already approved.
- Include exact audio intent in the review brief: mood, duration, loop/fade behavior, whether lyrics are forbidden, sound-effect cues, voiceover text, and where audio enters/exits the timeline.
- Do not reference specific artists, bands, copyrighted lyrics, or private voice/persona data in prompts.
- Do not generate audio until the human approves the audio plan, including any voiceover script.
- Generated audio, prompt notes, model/tool provenance, and source files stay in scratch by default and must not be committed to the repo.

## Remotion Plugin Coordination

This skill plans the creative and factual brief; it does not write Remotion code. When the final output will be rendered in Remotion, include a technical note for the publisher:

- If the agent has the Remotion plugin or skill, use `remotion:remotion-best-practices` before implementing or rendering Remotion code. In Codex this is the `@remotion` plugin-backed skill.
- If an agent does not have that plugin, do not block the project. Fall back to normal Remotion documentation, existing local project conventions, and direct CLI usage.
- Mention likely Remotion rule areas for the renderer, such as animations, assets/images, sequencing, text measurement, audio, captions, or video trimming, but avoid copying technical implementation detail into the director brief.
- The publisher remains responsible for loading the Remotion reference and doing render/frame/audio verification.

## Workflow

1. **Inspect repo truth.** Read the README, roadmap/scope docs, contribution or agent instructions, package metadata, public tool/API descriptions, screenshots/assets in the repo, and recent commits since the last release tag or documented baseline.
2. **Build a claim ledger.** List the product claims the video may show, their source files or commits, and any claims that must be avoided. Keep claims concrete and conservative.
3. **Choose an overview-first angle.** Identify the repo's primary job, target user, and baseline workflow. If there is a release angle, reserve it for one or two beats after the viewer understands the product.
4. **Plan real visual captures.** Identify screenshot candidates, browser pages, terminal/agent-session moments, exact capture states, and redaction/simulation requirements. Prefer real screenshots where feasible, but never at the expense of privacy or truthfulness.
5. **Plan audio.** Decide silent/music/sound-effects/voiceover, state the intended ElevenLabs or fallback path, write any voiceover text, define cue timing, and identify copyright/privacy constraints.
6. **Define simulated data.** Specify fake names, messages, accounts, API responses, logs, commands, agent output, and UI states. For privacy-sensitive domains, require obvious simulation cues and no real customer/account data.
7. **Storyboard the video.** Produce 5-7 beats for a 30-60s video with a deliberate frame-0 title/product slate, overview beats, screenshot/terminal beats, feature/demo beats, audio cues, and a clear final state. Include captions or on-screen copy, visual composition, and motion notes.
8. **Write the proposed script.** Include narration or on-screen copy, approximate timing, core visual action, audio direction, and source-backed claims for each beat. Keep it readable enough for a human to review without opening the repo.
9. **Pick visual direction.** Use repo or organization branding when it exists. Avoid one-hue palettes and generic AI magic visuals.
10. **Add Remotion handoff notes.** State whether the renderer should use `remotion:remotion-best-practices` if available, and list any relevant rule areas without prescribing unreviewed code.
11. **Stop for human review.** Ask the user to approve or revise the audience/angle, script, storyboard, screenshot/terminal asset plan, audio plan, simulated data, visual direction, README placement, and Remotion handoff notes. Do not render, generate audio, upload, edit README, call publisher, or continue into production until the user explicitly approves.
12. **After approval only, write the final publisher handoff.** Include the approval evidence so `repo-demo-video-publisher` can verify that the script/storyboard/audio review gate passed.

## Human Review Gate

The director output is not render-ready until a human approves it.

The review request must make these decisions explicit:

- Audience and angle.
- Script or on-screen copy.
- Storyboard beats and timing.
- Screenshot and terminal asset plan.
- Audio plan: silent/music/sound-effects/voiceover, prompts, voiceover text, cue timing, and generation path.
- Simulated data and privacy disclaimers.
- Visual direction and branding.
- README placement and caption/disclaimer.
- Remotion plugin/fallback note for the renderer.

If the user has not approved the proposed video direction, end with `Status: pending human review` and do not provide an approved publisher handoff. If the user later approves with changes, incorporate those changes and mark the handoff as approved.

Approval evidence should use a compact form such as:

```yaml
script_review_status: approved
reviewer: human user
approved_at: <date or message reference>
approved_scope: <short description of the approved script/storyboard/audio plan>
```

## Output

For the first pass, return a review brief with these sections:

- `Repo overview`
- `Audience and angle`
- `Claim ledger`
- `Avoided claims`
- `Screenshot and terminal asset plan`
- `Audio plan`
- `Simulated data`
- `Proposed script and storyboard`
- `Visual direction`
- `README placement`
- `Remotion plugin note`
- `Human review request`
- `Status: pending human review`

After explicit approval, return a final publisher handoff with these sections:

- `Audience and angle`
- `Claim ledger`
- `Avoided claims`
- `Screenshot and terminal asset plan`
- `Audio plan`
- `Simulated data`
- `Approved script and storyboard`
- `Visual direction`
- `README placement`
- `Remotion plugin note`
- `Human approval evidence`
- `Publisher handoff`

## Anti-patterns

- Do not invent capabilities because they would look good on video.
- Do not lead with PR numbers, commit internals, or release mechanics before the viewer understands what the repo does.
- Do not use abstract simulated UI when a safe real screenshot would be clearer and truthful.
- Do not add music, voiceover, or sound effects just because the tools exist.
- Do not generate audio before the audio plan and any narration script are approved.
- Do not show real credentials, messages, phone numbers, account balances, customer records, private repo data, raw agent logs, or local paths.
- Do not use a direct MP4 URL as a README fallback link; the publisher skill handles embed hygiene.
- Do not commit Remotion projects, rendered media, package locks, screenshots, audio, or generated assets to the target repo by default.
- Do not widen repo scope; respect the project roadmap and out-of-scope list.
- Do not hand off to the publisher as approved without explicit human approval of the script/storyboard/audio plan/proposed video.
- Do not require the Remotion plugin or ElevenLabs MCP for agents that do not have them; use them when available and document the fallback when unavailable.
