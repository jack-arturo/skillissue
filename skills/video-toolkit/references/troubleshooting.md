# Troubleshooting, Progress Monitoring & Costs

Full `--progress json` output format and stage reference, the error-recovery table for common failures, and Modal cost estimates per tool.

## Progress Reporting

All cloud GPU tools support structured progress output for automated monitoring.

### Usage

Add `--progress json` to any tool command to get JSON Lines on stderr:

```bash
cd "$VIDEO_TOOLKIT_ROOT"
.venv/bin/python tools/music_gen.py \
  --preset corporate-bg --duration 60 \
  --output projects/PROJECT_NAME/public/audio/bg-music.mp3 \
  --progress json
```

### Output Format

Each line on stderr is a JSON object:

```json
{"ts":"14:23:15","stage":"submit","msg":"Sending to acemusic.ai (XL Turbo 4B, thinking: on)...","pct":null,"elapsed":0.0}
{"ts":"14:23:30","stage":"waiting","msg":"Waiting for acemusic.ai response... (15s)","pct":null,"elapsed":15.0}
{"ts":"14:23:45","stage":"waiting","msg":"Waiting for acemusic.ai response... (30s)","pct":null,"elapsed":30.0}
{"ts":"14:24:02","stage":"complete","msg":"Saved: bg-music.mp3 (245 KB, 60.1s)","pct":100,"elapsed":47.3}
```

### Stages

| Stage | Meaning |
|-------|---------|
| `submit` | Job sent to provider |
| `queue` | RunPod: waiting for GPU |
| `processing` | RunPod: GPU processing |
| `waiting` | Heartbeat during synchronous calls (acemusic, Modal) |
| `complete` | Job finished successfully |
| `error` | Something failed — check `msg` for details |
| `item` | Multi-item progress (e.g., scene 3/7) — `pct` is populated |
| `cost` | Estimated cost for the operation |

### Behaviour by Provider

- **acemusic**: Emits `submit` → periodic `waiting` heartbeats (every 15s) → `complete`
- **RunPod**: Emits `submit` → `queue` → `processing` → `complete` (on each poll)
- **Modal**: Emits `submit` → periodic `waiting` heartbeats → `complete`

Default mode (`--progress human`) shows the same events as colored terminal output — no change to existing behaviour.

---

## Error Recovery

| Problem | Solution |
|---------|----------|
| Tool command fails with "No module named..." | Run `.venv/bin/pip install -r tools/requirements.txt` from toolkit root |
| "MODAL_*_ENDPOINT_URL not configured" | Check `.env` has the endpoint URL. Run `.venv/bin/python tools/verify_setup.py` |
| SadTalker output is square/cropped | You forgot `--preprocess full`. Re-run with that flag |
| Audio too short/long for scene | Re-run Step 5 (sync timing) and update config |
| `npm run render` fails | Make sure you're in the project dir, not toolkit root. Run `npm install` first |
| "Cannot find module" in Remotion | Check import paths. Custom components use `../../../lib/` relative paths |
| Cold start timeout on Modal | First call after idle takes 30-120s. Retry once — second call uses warm GPU |
| SadTalker client timeout (long audio) | The client HTTP request can time out before Modal finishes. **Modal still uploads the result to R2.** Check `sadtalker/results/` in the `video-toolkit` R2 bucket for the output. Use `python3 -c "import boto3; ..."` with the R2 creds from `.env` to list and generate a presigned URL |

---

## Cost Estimates (Modal)

| Tool | Typical Cost | Notes |
|------|-------------|-------|
| Qwen3-TTS | ~$0.01/scene | ~20s per scene on warm GPU |
| FLUX.2 | ~$0.01/image | ~3s warm, ~30s cold |
| ACE-Step | ~$0.02-0.05 | Depends on duration |
| SadTalker | ~$0.05-0.20/scene | ~3-4 min per 10s audio |
| Qwen-Edit | ~$0.03-0.15 | ~8 min cold start (25GB model) |
| RealESRGAN | ~$0.005/image | Very fast |
| LTX-2.3 | ~$0.20-0.25/clip | ~2.5 min per 5s clip, A100-80GB |

**Total for a 60s video:** ~$1-3 depending on scenes and narrator clips.

Modal Starter plan: $30/month free compute. Apps scale to zero when idle.
