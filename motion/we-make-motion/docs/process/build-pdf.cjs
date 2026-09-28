// Builds the process document: gathers real numbers from the film, draws charts from real
// data, prepares images from the rendered frames, and prints A4-landscape PDF via Chromium.
//   node docs/process/build-pdf.cjs            (after render/render.cjs has produced the master)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const req = m => { try { return require(m); } catch { return require(path.join('/opt/node22/lib/node_modules', m)); } };
const { chromium } = req('playwright');

const DOC = __dirname, ROOT = path.resolve(DOC, '../..'), OUT = path.join(ROOT, 'render/out');
const IMG = path.join(DOC, 'img');
const FFMPEG = process.env.FFMPEG || execFileSync('python3', ['-c', 'import imageio_ffmpeg as i; print(i.get_ffmpeg_exe())']).toString().trim();
const ff = args => execFileSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', ...args]);
// Every image of the finished film is pulled from the delivered master, so the document shows exactly what shipped.
const grabbed = new Map();
function fromVideo(video, t, tag) {
  const key = `${tag}-${t.toFixed(3)}`;
  if (grabbed.has(key)) return grabbed.get(key);
  const dir = path.join(OUT, 'from-master'); fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `${key}.png`);
  ff(['-ss', t.toFixed(4), '-i', video, '-frames:v', '1', '-vf', 'scale=1920:-1:flags=lanczos', f]);
  grabbed.set(key, f); return f;
}
const MASTER2 = path.join(ROOT, 'we-make-motion-4k.mp4');
const frame = t => fromVideo(MASTER2, t + 0.5 / 60, '2d');
const jpg = (src, dst, vf) => ff(['-i', src, '-vf', vf, '-q:v', '3', path.join(IMG, dst)]);
const fmt = n => n.toLocaleString('en-US');

const SCENES = [[0, 'Drop', 'ink'], [2, 'WE', 'ink'], [6, 'MAKE', 'chalk'], [10, 'MOTION', 'ultra'], [16, 'without', 'chalk'], [18, 'CODE', 'ink'], [22, 'Claim', 'ultra'], [26, 'Fine print', 'ink'], [30]];
const C = { ink: '#111116', chalk: '#F1EFE9', ultra: '#2D2DF5', flamingo: '#FF5A87', muted: '#6E6C76' };

function images() {
  fs.mkdirSync(IMG, { recursive: true });
  for (const t of [0.9, 1.0, 2.6, 3.4, 7.3, 9.85, 11.0, 15.4, 17.2, 17.8, 19.6, 20.6, 23.1, 25.8, 26.4, 28.8]) {
    jpg(frame(t), `s-${t.toFixed(2)}.jpg`, 'scale=1280:-1');
  }
  jpg(path.join(OUT, 'sheet1.png'), 'sheet-first.jpg', 'scale=1600:-1');
  jpg(path.join(OUT, 'sheet1.png'), 'pb-pink.jpg', 'crop=480:270:486:1104,scale=960:-1');
  jpg(frame(12.4), 'pa-pink.jpg', 'scale=960:-1');
  jpg(path.join(OUT, 'before-outline.png'), 'pb-outline.jpg', 'crop=560:315:360:230,scale=960:-1');
  jpg(frame(13.2), 'pa-outline.jpg', 'crop=560:315:360:230,scale=960:-1');
  jpg(path.join(OUT, 'blur8.png'), 'pb-blur.jpg', 'crop=560:315:700:360,scale=960:-1');
  jpg(frame(23.1), 'pa-blur.jpg', 'crop=560:315:700:360,scale=960:-1');
  jpg(path.join(OUT, 'before-ending.png'), 'pb-end.jpg', 'scale=960:-1');
  jpg(frame(29.62), 'pa-end.jpg', 'scale=960:-1');
  jpg(path.join(OUT, 'ui-desk.png'), 'ui-desk.jpg', 'scale=1200:-1');
  jpg(path.join(OUT, 'ui-phone.png'), 'ui-phone.jpg', 'scale=390:-1');
  ff(['-i', path.join(OUT, 'soundtrack.wav'), '-lavfi', 'showspectrumpic=s=2400x600:legend=0:scale=log:fscale=log:color=intensity:stop=16000', path.join(OUT, 'spectrum-clean.png')]);
  jpg(path.join(OUT, 'spectrum-clean.png'), 'spectrum.jpg', 'scale=2400:600');
  // final contact sheet: 24 frames from the master
  const times = [0.95, 1.02, 2.6, 3.3, 4.2, 5.8, 6.8, 7.6, 8.8, 9.9, 10.8, 11.4, 12.6, 14.6, 15.5, 16.9, 17.8, 19.5, 20.1, 20.7, 21.85, 23.3, 25.8, 28.8];
  const tmp = path.join(OUT, 'final-sheet-src'); fs.mkdirSync(tmp, { recursive: true });
  times.forEach((t, i) => fs.copyFileSync(frame(t), path.join(tmp, `${String(i).padStart(3, '0')}.png`)));
  ff(['-i', path.join(tmp, '%03d.png'), '-vf', 'scale=480:-1,tile=4x6:padding=6:color=0x111116', '-frames:v', '1', path.join(OUT, 'final-sheet.png')]);
  jpg(path.join(OUT, 'final-sheet.png'), 'final-sheet.jpg', 'scale=1944:-1');
}

