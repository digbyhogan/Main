// ═══ PLAYER ══════════════════════════════════════════════════════
const SCENES = [
  { t: 0, mark: 'Drop', name: 'The drop', motion: 'A dot pops in, crouches, jumps and falls. Stretched by speed, flattened by impact, volume kept.', sound: 'The bounces halve in length (0.5, 0.25, 0.125 s), so the ball plays its own drum fill.' },
  { t: 2, mark: 'We', name: 'WE', motion: 'Mitosis: 1 → 2 → 4 → about a thousand particles, curving home in a left-to-right stagger.', sound: 'A pluck per split, a sparkle of pentatonic blips, snare and clap on the lock.' },
  { t: 6, mark: 'Make', name: 'MAKE', motion: 'A monoline alphabet drawn one letter per beat on a construction grid. The dot clears the K by a pixel.', sound: 'Woodblock clacks tuned upward, one per glyph.' },
  { t: 10, mark: 'Motion', name: 'MOTION', motion: 'Letters ride a travelling sine wave and turn with its tangent. Then a marquee accelerates and collapses to a line.', sound: 'Full groove, an arpeggio as the letters land, a snare roll from 8ths to 32nds, a tape stop.' },
  { t: 16, mark: 'Without', name: 'without', motion: 'Stillness. A serif whisper after the shout. The dot becomes the tittle of the i, and we zoom into the ink of the o.', sound: 'One glass ping, some air, a riser into the cut.' },
  { t: 18, mark: 'Code', name: 'CODE', motion: 'Decoded one letter per eighth note, struck through, dropped. The bar hangs for a beat before it notices.', sound: 'Bit-crushed hats, square-wave locks, a slash, falling bloops.' },
  { t: 22, mark: 'Claim', name: 'The claim', motion: 'Each word gets its own verb: rise, rise, slam, whisper, decode. The dot drops in as the full stop.', sound: 'Five hits, then the opening drum fill, note for note.' },
  { t: 26, mark: 'Footnote', name: 'The fine print', motion: 'A FLIP reflow from lockup to sentence. The full stop grows six arms.', sound: 'A sproing, typewriter ticks, and the opening blip to close.' },
];
const PRINCIPLES = [
  [0.15, 0.45, 'Timing', 'The dot pops in over 0.3 s on a back ease.'],
  [0.3, 0.62, 'Anticipation', 'A crouch before the jump says a move is coming.'],
  [0.62, 1.0, 'Slow in, slow out', 'Gravity: it leaves slowly and falls faster and faster.'],
  [1.0, 2.0, 'Squash & stretch', 'Stretched by speed, flattened by impact, volume kept.'],
  [2.25, 2.75, 'Secondary action', 'Mitosis. One becomes two becomes four.'],
  [2.75, 4.0, 'Arcs & stagger', 'Particles curve home, launched left to right.'],
  [4.0, 5.5, 'Staging', 'One word, full frame, a slow push-in.'],
  [5.5, 6.0, 'Anticipation', 'The letters crouch before they leave.'],
  [6.0, 6.5, 'Staging', 'The grid sets up the space before the action lands in it.'],
  [6.5, 8.4, 'Rhythm', 'One glyph per beat, drawn like a pen stroke.'],
  [7.25, 7.5, 'Follow-through', 'The dot settles with two shrinking bounces.'],
  [8.3, 9.1, 'Appeal', 'A character hop that clears the K by a pixel.'],
  [9.25, 10.0, 'Match cut', "The E's crossbar becomes the horizon."],
  [10.0, 11.65, 'Arcs & path animation', 'Letters ride the wave and turn with its tangent.'],
  [11.65, 12.0, 'Overlapping action', 'Each letter settles on its own timing.'],
  [12.0, 14.0, 'Repetition', 'Rows pulse on every kick.'],
  [14.0, 15.75, 'Exaggeration', 'Speed, shear, tilt and zoom build the tension.'],
  [15.75, 16.0, 'Timing', 'Everything slows to a stop, like tape.'],
  [16.0, 17.3, 'Contrast', 'Silence, stillness and a thin serif after the shout.'],
  [17.35, 18.0, 'Transition through form', 'Into the ink of the o.'],
  [18.4, 19.9, 'Rhythm', 'Each letter locks on an eighth note.'],
  [20.0, 20.25, 'Impact', 'Slash, shake, sub drop.'],
  [20.25, 21.2, 'Gravity & follow-through', 'Every glyph falls with its own spin.'],
  [21.2, 21.6, 'Comic timing', 'The bar hangs for a beat before it notices.'],
  [21.7, 22.05, 'Layered wipe', 'Two colours, 100 ms apart.'],
  [22.0, 24.3, 'Hierarchy', 'Each word gets its own verb.'],
  [24.3, 25.6, 'Callback', 'The opening bounce, note for note.'],
  [26.0, 26.95, 'FLIP reflow', 'Every word travels from lockup to sentence.'],
  [27.25, 28.2, 'Morph', 'The full stop becomes an asterisk.'],
];

const mmss = s => `0:${String(s).padStart(2, '0')}`;

async function prepare() {
  const faces = [F.disp(100), F.serif(100), F.mono(100, 400), F.mono(100, 700)];
  await Promise.all(faces.map(f => document.fonts.load(f).catch(() => null)));
  await document.fonts.ready;
  PREP.forEach(fn => fn());
}

