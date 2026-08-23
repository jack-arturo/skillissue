# AutoHub Runtime Failure Signatures

Use these signatures as disambiguators, not automatic diagnoses. Establish the
latest restart boundary and identify the first post-boundary cause before
counting downstream failures.

## Contents

- WAL checkpoint starvation
- Process-local Prisma mutex poisoning
- Telegram retry storms and payload drift
- Credential provenance and recipient resolution
- Metal EPIPE
- Voice audio: identify which gate failed first
- SQLite corruption
- Intentional fallbacks
- Motivating-incident acceptance

## WAL checkpoint starvation

**Signals**

- WAL-index `maxFrame` continues rising while `backfillFrames` does not.
- `activeFrames` remains nonzero across observation points.
- A reader mark or long-lived process prevents checkpoint progress.
- An external `BEGIN IMMEDIATE` probe blocks or times out.

**Do not infer from**

- `hub-unified.db-wal` file size alone.
- Retained WAL allocation after all active frames are checkpointed.
- A failure that affects only one process while external writers remain
  healthy.

Classify global contention only when SHM/checkpoint facts and an actual lock
probe agree. A healthy `quick_check` proves integrity, not absence of
contention.

## Process-local Prisma mutex poisoning

**Signals**

- One adapter transaction times out or is abandoned.
- Its connection rolls back, but the parent adapter mutex release path is not
  reached.
- Later writes hang only in the same process.
- A fresh external writer acquires the database lock.
- Restarting that process restores writes.

The durable repair is ownership-correct settlement: watchdog rollback must call
the adapter transaction's original rollback/release path. Commit, rollback,
and watchdog races share one settlement promise; late commit fails closed and
late rollback is idempotent.

Do not misclassify this as WAL checkpoint starvation when SHM active frames,
the external lock probe, and cross-process writes are healthy.

## Telegram retry storms and payload drift

**Signals**

- One update recurs after the webhook fails to acknowledge it.
- Empty/unsupported input precedes many empty interactions, assistant-prefill
  errors, stale-reply errors, or repeated transactions.
- Standard `message_id` is zero or absent while
  `ephemeral_message_id`/receiver fields appear.
- Reply construction sends `message_id: 0`.

Compare structural fields with the current official Telegram Bot API contract:
https://core.telegram.org/bots/api#replyparameters

Repair rules:

- acknowledge empty/unsupported updates with HTTP 200 before model or
  persistence initialization;
- use only positive standard message IDs for public reply targets;
- fail closed for unverified ephemeral UX;
- retry a stale normal reply once without reply parameters while retaining its
  forum topic;
- never use that public fallback for ephemeral input;
- log field names and ID presence only, never content.

## Credential provenance and recipient resolution

A ready service, an authenticated tool call, and a successful real-surface
action are three different proofs.

For `Invalid token`/401:

1. compare redacted hash prefixes in canonical `.env`, copied host configs,
   and the loaded process;
2. sync stale copies before rotating credentials;
3. prove one authenticated operation after readiness.

For Telegram `CHAT_WRITE_FORBIDDEN`:

1. do not assume token or account permissions are bad;
2. enumerate `tg_dialogs`;
3. require the exact dialog name;
4. distinguish fuzzy, read-only, and genuinely forbidden targets;
5. verify only with a dedicated self/test dialog.

Never print config values, URLs, process environments, message bodies, or full
dialog history. Live evidence retains only sentinel, IDs, mode, timestamp, and
status.

## Metal EPIPE

**Signals**

- `MTLCompilerService`, `Broken Pipe`, or EPIPE.
- Parakeet/STT returns HTTP 500 soon afterward.
- Voice promises reject or the process exits.

Treat the Metal failure as the first cause and the STT/voice errors as its
cascade. Restart the affected voice/Parakeet stack, then run sustained
multi-turn hardware verification. One green turn is insufficient.

## Voice audio: identify which gate failed first

"Voice is broken" is three unrelated failures with three different fixes. Name
the gate before touching config; the wrong gate's knobs will look like they do
nothing, because they do.

