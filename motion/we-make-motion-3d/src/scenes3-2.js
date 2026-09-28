// ═══ 3D · D MOTION — wave, echoes, a marquee with depth ══════════
function rowCanvas(outline) {
  const c = document.createElement('canvas'), f = F.disp(MO.rowSize), u = MO.rowUnit, k = texK();
  c.width = Math.ceil(u * 2 * k); c.height = 200 * k;
  const g = c.getContext('2d'); g.scale(c.width / (u * 2), k);
  g.font = f; g.textBaseline = 'alphabetic';
  const base = 100 + MO.row.asc / 2;
  for (let k = 0; k < 2; k++) {
    const x = k * u;
    if (outline) { g.strokeStyle = '#fff'; g.lineWidth = 5; g.lineJoin = 'round'; g.strokeText('MOTION', x, base); g.globalCompositeOperation = 'destination-out'; g.fillText('MOTION', x, base); g.globalCompositeOperation = 'source-over'; }
    else { g.fillStyle = '#fff'; g.fillText('MOTION', x, base); }
    g.fillStyle = COL.flamingo; g.beginPath(); g.arc(x + MO.row.width + MO.rowGap / 2, base - MO.row.asc / 2, 11, 0, TAU); g.fill();
  }
  return c;
}
// MOTION is extruded 0.8 deep (bevel 0.045) and seen from CAM_Z: give the wave's collision pass that much more room
MO_EXTRUDE.wall = 0.8 / (CAM_Z - 0.8); MO_EXTRUDE.bevel = 2 * 4.5; MO_EXTRUDE.spread = -0.05; // wider gaps, so a tighter start keeps N in frame
onPrep3(() => {
  const s = world(COL.ultra, 26, 70), cam = cam3();
  const Mo = (S3.motion = { s, cam });
  s.add(new THREE.HemisphereLight(lin('#ffffff'), lin('#1a1aa0'), 0.35));
  Mo.key = new THREE.DirectionalLight(lin('#ffffff'), 0.9); Mo.key.position.set(6, 8, 10); Mo.key.castShadow = true;
  Object.assign(Mo.key.shadow.camera, { left: -14, right: 14, top: 9, bottom: -9, near: 1, far: 40 }); Mo.key.shadow.mapSize.set(2048, 1024); s.add(Mo.key);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), M3.ultraWall); floor.rotation.x = -Math.PI / 2; floor.position.y = -4.2; floor.receiveShadow = true; s.add(floor); Mo.floor = floor; // catches the wave's shadows; hidden under the slam, before the marquee
  const back = new THREE.Mesh(new THREE.PlaneGeometry(160, 60), M3.ultraWall); back.position.z = -22; back.receiveShadow = true; s.add(back);
  Mo.all = new THREE.Group(); s.add(Mo.all);
  // the wave: a glowing ribbon whose vertices follow waveY()
  const N = 240;
  Mo.ribbon = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, N, 1), new THREE.MeshBasicMaterial({ color: hdr(COL.chalk, 2.6), side: THREE.DoubleSide }));
  Mo.ribbon.frustumCulled = false; Mo.all.add(Mo.ribbon);
  Mo.faceMat = M3.chalkFace.clone(); Mo.faceMat.emissive = new THREE.Color(0, 0, 0);
  Mo.mats = [Mo.faceMat, M3.chalkSide];
  Mo.word = word3('disp', 'MOTION', MO.size * U, 0.8, Mo.mats, { bevel: 0.045 });
  Mo.all.add(Mo.word.group); Mo.word.group.position.set(0, 0, 0);
  Mo.echo = [];
  for (let k = 1; k <= 5; k++) {
    const m = new THREE.MeshBasicMaterial({ color: hdr(COL.flamingo, 2.4), transparent: true, opacity: 0.42 * (1 - k / 6), depthWrite: false });
    const row = Mo.word.letters.map(L => { const e = new THREE.Mesh(L.mesh.geometry, m); Mo.all.add(e); return e; });
    Mo.echo.push(row);
  }
  Mo.reps = [-2, -1, 1, 2].map(r => { const w = word3('disp', 'MOTION', MO.size * U, 0.8, Mo.mats, { bevel: 0.045 }); Mo.all.add(w.group); return { r, w }; });
  Mo.sep = [-2, -1, 0, 1].map(() => { const d = dotMesh(0.18); Mo.all.add(d); return d; });
  Mo.dot = dotMesh(MAKE_DOT_R * U); Mo.all.add(Mo.dot);
  Mo.dotLight = new THREE.PointLight(lin(COL.flamingo), 6, 8, 2); s.add(Mo.dotLight);
  // marquee rows as textured strips at increasing depth
  const tex = [false, true].map(o => { const t = new THREE.CanvasTexture(rowCanvas(o)); t.wrapS = THREE.RepeatWrapping; t.minFilter = THREE.LinearFilter; t.anisotropy = 4; return t; });
  Mo.rows = [-3, -2, -1, 1, 2, 3].map(k => {
    const t = tex[Math.abs(k) % 2 === 1 ? 1 : 0].clone(); t.needsUpdate = true;
    const z = -2.2 * Math.abs(k), sc = (CAM_Z - z) / CAM_Z;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, color: hdr('#ffffff', 1.25) }));
    m.matrixAutoUpdate = false; Mo.all.add(m);
    return { k, m, t, z, sc };
  });
});

