// ═══ 3D · type, textures, materials, helpers ═════════════════════
// World units: 1 u = 100 design px on the z = 0 plane of the default camera.
const U = 0.01;
const wx = x => (x - CX) * U, wy = y => (CY - y) * U;
const FOV = 30, CAM_Z = (H * U) / 2 / Math.tan((FOV * Math.PI) / 360); // ≈ 20.15: z = 0 frames exactly 1920×1080 px

// ─── extruded type from the film's own fonts ─────────────────────
const FONT3 = {};
function loadFonts3() {
  for (const [k, b64] of Object.entries(FONT_DATA)) {
    const s = atob(b64), u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    FONT3[k] = opentype.parse(u.buffer);
  }
}
// Merge per-contour extrusions; each contour gets a hair of z offset so overlapping
// contours (variable-font instances keep them) never z-fight.
function mergeGeos(geos) {
  const out = new THREE.BufferGeometry(), attrs = ['position', 'normal', 'uv'];
  const total = geos.reduce((a, g) => a + g.attributes.position.count, 0);
  const arr = {}; attrs.forEach(a => (arr[a] = new Float32Array(total * (a === 'uv' ? 2 : 3))));
  let off = 0;
  const groups = [[], []];
  for (const g of geos) {
    attrs.forEach(a => arr[a].set(g.attributes[a].array, off * (a === 'uv' ? 2 : 3)));
    for (const gr of g.groups) groups[gr.materialIndex].push([gr.start + off, gr.count]);
    off += g.attributes.position.count;
  }
  attrs.forEach(a => out.setAttribute(a, new THREE.BufferAttribute(arr[a], a === 'uv' ? 2 : 3)));
  groups.forEach((list, mi) => list.forEach(([s, c]) => out.addGroup(s, c, mi)));
  return out;
}
const GEO3 = new Map();
function glyph3(fk, ch, size, depth, bevel = 0.035) {
  const key = `${fk}|${ch}|${size}|${depth}|${bevel}`;
  if (GEO3.has(key)) return GEO3.get(key);
  const font = FONT3[fk], gl = font.charToGlyph(ch), cmds = gl.getPath(0, 0, size).commands;
  const sp = new THREE.ShapePath();
  for (const c of cmds) {
    if (c.type === 'M') sp.moveTo(c.x, -c.y);
    else if (c.type === 'L') sp.lineTo(c.x, -c.y);
    else if (c.type === 'Q') sp.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y);
    else if (c.type === 'C') sp.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y);
  }
  const raw = sp.toShapes(false);
  const adv = (gl.advanceWidth * size) / font.unitsPerEm;
  // Union the contours first: variable-font instances keep overlapping pieces, and
  // bevelling those separately leaves seams on the face.
  const ring = pts => { const r = pts.map(p => [p.x, p.y]); if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r.pop(); return r; };
  const polys = raw.map(sh => [ring(sh.getPoints(10)), ...sh.holes.map(h => ring(h.getPoints(10)))]);
  let shapes = raw;
  try {
    const merged = window.polygonClipping && polys.length ? polygonClipping.union(...polys) : null;
    if (merged && merged.length) {
      const v = r => ring(r.map(([x, y]) => ({ x, y }))).map(([x, y]) => new THREE.Vector2(x, y));
      shapes = merged.map(poly => { const sh = new THREE.Shape(v(poly[0])); poly.slice(1).forEach(h => sh.holes.push(new THREE.Path(v(h)))); return sh; });
    }
  } catch (e) { shapes = raw; }
  const geos = shapes.map((s, i) => {
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.7, bevelSegments: 3, curveSegments: 7 });
    g.translate(-adv / 2, 0, -depth / 2 + i * 0.0015);
    return g;
  });
  const out = { geo: geos.length ? mergeGeos(geos) : new THREE.BufferGeometry(), adv, shapes };
  GEO3.set(key, out);
  return out;
}
// A word as a group of letter meshes on a shared baseline; letter origins are advance centres.
function word3(fk, text, size, depth, mats, opts = {}) {
  const font = FONT3[fk], group = new THREE.Group(), letters = [];
  const gs = font.stringToGlyphs(text);
  let x = 0;
  for (let i = 0; i < text.length; i++) {
    const g = glyph3(fk, text[i], size, depth, opts.bevel);
    const mesh = new THREE.Mesh(g.geo, mats);
    mesh.position.x = x + g.adv / 2; mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
    letters.push({ mesh, x, w: g.adv, ch: text[i] });
    const kern = i < text.length - 1 ? (font.getKerningValue(gs[i], gs[i + 1]) * size) / font.unitsPerEm : 0;
    x += g.adv + kern;
  }
  const cap = ((font.tables.os2.sCapHeight || font.ascender * 0.7) * size) / font.unitsPerEm;
  return { group, letters, width: x, cap };
}