| Symptom | Gate | Arms when |
|---|---|---|
| Text streams, no sound | audio output player | every reply |
| Replies cut off mid-sentence | barge-in decider | only while the assistant speaks |
| Assistant answers something nobody said | turn-start (VAD + wake-anchored turn gate) | only while idle |

**Silent output — `playback=true` with no audio.** The keep-warm player stays
bound to a CoreAudio stream that can go stale after an idle gap. `isPlayerStale()`
checks only PROCESS liveness (stdin destroyed/ended/closed, killed, exitCode,
signalCode), so a live process on a dead stream is invisible: stdin writes
succeed, `ASSISTANT_PLAYBACK` logs `playback=true`, nothing is audible. Tell-tale
signs: one long-lived `player_pid` across many turns, zero
`player_stale_discarded`, zero `route_degraded`, and recovery only when the
operator flips the output device (which forces a `route_change` respawn).
Mitigation is `VOICE_AUDIO_RECYCLE_PLAYER_AFTER_DRAIN=true`, at the cost of
per-utterance HAL-client churn; idle-only recycling is the real fix.

**`ASSISTANT_PLAYBACK` is a result marker, not a start-of-speech one.** It is
logged once the playback task reports, immediately before `lastPlaybackEndTime`
and `markAssistantPlaybackComplete()`. Never read it as "playback was
dispatched", and never treat `playback=true` as proof sound was produced.

**Barge-in.** Enable `VOICE_BARGE_TRACE=1` and read the trace before changing
anything — it records per-frame `rms`, `threshold`, `source`, `armed`, `fired`.
Two traps:

- `VOICE_BARGE_ADAPTIVE=false` does not merely swap the threshold source; it
  disables the whole trusted-AEC path, so every `VOICE_TRUSTED_AEC_BARGE_IN_*`
  key becomes inert and the gate falls back to a percentage threshold plus
  `VOICE_INTERRUPT_MIN_DURATION`.
- `trustedAec` can resolve false even on matching hardware, with the same
  effect. Confirm by reading `source`/`threshold` in the trace rather than
  trusting the configured value.

Raising the threshold breaks the CONSECUTIVE-FRAME STREAK, not just the level,
so a value that looks safe by RMS headroom can drop every real barge-in. Sweep
the recorded trace against candidate values first. The streak — not amplitude —
is what separates the operator from background dialogue, and the owner profile
that scales the threshold drifts between sessions, so any fraction is only
correct for one profile state.

**Turn-start.** Background dialogue transcribed as a real user turn is NOT a
barge failure — the barge decider never armed. No level or duration threshold
fixes it, because television dialogue is sustained conversational speech.
The only discriminator is speaker identity (owner voiceprint / embedding
sidecar). Do not spend a tuning cycle on thresholds for this symptom.

## SQLite corruption

**Signals**

- `SQLITE_CORRUPT`, malformed database, or duplicate
  `sqlite_master` entries.
- `PRAGMA quick_check` is not `ok`.
- Concurrent startup/DDL is visible near the first failure.

Stop writers before recovery. Destructive recovery, replacement, or production
data mutation is red-tier and requires approval. Re-run `quick_check` and the
application's real write path afterward.

## Intentional fallbacks

A fallback log line is not an error when the downstream operation succeeds.
Evernote search fallback followed by a completed poll is healthy. Record the
fallback as context, not root cause, unless its downstream result fails.

## Motivating-incident acceptance

A correct triage identifies two linked causes:

1. forced rollback bypassed the adapter transaction release path and poisoned a
   process-local Prisma mutex;
2. empty Telegram input was acknowledged too late, so Telegram retried it into
   a model, persistence, and reply cascade.

It rejects retained WAL allocation as global contention when:

- `quick_check` is `ok`;
- SHM active-frame state is measured rather than inferred from file size;
- a fresh external write lock is acquired;
- cross-process writes succeed.

Active frames show WAL work remains; they do not by themselves prove that a
writer is blocked.