function updateMotion(t) {
  const Mo = S3.motion, cam = Mo.cam;
  const b = Ez.inQuad(seg(t, CUE.build, CUE.collapse)), col = Ez.inQuart(seg(t, CUE.collapse, 16.0));
  // dolly zoom: FOV widens while the camera closes in, so the hero holds size and the world stretches
  const fov = lerp(FOV, 78, b), dist = CAM_Z * Math.tan((FOV * Math.PI) / 360) / Math.tan((fov * Math.PI) / 360);
  cam.fov = fov; cam.position.set(0, lerp(0, 0.4, b), dist); cam.lookAt(0, 0, 0); cam.rotation.z = -0.09 * b * (1 - col);
  shake3(cam, t);
  Mo.all.scale.set(1, 1 - 0.985 * col, 1);
  Mo.floor.visible = t < CUE.slam + 0.02;
  Mo.key.intensity = 0.9 + 0.4 * pulse(t, CUE.slam, 6);

  // ribbon
  const pos = Mo.ribbon.geometry.attributes.position, N = pos.count / 2;
  const half = (W / 2 + 900) * (1 - Ez.outExpo(seg(t, CUE.slam, 12.3)));
  Mo.ribbon.visible = t < 12.3;
  for (let i = 0; i < N; i++) {
    const x = CX - half + (2 * half * i) / (N - 1), y = wy(waveY(x, t));
    pos.setXYZ(i, wx(x), y + 0.03, 0); pos.setXYZ(i + N, wx(x), y - 0.03, 0);
  }
  pos.needsUpdate = true;

  // the surfing dot
  const d = surfDot(t);
  Mo.dot.visible = !!d; Mo.dotLight.intensity = d ? 3 : 0;
  if (d) { Mo.dot.position.set(wx(d.x), wy(d.y), 0); Mo.dotLight.position.set(wx(d.x), wy(d.y), 0.8); }

  // hero letters: ride the wave before the slam, then hold and pulse
  let flash = 0;
  for (let bt = CUE.slam; bt < CUE.collapse && bt <= t; bt += BEAT) flash = Math.max(flash, pulse(t, bt, 11) * (bt >= CUE.build ? 1 : 0.55));
  Mo.faceMat.emissive.copy(hdr(COL.flamingo, 1.6)).multiplyScalar(flash);
  const pre = t < CUE.slam;
  Mo.word.letters.forEach((L, i) => {
    if (pre) { const c = moLetter(i, t); L.mesh.position.set(wx(c.x) - Mo.word.group.position.x, wy(c.y), 0); L.mesh.rotation.set(0, 0, -c.r); }
    else { L.mesh.position.set(wx(MO.x) + L.x + L.w / 2, wy(MO.base), 0); L.mesh.rotation.set(0, 0, 0); }
  });
  const s = pre ? 1 : 1 + 0.12 * (1 - spring(t - CUE.slam, 0.32, 3.2));
  const oc = moLook(MO.XC, t) * U;
  Mo.word.group.scale.setScalar(s); Mo.word.group.position.x = pre ? 0 : oc;
  Mo.echo.forEach((row, k) => row.forEach((e, i) => {
    const a = moLetter(i, t - (k + 1) * 0.028), c = moLetter(i, t);
    e.visible = pre && Math.abs(a.x - c.x) > 3;
    e.position.set(wx(a.x), wy(a.y), -0.25 * (k + 1)); e.rotation.set(0, 0, -a.r);
  }));
  const repOn = t >= CUE.build;
  Mo.reps.forEach(({ r, w }) => {
    w.group.visible = repOn; w.group.scale.setScalar(s);
    w.group.position.set(oc + r * MO.heroUnit * U, 0, 0);
    w.letters.forEach(L => L.mesh.position.set(wx(MO.x) + L.x + L.w / 2, wy(MO.base), 0));
  });
  Mo.sep.forEach((dm, j) => { dm.visible = repOn; dm.position.set(wx(MO.x + MO.lay.width + 220) + oc + (j - 2) * MO.heroUnit * U, wy(MO.base - MO.cap / 2), 0); });

  // marquee strips: blinds open, scroll on the beat, shear with speed
  const unitW = MO.rowUnit * U, v = moLook(MO.V, t);
  const Mx = new THREE.Matrix4(), Sh = new THREE.Matrix4();
  Mo.rows.forEach(({ k, m, t: tex, z, sc }) => {
    const rev = Ez.outExpo(seg(t, 12.05 + (Math.abs(k) - 1) * 0.09, 12.55 + (Math.abs(k) - 1) * 0.09));
    m.visible = t >= CUE.slam && rev > 0;
    if (!m.visible) return;
    const dir = (k > 0 ? 1 : -1) * (Math.abs(k) % 2 ? 1 : -1), mult = 1 + 0.18 * (Math.abs(k) - 1);
    const off = dir * moLook(MO.X, t) * mult + k * 211;
    const yc = CY + Math.sign(k) * [0, 188, 342, 496][Math.abs(k)];
    const w = 60 * sc, h = 2.0 * sc * rev;
    tex.repeat.x = w / (2 * unitW * sc); tex.offset.x = -off / (2 * MO.rowUnit);
    const shear = -dir * 0.35 * clamp((v * mult) / 3500);
    Sh.set(1, shear, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
    Mx.makeTranslation(0, wy(yc) * sc, z).multiply(Sh).multiply(new THREE.Matrix4().makeScale(w, h, 1));
    m.matrix.copy(Mx);
  });
}

// ═══ 3D · E without — fog, a thin serif, a flight through the o ══
onPrep3(() => {
  const s = world('#EFEBE3', 14, 46), cam = cam3();
  const Wo = (S3.without = { s, cam });
  s.add(new THREE.HemisphereLight(lin('#ffffff'), lin('#cfc8bb'), 0.55));
  const key = new THREE.DirectionalLight(lin('#fff4ea'), 0.8); key.position.set(-4, 6, 8); s.add(key);
  const size = 230 * U;
  Wo.mats = [];
  Wo.word = word3('serif', 'wıthout', size, 0.26, null, { bevel: 0.012 });
  Wo.word.letters.forEach(L => { const m = [M3.inkFace.clone(), M3.ink[1].clone()]; m.forEach(x => (x.transparent = true)); L.mesh.material = m; Wo.mats.push(m); });
  Wo.word.group.position.set(wx(WO.x), wy(WO.y), 0); s.add(Wo.word.group);
  Wo.line = new THREE.Mesh(new THREE.BoxGeometry(1, 0.04, 0.04), new THREE.MeshBasicMaterial({ color: lin(COL.ink) })); s.add(Wo.line);
  Wo.dot = dotMesh(WO.tit.r * 1.15 * U, M3.dotSolid); s.add(Wo.dot);
  Wo.dotLight = new THREE.PointLight(lin(COL.flamingo), 2.5, 3, 2); s.add(Wo.dotLight);
  // the o's counter, as a matte shape in its own scene
  const o = Wo.word.letters[4], hole = glyph3('serif', 'o', size, 0.26, 0.012).shapes[0].holes[0];
  Wo.mask = maskScene();
  const hm = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(hole.getPoints(48))), M3.maskWhite);
  hm.geometry.translate(-o.w / 2, 0, 0);
  hm.position.set(wx(WO.x) + o.x + o.w / 2, wy(WO.y), 0.16); Wo.mask.add(hm);
  hm.geometry.computeBoundingBox(); const bb = hm.geometry.boundingBox;
  Wo.hole = new THREE.Vector3((bb.min.x + bb.max.x) / 2 + hm.position.x, (bb.min.y + bb.max.y) / 2 + hm.position.y, 0.16);
});

