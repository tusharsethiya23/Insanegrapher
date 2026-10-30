import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import Viewfinder from '../Hero/Viewfinder';
import FitVideo from '../media/FitVideo';
import ProjectDetail from './ProjectDetail';
import { MOBILE_QUERY, REDUCED_MOTION_QUERY, MEDIA_LABEL } from '../Hero/breakpoints';
import { formatTimecode, pad } from '../../utils/timecode';
import './EditTimeline.css';

gsap.registerPlugin(ScrollTrigger, useGSAP);

/* ==================================================================
   Helpers
   ================================================================== */

const slug = (s) =>
  s
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

const rand = (n) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

// Decorative audio waveform for track A1 (deterministic, 4 bars per second)
function Waveform({ seconds }) {
  const bars = Math.round(seconds * 4);
  const d = useMemo(() => {
    let path = '';
    for (let i = 0; i < bars; i++) {
      const envelope = 0.35 + 0.65 * Math.abs(Math.sin(i / 31) * Math.cos(i / 9.7));
      const h = Math.max(3, envelope * (0.45 + 0.55 * rand(i)) * 46);
      path += `M${i + 0.5} ${50 - h}V${50 + h}`;
    }
    return path;
  }, [bars]);

  return (
    <svg className="edit__wave" viewBox={`0 0 ${bars} 100`} preserveAspectRatio="none" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="0.55" />
    </svg>
  );
}

// Placeholder (colour field + title) while a project has no media
function ReelPlaceholder({ clip, note = true }) {
  return (
    <div className="edit__placeholder" style={{ '--c': clip.color }}>
      <span className="edit__placeholder-title">{clip.title}</span>
      {note && <span className="edit__placeholder-note">{clip.type} · placeholder</span>}
    </div>
  );
}

// Monitor content for a clip: preview video → poster → generated placeholder
function ClipMedia({ clip, videoRef, showreel }) {
  if (clip.isReel) {
    // Same player as the hero, so the fullscreen hand-off frame is identical
    return <FitVideo videoRef={videoRef} sources={showreel} />;
  }
  if (clip.preview) {
    return (
      <video
        ref={videoRef}
        className="edit__media-el"
        src={clip.preview}
        poster={clip.poster}
        muted
        loop
        playsInline
        preload="none"
      />
    );
  }
  if (clip.poster) return <img className="edit__media-el" src={clip.poster} alt="" draggable={false} />;
  return <ReelPlaceholder clip={clip} />;
}

/* ==================================================================
   EditTimeline
   ================================================================== */

/**
 * The work section, presented as an editing timeline.
 *
 * HAND-OFF FROM THE HERO
 *   This section sits directly on top of the hero's last frame (negative
 *   margin, revealed the instant the hero's pin ends). It opens as a
 *   fullscreen monitor playing the SAME showreel, kept in sync, under an
 *   identical viewfinder — so the zoom flows straight into the edit with no cut.
 *
 * SCROLL TIMELINE (pinned, scrubbed; positions are fractions of the scroll)
 *   0 → 12%   fullscreen monitor shrinks into the program-monitor slot,
 *             viewfinder fades, editor panels slide in
 *   12 → 100% the tracks slide under a fixed playhead; the clip under the
 *             playhead plays in the monitor (hard cuts, like an edit)
 *
 * All work is 16:9.
 * Desktop: inspector | program monitor | bin of project cards.
 * Mobile:  monitor on top, compact inspector, timeline below.
 *
 * Every clip / bin card is a project: click it (or "Open project") for
 * details with Watch + LOG → GRADE reveal.
 *
 * Props
 *  projects         – see src/data/projects.js
 *  showreel         – { webm, mp4, poster } (same as the hero)
 *  lenis            – stopped while a project is open
 *  showreelDuration – width of the opening showreel clip, in seconds
 *  handoff          – { triggerId, videoSelector } of the hero it continues from
 *  scrollPerClip    – scroll distance per clip, in % of the viewport height
 *  sequenceName     – shown in the top bar
 */