function startPlayer() {
  const $ = s => document.querySelector(s);
  const canvas = $('#film'), stage = $('#stage'), playBtn = $('#play'), big = $('#bigplay');
  const tcEl = $('#tc'), bbEl = $('#barbeat'), scrub = $('#scrub'), head = $('#head'), waveC = $('#wave');
  const chip = $('#principle'), prinTog = $('#principles'), loopTog = $('#loop');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) RO.shake = 0.25;

  let buffer = null, actx = null, src = null, playing = false, t0 = 0, offset = 25.8, clock = 0, started = false;
  let lastT = -1, lastW = 0;

  function size() {
    const r = stage.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(320, Math.min(1920, Math.round(r.width * dpr)));
    if (canvas.width !== w) { canvas.width = w; canvas.height = Math.round((w * 9) / 16); }
    const wr = scrub.getBoundingClientRect();
    waveC.width = Math.round(wr.width * dpr); waveC.height = Math.round(wr.height * dpr);
    drawWave();
  }
  function drawWave() {
    const g = waveC.getContext('2d'), w = waveC.width, h = waveC.height;
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(241,239,233,0.05)'; g.fillRect(0, 0, w, h);
    // bar lines: the grid everything is timed to
    for (let b = 0; b <= DUR / BAR; b++) { g.fillStyle = 'rgba(241,239,233,0.1)'; g.fillRect(Math.round((b * BAR / DUR) * w), 0, 1, h); }
    if (!buffer) return;
    const L = buffer.getChannelData(0), R = buffer.getChannelData(1), step = Math.floor(L.length / w);
    g.fillStyle = 'rgba(241,239,233,0.42)';
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let i = x * step; i < (x + 1) * step; i += 8) m = Math.max(m, Math.abs(L[i]), Math.abs(R[i]));
      const bh = Math.max(1, m * h * 0.9);
      g.fillRect(x, (h - bh) / 2, 1, bh);
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
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
    } catch (e) { actx = null; }
    if (actx && buffer) {
      src = actx.createBufferSource(); src.buffer = buffer; src.connect(actx.destination);
      const at = actx.currentTime + 0.06;
      src.start(at, offset); t0 = at - offset;
    } else clock = performance.now();
    playing = true; playBtn.setAttribute('aria-label', 'Pause'); playBtn.dataset.state = 'playing';
  }
  function pause() {
    if (!playing) return;
    offset = now(); playing = false;
    if (src) { try { src.stop(); } catch (e) {} src = null; }
    playBtn.setAttribute('aria-label', 'Play'); playBtn.dataset.state = 'paused';
  }
  function seek(x, andPlay) {
    const was = playing || andPlay;
    pause(); offset = clamp(x, 0, DUR - 0.001); started = true; big.hidden = true;
    if (was) play();
  }
  function ui(t) {
    tcEl.textContent = timecode(t);
    const bar = Math.floor(t / BAR) + 1, beat = Math.floor((t % BAR) / BEAT) + 1;
    bbEl.textContent = `BAR ${String(Math.min(bar, 15)).padStart(2, '0')} · ${beat}`;
    head.style.left = `${(t / DUR) * 100}%`;
    document.querySelectorAll('#cues li').forEach((li, i) => {
      const s = SCENES[i], e = SCENES[i + 1] ? SCENES[i + 1].t : DUR;
      li.classList.toggle('on', started && t >= s.t && t < e);
    });
    let p = null;
    if (prinTog.checked && started) for (const q of PRINCIPLES) if (t >= q[0] && t < q[1]) p = q;
    chip.hidden = !p;
    if (p) { chip.querySelector('b').textContent = p[2]; chip.querySelector('span').textContent = p[3]; }
  }
  function frame() {
    let t = now();
    if (playing && t >= DUR - 0.001) {
      if (loopTog.checked) { pause(); offset = 0; play(); t = 0; }
      else { pause(); offset = DUR; t = DUR; }
    }
    if (playing || t !== lastT || canvas.width !== lastW) { renderFrame(canvas, t); lastT = t; lastW = canvas.width; }
    ui(t);
    requestAnimationFrame(frame);
  }

  // dope sheet
  const list = $('#cues');
  SCENES.forEach((s, i) => {
    const e = SCENES[i + 1] ? SCENES[i + 1].t : DUR;
    const li = document.createElement('li');
    li.innerHTML = `<button type="button" id="cue-${i}"><span class="tc">${mmss(s.t)} – ${mmss(e)}</span>` +
      `<span class="nm">${s.name}</span><span class="mo">${s.motion}</span><span class="so">${s.sound}</span></button>`;
    li.querySelector('button').addEventListener('click', () => { seek(s.t, true); stage.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
    list.appendChild(li);
  });
  const marks = $('#marks');
  SCENES.forEach(s => {
    const m = document.createElement('span'); m.style.left = `${(s.t / DUR) * 100}%`; m.textContent = s.mark;
    marks.appendChild(m);
  });

  playBtn.addEventListener('click', () => (playing ? pause() : play()));
  big.addEventListener('click', () => seek(0, true));
  canvas.addEventListener('click', () => (started ? (playing ? pause() : play()) : seek(0, true)));
  let drag = false;
  const toT = e => { const r = scrub.getBoundingClientRect(); return clamp((e.clientX - r.left) / r.width) * DUR; };
  scrub.addEventListener('pointerdown', e => {
    drag = true; scrub.setPointerCapture(e.pointerId);
    const was = playing; pause(); offset = toT(e); started = true; big.hidden = true; scrub.dataset.resume = was ? '1' : '';
  });
  scrub.addEventListener('pointermove', e => { if (drag) offset = toT(e); });
  scrub.addEventListener('pointerup', () => { drag = false; if (scrub.dataset.resume) play(); });
  scrub.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); seek(now() + (e.key === 'ArrowLeft' ? -BEAT : BEAT)); }
  });
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
