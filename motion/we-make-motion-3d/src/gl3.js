// ═══ 3D · renderer, render targets and the post chain ════════════
// scene A ─┐
// scene B ─┼─ matte (noise-edged, glowing seam) ─ HDR ─ bloom ─ grade ─┐
// mask   ──┘                                                          ├─ accumulate (motion blur) ─ finish (grain, dust, weave)
//                                                             HUD ────┘
const G3 = { w: 0, h: 0 };
const lin = hex => new THREE.Color(hex).convertSRGBToLinear();
const hdr = (hex, k) => lin(hex).multiplyScalar(k);

const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
const NOISE = `
  float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  // precision-safe hash for large coordinates (grain): scales down before fract, so no striping at 4K
  float hashF(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
  float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p *= 2.03; a *= .5; } return s; }`;

function passMat(fs, uniforms, extra = {}) {
  return new THREE.ShaderMaterial(Object.assign({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false }, extra));
}

function initGL(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  r.setPixelRatio(1);
  r.localClippingEnabled = true;
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.outputEncoding = THREE.LinearEncoding; r.toneMapping = THREE.NoToneMapping;
  G3.r = r; G3.canvas = canvas;
  G3.qs = new THREE.Scene(); G3.qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  G3.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); G3.quad.frustumCulled = false; G3.qs.add(G3.quad);

  G3.matte = passMat(`${NOISE}
    uniform sampler2D tA, tB, tM; uniform float useMatte, edgeW, edgeNoise, seed; uniform vec3 edgeGlow; uniform vec2 res; varying vec2 vUv;
    void main(){
      vec3 a = texture2D(tA, vUv).rgb;
      if (useMatte < .5) { gl_FragColor = vec4(a, 1.); return; }
      vec3 b = texture2D(tB, vUv).rgb;
      float m = texture2D(tM, vUv).r;
      vec2 p = vUv * vec2(1920., 1080.) / 70.; // frame-relative, so the torn edge looks the same at any resolution
      float k = m + (fbm(p + seed) - .5) * edgeNoise;
      float mm = smoothstep(.5 - edgeW, .5 + edgeW, k);
      float e = exp(-pow((k - .5) / (edgeW * 2.2 + 1e-4), 2.)) * smoothstep(0., .12, m * (1. - m)); // glow only where the matte is in transition
      gl_FragColor = vec4(mix(a, b, mm) + edgeGlow * e * (.45 + .9 * fbm(p * 2.7 - seed)), 1.);
    }`, { tA: { value: null }, tB: { value: null }, tM: { value: null }, useMatte: { value: 0 }, edgeW: { value: 0.04 },
    edgeNoise: { value: 0.5 }, seed: { value: 0 }, edgeGlow: { value: new THREE.Vector3() }, res: { value: new THREE.Vector2() } });

  G3.bright = passMat(`uniform sampler2D t; uniform float thr, knee; varying vec2 vUv;
    void main(){ vec3 c = texture2D(t, vUv).rgb; float br = max(c.r, max(c.g, c.b));
      float s = clamp(br - thr + knee, 0., 2. * knee); s = s * s / (4. * knee + 1e-4);
      gl_FragColor = vec4(c * max(s, br - thr) / max(br, 1e-4), 1.); }`,
    { t: { value: null }, thr: { value: 1.35 }, knee: { value: 0.35 } });
  G3.down = passMat(`uniform sampler2D t; uniform vec2 px; varying vec2 vUv;
    void main(){ vec2 h = px * .5; vec3 s = texture2D(t, vUv).rgb * 4.;
      s += texture2D(t, vUv - h).rgb + texture2D(t, vUv + h).rgb + texture2D(t, vUv + vec2(h.x, -h.y)).rgb + texture2D(t, vUv - vec2(h.x, -h.y)).rgb;
      gl_FragColor = vec4(s / 8., 1.); }`, { t: { value: null }, px: { value: new THREE.Vector2() } });
  G3.up = passMat(`uniform sampler2D t, tPrev; uniform vec2 px; uniform float addPrev; varying vec2 vUv;
    void main(){ vec2 h = px * .5; vec3 s = vec3(0.);
      s += texture2D(t, vUv + vec2(-h.x * 2., 0.)).rgb + texture2D(t, vUv + vec2(h.x * 2., 0.)).rgb;
      s += texture2D(t, vUv + vec2(0., -h.y * 2.)).rgb + texture2D(t, vUv + vec2(0., h.y * 2.)).rgb;
      s += (texture2D(t, vUv + vec2(-h.x, h.y)).rgb + texture2D(t, vUv + vec2(h.x, h.y)).rgb + texture2D(t, vUv + vec2(h.x, -h.y)).rgb + texture2D(t, vUv + vec2(-h.x, -h.y)).rgb) * 2.;
      gl_FragColor = vec4(s / 12. + addPrev * texture2D(tPrev, vUv).rgb, 1.); }`,
    { t: { value: null }, tPrev: { value: null }, px: { value: new THREE.Vector2() }, addPrev: { value: 0 } });
  G3.grade = passMat(`${NOISE}
    uniform sampler2D tHdr, tBloom, tHud; uniform float bloomK, exposure, ca, vig, glitch, gSeed, hudOn, lift; uniform vec3 tint; varying vec2 vUv;
    // hue-preserving tone curve: linear up to .8, soft shoulder above, hot cores go white
    vec3 tone(vec3 c){
      float L = max(dot(c, vec3(.2126, .7152, .0722)), 1e-5);
      float Lm = L < .8 ? L : .8 + .2 * (1. - exp(-(L - .8) / .2));
      c *= Lm / L;
      float m = max(c.r, max(c.g, c.b));
      return m > 1. ? mix(c / m, vec3(1.), clamp((m - 1.) / 2.5, 0., 1.)) : c;
    }
    void main(){
      vec2 uv = vUv;
      if (glitch > 0.) {
        float row = floor(uv.y * 46.), r = hash(vec2(row, gSeed));
        if (r < .5 * glitch) uv.x += (hash(vec2(row, gSeed + 7.)) - .5) * .16 * glitch;
      }
      vec2 d = uv - .5; float k = ca + glitch * .012;
      vec3 c = vec3(texture2D(tHdr, uv + d * k).r, texture2D(tHdr, uv).g, texture2D(tHdr, uv - d * k).b);
      c += texture2D(tBloom, uv).rgb * bloomK;
      c = tone(c * exposure) * tint;
      c = c * (1. - lift) + lift * .06;
      c *= 1. - vig * dot(d, d) * 1.7;
      c = pow(max(c, 0.), vec3(1. / 2.2));
      vec4 h = texture2D(tHud, vUv); c = mix(c, h.rgb, h.a * hudOn);
      gl_FragColor = vec4(c, 1.);
    }`, { tHdr: { value: null }, tBloom: { value: null }, tHud: { value: null }, bloomK: { value: 0.8 }, exposure: { value: 1 },
    ca: { value: 0.002 }, vig: { value: 0.35 }, glitch: { value: 0 }, gSeed: { value: 0 }, hudOn: { value: 1 }, lift: { value: 0.02 },
    tint: { value: new THREE.Vector3(1, 1, 1) } });
  G3.acc = passMat('uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(t, vUv).rgb, 1.); }',
    { t: { value: null } }, { blending: THREE.AdditiveBlending, transparent: true });
  G3.finish = passMat(`${NOISE}
    uniform sampler2D t; uniform float gain, time, grain, dust; uniform vec2 res, weave; varying vec2 vUv;
    void main(){
      // film finish in design pixels (1920×1080), so grain, dust, scratches and weave look the same at any
      // output size; at 4K each grain cell covers 2×2 pixels, and a downscale reproduces the 1080p grain
      const vec2 D = vec2(1920., 1080.);
      vec2 uv = vUv + weave / D;
      vec3 c = texture2D(t, uv).rgb * gain;
      vec2 px = vUv * D;
      float l = dot(c, vec3(.299, .587, .114));
      float n = (hashF(floor(px) + fract(time * 7.13) * 917.) - .5) + (hashF(floor(px * .5) + fract(time * 3.1) * 331.) - .5) * .6;
      c += n * grain * (.45 + .75 * (1. - l));
      // dust: sparse specks on a coarse grid, new every frame
      vec2 cell = floor(px / 26.), f = fract(px / 26.) - .5;
      float hsel = hash(cell + floor(time * 24.) * 17.3);
      if (hsel > 1. - dust * .0012) { float rr = .05 + .18 * hash(cell * 3.1); float dd = smoothstep(rr, rr * .4, length(f + (hash(cell + 3.) - .5) * .5)); c = mix(c, vec3(hash(cell + 9.) > .5 ? .92 : .03), dd * .8); }
      // a rare vertical scratch
      float sx = hash(vec2(floor(time * 24.), 4.)); if (sx < dust * .12) { float x = hash(vec2(floor(time * 24.), 5.)); float w = abs(vUv.x - x) * D.x; c = mix(c, vec3(.85), smoothstep(1.2, 0., w) * .35 * step(hash(vec2(floor(px.y / 40.), floor(time * 24.))), .8)); }
      gl_FragColor = vec4(clamp(c, 0., 1.), 1.);
    }`, { t: { value: null }, gain: { value: 1 }, time: { value: 0 }, grain: { value: 0.05 }, dust: { value: 0.5 },
    res: { value: new THREE.Vector2() }, weave: { value: new THREE.Vector2() } });

  // 2D-drawn mattes (wipes, irises) reuse the film's canvas helpers at quarter resolution
  G3.maskCanvas = document.createElement('canvas'); G3.maskCanvas.width = W / 4; G3.maskCanvas.height = H / 4;
  G3.maskTex = new THREE.CanvasTexture(G3.maskCanvas); G3.maskTex.minFilter = THREE.LinearFilter; G3.maskTex.generateMipmaps = false;
  G3.maskQS = new THREE.Scene();
  const mq = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: G3.maskTex }));
  mq.frustumCulled = false; G3.maskQS.add(mq);
  G3.hudCanvas = document.createElement('canvas');
  G3.hudTex = new THREE.CanvasTexture(G3.hudCanvas);
  G3.hudTex.minFilter = THREE.LinearFilter; G3.hudTex.generateMipmaps = false;
}

