// ═══ D · MOTION (10 – 16s) ═══════════════════════════════════════
const MO = {};
onPrep(() => {
  const w100 = textW(F.disp(100), 'MOTION');
  MO.size = Math.min(270, (1450 / w100) * 100);
  MO.lay = glyphs(F.disp(MO.size), 'MOTION');
  MO.x = CX - MO.lay.width / 2;
  MO.cap = MO.lay.asc;
  MO.base = CY + MO.cap / 2;
  MO.rowSize = 118;
  MO.row = glyphs(F.disp(MO.rowSize), 'MOTION');
  MO.rowGap = MO.rowSize * 0.95;
  MO.rowUnit = MO.row.width + MO.rowGap;
  MO.heroUnit = MO.lay.width + 440;
  // Integrate scroll speed once into lookup tables (beat pulses + exponential build).
  const dt = 1 / 480, n = Math.ceil(4 / dt) + 2;
  MO.X = new Float32Array(n); MO.XC = new Float32Array(n); MO.V = new Float32Array(n);
  let x = 0, xc = 0;
  for (let i = 0; i < n; i++) {
    const t = 12 + i * dt;
    let pb = 0;
    for (let b = 12; b <= t && b < 15.75; b += BEAT) pb += pulse(t, b, 8);
    const accel = 2 ** (2 * Math.max(0, t - CUE.build));
    const stop = t > CUE.collapse ? (1 - seg(t, CUE.collapse, 16)) ** 2 : 1;
    const v = 260 * (1 + 2.2 * pb) * accel * stop;
    const vc = t < CUE.build ? 0 : 220 * (1 + 1.5 * pb) * accel * stop;
    MO.X[i] = x; MO.XC[i] = xc; MO.V[i] = v;
    x += v * dt; xc += vc * dt;
  }
  MO.dt = dt;
});
function moLook(arr, t) {
  const f = clamp((t - 12) / MO.dt, 0, arr.length - 2), i = Math.floor(f);
  return lerp(arr[i], arr[i + 1], f - i);
}

const waveAxis = t => lerp(540, MO.base + 4, Ez.outCubic(seg(t, 10.0, 10.6)));
const waveAmp = t => 80 * spring(t - 10.05, 0.35, 1.6) * (1 - Ez.inOutCubic(seg(t, 11.65, 12.0)));
const wavePh = (x, t) => (TAU * x) / 760 + TAU * 0.9 * (t - 10);
const waveY = (x, t) => waveAxis(t) + waveAmp(t) * Math.sin(wavePh(x, t));
const waveSlope = (x, t) => waveAmp(t) * (TAU / 760) * Math.cos(wavePh(x, t));

function surfDot(t) {
  if (t < 10.05) return { x: MK.eTip[0], y: 513 };
  if (t < 11.55) {
    const x = lerp(MK.eTip[0], 170, Ez.inOutSine(seg(t, 10.05, 11.55)));
    return { x, y: waveY(x, t) - 3 - MAKE_DOT_R };
  }
  if (t < 11.95) {
    const y0 = waveY(170, 11.55) - 3 - MAKE_DOT_R;
    return { x: lerp(170, -80, seg(t, 11.55, 11.95)), y: ballistic(t, 11.55, y0, 11.95, 260, GRAV).y };
  }
  return null;
}

function moLetter(i, t) {
  const gl = MO.lay.list[i], s = 10.25 + i * 0.125;
  const e = Ez.outQuart(seg(t, s, s + 1.1));
  const x = lerp(W + 200 + i * 60, MO.x + gl.x + gl.w / 2, e);
  return { x, y: waveY(x, t) - 3, r: Math.atan(waveSlope(x, t)), gl };
}

