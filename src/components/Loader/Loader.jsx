import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import useAssetLoader from '../../hooks/useAssetLoader';
import { SLATE_CONFIG } from './slateConfig';
import { markLoaderSeen } from './loaderSession';
import { createClapSound } from './clapSound';
import { pad, formatTimecode } from '../../utils/timecode';
import { lockScroll } from '../../utils/scrollLock';
import './Loader.css';

gsap.registerPlugin(useGSAP);

/* ==================================================================
   Helpers
   ================================================================== */

const formatDate = (d = new Date()) =>
  `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;

// Deterministic pseudo-random 0..1, so the chalk jitter is identical on every render
const rand = (n) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Splits text into characters with a tiny random tilt, baseline offset and
 * spacing: reads like hand-written chalk while staying perfectly legible.
 */
function ChalkText({ text }) {
  return Array.from(String(text)).map((ch, i) => {
    if (ch === ' ') return ' ';
    const seed = i * 3 + ch.charCodeAt(0);
    const style = {
      '--r': `${((rand(seed) - 0.5) * 3).toFixed(2)}deg`,
      '--y': `${((rand(seed + 1) - 0.5) * 0.06).toFixed(3)}em`,
      '--s': `${((rand(seed + 2) - 0.5) * 0.05).toFixed(3)}em`,
    };
    return (
      <span key={i} className="chalk-char" style={style}>
        {ch}
      </span>
    );
  });
}

// One labelled box of the slate grid. `area` maps to a CSS grid-area.
function Field({ area, label, value, variant }) {
  return (
    <div className={`slate__cell slate__cell--${area}`} data-field>
      <span className="slate__label" data-label>
        {label}
      </span>
      <span className={`slate__value${variant ? ` slate__value--${variant}` : ''}`} data-value>
        <ChalkText text={value} />
      </span>
    </div>
  );
}

/* ==================================================================
   Loader
   ================================================================== */

/**
 * Clapperboard preloader.
 *
 * Props
 *  images / videos / fonts – assets to preload (see useAssetLoader)
 *  config        – overrides for SLATE_CONFIG (prod, director, camera, …)
 *  minDuration   – ms the loader stays up at minimum (default 2000)
 *  maxDuration   – ms before it exits no matter what (default 8000)
 *  fps           – timecode frame rate (default 24)
 *  soundSrc      – optional clap audio file; otherwise a synthesised clack
 *  onComplete    – called right after the hard cut (start Lenis, play hero intro…)
 */
export default function Loader({
  images = [],
  videos = [],
  fonts = [],
  config,
  minDuration = 2000,
  maxDuration = 8000,
  fps = 24,
  soundSrc,
  onComplete,
}) {
  const slate = useMemo(
    () => ({
      ...SLATE_CONFIG,
      ...config,
      labels: { ...SLATE_CONFIG.labels, ...config?.labels },
    }),
    [config]
  );
  const date = slate.date ?? formatDate();

  // ---- Refs -------------------------------------------------------
  const rootRef = useRef(null);
  const slateRef = useRef(null);
  const clapperRef = useRef(null);
  const pctRef = useRef(null);
  const tcRef = useRef(null);
  const flashRef = useRef(null);
  const grainRef = useRef(null);
  const recRef = useRef(null);

  // Latest values for the GSAP ticker (which lives outside React's render cycle)
  const progressRef = useRef(0);
  const readyRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const unlockScrollRef = useRef(() => {});

  // Sound (muted by default, enabled by the user via the toggle)
  const soundRef = useRef(null);
  const soundOnRef = useRef(false);
  const [soundOn, setSoundOn] = useState(false);

  const [srPercent, setSrPercent] = useState(0); // screen-reader value, 10% steps
  const [done, setDone] = useState(false);

  // ---- Loading logic ----------------------------------------------
  const { progress, isReady } = useAssetLoader({ images, videos, fonts, minDuration, maxDuration });

  useEffect(() => {
    progressRef.current = progress;
    readyRef.current = isReady;
    onCompleteRef.current = onComplete;
  }, [progress, isReady, onComplete]);

  // ---- Scroll lock (in addition to lenis.stop() in the parent) -----
  useEffect(() => {
    unlockScrollRef.current = lockScroll();
    return () => unlockScrollRef.current();
  }, []);

  // Close the audio context once we're gone (delayed so the clack can ring out)
  useEffect(
    () => () => {
      const sound = soundRef.current;
      if (sound) setTimeout(() => sound.dispose(), 1500);
    },
    []
  );

  const toggleSound = () => {
    const next = !soundOnRef.current;
    soundOnRef.current = next;
    setSoundOn(next);
    if (next) {
      // Created + resumed inside the click: satisfies browser autoplay rules
      soundRef.current ??= createClapSound(soundSrc);
      soundRef.current.unlock();
    }
  };

  // The jump cut: hide instantly (same frame), release scroll, notify parent
  const cut = () => {
    if (!rootRef.current) return;
    gsap.set(rootRef.current, { display: 'none' });
    unlockScrollRef.current();
    markLoaderSeen();
    setDone(true);
    onCompleteRef.current?.();
  };

  // ---- Timeline ---------------------------------------------------
  useGSAP(
    (context, contextSafe) => {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const fields = gsap.utils.toArray('[data-field]', rootRef.current);

      // Clapper starts OPEN, hinged on the left (transform-origin lives in the CSS)
      gsap.set(clapperRef.current, { rotation: -25 });
      gsap.set(flashRef.current, { autoAlpha: 0 });

      /* 1. INTRO (≈0–0.6s) — slate is lifted into frame, fields get "written" */
      const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });

      if (reduceMotion) {
        intro.from(slateRef.current, { autoAlpha: 0, duration: 0.4 });
        intro.from(fields, { autoAlpha: 0, duration: 0.3, stagger: 0.03 }, 0.1);
      } else {
        intro.from(slateRef.current, { yPercent: 12, rotation: 3, autoAlpha: 0, duration: 0.6 });
        fields.forEach((field, i) => {
          const at = 0.15 + i * 0.04;
          intro.from(field.querySelector('[data-label]'), { autoAlpha: 0, duration: 0.2 }, at);
          // Left-to-right wipe = the value being chalked on
          intro.fromTo(
            field.querySelector('[data-value]'),
            { clipPath: 'inset(-20% 100% -20% 0)' },
            { clipPath: 'inset(-20% 0% -20% 0)', duration: 0.3, ease: 'power2.out', clearProps: 'clipPath' },
            at + 0.05
          );
        });
      }

      /* Ambient loops: ● REC blink + film grain jitter */
      gsap.to(recRef.current, { autoAlpha: 0, duration: 0.5, ease: 'steps(1)', repeat: -1, yoyo: true });
      if (!reduceMotion) {
        gsap.to(grainRef.current, {
          x: 'random(-80, 80, 1)',
          y: 'random(-80, 80, 1)',
          duration: 0.08,
          ease: 'steps(1)',
          repeat: -1,
          repeatRefresh: true,
        });
      }

      /* 3–4. READY → CLAP → SHAKE → WHITE FRAME → CUT */
      const playExit = contextSafe(() => {
        const tl = gsap.timeline();

        if (reduceMotion) {
          // No snap, shake or flash: close the slate and fade out quickly
          tl.set(clapperRef.current, { rotation: 0 }, 0.2)
            .call(stopTicker, null, 0.2)
            .to(rootRef.current, { autoAlpha: 0, duration: 0.3, ease: 'power1.out' }, 0.35)
            .call(cut);
          return;
        }

        tl.to(clapperRef.current, { rotation: 0, duration: 0.15, ease: 'power4.in' }, 0.2) // 200ms hold, then SNAP
          .addLabel('clap')
          .call(
            () => {
              stopTicker(); // freeze the timecode on the clap frame
              if (soundOnRef.current) soundRef.current?.play();
            },
            null,
            'clap'
          )
          // Camera shake: a few 2–3px jolts settling back to 0
          .to(
            slateRef.current,
            { keyframes: { x: [0, -3, 3, -2, 1, 0], y: [0, 2, -3, 2, -1, 0] }, duration: 0.12, ease: 'none' },
            'clap'
          )
          // One pure white frame (~80ms) …
          .set(flashRef.current, { autoAlpha: 1 }, 'clap+=0.1')
          // … then the hard cut
          .call(cut, null, 'clap+=0.18');
      });

      /* 2. LOADING — runs every frame on GSAP's ticker */
      const start = gsap.ticker.time;
      const paceEase = gsap.parseEase('power1.inOut');
      let shown = 0; // displayed percentage (float)
      let exiting = false;

      const tick = (time, deltaTime) => {
        if (!tcRef.current || !pctRef.current) return; // unmounting
        const elapsed = time - start;
        const dt = deltaTime / 1000;

        // Timecode
        tcRef.current.textContent = formatTimecode(elapsed, fps);

        // Percentage: chase the real progress, but never run ahead of a
        // minDuration-long pacing curve → always a smooth count, never a jump
        const pace = paceEase(Math.min(elapsed / (minDuration / 1000), 1));
        const target = Math.min(progressRef.current, pace) * 100;
        if (target > shown) {
          const step = Math.max((target - shown) * (1 - Math.exp(-dt * 6)), 15 * dt); // ease-out, min 15%/s
          shown = Math.min(target, shown + step);
          pctRef.current.textContent = `${pad(Math.floor(shown), 3)}%`;

          const bucket = Math.floor(shown / 10) * 10;
          setSrPercent((prev) => (prev === bucket ? prev : bucket));
        }

        if (!exiting && readyRef.current && shown >= 100) {
          exiting = true;
          playExit();
        }
      };

      function stopTicker() {
        gsap.ticker.remove(tick);
      }

      gsap.ticker.add(tick);
      return stopTicker;
    },
    { scope: rootRef }
  );

  if (done) return null;

  const { labels } = slate;

  return (
    <div className="loader" ref={rootRef}>
      {/* Chalk filter: roughens edges and knocks small specks out of lines/letters */}
      <svg className="loader__defs" aria-hidden="true" focusable="false">
        <filter id="slate-chalk" x="-5%" y="-20%" width="110%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.6" xChannelSelector="R" yChannelSelector="G" result="rough" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.2 1.45" result="speckle" />
          <feComposite in="rough" in2="speckle" operator="in" />
        </filter>
      </svg>

      {/* ---------- Layout: the slate ---------- */}
      <div className="slate" ref={slateRef} aria-hidden="true">
        <div className="slate__sticks">
          <div className="slate__stick slate__stick--top" ref={clapperRef} />
          <div className="slate__stick slate__stick--bottom" />
          <span className="slate__hinge" />
        </div>

        <div className="slate__board">
          <div className="slate__grid-clip">
            <div className="slate__grid">
              <Field area="prod" label={labels.prod} value={slate.prod} variant="xl" />
              <Field area="dir" label={labels.director} value={slate.director} />
              <Field area="cam" label={labels.camera} value={slate.camera} />
              <Field area="scene" label={labels.scene} value={slate.scene} variant="mono" />
              <Field area="take" label={labels.take} value={slate.take} variant="mono" />
              <Field area="roll" label={labels.roll} value={slate.roll} variant="mono" />
              <Field area="date" label={labels.date} value={date} variant="mono" />

              {/* Live fields: text is written directly by the ticker (no re-renders) */}
              <div className="slate__cell slate__cell--tc" data-field>
                <span className="slate__label" data-label>
                  {labels.timecode}
                </span>
                <span className="slate__value slate__value--mono slate__value--live" data-value ref={tcRef}>
                  00:00:00:00
                </span>
              </div>
              <div className="slate__cell slate__cell--pct" data-field>
                <span className="slate__label" data-label>
                  {labels.progress}
                </span>
                <span className="slate__value slate__value--pct slate__value--live" data-value ref={pctRef}>
                  000%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Atmosphere ---------- */}
      <div className="loader__vignette" aria-hidden="true" />
      <div className="loader__grain" ref={grainRef} aria-hidden="true" />

      {/* ---------- Viewfinder HUD ---------- */}
      <div className="loader__hud">
        <span className="loader__corner loader__corner--tl" aria-hidden="true" />
        <span className="loader__corner loader__corner--tr" aria-hidden="true" />
        <span className="loader__corner loader__corner--bl" aria-hidden="true" />
        <span className="loader__corner loader__corner--br" aria-hidden="true" />

        <div className="loader__hud-row loader__hud-row--top">
          <span className="loader__rec" aria-hidden="true">
            <span className="loader__rec-dot" ref={recRef}>●</span> REC
          </span>
          <button type="button" className="loader__sound" aria-pressed={soundOn} onClick={toggleSound}>
            Sound {soundOn ? 'on' : 'off'}
          </button>
        </div>
        <div className="loader__hud-row loader__hud-row--bottom" aria-hidden="true">
          <span>{fps} fps · 1/{fps * 2}</span>
          <span>{isReady ? 'Ready' : 'Loading'}</span>
        </div>
      </div>

      {/* Screen readers get the percentage in 10% steps */}
      <p className="loader__sr" role="status" aria-live="polite">
        Loading {srPercent}%
      </p>

      {/* The single white frame before the cut */}
      <div className="loader__flash" ref={flashRef} aria-hidden="true" />
    </div>
  );
}
