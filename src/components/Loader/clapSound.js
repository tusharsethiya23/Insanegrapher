/**
 * Tiny clap-sound engine built on Web Audio.
 *
 * Browsers only allow audio after a user gesture, so call unlock() from a
 * click handler (the loader's SOUND toggle) and play() later at the clap.
 * If `src` is given that file is used; otherwise a short wooden "clack" is
 * synthesised, so no audio file is required.
 */
export function createClapSound(src) {
  let ctx = null;
  let buffer = null;

  return {
    async unlock() {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      ctx ??= new AudioCtx();
      if (ctx.state === 'suspended') await ctx.resume();
      if (src && !buffer) {
        try {
          const res = await fetch(src);
          buffer = await ctx.decodeAudioData(await res.arrayBuffer());
        } catch (e) {
          console.warn('[clapSound] could not load', src, e);
        }
      }
    },

    play() {
      if (!ctx || ctx.state !== 'running') return;
      if (buffer) {
        const node = ctx.createBufferSource();
        node.buffer = buffer;
        node.connect(ctx.destination);
        node.start();
      } else {
        synthClack(ctx);
      }
    },

    dispose() {
      ctx?.close();
      ctx = null;
    },
  };
}

function synthClack(ctx) {
  const t = ctx.currentTime;

  // 1. The "crack": a burst of band-passed noise with a very fast decay
  const length = Math.floor(ctx.sampleRate * 0.08);
  const noise = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 4;

  const crack = ctx.createBufferSource();
  crack.buffer = noise;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 2200;
  band.Q.value = 0.9;
  const crackGain = ctx.createGain();
  crackGain.gain.setValueAtTime(0.9, t);
  crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  crack.connect(band).connect(crackGain).connect(ctx.destination);
  crack.start(t);

  // 2. The "body": a short low knock from the wood
  const knock = ctx.createOscillator();
  knock.type = 'triangle';
  knock.frequency.setValueAtTime(180, t);
  knock.frequency.exponentialRampToValueAtTime(60, t + 0.06);
  const knockGain = ctx.createGain();
  knockGain.gain.setValueAtTime(0.5, t);
  knockGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  knock.connect(knockGain).connect(ctx.destination);
  knock.start(t);
  knock.stop(t + 0.08);
}