function drawRow(g, k, t) {
  const yc = CY + Math.sign(k) * [0, 188, 342, 496][Math.abs(k)];
  const rev = Ez.outExpo(seg(t, 12.05 + (Math.abs(k) - 1) * 0.09, 12.55 + (Math.abs(k) - 1) * 0.09));
  if (rev <= 0) return;
  const dir = (k > 0 ? 1 : -1) * (Math.abs(k) % 2 ? 1 : -1), mult = 1 + 0.18 * (Math.abs(k) - 1);
  const off = dir * moLook(MO.X, t) * mult + k * 211;
  const v = moLook(MO.V, t) * mult;
  const u = MO.rowUnit, base = yc + MO.row.asc / 2;
  g.save();
  g.beginPath(); g.rect(-400, yc - 80 * rev, W + 800, 160 * rev); g.clip();
  g.translate(0, base); g.transform(1, 0, -dir * 0.35 * clamp(v / 3500), 1, 0, 0); g.translate(0, -base);
  g.font = MO.row.font; g.textAlign = 'left';
  const outline = Math.abs(k) % 2 === 1;
  // Outline = fat stroke knocked out by a ground-coloured fill, which hides
  // the variable font's overlapping inner contours.
  g.strokeStyle = COL.chalk; g.lineWidth = 5; g.lineJoin = 'round';
  const ground = mixHex(COL.ultra, COL.ultraHi, pulse(t, CUE.slam, 7));
  let x = (((off % u) + u) % u) - u - 400;
  for (; x < W + 400; x += u) {
    if (outline) { g.strokeText('MOTION', x, base); g.fillStyle = ground; g.fillText('MOTION', x, base); }
    else { g.fillStyle = COL.chalk; g.fillText('MOTION', x, base); }
    disc(g, x + MO.row.width + MO.rowGap / 2, base - MO.row.asc / 2, 11, COL.flamingo);
  }
  g.restore();
}

function sceneMotion(g, t) {
  bg(g, mixHex(COL.ultra, COL.ultraHi, pulse(t, CUE.slam, 7)));
  g.save();
  // the build: camera tilts and pushes in, then everything collapses to a line
  const b = Ez.inQuad(seg(t, CUE.build, CUE.collapse));
  const col = Ez.inQuart(seg(t, CUE.collapse, 16.0));
  g.translate(CX, CY); g.rotate(-0.09 * b * (1 - col)); g.scale(1 + 0.3 * b, 1 - 0.985 * col); g.translate(-CX, -CY);

  // wave line (MAKE's crossbar, now alive)
  if (t < 12.3) {
    const half = (W / 2 + 150) * (1 - Ez.outExpo(seg(t, CUE.slam, 12.3)));
    g.strokeStyle = COL.chalk; g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath();
    for (let x = CX - half; x <= CX + half; x += 12) x === CX - half ? g.moveTo(x, waveY(x, t)) : g.lineTo(x, waveY(x, t));
    g.stroke();
  }
  const d = surfDot(t);
  if (d) {
    const p = surfDot(t - 1 / 120) || d, v = Math.hypot(d.x - p.x, d.y - p.y) * 120;
    const st = 1 + Math.min(0.35, v / 5000);
    blob(g, d.x, d.y, MAKE_DOT_R, st, 1 / st, COL.flamingo, Math.atan2(d.y - p.y, d.x - p.x));
  }

  // marquee rows (after the slam)
  if (t >= CUE.slam) for (const k of [-3, -2, -1, 1, 2, 3]) drawRow(g, k, t);

  // hero word
  let flash = 0;
  for (let bt = CUE.slam; bt < CUE.collapse && bt <= t; bt += BEAT) flash = Math.max(flash, pulse(t, bt, 11) * (bt >= CUE.build ? 1 : 0.55));
  const heroCol = mixHex(COL.chalk, COL.flamingo, flash);
  g.font = MO.lay.font; g.textAlign = 'left';
  if (t < CUE.slam) {
    for (let k = 5; k >= 1; k--) { // echo trails show the arcs
      for (let i = 0; i < 6; i++) {
        const a = moLetter(i, t - k * 0.028), c = moLetter(i, t);
        if (Math.abs(a.x - c.x) < 3) continue;
        g.save(); g.globalAlpha = 0.42 * (1 - k / 6); g.fillStyle = COL.flamingo;
        g.translate(a.x, a.y); g.rotate(a.r); g.fillText(a.gl.ch, -a.gl.w / 2, 0); g.restore();
      }
    }
    for (let i = 0; i < 6; i++) {
      const c = moLetter(i, t);
      g.save(); g.fillStyle = COL.chalk; g.translate(c.x, c.y); g.rotate(c.r); g.fillText(c.gl.ch, -c.gl.w / 2, 0); g.restore();
    }
  } else {
    const s = 1 + 0.12 * (1 - spring(t - CUE.slam, 0.32, 3.2));
    const shake = t >= CUE.build ? noise1(t * 40, 7) * 6 * b : 0;
    const oc = moLook(MO.XC, t);
    g.save();
    g.translate(CX + shake, MO.base - MO.cap / 2); g.scale(s, s); g.translate(-CX, -(MO.base - MO.cap / 2));
    g.fillStyle = heroCol;
    const reps = t >= CUE.build ? [-2, -1, 0, 1, 2] : [0];
    for (const r of reps) {
      const x = MO.x + oc + r * MO.heroUnit;
      g.fillStyle = heroCol; g.fillText('MOTION', x, MO.base);
      if (r < 2 && t >= CUE.build) disc(g, x + MO.lay.width + 220, MO.base - MO.cap / 2, 18, COL.flamingo);
    }
    g.restore();
  }
  g.restore();
  if (col > 0.9) { g.fillStyle = COL.chalk; g.fillRect(-100, CY - 2, W + 200, 4); }
}

