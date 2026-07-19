# CLI UX Checklist

Use this as a pre-merge review for installer, updater, setup, doctor, and command-catalog work.

- Human default is compact and not JSON-shaped.
- `--json` output parses and contains no notices or prose.
- Successful child-process output is captured, not streamed.
- Failure output includes the command label and a short log tail.
- `--quiet` produces no non-error output.
- `--verbose` adds useful details without dumping secrets or huge logs.
- Color and Unicode respect TTY, NO_COLOR, dumb terminals, and ASCII fallbacks.
- Non-TTY sessions do not prompt or execute mutating updates unless an explicit yes flag is present.
- The installer prints a plan before mutating user state.
- Tests assert stdout/stderr boundaries and update-notice gating.
