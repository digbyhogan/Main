// ═══ 3D · G THE CLAIM + H THE FINE PRINT — lit, cast, swept ══════
onPrep3(() => {
  const s = world(COL.ultra, 30, 80), cam = cam3();
  const Cl = (S3.claim = { s, cam });
  s.add(new THREE.HemisphereLight(lin('#ffffff'), lin('#1a1aa0'), 0.5));
  Cl.wall = new THREE.Mesh(new THREE.PlaneGeometry(80, 44), M3.ultraWall); Cl.wall.position.z = -0.9; Cl.wall.receiveShadow = true; s.add(Cl.wall);
  Cl.key = new THREE.SpotLight(lin('#fff4ea'), 1.5, 60, 0.9, 1, 1.1);
  Cl.key.position.set(-4, 5, 14); Cl.key.castShadow = true; Cl.key.shadow.mapSize.set(2048, 2048); Cl.key.shadow.bias = -0.0004; Cl.key.shadow.radius = 3;
  s.add(Cl.key, Cl.key.target);
  Cl.sweep = new THREE.SpotLight(lin('#ffffff'), 0, 40, 0.16, 0.8, 1.4); Cl.sweep.position.set(0, 3, 12); s.add(Cl.sweep, Cl.sweep.target);
  const fk = ['disp', 'disp', 'disp', 'serif', 'mono'], depth = [0.5, 0.5, 0.8, 0.3, 0.5];
  Cl.words = FN.words.map((w, i) => {
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const mats = M3.chalk.map(m => { const c = m.clone(); c.clippingPlanes = [plane]; c.clipShadows = true; c.transparent = true; return c; });
    const w3 = word3(fk[i], w.str, w.size * U, depth[i], mats, { bevel: i === 3 ? 0.012 : 0.035 });
    w3.group.position.set(wx(w.x), wy(w.y), 0); s.add(w3.group);
    return { w, w3, plane, mats };
  });
  Cl.hl = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.05), new THREE.MeshBasicMaterial({ color: hdr(COL.butter, 2.6) })); m.visible = false; s.add(m); return m; });
  Cl.dot = dotMesh(1, M3.glowPinkSoft); s.add(Cl.dot);
  Cl.dotLight = new THREE.PointLight(lin(COL.flamingo), 0, 9, 2); s.add(Cl.dotLight);
  const r = 1, cyl = new THREE.CylinderGeometry(r, r, 1, 24, 1, true), ball = new THREE.SphereGeometry(r, 24, 16);
  Cl.arms = [0, 1, 2, 3, 4, 5].map(() => { const c = new THREE.Mesh(cyl, M3.glowPink), b = new THREE.Mesh(ball, M3.glowPink); s.add(c, b); return { c, b }; });
  const nc = document.createElement('canvas'); nc.width = 1920 * texK(); nc.height = 80 * texK();
  Cl.noteCanvas = nc; Cl.note = textPlane(nc, W * U, 0.8); Cl.note.position.set(0, wy(700) + 0.12, 0.1); s.add(Cl.note);
});

