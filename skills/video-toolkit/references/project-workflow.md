# Project Workflow

End-to-end steps for producing a new video: brand recall, project scaffolding, config and voiceover-script authoring, then — after generating assets (see [asset-generation.md](asset-generation.md)) — timing sync, still-frame review, and final render.

## Brand recall preflight

Before generating a branded video, recall the current brand decisions once via
AutoMem. Query the project's or brand's bare tag for colors, typography,
imagery, voice, pacing, and any explicit do-not-use rules. Use current active
memories only and never recall or store secrets.

```javascript
mcp__memory__recall_memory({
  tags: ["<brand-slug>"],
  query: "brand colors typography imagery voice pacing",
  limit: 10,
  format: "detailed"
})
```

Apply durable decisions to the toolkit's existing
`brands/<slug>/brand.json` and `brands/<slug>/voice.json` files when those
files exist. Keep both paths beneath `$VIDEO_TOOLKIT_ROOT`; do not create a
machine-specific absolute path inside a project config. If recall returns no
new brand facts, continue with the checked-in profile and say which fallback
was used. Brand recall is required for branded work and skipped for explicitly
generic or unbranded assets.

---

## Creating a Video

### Step 1: Create Project

```bash
cd "$VIDEO_TOOLKIT_ROOT"
cp -r templates/product-demo projects/PROJECT_NAME
cd projects/PROJECT_NAME
npm install
```

Templates: `product-demo` (marketing/explainer), `sprint-review`, `sprint-review-v2` (composable scenes).

### Step 2: Write Config

Edit `projects/PROJECT_NAME/src/config/demo-config.ts`:

```typescript
export const demoConfig: ProductDemoConfig = {
  product: {
    name: 'My Product',
    tagline: 'What it does in one line',
    website: 'example.com',
  },
  scenes: [
    { type: 'title', durationSeconds: 9, content: { headline: '...', subheadline: '...' } },
    { type: 'problem', durationSeconds: 14, content: { headline: '...', problems: ['...', '...'] } },
    { type: 'solution', durationSeconds: 13, content: { headline: '...', highlights: ['...', '...'] } },
    { type: 'stats', durationSeconds: 12, content: { stats: [{value: '99%', label: '...'}, ...] } },
    { type: 'cta', durationSeconds: 10, content: { headline: '...', links: ['...'] } },
  ],
  audio: {
    backgroundMusicFile: 'audio/bg-music.mp3',
    backgroundMusicVolume: 0.12,
  },
};
```

Scene types: `title`, `problem`, `solution`, `demo`, `feature`, `stats`, `cta`.

**Duration rule:** Estimate `durationSeconds` as `ceil(word_count / 2.5) + 2`. You will adjust this after generating audio in Step 4.

### Step 3: Write Voiceover Script

Create `projects/PROJECT_NAME/VOICEOVER-SCRIPT.md`:

```markdown
## Scene 1: Title (9s, ~17 words)
Build videos with AI. The product name toolkit makes it easy.

## Scene 2: Problem (14s, ~30 words)
The problem statement goes here. Keep it punchy and relatable.
```

**Word budget per scene:** `(durationSeconds - 2) * 2.5` words. The -2 accounts for 1s audio delay + 1s padding.

### Step 4: Generate Assets

See [asset-generation.md](asset-generation.md) for the full asset-generation workflow — background music, per-scene voiceover, scene images, AI video clips (b-roll and chained sequences), talking-head narrator clips, image editing, and upscaling. All commands there run from the toolkit root, same as everywhere else in this workflow.

### Step 5: Sync Timing

**ALWAYS do this after generating voiceover.** Audio duration differs from estimates.

```bash
cd "$VIDEO_TOOLKIT_ROOT"
for f in projects/PROJECT_NAME/public/audio/scenes/*.mp3; do
  echo "$(basename $f): $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")s"
done
```

Update each scene's `durationSeconds` in `demo-config.ts` to: `ceil(actual_audio_duration + 2)`.

Example: if `01.mp3` is 6.8s, set scene 1 `durationSeconds` to `9` (ceil(6.8 + 2) = 9).

### Step 6: Review Still Frames

```bash
cd "$VIDEO_TOOLKIT_ROOT"/projects/PROJECT_NAME
npx remotion still src/index.ts ProductDemo --frame=100 --output=/tmp/review-scene1.png
npx remotion still src/index.ts ProductDemo --frame=400 --output=/tmp/review-scene2.png
```

Check: text truncation, animation timing, narrator PiP positioning, background contrast.

### Step 7: Render

```bash
cd "$VIDEO_TOOLKIT_ROOT"/projects/PROJECT_NAME
npm run render
```

**Output:** `out/ProductDemo.mp4`
