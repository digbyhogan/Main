// ═══ F · CODE (18 – 22s) ═════════════════════════════════════════
const CODE_SRC = [
  '// we-make-motion / film.js  ·  30 s  ·  120 BPM',
  'const BPM = 120, BEAT = 60 / BPM;',
  'const ease = t => 1 - Math.pow(1 - t, 4);',
  '',
  'function spring(dt, zeta = 0.4, freq = 2.2) {',
  '  const w = 2 * Math.PI * freq;',
  '  const wd = w * Math.sqrt(1 - zeta * zeta);',
  '  return 1 - Math.exp(-zeta * w * dt) *',
  '    (Math.cos(wd * dt) + (zeta * w / wd) * Math.sin(wd * dt));',
  '}',
  '',
  'function kick(ctx, t, gain = 1) {',
  '  const osc = ctx.createOscillator();',
  '  osc.frequency.setValueAtTime(220, t);',
  '  osc.frequency.exponentialRampToValueAtTime(48, t + 0.08);',
  '  return osc.connect(ctx.destination);',
  '}',
  '',
  'const squash = v => 1 + Math.min(0.45, Math.abs(v) / 5200);',
  'for (const p of particles) p.x = lerp(p.x, p.tx, e);',
  "g.fillText('without', CX, CY);  // allegedly",
  'if (t >= CUE.slash) letters.forEach(fall);',
  '',
];
const CD = {};
onPrep(() => {
  CD.font = F.mono(240, 700);
  CD.adv = textW(CD.font, 'M');
  CD.cap = glyphs(CD.font, 'CODE').asc;
  CD.x = CX - (CD.adv * 7) / 2;
  CD.y = CY + CD.cap / 2;
  CD.srcFont = F.mono(20);
  const cw = textW(CD.srcFont, 'M');
  const kw = /^(const|function|return|for|of|if|new)$/;
  CD.lines = CODE_SRC.map(s => {
    const toks = [];
    let col = 0;
    for (const m of s.matchAll(/\/\/.*|'[^']*'|\d+(?:\.\d+)?|[A-Za-z_$][\w$]*|\s+|./g)) {
      const v = m[0];
      const c = v.startsWith('//') ? 'rgba(241,239,233,0.5)' : v[0] === "'" ? COL.butter
        : /^\d/.test(v) ? COL.flamingo : kw.test(v) ? '#8C8CFF' : COL.chalk;
      if (v.trim()) toks.push({ v, x: col * cw, c, col });
      col += v.length;
    }
    return toks;
  });
});
const SCRAMBLE = '{}[]<>/=;:*+#01$%&!?';
const scr = (t, i) => SCRAMBLE[Math.floor(rnd(Math.floor(t * 30), i + 50) * SCRAMBLE.length)];

function codeBackground(g, t) {
  g.font = CD.srcFont; g.textAlign = 'left';
  const scroll = 38 * (t - CUE.code), first = Math.floor(scroll / 36);
  for (let j = first; j < first + 32; j++) {
    const row = j - first, y = 110 + j * 36 - scroll;
    const vis = Math.floor((t - CUE.code - row * 0.02) * 170);
    if (vis <= 0) continue;
    let dy = 0, a = 1;
    const fs = CUE.fall + 0.05 + rnd(j, 41) * 0.55;
    if (t > fs) { dy = 0.5 * 4200 * (t - fs) ** 2; a = 1 - seg(t, fs + 0.25, fs + 0.6); }
    if (a <= 0) continue;
    g.globalAlpha = 0.3 * a;
    const src = CD.lines[((j % CD.lines.length) + CD.lines.length) % CD.lines.length];
    g.fillStyle = COL.chalk; g.textAlign = 'right';
    g.fillText(String((j % CODE_SRC.length) + 1).padStart(2, '0'), 120, y + dy);
    g.textAlign = 'left';
    for (const tk of src) {
      if (tk.col >= vis) break;
      g.fillStyle = tk.c;
      g.fillText(tk.v.slice(0, vis - tk.col), 150 + tk.x, y + dy);
    }
  }
  g.globalAlpha = 1;
}

