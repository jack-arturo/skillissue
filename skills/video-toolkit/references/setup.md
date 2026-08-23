# Setup

One-time environment setup: verify local state, install Python dependencies, configure or deploy Modal cloud GPU endpoints, and confirm the pipeline with a quick test. Run this before creating a video project. See the main SKILL.md for the toolkit-root and `--progress json` conventions these steps assume.

### Step 1: Check Current State

```bash
cd "$VIDEO_TOOLKIT_ROOT"
.venv/bin/python tools/verify_setup.py
```

If everything shows `[x]`, skip to "Quick Test" below. Otherwise continue setup.

### Step 2: Install Python Dependencies

```bash
cd "$VIDEO_TOOLKIT_ROOT"
python3 -m venv .venv
.venv/bin/pip install -r tools/requirements.txt
```

Keep dependencies inside the toolkit virtual environment; do not modify the
host's managed Python installation.

### Step 3: Configure Cloud GPU Endpoints

The toolkit needs cloud GPU endpoint URLs in `.env`. Check if `.env` exists and has Modal endpoints:

```bash
for key in MODAL_QWEN3_TTS_ENDPOINT_URL MODAL_FLUX2_ENDPOINT_URL MODAL_MUSIC_GEN_ENDPOINT_URL; do
  grep -q "^${key}=" "$VIDEO_TOOLKIT_ROOT/.env" 2>/dev/null \
    && printf '%s=<present>\n' "$key" \
    || printf '%s=<missing>\n' "$key"
done
```

If Modal endpoints are configured, you're ready. If not, **ask the user to provide Modal endpoint URLs** or set up Modal:

```bash
.venv/bin/pip install modal
.venv/bin/python -m modal setup   # Opens browser for authentication

# Deploy each tool — capture the endpoint URL from output
cd "$VIDEO_TOOLKIT_ROOT"
modal deploy docker/modal-qwen3-tts/app.py
modal deploy docker/modal-flux2/app.py
modal deploy docker/modal-music-gen/app.py
modal deploy docker/modal-sadtalker/app.py
modal deploy docker/modal-image-edit/app.py
modal deploy docker/modal-upscale/app.py
modal deploy docker/modal-propainter/app.py
modal deploy docker/modal-ltx2/app.py
```

**LTX-2 prerequisite:** Before deploying LTX-2, create a HuggingFace secret and accept the [Gemma 3 license](https://huggingface.co/google/gemma-3-12b-it-qat-q4_0-unquantized):
```bash
modal secret create huggingface-token HF_TOKEN="$HF_TOKEN"
```

Load `HF_TOKEN` from the operator's secret manager or environment. Never paste
or print a token in the task transcript.

Add each URL to `.env`:
```
ACEMUSIC_API_KEY=...                          # Free key from acemusic.ai/api-key (best music quality)
MODAL_QWEN3_TTS_ENDPOINT_URL=https://...modal.run
MODAL_FLUX2_ENDPOINT_URL=https://...modal.run
MODAL_MUSIC_GEN_ENDPOINT_URL=https://...modal.run
MODAL_SADTALKER_ENDPOINT_URL=https://...modal.run
MODAL_IMAGE_EDIT_ENDPOINT_URL=https://...modal.run
MODAL_UPSCALE_ENDPOINT_URL=https://...modal.run
MODAL_DEWATERMARK_ENDPOINT_URL=https://...modal.run
MODAL_LTX2_ENDPOINT_URL=https://...modal.run
```

Optional but recommended — Cloudflare R2 for reliable file transfer:
```
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=video-toolkit
```

### Step 4: Verify and Quick Test

```bash
cd "$VIDEO_TOOLKIT_ROOT"
.venv/bin/python tools/verify_setup.py
```

All tools should show `[x]`. Then run a quick test to confirm the GPU pipeline works:

```bash
cd "$VIDEO_TOOLKIT_ROOT"
.venv/bin/python tools/qwen3_tts.py --text "Hello, this is a test." --speaker Ryan --tone warm --output /tmp/video-toolkit-test.mp3 --cloud modal
```

If you get a valid .mp3 file, setup is complete. If it fails, check:
- `.env` has the correct `MODAL_QWEN3_TTS_ENDPOINT_URL`
- Run `.venv/bin/python tools/verify_setup.py --json` and check `modal_tools` for which endpoints are missing

**Cost:** Modal includes $30/month free compute. A typical 60s video costs $1-3.
