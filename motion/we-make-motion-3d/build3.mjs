// Stitches the 3D edition into one index.html: the 2D film's choreography, score and
// cue sheet, plus the 3D renderer, the extruded type (fonts inlined) and the player.
import fs from 'node:fs';
import path from 'node:path';

const dir = path.dirname(new URL(import.meta.url).pathname);
const twoD = path.join(dir, '..', 'we-make-motion', 'src');
const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');
const shared = ['core', 'scenes-1', 'scenes-2', 'scenes-3', 'audio'].map(n => read(twoD, `${n}.js`));
const fonts = { disp: 'Unbounded-900', serif: 'BodoniModa-96-Italic', mono: 'MartianMono-700' };
const fontData = `const FONT_DATA = {\n${Object.entries(fonts).map(([k, f]) => `  ${k}: '${fs.readFileSync(path.join(dir, 'fonts', `${f}.woff`)).toString('base64')}',`).join('\n')}\n};`;
const own = ['gl3', 'world3', 'scenes3-1', 'scenes3-2', 'scenes3-3', 'player3'].map(n => read(dir, 'src', `${n}.js`));
const film = `(() => {
'use strict';
${shared.join('\n')}
${fontData}
${own.join('\n')}
window.MWC3 = { prepare3, initGL, sizeGL, renderFrame3, renderSoundtrack, wavBytes, RO, DUR, FPS, W, H, G3 };
if (!window.MWC_HEADLESS) { initGL(document.querySelector('#film')); prepare3().then(startPlayer3); }
})();`;
let html = read(twoD, 'shell.html')
  .replace('<title>We Make Motion</title>', '<title>We Make Motion 3D</title>')
  .replace('<h1>We Make Motion<i>*</i></h1>', '<h1>We Make Motion<i>*</i> <span style="font-family:var(--mono); font-weight:700; font-size:.45em; letter-spacing:.08em; vertical-align:middle; border:1px solid var(--rule); border-radius:3px; padding:2px 6px">3D</span></h1>')
  .replace('<p class="meta">30 s · 1920×1080 · 120 BPM · 15 bars · picture + sound from one cue sheet</p>',
    '<p class="meta">30 s · 120 BPM · WebGL · extruded type · bloom · grit · noise-edged mattes</p>')
  .replace('<script>\n/*__FILM__*/', '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>\n<script src="https://cdnjs.cloudflare.com/ajax/libs/opentype.js/1.3.4/opentype.min.js"></script>\n<script src="https://cdn.jsdelivr.net/npm/polygon-clipping@0.15.7/dist/polygon-clipping.umd.min.js"></script>\n<script>\n/*__FILM__*/')
  .replace('/*__FILM__*/', () => film);
html = html.replace('__LINES__', html.split('\n').length.toLocaleString('en-US'));
fs.writeFileSync(path.join(dir, 'index.html'), html);
console.log(`index.html: ${html.split('\n').length} lines, ${(html.length / 1024).toFixed(1)} KB`);