const SIDE_INK = lin('#2a2930');
function updateClaim(t, inkMode) {
  const Cl = S3.claim, cam = Cl.cam;
  const d = Ez.inOutSine(seg(t, 21.8, 30));
  cam.position.set(lerp(1.2, -0.6, d), lerp(0.6, -0.2, d), CAM_Z * lerp(0.94, 0.9, d)); cam.fov = FOV; cam.lookAt(0, 0, 0); shake3(cam, t);
  Cl.s.background = lin(inkMode ? COL.ink : COL.ultra); Cl.s.fog.color = Cl.s.background;
  Cl.wall.visible = !inkMode;
  const sw = seg(t, 24.4, 26.2);
  Cl.sweep.intensity = 4.5 * Math.sin(Math.PI * sw); Cl.sweep.target.position.set(lerp(-11, 11, Ez.inOutSine(sw)), 0, 0);
  Cl.key.intensity = inkMode ? 1.0 : 1.5;
  Cl.words.forEach(({ mats }) => mats[1].color.copy(inkMode ? SIDE_INK : M3.chalkSide.color)); // dark walls on ink, so the extrusion can't read as a second copy
  const out = 1 - seg(t, CUE.fadeOut + 0.25, CUE.fadeOut + 0.6);

  Cl.words.forEach(({ w, w3, plane, mats }, i) => {
    const t0 = CUE.final[i];
    w3.group.visible = t >= t0 - 0.15 && out > 0.001;
    if (i !== 3) mats.forEach(m => (m.opacity = out)); // the whole line fades together
    plane.constant = 1e3; // no clip unless a reveal needs it
    w3.letters.forEach((L, k) => { L.mesh.position.set(L.x + L.w / 2, 0, 0); L.mesh.scale.set(1, 1, 1); L.mesh.rotation.set(0, 0, 0); L.mesh.visible = true; });
    if (t < CUE.reflow) {
      w3.group.position.set(wx(w.x), wy(w.y), 0); w3.group.scale.setScalar(1);
      if (i <= 1) { // rise through a matte at the baseline; released once risen so shadows return
        if (t < t0 + (w3.letters.length - 1) * 0.035 + 0.55) plane.constant = -wy(w.y) + 0.04;
        w3.letters.forEach((L, k) => { const e = Ez.outExpo(seg(t, t0 + k * 0.035, t0 + k * 0.035 + 0.55)); L.mesh.position.y = -(1 - e) * (w.lay.asc + 40) * U; });
      } else if (i === 2) { // slides in hot, stretched by its own speed
        w3.letters.forEach((L, k) => { const e = Ez.outExpo(seg(t, t0 + k * 0.03, t0 + k * 0.03 + 0.7)); L.mesh.position.x += (1 - e) * (1700 + k * 120) * U; L.mesh.scale.x = 1 + 0.8 * (1 - e); L.mesh.visible = e > 0; });
      } else if (i === 3) { // whispered in from the depth
        w3.letters.forEach((L, k) => { const a = Ez.outSine(seg(t, t0 + k * 0.04, t0 + k * 0.04 + 0.45)); L.mesh.position.z = -3 * (1 - a); L.mesh.visible = a > 0.01; });
        mats.forEach(m => (m.opacity = Ez.outSine(seg(t, t0, t0 + 0.7))));
      } else { // decoded
        w3.letters.forEach((L, k) => {
          const lock = t0 + k * 0.0625;
          L.mesh.visible = t >= t0 - 0.12 + k * 0.02;
          L.mesh.geometry = glyph3('mono', t < lock ? scr(t, k + 20) : L.ch, w.size * U, 0.5, 0.035).geo;
          const out2 = Ez.inOutCubic(seg(t, lock + 0.05, lock + 0.3)), h = Cl.hl[k]; // wipes off at full strength
          h.visible = t >= lock && out2 < 1;
          h.scale.set(L.w * (1 - out2), (w.lay.asc + 28) * U, 1); h.position.set(wx(w.x) + L.x + L.w * out2 + (L.w * (1 - out2)) / 2, wy(w.y) + (w.lay.asc / 2) * U, -0.35);
        });
      }
    } else { // FLIP reflow into one line: shrink in place, then travel
      const f = reflowOf(w, i, t);
      w3.group.position.set(wx(f.x), wy(f.y), 0);
      w3.group.scale.setScalar(f.s);
      if (i === 3) mats.forEach(m => (m.opacity = out));
      if (i === 4) w3.letters.forEach(L => (L.mesh.geometry = glyph3('mono', L.ch, w.size * U, 0.5, 0.035).geo));
      Cl.hl.forEach(h => (h.visible = false));
    }
  });

  // the dot: full stop → asterisk → home → gone
  let x, y, r, vis = true;
  if (t < CUE.reflow) { const f = finDot(t); vis = !!f; if (f) { x = f.x; y = f.y; r = f.r; Cl.dot.scale.set(f.sx * r * U, f.sy * r * U, f.sx * r * U); } }
  else {
    const rd = reflowDot(t), up = -30 * Ez.outBack(seg(t, CUE.asterisk, 27.5), 2);
    x = rd.x; y = rd.y + up; r = rd.r;
    const home = Ez.inOutCubic(seg(t, CUE.fadeOut + 0.2, CUE.fadeOut + 0.65));
    x = lerp(x, CX, home); y = lerp(y, CY, home); r = lerp(r, DOT_R, home);
  }
  const popOut = Ez.inBack(seg(t, 29.7, 29.85), 2.5), retract = 1 - Ez.inBack(seg(t, CUE.fadeOut + 0.45, CUE.fadeOut + 0.65));
  Cl.dot.visible = vis && popOut < 1; Cl.dotLight.intensity = Cl.dot.visible ? (inkMode ? 1.1 : 3) : 0; // on ink it only needs to warm the faces
  Cl.dot.material = inkMode ? M3.glowPink : M3.glowPinkSoft; // pink on ultramarine, glowing on ink
  if (vis) {
    const core = t >= CUE.reflow ? r * (1 - popOut) * lerp(1, 0.62, seg(t, CUE.asterisk, 27.4) * retract) : null;
    Cl.dot.position.set(wx(x), wy(y), 0.1); if (core !== null) Cl.dot.scale.setScalar(Math.max(core, 1e-3) * U);
    Cl.dotLight.position.set(wx(x), wy(y), 0.9);
  }
  const spin = 0.4 * Ez.outCubic(seg(t, CUE.asterisk, 28.4)) + 0.25 * Math.max(0, t - CUE.asterisk);
  Cl.arms.forEach(({ c, b }, k) => {
    const L = 2.6 * r * spring(t - CUE.asterisk - k * 0.025, 0.4, 3) * retract * (1 - popOut) * U;
    c.visible = b.visible = L > 0.004 && vis;
    if (!c.visible) return;
    const a = -Math.PI / 2 + (k * Math.PI) / 3 + spin, rr = r * 0.52 * U;
    c.position.set(wx(x) + (Math.cos(a) * L) / 2, wy(y) - (Math.sin(a) * L) / 2, 0.1); c.scale.set(rr, L, rr); c.rotation.set(0, 0, -a - Math.PI / 2);
    b.position.set(wx(x) + Math.cos(a) * L, wy(y) - Math.sin(a) * L, 0.1); b.scale.setScalar(rr);
  });

  // the fine print
  const typed = typeSlice(FN.note, t, CUE.typeStart, 48);
  Cl.note.visible = typed.length > 0;
  if (typed.length) {
    const g = Cl.noteCanvas.getContext('2d'), nx = CX - FN.noteW / 2;
    const nk = Cl.noteCanvas.width / 1920; g.setTransform(nk, 0, 0, nk, 0, 0); g.clearRect(0, 0, 1920, 80);
    g.font = FN.noteFont; g.textAlign = 'left';
    g.fillStyle = COL.flamingo; g.fillText('*', nx, 50);
    g.fillStyle = 'rgba(241,239,233,0.9)'; g.fillText(typed.slice(1), nx + textW(FN.noteFont, '*'), 50);
    if (t < CUE.fadeOut && (t % BEAT) < BEAT / 2) { g.fillStyle = COL.flamingo; g.fillRect(nx + textW(FN.noteFont, typed) + 6, 28, 12, 28); }
    Cl.note.material.map.needsUpdate = true;
    Cl.note.material.opacity = 1 - seg(t, CUE.fadeOut + 0.35, CUE.fadeOut + 0.7);
  }
}