function codeSlot(i, t) {
  // returns glyph, colour, and fall transform for slot i of "<CODE/>"
  const isBr = i === 0 || i >= 5;
  let ch = '<CODE/>'[i], ox = 0, pop = 1;
  if (isBr) {
    const sp = spring(t - 18.2 - (i === 0 ? 0 : 0.05), 0.45, 2.2);
    ox = (i === 0 ? -1 : 1) * 420 * (1 - sp);
    if (t < 18.2) return null;
  } else {
    const st = 18.4 + (i - 1) * 0.05;
    if (t < st) return null;
    pop = Ez.outBack(seg(t, st, st + 0.2), 3);
    if (t < CUE.locks[i - 1]) ch = scr(t, i);
  }
  const fs = CUE.fall + i * 0.06, d = Math.max(0, t - fs);
  const fall = t > fs ? { y: (-650 - 300 * rnd(i, 61)) * d + 0.5 * 5200 * d * d, x: (rnd(i, 62) - 0.5) * 260 * d, r: (rnd(i, 63) - 0.5) * 7 * d } : { x: 0, y: 0, r: 0 };
  return { ch, ox: ox + fall.x, oy: fall.y, rot: fall.r, pop, col: isBr ? COL.butter : COL.chalk };
}

function sceneCode(g, t) {
  bg(g, COL.ink);
  codeBackground(g, t);
  g.font = CD.font; g.textAlign = 'center';
  for (let i = 0; i < 7; i++) {
    const s = codeSlot(i, t);
    if (!s) continue;
    const cx = CD.x + CD.adv * (i + 0.5), cy = CD.y - CD.cap / 2;
    g.save();
    g.translate(cx + s.ox, cy + s.oy); g.rotate(s.rot); g.scale(s.pop, s.pop);
    let col = s.col;
    if (i >= 1 && i <= 4) {
      const L = CUE.locks[i - 1], hl = t >= L ? 1 - seg(t, L + 0.08, L + 0.4) : 0;
      if (hl > 0 && t < CUE.fall) {
        g.globalAlpha = hl; g.fillStyle = COL.butter;
        g.fillRect(-CD.adv / 2, -CD.cap / 2 - 22, CD.adv, CD.cap + 44); g.globalAlpha = 1;
        col = mixHex(COL.chalk, COL.ink, hl);
      }
      if (t < L) col = 'rgba(241,239,233,0.55)';
    }
    g.fillStyle = col; g.fillText(s.ch, 0, CD.cap / 2);
    g.restore();
  }
  // caret, blinking on the beat
  if (t > 18.4 && t < CUE.slash && (t % BEAT) < BEAT / 2) {
    g.fillStyle = COL.butter; g.fillRect(CD.x + CD.adv * 7 + 14, CD.y - CD.cap - 10, CD.adv * 0.42, CD.cap + 20);
  }
  // the strike-through
  const sp = Ez.outExpo(seg(t, CUE.slash, 20.14));
  if (sp > 0) {
    const x0 = CD.x - 50, x1 = CD.x + CD.adv * 7 + 50, mx = (x0 + x1) / 2;
    const st = Ez.outBack(seg(t, CUE.straighten, 21.72), 1.4);
    const rot = lerp(-0.05 + 0.025 * wobble(t - 20.14, 2.5, 1.4), 0, st);
    const y = lerp(CD.y - CD.cap * 0.45, CY, st);
    const thick = lerp(30, 1400, Ez.inOutExpo(seg(t, CUE.wipe2, 21.9)));
    g.save(); g.translate(mx, y); g.rotate(rot);
    g.fillStyle = COL.flamingo;
    const full = x1 - x0, grow = Ez.inOutExpo(seg(t, CUE.wipe2, 21.9));
    if (grow <= 0) g.fillRect(-full / 2, -thick / 2, full * sp, thick);
    else { const half = lerp(full / 2, W * 1.3, grow); g.fillRect(-half, -thick / 2, half * 2, thick); }
    g.restore();
    const u = Ez.inOutExpo(seg(t, CUE.wipe2 + 0.1, CUE.final[0])) * 1400;
    if (u > 0) { g.fillStyle = COL.ultra; g.fillRect(-200, CY - u / 2, W + 400, u); }
  }
}

