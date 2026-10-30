import { useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { REDUCED_MOTION_QUERY } from '../Hero/breakpoints';

/**
 * Before/after wipe: flat LOG footage on the left, the final grade on the right.
 * Drag anywhere on it (or use ← → on the handle) to move the split.
 *
 * Uses project.grade.{log, graded} when provided. Otherwise the poster is used
 * for both sides and the LOG look is simulated with a CSS filter (.is-log).
 * With no image at all, a colour placeholder stands in.
 */
export default function GradeReveal({ project }) {
  const rootRef = useRef(null);
  const introRef = useRef(null);
  const draggingRef = useRef(false);
  const [split, setSplit] = useState(100); // % of the width showing LOG

  const graded = project.grade?.graded ?? project.poster;
  const log = project.grade?.log ?? graded;
  const simulatedLog = !project.grade?.log;

  // Intro: LOG covers everything, then the grade wipes in to the middle
  useGSAP(
    () => {
      if (window.matchMedia(REDUCED_MOTION_QUERY).matches) {
        setSplit(50);
        return;
      }
      const proxy = { v: 100 };
      introRef.current = gsap.to(proxy, {
        v: 50,
        duration: 1.2,
        delay: 0.45,
        ease: 'power3.inOut',
        onUpdate: () => setSplit(proxy.v),
      });
    },
    { scope: rootRef }
  );

  const setFromPointer = (e) => {
    const r = rootRef.current.getBoundingClientRect();
    setSplit(gsap.utils.clamp(0, 100, ((e.clientX - r.left) / r.width) * 100));
  };

  const onPointerDown = (e) => {
    introRef.current?.kill();
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    setFromPointer(e);
  };
  const onPointerMove = (e) => draggingRef.current && setFromPointer(e);
  const onPointerUp = () => {
    draggingRef.current = false;
  };

  const onKeyDown = (e) => {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === 'ArrowLeft') setSplit((s) => Math.max(0, s - step));
    else if (e.key === 'ArrowRight') setSplit((s) => Math.min(100, s + step));
    else return;
    introRef.current?.kill();
    e.preventDefault();
  };

  const media = (src, extraClass = '') =>
    src ? (
      <img className={`grade__img ${extraClass}`} src={src} alt="" draggable={false} />
    ) : (
      <div className={`grade__placeholder ${extraClass}`} style={{ '--c': project.color }}>
        <span>{project.title}</span>
      </div>
    );

  return (
    <div
      className="grade"
      ref={rootRef}
      style={{ '--split': `${split}%` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="grade__layer">{media(graded)}</div>
      <div className="grade__layer grade__layer--log">{media(log, simulatedLog ? 'is-log' : '')}</div>

      <span className="grade__tag grade__tag--log">Log</span>
      <span className="grade__tag grade__tag--graded">Graded</span>

      <div
        className="grade__divider"
        role="slider"
        tabIndex={0}
        aria-label="Compare log footage with the final grade"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(split)}
        aria-valuetext={`${Math.round(split)}% log, ${100 - Math.round(split)}% graded`}
        onKeyDown={onKeyDown}
      >
        <span className="grade__handle" aria-hidden="true">
          ◀ ▶
        </span>
      </div>
    </div>
  );
}
