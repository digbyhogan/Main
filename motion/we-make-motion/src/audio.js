// ═══ SOUND · every hit synthesised, every hit read from CUE ═══════
const SR = 48000;

function buildBus(ctx) {
  const M = { ctx, rng: mulberry32(2024) };
  const nb = ctx.createBuffer(1, SR * 2, SR), nd = nb.getChannelData(0), r = mulberry32(7);
  for (let i = 0; i < nd.length; i++) nd[i] = r() * 2 - 1;
  M.noise = nb;

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 3.5; comp.knee.value = 6; comp.attack.value = 0.004; comp.release.value = 0.2;
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -2; lim.ratio.value = 20; lim.knee.value = 0; lim.attack.value = 0.001; lim.release.value = 0.08;
  M.master = ctx.createGain(); M.master.gain.value = 0.92;
  comp.connect(lim); lim.connect(M.master); M.master.connect(ctx.destination);
  const drive = ctx.createGain(); drive.gain.value = 1.4; drive.connect(comp);
  M.dry = ctx.createGain(); M.dry.connect(drive);

  // reverb: generated stereo impulse
  const ir = ctx.createBuffer(2, SR * 2.8, SR), ri = mulberry32(31);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] = (ri() * 2 - 1) * Math.pow(1 - i / d.length, 3.4);
  }
  const conv = ctx.createConvolver(); conv.buffer = ir;
  M.rev = ctx.createGain(); M.rev.gain.value = 0.55;
  M.rev.connect(conv); conv.connect(drive);

  // ping-pong delay, dotted eighth
  M.dly = ctx.createGain(); M.dly.gain.value = 0.3;
  const dl = ctx.createDelay(1), dr = ctx.createDelay(1), fb = ctx.createGain(), lp = ctx.createBiquadFilter();
  dl.delayTime.value = BEAT * 0.75; dr.delayTime.value = BEAT * 0.75; fb.gain.value = 0.38;
  lp.type = 'lowpass'; lp.frequency.value = 3200;
  const merge = ctx.createChannelMerger(2);
  M.dly.connect(dl); dl.connect(lp); lp.connect(dr); dr.connect(fb); fb.connect(dl);
  dl.connect(merge, 0, 0); dr.connect(merge, 0, 1); merge.connect(drive);

  // bitcrusher for glitches
  M.crush = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) curve[i] = Math.round((i / 1023 * 2 - 1) * 5) / 5;
  M.crush.curve = curve; M.crush.connect(M.dry);
  return M;
}

// route a voice: panning, reverb send, delay send
function out(M, node, { pan = 0, rev = 0, dly = 0, crush = false } = {}) {
  const p = M.ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
  node.connect(p); p.connect(crush ? M.crush : M.dry);
  if (rev) { const s = M.ctx.createGain(); s.gain.value = rev; p.connect(s); s.connect(M.rev); }
  if (dly) { const s = M.ctx.createGain(); s.gain.value = dly; p.connect(s); s.connect(M.dly); }
  return p;
}
function envGain(M, t, a, peak, d) {
  const g = M.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  return g;
}
function osc(M, type, f, t, dur) {
  const o = M.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
  o.start(t); o.stop(t + dur + 0.05); return o;
}
function noise(M, t, dur) {
  const s = M.ctx.createBufferSource(); s.buffer = M.noise; s.loop = true;
  s.start(t, M.rng() * 1.5); s.stop(t + dur + 0.05); return s;
}
function filt(M, type, f, q = 0.7) { const b = M.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }

