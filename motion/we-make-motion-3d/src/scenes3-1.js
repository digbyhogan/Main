// ═══ 3D · A THE DROP + B WE — one dark concrete world ════════════
const S3 = {};
const PREP3 = [];
const onPrep3 = fn => PREP3.push(fn);
const FLOOR_Y = wy(FLOOR);
const M4 = new THREE.Matrix4(), V3 = new THREE.Vector3(), Q4 = new THREE.Quaternion(), SC = new THREE.Vector3();

onPrep3(() => {
  const s = world(COL.ink, 18, 58), cam = cam3();
  const D = (S3.dark = { s, cam });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), M3.floor);
  floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR_Y; floor.receiveShadow = true; s.add(floor);
  s.add(new THREE.HemisphereLight(lin('#9090b8'), lin('#000000'), 0.1));
  D.key = new THREE.SpotLight(lin('#fff0e0'), 0, 60, 0.42, 0.7, 1.2);
  D.key.position.set(-7, 11, 9); D.key.castShadow = true; D.key.shadow.mapSize.set(1024, 1024); D.key.shadow.bias = -0.0005;
  s.add(D.key, D.key.target);
  D.rim = new THREE.PointLight(lin(COL.flamingo), 0, 40, 2); D.rim.position.set(5, 4, -7); s.add(D.rim);
  D.dot = dotMesh(DOT_R * U); s.add(D.dot);
  D.dotLight = new THREE.PointLight(lin(COL.flamingo), 5, 8, 2); s.add(D.dotLight);
  D.rings = CUE.bounces.map(() => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 128), new THREE.MeshBasicMaterial({ color: hdr(COL.chalk, 2.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.position.y = FLOOR_Y + 0.004; s.add(m); return m;
  });
  D.gline = new THREE.Mesh(new THREE.BoxGeometry(1, 0.012, 0.012), new THREE.MeshBasicMaterial({ color: hdr(COL.chalk, 2), transparent: true }));
  D.gline.position.y = FLOOR_Y + 0.006; s.add(D.gline);
  D.cells = [0, 1, 2, 3].map(() => { const m = dotMesh(1); s.add(m); return m; });
  D.necks = [0, 1, 2].map(() => { const m = dotMesh(1); s.add(m); return m; });

  // WE stands on the floor; particles land on its front face
  D.we = word3('disp', 'WE', WE.size * U, 1.0, M3.chalk, { bevel: 0.05 });
  D.weDy = FLOOR_Y - wy(WE.y) + 0.001;
  D.we.group.position.set(wx(WE.x), wy(WE.y) + D.weDy, 0); s.add(D.we.group);
  const zf = 0.5 + 0.05 + 0.01;
  const pg = new THREE.SphereGeometry(0.045, 8, 6);
  const cold = WE.parts.filter(p => !p.hot), hot = WE.parts.filter(p => p.hot);
  D.pCold = new THREE.InstancedMesh(pg, new THREE.MeshBasicMaterial({ color: hdr(COL.chalk, 1.7) }), cold.length);
  D.pHot = new THREE.InstancedMesh(pg, new THREE.MeshBasicMaterial({ color: hdr(COL.flamingo, 3) }), hot.length);
  D.pCold.userData.parts = cold; D.pHot.userData.parts = hot;
  for (const m of [D.pCold, D.pHot]) { m.frustumCulled = false; s.add(m); }
  WE.parts.forEach((p, i) => { p.zs = (rnd(i, 71) - 0.5) * 9; p.zf = zf; });
  D.burst = new THREE.PointLight(lin(COL.flamingo), 0, 14, 2); D.burst.position.set(0, 1.2, 2); s.add(D.burst);
});

