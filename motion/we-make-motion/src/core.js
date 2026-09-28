// ─── Frame & tempo ────────────────────────────────────────────────
const W = 1920, H = 1080, CX = W / 2, CY = H / 2;
const BPM = 120, BEAT = 60 / BPM, BAR = BEAT * 4, DUR = 30, FPS = 60;

const COL = {
  ink: '#111116',
  chalk: '#F1EFE9',
  ultra: '#2D2DF5',
  ultraHi: '#5656FF',
  flamingo: '#FF5A87',
  butter: '#FFD34E',
};

const F = {
  disp: s => `900 ${s}px Unbounded, "Arial Black", sans-serif`,
  serif: s => `italic 400 ${s}px "Bodoni Moda", Didot, Georgia, serif`,
  mono: (s, w = 400) => `${w} ${s}px "Martian Mono", "DejaVu Sans Mono", monospace`,
};

// Render options: realtime playback fakes motion blur with streaks,
// the offline renderer switches them off and accumulates sub-frames instead.
const RO = { streaks: true, grain: true, shake: 1 };
// Render scale (canvas px per design px). Pixel-based filters multiply by it so blur looks the same at any resolution.
let RS = 1;

// ─── Maths ────────────────────────────────────────────────────────
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const TAU = Math.PI * 2;

const Ez = {
  lin: t => t,
  inQuad: t => t * t,
  outQuad: t => 1 - (1 - t) ** 2,
  inOutQuad: t => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  inCubic: t => t ** 3,
  outCubic: t => 1 - (1 - t) ** 3,
  inOutCubic: t => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  inQuart: t => t ** 4,
  outQuart: t => 1 - (1 - t) ** 4,
  inOutQuart: t => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2),
  outQuint: t => 1 - (1 - t) ** 5,
  inOutQuint: t => (t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2),
  inExpo: t => (t <= 0 ? 0 : 2 ** (10 * t - 10)),
  outExpo: t => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
  inOutExpo: t => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2),
  inSine: t => 1 - Math.cos((t * Math.PI) / 2),
  outSine: t => Math.sin((t * Math.PI) / 2),
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t, s = 1.70158) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2,
  inBack: (t, s = 1.70158) => (s + 1) * t ** 3 - s * t * t,
  inOutBack: (t, s = 1.70158) => {
    const c = s * 1.525;
    return t < 0.5
      ? ((2 * t) ** 2 * ((c + 1) * 2 * t - c)) / 2
      : ((2 * t - 2) ** 2 * ((c + 1) * (t * 2 - 2) + c) + 2) / 2;
  },
};

// Closed-form damped spring (0 → 1). Being analytic, it can be sampled at any t.
function spring(dt, zeta = 0.4, freq = 2.2) {
  if (dt <= 0) return 0;
  const w = TAU * freq, wd = w * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w * dt) * (Math.cos(wd * dt) + ((zeta * w) / wd) * Math.sin(wd * dt));
}
// Decaying wobble, for follow-through after a hit.
const wobble = (dt, k = 6, f = 3) => (dt <= 0 ? 0 : Math.exp(-k * dt) * Math.sin(TAU * f * dt));
const pulse = (t, t0, k = 10) => (t < t0 ? 0 : Math.exp(-(t - t0) * k));

// Projectile between two keyed points under gravity g (px/s², +y is down).
function ballistic(t, t0, y0, t1, y1, g) {
  const T = t1 - t0, v0 = (y1 - y0) / T - 0.5 * g * T, d = t - t0;
  return { y: y0 + v0 * d + 0.5 * g * d * d, v: v0 + g * d };
}

// Deterministic hash noise, so every frame is a pure function of time.
function hash(n) {
  n |= 0;
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}
const rnd = (i, s = 0) => hash(i * 374761393 + s * 668265263 + 1013904223);
function noise1(x, s = 0) {
  const i = Math.floor(x), fr = x - i, u = fr * fr * (3 - 2 * fr);
  return lerp(rnd(i, s), rnd(i + 1, s), u) * 2 - 1;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp(pa >> 16, pb >> 16, t));
  const g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
  const bl = Math.round(lerp(pa & 255, pb & 255, t));
  return `rgb(${r},${g},${bl})`;
}