// ═══ The director: which worlds, which matte, which look ═════════
const view = (w) => ({ scene: w.s, cam: w.cam });
function shot(t) {
  const base = { bloom: 0.55, exposure: 1.0, ca: 0.0022, vig: 0.4, glitch: glitchAmt(t) * 0.8, gSeed: Math.floor(t * 30), seed: t * 0.7, grain: 0.05, dust: 0.6 };
  if (t < CUE.wipe1) {
    updateDark(t);
    return Object.assign(base, { a: view(S3.dark), bloom: 0.7, dust: 0.9 });
  }
  if (t < CUE.grid) {
    updateDark(t); updateMake(t);
    return Object.assign(base, { a: view(S3.dark), b: view(S3.make), maskDraw: g => liquidWipe(g, seg(t, CUE.wipe1, CUE.grid), '#fff', 1), edgeGlow: [3.2, 2.2, 0.7], edgeW: 0.06, soft: 2 });
  }
  if (t < 9.7) { updateMake(t); return Object.assign(base, { a: view(S3.make), bloom: 0.45, dust: 0.35, vig: 0.3 }); }
  if (t < 10.0) {
    updateMake(t); updateMotion(t);
    const [sx, sy] = toScreen(S3.make.dot.position, S3.make.cam), rad = 2300 * Ez.inOutQuart(seg(t, CUE.iris, 10.0));
    return Object.assign(base, { a: view(S3.make), b: view(S3.motion), edgeGlow: [0.9, 0.9, 4.5], edgeW: 0.05, soft: 2,
      maskDraw: g => { g.fillStyle = '#fff'; g.beginPath(); g.arc(sx, sy, Math.max(rad, 0.1), 0, TAU); g.fill(); } });
  }
  if (t < 16) {
    updateMotion(t);
    const b = seg(t, CUE.build, CUE.collapse);
    return Object.assign(base, { a: view(S3.motion), bloom: 0.55 + 0.6 * b + 0.3 * pulse(t, CUE.slam, 6) + 1.5 * seg(t, 15.8, 16), exposure: 1 + 0.08 * pulse(t, CUE.slam, 8), ca: 0.0022 + 0.006 * b });
  }
  if (t < CUE.portal) { updateWithout(t); return Object.assign(base, { a: view(S3.without), bloom: 0.4, dust: 0.3, vig: 0.28, lift: 0 }); }
  if (t < 18) {
    updateWithout(t); updateCode(t);
    return Object.assign(base, { a: view(S3.without), b: view(S3.code), mask: { scene: S3.without.mask, cam: S3.without.cam }, soft: 1, edgeW: 0.05, edgeNoise: 0.7, edgeGlow: [5, 1.4, 2.4], dust: 0.3 });
  }
  if (t < CUE.wipe2 + 0.1) { updateCode(t); return Object.assign(base, { a: view(S3.code), bloom: 0.7, dust: 0.9 }); }
  if (t < 22) {
    updateCode(t); updateClaim(t, false);
    const u = Ez.inOutExpo(seg(t, CUE.wipe2 + 0.1, CUE.final[0])) * 1400;
    return Object.assign(base, { a: view(S3.code), b: view(S3.claim), edgeGlow: [1, 1, 5], edgeW: 0.05, soft: 2, maskDraw: g => { g.fillStyle = '#fff'; g.fillRect(-200, CY - u / 2, W + 400, u); } });
  }
  const cl = view(S3.claim);
  if (t >= CUE.curtain && t < CUE.curtain + 0.65) {
    return Object.assign(base, { a: Object.assign({}, cl, { pre: () => updateClaim(t, false) }), b: Object.assign({}, cl, { pre: () => updateClaim(t, true) }),
      maskDraw: g => liquidWipe(g, seg(t, CUE.curtain, CUE.curtain + 0.65), '#fff', -1), edgeGlow: [4, 1.2, 2], edgeW: 0.06, soft: 2 });
  }
  updateClaim(t, t >= CUE.curtain + 0.65);
  return Object.assign(base, { a: Object.assign({}, cl), bloom: t >= CUE.curtain + 0.65 ? 0.75 : 0.55, dust: t >= CUE.curtain + 0.65 ? 0.8 : 0.5 });
}