// ─── voices ──────────────────────────────────────────────────────
function kick(M, t, { gain = 1, f0 = 170, f1 = 46, decay = 0.5, click = 0.4, rev = 0.04 } = {}) {
  const o = osc(M, 'sine', f0, t, decay);
  o.frequency.exponentialRampToValueAtTime(f1, t + 0.09);
  const g = envGain(M, t, 0.002, gain, decay);
  o.connect(g); out(M, g, { rev });
  if (click) {
    const n = noise(M, t, 0.02), hp = filt(M, 'highpass', 2500), cg = envGain(M, t, 0.001, click * gain * 0.5, 0.015);
    n.connect(hp); hp.connect(cg); out(M, cg);
  }
}
function snare(M, t, { gain = 0.6, decay = 0.2, rev = 0.22, pan = 0 } = {}) {
  const n = noise(M, t, decay), bp = filt(M, 'bandpass', 1900, 0.7), g = envGain(M, t, 0.001, gain, decay);
  n.connect(bp); bp.connect(g); out(M, g, { rev, pan });
  const o = osc(M, 'triangle', 200, t, 0.12); o.frequency.exponentialRampToValueAtTime(150, t + 0.1);
  const og = envGain(M, t, 0.001, gain * 0.55, 0.1); o.connect(og); out(M, og, { pan });
}
function clap(M, t, { gain = 0.5, rev = 0.3 } = {}) {
  [0, 0.011, 0.023].forEach((o, i) => {
    const n = noise(M, t + o, i === 2 ? 0.18 : 0.02), bp = filt(M, 'bandpass', 1200, 1.1);
    const g = envGain(M, t + o, 0.001, gain, i === 2 ? 0.16 : 0.012);
    n.connect(bp); bp.connect(g); out(M, g, { rev });
  });
}
function hat(M, t, { gain = 0.16, open = false, pan = 0.15, crush = false } = {}) {
  const d = open ? 0.24 : 0.035;
  const n = noise(M, t, d), hp = filt(M, 'highpass', 7200), bp = filt(M, 'bandpass', 10500, 0.6), g = envGain(M, t, 0.001, gain, d);
  n.connect(hp); hp.connect(bp); bp.connect(g); out(M, g, { pan, crush });
}
function clack(M, t, { freq = 900, gain = 0.35, pan = 0 } = {}) {
  const o = osc(M, 'sine', freq, t, 0.08), g = envGain(M, t, 0.001, gain, 0.07);
  const o2 = osc(M, 'triangle', freq * 2.71, t, 0.04), g2 = envGain(M, t, 0.001, gain * 0.35, 0.03);
  o.connect(g); o2.connect(g2); out(M, g, { pan, rev: 0.12 }); out(M, g2, { pan });
  const b = osc(M, 'sine', 140, t, 0.25); b.frequency.exponentialRampToValueAtTime(70, t + 0.2);
  const bg_ = envGain(M, t, 0.002, gain * 0.9, 0.22); b.connect(bg_); out(M, bg_);
}
function pluck(M, t, { freq = 523.25, gain = 0.22, decay = 0.5, pan = 0, rev = 0.25, dly = 0.35 } = {}) {
  const o = osc(M, 'triangle', freq, t, decay), o2 = osc(M, 'sine', freq * 2, t, decay * 0.6);
  const lp = filt(M, 'lowpass', 5000); lp.frequency.setValueAtTime(6000, t); lp.frequency.exponentialRampToValueAtTime(700, t + decay);
  const g = envGain(M, t, 0.002, gain, decay), g2 = envGain(M, t, 0.002, gain * 0.3, decay * 0.5);
  o.connect(lp); lp.connect(g); o2.connect(g2); out(M, g, { pan, rev, dly }); out(M, g2, { pan, rev });
}
function blip(M, t, { freq = 1568, gain = 0.16, dur = 0.07, type = 'sine', pan = 0, rev = 0.2, crush = false } = {}) {
  const o = osc(M, type, freq, t, dur), g = envGain(M, t, 0.001, gain, dur);
  o.connect(g); out(M, g, { pan, rev, crush });
}
function sweep(M, t, dur, { f0 = 300, f1 = 900, gain = 0.2, type = 'sine', pan = 0, rev = 0.15 } = {}) {
  const o = osc(M, type, f0, t, dur); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = envGain(M, t, 0.004, gain, dur); o.connect(g); out(M, g, { pan, rev });
}
function whoosh(M, t, dur, { f0 = 400, f1 = 4000, gain = 0.3, pan0 = -0.6, pan1 = 0.6, q = 1.4, rev = 0.2 } = {}) {
  const n = noise(M, t, dur), bp = filt(M, 'bandpass', f0, q);
  bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = M.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const p = M.ctx.createStereoPanner(); p.pan.setValueAtTime(pan0, t); p.pan.linearRampToValueAtTime(pan1, t + dur);
  n.connect(bp); bp.connect(g); g.connect(p); p.connect(M.dry);
  const s = M.ctx.createGain(); s.gain.value = rev; p.connect(s); s.connect(M.rev);
}
function riser(M, t, dur, { gain = 0.25, f0 = 300, f1 = 9000 } = {}) {
  const n = noise(M, t, dur), hp = filt(M, 'bandpass', f0, 0.9);
  hp.frequency.setValueAtTime(f0, t); hp.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = M.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + dur - 0.01); g.gain.linearRampToValueAtTime(0, t + dur);
  n.connect(hp); hp.connect(g); out(M, g, { rev: 0.3 });
  const o = osc(M, 'sawtooth', 110, t, dur); o.frequency.exponentialRampToValueAtTime(880, t + dur);
  const lp = filt(M, 'lowpass', 1200), og = M.ctx.createGain();
  og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(gain * 0.25, t + dur - 0.01); og.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(lp); lp.connect(og); out(M, og);
}
function crash(M, t, { gain = 0.3, decay = 1.4 } = {}) {
  const n = noise(M, t, decay), hp = filt(M, 'highpass', 5200), g = envGain(M, t, 0.002, gain, decay);
  n.connect(hp); hp.connect(g); out(M, g, { rev: 0.35, pan: -0.1 });
  [293, 419, 527, 761, 1033, 1319].forEach((f, i) => {
    const o = osc(M, 'square', f * 2.3, t, decay * 0.5), h = filt(M, 'highpass', 6000), og = envGain(M, t, 0.002, gain * 0.05, decay * 0.4);
    o.connect(h); h.connect(og); out(M, og, { pan: i % 2 ? 0.3 : -0.3 });
  });
}
function impact(M, t, { gain = 0.8 } = {}) {
  sweep(M, t, 1.3, { f0: 70, f1: 26, gain: gain * 0.9, rev: 0.1 });
  const n = noise(M, t, 0.5), lp = filt(M, 'lowpass', 2600), g = envGain(M, t, 0.002, gain * 0.45, 0.45);
  n.connect(lp); lp.connect(g); out(M, g, { rev: 0.5 });
  kick(M, t, { gain, f0: 150, f1: 38, decay: 0.8 });
}
function glass(M, t, { freq = 1318.5, gain = 0.25, pan = 0 } = {}) {
  [[1, 1, 2.6], [2.76, 0.45, 1.6], [5.4, 0.22, 0.9], [8.93, 0.1, 0.5]].forEach(([m, a, d]) => {
    const o = osc(M, 'sine', freq * m, t, d), g = envGain(M, t, 0.002, gain * a, d);
    o.connect(g); out(M, g, { pan, rev: 0.7, dly: 0.2 });
  });
}
function sproing(M, t, { gain = 0.22 } = {}) {
  const o = osc(M, 'sine', 260, t, 0.5), lfo = osc(M, 'sine', 22, t, 0.5), lg = M.ctx.createGain();
  lg.gain.setValueAtTime(120, t); lg.gain.exponentialRampToValueAtTime(2, t + 0.45);
  lfo.connect(lg); lg.connect(o.frequency);
  o.frequency.exponentialRampToValueAtTime(620, t + 0.12);
  const g = envGain(M, t, 0.003, gain, 0.45); o.connect(g); out(M, g, { rev: 0.25, dly: 0.2 });
}
function tick(M, t, { gain = 0.08, freq = 3200, pan = 0 } = {}) {
  const n = noise(M, t, 0.012), bp = filt(M, 'bandpass', freq, 2.5), g = envGain(M, t, 0.0005, gain, 0.01);
  n.connect(bp); bp.connect(g); out(M, g, { pan });
  blip(M, t, { freq: freq * 0.6, gain: gain * 0.4, dur: 0.012, rev: 0 });
}
function tapeStop(M, t, dur, { gain = 0.35 } = {}) {
  [110, 164.8, 220].forEach(f => {
    const o = osc(M, 'sawtooth', f, t, dur); o.frequency.exponentialRampToValueAtTime(f * 0.08, t + dur);
    const lp = filt(M, 'lowpass', 2400); lp.frequency.setValueAtTime(2400, t); lp.frequency.exponentialRampToValueAtTime(90, t + dur);
    const g = M.ctx.createGain(); g.gain.setValueAtTime(gain * 0.3, t); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); out(M, g);
  });
}
function glitchBurst(M, t, dur, { gain = 0.2, seed = 1 } = {}) {
  const r = mulberry32(seed);
  for (let x = t; x < t + dur; x += 1 / 60 + r() / 40) {
    blip(M, x, { freq: 200 + r() * 2600, gain: gain * (0.4 + r() * 0.6), dur: 0.012 + r() * 0.02, type: 'square', pan: r() * 1.6 - 0.8, rev: 0, crush: true });
  }
}
function air(M, t, dur, { gain = 0.05 } = {}) {
  const n = noise(M, t, dur), bp = filt(M, 'bandpass', 1400, 0.5), g = M.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(bp); bp.connect(g); out(M, g, { rev: 0.4 });
}