// ═══ G · THE CLAIM (22 – 26s)  &  H · THE FINE PRINT (26 – 30s) ═══
const FN = {};
const FOOTNOTE = '*Except this one. This one is __LINES__ lines of code.';
onPrep(() => {
  const L1 = F.disp(150), mw = textW(F.disp(100), 'MOTION');
  const ms = Math.min(310, (1620 / mw) * 100);
  const words = [
    { str: 'WE', font: L1, size: 150, x: 150, y: 300, to: F.disp(76), ts: 76 },
    { str: 'MAKE', font: L1, size: 150, x: 150 + textW(L1, 'WE '), y: 300, ts: 76 },
    { str: 'MOTION', font: F.disp(ms), size: ms, x: 150, y: 620, ts: 76 },
    { str: 'without', font: F.serif(180), size: 180, x: 150, y: 870, ts: 92 },
    { str: 'CODE', font: F.mono(150, 700), size: 150, x: 0, y: 870, ts: 70 },
  ];
  words[4].x = 150 + textW(words[3].font, 'without') + 44;
  for (const w of words) { w.lay = glyphs(w.font, w.str); w.s = w.ts / w.size; }
  FN.words = words;
  FN.dot = { x: words[4].x + words[4].lay.width + 34, y: 870 - 20, r: 20 };
  // single-line sentence layout
  const gap = 26, dotR = 9;
  let total = words.reduce((a, w) => a + w.lay.width * w.s, 0) + gap * 4 + 12 + dotR * 2;
  let x = CX - total / 2;
  for (const w of words) { w.tx = x; w.ty = 560; x += w.lay.width * w.s + gap; }
  FN.dotTo = { x: x - gap + 12 + dotR, y: 560 - dotR, r: dotR };
  FN.note = FOOTNOTE;
  FN.noteFont = F.mono(24);
  FN.noteW = textW(FN.noteFont, FN.note);
});

function finDot(t) {
  const b = CUE.finalBounces, rest = FN.dot.y;
  if (t < 24.0) return null;
  let y = rest, v = 0, sq = 0;
  if (t < b[0]) ({ y, v } = ballistic(t, 24.0, -40, b[0], rest, GRAV));
  else for (let i = 0; i < b.length - 1; i++) if (t >= b[i] && t < b[i + 1]) ({ y, v } = ballistic(t, b[i], rest, b[i + 1], rest, GRAV));
  const vHit = [2000, 1600, 800, 400, 200];
  b.forEach((bt, i) => { if (t >= bt) sq += Math.min(0.5, vHit[i] / 4200) * Math.exp(-(t - bt) * 20) * Math.cos((t - bt) * TAU * 6); });
  const st = 1 + Math.min(0.45, Math.abs(v) / 5200), sy = Math.max(0.4, st * (1 - sq));
  return { x: FN.dot.x, y: y + FN.dot.r * (1 - sy), r: FN.dot.r, sx: 1 / sy, sy };
}

function drawWordIn(g, w, i, t) {
  const L = w.lay, t0 = CUE.final[i];
  g.font = w.font; g.textAlign = 'left'; g.fillStyle = COL.chalk;
  if (i <= 1) { // mask up, letter by letter
    g.save(); g.beginPath(); g.rect(w.x - 20, w.y - L.asc - 40, L.width + 60, L.asc + 52); g.clip();
    L.list.forEach((gl, k) => {
      const e = Ez.outExpo(seg(t, t0 + k * 0.035, t0 + k * 0.035 + 0.55));
      g.fillText(gl.ch, w.x + gl.x, w.y + (1 - e) * (L.asc + 40));
    });
    g.restore();
  } else if (i === 2) { // slides in hot, stretched and sheared by its own speed
    L.list.forEach((gl, k) => {
      const e = Ez.outExpo(seg(t, t0 + k * 0.03, t0 + k * 0.03 + 0.7));
      if (e <= 0) return;
      g.save(); g.translate(w.x + gl.x + (1 - e) * (1700 + k * 120), w.y);
      g.transform(1 + 0.8 * (1 - e), 0, -0.3 * (1 - e), 1, 0, 0);
      g.fillText(gl.ch, 0, 0); g.restore();
    });
  } else if (i === 3) { // whispered in
    L.list.forEach((gl, k) => {
      const st = t0 + k * 0.04, a = Ez.outSine(seg(t, st, st + 0.45));
      if (a <= 0) return;
      g.save(); g.globalAlpha = a;
      if (a < 0.97) g.filter = `blur(${(10 * (1 - a) * RS).toFixed(1)}px)`;
      g.fillText(gl.ch, w.x + gl.x, w.y + 16 * (1 - a)); g.restore();
    });
  } else { // decoded
    L.list.forEach((gl, k) => {
      const lock = t0 + k * 0.0625;
      if (t < t0 - 0.12 + k * 0.02) return;
      const hl = t >= lock ? 1 - seg(t, lock + 0.05, lock + 0.35) : 0;
      if (hl > 0) { g.globalAlpha = hl; g.fillStyle = COL.butter; g.fillRect(w.x + gl.x, w.y - L.asc - 14, gl.w, L.asc + 28); g.globalAlpha = 1; }
      g.fillStyle = t < lock ? 'rgba(241,239,233,0.55)' : mixHex(COL.chalk, COL.ink, hl);
      g.fillText(t < lock ? scr(t, k + 20) : gl.ch, w.x + gl.x, w.y);
    });
  }
}

