// ═══ 3D · PLAYER ═════════════════════════════════════════════════
const SCENES3 = [
  { t: 0, mark: 'Drop', name: 'The drop', motion: 'A glowing dot carries its own light down onto raw concrete. The floor only exists where it lands.', sound: 'The same accelerating bounce fill as the 2D cut.' },
  { t: 2, mark: 'We', name: 'WE', motion: 'Mitosis in 3D, a swarm scattered in depth, then a word that extrudes its own thickness on a spring while the camera orbits.', sound: 'Plucks, sparkles, the lock.' },
  { t: 6, mark: 'Make', name: 'MAKE', motion: 'A liquid matte with a glowing seam opens onto a paper wall. Letters are drawn as glossy ink capsules that cast real shadows.', sound: 'Tuned woodblock clacks.' },
  { t: 10, mark: 'Motion', name: 'MOTION', motion: 'An iris matte from the dot. Extruded letters ride a glowing ribbon and leave echoes in depth. Then a dolly zoom stretches a marquee world.', sound: 'Groove, arpeggio, roll, tape stop.' },
  { t: 16, mark: 'Without', name: 'without', motion: 'A thin Bodoni surfacing out of fog. The o’s counter becomes a matte into the next scene, and the camera flies through it.', sound: 'Near silence and one glass ping.' },
  { t: 18, mark: 'Code', name: 'CODE', motion: 'Three depths of the film’s own source code. Extruded brackets glow butter; the letters decode, are cut by a flamingo blade, and tumble toward the lens.', sound: 'Glitches, locks, slash, bloops.' },
  { t: 22, mark: 'Claim', name: 'The claim', motion: 'Words rise through clipping-plane mattes at their baselines. A spotlight sweeps the lockup and its shadows cross the gritty wall.', sound: 'Five hits and the bounce fill again.' },
  { t: 26, mark: 'Footnote', name: 'The fine print', motion: 'The same world rendered in two looks and joined by a noise-edged curtain. The full stop grows six glowing arms.', sound: 'Sproing, typewriter, final blip.' },
];
const PRINCIPLES3 = [
  [0.15, 2.0, 'Motivated light', 'The dot carries its own light; the concrete only exists where it lands.'],
  [2.75, 3.96, 'Depth parallax', 'Particles scatter in z, then flatten onto the letters’ face.'],
  [3.96, 4.3, 'Extrusion as a reveal', 'The word grows its depth on a spring.'],
  [4.3, 5.5, 'Orbit', 'A slow camera arc proves it is real geometry.'],
  [5.62, 6.0, 'Noise matte', 'A liquid wipe with a gritty, glowing seam.'],
  [6.5, 8.4, 'Capsule strokes', 'Cylinders and spheres, drawn on like a pen, casting shadows.'],
  [9.7, 10.0, 'Iris matte', 'The next world opens out of the dot.'],
  [10.0, 11.9, 'Echoes in depth', 'Ghosts trail behind in time and in z.'],
  [14.0, 15.75, 'Dolly zoom', 'The lens widens as the camera closes in: the hero holds, the world stretches.'],
  [16.0, 17.3, 'Atmosphere', 'Letters surface out of fog.'],
  [17.35, 18.0, 'Portal matte', 'The o’s counter is a window into the next scene. Then we fly through it.'],
  [18.0, 20.0, 'Parallax field', 'Three layers of source code at different depths.'],
  [20.25, 21.2, 'Tumble', 'Letters fall toward the lens, spinning on all three axes.'],
  [21.8, 22.05, 'Band matte', 'Ultramarine opens from the blade.'],
  [22.0, 23.3, 'Clipping-plane masks', 'Words rise through an invisible floor at their baseline.'],
  [24.4, 26.2, 'Light sweep', 'A spotlight rakes the lockup; shadows travel across the wall.'],
  [26.2, 26.85, 'Curtain matte', 'One world, two looks, one noise-edged seam.'],
  [27.25, 28.2, 'Morph', 'The full stop grows six glowing arms.'],
];
const mmss = s => `0:${String(s).padStart(2, '0')}`;

async function prepare3() {
  const faces = [F.disp(100), F.serif(100), F.mono(100, 400), F.mono(100, 700)];
  await Promise.all(faces.map(f => document.fonts.load(f).catch(() => null)));
  await document.fonts.ready;
  PREP.forEach(fn => fn());
  loadFonts3(); buildMaterials();
  PREP3.forEach(fn => fn());
}