function partPos3(p, t) {
  const [x, y] = partPos(p, t);
  const e = Ez.inOutCubic(seg(t, p.s, p.s + 0.75)), b = Ez.outExpo(seg(t, CUE.burst, 3.4));
  const dy = S3.dark.weDy * Ez.inOutCubic(seg(t, CUE.burst, p.s + 0.75));
  return V3.set(wx(x), wy(y) + dy, lerp(0, p.zs, b) * (1 - e) + p.zf * e);
}

function updateDark(t) {
  const D = S3.dark, cam = D.cam;
  // camera: low dolly for the drop, then frontal, then a slow orbit around WE
  const a = Ez.inOutSine(seg(t, CUE.weLock, 5.9)) * 0.24;
  const f = Ez.inOutCubic(seg(t, 2.0, 3.1));
  const R = lerp(lerp(16.5, 15.2, Ez.outCubic(seg(t, 0, 2))), lerp(CAM_Z * 0.93, CAM_Z * 0.86, seg(t, CUE.weLock, 6)), f);
  cam.position.set(Math.sin(a) * R, lerp(lerp(0.9, 0.55, seg(t, 0, 2)), 1.1, f), Math.cos(a) * R);
  cam.fov = FOV; cam.lookAt(0, lerp(-0.35, 0.9, f), 0);
  shake3(cam, t);

  D.key.intensity = lerp(0, 2.6, Ez.inOutSine(seg(t, 1.0, 4.0))) + 2.5 * pulse(t, CUE.weLock, 4);
  D.rim.intensity = lerp(0, 3, seg(t, 2.5, 4.2));
  D.burst.intensity = 14 * pulse(t, CUE.burst, 5) + 10 * pulse(t, CUE.weLock, 5);

  // the dot
  D.dot.visible = t < CUE.burst;
  let dx = 0, dy = 0;
  if (t < 2) {
    const d = dropDot(t);
    if (d) { dx = wx(d.x); dy = wy(d.y); D.dot.position.set(dx, dy, 0); D.dot.scale.set(d.sx * (d.r / DOT_R), d.sy * (d.r / DOT_R), d.sx * (d.r / DOT_R)); }
    else D.dot.visible = false;
  } else {
    const e = Ez.outCubic(seg(t, 2.0, 2.25)), r = lerp(DOT_R, 26, e) / DOT_R;
    dy = lerp(wy(REST_Y), 0, e); D.dot.position.set(0, dy, 0); D.dot.scale.setScalar(r);
    D.dot.visible = t < CUE.split1;
  }
  D.dotLight.position.set(dx, dy, 0.4); D.dotLight.intensity = t < CUE.burst ? 3.2 : 0;

  // ripples and ground line
  const str = [1, 0.6, 0.35, 0.2, 0.1];
  CUE.bounces.forEach((bt, i) => {
    const p = seg(t, bt, bt + 0.8), m = D.rings[i];
    m.visible = p > 0 && p < 1;
    if (m.visible) { const rx = (30 + 300 * str[i] * Ez.outExpo(p)) * U; m.scale.set(rx, rx * 0.999, 1); m.material.opacity = str[i] * (1 - p); }
  });
  const gl = Ez.outExpo(seg(t, 1.0, 1.7)) * 7.6;
  D.gline.visible = gl > 0.01 && t < 2.4; D.gline.scale.x = Math.max(gl, 0.001); D.gline.material.opacity = 1 - seg(t, 1.6, 2.4);

  // mitosis
  const cellOn = t >= CUE.split1 && t < CUE.burst;
  D.cells.forEach(c => (c.visible = false)); D.necks.forEach(c => (c.visible = false));
  if (cellOn) {
    const d1 = 44 * Ez.outBack(seg(t, CUE.split1, 2.42), 2) * U, d2 = 40 * Ez.outBack(seg(t, CUE.split2, 2.67), 2) * U;
    const r = lerp(26, 20, seg(t, CUE.split2, 2.75)) * U;
    const quad = t >= CUE.split2;
    const pts = quad ? [[-d1, d2], [d1, d2], [-d1, -d2], [d1, -d2]] : [[-d1, 0], [d1, 0]];
    pts.forEach(([x, y], i) => { const c = D.cells[i]; c.visible = true; c.position.set(x, y, 0); c.scale.setScalar(r); });
    const n1 = 1 - seg(t, CUE.split1, 2.37), n2 = 1 - seg(t, CUE.split2, 2.62);
    if (n1 > 0) { const n = D.necks[0]; n.visible = true; n.position.set(0, 0, 0); n.scale.set(d1, r * n1 * 0.9, r * n1 * 0.9); }
    if (quad && n2 > 0) [-1, 1].forEach((sx, k) => { const n = D.necks[k + 1]; n.visible = true; n.position.set(sx * d1, 0, 0); n.scale.set(r * n2 * 0.9, d2, r * n2 * 0.9); });
  }

  // particles
  const pa = 1 - seg(t, 3.98, 4.14);
  for (const m of [D.pCold, D.pHot]) {
    m.visible = t >= CUE.burst && pa > 0;
    if (!m.visible) continue;
    const r = (0.4 + 0.6 * seg(t, CUE.burst, 3.0)) * (1 + 0.9 * seg(t, 3.98, 4.14)) * pa;
    m.userData.parts.forEach((p, i) => { partPos3(p, t); M4.makeScale(r, r, r).setPosition(V3); m.setMatrixAt(i, M4); });
    m.instanceMatrix.needsUpdate = true;
  }

  // the solid word: extrudes out of the particle sheet, then crouches and leaves
  const sa = seg(t, 3.96, 4.04);
  D.we.group.visible = sa > 0;
  if (sa > 0) {
    const ext = Math.max(0.02, spring(t - 3.97, 0.45, 2.6));
    D.we.letters.forEach((L, j) => {
      const ls = CUE.weLaunch + j * 0.06;
      const squash = 0.1 * Ez.outQuad(seg(t, CUE.weSquash, CUE.weLaunch)) * (1 - seg(t, ls, ls + 0.08));
      const fly = Ez.inQuart(seg(t, ls, ls + 0.38)), stretch = 1 + 0.6 * seg(t, ls, ls + 0.25);
      const sy = (1 - squash) * stretch, sx = 1 / Math.sqrt(sy);
      L.mesh.scale.set(sx, sy, ext * sx);
      L.mesh.position.y = fly * 16;
      L.mesh.rotation.x = -0.35 * fly;
    });
  }
}