// ─── the score ───────────────────────────────────────────────────
const NOTE = { C5: 523.25, D5: 587.33, E5: 659.26, G5: 783.99, A5: 880, C6: 1046.5, D6: 1174.7, E6: 1318.5, G6: 1568, A6: 1760 };
const range = (a, b, step) => { const o = []; for (let x = a; x < b - 1e-6; x += step) o.push(+x.toFixed(4)); return o; };

function score(M) {
  const B = CUE.bounces, FB = CUE.finalBounces;
  const bounceKit = (hits, k = 1) => hits.forEach((bt, i) => {
    kick(M, bt, { gain: [1, 0.72, 0.52, 0.38, 0.27][i] * k, f0: 150 + i * 22, f1: 44 + i * 6, decay: [0.6, 0.42, 0.3, 0.2, 0.15][i] });
    clack(M, bt, { freq: 520 + i * 90, gain: 0.1 * (1 - i * 0.15) });
  });

  // A · the drop
  blip(M, CUE.dotPop, { freq: NOTE.G6, gain: 0.2, rev: 0.4 });
  sweep(M, CUE.launch, 0.16, { f0: 500, f1: 1400, gain: 0.07 });
  bounceKit(B);

  // B · WE
  pluck(M, CUE.split1, { freq: NOTE.C5, pan: -0.3 });
  pluck(M, CUE.split2, { freq: NOTE.G5, pan: 0.3 });
  blip(M, CUE.burst, { freq: NOTE.E6, gain: 0.18 });
  whoosh(M, CUE.burst, 0.5, { f0: 3000, f1: 600, gain: 0.18, pan0: 0, pan1: 0 });
  const r = mulberry32(5), penta = [NOTE.C6, NOTE.D6, NOTE.E6, NOTE.G6, NOTE.A6];
  for (let i = 0; i < 26; i++) {
    const x = 2.8 + r() * 1.15;
    blip(M, x, { freq: penta[Math.floor(r() * 5)] * (r() > 0.7 ? 2 : 1), gain: 0.035 + r() * 0.03, dur: 0.09, pan: r() * 1.6 - 0.8, rev: 0.5 });
  }
  riser(M, 2.9, 1.1, { gain: 0.16 });
  kick(M, CUE.weLock, { gain: 1 }); snare(M, CUE.weLock, { gain: 0.55 }); clap(M, CUE.weLock); crash(M, CUE.weLock, { gain: 0.22 });
  sweep(M, CUE.weLock, 0.9, { f0: 60, f1: 30, gain: 0.5, rev: 0 });
  [4.5, 5.0].forEach(x => kick(M, x, { gain: 0.8 }));
  [4.5, 5.5].forEach(x => snare(M, x, { gain: 0.45 }));
  range(4.25, 5.5, 0.5).forEach(x => hat(M, x, { gain: 0.12 }));
  whoosh(M, 5.55, 0.45, { f0: 400, f1: 5000, gain: 0.32, pan0: 0, pan1: 0 });
  kick(M, 6.0, { gain: 0.9, f0: 120, f1: 40 });

  // C · MAKE
  range(6.0, 6.5, 0.125).forEach((x, i) => hat(M, x, { gain: 0.06 + i * 0.03 }));
  [6.0, 6.06, 6.12].concat(range(6.1, 6.34, 0.03)).forEach((x, i) => tick(M, x, { gain: 0.05, freq: 2600 + i * 180, pan: (i % 2 ? 0.4 : -0.4) }));
  CUE.make.forEach((x, i) => { clack(M, x, { freq: 700 + i * 120, gain: 0.34 }); kick(M, x, { gain: 0.72 }); });
  clack(M, 7.56, { freq: 1100, gain: 0.14 }); clack(M, 8.1, { freq: 1300, gain: 0.14 });
  [8.5, 9.0].forEach(x => kick(M, x, { gain: 0.7 }));
  [6.5, 7.5, 8.5].forEach(x => snare(M, x, { gain: 0.3 }));
  range(6.75, 9.5, 0.5).forEach(x => hat(M, x, { gain: 0.13 }));
  CUE.dotInA.forEach((x, i) => { blip(M, x, { freq: NOTE.C6 * 2, gain: [0.14, 0.06, 0.03][i], rev: 0.3 }); blip(M, x, { freq: 3136, gain: [0.06, 0.03, 0.015][i], dur: 0.04 }); });
  sweep(M, CUE.hop, 0.18, { f0: 300, f1: 1100, gain: 0.14 });
  sweep(M, CUE.hopLand, 0.12, { f0: 240, f1: 90, gain: 0.25 });
  whoosh(M, CUE.lineOut, 0.32, { f0: 1200, f1: 9000, gain: 0.2, pan0: -0.8, pan1: 0.8, q: 2 });
  whoosh(M, CUE.retract, 0.25, { f0: 5000, f1: 500, gain: 0.16 });
  riser(M, 9.5, 0.5, { gain: 0.22, f0: 500 });

  // D · MOTION
  impact(M, CUE.motion, { gain: 0.8 }); crash(M, CUE.motion, { gain: 0.25 });
  range(10.5, 12.0, 0.5).forEach(x => kick(M, x, { gain: 0.78 }));
  [10.5, 11.5].forEach(x => { snare(M, x, { gain: 0.45 }); clap(M, x, { gain: 0.25 }); });
  range(10.0, 12.0, 0.125).forEach((x, i) => hat(M, x, { gain: i % 2 ? 0.1 : 0.05, pan: i % 4 < 2 ? 0.2 : -0.2 }));
  whoosh(M, 10.2, 0.8, { f0: 600, f1: 2500, gain: 0.2, pan0: 0.8, pan1: -0.6 });
  [NOTE.C5, NOTE.D5, NOTE.E5, NOTE.G5, NOTE.A5, NOTE.C6].forEach((f, i) => pluck(M, CUE.letterLand[i], { freq: f, gain: 0.2, pan: 0.6 - i * 0.24 }));
  sweep(M, 11.55, 0.2, { f0: 400, f1: 1500, gain: 0.1, pan: -0.7 });
  riser(M, 11.5, 0.5, { gain: 0.14 });
  kick(M, CUE.slam, { gain: 1 }); snare(M, CUE.slam, { gain: 0.6 }); clap(M, CUE.slam, { gain: 0.5 }); crash(M, CUE.slam, { gain: 0.35 }); impact(M, CUE.slam, { gain: 0.6 });
  whoosh(M, 12.05, 0.4, { f0: 3000, f1: 800, gain: 0.14, pan0: -0.5, pan1: 0.5 });
  range(12.5, 15.75, 0.5).forEach(x => kick(M, x, { gain: 0.8 }));
  [12.5, 13.5].forEach(x => { snare(M, x, { gain: 0.5 }); clap(M, x, { gain: 0.3 }); });
  range(12.0, 14.0, 0.125).forEach((x, i) => hat(M, x, { gain: i % 2 ? 0.11 : 0.05, open: i % 4 === 2, pan: i % 2 ? 0.25 : -0.25 }));
  range(14.0, 15.0, 0.25).concat(range(15.0, 15.5, 0.125), range(15.5, 15.75, 0.0625)).forEach(x =>
    snare(M, x, { gain: 0.16 + 0.42 * seg(x, 14, 15.75), decay: 0.12, rev: 0.12 }));
  range(14.0, 15.75, 0.125).forEach(x => hat(M, x, { gain: 0.08 }));
  riser(M, 14.0, 1.75, { gain: 0.34 });
  tapeStop(M, CUE.collapse, 0.25);

  // E · without — the silence is the sound
  tick(M, 16.0, { gain: 0.12, freq: 900 });
  sweep(M, 16.0, 0.3, { f0: 90, f1: 40, gain: 0.18, rev: 0 });
  air(M, 16.25, 1.1);
  glass(M, CUE.ping, { freq: NOTE.E6, gain: 0.07 });
  CUE.tittle.forEach((x, i) => clack(M, x, { freq: 1800, gain: [0.14, 0.06, 0.03][i] }));
  riser(M, CUE.portal, 0.65, { gain: 0.3, f0: 200 });
  whoosh(M, 17.6, 0.4, { f0: 300, f1: 6000, gain: 0.2, pan0: 0, pan1: 0 });

  // F · CODE
  impact(M, CUE.code, { gain: 0.9 }); glitchBurst(M, CUE.code, 0.22, { gain: 0.22, seed: 3 }); crash(M, CUE.code, { gain: 0.2 });
  whoosh(M, 18.15, 0.3, { f0: 2000, f1: 500, gain: 0.12, pan0: -0.8, pan1: -0.2 });
  whoosh(M, 18.2, 0.3, { f0: 2000, f1: 500, gain: 0.12, pan0: 0.8, pan1: 0.2 });
  range(18.5, 20.0, 0.5).forEach(x => kick(M, x, { gain: 0.75 }));
  [18.5, 19.5].forEach(x => snare(M, x, { gain: 0.4 }));
  range(18.0, 20.0, 0.125).forEach((x, i) => hat(M, x, { gain: i % 2 ? 0.12 : 0.06, crush: true }));
  const rc = mulberry32(11);
  for (let x = 18.4; x < 19.75; x += 1 / 30) {
    const live = CUE.locks.filter(L => L > x).length;
    if (live && rc() < 0.3 + live * 0.12) blip(M, x, { freq: 900 + rc() * 2400, gain: 0.018 * live, dur: 0.015, type: 'square', pan: rc() - 0.5, rev: 0, crush: true });
  }
  [NOTE.E5, NOTE.G5, NOTE.A5, NOTE.C6].forEach((f, i) => { blip(M, CUE.locks[i], { freq: f, gain: 0.14, type: 'square', dur: 0.09, dly: 0 }); tick(M, CUE.locks[i], { gain: 0.1 }); });
  whoosh(M, CUE.slash - 0.02, 0.18, { f0: 9000, f1: 1400, gain: 0.5, pan0: -0.7, pan1: 0.7, q: 1.8 });
  kick(M, CUE.slash, { gain: 1 }); clap(M, CUE.slash, { gain: 0.55 }); impact(M, CUE.slash, { gain: 0.6 });
  glitchBurst(M, CUE.slash, 0.14, { gain: 0.2, seed: 9 });
  for (let i = 0; i < 7; i++) sweep(M, CUE.fall + i * 0.06, 0.4, { f0: 900 - i * 70, f1: 110, gain: 0.1, pan: -0.6 + i * 0.2, type: 'triangle' });
  glitchBurst(M, 20.55, 0.3, { gain: 0.16, seed: 21 });
  kick(M, 21.0, { gain: 0.6 });
  sweep(M, 21.1, 0.4, { f0: 380, f1: 360, gain: 0.05, type: 'triangle' });
  tick(M, CUE.straighten, { gain: 0.14, freq: 2400 });
  whoosh(M, 21.62, 0.3, { f0: 500, f1: 5000, gain: 0.3, pan0: -0.5, pan1: 0.2 });
  whoosh(M, 21.72, 0.3, { f0: 400, f1: 4000, gain: 0.26, pan0: 0.5, pan1: -0.2 });

  // G · the claim
  CUE.final.forEach((x, i) => kick(M, x, { gain: i === 2 ? 1 : 0.85 }));
  [22.0, 22.5].forEach((x, i) => { snare(M, x, { gain: 0.45 }); clack(M, x, { freq: 700 + i * 140, gain: 0.25 }); });
  whoosh(M, 22.9, 0.5, { f0: 800, f1: 3000, gain: 0.26, pan0: 0.8, pan1: -0.3 });
  crash(M, 23.0, { gain: 0.35 }); impact(M, 23.0, { gain: 0.55 });
  glass(M, 23.5, { freq: NOTE.E6, gain: 0.08 });
  snare(M, 24.0, { gain: 0.45 }); glitchBurst(M, 24.0, 0.1, { gain: 0.12, seed: 17 });
  [NOTE.E5, NOTE.G5, NOTE.A5, NOTE.C6].forEach((f, i) => blip(M, 24.0 + i * 0.0625, { freq: f * 2, gain: 0.1, type: 'square', dur: 0.05 }));
  bounceKit(FB, 0.95);
  range(22.0, 26.0, 0.125).forEach((x, i) => hat(M, x, { gain: i % 2 ? 0.1 : 0.045, open: i % 8 === 6 }));
  [23.5, 25.5].forEach(x => clap(M, x, { gain: 0.35 }));
  snare(M, 25.5, { gain: 0.5 }); kick(M, 25.5, { gain: 0.85 });

  // H · the fine print
  whoosh(M, CUE.reflow, 0.8, { f0: 3500, f1: 400, gain: 0.2, pan0: 0.4, pan1: -0.4 });
  kick(M, CUE.reflow, { gain: 0.7 });
  sweep(M, 26.2, 0.7, { f0: 80, f1: 40, gain: 0.2, rev: 0 });
  sproing(M, CUE.asterisk);
  blip(M, CUE.asterisk, { freq: NOTE.G6, gain: 0.12, rev: 0.4 });
  for (let i = 1; i < FN.note.length; i++) {
    if (FN.note[i] === ' ') continue;
    tick(M, CUE.typeStart + i / 48, { gain: 0.045 + 0.03 * rnd(i, 3), freq: 2600 + 1400 * rnd(i, 4), pan: (i / FN.note.length - 0.5) * 0.8 });
  }
  kick(M, CUE.fadeOut, { gain: 0.55, decay: 0.8 });
  glass(M, CUE.fadeOut, { freq: NOTE.E5, gain: 0.11 });
  sweep(M, CUE.fadeOut + 0.45, 0.2, { f0: 1400, f1: 500, gain: 0.07 });
  blip(M, CUE.blink, { freq: NOTE.G6, gain: 0.2, rev: 0.5 });

  // fade the tail so the film ends clean
  M.master.gain.setValueAtTime(0.92, 29.55);
  M.master.gain.linearRampToValueAtTime(0.0001, DUR - 0.01);
}

async function renderSoundtrack() {
  const ctx = new OfflineAudioContext(2, SR * DUR, SR);
  score(buildBus(ctx));
  return ctx.startRendering();
}

function wavBytes(buf) {
  const n = buf.length, ch = buf.numberOfChannels, dv = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const w = (o, s) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); dv.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true);
  dv.setUint32(24, buf.sampleRate, true); dv.setUint32(28, buf.sampleRate * ch * 2, true);
  dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * ch * 2, true);
  const data = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++, o += 2) dv.setInt16(o, clamp(data[c][i], -1, 1) * 32767, true);
  return new Uint8Array(dv.buffer);
}
