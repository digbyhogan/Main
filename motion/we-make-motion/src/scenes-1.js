// ═══ A · THE DROP (0 – 2s) ════════════════════════════════════════
const DOT_R = 22, FLOOR = 640, GRAV = 6400;
const REST_Y = FLOOR - DOT_R;

function dropDot(t) {
  if (t < CUE.dotPop) return null;
  const b = CUE.bounces, y0 = 260;
  const scale = Ez.outBack(seg(t, CUE.dotPop, CUE.dotPop + 0.3), 2.4);
  let y = y0, v = 0, sq = 0;
  if (t < CUE.launch) {
    sq = 0.24 * Ez.inOutSine(seg(t, 0.3, CUE.launch)); // anticipation: crouch
  } else if (t < b[0]) {
    ({ y, v } = ballistic(t, CUE.launch, y0, b[0], REST_Y, GRAV));
  } else {
    y = REST_Y;
    for (let i = 0; i < b.length - 1; i++) {
      if (t >= b[i] && t < b[i + 1]) ({ y, v } = ballistic(t, b[i], REST_Y, b[i + 1], REST_Y, GRAV));
    }
  }
  // impact squash, decaying like a spring
  const vHit = [2410, 1600, 800, 400, 200];
  b.forEach((bt, i) => {
    if (t >= bt) sq += Math.min(0.5, vHit[i] / 4200) * Math.exp(-(t - bt) * 20) * Math.cos((t - bt) * TAU * 6);
  });
  const st = 1 + Math.min(0.45, Math.abs(v) / 5200);
  const sy = Math.max(0.4, st * (1 - sq)), sx = 1 / sy;
  return { x: CX, y: y + DOT_R * (1 - sy), r: DOT_R * scale, sx, sy };
}

function dropFx(g, t) {
  const gl = Ez.outExpo(seg(t, 1.0, 1.7)) * 760, ga = 1 - seg(t, 1.6, 2.4);
  if (gl > 0 && ga > 0) {
    g.strokeStyle = `rgba(241,239,233,${0.3 * ga})`; g.lineWidth = 2;
    g.beginPath(); g.moveTo(CX - gl / 2, FLOOR); g.lineTo(CX + gl / 2, FLOOR); g.stroke();
  }
  const str = [1, 0.6, 0.35, 0.2, 0.1];
  CUE.bounces.forEach((bt, i) => {
    const p = seg(t, bt, bt + 0.8);
    if (p <= 0 || p >= 1) return;
    const rx = 30 + 300 * str[i] * Ez.outExpo(p);
    g.strokeStyle = `rgba(241,239,233,${0.55 * str[i] * (1 - p)})`; g.lineWidth = 2;
    g.beginPath(); g.ellipse(CX, FLOOR, rx, rx * 0.14, 0, 0, TAU); g.stroke();
  });
}

function sceneDrop(g, t) {
  bg(g, COL.ink);
  dropFx(g, t);
  const d = dropDot(t);
  if (d) blob(g, d.x, d.y, d.r, d.sx, d.sy, COL.flamingo);
}

// ═══ B · WE (2 – 6s) ══════════════════════════════════════════════
const WE = {};
onPrep(() => {
  const w100 = textW(F.disp(100), 'WE');
  WE.size = Math.min(560, (1180 / w100) * 100);
  WE.lay = glyphs(F.disp(WE.size), 'WE');
  WE.x = CX - WE.lay.width / 2;
  WE.y = CY + WE.lay.asc / 2 - 10;
  // Sample the word into particle targets.
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.font = WE.lay.font; x.fillStyle = '#000'; x.fillText('WE', WE.x, WE.y);
  const d = x.getImageData(0, 0, W, H).data, pts = [];
  const step = 13;
  for (let yy = 0; yy < H; yy += step) for (let xx = (yy / step) % 2 ? step / 2 : 0; xx < W; xx += step) {
    if (d[(yy * W + (xx | 0)) * 4 + 3] > 128) pts.push([xx, yy]);
  }
  let minX = 1e9, maxX = -1e9;
  for (const p of pts) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); }
  const quad = [[-44, -40], [44, -40], [-44, 40], [44, 40]];
  WE.parts = pts.map((p, i) => {
    const xn = (p[0] - minX) / (maxX - minX), q = quad[i % 4];
    return {
      ox: CX + q[0], oy: CY + q[1], tx: p[0], ty: p[1],
      th: rnd(i, 11) * TAU, R: 140 + 560 * rnd(i, 12) ** 0.7,
      spin: rnd(i, 13) > 0.5 ? 1 : -0.6,
      s: 2.95 + 0.25 * xn + 0.05 * rnd(i, 14), arc: (rnd(i, 15) - 0.5) * 300,
      hot: rnd(i, 16) < 0.1,
    };
  });
});