function energySvg() {
  const pts = JSON.parse(fs.readFileSync(path.join(OUT, 'loudness.json'), 'utf8'));
  const x0 = 46, x1 = 630, y0 = 34, y1 = 262, lo = -60, hi = -5;
  const X = t => x0 + (t / 30) * (x1 - x0), Y = v => y1 - ((Math.max(lo, v) - lo) / (hi - lo)) * (y1 - y0);
  let s = `<svg viewBox="0 0 640 290" style="width:100%; height:auto; display:block" font-family="Martian Mono, monospace">`;
  SCENES.slice(0, -1).forEach(([t, name], i) => {
    const e = SCENES[i + 1][0];
    s += `<rect x="${X(t)}" y="${y0}" width="${X(e) - X(t)}" height="${y1 - y0}" fill="${C.ink}" fill-opacity="${i % 2 ? 0.07 : 0.03}"/>`;
    s += `<text x="${X(t) + 3}" y="${y0 - (i % 2 ? 5 : 16)}" font-size="8" fill="${C.muted}">${name}</text>`;
  });
  for (const v of [-50, -40, -30, -20, -10]) {
    s += `<line x1="${x0}" x2="${x1}" y1="${Y(v)}" y2="${Y(v)}" stroke="${C.ink}" stroke-opacity=".1" stroke-width="1"/>`;
    s += `<text x="${x0 - 6}" y="${Y(v) + 3}" font-size="8" fill="${C.muted}" text-anchor="end">${String(v).replace('-', '−')}</text>`;
  }
  for (let t = 0; t <= 30; t += 5) s += `<text x="${X(t)}" y="${y1 + 14}" font-size="8" fill="${C.muted}" text-anchor="middle">${t} s</text>`;
  s += `<text x="${x0 - 6}" y="${y0 + 6}" font-size="8" fill="${C.muted}" text-anchor="end">LUFS</text>`;
  s += `<polyline fill="none" stroke="${C.ultra}" stroke-width="2" stroke-linejoin="round" points="${pts.map(([t, v]) => `${X(t).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')}"/>`;
  const at = t => pts.reduce((a, b) => (Math.abs(b[0] - t) < Math.abs(a[0] - t) ? b : a));
  for (const [t, label, dy] of [[12.1, 'slam', -10], [16.4, 'drop-out', 15], [20.1, 'slash', -10]]) {
    const [pt, v] = at(t);
    s += `<circle cx="${X(pt)}" cy="${Y(v)}" r="4" fill="${C.ultra}" stroke="#F6F4EF" stroke-width="2"/>`;
    s += `<text x="${X(pt)}" y="${Y(v) + dy}" font-size="8.5" fill="${C.ink}" text-anchor="middle">${label}</text>`;
  }
  return s + '</svg>';
}

function gridSvg(CUE) {
  const x0 = 6, x1 = 994, X = t => x0 + (t / 30) * (x1 - x0);
  let s = `<svg viewBox="0 0 1000 118" style="width:100%; height:auto; display:block" font-family="Martian Mono, monospace">`;
  SCENES.slice(0, -1).forEach(([t, name, ground], i) => {
    const e = SCENES[i + 1][0], fill = C[ground], txt = ground === 'chalk' ? C.ink : C.chalk;
    s += `<rect x="${X(t) + 0.5}" y="4" width="${X(e) - X(t) - 1}" height="40" fill="${fill}" ${ground === 'chalk' ? `stroke="${C.ink}" stroke-opacity=".25"` : ''} rx="2"/>`;
    s += `<text x="${X(t) + 5}" y="29" font-family="Unbounded, sans-serif" font-weight="900" font-size="${X(e) - X(t) < 70 ? 8 : 11}" fill="${txt}">${name}</text>`;
  });
  for (let b = 0; b <= 60; b++) {
    const bar = b % 4 === 0;
    s += `<line x1="${X(b / 2)}" x2="${X(b / 2)}" y1="52" y2="${bar ? 70 : 62}" stroke="${C.ink}" stroke-opacity="${bar ? 0.6 : 0.25}" stroke-width="1"/>`;
    if (bar && b < 60) s += `<text x="${X(b / 2) + 3}" y="69" font-size="7" fill="${C.muted}">${b / 4 + 1}</text>`;
  }
  const hits = cueHits(CUE);
  for (const h of hits) s += `<circle cx="${X(h)}" cy="86" r="3" fill="${C.flamingo}"/>`;
  const on = hits.filter(h => Math.abs(h * 8 - Math.round(h * 8)) < 1e-6).length;
  s += `<text x="${x0}" y="110" font-size="7.5" fill="${C.muted}">BARS 1–15 · ${hits.length} MAJOR CUES · ${on} ON THE 1/16 GRID (0.125 s) · BOUNCE FILLS SUBDIVIDE TO 1/32</text>`;
  return s + '</svg>';
}

function cueHits(CUE) {
  return [CUE.dotPop, ...CUE.bounces, CUE.split1, CUE.split2, CUE.burst, CUE.weLock, ...CUE.make, ...CUE.dotInA, CUE.hop, CUE.hopLand,
    CUE.motion, ...CUE.letterLand, CUE.slam, CUE.build, CUE.collapse, CUE.ping, ...CUE.tittle, CUE.portal, CUE.code, ...CUE.locks, CUE.slash, CUE.fall,
    CUE.straighten, ...CUE.final, ...CUE.finalBounces, CUE.reflow, CUE.asterisk, CUE.fadeOut, CUE.blink];
}

function spectroLabels() {
  const L = [[1.0, 'bounce fill'], [4.0, 'WE lock'], [6.5, 'MAKE clacks'], [10.0, 'impact'], [10.75, 'arpeggio'], [12.0, 'slam'], [14.0, 'snare roll'],
    [15.75, 'tape stop'], [16.5, 'glass ping'], [18.0, 'boom + glitch'], [20.0, 'slash'], [20.25, 'falling bloops'], [23.0, 'MOTION'],
    [24.5, 'fill callback'], [27.6, 'typewriter'], [29.75, 'blip']];
  return L.map(([t, s], i) => `<div style="position:absolute; left:${(t / 30) * 100}%; top:${i % 2 ? -6.5 : -12.5}mm; height:${i % 2 ? 6.5 : 12.5}mm; border-left:1px solid rgba(241,239,233,.45); padding-left:1.2mm; font:400 5.8pt/1 var(--mono); color:rgba(241,239,233,.85); white-space:nowrap">${s}</div>`).join('');
}

const OUT3 = path.join(ROOT, '..', 'we-make-motion-3d', 'render', 'out'), IMG3 = path.join(DOC, 'img3');
const frame3 = t => fromVideo(path.join(ROOT, '..', 'we-make-motion-3d', 'we-make-motion-3d-4k.mp4'), t + 0.5 / 60, '3d');
function images3() {
  fs.mkdirSync(IMG3, { recursive: true });
  for (const t of [4.4, 11.0, 13.2, 16.9, 23.2]) ff(['-i', frame3(t), '-vf', 'scale=1280:-1', '-q:v', '3', path.join(IMG3, `f-${t.toFixed(2)}.jpg`)]);
  const times = [0.95, 1.02, 2.6, 3.3, 4.3, 5.8, 6.8, 7.6, 8.8, 9.85, 10.8, 11.4, 12.6, 14.8, 15.5, 16.9, 17.8, 19.5, 20.3, 21.9, 23.3, 25.8, 26.5, 28.8];
  const tmp = path.join(OUT3, 'final-sheet-src'); fs.mkdirSync(tmp, { recursive: true });
  times.forEach((t, i) => fs.copyFileSync(frame3(t), path.join(tmp, `${String(i).padStart(3, '0')}.png`)));
  ff(['-i', path.join(tmp, '%03d.png'), '-vf', 'scale=480:-1,tile=4x6:padding=6:color=0x111116', '-frames:v', '1', path.join(OUT3, 'final-sheet-3d.png')]);
  ff(['-i', path.join(OUT3, 'final-sheet-3d.png'), '-vf', 'scale=1944:-1', '-q:v', '3', path.join(IMG3, 'final-sheet-3d.jpg')]);
}

(async () => {
  images();
  images3();
  const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const lines = index.split('\n').length;
  const log = fs.readFileSync(path.join(OUT, 'render.log'), 'utf8');
  const secs = +((log.match(/1800\/1800 frames · (\d+) s/) || [])[1] || 0);
  const mp4 = fs.statSync(path.join(ROOT, 'we-make-motion.mp4')).size / 1e6;

  // stats straight from the film: particle count and number of scheduled sound sources
  const browser = await chromium.launch();
  const fdir = path.join(ROOT, 'render/fonts');
  const css = fs.readFileSync(path.join(fdir, 'local.css'), 'utf8').replace(/url\(([^)]+\.woff2)\)/g, (_, f) => `url(data:font/woff2;base64,${fs.readFileSync(path.join(fdir, f)).toString('base64')})`);
  const harness = `<!doctype html><html><head><meta charset="utf-8"><script>window.MWC_HEADLESS=true</script><style>${css}</style></head><body>${index.replace(/<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>\n?/g, '')}</body></html>`;
  const hp = await browser.newPage();
  await hp.setContent(harness, { waitUntil: 'load' });
  const stats = await hp.evaluate(async () => {
    await MWC.prepare();
    let n = 0; const P = BaseAudioContext.prototype;
    for (const k of ['createOscillator', 'createBufferSource']) { const f = P[k]; P[k] = function () { n++; return f.apply(this, arguments); }; }
    await MWC.renderSoundtrack();
    return { particles: MWC.stats().particles, voices: n };
  });
  const CUE = eval('(' + fs.readFileSync(path.join(ROOT, 'src/core.js'), 'utf8').match(/const CUE = (\{[\s\S]*?\n\});/)[1] + ')');

  const r128 = (() => {
    const r = require('child_process').spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', path.join(OUT, 'soundtrack.wav'), '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
    const sum = r.stderr.slice(r.stderr.lastIndexOf('Summary'));
    const g = re => (sum.match(re) || [])[1];
    return { I: g(/I:\s+(-?[\d.]+) LUFS/), LRA: g(/LRA:\s+([\d.]+) LU/), P: g(/Peak:\s+(-?[\d.]+) dBFS/) };
  })();
  const hits = cueHits(CUE), onGrid = hits.filter(h => Math.abs(h * 8 - Math.round(h * 8)) < 1e-6).length;
  const minus = v => String(v).replace('-', '−');
  // render times and sizes come from the 4K renderer's own logs and the delivered files
  const minsIn = f => { try { return (fs.readFileSync(f, 'utf8').match(/film → .* in ([\d.]+) min/) || [])[1] || '?'; } catch { return '?'; } };
  const mb = f => (fs.existsSync(f) ? (fs.statSync(f).size / 1e6).toFixed(1) : '?');
  const E3 = path.join(ROOT, '..', 'we-make-motion-3d');
  const tokens = {
    SUB3: '5,400', RENDER3MIN: String(Math.round(+minsIn(path.join(E3, 'render', 'out-4k.log')) || 0)),
    RENDER4KMIN: String(Math.round(+minsIn(path.join(ROOT, 'render', 'out-4k-full.log')) || 0)),
    MP44KMB: mb(path.join(ROOT, 'we-make-motion-4k.mp4')), MP43DMB: mb(path.join(E3, 'we-make-motion-3d.mp4')), MP43D4KMB: mb(path.join(E3, 'we-make-motion-3d-4k.mp4')),
    LUFS: minus(r128.I), PEAK: minus(r128.P), LRA: r128.LRA, CUES: String(hits.length), ONGRID: String(onGrid),
    FRAMES: '1,800', SUBFRAMES: '43,200', LINES: fmt(lines), MP4MB: mp4.toFixed(1), RENDERMIN: (secs / 60).toFixed(0),
    PARTICLES: fmt(stats.particles), VOICES: fmt(stats.voices),
    ENERGY_SVG: energySvg(), GRID_SVG: gridSvg(CUE), SPECTRO_LABELS: spectroLabels(),
  };
  let html = ['p1.html', 'p2.html', 'p3.html', 'p4.html', 'p5.html'].map(f => fs.readFileSync(path.join(DOC, f), 'utf8')).join('\n');
  html = html.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in tokens ? tokens[k] : m));
  // number the folios from page order, so pages can be inserted freely
  let pageNo = 0;
  html = html.replace(/<section class="page[^"]*"[\s\S]*?<\/section>/g, sec => { pageNo++; return sec.replace(/<div class="folio">\d+<\/div>/, `<div class="folio">${String(pageNo).padStart(2, '0')}</div>`); });
  const left = html.match(/\{\{\w+\}\}/g);
  if (left) throw new Error('unfilled tokens: ' + left.join(', '));
  const combined = path.join(DOC, 'process.html');
  fs.writeFileSync(combined, html);

  const page = await browser.newPage({ viewport: { width: 1123, height: 794 } });
  await page.goto('file://' + combined, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const pdf = path.join(ROOT, 'We-Make-Motion-Process.pdf');
  await page.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true });
  await browser.close();
  console.log(`pdf → ${pdf} (${(fs.statSync(pdf).size / 1e6).toFixed(1)} MB)`, tokens.LINES, 'lines,', tokens.PARTICLES, 'particles,', tokens.VOICES, 'voices');
})().catch(e => { console.error(e); process.exit(1); });
