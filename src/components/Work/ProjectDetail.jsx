import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import GradeReveal from './GradeReveal';
import { REDUCED_MOTION_QUERY } from '../Hero/breakpoints';
import { formatTimecode, pad } from '../../utils/timecode';
import './ProjectDetail.css';

/**
 * Project detail dialog for a vertical reel:
 *  - Watch: plays the reel (project.video, else project.preview) with controls
 *  - Grade: LOG → GRADE reveal
 * The Watch tab only appears when the project has a video.
 * Rendered in a portal on <body> so it sits above the pinned timeline.
 * Closes on Esc, the close button or a backdrop click.
 */
export default function ProjectDetail({ project, number, total, fps = 24, onClose }) {
  const rootRef = useRef(null);
  const closeRef = useRef(null);
  const videoSrc = project.video ?? project.preview;
  const [mode, setMode] = useState(videoSrc ? 'watch' : 'grade');

  const { contextSafe } = useGSAP(
    () => {
      const reduceMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
      gsap
        .timeline()
        .from('.detail__backdrop', { autoAlpha: 0, duration: 0.3 })
        // opacity (not autoAlpha): the close button must stay focusable during the intro
        .from('.detail__panel', { opacity: 0, y: reduceMotion ? 0 : 40, duration: 0.5, ease: 'power3.out' }, 0.05)
        .from('.detail__meta > *', { autoAlpha: 0, y: reduceMotion ? 0 : 12, duration: 0.4, stagger: 0.05 }, 0.2);
    },
    { scope: rootRef }
  );

  const close = contextSafe(() => {
    gsap.to(rootRef.current, { autoAlpha: 0, duration: 0.2, onComplete: onClose });
  });

  // Focus in on open, Esc to close, focus back to the clip on close
  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus?.({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    // data-lenis-prevent: let the panel scroll natively while Lenis is stopped
    <div className="detail" ref={rootRef} role="dialog" aria-modal="true" aria-labelledby="detail-title" data-lenis-prevent>
      <div className="detail__backdrop" onClick={close} />

      <div className="detail__panel">
        <header className="detail__bar">
          <span>
            Clip {pad(number)} / {pad(total)} · {project.file}
          </span>
          <button type="button" className="detail__close" ref={closeRef} onClick={close}>
            Close <span aria-hidden="true">✕</span>
          </button>
        </header>

        <div className="detail__body">
          <div className="detail__media">
            {videoSrc && (
              <div className="detail__tabs" role="group" aria-label="View">
                {['watch', 'grade'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    className="detail__tab"
                    aria-pressed={mode === m}
                    onClick={() => setMode(m)}
                  >
                    {m === 'watch' ? 'Watch' : 'Log → Grade'}
                  </button>
                ))}
              </div>
            )}
            {mode === 'watch' ? (
              // Opened by a click, so playing with sound is allowed
              <video
                className="detail__video"
                src={videoSrc}
                poster={project.poster}
                controls
                autoPlay
                playsInline
                loop
              />
            ) : (
              <GradeReveal project={project} />
            )}
          </div>

          <div className="detail__meta">
            <p className="detail__type">{project.type}</p>
            <h2 id="detail-title" className="detail__title">
              {project.title}
            </h2>
            <dl className="detail__facts">
              {project.client && (
                <div>
                  <dt>Client</dt>
                  <dd>{project.client}</dd>
                </div>
              )}
              {project.role && (
                <div>
                  <dt>Role</dt>
                  <dd>{project.role}</dd>
                </div>
              )}
              {project.year && (
                <div>
                  <dt>Year</dt>
                  <dd>{project.year}</dd>
                </div>
              )}
              <div>
                <dt>Duration</dt>
                <dd>{formatTimecode(project.duration, fps)}</dd>
              </div>
            </dl>
            {project.description && <p className="detail__desc">{project.description}</p>}
            {mode === 'grade' && (
              <p className="detail__hint">Drag the frame to compare the flat log footage with the final grade.</p>
            )}
            {project.link && (
              <a className="detail__link" href={project.link} target="_blank" rel="noreferrer">
                Watch the full film <span aria-hidden="true">↗</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
