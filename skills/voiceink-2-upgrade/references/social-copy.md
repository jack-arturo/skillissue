# Social / launch copy — VoiceInk 2.0 Upgrade skill

URLs (fill once live):

- Skill page: `https://skillissue.sh/skills/voiceink-2-upgrade`
- Install: `npx skillissue.sh voiceink-2-upgrade` (or current skillissue install line)

---

## X / Twitter (short)

VoiceInk 2.0 ate my Modes, blamed Apple Speech for a Parakeet problem, and failed every enhance with `prompt=<none>`.

Packed the fix into a skill: Parakeet V3, Mode map, cleanup prompt, emoji/path replacements, backup validator.

→ skillissue.sh/skills/voiceink-2-upgrade

---

## X thread (optional)

1/
Upgraded VoiceInk to 2.0. Transcription died with "Download required for English (United States)." Parakeet was already on disk. Apple Speech was the trap.

2/
Modes came back empty. AI Enhancement with no prompt selected = decode failure every time. History shows `prompt=<none>` — that's the tell.

3/
Emoji in Brief Modes needs Dictionary word replacements, not the cleanup prompt. Enhancement-off Modes never see the prompt.

4/
Custom assistant endpoints don't ride in the settings backup. Modes can point at Custom; you still wire the provider in AI Models (+ Keychain).

5/
Runbook + starter replacements + backup validator:

skillissue.sh/skills/voiceink-2-upgrade

---

## LinkedIn

VoiceInk 2.0 is a real Modes redesign — and the upgrade path has a few sharp edges.

What bit me:

- "Download required for English (United States)" when Parakeet V3 was already installed (Apple Speech language assets ≠ local Parakeet)
- Enhancement failures whenever a Mode had AI on and no prompt selected (`prompt=<none>` in History)
- Spoken emoji only working if you put replacements in the Dictionary — Brief Modes skip AI cleanup
- Custom OpenAI-compatible assistant endpoints not fully covered by settings import

I packaged the operator runbook as an open skill: Mode architecture, cleanup prompt template, starter word replacements (emoji / ellipsis / literal paths), and a small JSON validator before you re-import a backup.

Skill: skillissue.sh/skills/voiceink-2-upgrade

If you're mid-upgrade, export settings first, switch active Modes off Apple Speech, and never leave Enhancement enabled without a prompt UUID.

---

## Mastodon / Bluesky (same energy)

VoiceInk 2.0 upgrade scars, in skill form:

• Apple Speech download error ≠ missing Parakeet
• `prompt=<none>` always fails enhancement
• emoji → characters belongs in Dictionary replacements
• Custom providers don't fully survive settings import

skillissue.sh/skills/voiceink-2-upgrade

---

## One-liner for Discord / Slack

VoiceInk 2 upgrade skill — Parakeet V3 Modes, fix `prompt=<none>` decode fails, emoji/path replacements, backup validator: skillissue.sh/skills/voiceink-2-upgrade

---

## Site blurb (short)

Field notes for VoiceInk 2.0: rebuild Modes after onboarding, stay on Parakeet V3, wire a real cleanup prompt, put emoji/path fixes in Dictionary replacements, and validate settings JSON before import.
