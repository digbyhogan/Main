# We Make Motion*

A 30-second motion piece with its own soundtrack, built entirely in code: one HTML file,
Canvas 2D for picture, Web Audio for sound. No video editor, no DAW, no samples.

- **Watch:** `we-make-motion.mp4` (1920×1080, 60 fps, H.264 + AAC)
- **Play / scrub:** open `index.html` (real-time, with a dope sheet and a "Principles" overlay)

## How it's built

Every frame is a pure function of time, `renderFrame(canvas, t)`, and every sound is scheduled
from the same cue sheet (`CUE` in `src/core.js`). That single source of truth is what keeps the
bounces, slams and wipes locked to the percussion.

| File | What it does |
| --- | --- |
| `src/core.js` | Frame, tempo (120 BPM), palette, easings, analytic spring, hash noise, cue sheet, glyph tools |
| `src/scenes-1.js` | The drop · WE (particles) · MAKE (monoline construction) |
| `src/scenes-2.js` | MOTION (wave + marquee build) · without (the silence, the zoom into the o) |
| `src/scenes-3.js` | CODE · the claim · the fine print · HUD · compositor · motion-blur accumulator |
| `src/audio.js` | Synthesised kit (kick, snare, clap, hats, clacks, plucks, risers, glitches) and the score |
| `src/player.js` | Transport, waveform scrubber, dope sheet, principle captions |
| `build.mjs` | Stitches `src/` into `index.html` |
| `render/render.cjs` | Headless Chromium renderer: 24-sample motion blur per frame, WAV export, ffmpeg mux |

## Rebuild

```sh
node build.mjs                          # index.html
pip install imageio-ffmpeg              # provides an ffmpeg with libx264
node render/render.cjs                  # we-make-motion.mp4 (~10 min on 4 cores)
node render/render.cjs --stills 4,12.5  # preview frames into render/out/stills/
```

Palette: Ink `#111116` · Chalk `#F1EFE9` · Ultramarine `#2D2DF5` · Flamingo `#FF5A87` · Butter `#FFD34E`.
Type: Unbounded 900, Bodoni Moda Italic, Martian Mono (all SIL OFL, bundled in `render/fonts/`).