function updateWithout(t) {
  const Wo = S3.without, cam = Wo.cam;
  // the flight: drift, then accelerate through the counter of the o
  const pp = seg(t, CUE.portal, 18.0), drift = seg(t, 16.3, CUE.portal), target = Wo.hole;
  // exponential approach: the o's counter grows at a steady rate and fills the frame on the cut
  const d0 = lerp(CAM_Z, CAM_Z * 0.95, drift) - target.z, dist = d0 * Math.pow(0.3 / d0, Ez.inSine(pp));
  const aim = Ez.inOutCubic(seg(t, CUE.portal, 17.7));
  cam.position.set(lerp(lerp(0.3, -0.2, drift), target.x, aim), lerp(0, target.y, aim), target.z + dist);
  cam.fov = FOV; cam.lookAt(lerp(0, target.x, aim), lerp(0, target.y, aim), target.z - 5);
  const hl = 1 - Ez.inOutExpo(seg(t, 16.0, 16.32));
  Wo.line.visible = hl > 0; Wo.line.scale.x = Math.max((W + 200) * U * hl, 1e-3);
  Wo.word.letters.forEach((L, i) => {
    const st = 16.3 + i * 0.09, a = Ez.outSine(seg(t, st, st + 0.55)), trk = woTrack(i, t) * U;
    L.mesh.visible = a > 0;
    L.mesh.position.set(L.x + L.w / 2 + trk, 24 * (1 - Ez.outQuint(seg(t, st, st + 0.7))) * U * -1, -5 * (1 - Ez.outQuint(seg(t, st, st + 0.8))));
    Wo.mats[i].forEach(m => (m.opacity = a));
  });
  const d = woDot(t);
  Wo.dot.visible = !!d; Wo.dotLight.intensity = d ? 1.2 : 0;
  if (d) {
    Wo.dot.position.set(wx(d.x), wy(d.y + d.r * (1 - d.sy)), 0); Wo.dot.scale.set(1 / d.sy, d.sy, 1 / d.sy);
    Wo.dotLight.position.set(wx(d.x), wy(d.y), 0.5);
  }
}

