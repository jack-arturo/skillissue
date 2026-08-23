---
name: phala-gpu-tee-deploy
description: >-
  Use when deploying and verifying ComfyUI or vLLM on a Phala confidential
  H200 GPU TEE. Covers private bearer-gated endpoints, sealed secrets,
  dashboard reservation, no-file-mount Compose, attestation limits, and
  on-demand billing and shutdown behavior.
license: MIT
tags: [phala, gpu, tee, confidential-compute, dstack, comfyui, vllm, deployment, attestation]
agents: [claude-code, codex, autojack]
category: deployment
metadata:
  version: "1.0.0"
capabilities:
  network: true
  filesystem: readwrite
  tools: [Bash, Read, Edit]
requires-secrets:
  - name: COMFYUI_BEARER_TOKEN
    description: Optional access token for the published workload, supplied at deployment time.
    required: false
  - name: MODEL_DOWNLOAD_TOKEN
    description: Optional model-provider token, supplied at deployment time and never committed.
    required: false
resources:
  - path: story.md
    type: file
  - path: templates/comfyui.docker-compose.phala.yml
    type: file
---

# Phala GPU TEE Deploy

Take a containerized GPU workload from local compose to a running, **attested**,
**bearer-gated** endpoint on a Phala confidential H200 GPU TEE (dstack). Verified
end-to-end 2026-06 with `phala` CLI v1.1.19 deploying ComfyUI (Pony Realism SDXL)
on an on-demand H200.

## When To Use

Use when a user wants uncensored / private GPU inference on confidential hardware:
- Image generation (ComfyUI + an SDXL/Pony checkpoint) on a private endpoint.
- Text serving (vLLM + an abliterated model) on the same TEE pattern.
- Any workload that must run inside a TEE with hardware attestation and a single
  authenticated ingress, with model weights and tokens kept off public storage.

The deploy artifact is one `docker-compose.phala.yml`. The same flow serves both
image and text workloads — only the compose changes.

## Preconditions

1. `phala` CLI installed and authenticated. Confirm with `phala auth status` /
   `phala cvms list`; do not inspect or copy its credential files.
2. A Phala Cloud account with balance. A successful on-demand H200 launch commits
   a **24-hour minimum (~$115.20 at $4.80/GPU/hr)** — this is the gated,
   billable action.
3. A **public** container image (e.g. `ghcr.io/ai-dock/comfyui:latest-cuda`,
   `caddy:2`, `curlimages/curl`). `phala deploy -c` uploads the **compose only** —
   no local files, no build context reach the CVM.
4. Secrets in a local, gitignored `.env` (e.g. `CIVITAI_TOKEN`,
   `COMFYUI_BEARER_TOKEN`). Passed with `-e .env`; the CLI seals them. Never
   commit or print them.

## Key Reality: GPU reservation is dashboard-only

This is the load-bearing fact and the easiest day to lose.

- `phala deploy -t h200.small --image dstack-nvidia-*` from the CLI returns
  **"No available resources"** and bills nothing. The CLI can only place a
  workload onto *existing* workspace teepods, which are CPU-only (`phala nodes
  list` shows prod5/prod9, no GPU). It **cannot reserve a GPU**.
- A GPU is reserved through the **dashboard** GPU-TEE flow:
  `cloud.phala.com/<org>/gpu-tee` → **Launch GPU Instance**.
- `phala instance-types` lists an `h200.small` in a global *catalog* — that does
  not mean your workspace can schedule one from the CLI. Do not trust the catalog
  as proof of CLI capability.

After the GPU CVM exists, the CLI is fully usable for everything *except*
reserving/stopping it (see Lifecycle).

## Step 1 — Reserve the GPU (dashboard)

`cloud.phala.com/<org>/gpu-tee` → **Launch GPU Instance** → Custom Configuration.
Two traps that cost money or fail the attestation gate:

1. **Pricing defaults to a 6-month commitment (~$16,416).** Explicitly select
   **On-Demand** ($4.80/GPU/hr, 24h minimum ~$115.20). Do not accept the default.