function sceneFinale(g, t) {
  bg(g, COL.ultra);
  liquidWipe(g, seg(t, CUE.curtain, CUE.curtain + 0.65), COL.ink, -1);
  const out = 1 - seg(t, CUE.fadeOut + 0.25, CUE.fadeOut + 0.6);

  if (t < CUE.reflow) {
    FN.words.forEach((w, i) => drawWordIn(g, w, i, t));
    const d = finDot(t);
    if (d) blob(g, d.x, d.y, d.r, d.sx, d.sy, COL.flamingo);
  } else {
    g.globalAlpha = out;
    FN.words.forEach((w, i) => {
      const p = Ez.inOutBack(seg(t, CUE.reflow + i * 0.05, CUE.reflow + i * 0.05 + 0.7), 1.2);
      const arc = Math.sin(Math.PI * clamp(p)) * 70 * (i % 2 ? 1 : -1);
      const s = lerp(1, w.s, p);
      g.save(); g.translate(lerp(w.x, w.tx, p), lerp(w.y, w.ty, p) + arc); g.scale(s, s);
      g.font = w.font; g.textAlign = 'left'; g.fillStyle = COL.chalk; g.fillText(w.str, 0, 0);
      g.restore();
    });
    g.globalAlpha = 1;
    // the full stop that becomes an asterisk
    const p = Ez.inOutBack(seg(t, 26.25, 26.95), 1.2);
    const up = -30 * Ez.outBack(seg(t, CUE.asterisk, 27.5), 2);
    let x = lerp(FN.dot.x, FN.dotTo.x, p), y = lerp(FN.dot.y, FN.dotTo.y, p) + up, r = lerp(FN.dot.r, FN.dotTo.r, p);
    // bookend: it drifts home to centre and becomes the opening dot again
    const home = Ez.inOutCubic(seg(t, CUE.fadeOut + 0.2, CUE.fadeOut + 0.65));
    x = lerp(x, CX, home); y = lerp(y, CY, home); r = lerp(r, DOT_R, home);
    const retract = 1 - Ez.inBack(seg(t, CUE.fadeOut + 0.45, CUE.fadeOut + 0.65));
    const popOut = Ez.inBack(seg(t, 29.7, 29.85), 2.5);
    if (popOut < 1) {
      const spin = 0.4 * Ez.outCubic(seg(t, CUE.asterisk, 28.4)) + 0.25 * (t - CUE.asterisk) * (t > CUE.asterisk);
      g.strokeStyle = COL.flamingo; g.lineCap = 'round'; g.lineWidth = r * 1.05;
      for (let k = 0; k < 6; k++) {
        const L = 2.6 * r * spring(t - CUE.asterisk - k * 0.025, 0.4, 3) * retract;
        if (L <= 0.5) continue;
        const a = -Math.PI / 2 + (k * Math.PI) / 3 + spin;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
      }
      disc(g, x, y, r * (1 - popOut) * lerp(1, 0.62, seg(t, CUE.asterisk, 27.4) * retract), COL.flamingo);
    }
    // the fine print
    const typed = typeSlice(FN.note, t, CUE.typeStart, 48);
    if (typed.length) {
      const nx = CX - FN.noteW / 2, ny = 700;
      g.globalAlpha = 1 - seg(t, CUE.fadeOut + 0.35, CUE.fadeOut + 0.7);
      g.font = FN.noteFont; g.textAlign = 'left';
      g.fillStyle = COL.flamingo; g.fillText('*', nx, ny);
      g.fillStyle = 'rgba(241,239,233,0.82)'; g.fillText(typed.slice(1), nx + textW(FN.noteFont, '*'), ny);
      if (t < CUE.fadeOut && (t % BEAT) < BEAT / 2) {
        g.fillStyle = COL.flamingo; g.fillRect(nx + textW(FN.noteFont, typed) + 6, ny - 22, 12, 28);
      }
      g.globalAlpha = 1;
    }
  }
}

