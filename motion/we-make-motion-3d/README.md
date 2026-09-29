# We Make Motion* 3D

The 3D edition of [We Make Motion*](../we-make-motion/). It has the same 30-second cut, cue sheet and synthesised score, re-staged in WebGL with extruded type, glowing accents, grit, and noise-edged mattes.

- **Watch:** `we-make-motion-3d.mp4` (1920×1080, 60 fps, 3-sample motion blur)
- **Play / scrub:** open `index.html` (real-time WebGL, with a dope sheet and a Principles overlay)

## What's new in 3D

| Moment | Technique |
| --- | --- |
| The drop | The dot is an emissive sphere that carries its own light, so the gritty concrete floor only exists where it lands |
| WE | Particles scatter in depth, then flatten onto the letters' face. The word extrudes its own thickness on a spring while the camera orbits |
| WE → MAKE | Liquid wipe as a **noise-edged matte** with a glowing seam |
| MAKE | Monoline letters as glossy ink **capsule strokes** (cylinders and spheres) drawn on like a pen, casting shadows on a paper wall |
| MAKE → MOTION | **Iris matte** opening from the dot |
| MOTION | Extruded letters ride a glowing ribbon with **echo trails in depth**. The marquee rows sit at different depths, and a **dolly zoom** stretches them during the build |
| without | Bodoni surfacing out of fog. The o's counter is a **portal matte** into the CODE scene, and the camera flies through it |
| CODE | Three parallax layers of the film's own source, butter-glow extruded brackets, and letters that tumble toward the lens |
| The claim | Words rise through **clipping-plane mattes** at their baselines; a spotlight sweeps the lockup across a gritty wall |
| The fine print | One world rendered in two looks, joined by a noise-edged **curtain matte**. The full stop grows six glowing arms |

## How it's built

The 3D edition reuses the 2D film's choreography functions (`dropDot`, `partPos`, `moLetter`, `surfDot`, `codeSlot`, `finDot` and the rest) and its score, so both editions move and hit identically.

| File | What it does |
| --- | --- |
| `src/gl3.js` | Renderer and post chain: HDR scene targets → matte (fbm-noise edge + glow) → dual-Kawase bloom → hue-preserving tone curve, chromatic aberration, vignette, glitch → sub-frame accumulation → film grain, dust, scratches, gate weave |
| `src/world3.js` | Extruded type from the film's fonts (opentype.js outlines, polygon-unioned so overlapping variable-font contours don't seam), procedural grit textures, materials |
| `src/scenes3-1..3.js` | The eight scenes, the director (`shot(t)`: which worlds, which matte, which look), HUD, frame loop |
| `src/player3.js` | Real-time player |
| `build3.mjs` | Stitches everything (fonts inlined) into `index.html` |
| `render/render3.cjs` | Headless Chromium + SwiftShader WebGL renderer and ffmpeg mux |

```sh
node build3.mjs
node render/render3.cjs --stills 4.4,12.5,25.8   # preview frames
node render/render3.cjs --samples 3 --workers 2  # the film
```

Libraries: three.js r128, opentype.js 1.3.4, polygon-clipping 0.15.7 (vendored in `vendor/` for offline renders, loaded from CDNs by the page).
