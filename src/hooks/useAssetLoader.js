import { useEffect, useState } from 'react';

/**
 * useAssetLoader
 * ------------------------------------------------------------------
 * Preloads the assets the hero needs and reports REAL progress.
 *
 *   const { progress, isReady } = useAssetLoader({
 *     images: ['/assets/hero.png'],
 *     videos: ['/assets/showreel.mp4'],
 *     fonts:  ['400 1em Anton', '700 1em "JetBrains Mono"'],
 *   });
 *
 * - progress : 0 → 1, share of assets that finished (or failed) loading
 * - isReady  : true once everything is loaded AND minDuration has passed,
 *              or as soon as maxDuration is hit (fallback, never gets stuck)
 *
 * Asset groups:
 *   images – each URL is one asset (new Image() + decode())
 *   videos – each URL is one asset (hidden <video preload="auto">, waits for
 *            "canplaythrough", i.e. enough of the start is buffered to play)
 *   fonts  – ALL fonts count as ONE asset: every descriptor is requested with
 *            document.fonts.load(), then we wait for document.fonts.ready
 *
 * Failed assets are counted as done (with a console warning) so a broken
 * URL can never block the site.
 */
export default function useAssetLoader({
  images = [],
  videos = [],
  fonts = [],
  minDuration = 2000,
  maxDuration = 8000,
} = {}) {
  // Stable key: lets callers pass inline array literals without restarting the load every render
  const key = JSON.stringify([images, videos, fonts]);
  const total = images.length + videos.length + 1; // +1 = the fonts group

  const [loaded, setLoaded] = useState(0);
  const [minElapsed, setMinElapsed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const cleanups = [];

    setLoaded(0);
    setMinElapsed(false);
    setTimedOut(false);

    // Returns a callback that counts its asset exactly once (load + error can both fire)
    const tracker = (label) => {
      let settled = false;
      return (error) => {
        if (settled || cancelled) return;
        settled = true;
        if (error) console.warn(`[useAssetLoader] could not load ${label}`, error);
        setLoaded((n) => n + 1);
      };
    };

    // ---- Images ---------------------------------------------------
    images.forEach((src) => {
      const done = tracker(src);
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        // decode() makes sure the first paint of the hero isn't janky
        (img.decode ? img.decode() : Promise.resolve()).then(() => done(), () => done());
      };
      img.onerror = (e) => done(e);
      img.src = src;
      cleanups.push(() => {
        img.onload = img.onerror = null;
      });
    });

    // ---- Videos ---------------------------------------------------
    // Note: iOS Safari may never fire "canplaythrough" for a muted, non-playing
    // video. The maxDuration fallback covers that case.
    videos.forEach((src) => {
      const done = tracker(src);
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('aria-hidden', 'true');
      video.style.cssText =
        'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;';

      const onReady = () => done();
      const onError = () => done(video.error || new Error('video error'));
      video.addEventListener('canplaythrough', onReady);
      video.addEventListener('error', onError);
      video.src = src;
      document.body.appendChild(video);
      video.load();

      cleanups.push(() => {
        video.removeEventListener('canplaythrough', onReady);
        video.removeEventListener('error', onError);
        // Stop buffering: the hero's own <video> takes over (and hits the HTTP cache)
        video.removeAttribute('src');
        video.load();
        video.remove();
      });
    });

    // ---- Fonts ----------------------------------------------------
    {
      const done = tracker('fonts');
      if (!document.fonts) {
        done();
      } else {
        // fonts.load() forces the download even if no text uses the font yet
        Promise.all(fonts.map((f) => document.fonts.load(f).catch(() => null)))
          .then(() => document.fonts.ready)
          .then(() => done(), (e) => done(e));
      }
    }

    // ---- Min / max display time -----------------------------------
    const minTimer = setTimeout(() => !cancelled && setMinElapsed(true), minDuration);
    const maxTimer = setTimeout(() => !cancelled && setTimedOut(true), maxDuration);

    return () => {
      cancelled = true;
      clearTimeout(minTimer);
      clearTimeout(maxTimer);
      cleanups.forEach((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, minDuration, maxDuration]);

  const progress = timedOut ? 1 : Math.min(loaded / total, 1);
  const isReady = timedOut || (progress >= 1 && minElapsed);

  return { progress, isReady, loaded, total, timedOut };
}
