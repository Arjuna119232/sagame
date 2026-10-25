// Music.js — procedural background music (no external files).
export const MUSIC = (() => {
  ['touchstart','click','keydown'].forEach(ev=>window.addEventListener(ev,()=>{if(!ctx){try{ctx=new (window.AudioContext||window.webkitAudioContext)();master=ctx.createGain();master.gain.value=vol;master.connect(ctx.destination)}catch(e){}} if(ctx&&ctx.state==='suspended')ctx.resume();},{passive:true}));
  let ctx = null, master = null, playing = false, timer = null, muted = false;
  const vol = .25;
  const notes = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63, 261.63, 196.00];
  let idx = 0;
  function init(c) { if(ctx) return; ctx = c || new (window.AudioContext||window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = vol; master.connect(ctx.destination); }
  function step() {
    if (!playing || muted || !ctx) return;
    const f = notes[idx % notes.length];
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    const g = ctx.createGain(); g.gain.value = 0;
    g.gain.linearRampToValueAtTime(vol * .6, ctx.currentTime + .02);
    g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .35);
    o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + .4);
    // bass
    const b = ctx.createOscillator(); b.type = 'sine'; b.frequency.value = f / 2;
    const bg = ctx.createGain(); bg.gain.value = 0;
    bg.gain.linearRampToValueAtTime(vol * .4, ctx.currentTime + .02);
    bg.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .4);
    b.connect(bg); bg.connect(master); b.start(); b.stop(ctx.currentTime + .45);
    idx++;
    timer = setTimeout(step, 380);
  }
  function start(c) {
    if (playing) return;
    if (!ctx) init(c || (window.SFX && window.SFX.ctx) || null);
    if (!ctx) return;
    playing = true; idx = 0; step();
  }
  function stop() { playing = false; if (timer) { clearTimeout(timer); timer = null; } }
  function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : vol; }
  return { start, stop, setMuted, init };
})();
