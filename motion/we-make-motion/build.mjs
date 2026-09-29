// Stitches src/ into a single self-contained index.html (the published page).
import fs from 'node:fs';
import path from 'node:path';

const dir = path.dirname(new URL(import.meta.url).pathname);
const parts = ['core', 'scenes-1', 'scenes-2', 'scenes-3', 'audio', 'player']
  .map(n => fs.readFileSync(path.join(dir, 'src', `${n}.js`), 'utf8'));
const film = `(() => {
'use strict';
${parts.join('\n')}
window.MWC = { prepare, renderFrame, renderAccum, renderSoundtrack, wavBytes, RO, DUR, FPS, W, H, stats: () => ({ particles: WE.parts.length }) };
if (!window.MWC_HEADLESS) prepare().then(startPlayer);
})();`;
let html = fs.readFileSync(path.join(dir, 'src', 'shell.html'), 'utf8').replace('/*__FILM__*/', () => film);
html = html.replace('__LINES__', html.split('\n').length.toLocaleString('en-US'));
fs.writeFileSync(path.join(dir, 'index.html'), html);
console.log(`index.html: ${html.split('\n').length} lines, ${(html.length / 1024).toFixed(1)} KB`);
