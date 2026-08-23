---
name: cli-installer-ux
description: Design and harden compact, useful CLI installers, updaters, setup wizards, and command output surfaces without leaking debug logs or machine JSON into human UX.
license: MIT
tags: [cli, installer, updater, terminal, ux, testing, node, shell]
agents: [claude-code, codex, autojack]
category: terminal
metadata:
  version: "1.0.0"
capabilities:
  network: true
  filesystem: readwrite
  tools: [Bash, Read, Edit, Write]
resources:
  - path: references/cli-ux-checklist.md
    type: file
  - path: examples/compact-install.sh
    type: file
  - path: examples/clack-ui.ts
    type: file
  - path: examples/cli-output.test.ts
    type: file
---

# CLI Installer UX

Use this when a project needs a command-line installer, updater, setup wizard, doctor command, or other user-facing CLI surface that should feel compact and intentional while keeping diagnostics, subprocess logs, and machine output out of the default path.

## When to use

- The user asks for a CLI installer, upgrader, first-run setup flow, doctor command, or command catalog.
- A CLI currently dumps raw JSON, structured logs, child-process output, stack traces, or verbose internals during normal success paths.
- A project needs both human output and parseable `--json` output.
- An installer must support interactive terminals, redirected stdout, CI/headless agents, and quiet or verbose modes.

## Workflow

1. Inspect the current command surfaces before editing. Find entrypoints, shell installers, update commands, logging helpers, subprocess calls, and tests. Capture which commands are human-facing, which are machine-facing, and which mutate user state.
2. Define the output contract. Human mode gets compact branded status, plan-first summaries, bounded tables, and explicit next actions. Machine mode gets strict JSON only. Errors go to stderr. Internal diagnostics stay behind verbose flags or log files.
3. Build tiny shared UI primitives rather than one-off strings: theme/color detection, ASCII fallback, badges, key/value rows, list truncation, safe text escaping, task spinners, and success/error summaries.
4. Keep installers plan-first. Print platform, runtime, install path, storage path, current version, target version, install state, and release notes before writing anything. Support `--dry-run`, `--yes`, `--quiet`, `--verbose`, and `--notes` where they make sense.
5. Contain subprocess noise. Route child stdout/stderr to a temp log during success paths. Show a short tail only on failure, or in explicit verbose mode when the output is useful. For library calls that log internally, wrap them in the project's log-suppression helper.
6. Treat interactivity as a capability, not an assumption. If stdin is not a TTY but `/dev/tty` is available, attach the guided flow there. If no TTY exists, defer the wizard and print the exact command to resume. Do not execute mutating updates from a non-TTY session unless an explicit yes flag is present.
7. Add passive update notices only to human output. Keep them compact: current to latest, run command, disable command. Never append notices to JSON, markdown, or other machine-readable output.
8. Make review and repair flows safe by default. Summarize counts first, hide long diagnostic detail until review/advanced/verbose modes, recommend non-destructive choices first, and show restore commands after backup-style actions.
9. Test the transcript as a public API. Cover human snapshots with color off, JSON parseability, stderr cleanliness, suppressed child noise on success, log tails on failure, non-TTY behavior, quiet output, verbose output, command suggestions, and update notice gating.

## Output standards

- Default output should fit in a short terminal viewport and answer: what happened, what changed, what needs attention, and what to run next.
- `--json` output must be parseable with no banners, update notices, warnings, or trailing prose.
- Normal successful commands should not print server logs, storage warnings, dependency install transcripts, stack traces, or raw API payloads.
- Every interactive prompt should have a safe default and a clear recovery command if skipped.

## Anti-patterns

- Printing debug logs because they are technically useful.
- Letting passive notices contaminate JSON or other machine-readable streams.
- Showing full subprocess output on success.
- Using animation without a deterministic non-TTY fallback.
- Repeating large brand marks throughout a transcript.
- Treating `--verbose` as the default user experience.
- Performing destructive or persistent changes before showing the plan and asking or honoring an explicit yes flag.
- Hiding failures completely; suppress success noise, but surface failure tails and actionable next steps.