// ═══ Frame loop ═════════════════════════════════════════════════
function hud3(t) {
  const c = G3.hudCanvas, g = c.getContext('2d'), s = c.width / W;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height);
  g.setTransform(s, 0, 0, s, 0, 0);
  makeLabels(g, t);
  // in CODE the source layers run under the HUD corners: lay a soft ink scrim behind the text
  const sa = seg(t, 18.3, 18.55) * (1 - seg(t, 21.4, 21.6));
  if (sa > 0) for (const [y0, y1] of [[0, 130], [H, H - 120]]) {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, `rgba(17,17,22,${0.88 * sa})`); gr.addColorStop(1, 'rgba(17,17,22,0)');
    g.fillStyle = gr; g.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0));
  }
  hud(g, t);
  G3.hudTex.needsUpdate = true;
}
function renderFrame3(t, samples = 1, shutter = 0.5) {
  t = clamp(t, 0, DUR - 1e-4);
  FT = t; // typing is discrete: every sub-frame agrees on how many characters are out
  hud3(t);
  const r = G3.r;
  r.setRenderTarget(G3.accT); r.setClearColor(0x000000, 1); r.clear();
  let S = null;
  for (let k = 0; k < samples; k++) {
    const tk = clamp(samples > 1 ? t + ((k + 0.5) / samples - 0.5) * (shutter / FPS) : t, 0, DUR - 1e-4);
    S = shot(tk);
    renderShot(S);
    G3.acc.uniforms.t.value = G3.frame.texture; pass(G3.acc, G3.accT, false);
  }
  const Fu = G3.finish.uniforms;
  Fu.t.value = G3.accT.texture; Fu.gain.value = 1 / samples; Fu.time.value = t;
  Fu.grain.value = S.grain; Fu.dust.value = S.dust;
  Fu.weave.value.set(noise1(t * 24, 31) * 0.45, noise1(t * 24, 32) * 0.45);
  pass(G3.finish, null);
  FT = null;
}