2. **OS defaults to a dev image** (`dstack-nvidia-dev-*`) whose attestation quote
   is **debug-flagged** — it would fail a strict CC-attestation gate (it does add
   SSH, which is the only reason to ever pick it). Choose a **prod**
   `dstack-nvidia-*` image and verify externally instead of relying on on-box SSH.

Fill: H200 / 1 GPU, disk ≥ 80 GB (image + weights + outputs + headroom), paste
the compose, add Encrypted Secrets (the same keys as your `.env`), launch.
Driving the form with a browser-automation tool: the editor is CodeMirror 6 — set
its value via `document.querySelector('.cm-content').cmView.view.dispatch({changes:{from:0,to:doc.length,insert:text}})` (DOM selection/paste is ignored by CM6).

## Step 2 — The compose pattern (no file mounts)

Because only the compose is uploaded, deliver everything inline. See
`templates/comfyui.docker-compose.phala.yml` for the proven file. The pattern:

- **Single ingress = Caddy**, the only published port. Caddy bearer-gates every
  request, then reverse-proxies the app on an internal-only port. The app's own
  auth is disabled (`WEB_ENABLE_AUTH=false`) so the Caddy bearer is the one gate.
  Write the Caddyfile inline with a **quoted heredoc** (`<<'EOF'`) so
  `{$BEARER}` is written literally and Caddy expands it from env at runtime — the
  token never lands in the rendered file.