// ─── The cue sheet: one source of truth for picture AND sound ─────
const CUE = {
  dotPop: 0.15, launch: 0.45,
  bounces: [1.0, 1.5, 1.75, 1.875, 1.9375],
  split1: 2.25, split2: 2.5, burst: 2.75, weLock: 4.0,
  weSquash: 5.5, weLaunch: 5.625,
  grid: 6.0, make: [6.5, 7.0, 7.5, 8.0], dotInA: [7.25, 7.375, 7.4375],
  hop: 8.5, hopLand: 9.0, lineOut: 9.25, retract: 9.5, iris: 9.7,
  motion: 10.0, letterLand: [10.75, 10.875, 11.0, 11.125, 11.25, 11.375],
  slam: 12.0, build: 14.0, collapse: 15.75,
  without: 16.0, ping: 16.5, tittle: [17.0, 17.125, 17.1875], portal: 17.35,
  code: 18.0, locks: [19.0, 19.25, 19.5, 19.75], slash: 20.0, fall: 20.25,
  straighten: 21.5, wipe2: 21.7,
  final: [22.0, 22.5, 23.0, 23.5, 24.0], finalBounces: [24.5, 25.0, 25.25, 25.375, 25.4375],
  reflow: 26.0, asterisk: 27.25, typeStart: 27.6, fadeOut: 29.0, blink: 29.75,
};

// Camera impacts: [time, strength]. Drives shake and zoom punches.
const IMPACTS = [
  [1.0, 0.55], [1.5, 0.3], [4.0, 0.7], [6.5, 0.25], [7.0, 0.25], [7.5, 0.25], [8.0, 0.35],
  [10.0, 0.6], [12.0, 1.0], [14.0, 0.3], [14.5, 0.35], [15.0, 0.4], [15.5, 0.5],
  [18.0, 0.9], [20.0, 1.0], [22.0, 0.4], [22.5, 0.4], [23.0, 0.8], [24.0, 0.5], [24.5, 0.45],
  [27.25, 0.25],
];
function camera(t) {
  let e = 0, z = 0;
  for (const [ti, s] of IMPACTS) {
    if (t < ti || t > ti + 1.2) continue;
    e += s * Math.exp(-(t - ti) * 9);
    z += s * Math.exp(-(t - ti) * 12);
  }
  return {
    x: noise1(t * 38, 1) * 16 * e * RO.shake,
    y: noise1(t * 38, 2) * 16 * e * RO.shake,
    r: noise1(t * 30, 3) * 0.012 * e * RO.shake,
    z: 1 + z * 0.028,
  };
}

// ─── Text & glyph utilities ───────────────────────────────────────
const MC = document.createElement('canvas').getContext('2d');
function glyphs(font, str) {
  MC.font = font;
  const list = [];
  for (let i = 0; i < str.length; i++) {
    list.push({ ch: str[i], x: MC.measureText(str.slice(0, i)).width, w: MC.measureText(str[i]).width });
  }
  const m = MC.measureText(str);
  return { font, str, list, width: m.width, asc: m.actualBoundingBoxAscent, desc: m.actualBoundingBoxDescent };
}
function textW(font, s) { MC.font = font; return MC.measureText(s).width; }