// Canvas textures are drawn in design pixels; at larger outputs they are allocated k× bigger so text stays crisp.
const texK = () => Math.max(1, Math.min(2, (G3.h || H) / H));
function rtOf(w, h, type = THREE.HalfFloatType) {
  return new THREE.WebGLRenderTarget(w, h, { type, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false });
}
function msrtOf(w, h) {
  const t = new THREE.WebGLMultisampleRenderTarget(w, h, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  t.samples = 4; return t;
}
function sizeGL(w, h) {
  if (G3.w === w && G3.h === h) return;
  for (const k of ['A', 'B', 'M', 'mS', 'mB', 'hdrT', 'frame', 'accT']) if (G3[k]) G3[k].dispose();
  (G3.mips || []).forEach(m => { m.a.dispose(); m.b.dispose(); });
  G3.w = w; G3.h = h; G3.r.setSize(w, h, false);
  G3.A = msrtOf(w, h); G3.B = msrtOf(w, h); G3.M = msrtOf(w, h);
  G3.mS = rtOf(w >> 2, h >> 2); G3.mB = rtOf(w >> 2, h >> 2);
  G3.hdrT = rtOf(w, h); G3.frame = rtOf(w, h); G3.accT = rtOf(w, h);
  G3.mips = [];
  // bloom keeps the same reach relative to the frame at any size: above 1080p the pyramid gains
  // finer levels (built, so the bright pass never skips pixels) that are left out of the glow sum
  G3.bSkip = Math.max(0, Math.round(Math.log2(h / H)));
  for (let i = 1; i <= 6 + G3.bSkip; i++) { const mw = Math.max(1, w >> i), mh = Math.max(1, h >> i); G3.mips.push({ a: rtOf(mw, mh), b: rtOf(mw, mh), w: mw, h: mh }); }
  G3.hudCanvas.width = w; G3.hudCanvas.height = h;
  G3.matte.uniforms.res.value.set(w, h); G3.finish.uniforms.res.value.set(w, h);
}
function pass(mat, target, clear = true) {
  G3.quad.material = mat; G3.r.setRenderTarget(target);
  G3.r.autoClear = clear; G3.r.render(G3.qs, G3.qc); G3.r.autoClear = true;
}
// Soften a rendered matte so the noise can bite into its edge.
function blurMask(soft) {
  G3.down.uniforms.t.value = G3.M.texture; G3.down.uniforms.px.value.set(1 / G3.w, 1 / G3.h);
  pass(G3.down, G3.mS);
  let src = G3.mS, dst = G3.mB;
  for (let i = 0; i < soft; i++) {
    G3.down.uniforms.t.value = src.texture; G3.down.uniforms.px.value.set(((1 + i) * G3.w) / W / G3.mS.width, ((1 + i) * G3.h) / H / G3.mS.height);
    pass(G3.down, dst); [src, dst] = [dst, src];
  }
  return src.texture;
}
function bloom(src) {
  const m = G3.mips;
  G3.bright.uniforms.t.value = src; pass(G3.bright, m[0].a);
  for (let i = 1; i < m.length; i++) {
    G3.down.uniforms.t.value = m[i - 1].a.texture; G3.down.uniforms.px.value.set(1 / m[i - 1].w, 1 / m[i - 1].h);
    pass(G3.down, m[i].a);
  }
  for (let i = m.length - 1; i > G3.bSkip; i--) {
    const from = i === m.length - 1 ? m[i].a : m[i].b;
    G3.up.uniforms.t.value = from.texture; G3.up.uniforms.tPrev.value = m[i - 1].a.texture;
    G3.up.uniforms.px.value.set(1 / m[i].w, 1 / m[i].h); G3.up.uniforms.addPrev.value = 1;
    pass(G3.up, m[i - 1].b);
  }
  return m[G3.bSkip].b.texture;
}

// One sub-frame: scenes → matte → bloom → grade, into G3.frame.
function renderShot(S) {
  const r = G3.r;
  if (S.a.pre) S.a.pre();
  r.setRenderTarget(G3.A); r.render(S.a.scene, S.a.cam);
  const U = G3.matte.uniforms;
  U.tA.value = G3.A.texture; U.useMatte.value = 0;
  if (S.b) {
    if (S.b.pre) S.b.pre();
    r.setRenderTarget(G3.B); r.render(S.b.scene, S.b.cam);
    r.setRenderTarget(G3.M);
    if (S.maskDraw) {
      const g = G3.maskCanvas.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, W / 4, H / 4);
      g.setTransform(0.25, 0, 0, 0.25, 0, 0); S.maskDraw(g);
      G3.maskTex.needsUpdate = true; r.render(G3.maskQS, G3.qc);
    } else r.render(S.mask.scene, S.mask.cam);
    U.tB.value = G3.B.texture; U.tM.value = blurMask(S.soft ?? 2); U.useMatte.value = 1;
    U.edgeW.value = S.edgeW ?? 0.05; U.edgeNoise.value = S.edgeNoise ?? 0.6; U.seed.value = S.seed ?? 0;
    const e = S.edgeGlow || [0, 0, 0]; U.edgeGlow.value.set(e[0], e[1], e[2]);
  }
  pass(G3.matte, G3.hdrT);
  const B = bloom(G3.hdrT.texture);
  const Gr = G3.grade.uniforms;
  Gr.tHdr.value = G3.hdrT.texture; Gr.tBloom.value = B; Gr.tHud.value = G3.hudTex;
  Gr.bloomK.value = S.bloom ?? 0.8; Gr.exposure.value = S.exposure ?? 1; Gr.ca.value = S.ca ?? 0.002;
  Gr.vig.value = S.vig ?? 0.35; Gr.glitch.value = S.glitch ?? 0; Gr.gSeed.value = S.gSeed ?? 0; Gr.lift.value = S.lift ?? 0.02;
  Gr.hudOn.value = S.hud ?? 1;
  pass(G3.grade, G3.frame);
}
