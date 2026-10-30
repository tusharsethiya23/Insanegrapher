import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { formatTimecode } from '../../utils/timecode';
import './Viewfinder.css';

/**
 * Camera viewfinder overlay: corner brackets, ● REC, running timecode,
 * 2.39:1 frame guides, centre cross and a sound toggle.
 *
 * Visibility and the corner fly-in are driven by the Hero's scroll timeline
 * (it targets .viewfinder and [data-corner]); this component only handles
 * what happens *inside* it.
 *
 * Props
 *  active        – timecode ticks only while true
 *  getTime       – optional () => seconds | null, e.g. the playing video's currentTime.
 *                  When it returns null, a clock shared by ALL viewfinders is used,
 *                  so two viewfinders handing off to each other show the same TC.
 *  fps           – timecode frame rate
 *  soundOn       – current sound state (for the toggle label)
 *  onToggleSound – click handler for the sound toggle
 *  label         – format readout, bottom-left
 *  guide         – frame lines: 'reel' (9:16 box), 'scope' (2.39:1 letterbox) or 'none'
 *  showSound     – show the sound toggle (sections without video hide it)
 */
let sharedClockStart = null;

export default function Viewfinder({
  active = false,
  getTime,
  fps = 24,
  soundOn = false,
  onToggleSound,
  label = '4K DCI',
  guide = 'scope',
  showSound = true,
}) {
  const rootRef = useRef(null);
  const tcRef = useRef(null);
  const getTimeRef = useRef(getTime);
  getTimeRef.current = getTime;

  // ● REC blink
  useGSAP(
    () => {
      gsap.to('.viewfinder__rec-dot', { autoAlpha: 0, duration: 0.5, ease: 'steps(1)', repeat: -1, yoyo: true });
    },
    { scope: rootRef }
  );

  // Timecode: video time when available, otherwise the shared clock
  useEffect(() => {
    if (!active) return;
    sharedClockStart ??= performance.now();
    const tick = () => {
      if (!tcRef.current) return; // unmounting
      const seconds = getTimeRef.current?.() ?? (performance.now() - sharedClockStart) / 1000;
      tcRef.current.textContent = formatTimecode(seconds, fps);
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, [active, fps]);

  return (
    <div className="viewfinder" ref={rootRef}>
      {['tl', 'tr', 'bl', 'br'].map((c) => (
        <span key={c} className={`viewfinder__corner viewfinder__corner--${c}`} data-corner={c} aria-hidden="true" />
      ))}

      {guide !== 'none' && <div className={`viewfinder__guide viewfinder__guide--${guide}`} aria-hidden="true" />}
      <span className="viewfinder__cross" aria-hidden="true" />

      <div className="viewfinder__row viewfinder__row--top" aria-hidden="true">
        <span className="viewfinder__rec">
          <span className="viewfinder__rec-dot">●</span> REC
        </span>
        <span className="viewfinder__tc" ref={tcRef}>
          00:00:00:00
        </span>
      </div>

      <div className="viewfinder__row viewfinder__row--bottom">
        <span aria-hidden="true">
          {label} · {fps} FPS
        </span>
        {showSound && (
          <button
            type="button"
            className="viewfinder__sound"
            aria-label="Showreel sound"
            aria-pressed={soundOn}
            onClick={onToggleSound}
          >
            Sound {soundOn ? 'on' : 'off'}
          </button>
        )}
      </div>
    </div>
  );
}