// Rasterise one glyph to a 1-bit map so we can find things inside it
// (the tittle of an i, the thickest point of an o).
function inkMap(font, ch, pad = 30) {
  MC.font = font;
  const m = MC.measureText(ch);
  const w = Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight) + pad * 2;
  const h = Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) + pad * 2;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.font = font; x.fillStyle = '#000';
  const ox = pad + m.actualBoundingBoxLeft, oy = pad + m.actualBoundingBoxAscent;
  x.fillText(ch, ox, oy);
  const d = x.getImageData(0, 0, w, h).data, ink = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) ink[i] = d[i * 4 + 3] > 127 ? 1 : 0;
  return { w, h, ox, oy, ink };
}
// Point deepest inside the ink (two-pass chamfer distance transform).
function deepestPoint(map) {
  const { w, h, ink } = map, D = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) D[i] = ink[i] ? 1e9 : 0;
  for (let y = 1; y < h; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; if (!D[i]) continue;
    D[i] = Math.min(D[i], D[i - 1] + 1, D[i - w] + 1, D[i - w - 1] + 1.414, D[i - w + 1] + 1.414);
  }
  let best = 0, bi = 0;
  for (let y = h - 2; y >= 0; y--) for (let x = w - 2; x >= 1; x--) {
    const i = y * w + x; if (!D[i]) continue;
    D[i] = Math.min(D[i], D[i + 1] + 1, D[i + w] + 1, D[i + w + 1] + 1.414, D[i + w - 1] + 1.414);
    if (D[i] > best) { best = D[i]; bi = i; }
  }
  return { x: (bi % w) - map.ox, y: Math.floor(bi / w) - map.oy, d: best };
}
// Top-most connected blob of ink: the tittle of an i.
function topBlob(map) {
  const { w, h, ink } = map, seen = new Uint8Array(w * h);
  let start = -1;
  for (let i = 0; i < w * h && start < 0; i++) if (ink[i]) start = i;
  if (start < 0) return null;
  const stack = [start]; seen[start] = 1;
  let sx = 0, sy = 0, n = 0, minY = 1e9, maxY = 0;
  while (stack.length) {
    const i = stack.pop(), x = i % w, y = (i / w) | 0;
    sx += x; sy += y; n++; minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    for (const j of [i - 1, i + 1, i - w, i + w]) if (j >= 0 && j < w * h && ink[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
  }
  return { x: sx / n - map.ox, y: sy / n - map.oy, r: Math.max(Math.sqrt(n / Math.PI), (maxY - minY) / 2) };
}

// ─── Drawing helpers ──────────────────────────────────────────────
function bg(g, color) { g.fillStyle = color; g.fillRect(-200, -200, W + 400, H + 400); }
function disc(g, x, y, r, color) { g.fillStyle = color; g.beginPath(); g.arc(x, y, Math.max(0, r), 0, TAU); g.fill(); }
// Squash & stretch blob, volume-preserving, oriented along `rot`.
function blob(g, x, y, r, sx, sy, color, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(sx, sy);
  disc(g, 0, 0, r, color); g.restore();
}
function polyLen(p) { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; }
// Draw a polyline from fraction a to b of its length (pen-style draw on / off).
function polyPartial(g, p, a, b) {
  if (b <= a) return;
  const L = polyLen(p), A = a * L, B = b * L;
  let acc = 0, started = false;
  g.beginPath();
  for (let i = 1; i < p.length; i++) {
    const [x0, y0] = p[i - 1], [x1, y1] = p[i], l = Math.hypot(x1 - x0, y1 - y0);
    const s0 = clamp((A - acc) / l), s1 = clamp((B - acc) / l);
    if (s1 > s0) {
      const ax = lerp(x0, x1, s0), ay = lerp(y0, y1, s0);
      if (!started) { g.moveTo(ax, ay); started = true; } else g.lineTo(ax, ay);
      g.lineTo(lerp(x0, x1, s1), lerp(y0, y1, s1));
    }
    acc += l;
  }
  g.stroke();
}
// A fill that rises (dir=1) or falls (dir=-1) with a liquid, leading belly.
function liquidWipe(g, p, color, dir = 1) {
  if (p <= 0) return;
  const side = Ez.inOutCubic(clamp(p)), mid = Ez.inOutCubic(clamp(p * 1.18));
  const ys = dir > 0 ? lerp(H + 60, -60, side) : lerp(-60, H + 60, side);
  const ym = dir > 0 ? lerp(H + 60, -60, mid) : lerp(-60, H + 60, mid);
  const yq = 2 * ym - ys, far = dir > 0 ? H + 300 : -300;
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(-300, far); g.lineTo(-300, ys); g.lineTo(0, ys);
  g.quadraticCurveTo(CX, yq, W, ys);
  g.lineTo(W + 300, ys); g.lineTo(W + 300, far); g.closePath(); g.fill();
}
function typeSlice(s, t, t0, cps = 40) { return s.slice(0, Math.max(0, Math.floor((t - t0) * cps))); }

const PREP = [];
const onPrep = fn => PREP.push(fn);
