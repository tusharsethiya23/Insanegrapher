import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import Viewfinder from './Viewfinder';
import FitVideo from '../media/FitVideo';
import { lockScroll } from '../../utils/scrollLock';
import { MOBILE_QUERY, REDUCED_MOTION_QUERY, MEDIA_LABEL } from './breakpoints';
import './Hero.css';

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Scroll-driven "into the lens" hero.
 *
 * LAYERS (back → front)
 *   1. video layer   – fullscreen showreel, plays from the start
 *   2. photo frame   – the photo with a transparent lens hole; the video shows through it
 *   3. grain/vignette/scrim
 *   4. copy + scroll hint
 *   5. viewfinder UI – revealed at the end of the zoom
 *
 * LENS ORIGIN
 *   The photo sits in a frame with the photo's exact aspect ratio, sized to
 *   COVER the viewport and aligned so the lens lands at the same relative
 *   screen position as in the image. Percentages therefore never drift.
 *   transform-origin = lens centre, so every scale happens around the lens.
 *
 * Props
 *  isReady        – play the entrance (e.g. right after the loader's cut)
 *  lenis          – Lenis instance; scroll stays stopped until the entrance ends
 *  name           – array of lines for the big name, e.g. ['JANE', 'DOE']
 *  fullName       – the name as announced by screen readers (default: lines joined)
 *  title          – e.g. 'Video Editor & Videographer'
 *  photo          – { alt, desktop: { src, width, height }, mobile: { src, width, height } }
 *  video          – { webm, mp4, poster }
 *  lensOrigin     – { desktop: { x, y }, mobile: { x, y } } in % of the image
 *  lensSize       – { desktop, mobile }: hole DIAMETER in % of the image width
 *  centerLens     – also glide the lens to screen centre during the zoom (default true)
 *  handheldRotation – degrees of roll during the zoom (default 2, 0 to disable)
 *  scrollDistance – { desktop: '+=300%', mobile: '+=200%' }
 *  showLensMarker – debug crosshair + circle on the lens hole
 */
export default function Hero({
  isReady = false,
  lenis = null,
  name = ['YOUR', 'NAME'],
  fullName = name.join(' '), // announced by screen readers (lines may split a word)
  title = 'Video Editor & Videographer',
  scrollHint = 'Scroll to roll',
  photo,
  video,
  lensOrigin,
  lensSize,
  centerLens = true,
  handheldRotation = 2,
  scrollDistance = { desktop: '+=300%', mobile: '+=200%' },
  showLensMarker = false,
  fps = 24,
  scrollTriggerId = 'hero-lens', // lets the next section find this pin for its hand-off
}) {
  const heroRef = useRef(null);
  const videoLayerRef = useRef(null);
  const videoRef = useRef(null);
  const frameRef = useRef(null);
  const settleRef = useRef(null);
  const lensUiRef = useRef(null);
  const scrimRef = useRef(null);
  const copyRef = useRef(null);
  const hintRef = useRef(null);
  const entranceRef = useRef(null);

  const [entranceDone, setEntranceDone] = useState(false);
  const [viewfinderShown, setViewfinderShown] = useState(false); // scroll reached the viewfinder phase
  const [inView, setInView] = useState(true); // hero on screen (IntersectionObserver)
  const [soundOn, setSoundOn] = useState(false);

  // Photo + lens values as CSS variables; Hero.css picks the desktop or
  // mobile set with a media query (same query as MOBILE_QUERY)
  const cssVars = {
    '--ratio-d': String(photo.desktop.width / photo.desktop.height),
    '--ratio-m': String(photo.mobile.width / photo.mobile.height),
    '--lx-d': String(lensOrigin.desktop.x),
    '--ly-d': String(lensOrigin.desktop.y),
    '--lx-m': String(lensOrigin.mobile.x),
    '--ly-m': String(lensOrigin.mobile.y),
    '--ls-d': String(lensSize.desktop),
    '--ls-m': String(lensSize.mobile),
  };

  /* ================================================================
     ENTRANCE — built paused on mount (so the hidden state is applied
     before the first paint), played when isReady turns true
     ================================================================ */
  useGSAP(
    () => {
      const reduceMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
      const tl = gsap.timeline({ paused: true, onComplete: () => setEntranceDone(true) });

      if (reduceMotion) {
        tl.from(['.hero__settle', '.hero__name', '.hero__title', '.hero__hint-inner', '.hero__lens-rec'], {
          autoAlpha: 0,
          duration: 0.5,
          stagger: 0.08,
        });
      } else {
        // Slow camera push settling
        tl.from('.hero__settle', { scale: 1.08, duration: 1.2, ease: 'power3.out' }, 0)
          // Name: each line rises out of its mask
          .from('.hero__name-line', { yPercent: 105, duration: 0.9, ease: 'power4.out', stagger: 0.1 }, 0.15)
          // Title: typed-on wipe
          .fromTo(
            '.hero__title',
            { clipPath: 'inset(0 100% 0 0)' },
            { clipPath: 'inset(0 0% 0 0)', duration: 0.7, ease: 'power2.inOut' },
            0.55
          )
          .from('.hero__hint-inner', { autoAlpha: 0, y: 12, duration: 0.5, ease: 'power2.out' }, 0.85)
          .from('.hero__lens-rec', { autoAlpha: 0, duration: 0.3 }, 0.9);
      }

      // Small ● REC by the lens, blinking
      gsap.to('.hero__lens-rec-dot', { autoAlpha: 0, duration: 0.5, ease: 'steps(1)', repeat: -1, yoyo: true });

      entranceRef.current = tl;
    },
    { scope: heroRef }
  );

  useEffect(() => {
    if (isReady) entranceRef.current?.play();
  }, [isReady]);

  /* ================================================================
     SCROLL LOCK — until the entrance has finished
     ================================================================ */
  const locked = !entranceDone;
  useEffect(() => {
    if (lenis) {
      if (locked) lenis.stop();
      else lenis.start();
      return;
    }
    // No Lenis (yet): fall back to locking native scroll
    if (!locked) return;
    return lockScroll();
  }, [lenis, locked]);

  /* ================================================================
     SCROLL TIMELINE — pinned + scrubbed. gsap.matchMedia rebuilds it
     when switching desktop ↔ mobile or toggling reduced motion.
     Positions are fractions of the whole scroll (timeline length = 1).
     ================================================================ */
  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      // matchMedia only runs the callback if at least one condition matches,
      // so `all` guarantees it runs for plain desktop + motion too
      mm.add({ all: 'all', isMobile: MOBILE_QUERY, reduceMotion: REDUCED_MOTION_QUERY }, (ctx) => {
        const { isMobile, reduceMotion } = ctx.conditions;
        const hero = heroRef.current;
        const frame = frameRef.current;
        const viewfinder = hero.querySelector('.viewfinder');

        const lens = {
          ...(isMobile ? lensOrigin.mobile : lensOrigin.desktop),
          size: isMobile ? lensSize.mobile : lensSize.desktop,
        };

        /**
         * How far to zoom: the lens hole must grow until it covers the
         * farthest viewport corner (measured from where the lens ends up).
         * offsetLeft/Width ignore transforms, so this is always the rest pose.
         */
        const lensFit = () => {
          const fw = frame.offsetWidth;
          const fh = frame.offsetHeight;
          const px = frame.offsetLeft + (fw * lens.x) / 100; // lens centre on screen
          const py = frame.offsetTop + (fh * lens.y) / 100;
          const radius = (fw * lens.size) / 200; // hole radius in px
          const sw = hero.clientWidth;
          const sh = hero.clientHeight;
          const tx = centerLens ? sw / 2 : px; // where the lens ends up
          const ty = centerLens ? sh / 2 : py;
          const reach = Math.max(
            Math.hypot(tx, ty),
            Math.hypot(sw - tx, ty),
            Math.hypot(tx, sh - ty),
            Math.hypot(sw - tx, sh - ty)
          );
          // 1.25 = safety margin for the soft anti-aliased edge of the hole
          return { scale: (reach / radius) * 1.25, x: tx - px, y: ty - py };
        };

        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            id: scrollTriggerId,
            trigger: hero,
            pin: true,
            start: 'top top',
            end: reduceMotion ? '+=150%' : isMobile ? scrollDistance.mobile : scrollDistance.desktop,
            scrub: 1,
            invalidateOnRefresh: true, // recompute lensFit() on resize
            onToggle: (self) => {
              // GPU layer only while the zoom can actually run
              frame.style.willChange = self.isActive ? 'transform' : '';
            },
            onUpdate: (self) => setViewfinderShown(self.progress >= 0.9),
          },
        });

        /* ---- Reduced motion: no zoom, just a crossfade photo → video ---- */
        if (reduceMotion) {
          tl.to([copyRef.current, hintRef.current, lensUiRef.current, scrimRef.current], { autoAlpha: 0, duration: 0.3 }, 0)
            .to(frame, { autoAlpha: 0, duration: 0.5 }, 0.3)
            .fromTo(viewfinder, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, 0.8);
          return;
        }

        /* ---- 0 → 20%: text drifts up and out ---- */
        tl.to(copyRef.current, { autoAlpha: 0, y: -80, duration: 0.2, ease: 'power1.in' }, 0)
          .to(hintRef.current, { autoAlpha: 0, y: -40, duration: 0.15, ease: 'power1.in' }, 0)
          .to([lensUiRef.current, scrimRef.current], { autoAlpha: 0, duration: 0.15 }, 0);

        /* ---- 0 → 85%: the push into the lens (expo.in = accelerating pull) ---- */
        tl.to(
          frame,
          {
            scale: () => lensFit().scale,
            x: () => lensFit().x,
            y: () => lensFit().y,
            rotation: handheldRotation,
            duration: 0.85,
            ease: 'expo.in',
          },
          0
        );

        /* ---- Focus breathes out as the push starts, then a rack-focus
                pull 75 → 95% lands the showreel sharp at full brightness ---- */
        tl.fromTo(
          videoLayerRef.current,
          { filter: 'blur(0px) brightness(1)' },
          { filter: 'blur(20px) brightness(0.6)', duration: 0.3, ease: 'power1.in' },
          0.05
        ).to(videoLayerRef.current, { filter: 'blur(0px) brightness(1)', duration: 0.2, ease: 'power2.out' }, 0.75);

        /* ---- 92 → 96%: photo is fully past the edges — remove it ---- */
        tl.to(frame, { autoAlpha: 0, duration: 0.04 }, 0.92);

        /* ---- 90 → 100%: viewfinder fades in, brackets fly in from the edges ---- */
        tl.fromTo(viewfinder, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.05 }, 0.9);
        viewfinder.querySelectorAll('[data-corner]').forEach((corner) => {
          const [v, h] = corner.dataset.corner; // 'tl' → top + left
          tl.from(corner, { x: h === 'l' ? -80 : 80, y: v === 't' ? -80 : 80, duration: 0.1, ease: 'power3.out' }, 0.9);
        });
      });

      return () => mm.revert();
    },
    { scope: heroRef }
  );

  /* ================================================================
     VIDEO — keep it muted for autoplay, pause while off-screen
     ================================================================ */
  useEffect(() => {
    const vid = videoRef.current;
    vid.muted = true;
    const io = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
      if (entry.isIntersecting) vid.play().catch(() => {});
      else vid.pause();
    });
    io.observe(heroRef.current);

    // Keep the toggle label honest if another section changes `muted` (hand-off)
    const onVolume = () => setSoundOn(!vid.muted);
    vid.addEventListener('volumechange', onVolume);

    return () => {
      io.disconnect();
      vid.removeEventListener('volumechange', onVolume);
    };
  }, []);

  const toggleSound = () => {
    const vid = videoRef.current;
    vid.muted = !vid.muted;
    if (!vid.muted) vid.play().catch(() => {});
  };

  // Timecode = showreel playback time (null until the video has frames)
  const getVideoTime = () => {
    const vid = videoRef.current;
    return vid && vid.readyState >= 2 ? vid.currentTime : null;
  };

  return (
    <section className="hero" ref={heroRef} style={cssVars} aria-labelledby="hero-heading">
      <h1 id="hero-heading" className="hero__sr">
        {fullName}, {title}
      </h1>

      {/* 1. Showreel — fullscreen, already playing behind the lens */}
      <div className="hero__video-layer" ref={videoLayerRef} aria-hidden="true">
        <FitVideo videoRef={videoRef} sources={video} mainClassName="hero__video" autoPlay />
      </div>

      {/* 2. Photo — lens glass is transparent, so the video shows through */}
      <div className="hero__frame" ref={frameRef}>
        <div className="hero__settle">
          <picture>
            <source
              media={MOBILE_QUERY}
              srcSet={photo.mobile.src}
              width={photo.mobile.width}
              height={photo.mobile.height}
            />
            <img
              className="hero__photo"
              src={photo.desktop.src}
              width={photo.desktop.width}
              height={photo.desktop.height}
              alt={photo.alt}
              fetchPriority="high"
              decoding="async"
              draggable={false}
            />
          </picture>
        </div>

        {/* Positioned at the lens centre, so it tracks the lens at any size */}
        <div className="hero__lens-ui" ref={lensUiRef} aria-hidden="true">
          <span className="hero__lens-rec">
            <span className="hero__lens-rec-dot">●</span> REC
          </span>
        </div>

        {showLensMarker && <div className="hero__lens-marker" aria-hidden="true" />}
      </div>

      {/* 3. Atmosphere */}
      <div className="hero__scrim" ref={scrimRef} aria-hidden="true" />
      <div className="hero__vignette" aria-hidden="true" />
      <div className="hero__grain" aria-hidden="true" />

      {/* 4. Copy (the real heading is the visually hidden h1 above) */}
      <div className="hero__copy" ref={copyRef} aria-hidden="true">
        <p className="hero__name">
          {name.map((line, i) => (
            <span key={i} className="hero__mask">
              <span className="hero__name-line">{line}</span>
            </span>
          ))}
        </p>
        <p className="hero__title">{title}</p>
      </div>

      <div className="hero__hint" ref={hintRef} aria-hidden="true">
        <div className="hero__hint-inner">
          <span>{scrollHint}</span>
          <span className="hero__hint-line" />
        </div>
      </div>

      {/* 5. Viewfinder UI */}
      <Viewfinder
        active={viewfinderShown && inView}
        getTime={getVideoTime}
        fps={fps}
        soundOn={soundOn}
        onToggleSound={toggleSound}
        label={MEDIA_LABEL}
      />
    </section>
  );
}
