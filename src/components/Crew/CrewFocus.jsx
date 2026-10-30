import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import Viewfinder from '../Hero/Viewfinder';
import { MOBILE_QUERY, REDUCED_MOTION_QUERY } from '../Hero/breakpoints';
import { pad } from '../../utils/timecode';
import './CrewFocus.css';

gsap.registerPlugin(ScrollTrigger, useGSAP);

// Focus-distance readout: the bigger a face is in frame, the closer it is
const focusDistance = (faceSize) => (14 / faceSize).toFixed(1);

/**
 * Cam B picture for one member:
 * portrait close-up → else their face cropped from the group photo → else initials.
 */
function CamBFrame({ member, photo }) {
  if (member.portrait) return <img className="crew__camb-img" src={member.portrait} alt="" draggable={false} />;
  if (member.face) {
    const { x, y, size } = member.face;
    return (
      <img
        className="crew__camb-img"
        src={photo.src}
        alt=""
        draggable={false}
        style={{ objectPosition: `${x}% ${y}%`, transformOrigin: `${x}% ${y}%`, transform: `scale(${18 / size})` }}
      />
    );
  }
  return <span className="crew__camb-initial">{member.name.charAt(0)}</span>;
}

/**
 * The crew, shot with two cameras:
 *  Cam A (fullscreen) – the group photo; autofocus finds the team's faces and
 *                       scrolling racks focus from person to person
 *  Cam B (monitor)    – hard-cuts to each person's close-up portrait
 *
 * HOW THE FOCUS WORKS
 *   Two copies of the photo: a blurred one, and a sharp one on top masked to a
 *   circle (--fx, --fy = centre in %, --fr = radius in cqw of the photo width).
 *   GSAP animates those variables; --fr dips while focus travels, then snaps in.
 *
 * SCROLL TIMELINE (pinned, scrubbed; 1 unit per member)
 *   0 → 1        AF boxes pop onto the team's faces, all soft ("searching")
 *   1 + i        member in the photo: camera pushes in, focus racks onto them
 *                member NOT in the photo: Cam A pulls back soft, Cam B leads
 *                (either way Cam B cuts to their close-up + caption)
 *   1 + n → end  camera pulls back, everyone sharp, Cam B flicks through all
 *
 * Mobile: the photo is wider than the screen, so the camera pans to each face.
 * Reduced motion: no camera moves; focus and cuts still happen.
 *
 * Props
 *  photo           – { src, width, height, alt }
 *  members         – see src/data/team.js
 *  title           – crew name shown at the end
 *  showFaceMarkers – debug: show every AF box + tag to check face positions
 *  scrollPerMember – scroll distance per person, % of the viewport height
 */