export default function EditTimeline({
  projects,
  showreel,
  lenis = null,
  showreelDuration = 60,
  handoff = { triggerId: 'hero-lens', videoSelector: '.hero__video' },
  scrollPerClip = 70,
  sequenceName = 'PORTFOLIO_2026',
  fps = 24,
}) {
  const sectionRef = useRef(null);
  const monitorRef = useRef(null);
  const slotRef = useRef(null);
  const lanesRef = useRef(null);
  const tracksRef = useRef(null);
  const tcRef = useRef(null);
  const reelRef = useRef(null);
  const projectVideoRefs = useRef([]);

  const [active, setActive] = useState(0); // index into clips; 0 = showreel
  const [onStage, setOnStage] = useState(false); // section revealed over the hero
  const [inView, setInView] = useState(true); // false once scrolled past (next section)
  const [soundOn, setSoundOn] = useState(false);
  const [openIndex, setOpenIndex] = useState(null);

  // Timeline model: the showreel first, then every project, back to back
  const clips = useMemo(() => {
    const list = [
      {
        id: 'showreel',
        isReel: true,
        title: 'Showreel',
        type: `${new Date().getFullYear()} highlights`,
        duration: showreelDuration,
        color: '#6b6b6b',
        poster: showreel.poster,
        file: 'SHOWREEL.mp4',
      },
      ...projects.map((p, i) => ({ ...p, file: `${pad(i + 1)}_${slug(p.title)}.mp4` })),
    ];
    let t = 0;
    return list.map((clip) => {
      const withStart = { ...clip, start: t };
      t += clip.duration;
      return withStart;
    });
  }, [projects, showreel.poster, showreelDuration]);

  const totalSec = clips.at(-1).start + clips.at(-1).duration;
  const rulerMarks = Array.from({ length: Math.floor(totalSec / 10) + 1 }, (_, i) => i * 10);
  const current = clips[active];

  /* ================================================================
     SCROLL TIMELINE + HAND-OFF
     ================================================================ */
  useGSAP(
    () => {
      const section = sectionRef.current;
      const reel = reelRef.current;
      const heroVideo = () => document.querySelector(handoff.videoSelector);

      /* ---- Hand-off: reveal over the hero's last frame ---------------- */
      // ~1 screen before the hand-off, start our showreel in sync (muted)
      // so it's already decoded and playing when it takes over
      const prime = () => {
        const hv = heroVideo();
        if (!hv || !reel) return;
        try {
          reel.currentTime = hv.currentTime;
        } catch {
          /* no source yet */
        }
        reel.play().catch(() => {});
      };

      const show = () => {
        const hv = heroVideo();
        if (hv && reel) {
          if (Math.abs(reel.currentTime - hv.currentTime) > 0.2) reel.currentTime = hv.currentTime;
          reel.muted = hv.muted; // sound state carries over
          hv.muted = true;
          hv.pause();
          reel.play().catch(() => {});
          setSoundOn(!reel.muted);
        }
        gsap.set(section, { autoAlpha: 1 });
        setOnStage(true);
      };

      const hide = () => {
        const hv = heroVideo();
        if (hv && reel) {
          hv.currentTime = reel.currentTime;
          hv.muted = reel.muted;
          hv.play().catch(() => {});
          reel.pause();
        }
        gsap.set(section, { autoAlpha: 0 });
        setOnStage(false);
      };

      ScrollTrigger.create({ trigger: section, start: 'top bottom', onEnter: prime });

      const mm = gsap.matchMedia();
      mm.add({ all: 'all', isMobile: MOBILE_QUERY, reduceMotion: REDUCED_MOTION_QUERY }, (ctx) => {
        const { reduceMotion } = ctx.conditions;
        const monitor = monitorRef.current;
        const slot = slotRef.current;
        const lanes = lanesRef.current;
        const tracks = tracksRef.current;
        const viewfinder = section.querySelector('.viewfinder');
        const vignette = section.querySelector('.hero__vignette');
        const ui = section.querySelectorAll('[data-ui]');
        const clipEls = [...tracks.querySelectorAll('[data-clip]')];

        /* Geometry, re-measured on every ScrollTrigger refresh (resize) */
        let geo = null;
        const g = () => {
          if (geo) return geo;
          const s = section.getBoundingClientRect();
          const r = slot.getBoundingClientRect();
          const spans = clipEls.map((el) => ({ start: el.offsetLeft, end: el.offsetLeft + el.offsetWidth }));
          geo = {
            sw: section.clientWidth,
            sh: section.clientHeight,
            slot: { left: r.left - s.left, top: r.top - s.top, width: r.width, height: r.height },
            playhead: lanes.clientWidth / 2, // playhead x inside the lanes
            spans,
            from: spans[0].start + 1, // timeline position at the start / end of the scroll
            to: spans.at(-1).end - 1,
            pps: (spans.at(-1).end - spans[0].start) / totalSec, // px per second
          };
          return geo;
        };

        // Which clip is under the playhead → monitor + inspector + timecode
        let lastIndex = 0;
        const syncPlayhead = () => {
          // GSAP also renders while reverting (unmount / StrictMode remount),
          // after React has detached the refs, so bail out if they're gone
          if (!tcRef.current || !tracks.isConnected) return;
          const { playhead, spans, pps } = g();
          const pos = playhead - gsap.getProperty(tracks, 'x');
          tcRef.current.textContent = formatTimecode(Math.max(0, pos) / pps, fps);
          const i = spans.findIndex((c) => pos >= c.start && pos < c.end);
          if (i !== -1 && i !== lastIndex) {
            lastIndex = i;
            setActive(i);
          }
        };

        gsap.set(viewfinder, { autoAlpha: 1 }); // first frame = the hero's last frame

        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: section,
            pin: true,
            start: 'top top',
            end: () => `+=${clips.length * scrollPerClip}%`,
            scrub: 1,
            invalidateOnRefresh: true,
            onRefreshInit: () => {
              geo = null;
            },
            onEnter: show,
            onLeaveBack: hide,
          },
        });

        const HANDOFF = reduceMotion ? 0.04 : 0.12;

        if (reduceMotion) {
          // No shrink: the editor simply appears
          tl.set(
            monitor,
            {
              left: () => g().slot.left,
              top: () => g().slot.top,
              width: () => g().slot.width,
              height: () => g().slot.height,
              borderRadius: 10,
            },
            0
          ).fromTo([viewfinder, vignette], { autoAlpha: 1 }, { autoAlpha: 0, duration: HANDOFF }, 0);
        } else {
          /* ---- 0 → 12%: fullscreen → program monitor ---- */
          tl.fromTo(
            monitor,
            { left: 0, top: 0, width: () => g().sw, height: () => g().sh, borderRadius: 0 },
            {
              left: () => g().slot.left,
              top: () => g().slot.top,
              width: () => g().slot.width,
              height: () => g().slot.height,
              borderRadius: 10,
              duration: HANDOFF,
              ease: 'power3.inOut',
            },
            0
          )
            .fromTo([viewfinder, vignette], { autoAlpha: 1 }, { autoAlpha: 0, duration: HANDOFF * 0.5 }, 0)
            .from(ui, { autoAlpha: 0, y: 24, duration: HANDOFF * 0.55, stagger: HANDOFF * 0.08, ease: 'power2.out' }, HANDOFF * 0.4);
        }

        /* ---- 12 → 100%: scrub the edit ---- */
        tl.fromTo(
          tracks,
          { x: () => g().playhead - g().from },
          { x: () => g().playhead - g().to, duration: 1 - HANDOFF, onUpdate: syncPlayhead },
          HANDOFF
        );
      });

      return () => mm.revert();
    },
    { scope: sectionRef }
  );

  /* ================================================================
     MONITOR PLAYBACK — only the clip under the playhead plays,
     and nothing plays behind an open project
     ================================================================ */
  useEffect(() => {
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    io.observe(sectionRef.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const playing = onStage && inView && openIndex === null;
    const reel = reelRef.current;
    if (onStage && reel) {
      if (playing && active === 0) reel.play().catch(() => {});
      else reel.pause();
    }
    projectVideoRefs.current.forEach((vid, i) => {
      if (!vid) return;
      if (playing && i === active) vid.play().catch(() => {});
      else vid.pause();
    });
  }, [active, onStage, inView, openIndex]);

  // One sound switch for every monitor video
  useEffect(() => {
    if (!onStage) return;
    [reelRef.current, ...projectVideoRefs.current].forEach((vid) => {
      if (vid) vid.muted = !soundOn;
    });
  }, [soundOn, onStage]);

  const toggleSound = () => setSoundOn((on) => !on);

  /* ================================================================
     PROJECT DETAIL — pause smooth scroll while it's open
     ================================================================ */
  const openProject = (index) => {
    if (clips[index]?.isReel) return;
    lenis?.stop();
    setOpenIndex(index);
  };
  const closeProject = () => {
    setOpenIndex(null);
    lenis?.start();
  };

  const getReelTime = () => {
    const reel = reelRef.current;
    return reel && reel.readyState >= 2 ? reel.currentTime : null;
  };

  return (
    <section className="edit" ref={sectionRef} aria-label="Work">
      {/* ---------- Editor UI ---------- */}
      <div className="edit__ui">
        <header className="edit__top" data-ui>
          <span className="edit__seq">
            <span className="edit__seq-dot" aria-hidden="true" /> {sequenceName}
          </span>
          <span className="edit__seq-meta">
            Sequence 01 · {fps} fps · {clips.length} clips
          </span>
          <button type="button" className="edit__btn" aria-pressed={soundOn} onClick={toggleSound}>
            Sound {soundOn ? 'on' : 'off'}
          </button>
        </header>

        <div className="edit__main">
          {/* Inspector: the clip under the playhead */}
          <aside className="edit__inspector" data-ui aria-live="polite">
            <div className="edit__meta" key={current.id}>
              <p className="edit__meta-index">
                <span className="edit__chip" style={{ background: current.color }} aria-hidden="true" />
                Clip {pad(active + 1)} / {pad(clips.length)}
              </p>
              <h2 className="edit__meta-title">{current.title}</h2>
              <p className="edit__meta-type">{current.type}</p>

              {current.isReel ? (
                <p className="edit__meta-desc">
                  Scroll to scrub through the edit. Every clip on the timeline is a project. Click one to open it.
                </p>
              ) : (
                <>
                  <dl className="edit__facts">
                    {current.client && (
                      <div>
                        <dt>Client</dt>
                        <dd>{current.client}</dd>
                      </div>
                    )}
                    {current.role && (
                      <div>
                        <dt>Role</dt>
                        <dd>{current.role}</dd>
                      </div>
                    )}
                    {current.year && (
                      <div>
                        <dt>Year</dt>
                        <dd>{current.year}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Duration</dt>
                      <dd>{formatTimecode(current.duration, fps)}</dd>
                    </div>
                  </dl>
                  {current.description && <p className="edit__meta-desc">{current.description}</p>}
                  <button type="button" className="edit__open" onClick={() => openProject(active)}>
                    Open project <span aria-hidden="true">→</span>
                  </button>
                </>
              )}
            </div>
          </aside>

          {/* The 16:9 monitor animates into this slot */}
          <div className="edit__monitor-area">
            <div className="edit__monitor-slot" ref={slotRef} />
          </div>

          {/* Bin: every reel as a portrait card (desktop) */}
          <aside className="edit__bin" data-ui data-lenis-prevent aria-label="Project bin">
            <p className="edit__panel-label">
              Bin · {projects.length} {projects.length === 1 ? 'film' : 'films'}
            </p>
            <ul className="edit__bin-grid">
              {clips.slice(1).map((c, k) => {
                const i = k + 1;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={`edit__card${i === active ? ' is-active' : ''}`}
                      style={{ '--c': c.color }}
                      onClick={() => openProject(i)}
                      aria-label={`Open project: ${c.title}, ${c.type}`}
                    >
                      <span className="edit__card-media">
                        {c.poster ? <img src={c.poster} alt="" loading="lazy" /> : <ReelPlaceholder clip={c} note={false} />}
                        <span className="edit__card-dur">{formatTimecode(c.duration, fps).slice(3, 8)}</span>
                      </span>
                      <span className="edit__card-title">{c.title}</span>
                      <span className="edit__card-type">{c.type}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
        </div>

        {/* ---------- Timeline ---------- */}
        <div className="edit__timeline" data-ui>
          <div className="edit__heads" aria-hidden="true">
            <span className="edit__head edit__head--ruler" />
            <span className="edit__head">V2</span>
            <span className="edit__head edit__head--v1">V1</span>
            <span className="edit__head edit__head--a1">A1</span>
            <span className="edit__head">A2</span>
          </div>

          <div className="edit__lanes" ref={lanesRef}>
            <div className="edit__tracks" ref={tracksRef} style={{ '--total': totalSec }}>
              {/* Ruler */}
              <div className="edit__row edit__row--ruler" aria-hidden="true">
                {rulerMarks.map((s) => (
                  <span key={s} className="edit__mark" style={{ '--t': s }}>
                    {formatTimecode(s, fps).slice(3, 8)}
                  </span>
                ))}
              </div>

              {/* V2: title cards at the head of each project */}
              <div className="edit__row edit__row--v2" aria-hidden="true">
                {clips.slice(1).map((c) => (
                  <span key={c.id} className="edit__title-clip" style={{ '--start': c.start, '--dur': 4 }}>
                    T
                  </span>
                ))}
              </div>

              {/* V1: the work — every clip is a project card */}
              <div className="edit__row edit__row--v1">
                {clips.map((c, i) => {
                  const ClipTag = c.isReel ? 'div' : 'button';
                  return (
                    <ClipTag
                      key={c.id}
                      data-clip
                      {...(c.isReel
                        ? { 'aria-hidden': true }
                        : {
                            type: 'button',
                            onClick: () => openProject(i),
                            'aria-label': `Open project: ${c.title}, ${c.type}${c.year ? `, ${c.year}` : ''}`,
                          })}
                      className={`edit__clip${c.poster ? '' : ' is-placeholder'}${i === active ? ' is-active' : ''}`}
                      style={{
                        '--start': c.start,
                        '--dur': c.duration,
                        '--c': c.color,
                        backgroundImage: c.poster ? `url(${c.poster})` : undefined,
                      }}
                    >
                      <span className="edit__clip-label">{c.file}</span>
                      <span className="edit__clip-title">{c.title}</span>
                    </ClipTag>
                  );
                })}
              </div>

              {/* A1: dialogue / nat sound */}
              <div className="edit__row edit__row--a1" aria-hidden="true">
                <Waveform seconds={totalSec} />
              </div>

              {/* A2: music bed */}
              <div className="edit__row edit__row--a2" aria-hidden="true">
                <span className="edit__music">MUSIC_BED.wav</span>
              </div>
            </div>

            <div className="edit__playhead" aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* ---------- Program monitor (starts fullscreen) ---------- */}
      <div className="edit__monitor" ref={monitorRef}>
        {clips.map((c, i) => (
          <div key={c.id} className={`edit__media${i === active ? ' is-active' : ''}`}>
            <ClipMedia
              clip={c}
              showreel={showreel}
              videoRef={
                c.isReel
                  ? reelRef
                  : (el) => {
                      projectVideoRefs.current[i] = el;
                    }
              }
            />
          </div>
        ))}
        <div className="edit__monitor-hud" data-ui aria-hidden="true">
          <span className="edit__monitor-file">{current.file}</span>
          <span ref={tcRef}>00:00:00:00</span>
        </div>

      </div>

      {/* ---------- Hand-off layers: identical to the hero's last frame ---------- */}
      <div className="hero__vignette" aria-hidden="true" />
      <div className="hero__grain edit__grain" aria-hidden="true" />
      <Viewfinder
        active={onStage}
        getTime={getReelTime}
        fps={fps}
        soundOn={soundOn}
        onToggleSound={toggleSound}
        label={MEDIA_LABEL}
      />

      {openIndex !== null && (
        <ProjectDetail
          project={clips[openIndex]}
          number={openIndex + 1}
          total={clips.length}
          fps={fps}
          onClose={closeProject}
        />
      )}
    </section>
  );
}
