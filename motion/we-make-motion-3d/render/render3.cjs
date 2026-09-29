// Offline renderer for the 3D edition: WebGL2 in headless Chromium (SwiftShader), sub-frame
// motion blur accumulated on the GPU, soundtrack from the same score, muxed with ffmpeg.
//
//   node render/render3.cjs                         full film → we-make-motion-3d.mp4
//   node render/render3.cjs --stills 1,4.2,12       preview frames → render/out/stills/
//   options: --samples 4 --workers 2 --range a,b --audio-only
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const req = m => { try { return require(m); } catch { return require(path.join('/opt/node22/lib/node_modules', m)); } };
const { chromium } = req('playwright');

const ROOT = path.resolve(__dirname, '..'), OUT = path.join(__dirname, 'out');
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const FPS = 60, SAMPLES = +arg('samples', 4), WORKERS = +arg('workers', 2), STILLS = arg('stills', null);
const FFMPEG = process.env.FFMPEG || execFileSync('python3', ['-c', 'import imageio_ffmpeg as i; print(i.get_ffmpeg_exe())']).toString().trim();

function harness() {
  execFileSync('node', [path.join(ROOT, 'build3.mjs')], { stdio: 'inherit' });
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const fdir = path.join(ROOT, '..', 'we-make-motion', 'render', 'fonts');
  const css = fs.readFileSync(path.join(fdir, 'local.css'), 'utf8').replace(/url\(([^)]+\.woff2)\)/g, (_, f) =>
    `url(data:font/woff2;base64,${fs.readFileSync(path.join(fdir, f)).toString('base64')})`);
  const vendor = n => `<script>${fs.readFileSync(path.join(ROOT, 'vendor', n), 'utf8')}</script>`;
  html = html.replace(/<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>\n?/g, '')
    .replace(/<script src="[^"]*three\.min\.js"><\/script>/, () => vendor('three.min.js'))
    .replace(/<script src="[^"]*opentype\.min\.js"><\/script>/, () => vendor('opentype.min.js'))
    .replace(/<script src="[^"]*polygon-clipping\.umd\.min\.js"><\/script>/, () => vendor('polygon-clipping.umd.min.js'));
  return `<!doctype html><html><head><meta charset="utf-8"><script>window.MWC_HEADLESS = true;</script><style>${css}</style></head><body>${html}</body></html>`;
}
async function openPage(browser, html) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('page error:', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = MWC3.W; c.height = MWC3.H; document.body.appendChild(c);
    window.__c = c; MWC3.initGL(c); MWC3.sizeGL(MWC3.W, MWC3.H); await MWC3.prepare3();
  });
  return page;
}
const grab = (page, t, n) => page.evaluate(([t, n]) => { MWC3.renderFrame3(t, n); return __c.toDataURL('image/png'); }, [t, n]);
const save = (f, u) => fs.writeFileSync(f, Buffer.from(u.split(',')[1], 'base64'));

(async () => {
  const html = harness();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  fs.mkdirSync(OUT, { recursive: true });
  if (STILLS) {
    const dir = path.join(OUT, 'stills'); fs.mkdirSync(dir, { recursive: true });
    const page = await openPage(browser, html), n = +arg('samples', 1);
    for (const t of STILLS.split(',').map(Number)) {
      const t0 = Date.now();
      save(path.join(dir, `t${t.toFixed(3).padStart(7, '0')}.png`), await grab(page, t, n));
      console.log(`  ${t}s ${Date.now() - t0} ms`);
    }
    await browser.close(); return;
  }
  const range = arg('range', null), audioOnly = process.argv.includes('--audio-only');
  const frames = path.join(OUT, 'frames');
  if (!range && !audioOnly) fs.rmSync(frames, { recursive: true, force: true });
  fs.mkdirSync(frames, { recursive: true });
  const total = 30 * FPS, [fa, fb] = range ? range.split(',').map(Number) : [0, total];
  const t0 = Date.now();
  const page0 = await openPage(browser, html);
  const wavB64 = await page0.evaluate(async () => {
    const b = MWC3.wavBytes(await MWC3.renderSoundtrack());
    let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  });
  const wav = path.join(OUT, 'soundtrack.wav');
  fs.writeFileSync(wav, Buffer.from(wavB64, 'base64'));
  console.log(`soundtrack → ${wav}`);
  if (audioOnly) { await browser.close(); return; }
  const pages = [page0];
  for (let i = 1; i < WORKERS; i++) pages.push(await openPage(browser, html));
  let done = 0;
  await Promise.all(pages.map(async (page, w) => {
    for (let f = fa + w; f < fb; f += WORKERS) {
      save(path.join(frames, `f${String(f).padStart(5, '0')}.png`), await grab(page, f / FPS, SAMPLES));
      if (++done % 30 === 0) console.log(`  ${done}/${fb - fa} frames · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
  }));
  await browser.close();
  const mp4 = path.join(ROOT, 'we-make-motion-3d.mp4');
  execFileSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(frames, 'f%05d.png'), '-i', wav,
    '-vf', 'format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high',
    '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
  console.log(`film → ${mp4} (${(fs.statSync(mp4).size / 1e6).toFixed(1)} MB) in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
})().catch(e => { console.error(e); process.exit(1); });