- **Model fetch = an init sidecar**, not the app's built-in downloader. ai-dock's
  Civitai helper silently fails even with a valid token (ai-dock issue #137); use
  an explicit `curl` sidecar that downloads into a shared named volume and exits.
  Make it idempotent with an exact-size check so a restart doesn't re-pull GBs.
- The app `depends_on` the init sidecar with
  `condition: service_completed_successfully` — so a non-zero init exit aborts the
  whole stack (see Debugging).
- **Escape shell `$` as `$$`** inside `command:` scripts so docker-compose does
  not interpolate it; the shell/Caddy expands it at runtime.
- Secrets resolve as `${CIVITAI_TOKEN}` / `${COMFYUI_BEARER_TOKEN}` from `-e .env`.
- Validate locally: `docker compose -f docker-compose.phala.yml config` exits 0.

## Step 3 — Deploy and update

- **First launch:** the dashboard flow in Step 1 (this is what reserves the GPU
  and commits the 24h order).
- **In-place updates (no new order, no extra charge):**
  ```bash
  phala deploy --cvm-id <app_id> -c docker-compose.phala.yml -e .env
  ```
  Use this to ship compose fixes onto the already-reserved GPU. This is how you
  iterate without re-reserving.

## Step 4 — Verify (the gate)

1. **GPU landing (do first — silent-CPU risk):** `phala cvms get <app_id>` /
   `phala cvms list` shows the H200 instance running. Through the app, confirm a
   real GPU — e.g. ComfyUI `/system_stats` reports `NVIDIA H200` with ~149 GB
   VRAM. If it landed on CPU, tear down and redo the dashboard flow.
2. **Attestation:** `phala cvms attestation <app_id> -j` → expect `is_online:
   true`, `tcb_info` present, `app_certificates` present.
   **Be precise about what this proves.** On a **prod** image this confirms the
   platform/dstack attestation chain is online and the TCB is present. It does
   **not** independently confirm the GPU is in confidential-compute mode
   (`nvidia-smi conf-compute -q → CC State: ON`), because the prod image blocks
   on-box shell access. Do not write or report "CC verified" — report
   "platform attestation online, TCB present; GPU CC mode not independently
   checked on the prod image." Over-claiming here is exactly how stale deploy
   lore forms.
3. **Bearer gate:** `curl -s -o /dev/null -w '%{http_code}' https://<app_id>-<port>.<gateway>/`
   → **401**; same with `-H "Authorization: Bearer <token>"` → **200**.
4. **End-to-end:** drive the real workload (queue a ComfyUI prompt, poll history,
   pull the image) and retrieve output locally. That is the gate.

Endpoint scheme: `https://<app_id>-<port>.<gateway_base_domain>` — e.g.
`https://<app_id>-8780.dstack-pha-use2.phala.network`. The hostname is derived
from the stable `app_id`, so a stop/restart keeps the same URL and sealed bearer;
only a full teardown + redeploy changes it.

## Two bug fixes that block first boot (proven)

Both surfaced as a CVM that reaches "Multi-User System" fine but whose stack never
serves. Diagnose from the **init container logs**, not the boot log.

1. **`curl` exit 23 (~0.7s), aborts the stack.** `curlimages/curl` runs as uid
   100, but a fresh named volume mounts root-owned 755 → non-root curl can't
   create the output file → exit 23 (write error). The init sidecar's non-zero
   exit kills the stack via `service_completed_successfully`. Fix: run the init
   sidecar as **`user: "0:0"`**.
2. **App sees an empty model list.** `ai-dock/comfyui` runs from **`/opt/ComfyUI`**
   and centralizes checkpoints at **`/opt/storage/stable_diffusion/models/ckpt`**,
   not `/workspace/ComfyUI/models/checkpoints`. Mount the checkpoint volume at the
   real paths (mounting both `/opt/storage/stable_diffusion/models/ckpt` and
   `/opt/ComfyUI/models/checkpoints` is belt-and-suspenders).

## Debugging a CVM that won't stay up

- A stack that dies in <1 min with `instance_id: null` and no containers is
  usually **not** a VM/GPU crash. The VM boots fine; the **App Compose Service**
  fails. Look for `service "<x>" didn't complete successfully: exit <code>`.
- **Read the failing container's logs, don't guess from the symptom.**
  `phala cvms logs -c dstack-<service>-1 <app_id>` works while the VM is running.
  Ephemeral init containers are removed after they exit, so their logs vanish once
  the VM stops — read the dashboard VM log, or restart and catch it live.
- Exit-code shorthand: **23 = curl write error** (permission or disk-full; a
  sub-second failure means permission, not disk). A multi-second failure during a
  large download points at disk size — bump `--disk-size`.

## Lifecycle & Billing

- A successful on-demand launch commits the **24h minimum (~$115.20)** with no
  extra prompt. Within that window, stopping vs. leaving it running costs the
  same — the minimum is sunk.
- **On-demand GPU CVMs cannot be stopped with `phala cvms stop`** — it returns
  *"This CVM is managed by an on-demand GPU rental order and cannot be manually
  controlled."* To actually cap billing you must **terminate the rental order in
  the dashboard**, or `phala cvms delete <app_id>` (destructive — loses the
  app_id/URL). Plan for this: do all GPU work inside the paid window, and
  terminate via dashboard before the order's hour-24 to avoid continuation
  charges.
- In-place compose updates (`phala deploy --cvm-id`) do **not** create a new order
  or charge.

## Reuse for other workloads (e.g. vLLM)

Same flow; swap the compose. For text serving: a vLLM container (serving an
abliterated model) behind the same Caddy bearer gate, model pulled by the same
init-sidecar pattern (or vLLM's HF download with a sealed `HF_TOKEN`), same
attestation + 401/200 verification. The deploy mechanics do not change.

## Security

- Never commit or print `.env`, bearer tokens, or model-download tokens. They are
  gitignored locally and sealed as Phala Encrypted Secrets at deploy.
- Do not publish internal scripts/compose with real tokens to public storage.
- Content scope for generation workloads stays lawful (e.g. adult content is in
  scope where authorized; CSAM/illegal content is always out of scope).

## Anti-Patterns

- Do not try to reserve a GPU from the CLI (`phala deploy -t h200.small`) — it
  fails "No available resources." Use the dashboard GPU-TEE flow.
- Do not accept the dashboard's default 6-month pricing or default dev OS image.
- Do not bind-mount local files or use a build context — only the compose is
  uploaded.
- Do not rely on ai-dock's built-in Civitai downloader (issue #137) — explicit
  curl sidecar.
- Do not run the curl init sidecar as the default non-root user against a fresh
  named volume — it exits 23.
- Do not report "CC attestation verified" from `is_online`+TCB alone on a prod
  image — state what was and wasn't checked.
- Do not expect `phala cvms stop` to halt an on-demand GPU rental — terminate the
  order in the dashboard.
