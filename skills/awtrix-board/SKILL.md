---
name: awtrix-board
description: >-
  Use when controlling Jack's two AWTRIX 3 Ulanzi TC001 displays: show a
  notification, set brightness, read battery or sensor data, or identify a
  physical unit. Uses the bundled direct-LAN helper without Home Assistant or
  stored secrets.
tags:
  - awtrix
  - ulanzi
  - tc001
  - iot
  - display
  - notification
  - autohub
  - home-assistant
agents:
  - claude-code
  - codex
  - autojack
category: iot
license: MIT
metadata:
  version: "1.0.0"
  office-ip: "192.168.2.100"
  bedroom-ip: "192.168.2.101"
capabilities:
  network: true
  filesystem: readonly
  tools:
    - Bash
resources:
  - path: bin/awtrix
    type: file
---

# awtrix-board

Control Jack's **two Ulanzi TC001** pixel clocks (32×8 RGB matrix each), flashed
with **AWTRIX 3** (the awtrix-light firmware). Each exposes a plain JSON HTTP API
on port 80 — `POST http://<ip>/api/<endpoint>`, no auth on the LAN.

**The two units** (router-pinned, in the `192.168.2.100-119` LED-display block):

| Name | IP | uid |
|------|-----|-----|
| office  | `192.168.2.100` | `awtrix_967728` |
| bedroom | `192.168.2.101` | `awtrix_2d2f60` |

> ⚠ The office/bedroom **room labels are a starting guess** — the IPs are
> confirmed, but which physical unit sits where is not. Run `awtrix locate` to
> light up each one with its assumed name, then (if swapped) edit the two
> `AWTRIX_*_IP` lines at the top of `bin/awtrix` or set the `AWTRIX_OFFICE_IP` /
> `AWTRIX_BEDROOM_IP` env vars. Never hard-code an IP elsewhere.

---

## Why there's no takeover here (unlike the Pixoo)

An AWTRIX display runs its **own app loop on-device** — Time / Temperature /
Humidity / Battery cycle with **no external controller**. A `notify` **overlays**
that loop and the device **auto-returns** to it when the notification ends. So:

- **No takeover gate, no loop-stall, no config-entry reload.** Push and walk away.
- A held notification (`--hold`) stays until you `dismiss` it; a timed one
  (`--duration N`) clears itself.
- As of **2026-06-01 these units are NOT in Home Assistant** (verified: no
  `awtrix`/`ulanzi` entities). Nothing else is drawing to them, so a raw push is
  never clobbered. If the AWTRIX Light HACS integration is added later (see
  *Home Assistant follow-up*), HA will co-control — re-read coexistence then.

---

## Quick start

The helper ships at `bin/awtrix`. Install it once, or run it in place:

```bash
cp ~/.claude/skills/awtrix-board/bin/awtrix ~/.local/bin/awtrix && chmod +x ~/.local/bin/awtrix
# or: ~/.claude/skills/awtrix-board/bin/awtrix doctor
```

```bash
awtrix notify "Hello" --color "#7AA2F7"            # 5s scroll on the office unit (default)
awtrix notify "Dinner!" --device bedroom --hold    # stays until dismissed
awtrix dismiss --device bedroom                    # clear a held notification
awtrix brightness 80 --device office               # BRI 0–255 (or: awtrix brightness auto)
awtrix state --device office                       # battery / temp / humidity / fw
awtrix locate                                      # flash a label on each unit to ID it
awtrix doctor                                      # reachability + identity of both units
```

`--device office|bedroom` (default `office`) picks the target; `--ip <addr>`
overrides for an arbitrary unit. `awtrix` is **device-only** — it never touches HA.

---

## `notify` — the core verb

`POST /api/notify` shows a scrolling notification, then the device returns to its
app loop. Options:

| Flag | Default | Notes |
|------|---------|-------|
| `--color "#RRGGBB"` | white | Hex string (verified) or the device also accepts `[r,g,b]`. Tokyo Night blue is `#7AA2F7`. |
| `--duration N` | 5 | Seconds on screen (ignored when `--hold`). |
| `--hold` | off | Keep on screen until `awtrix dismiss`. Use for alerts that must be acknowledged. |
| `--icon ID` | none | Numeric AWTRIX/LaMetric icon id. **Must already be uploaded to the device** (AWTRIX web UI → Icons) or it renders blank — so it's optional and no id is assumed here. |
| `--rainbow` | off | Cycle text color. |
| `--sound MELODY` | **silent** | Plays a melody from the device's `MELODIES` folder. **⚠ One unit may be in a bedroom — leave sound off unless you mean it.** |
| `--device` / `--ip` | office | Target selector. |