// ═══ HUD · the slate that frames the piece ═══════════════════════
const HUD = [
  [2.2, 5.6, COL.chalk, '01 — WE'],
  [6.2, 9.5, COL.ink, '02 — MAKE'],
  [10.2, 12.0, COL.chalk, '03 — MOTION'],
  [16.45, 17.3, COL.ink, '04 — WITHOUT'],
  [18.3, 21.6, COL.chalk, '05 — CODE'],
  [22.2, 26.0, COL.chalk, '06 — ALL TOGETHER NOW'],
];
function timecode(t) {
  const f = Math.floor(t * FPS + 1e-6), s = Math.floor(f / FPS), fr = f % FPS;
  return `00:00:${String(s).padStart(2, '0')}:${String(fr).padStart(2, '0')}`;
}
function hud(g, t) {
  for (const [s, e, col, label] of HUD) {
    const a = seg(t, s, s + 0.25) * (1 - seg(t, e - 0.2, e));
    if (a <= 0) continue;
    g.globalAlpha = a * 0.62; g.fillStyle = col; g.strokeStyle = col; g.font = F.mono(14); g.textBaseline = 'alphabetic';
    g.textAlign = 'left'; g.fillText(typeSlice(label, t, s, 40), 56, 72);
    g.fillText(timecode(t), 56, H - 56);
    g.textAlign = 'right'; g.fillText(typeSlice('120 BPM · 4/4 · 1920×1080', t, s + 0.1, 60), W - 56, 72);
    const bar = Math.floor(t / BAR) + 1, beat = Math.floor((t % BAR) / BEAT);
    g.fillText(`BAR ${String(bar).padStart(2, '0')}`, W - 56 - 4 * 18 - 10, H - 56);
    g.lineWidth = 1.5;
    for (let k = 0; k < 4; k++) {
      const x = W - 56 - (4 - k) * 18 + 6;
      if (k === beat) g.fillRect(x, H - 67, 11, 11); else g.strokeRect(x + 0.75, H - 66.25, 9.5, 9.5);
    }
  }
  g.globalAlpha = 1;
}

// ═══ Compositor ══════════════════════════════════════════════════
const GLITCH = [[CUE.code, 0.22, 1], [CUE.slash, 0.14, 0.8], [CUE.slash + 0.55, 0.3, 0.5], [CUE.final[4], 0.1, 0.35]];
function glitchAmt(t) {
  let a = 0;
  for (const [s, d, k] of GLITCH) if (t >= s && t < s + d) a = Math.max(a, k * (1 - (t - s) / d));
  return a;
}
let scratch = null;
function glitch(canvas, g, t, amt) {
  if (amt <= 0) return;
  const w = canvas.width, h = canvas.height;
  if (!scratch) scratch = document.createElement('canvas');
  if (scratch.width !== w || scratch.height !== h) { scratch.width = w; scratch.height = h; }
  const sg = scratch.getContext('2d');
  sg.setTransform(1, 0, 0, 1, 0, 0); sg.clearRect(0, 0, w, h); sg.drawImage(canvas, 0, 0);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  const seed = Math.floor(t * 30);
  for (let i = 0; i < 14; i++) {
    const y = rnd(seed, i * 3) * h, hh = (0.005 + 0.05 * rnd(seed, i * 3 + 1)) * h;
    const dx = (rnd(seed, i * 3 + 2) - 0.5) * amt * 0.16 * w;
    g.drawImage(scratch, 0, y, w, hh, dx, y, w, hh);
  }
  const cols = [COL.flamingo, COL.butter, COL.ultraHi];
  for (let i = 0; i < 4; i++) {
    g.globalAlpha = 0.85 * amt; g.fillStyle = cols[i % 3];
    g.fillRect(rnd(seed, 90 + i) * w * 0.7, rnd(seed, 95 + i) * h, (0.05 + 0.3 * rnd(seed, 99 + i)) * w, (0.002 + 0.008 * rnd(seed, 80 + i)) * h);
  }
  g.restore();
}