// ─── grit: procedural, deterministic textures ────────────────────
function gritCanvas(size, seed, { base = 128, amp = 90, speck = 0.004, scratch = 26, scale = 1 } = {}) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), im = g.createImageData(size, size), r = mulberry32(seed);
  const oct = [[4, 0.5], [9, 0.28], [23, 0.14], [61, 0.08]];
  const grid = oct.map(([n]) => { const a = new Float32Array((n + 1) * (n + 1)); for (let i = 0; i < a.length; i++) a[i] = r(); return a; });
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0;
    oct.forEach(([n, w], k) => {
      const fx = ((x / size) * n * scale) % n, fy = ((y / size) * n * scale) % n, ix = Math.floor(fx), iy = Math.floor(fy);
      const ux = fx - ix, uy = fy - iy, sx = ux * ux * (3 - 2 * ux), sy = uy * uy * (3 - 2 * uy), A = grid[k], N = n + 1;
      const a = A[iy * N + ix], b = A[iy * N + ((ix + 1) % n)], cc = A[((iy + 1) % n) * N + ix], d = A[((iy + 1) % n) * N + ((ix + 1) % n)];
      v += w * (a + (b - a) * sx + (cc - a) * sy + (a - b - cc + d) * sx * sy);
    });
    let p = base + (v - 0.5) * amp * 2 + (r() - 0.5) * 34;
    if (r() < speck) p = r() < 0.5 ? 20 : 235;
    const i = (y * size + x) * 4;
    im.data[i] = im.data[i + 1] = im.data[i + 2] = clamp(p, 0, 255); im.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  g.globalAlpha = 0.18; g.strokeStyle = '#000';
  for (let i = 0; i < scratch; i++) {
    g.lineWidth = 0.5 + r() * 1.4; g.beginPath();
    const x0 = r() * size, y0 = r() * size, a = r() * TAU, L = 20 + r() * 160;
    g.moveTo(x0, y0); g.lineTo(x0 + Math.cos(a) * L, y0 + Math.sin(a) * L); g.stroke();
  }
  return c;
}
function texOf(canvas, repeat = 1) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 4;
  return t;
}
const TX = {};
const M3 = {};
function buildMaterials() {
  TX.grit = texOf(gritCanvas(512, 11), 1);
  TX.gritFine = texOf(gritCanvas(512, 23, { amp: 60, scale: 3, scratch: 10 }), 1);
  TX.floor = texOf(gritCanvas(1024, 5, { amp: 110, speck: 0.008, scratch: 60 }), 6);
  const std = (hex, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: lin(hex), roughness: 0.6, metalness: 0 }, o));
  // letters: face and side can differ; array order = [caps, sides] (ExtrudeGeometry groups)
  M3.chalkFace = std(COL.chalk, { roughness: 0.55, roughnessMap: TX.gritFine, bumpMap: TX.gritFine, bumpScale: 0.012 });
  M3.chalkSide = std('#8d8a86', { roughness: 0.7, roughnessMap: TX.grit, bumpMap: TX.grit, bumpScale: 0.01 });
  M3.chalk = [M3.chalkFace, M3.chalkSide];
  M3.inkFace = std(COL.ink, { roughness: 0.32, roughnessMap: TX.gritFine, bumpMap: TX.gritFine, bumpScale: 0.01 });
  M3.ink = [M3.inkFace, std('#26262e', { roughness: 0.5 })];
  M3.floor = std('#17171c', { roughness: 0.9, roughnessMap: TX.floor, bumpMap: TX.floor, bumpScale: 0.035 });
  M3.paper = std('#e9e5dc', { roughness: 0.95, roughnessMap: TX.floor, bumpMap: TX.floor, bumpScale: 0.02 });
  M3.ultraWall = std('#2d2df5', { roughness: 0.85, roughnessMap: TX.floor, bumpMap: TX.floor, bumpScale: 0.03 });
  M3.glowPink = new THREE.MeshBasicMaterial({ color: hdr(COL.flamingo, 2.4) });
  M3.dotSolid = new THREE.MeshBasicMaterial({ color: hdr(COL.flamingo, 1.05) }); // for light grounds, where a white-hot core would vanish
  M3.glowChalk = new THREE.MeshBasicMaterial({ color: hdr(COL.chalk, 2.2) });
  M3.glowUltra = new THREE.MeshBasicMaterial({ color: hdr('#5a5aff', 3.5) });
  M3.glowButter = new THREE.MeshBasicMaterial({ color: hdr(COL.butter, 3.2) });
  M3.maskWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
}

// ─── small helpers ───────────────────────────────────────────────
function cam3(fov = FOV) { const c = new THREE.PerspectiveCamera(fov, W / H, 0.1, 400); c.position.set(0, 0, CAM_Z); return c; }
function shake3(cam, t, k = 1) {
  const c = camera(t);
  cam.position.x += c.x * U * k; cam.position.y -= c.y * U * k;
  cam.rotation.z += c.r * k;
  cam.fov /= c.z; cam.updateProjectionMatrix(); cam.fov *= c.z;
}
function textPlane(canvas, w, h, mat = {}) {
  const tex = new THREE.CanvasTexture(canvas); tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial(Object.assign({ map: tex, transparent: true, depthWrite: false }, mat)));
  return m;
}
function dotMesh(r, mat = M3.glowPink) { return new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), mat); }
// Scene with fog and a background colour, in linear space.
function world(bgHex, fogNear = 30, fogFar = 90) {
  const s = new THREE.Scene(); s.background = lin(bgHex); s.fog = new THREE.Fog(lin(bgHex), fogNear, fogFar);
  return s;
}
// A mask scene: white shapes on black, rendered with the same camera as the scene it cuts.
function maskScene() { const s = new THREE.Scene(); s.background = new THREE.Color(0); return s; }