The text is JSON-escaped for you. 32×8 is small — short strings scroll; keep it punchy.

---

## Other verbs

- **`dismiss [--device|--ip]`** — `POST /api/notify/dismiss`; clears a `--hold` notification.
- **`brightness <0-255|auto> [--device|--ip]`** — `POST /api/settings {"BRI":n}` (manual,
  turns auto off) or `{"ABRI":true}` for ambient auto-brightness. No crash-cap needed (small panel).
- **`state [--device|--ip]`** — `GET /api/stats`, summarized: battery %, temp, humidity, lux,
  brightness, current app, uptime.
- **`locate [office|bedroom|all]`** — flashes a held label (`office? 100`) on each unit so you can
  see which physical display is which, then correct the IP map if needed.
- **`doctor`** — pings both units, prints uid/fw/battery, and restates the coexistence model.

---

## Raw HTTP API (reference — `bin/awtrix` wraps these)

Base: `POST http://<ip>/api/<endpoint>`, `Content-Type: application/json`. Success = HTTP 200
(body is usually `OK`, not a JSON error code).

```bash
# Notify (scrolling text, blue, 5s)
curl -sS -X POST "http://192.168.2.100/api/notify" -H "Content-Type: application/json" \
  -d '{"text":"Now playing","color":"#7AA2F7","duration":5}'

# Custom persistent app (stays in the rotation until removed) — deferred from this skill's verbs:
curl -sS -X POST "http://192.168.2.100/api/custom?name=status" -H "Content-Type: application/json" \
  -d '{"text":"OK","color":"#9ECE6A"}'      # empty body removes the app

curl -sS    "http://192.168.2.100/api/stats"      # device telemetry (battery/temp/hum/lux/version)
curl -sS    "http://192.168.2.100/api/loop"       # apps currently in the rotation
curl -sS -X POST "http://192.168.2.100/api/notify/dismiss"            # clear current notification
curl -sS -X POST "http://192.168.2.100/api/settings" -d '{"BRI":80}'  # brightness 0-255
```

Endpoints also reachable over MQTT (`<prefix>/notify`, `<prefix>/custom/<name>`, `<prefix>/stats`)
if the device is configured against the broker at `192.168.2.114:1883`.

---

## AutoJack quick-use

When Jack says "notify X on the awtrix / put X on the office display":

1. **Plain alert** → `awtrix notify "X" --color <by sentiment> [--device office|bedroom]`.
   - urgent: `#F7768E` (red) · info: `#7AA2F7` (blue) · positive: `#9ECE6A` (green).
   - "until I see it" → add `--hold`, and tell Jack to ask you to `dismiss`.
2. **"What's the temp/battery on the clock?"** → `awtrix state --device <unit>`.
3. **"Which one is which?"** → `awtrix locate`.
4. **Sound** is off by default — only add `--sound` if Jack explicitly asks (bedroom unit).

Defaults: device `office`, color white, duration 5s, silent.

---

## Home Assistant follow-up (staged, not yet done)

The chosen plan is **device-direct now, HA sensors next**. Adding the **AWTRIX
Light** HACS integration would surface each unit's **temperature / humidity /
battery / lux** as HA sensors and give HA a native notify service + brightness
control. That's a separate step (a HACS download + config) — greenlight it
separately. Once HA co-controls, revisit whether notifications from this skill
and from HA need any sequencing (far milder than the Pixoo — no loop-stall).

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `notify failed (HTTP …)` / `NOT reachable` | Wrong IP, asleep, or off-Wi-Fi. `awtrix doctor`; ping the IP; check the AWTRIX web UI at `http://<ip>`. |
| Notification never clears | It was sent with `--hold`. `awtrix dismiss --device <unit>`. |
| Icon shows blank | The `--icon` id isn't uploaded to that device. Add it via the AWTRIX web UI → Icons, or omit `--icon`. |
| Text too long / unreadable | 32×8 is tiny. Shorten it; it scrolls. |
| Wrong unit lit up | The office/bedroom map is a guess — `awtrix locate`, then fix `AWTRIX_OFFICE_IP`/`AWTRIX_BEDROOM_IP`. |
| Surprise beep | Something passed `--sound`. It's off by default; don't pass it for the bedroom unit. |
