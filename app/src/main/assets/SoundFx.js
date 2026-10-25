// SoundFx.js — synthesised sound effects via Web Audio (no external files).
// Safe for offline APK: everything generated in code.
export const SFX = (() => {
  let ctx = null, master = null, muted = false, ready = false, ambNode = null, sirenNode = null;
  const vol = { master: .6, sfx: .8, amb: .35 };
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = vol.master; master.connect(ctx.destination);
      ready = true;
      startAmbient();
    } catch (e) { console.warn('SFX init fail', e); }
  }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
  // expose resume on user gesture
  ['touchstart','click','keydown'].forEach(ev => window.addEventListener(ev, () => { if (!ctx) init(); else resume(); }, { once: false, passive: true }));

  function gain(v, dest) { const g = ctx.createGain(); g.gain.value = v; g.connect(dest || master); return g; }
  function osc(type, freq, dur, vol0 = .5, dest, slide = 0) {
    if (!ready || muted) return;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(1, freq + slide), ctx.currentTime + dur);
    const g = gain(vol0 * vol.sfx, dest);
    g.gain.setValueAtTime(vol0 * vol.sfx, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + dur);
    o.connect(g); o.start(); o.stop(ctx.currentTime + dur);
  }
  function noise(dur, vol0 = .4, filterFreq = 1200) {
    if (!ready || muted) return;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = gain(vol0 * vol.sfx); g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + dur);
    src.connect(f); f.connect(g); src.start(); src.stop(ctx.currentTime + dur);
  }
  function seq(notes, type = 'square', gap = .06, vol0 = .4) {
    if (!ready || muted) return;
    let t = ctx.currentTime;
    notes.forEach(([f, d]) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
      const g = gain(vol0 * vol.sfx); g.gain.setValueAtTime(vol0 * vol.sfx, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g); o.start(t); o.stop(t + d); t += d + gap;
    });
  }

  const sounds = {
    click: () => osc('square', 880, .06, .3),
    menu: () => seq([[523,.08],[659,.08],[784,.12]], 'triangle', .04, .35),
    punch: () => { noise(.12, .6, 900); osc('sawtooth', 180, .12, .5, null, -120); },
    step: () => noise(.06, .25, 600),
    stepRun: () => noise(.05, .35, 800),
    carEnter: () => seq([[220,.12],[330,.12],[440,.18]], 'sawtooth', .03, .4),
    carExit: () => seq([[440,.12],[330,.12],[220,.18]], 'sawtooth', .03, .4),
    crash: () => { noise(.35, .8, 400); osc('sawtooth', 90, .35, .6, null, -60); },
    score: () => seq([[659,.08],[784,.08],[988,.14]], 'triangle', .03, .45),
    caught: () => seq([[440,.15],[349,.15],[262,.25]], 'sawtooth', .04, .6),
    npcHit: () => { noise(.18, .5, 700); osc('square', 300, .15, .4, null, -200); },
    carHit: () => { noise(.22, .7, 500); osc('sawtooth', 120, .22, .5, null, -80); },
    start: () => seq([[392,.1],[523,.1],[659,.1],[784,.2]], 'triangle', .04, .5),
    pause: () => seq([[659,.1],[523,.1]], 'triangle', .04, .4),
    resume: () => seq([[523,.1],[659,.1]], 'triangle', .04, .4),
    gameOver: () => seq([[392,.2],[330,.2],[262,.3],[196,.4]], 'sawtooth', .05, .6),
  };

  function play(name) { if (!ready || muted) return; const fn = sounds[name]; if (fn) try { fn(); } catch (e) {} }

  // Ambient city hum (looping low drone + filtered noise)
  let ambGain = null;
  function startAmbient() {
    if (!ready || ambNode) return;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * .3;
    ambNode = ctx.createBufferSource(); ambNode.buffer = buf; ambNode.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
    ambGain = gain(vol.amb, master); ambGain.gain.value = 0;
    ambNode.connect(f); f.connect(ambGain); ambNode.start();
    ambGain.gain.linearRampToValueAtTime(vol.amb, ctx.currentTime + 1.5);
  }
  function setAmbientLevel(l) { if (ambGain) ambGain.gain.linearRampToValueAtTime(vol.amb * l, ctx.currentTime + .3); }

  // Police siren (loop while heat high)
  let sirenOsc = null, sirenGain = null, sirenLfo = null;
  function startSiren() {
    if (!ready || muted || sirenOsc) return;
    sirenOsc = ctx.createOscillator(); sirenOsc.type = 'sawtooth'; sirenOsc.frequency.value = 600;
    sirenLfo = ctx.createOscillator(); sirenLfo.frequency.value = 1.6;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 220;
    sirenLfo.connect(lfoGain); lfoGain.connect(sirenOsc.frequency);
    sirenGain = gain(0, master);
    sirenOsc.connect(sirenGain); sirenOsc.start(); sirenLfo.start();
    sirenGain.gain.linearRampToValueAtTime(.35 * vol.sfx, ctx.currentTime + .2);
  }
  function stopSiren() {
    if (!sirenOsc) return;
    try { sirenGain.gain.linearRampToValueAtTime(0, ctx.currentTime + .3); } catch(e){}
    setTimeout(() => { try { sirenOsc.stop(); sirenLfo.stop(); } catch(e){} sirenOsc = null; sirenGain = null; sirenLfo = null; }, 350);
  }
  function setSiren(on) { if (on) startSiren(); else stopSiren(); }

  function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : vol.master; if (m) stopSiren(); }
  function isMuted() { return muted; }
  function setMaster(v) { vol.master = v; if (master && !muted) master.gain.value = v; }

  return { init, play, setMuted, isMuted, setMaster, setSiren, setAmbientLevel, resume };
})();