// ═══ 3D · C MAKE — glossy ink tubes on a paper wall ══════════════
onPrep3(() => {
  const s = world('#ECE8DF', 30, 80), cam = cam3();
  const K = (S3.make = { s, cam });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 34), M3.paper); wall.position.z = -0.62; wall.receiveShadow = true; s.add(wall);
  s.add(new THREE.HemisphereLight(lin('#ffffff'), lin('#bdb6a8'), 0.62));
  K.key = new THREE.DirectionalLight(lin('#fff6ea'), 1.15); K.key.position.set(-5, 7, 9); K.key.castShadow = true;
  Object.assign(K.key.shadow.camera, { left: -11, right: 11, top: 7, bottom: -7, near: 1, far: 30 }); K.key.shadow.mapSize.set(2048, 1024);
  K.key.shadow.radius = 4; K.key.shadow.bias = -0.0004; s.add(K.key);
  const r = MK.sw / 2 * U;
  K.cyl = new THREE.CylinderGeometry(r, r, 1, 40, 1, true); K.ball = new THREE.SphereGeometry(r, 40, 24);
  K.pool = { cyl: [], ball: [] }; K.used = { cyl: 0, ball: 0 };
  K.letterMat = M3.ink;
  // blueprint grid: emissive ultramarine hairlines on the wall
  K.grid = [];
  const gm = new THREE.MeshBasicMaterial({ color: hdr('#4a4aff', 1.6), transparent: true });
  [MK.top, 540, MK.base].forEach((y, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.018), gm); m.position.set(0, wy(y), -0.6); s.add(m); K.grid.push({ m, h: true, s: CUE.grid + i * 0.06 }); });
  MK.boxes.flat().forEach((x, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.018, 1), gm); m.position.set(wx(x), 0, -0.6); s.add(m); K.grid.push({ m, h: false, s: CUE.grid + 0.1 + i * 0.03 }); });
  // specimen labels
  const lab = document.createElement('canvas'); lab.width = 1920; lab.height = 1080;
  K.labCanvas = lab; K.lab = textPlane(lab, W * U, H * U, { color: hdr('#4a4aff', 1.4) }); K.lab.position.z = -0.59; s.add(K.lab);
  K.dot = dotMesh(MAKE_DOT_R * U, M3.dotSolid); s.add(K.dot);
  K.dotLight = new THREE.PointLight(lin(COL.flamingo), 6, 7, 2); s.add(K.dotLight);
  K.bar = new THREE.Mesh(K.cyl, new THREE.MeshStandardMaterial({ color: lin(COL.ink), roughness: 0.3, emissive: new THREE.Color(0, 0, 0) }));
  K.bar.castShadow = true; s.add(K.bar);
  K.barCaps = [new THREE.Mesh(K.ball, K.bar.material), new THREE.Mesh(K.ball, K.bar.material)]; K.barCaps.forEach(c => s.add(c));
});