function partPos(p, t) {
  const b = Ez.outExpo(seg(t, CUE.burst, 3.4));
  const a = p.th + 1.3 * Ez.outCubic(seg(t, CUE.burst, 3.8)) * p.spin;
  const x1 = p.ox + Math.cos(a) * p.R * b, y1 = p.oy + Math.sin(a) * p.R * b * 0.62;
  const e = Ez.inOutCubic(seg(t, p.s, p.s + 0.75));
  const dx = p.tx - x1, dy = p.ty - y1, L = Math.hypot(dx, dy) || 1, arc = Math.sin(Math.PI * e) * p.arc;
  return [lerp(x1, p.tx, e) - (dy / L) * arc, lerp(y1, p.ty, e) + (dx / L) * arc];
}

function mitosis(g, t) {
  const col = COL.flamingo;
  if (t < CUE.split1) {
    const e = Ez.outCubic(seg(t, 2.0, 2.25));
    disc(g, CX, lerp(REST_Y, CY, e), lerp(DOT_R, 26, e), col);
    return;
  }
  const d1 = 44 * Ez.outBack(seg(t, CUE.split1, 2.42), 2);
  const d2 = 40 * Ez.outBack(seg(t, CUE.split2, 2.67), 2);
  const r = lerp(26, 20, seg(t, CUE.split2, 2.75));
  const neck1 = 1 - seg(t, CUE.split1, 2.37), neck2 = 1 - seg(t, CUE.split2, 2.62);
  g.fillStyle = col;
  if (neck1 > 0) { g.beginPath(); g.ellipse(CX, CY, d1, r * neck1 * 0.9, 0, 0, TAU); g.fill(); }
  for (const sx of [-1, 1]) {
    if (t >= CUE.split2 && neck2 > 0) { g.beginPath(); g.ellipse(CX + sx * d1, CY, r * neck2 * 0.9, d2, 0, 0, TAU); g.fill(); }
    for (const sy of t >= CUE.split2 ? [-1, 1] : [0]) disc(g, CX + sx * d1, CY + sy * d2, r, col);
  }
}