// ═══ E · without (16 – 18s) ══════════════════════════════════════
const WO = {};
onPrep(() => {
  WO.font = F.serif(230);
  WO.lay = glyphs(WO.font, 'without');
  WO.x = CX - WO.lay.width / 2;
  WO.y = 610;
  const tb = topBlob(inkMap(WO.font, 'i'));
  WO.tit = tb || { x: WO.lay.list[1].w * 0.6, y: -150, r: 14 };
  const dp = deepestPoint(inkMap(WO.font, 'o'));
  WO.oPt = { x: WO.x + WO.lay.list[4].x + dp.x, y: WO.y + dp.y, d: dp.d };
});
const woTrack = (i, t) => (i - 3) * 70 * (1 - Ez.outQuint(seg(t, 16.3, 17.3)));

function woDot(t) {
  const [b0, b1, b2] = CUE.tittle;
  if (t < 16.6) return null;
  const rest = WO.y + WO.tit.y;
  let y, sq = 0;
  if (t < b0) y = ballistic(t, 16.6, -40, b0, rest, GRAV).y;
  else if (t < b1) y = ballistic(t, b0, rest, b1, rest, GRAV).y;
  else if (t < b2) y = ballistic(t, b1, rest, b2, rest, GRAV).y;
  else y = rest;
  [b0, b1].forEach((bt, i) => { if (t >= bt) sq += [0.45, 0.2][i] * Math.exp(-(t - bt) * 20) * Math.cos((t - bt) * TAU * 6); });
  const x = WO.x + WO.lay.list[1].x + WO.tit.x + woTrack(1, t);
  return { x, y, r: WO.tit.r * 1.15, sy: Math.max(0.5, 1 - sq) };
}

function sceneWithout(g, t) {
  bg(g, COL.chalk);
  // the line from MOTION's collapse, switching off like an old TV
  const hl = 1 - Ez.inOutExpo(seg(t, 16.0, 16.32));
  if (hl > 0) { g.fillStyle = COL.ink; g.fillRect(CX - (W / 2 + 100) * hl, CY - 2, (W + 200) * hl, 4); }

  g.save();
  const P = WO.oPt, pp = seg(t, CUE.portal, 18.0);
  const z = (1 + 0.04 * seg(t, 16.3, CUE.portal)) * Math.exp(Math.log(150) * Ez.inCubic(pp));
  const m = Ez.inOutCubic(seg(t, CUE.portal, 17.9));
  g.translate(lerp(P.x, CX, m), lerp(P.y, CY, m)); g.scale(z, z); g.translate(-P.x, -P.y);

  g.font = WO.font; g.textAlign = 'left'; g.fillStyle = COL.ink;
  WO.lay.list.forEach((gl, i) => {
    const st = 16.3 + i * 0.09, a = Ez.outSine(seg(t, st, st + 0.55));
    if (a <= 0) return;
    const blur = 14 * (1 - a), dy = 24 * (1 - Ez.outQuint(seg(t, st, st + 0.7)));
    const x = WO.x + gl.x + woTrack(i, t), y = WO.y + dy;
    g.save();
    g.globalAlpha = a;
    if (blur > 0.4) g.filter = `blur(${(blur * RS).toFixed(1)}px)`;
    if (i === 1) { // hide the i's own tittle; the dot is about to claim it
      g.beginPath(); g.rect(x - 200, y - 400, 400, 600);
      g.arc(x + WO.tit.x, y + WO.tit.y, WO.tit.r * 1.7, 0, TAU, true); g.clip('evenodd');
    }
    g.fillText(gl.ch, x, y);
    g.restore();
  });
  const d = woDot(t);
  if (d) blob(g, d.x, d.y + d.r * (1 - d.sy), d.r, 1 / d.sy, d.sy, COL.flamingo);
  g.restore();
  const ink = seg(t, 17.9, 18.0);
  if (ink > 0) { g.globalAlpha = ink; bg(g, COL.ink); g.globalAlpha = 1; }
}
