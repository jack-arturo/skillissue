# Example: add 8 calendar events for a launch

**Source case:** Trigger Happy launch, 2026-05-23. CC session had no Google Calendar tool, but `sessions/trigger-happy/launch/calendar-events-2026-05-23.md` already contained a paste-ready autojack prompt block. Pre-skill workaround was to hand the block to the user. Post-skill, fire it through `ask-autojack.sh`.

## Pattern

```bash
PROMPT=$(cat <<'EOF'
Add these to my calendar (default calendar, Europe/Berlin):

1. Mon May 25, 9:00 AM, 15 min — DK status check: did Trigger Happy enter processing?
2. Wed May 27, 10:00 AM, 30 min — Spotify editorial pitch via S4A (Trigger Happy)
3. Wed May 27, 11:00 AM, 45 min — Linkfire smart-link setup + URL swap (IG bio, YT description, SC description)
4. Fri June 19, 10:00 AM, 60 min — RELEASE DAY: Trigger Happy live on Spotify/Apple. Set Spotify Canvas + post amp #1.
5. Fri June 19, 6:00 PM, 15 min — Amp post #2 (Reel, pick-04 gold-tear)
6. Sat June 20, 12:00 PM, 15 min — Amp post #3 (X teaser pointing at smart link)
7. Mon June 22, 9:00 AM, 30 min — Week 1 DSP data review (Spotify for Artists + SC Insights + Apple)
8. Mon Aug 17, 9:00 AM, 15 min — 60-day mark: SC Artist Pro migration decision

Return a one-line confirmation per event with its calendar event ID. No other prose.
EOF
)

bash ~/.claude/skills/autojack-delegate/bin/ask-autojack.sh --timeout 300 "$PROMPT"
```

## Why `--timeout 300`

8 events × ~5s per Google Calendar `events.insert` call + overhead is comfortably under 60s in practice, but cold-start of the `google_workspace` MCP can add 2–5s on the first call. 300s leaves headroom for slow network days; tune down once you've seen warm timings.

## Why explicit return shape

Default autojack replies are conversational (`"Got it — added all 8 events!"`). Asking for one-line-per-event + event ID:
- Gives CC something it can parse if it needs to confirm individual events later.
- Lets the user verify count visually without opening Google Calendar.
- Keeps the response under 2k tokens even on long lists.

## Anti-pattern

Don't ship the raw markdown block with table syntax — autojack reads it fine, but tables embed wider context (the "Why" column from `calendar-events-2026-05-23.md`) that autojack will try to act on (e.g. include "Why" text in the event description). The paste-ready section already strips that down.

## Failure handling

If the script exits 2: AutoHub is down. Surface the start command from stderr to the user; don't try to start it yourself.

If autojack replies with "authorize browser first": OAuth not done. Surface verbatim — the user clicks through once and you re-run.

If only some events succeeded (autojack reports a partial outcome): re-run for the missing ones, do NOT re-run the whole batch (you'll get duplicates).