// ═══ 3D · F CODE — a field of source, extruded brackets, a blade ═
function codeLayer(seed) {
  const c = document.createElement('canvas'), k = texK(); c.width = 2048 * k; c.height = 1152 * k;
  const g = c.getContext('2d'); g.scale(k, k); g.font = F.mono(24); g.textAlign = 'left';
  if (seed > 0) g.filter = 'blur(1px)'; // deeper layers a touch softer
  const cw = textW(F.mono(24), 'M');
  for (let j = 0; j < 30; j++) {
    const src = CD.lines[(j + seed) % CD.lines.length], y = 40 + j * 37;
    g.fillStyle = 'rgba(241,239,233,0.35)'; g.fillText(String(((j + seed) % CODE_SRC.length) + 1).padStart(2, '0'), 20, y);
    for (const tk of src) { g.fillStyle = tk.c; g.fillText(tk.v, 80 + tk.col * cw, y); }
  }
  const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter; t.anisotropy = 4;
  return t;
}
const CD_G = 0.93;
onPrep3(() => {
  const s = world(COL.ink, 12, 44), cam = cam3();
  const Cd = (S3.code = { s, cam });
  s.add(new THREE.HemisphereLight(lin('#a0a0ff'), lin('#000000'), 0.25));
  Cd.key = new THREE.SpotLight(lin('#ffffff'), 2.2, 50, 0.5, 0.6, 1.2); Cd.key.position.set(-5, 8, 12); s.add(Cd.key, Cd.key.target);
  Cd.clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 20);
  Cd.layers = [[-3, 0.4, 0], [-8, 0.16, 7], [-15, 0.08, 13]].map(([z, k, seed]) => {
    const sc = 1 + 0.45 * ((CAM_Z - z) / CAM_Z - 1); // only part-compensated, so deeper layers read smaller and finer
    const m = new THREE.Mesh(new THREE.PlaneGeometry(20.48 * sc, 11.52 * sc), new THREE.MeshBasicMaterial({ map: codeLayer(seed), transparent: true, depthWrite: false, color: hdr('#ffffff', 1.3 * k), clippingPlanes: [Cd.clip] }));
    m.position.z = z; s.add(m); return { m, z, sc, k };
  });
  Cd.faceMat = M3.chalkFace; Cd.brMat = [new THREE.MeshStandardMaterial({ color: lin(COL.butter), emissive: hdr(COL.butter, 1.4), roughness: 0.4 }), new THREE.MeshStandardMaterial({ color: lin('#b8952e'), roughness: 0.5 })];
  // each glyph hangs in a group pivoting at its cap-height centre, so it tumbles in place
  // glyphs a touch under the 2D size: the bevel and the closer camera would otherwise close the gaps
  Cd.slots = [...'<CODE/>'].map((ch, i) => {
    const m = new THREE.Mesh(glyph3('mono', ch, CD_G * 240 * U, 0.5, 0.03).geo, i === 0 || i >= 5 ? Cd.brMat : M3.chalk);
    m.castShadow = true; m.position.y = -(CD_G * CD.cap * U) / 2;
    const g = new THREE.Group(); g.add(m); s.add(g); return { g, m };
  });
  Cd.hl = [1, 2, 3, 4].map(() => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, (CD.cap + 44) * U, 0.05), new THREE.MeshBasicMaterial({ color: hdr(COL.butter, 2.6) })); m.visible = false; s.add(m); return m; });
  Cd.caret = new THREE.Mesh(new THREE.BoxGeometry(CD.adv * 0.42 * U, (CD.cap + 20) * U, 0.3), M3.glowButter); s.add(Cd.caret);
  Cd.blade = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.12), new THREE.MeshBasicMaterial({ color: hdr(COL.flamingo, 2.6) })); s.add(Cd.blade);
  Cd.bladeLight = new THREE.PointLight(lin(COL.flamingo), 0, 12, 2); s.add(Cd.bladeLight);
});

