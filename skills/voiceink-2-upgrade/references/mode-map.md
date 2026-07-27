# Suggested Mode map (VoiceInk 2.0)

Keep the set small. Every Mode should earn its slot with a different
transcription / enhancement / output / trigger combo.

## Default (required)

- **Transcription:** Parakeet V3, realtime on, language `auto`
- **Enhancement:** Cerebras `gpt-oss-120b` (or Groq / Gemini flash-class)
- **Prompt:** your cleanup prompt (see `enhancement-prompt.md`)
- **Context:** clipboard + selected text + screen — **opt-in with eyes open**.
  Hosted cleanup (Cerebras/Groq/Gemini) receives that material with the
  transcript. Turn context off (or point enhancement at a local endpoint) when
  the clipboard/screen may contain secrets or unrelated private content.
- **Output:** Paste
- **Default:** yes
- **Triggers:** AI / coding apps (Cursor, Claude, Terminal, VS Code) + Slack
  (Slack usually wants cleanup; WhatsApp usually does not)

## Brief

- **Enhancement:** off
- **Output:** Paste
- **Triggers:** WhatsApp, Messages; word trigger `brief`
- Relies on **word replacements** for emoji / ellipsis

## Assistant (optional)

- **Enhancement:** Custom OpenAI-compatible endpoint
- **Output:** **Respond** (not paste)
- **Triggers:** spoken phrases only (`hey assistant`, etc.)
- Prompt is a *composer / agent* prompt, not the cleanup prompt
- Cannot be the default Mode

## Submit

- **Enhancement:** off
- **Output:** Paste + Auto Send `enter`
- **Triggers:** Raycast (or any UI where Return submits)

## Email

- **Enhancement:** cleanup prompt
- **Context:** clipboard + selected + screen (same disclosure as Default —
  hosted providers see it)
- **Triggers:** Mail app + `mail.google.com` / Outlook web
- Word triggers: `draft email`, `write email`

## Email Address (optional micro-Mode)

- Tiny prompt that only formats `name at domain.com` → `name@domain.com`
- Word triggers: `email`, `at email`

## German (optional)

- Language: `de` (or keep `auto` on Default if you only sprinkle German)
- Word triggers: `auf deutsch`, `german mode`
- Cleanup prompt must **not translate** — preserve umlauts

## Field notes

- App triggers are exclusive: one app → one Mode. Put Slack on Default
  (enhanced) and WhatsApp on Brief (raw), not both in Messaging group blindly.
- Word triggers fire after transcription; keep them short and unique.
- If History shows `prompt=<none>` on enhanced Modes, fix the Mode before
  debugging providers.