function drawScene(g, t) {
  const c = camera(t);
  g.save();
  g.translate(CX + c.x, CY + c.y); g.rotate(c.r); g.scale(c.z, c.z); g.translate(-CX, -CY);
  if (t < 2) sceneDrop(g, t);
  else if (t < 6) sceneWe(g, t);
  else if (t < 10) sceneMake(g, t);
  else if (t < 16) sceneMotion(g, t);
  else if (t < 18) sceneWithout(g, t);
  else if (t < 22) sceneCode(g, t);
  else sceneFinale(g, t);
  g.restore();
}

let grainTiles = null, vignette = null;
function post(canvas, g) {
  const s = canvas.width / W;
  g.setTransform(s, 0, 0, s, 0, 0);
  if (!vignette) {
    vignette = g.createRadialGradient(CX, CY, W * 0.32, CX, CY, W * 0.78);
    vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,0.2)');
  }
  g.fillStyle = vignette; g.fillRect(0, 0, W, H);
  if (RO.grain) {
    if (!grainTiles) {
      grainTiles = [0, 1, 2].map(k => {
        const c = document.createElement('canvas'); c.width = c.height = 256;
        const x = c.getContext('2d'), im = x.createImageData(256, 256), r = mulberry32(99 + k);
        for (let i = 0; i < im.data.length; i += 4) { const v = r() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
        x.putImageData(im, 0, 0); return g.createPattern(c, 'repeat');
      });
    }
    const k = Math.floor(performance.now() / 42) % 3;
    g.save(); g.setTransform(1, 0, 0, 1, (k * 97) % 256, (k * 53) % 256);
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.07;
    g.fillStyle = grainTiles[k]; g.fillRect(-256, -256, canvas.width + 512, canvas.height + 512);
    g.restore();
  }
}

function renderFrame(canvas, t, withPost = true) {
  const g = canvas.getContext('2d');
  const s = canvas.width / W;
  RS = s;
  g.setTransform(s, 0, 0, s, 0, 0);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
  t = clamp(t, 0, DUR - 1e-4);
  drawScene(g, t);
  glitch(canvas, g, t, glitchAmt(t));
  g.setTransform(s, 0, 0, s, 0, 0);
  hud(g, t);
  if (withPost) post(canvas, g);
}

// Offline: true motion blur by averaging sub-frames across a 180° shutter.
// Sub-frames are summed in float so 16–32 samples don't band.
let accTmp = null, accBuf = null;
function renderAccum(canvas, t, samples = 16, shutter = 0.5) {
  const w = canvas.width, h = canvas.height, g = canvas.getContext('2d');
  if (!accTmp) accTmp = document.createElement('canvas');
  if (accTmp.width !== w || accTmp.height !== h) { accTmp.width = w; accTmp.height = h; }
  const tg = accTmp.getContext('2d', { willReadFrequently: true });
  if (!accBuf || accBuf.length !== w * h * 4) accBuf = new Float32Array(w * h * 4);
  accBuf.fill(0);
  for (let k = 0; k < samples; k++) {
    const tk = t + ((k + 0.5) / samples - 0.5) * (shutter / FPS);
    renderFrame(accTmp, tk, false);
    const d = tg.getImageData(0, 0, w, h).data;
    for (let i = 0; i < d.length; i++) accBuf[i] += d[i];
  }
  const outImg = g.createImageData(w, h), o = outImg.data, inv = 1 / samples;
  for (let i = 0; i < o.length; i++) o[i] = accBuf[i] * inv + 0.5;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.putImageData(outImg, 0, 0);
  post(canvas, g);
}
