// Segment-streamed high-resolution renderer for both editions.
// Frames never touch disk: each 1-second segment is rendered by a headless-Chromium worker
// and piped straight into its own ffmpeg encoder; segments are then concatenated losslessly
// and muxed with the soundtrack. Any segment can be re-rendered on its own.
//
//   node motion/render4k.cjs --edition 2d                    → we-make-motion/we-make-motion-4k.mp4
//   node motion/render4k.cjs --edition 3d                    → we-make-motion-3d/we-make-motion-3d-4k.mp4
//   options: --width 3840 --samples N --workers K --segments 3,17 (redo only these) --keep 4.4,11,23.2 (save stills)
const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const req = m => { try { return require(m); } catch { return require(path.join('/opt/node22/lib/node_modules', m)); } };
const { chromium } = req('playwright');

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const ED = arg('edition', '2d'), IS3 = ED === '3d';
const WIDTH = +arg('width', 3840), HEIGHT = Math.round((WIDTH * 9) / 16);
const SAMPLES = +arg('samples', IS3 ? 3 : 24), WORKERS = +arg('workers', IS3 ? 2 : 3);
const FPS = 60, TOTAL = 30 * FPS, SEG = 60, NSEG = TOTAL / SEG;
const ROOT = path.join(__dirname, IS3 ? 'we-make-motion-3d' : 'we-make-motion');
const OUT = path.join(ROOT, 'render', `out-${WIDTH}`), SEGS = path.join(OUT, 'segments'), KEEP = path.join(OUT, 'keep');
const FFMPEG = process.env.FFMPEG || execFileSync('python3', ['-c', 'import imageio_ffmpeg as i; print(i.get_ffmpeg_exe())']).toString().trim();
const FONTS2D = path.join(__dirname, 'we-make-motion', 'render', 'fonts');
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

function harness() {
  execFileSync('node', [path.join(ROOT, IS3 ? 'build3.mjs' : 'build.mjs')], { stdio: 'inherit' });
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(FONTS2D, 'local.css'), 'utf8').replace(/url\(([^)]+\.woff2)\)/g, (_, f) =>
    `url(data:font/woff2;base64,${fs.readFileSync(path.join(FONTS2D, f)).toString('base64')})`);
  html = html.replace(/<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>\n?/g, '');
  if (IS3) {
    const vendor = n => `<script>${fs.readFileSync(path.join(ROOT, 'vendor', n), 'utf8')}</script>`;
    html = html.replace(/<script src="[^"]*three\.min\.js"><\/script>/, () => vendor('three.min.js'))
      .replace(/<script src="[^"]*opentype\.min\.js"><\/script>/, () => vendor('opentype.min.js'))
      .replace(/<script src="[^"]*polygon-clipping\.umd\.min\.js"><\/script>/, () => vendor('polygon-clipping.umd.min.js'));
  }
  return `<!doctype html><html><head><meta charset="utf-8"><script>window.MWC_HEADLESS = true;</script><style>${css}</style></head><body>${html}</body></html>`;
}

async function openPage(browser, html) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => log('page error:', e.message));
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(async ([w, h, is3]) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; window.__c = c;
    if (is3) { document.body.appendChild(c); MWC3.initGL(c); MWC3.sizeGL(w, h); await MWC3.prepare3(); }
    else { await MWC.prepare(); MWC.RO.streaks = false; MWC.RO.grain = false; }
  }, [WIDTH, HEIGHT, IS3]);
  return page;
}
const grab = (page, t) => page.evaluate(([t, n, is3]) => {
  if (is3) MWC3.renderFrame3(t, n); else MWC.renderAccum(__c, t, n);
  return __c.toDataURL('image/png');
}, [t, SAMPLES, IS3]);

function encoder(seg) {
  const vf = IS3 ? 'format=yuv420p' : `noise=c0s=2:c0f=t:c0_seed=${seg * 7919 + 1},format=yuv420p`;
  const p = spawn(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', IS3 ? '18' : '17', '-profile:v', 'high', '-level', '5.2',
    '-x264-params', `keyint=${SEG}:min-keyint=${SEG}:scenecut=0`, '-an', path.join(SEGS, `s${String(seg).padStart(2, '0')}.mp4`)], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => p.on('close', c => (c === 0 ? res() : rej(new Error(`ffmpeg segment ${seg} exited ${c}`)))));
  const write = buf => new Promise(res => (p.stdin.write(buf) ? res() : p.stdin.once('drain', res)));
  return { write, end: () => { p.stdin.end(); return done; } };
}

(async () => {
  const t0 = Date.now();
  fs.mkdirSync(SEGS, { recursive: true }); fs.mkdirSync(KEEP, { recursive: true });
  const only = arg('segments', null);
  const todo = only ? only.split(',').map(Number) : [...Array(NSEG).keys()];
  const keep = new Set((arg('keep', '') || '').split(',').filter(Boolean).map(t => Math.round(+t * FPS)));
  const html = harness();
  const browser = await chromium.launch({ args: IS3 ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const pages = [];
  for (let i = 0; i < WORKERS; i++) pages.push(await openPage(browser, html));
  log(`${ED} ${WIDTH}×${HEIGHT} · ${SAMPLES} samples · ${WORKERS} workers · ${todo.length} segments`);

  // soundtrack from the same score
  const wav = path.join(OUT, 'soundtrack.wav');
  if (!only || !fs.existsSync(wav)) {
    const b64 = await pages[0].evaluate(async is3 => {
      const M = is3 ? MWC3 : MWC, b = M.wavBytes(await M.renderSoundtrack());
      let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
      return btoa(s);
    }, IS3);
    fs.writeFileSync(wav, Buffer.from(b64, 'base64'));
  }

  const queue = todo.slice();
  let framesDone = 0;
  await Promise.all(pages.map(async page => {
    while (queue.length) {
      const seg = queue.shift(), enc = encoder(seg), ts = Date.now();
      for (let f = seg * SEG; f < (seg + 1) * SEG; f++) {
        const png = Buffer.from((await grab(page, f / FPS)).split(',')[1], 'base64');
        if (keep.has(f)) fs.writeFileSync(path.join(KEEP, `f${String(f).padStart(5, '0')}.png`), png);
        await enc.write(png);
        framesDone++;
      }
      await enc.end();
      log(`segment ${seg} done in ${((Date.now() - ts) / 1000).toFixed(0)} s · ${framesDone}/${todo.length * SEG} frames · ${((Date.now() - t0) / 60000).toFixed(1)} min`);
    }
  }));
  await browser.close();

  const missing = [...Array(NSEG).keys()].filter(s => !fs.existsSync(path.join(SEGS, `s${String(s).padStart(2, '0')}.mp4`)));
  if (missing.length) { log(`segments rendered; ${missing.length} still missing (${missing.join(',')}), skipping the final mux`); return; }
  const list = path.join(OUT, 'segments.txt');
  fs.writeFileSync(list, [...Array(NSEG).keys()].map(s => `file '${path.join(SEGS, `s${String(s).padStart(2, '0')}.mp4`)}'`).join('\n'));
  const mp4 = path.join(ROOT, IS3 ? `we-make-motion-3d-${WIDTH === 3840 ? '4k' : WIDTH}.mp4` : `we-make-motion-${WIDTH === 3840 ? '4k' : WIDTH}.mp4`);
  execFileSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-i', wav,
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
  log(`film → ${mp4} (${(fs.statSync(mp4).size / 1e6).toFixed(1)} MB) in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
})().catch(e => { console.error(e); process.exit(1); });