function updateCode(t) {
  const Cd = S3.code, cam = Cd.cam;
  const push = Ez.outCubic(seg(t, 17.35, 19)), dr = seg(t, 18, 22);
  cam.position.set(lerp(-0.8, 0.8, dr), lerp(-0.4, 0.3, dr), lerp(CAM_Z * 1.35, CAM_Z * 0.97, push) - 0.8 * dr);
  cam.fov = FOV; cam.lookAt(0, 0, 0); shake3(cam, t);
  Cd.clip.constant = lerp(-12, 12, Ez.outCubic(seg(t, CUE.code, 18.5)));
  Cd.layers.forEach(({ m, z, sc, k }, i) => {
    const fall = t > CUE.fall + 0.05 ? 0.5 * 42 * (t - CUE.fall - 0.05 - i * 0.12) ** 2 * (t - CUE.fall - 0.05 - i * 0.12 > 0) : 0;
    m.position.set([0.35, 0.7, -0.5][i], [0, 0.19, 0.11][i] + 0.38 * [1, 0.55, 0.3][i] * (t - CUE.code) * sc - fall * sc, z);
    m.material.opacity = 1 - seg(t, CUE.fall + 0.3 + i * 0.1, CUE.fall + 0.8 + i * 0.1);
  });
  Cd.hl.forEach(h => (h.visible = false));
  for (let i = 0; i < 7; i++) {
    const { g, m } = Cd.slots[i], sl = codeSlot(i, t);
    g.visible = !!sl;
    if (!sl) continue;
    if (i >= 1 && i <= 4) m.geometry = glyph3('mono', sl.ch, CD_G * 240 * U, 0.5, 0.03).geo;
    const d = Math.max(0, t - (CUE.fall + i * 0.06));
    // fan out from the centre and split in depth, so no two falling glyphs share a path
    const split = [0, 0, 0.9, -0.6, 0.5, 0, 0][i] * Ez.outCubic(seg(t, CUE.fall, CUE.fall + 0.12));
    g.position.set(wx(CD.x + CD.adv * (i + 0.5) + sl.ox) + (i - 3) * 1.8 * d, wy(CD.y - CD.cap / 2 + sl.oy), 3.2 * d * d + split);
    const damp = i === 3 ? 0.5 : 1;
    g.rotation.set(sl.rot * 0.8 * damp, sl.rot * 0.6 * damp, -sl.rot); g.scale.setScalar(sl.pop);
    if (i >= 1 && i <= 4 && t < CUE.fall) { // selection highlight wipes off at full strength
      const L = CUE.locks[i - 1] + 0.03, out = Ez.inOutCubic(seg(t, L + 0.05, L + 0.3)), h = Cd.hl[i - 1];
      if (t >= L && out < 1) {
        const w = CD.adv * U, x0 = wx(CD.x + CD.adv * i);
        h.visible = true; h.scale.x = w * (1 - out); h.position.set(x0 + w * out + (w * (1 - out)) / 2, wy(CD.y - CD.cap / 2), -0.4);
      }
    }
  }
  Cd.caret.visible = t > 18.4 && t < CUE.slash && (t % BEAT) < BEAT / 2;
  Cd.caret.position.set(wx(CD.x + CD.adv * 7 + 14 + CD.adv * 0.21), wy(CD.y - CD.cap / 2), 0);
  // the blade
  const sp = Ez.outExpo(seg(t, CUE.slash, 20.14));
  Cd.blade.visible = sp > 0; Cd.bladeLight.intensity = sp > 0 ? 4 : 0;
  if (sp > 0) {
    const x0 = CD.x - 50, x1 = CD.x + CD.adv * 7 + 50, full = (x1 - x0) * U;
    const st = Ez.outBack(seg(t, CUE.straighten, 21.72), 1.4), rot = lerp(-0.05 + 0.025 * wobble(t - 20.14, 2.5, 1.4), 0, st);
    const grow = Ez.inOutExpo(seg(t, CUE.wipe2, 21.9));
    const y = lerp(wy(CD.y - CD.cap * 0.45), 0, st);
    const len = grow > 0 ? lerp(full, 40, grow) : full * sp, th = lerp(0.3, 16, grow);
    Cd.blade.scale.set(len, th, 1); Cd.blade.rotation.z = -rot;
    Cd.blade.position.set(wx(x0) + (grow > 0 ? full / 2 : len / 2), y, 0.3);
    Cd.blade.material.color.copy(hdr(COL.flamingo, lerp(2.6, 1, grow)));
    Cd.bladeLight.position.set(0, y, 2);
  }
}