function startPlayer3() {
  const $ = s => document.querySelector(s);
  const canvas = $('#film'), stage = $('#stage'), playBtn = $('#play'), big = $('#bigplay');
  const tcEl = $('#tc'), bbEl = $('#barbeat'), scrub = $('#scrub'), head = $('#head'), waveC = $('#wave');
  const chip = $('#principle'), prinTog = $('#principles'), loopTog = $('#loop');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) RO.shake = 0.25;
  let buffer = null, actx = null, src = null, playing = false, t0 = 0, offset = 25.8, clock = 0, started = false, lastT = -1, dirty = true;

  function size() {
    const r = stage.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(480, Math.min(1920, Math.round((r.width * dpr) / 2) * 2));
    sizeGL(w, Math.round((w * 9) / 16)); dirty = true;
    const wr = scrub.getBoundingClientRect();
    waveC.width = Math.round(wr.width * dpr); waveC.height = Math.round(wr.height * dpr); drawWave();
  }
  function drawWave() {
    const g = waveC.getContext('2d'), w = waveC.width, h = waveC.height;
    g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(241,239,233,0.05)'; g.fillRect(0, 0, w, h);
    for (let b = 0; b <= DUR / BAR; b++) { g.fillStyle = 'rgba(241,239,233,0.1)'; g.fillRect(Math.round((b * BAR / DUR) * w), 0, 1, h); }
    if (!buffer) return;
    const L = buffer.getChannelData(0), R = buffer.getChannelData(1), step = Math.floor(L.length / w);
    g.fillStyle = 'rgba(241,239,233,0.42)';
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let i = x * step; i < (x + 1) * step; i += 8) m = Math.max(m, Math.abs(L[i]), Math.abs(R[i]));
      const bh = Math.max(1, m * h * 0.9); g.fillRect(x, (h - bh) / 2, 1, bh);
    }
  }
  function now() {
    if (!playing) return offset;
    if (!actx) return clamp(offset + (performance.now() - clock) / 1000, 0, DUR);
    return clamp(actx.currentTime - t0 - (actx.outputLatency || actx.baseLatency || 0), 0, DUR);
  }
  function play() {
    if (playing) return;
    if (offset >= DUR - 0.02) offset = 0;
    started = true; big.hidden = true;
    try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { actx = null; }
    if (actx && buffer) { src = actx.createBufferSource(); src.buffer = buffer; src.connect(actx.destination); const at = actx.currentTime + 0.06; src.start(at, offset); t0 = at - offset; }
    else clock = performance.now();
    playing = true; playBtn.setAttribute('aria-label', 'Pause'); playBtn.dataset.state = 'playing';
  }
  function pause() {
    if (!playing) return;
    offset = now(); playing = false;
    if (src) { try { src.stop(); } catch (e) {} src = null; }
    playBtn.setAttribute('aria-label', 'Play'); playBtn.dataset.state = 'paused';
  }
  function seek(x, andPlay) { const was = playing || andPlay; pause(); offset = clamp(x, 0, DUR - 0.001); started = true; big.hidden = true; if (was) play(); }
  function ui(t) {
    tcEl.textContent = timecode(t);
    const bar = Math.floor(t / BAR) + 1, beat = Math.floor((t % BAR) / BEAT) + 1;
    bbEl.textContent = `BAR ${String(Math.min(bar, 15)).padStart(2, '0')} · ${beat}`;
    head.style.left = `${(t / DUR) * 100}%`;
    document.querySelectorAll('#cues li').forEach((li, i) => { const s = SCENES3[i], e = SCENES3[i + 1] ? SCENES3[i + 1].t : DUR; li.classList.toggle('on', started && t >= s.t && t < e); });
    let p = null;
    if (prinTog.checked && started) for (const q of PRINCIPLES3) if (t >= q[0] && t < q[1]) p = q;
    chip.hidden = !p;
    if (p) { chip.querySelector('b').textContent = p[2]; chip.querySelector('span').textContent = p[3]; }
  }
  function frame() {
    let t = now();
    if (playing && t >= DUR - 0.001) { if (loopTog.checked) { pause(); offset = 0; play(); t = 0; } else { pause(); offset = DUR; t = DUR; } }
    if (playing || t !== lastT || dirty) { renderFrame3(t, 1); lastT = t; dirty = false; }
    ui(t);
    requestAnimationFrame(frame);
  }
  const list = $('#cues');
  SCENES3.forEach((s, i) => {
    const e = SCENES3[i + 1] ? SCENES3[i + 1].t : DUR, li = document.createElement('li');
    li.innerHTML = `<button type="button" id="cue-${i}"><span class="tc">${mmss(s.t)} – ${mmss(e)}</span><span class="nm">${s.name}</span><span class="mo">${s.motion}</span><span class="so">${s.sound}</span></button>`;
    li.querySelector('button').addEventListener('click', () => { seek(s.t, true); stage.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
    list.appendChild(li);
  });
  const marks = $('#marks');
  SCENES3.forEach(s => { const m = document.createElement('span'); m.style.left = `${(s.t / DUR) * 100}%`; m.textContent = s.mark; marks.appendChild(m); });
  playBtn.addEventListener('click', () => (playing ? pause() : play()));
  big.addEventListener('click', () => seek(0, true));
  canvas.addEventListener('click', () => (started ? (playing ? pause() : play()) : seek(0, true)));
  let drag = false;
  const toT = e => { const r = scrub.getBoundingClientRect(); return clamp((e.clientX - r.left) / r.width) * DUR; };
  scrub.addEventListener('pointerdown', e => { drag = true; scrub.setPointerCapture(e.pointerId); const was = playing; pause(); offset = toT(e); started = true; big.hidden = true; scrub.dataset.resume = was ? '1' : ''; });
  scrub.addEventListener('pointermove', e => { if (drag) offset = toT(e); });
  scrub.addEventListener('pointerup', () => { drag = false; if (scrub.dataset.resume) play(); });
  scrub.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); seek(now() + (e.key === 'ArrowLeft' ? -BEAT : BEAT)); } });
  document.addEventListener('keydown', e => {
    if (e.target.closest('input, button, [role="slider"]') && e.key !== ' ') return;
    if (e.key === ' ') { e.preventDefault(); playing ? pause() : started ? play() : seek(0, true); }
    else if (e.key === 'ArrowLeft') seek(now() - BEAT);
    else if (e.key === 'ArrowRight') seek(now() + BEAT);
    else if (e.key === 'Home') seek(0);
  });
  new ResizeObserver(size).observe(stage);
  size();
  requestAnimationFrame(frame);
  renderSoundtrack().then(b => { buffer = b; drawWave(); big.disabled = false; big.querySelector('span').textContent = 'Play with sound'; })
    .catch(() => { big.disabled = false; big.querySelector('span').textContent = 'Play (no sound)'; });
}