export default function CrewFocus({
  photo,
  members,
  title = 'Team Insane',
  showFaceMarkers = false,
  scrollPerMember = 55,
  fps = 24,
}) {
  const sectionRef = useRef(null);
  const frameRef = useRef(null);
  const n = members.length;
  const inFrameCount = members.filter((m) => m.face).length;

  // -1 = searching, 0..n-1 = member on camera, n = everyone
  const [active, setActive] = useState(-1);
  const [inView, setInView] = useState(false);
  const [cycle, setCycle] = useState(0); // Cam B flick-through at the end

  useGSAP(
    () => {
      const section = sectionRef.current;
      const frame = frameRef.current;
      const mm = gsap.matchMedia();

      mm.add({ all: 'all', isMobile: MOBILE_QUERY, reduceMotion: REDUCED_MOTION_QUERY }, (ctx) => {
        const { isMobile, reduceMotion } = ctx.conditions;
        const boxes = gsap.utils.toArray('.crew__af', section);
        const overview = { x: 0, y: 0, scale: 1 };

        /**
         * Camera framing for a face: push in and bring it to a target point,
         * clamped so the photo always covers the screen.
         * (offset* ignore transforms, so this is always the rest pose)
         */
        const framing = (face) => {
          const sw = section.clientWidth;
          const sh = section.clientHeight;
          const fw = frame.offsetWidth;
          const fh = frame.offsetHeight;
          const fl = frame.offsetLeft;
          const ft = frame.offsetTop;
          const scale = isMobile ? 1.15 : 1.4;
          const targetX = sw * (isMobile ? 0.5 : 0.48); // desktop: between caption and Cam B
          const targetY = sh * (isMobile ? 0.36 : 0.42);
          const x = targetX - fl - scale * (face.x / 100) * fw;
          const y = targetY - ft - scale * (face.y / 100) * fh;
          return {
            x: gsap.utils.clamp(sw - fl - scale * fw, -fl, x),
            y: gsap.utils.clamp(sh - ft - scale * fh, -ft, y),
            scale,
          };
        };

        gsap.set(frame, { '--fx': 50, '--fy': 35, '--fr': 0 });

        const tl = gsap.timeline({
          defaults: { ease: 'power2.inOut' },
          onUpdate() {
            const t = this.time();
            const idx = t < 1 ? -1 : Math.min(n, Math.floor(t - 1));
            setActive((prev) => (prev === idx ? prev : idx));
          },
          scrollTrigger: {
            trigger: section,
            pin: true,
            start: 'top top',
            end: () => `+=${(n + 2.5) * scrollPerMember}%`,
            scrub: 1,
            invalidateOnRefresh: true,
          },
        });

        /* ---- 0 → 1: face detection ---- */
        if (boxes.length) {
          tl.from(
            boxes,
            { autoAlpha: 0, scale: reduceMotion ? 1 : 1.6, duration: 0.3, stagger: 0.07, ease: 'back.out(2)' },
            0.15
          );
        }

        /* ---- one segment per member ---- */
        members.forEach((m, i) => {
          const at = 1 + i;
          if (m.face) {
            // In the photo: push in + rack focus onto their face
            if (!reduceMotion) {
              tl.to(
                frame,
                { x: () => framing(m.face).x, y: () => framing(m.face).y, scale: () => framing(m.face).scale, duration: 0.6 },
                at
              );
            }
            tl.to(frame, { '--fx': m.face.x, '--fy': m.face.y, duration: 0.6 }, at)
              .to(frame, { '--fr': 0.5, duration: 0.25, ease: 'power1.in' }, at) // focus breathes out while travelling…
              .to(frame, { '--fr': m.face.size * 0.8, duration: 0.35, ease: 'power3.out' }, at + 0.25); // …and snaps in
          } else {
            // Off frame: Cam A pulls back and goes soft, Cam B leads
            if (!reduceMotion) tl.to(frame, { ...overview, duration: 0.6 }, at);
            tl.to(frame, { '--fr': 0, duration: 0.3 }, at);
          }
        });

        /* ---- end: pull back, everyone sharp ---- */
        if (!reduceMotion) tl.to(frame, { ...overview, duration: 0.8 }, 1 + n);
        tl.to(frame, { '--fr': 160, duration: 0.8, ease: 'power2.in' }, 1 + n).to({}, { duration: 0.7 }, 1.8 + n); // hold
      });

      return () => mm.revert();
    },
    { scope: sectionRef }
  );

  // Viewfinder timecode only ticks while the section is on screen
  useEffect(() => {
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    io.observe(sectionRef.current);
    return () => io.disconnect();
  }, []);

  // End state: Cam B flicks through every close-up
  useEffect(() => {
    if (active !== n || window.matchMedia(REDUCED_MOTION_QUERY).matches) return;
    const id = setInterval(() => setCycle((c) => (c + 1) % n), 650);
    return () => clearInterval(id);
  }, [active, n]);

  const current = active >= 0 && active < n ? members[active] : null;
  const offFrame = current && !current.face;
  const camBIndex = current ? active : active === n ? cycle : null;
  const camBMember = camBIndex !== null ? members[camBIndex] : null;

  let caption;
  if (current) {
    caption = (
      <div className="crew__lower-inner" key={active}>
        <p className="crew__lower-index">
          Crew {pad(active + 1)} / {pad(n)} <span aria-hidden="true">·</span>{' '}
          {current.face ? `Focus ${focusDistance(current.face.size)} m` : 'Cam B · off frame'}
        </p>
        <p className="crew__lower-name">{current.name}</p>
        {current.role && <p className="crew__lower-role">{current.role}</p>}
        {current.bio && <p className="crew__lower-bio">{current.bio}</p>}
      </div>
    );
  } else if (active === n) {
    caption = (
      <div className="crew__lower-inner" key="all">
        <p className="crew__lower-index">
          {n} crew <span aria-hidden="true">·</span> all in focus
        </p>
        <p className="crew__lower-name">{title}</p>
        <p className="crew__lower-role">The crew behind every frame</p>
      </div>
    );
  } else {
    caption = (
      <div className="crew__lower-inner" key="search">
        <p className="crew__lower-index">Searching for faces…</p>
        <p className="crew__lower-name">The crew</p>
      </div>
    );
  }

  return (
    <section
      className={`crew${offFrame ? ' is-offframe' : ''}`}
      ref={sectionRef}
      aria-labelledby="crew-heading"
    >
      {/* Screen readers get the crew as a plain list */}
      <h2 id="crew-heading" className="crew__sr">
        The crew: {title}
      </h2>
      <p className="crew__sr">{photo.alt}</p>
      <ul className="crew__sr">
        {members.map((m, i) => (
          <li key={i}>
            {m.name}
            {m.role ? `, ${m.role}` : ''}
            {m.bio ? `. ${m.bio}` : ''}
          </li>
        ))}
      </ul>

      {/* ---------- Cam A: soft copy + sharp copy masked to the focus point ---------- */}
      <div className="crew__frame" ref={frameRef} style={{ '--ratio': photo.width / photo.height }} aria-hidden="true">
        <img className="crew__img crew__img--soft" src={photo.src} alt="" draggable={false} />
        <img className="crew__img crew__img--sharp" src={photo.src} alt="" draggable={false} />

        {members.map((m, i) =>
          m.face ? (
            <div
              key={i}
              className={`crew__af${active === i || active === n ? ' is-locked' : ''}${active === i ? ' is-current' : ''}${
                showFaceMarkers ? ' is-debug' : ''
              }`}
              style={{ '--x': m.face.x, '--y': m.face.y, '--s': m.face.size }}
            >
              <span className="crew__af-tag">
                {pad(i + 1)} · {m.name}
              </span>
            </div>
          ) : null
        )}
      </div>

      {/* ---------- Atmosphere + camera UI ---------- */}
      <div className="crew__scrim" aria-hidden="true" />
      <div className="hero__vignette" aria-hidden="true" />
      <div className="hero__grain crew__grain" aria-hidden="true" />

      <div className="crew__hud" aria-hidden="true">
        Cam A <span>·</span> AF-C face detect <span>·</span> {inFrameCount} faces
      </div>

      <div className="crew__lower" aria-hidden="true">
        {caption}
      </div>

      {/* ---------- Cam B: close-up monitor ---------- */}
      <div className={`crew__camb${camBMember ? ' is-on' : ''}`} aria-hidden="true">
        <div className="crew__camb-bar">
          <span>
            <span className="crew__camb-dot">●</span> Cam B
          </span>
          <span>Close-up</span>
        </div>
        <div className="crew__camb-screen">
          {camBMember && (
            <div className="crew__camb-cut" key={camBIndex}>
              <CamBFrame member={camBMember} photo={photo} />
            </div>
          )}
        </div>
        <div className="crew__camb-name">{camBMember ? camBMember.name : '—'}</div>
      </div>

      <Viewfinder active={inView} fps={fps} label="Cam A · AF-C" guide="none" showSound={false} />
    </section>
  );
}
