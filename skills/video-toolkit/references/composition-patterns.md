# Composition Patterns

Remotion (React) code patterns for wiring per-scene audio, narrator picture-in-picture, and scene transitions into a composition.

### Per-Scene Audio

Use per-scene audio with a 1-second delay (`from={30}` = 30 frames = 1s at 30fps):

```tsx
<Sequence from={30}>
  <Audio src={staticFile('audio/scenes/01.mp3')} volume={1} />
</Sequence>
```

### Per-Scene Narrator PiP

```tsx
<Sequence from={30}>
  <OffthreadVideo
    src={staticFile('narrator-01.mp4')}
    style={{ width: 320, height: 180, objectFit: 'cover' }}
    muted
  />
</Sequence>
```

**ALWAYS use `<OffthreadVideo>`, NEVER `<video>`.** Remotion requires its own component for frame-accurate rendering.

### Transitions

```tsx
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { glitch } from '../../../lib/transitions/presentations/glitch';
import { lightLeak } from '../../../lib/transitions/presentations/light-leak';
```

**NEVER import from `lib/transitions` barrel** — import custom transitions from `lib/transitions/presentations/` directly.
