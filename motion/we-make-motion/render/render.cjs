// Offline renderer: drives index.html in headless Chromium, renders every frame with
// sub-frame motion blur, exports the soundtrack, and muxes both with ffmpeg.
//
//   node render/render.cjs                       full film → we-make-motion.mp4
//   node render/render.cjs --stills 1,4.2,12     preview frames → render/out/stills/
//   node render/render.cjs --range 1650,1800     re-render a frame range, then re-mux
//   options: --fps 60 --samples 24 --workers 3 --out we-make-motion.mp4
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const req = m => { try { return require(m); } catch { return require(path.join('/opt/node22/lib/node_modules', m)); } };
const { chromium } = req('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'out');
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const FPS = +arg('fps', 60), SAMPLES = +arg('samples', 24), WORKERS = +arg('workers', 3);
const STILLS = arg('stills', null);
const FFMPEG = process.env.FFMPEG || execFileSync('python3', ['-c', 'import imageio_ffmpeg as i; print(i.get_ffmpeg_exe())']).toString().trim();

function harness() {
  execFileSync('node', [path.join(ROOT, 'build.mjs')], { stdio: 'inherit' });
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const fdir = path.join(__dirname, 'fonts');
  const css = fs.readFileSync(path.join(fdir, 'local.css'), 'utf8').replace(/url\(([^)]+\.woff2)\)/g, (_, f) =>
    `url(data:font/woff2;base64,${fs.readFileSync(path.join(fdir, f)).toString('base64')})`);
  html = html.replace(/<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>\n?/g, '');
  return `<!doctype html><html><head><meta charset="utf-8"><script>window.MWC_HEADLESS = true;</script><style>${css}</style></head><body>${html}</body></html>`;
}

async function openPage(browser, html) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('page error:', e.message));
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(async () => {
    await MWC.prepare();
    MWC.RO.streaks = false; MWC.RO.grain = false;
    window.__c = document.createElement('canvas'); __c.width = MWC.W; __c.height = MWC.H;
  });
  return page;
}
const grab = (page, t, samples) => page.evaluate(([t, n]) => {
  if (n > 1) MWC.renderAccum(__c, t, n); else { MWC.RO.streaks = true; MWC.renderFrame(__c, t); MWC.RO.streaks = false; }
  return __c.toDataURL('image/png');
}, [t, samples]);
const save = (file, dataUrl) => fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));

(async () => {
  const html = harness();
  const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text'] });
  fs.mkdirSync(OUT, { recursive: true });

  if (STILLS) {
    const dir = path.join(OUT, 'stills'); fs.mkdirSync(dir, { recursive: true });
    const page = await openPage(browser, html);
    for (const t of STILLS.split(',').map(Number)) {
      save(path.join(dir, `t${t.toFixed(3).padStart(7, '0')}.png`), await grab(page, t, +arg('samples', 1)));
    }
    await browser.close();
    console.log(`stills → ${dir}`);
    return;
  }

  // --range a,b re-renders only frames [a, b) into the existing frame folder, then re-muxes.
  const range = arg('range', null);
  const frames = path.join(OUT, 'frames');
  if (!range) { fs.rmSync(frames, { recursive: true, force: true }); }
  fs.mkdirSync(frames, { recursive: true });
  const total = Math.round(30 * FPS);
  const [fa, fb] = range ? range.split(',').map(Number) : [0, total];
  const t0 = Date.now();

  // soundtrack
  const page0 = await openPage(browser, html);
  const wavB64 = await page0.evaluate(async () => {
    const bytes = MWC.wavBytes(await MWC.renderSoundtrack());
    let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  });
  const wav = path.join(OUT, 'soundtrack.wav');
  fs.writeFileSync(wav, Buffer.from(wavB64, 'base64'));
  console.log(`soundtrack → ${wav}`);
  if (process.argv.includes('--audio-only')) { await browser.close(); return; }

  // picture, split across workers
  const pages = [page0];
  for (let i = 1; i < WORKERS; i++) pages.push(await openPage(browser, html));
  let done = 0;
  await Promise.all(pages.map(async (page, w) => {
    for (let f = fa + w; f < fb; f += WORKERS) {
      save(path.join(frames, `f${String(f).padStart(5, '0')}.png`), await grab(page, f / FPS, SAMPLES));
      if (++done % 60 === 0) console.log(`  ${done}/${fb - fa} frames · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
  }));
  await browser.close();

  const mp4 = path.join(ROOT, arg('out', 'we-make-motion.mp4'));
  execFileSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error',
    '-framerate', String(FPS), '-i', path.join(frames, 'f%05d.png'), '-i', wav,
    '-vf', 'noise=c0s=2:c0f=t,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
    '-profile:v', 'high', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
  console.log(`film → ${mp4} (${(fs.statSync(mp4).size / 1e6).toFixed(1)} MB) in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
})().catch(e => { console.error(e); process.exit(1); });