function sceneWe(g, t) {
  bg(g, COL.ink);
  dropFx(g, t);
  if (t < CUE.burst) { mitosis(g, t); return; }

  g.save();
  const push = 1 + 0.045 * Ez.inOutSine(seg(t, CUE.weLock, 5.5));
  g.translate(CX, CY); g.scale(push, push); g.translate(-CX, -CY);

  // particles
  const pa = 1 - seg(t, 3.98, 4.14);
  if (pa > 0) {
    const r = 4.3 * (0.4 + 0.6 * seg(t, CUE.burst, 3.0)) * (1 + 0.9 * seg(t, 3.98, 4.14));
    const dt = RO.streaks ? 1 / 90 : 0;
    g.lineCap = 'round'; g.lineWidth = r * 2;
    for (const hot of [false, true]) {
      g.strokeStyle = hot ? COL.flamingo : COL.chalk;
      g.globalAlpha = pa;
      g.beginPath();
      for (const p of WE.parts) {
        if (p.hot !== hot) continue;
        const [x, y] = partPos(p, t), [px, py] = partPos(p, t - dt);
        g.moveTo(px, py); g.lineTo(x + 0.01, y);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  // the solid word
  const sa = seg(t, 3.96, 4.04);
  if (sa > 0) {
    g.font = WE.lay.font; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    // echo pulse on the lock
    const ep = seg(t, CUE.weLock, 4.5);
    if (ep > 0 && ep < 1) {
      g.save(); const s = 1 + 0.1 * Ez.outExpo(ep);
      g.translate(CX, WE.y - WE.lay.asc / 2); g.scale(s, s); g.translate(-CX, -(WE.y - WE.lay.asc / 2));
      g.globalAlpha = 0.9 * (1 - ep); g.strokeStyle = COL.flamingo; g.lineWidth = 3;
      g.strokeText('WE', WE.x, WE.y); g.restore();
    }
    WE.lay.list.forEach((gl, j) => {
      const ls = CUE.weLaunch + j * 0.06;
      const squash = 0.1 * Ez.outQuad(seg(t, CUE.weSquash, CUE.weLaunch)) * (1 - seg(t, ls, ls + 0.08));
      const fly = Ez.inQuart(seg(t, ls, ls + 0.38));
      const stretch = 1 + 0.6 * seg(t, ls, ls + 0.25);
      const sy = (1 - squash) * stretch, sx = 1 / Math.sqrt(sy);
      const cx = WE.x + gl.x + gl.w / 2;
      g.save();
      g.globalAlpha = sa;
      g.translate(cx, WE.y - fly * 1400); g.scale(sx, sy);
      g.fillStyle = COL.chalk; g.fillText(gl.ch, -gl.w / 2, 0);
      g.restore();
    });
  }
  g.restore();
  liquidWipe(g, seg(t, 5.62, 6.0), COL.chalk, 1);
}

// ═══ C · MAKE (6 – 10s) ══════════════════════════════════════════
const MK = {
  sw: 76, top: 360, base: 720,
  M: [[237, 682], [237, 398], [399, 568], [561, 398], [561, 682]],
  A: [[701, 682], [843, 398], [985, 682]],
  Ks: [[1125, 398], [1125, 682]],
  Ka: [[1349, 398], [1134, 556], [1349, 682]],
  Eb: [[1683, 398], [1489, 398], [1489, 682], [1683, 682]],
  Em: [[1489, 540], [1650, 540]],
  boxes: [[199, 599], [663, 1023], [1087, 1387], [1451, 1721]],
  aRest: 537, eTip: [1650, 540 - 38 - 24],
};
// stroke list: [points, start, duration, letterIndex]
MK.strokes = [
  [MK.M, 6.5, 0.42, 0], [MK.A, 7.0, 0.36, 1], [MK.Ks, 7.5, 0.22, 2],
  [MK.Ka, 7.56, 0.3, 2], [MK.Eb, 8.0, 0.36, 3],
];
const MAKE_DOT_R = 24;

function makeDot(t) {
  const [b0, b1, b2] = CUE.dotInA, x = 843;
  if (t < 6.8) return null;
  let y, v = 0, vx = 0, px = x, sq = 0;
  if (t < b0) ({ y, v } = ballistic(t, 6.8, -60, b0, MK.aRest, GRAV));
  else if (t < b1) ({ y, v } = ballistic(t, b0, MK.aRest, b1, MK.aRest, GRAV));
  else if (t < b2) ({ y, v } = ballistic(t, b1, MK.aRest, b2, MK.aRest, GRAV));
  else if (t < CUE.hop) y = MK.aRest;
  else if (t < CUE.hopLand) {
    ({ y, v } = ballistic(t, CUE.hop, MK.aRest, CUE.hopLand, MK.eTip[1], GRAV));
    vx = (MK.eTip[0] - x) / (CUE.hopLand - CUE.hop);
    px = lerp(x, MK.eTip[0], seg(t, CUE.hop, CUE.hopLand));
  } else { px = MK.eTip[0]; y = MK.eTip[1]; }
  [b0, b1, CUE.hopLand].forEach((bt, i) => {
    if (t >= bt) sq += [0.4, 0.15, 0.45][i] * Math.exp(-(t - bt) * 18) * Math.cos((t - bt) * TAU * 6);
  });
  sq += 0.25 * Ez.inOutSine(seg(t, 8.3, CUE.hop)) * (1 - seg(t, CUE.hop, 8.56)); // crouch
  const sp = Math.hypot(vx, v), st = 1 + Math.min(0.4, sp / 5200);
  const rot = sp > 1 ? Math.atan2(v, vx) - Math.PI / 2 : 0;
  const sy = Math.max(0.45, st * (1 - sq));
  return { x: px, y: y + MAKE_DOT_R * (1 - sy), r: MAKE_DOT_R, sx: 1 / sy, sy, rot };
}

function sceneMake(g, t) {
  bg(g, COL.chalk);
  const fade = 1 - seg(t, 9.4, 9.7);

  // construction grid
  g.lineWidth = 1.5; g.strokeStyle = COL.ultra;
  g.globalAlpha = 0.32 * fade;
  [MK.top, 540, MK.base].forEach((y, i) => {
    const e = Ez.outExpo(seg(t, CUE.grid + i * 0.06, CUE.grid + i * 0.06 + 0.6)) * (W / 2 + 20);
    if (e > 0) { g.beginPath(); g.moveTo(CX - e, y); g.lineTo(CX + e, y); g.stroke(); }
  });
  MK.boxes.flat().forEach((x, i) => {
    const s = CUE.grid + 0.1 + i * 0.03, e = Ez.outExpo(seg(t, s, s + 0.55)) * (H / 2 + 20);
    if (e > 0) { g.beginPath(); g.moveTo(x, CY - e); g.lineTo(x, CY + e); g.stroke(); }
  });
  const ca = Ez.outCubic(seg(t, 6.35, 7.0));
  if (ca > 0) {
    g.setLineDash([6, 8]); g.beginPath(); g.arc(843, MK.aRest, 70, -Math.PI / 2, -Math.PI / 2 + TAU * ca); g.stroke(); g.setLineDash([]);
  }
  // annotations
  g.globalAlpha = 0.85 * fade; g.fillStyle = COL.ultra; g.font = F.mono(14); g.textAlign = 'left';
  [['CAP 360', MK.top], ['MID 540', 540], ['BASE 720', MK.base]].forEach(([s, y], i) =>
    g.fillText(typeSlice(s, t, 6.2 + i * 0.08, 30), 40, y - 10));
  g.textAlign = 'right';
  g.fillText(typeSlice('4 GLYPHS · 13 SEGMENTS · 1 DOT', t, 6.6, 40), 1721, 300);
  const dm = Ez.outExpo(seg(t, 6.75, 7.2));
  if (dm > 0) {
    g.strokeStyle = COL.ultra; g.lineWidth = 1.5; g.beginPath();
    g.moveTo(199, 764); g.lineTo(199 + 76 * dm, 764);
    g.moveTo(199, 754); g.lineTo(199, 774); g.moveTo(199 + 76 * dm, 754); g.lineTo(199 + 76 * dm, 774); g.stroke();
    g.textAlign = 'left'; g.fillText(typeSlice('STROKE 76', t, 6.9, 30), 199, 800);
  }
  g.globalAlpha = 1;

  // glyph strokes
  g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = MK.sw; g.strokeStyle = COL.ink;
  MK.strokes.forEach(([pts, s, d, li]) => {
    const on = Ez.outQuart(seg(t, s, s + d));
    const off = Ez.inQuart(seg(t, CUE.retract + li * 0.05, CUE.retract + li * 0.05 + 0.24));
    if (on <= 0) return;
    const [bx0, bx1] = MK.boxes[li], ls = CUE.make[li];
    const k = 1 + 0.05 * wobble(t - ls - 0.25, 5, 2.4);
    g.save(); g.translate((bx0 + bx1) / 2, MK.base); g.scale(1 / k, k); g.translate(-(bx0 + bx1) / 2, -MK.base);
    polyPartial(g, pts, off, on);
    g.restore();
  });
  // E's middle bar: draws on, then becomes the horizon
  const mOn = Ez.outQuart(seg(t, 8.1, 8.32));
  const ext = Ez.outExpo(seg(t, CUE.lineOut, 9.65));
  const x0 = lerp(1489, -150, ext), x1 = lerp(1489 + (1650 - 1489) * mOn, W + 150, ext);
  const irisR = 2300 * Ez.inOutQuart(seg(t, CUE.iris, 10.0));
  const drawBar = c => { if (mOn > 0) { g.strokeStyle = c; g.lineWidth = MK.sw * lerp(1, 0.08, seg(t, 9.4, 9.9)); g.beginPath(); g.moveTo(x0, 540); g.lineTo(x1, 540); g.stroke(); } };
  drawBar(COL.ink);
  if (irisR > 0) {
    g.save(); g.beginPath(); g.arc(MK.eTip[0], MK.eTip[1], irisR, 0, TAU); g.clip();
    bg(g, COL.ultra); drawBar(COL.chalk); g.restore();
  }
  const d = makeDot(t);
  if (d) {
    const ride = 34 * seg(t, 9.4, 9.9); // bar thins, dot settles with it
    blob(g, d.x, d.y + ride, d.r, d.sx, d.sy, COL.flamingo, d.rot);
  }
}