function tubePiece(kind) {
  const K = S3.make, list = K.pool[kind];
  if (K.used[kind] >= list.length) {
    const m = new THREE.Mesh(kind === 'cyl' ? K.cyl : K.ball, K.letterMat); m.castShadow = true; m.receiveShadow = true;
    K.s.add(m); list.push(m);
  }
  const m = list[K.used[kind]++]; m.visible = true; return m;
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
function segMesh(ax, ay, bx, by, xform) {
  _a.set(wx(ax), wy(ay), 0).applyMatrix4(xform); _b.set(wx(bx), wy(by), 0).applyMatrix4(xform);
  const c = tubePiece('cyl'), L = _a.distanceTo(_b);
  c.position.copy(_a).add(_b).multiplyScalar(0.5); c.scale.set(1, Math.max(L, 1e-4), 1);
  c.quaternion.setFromUnitVectors(_up, _b.clone().sub(_a).normalize());
}
function ballAt(x, y, xform) { const b = tubePiece('ball'); b.position.set(wx(x), wy(y), 0).applyMatrix4(xform); }
// Draw a polyline as capsules from fraction a to b of its length (the 3D twin of polyPartial).
function polyTube(p, a, b, xform) {
  if (b <= a) return;
  const L = polyLen(p), A = a * L, B = b * L;
  let acc = 0;
  for (let i = 1; i < p.length; i++) {
    const [x0, y0] = p[i - 1], [x1, y1] = p[i], l = Math.hypot(x1 - x0, y1 - y0);
    const s0 = clamp((A - acc) / l), s1 = clamp((B - acc) / l);
    if (s1 > s0) {
      const ax = lerp(x0, x1, s0), ay = lerp(y0, y1, s0), bx = lerp(x0, x1, s1), by = lerp(y0, y1, s1);
      segMesh(ax, ay, bx, by, xform); ballAt(ax, ay, xform); ballAt(bx, by, xform);
    }
    acc += l;
  }
}

function updateMake(t) {
  const K = S3.make, cam = K.cam;
  const d = Ez.inOutSine(seg(t, 5.6, 10));
  cam.position.set(lerp(-1.6, 1.4, d), lerp(-0.9, 0.5, d), CAM_Z * lerp(0.98, 0.9, d));
  cam.fov = FOV; cam.lookAt(0, 0, 0); shake3(cam, t);
  const fade = 1 - seg(t, 9.4, 9.7);
  K.grid.forEach(({ m, h, s }) => {
    const e = Ez.outExpo(seg(t, s, s + 0.6));
    m.visible = e > 0.001 && fade > 0; m.material.opacity = fade;
    if (h) m.scale.x = Math.max(e * 26, 1e-3); else m.scale.y = Math.max(e * 14, 1e-3);
  });
  const g = K.labCanvas.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
  g.fillStyle = '#fff'; g.font = F.mono(15); g.textAlign = 'left';
  [['CAP 360', MK.top], ['MID 540', 540], ['BASE 720', MK.base]].forEach(([s, y], i) => g.fillText(typeSlice(s, t, 6.2 + i * 0.08, 30), 40, y - 10));
  g.textAlign = 'right'; g.fillText(typeSlice('4 GLYPHS · 13 SEGMENTS · 1 DOT', t, 6.6, 40), 1721, 300);
  g.textAlign = 'left'; g.fillText(typeSlice('STROKE 76', t, 6.9, 30), 199, 800);
  K.lab.material.map.needsUpdate = true; K.lab.material.opacity = fade;

  // strokes as capsules
  for (const k of ['cyl', 'ball']) { K.pool[k].forEach(m => (m.visible = false)); K.used[k] = 0; }
  const X = new THREE.Matrix4();
  MK.strokes.forEach(([pts, s, dur, li]) => {
    const on = Ez.outQuart(seg(t, s, s + dur));
    const off = Ez.inQuart(seg(t, CUE.retract + li * 0.05, CUE.retract + li * 0.05 + 0.24));
    if (on <= 0) return;
    const [bx0, bx1] = MK.boxes[li], k = 1 + 0.05 * wobble(t - CUE.make[li] - 0.25, 5, 2.4);
    const cx = wx((bx0 + bx1) / 2), cy = wy(MK.base);
    X.makeTranslation(cx, cy, 0).multiply(new THREE.Matrix4().makeScale(1 / k, k, 1)).multiply(new THREE.Matrix4().makeTranslation(-cx, -cy, 0));
    polyTube(pts, off, on, X);
  });
  // E's crossbar: drawn on, then stretched into a glowing horizon
  const mOn = Ez.outQuart(seg(t, 8.1, 8.32)), ext = Ez.outExpo(seg(t, CUE.lineOut, 9.65));
  K.bar.visible = mOn > 0; K.barCaps.forEach(c => (c.visible = mOn > 0));
  if (mOn > 0) {
    const x0 = lerp(1489, -600, ext), x1 = lerp(1489 + (1650 - 1489) * mOn, W + 600, ext), th = lerp(1, 0.08, seg(t, 9.4, 9.9));
    K.bar.position.set(wx((x0 + x1) / 2), wy(540), 0); K.bar.scale.set(th, (x1 - x0) * U, th); K.bar.rotation.z = Math.PI / 2;
    K.barCaps[0].position.set(wx(x0), wy(540), 0); K.barCaps[1].position.set(wx(x1), wy(540), 0); K.barCaps.forEach(c => c.scale.setScalar(th));
    K.bar.material.emissive.copy(hdr(COL.chalk, 2.2)).multiplyScalar(seg(t, 9.3, 9.8));
  }
  const dm = makeDot(t);
  K.dot.visible = !!dm;
  if (dm) {
    const ride = 34 * seg(t, 9.4, 9.9);
    K.dot.position.set(wx(dm.x), wy(dm.y + ride), 0.05);
    K.dot.scale.set(dm.sx, dm.sy, dm.sx); K.dot.rotation.z = -dm.rot;
    K.dotLight.position.set(wx(dm.x), wy(dm.y + ride), 0.9);
  }
  K.dotLight.intensity = dm ? 1.3 : 0;
}
// Where a world point lands on screen, in design px (for 2D-drawn mattes that follow 3D things).
function toScreen(v, cam) { const p = v.clone().project(cam); return [(p.x * 0.5 + 0.5) * W, (0.5 - p.y * 0.5) * H]; }
