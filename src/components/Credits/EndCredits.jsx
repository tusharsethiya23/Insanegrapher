import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { REDUCED_MOTION_QUERY } from '../Hero/breakpoints';
import './EndCredits.css';

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * End credits: the last thing on the page, styled like the credits of a film.
 * Every line is built from the site's data, so it stays in sync with the
 * crew and the work. Lines rise in as they scroll into view.
 *
 * "Rewind" scrolls back to the top — through every pinned section in reverse.
 *
 * Props
 *  name      – brand / director name
 *  crewTitle – e.g. 'Team Insane'
 *  crew      – array of names
 *  films     – array of film titles
 *  contact   – see src/data/contact.js (social links)
 *  lenis     – smooth-scroll instance, used for the rewind
 */
export default function EndCredits({ name, crewTitle, crew = [], films = [], contact = {}, lenis = null }) {
  const rootRef = useRef(null);

  useGSAP(
    () => {
      if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return;
      ScrollTrigger.batch(gsap.utils.toArray('[data-credit]', rootRef.current), {
        start: 'top 92%',
        onEnter: (els) => gsap.fromTo(els, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out' }),
      });
      gsap.set('[data-credit]', { autoAlpha: 0 });
    },
    { scope: rootRef }
  );

  const rewind = () => {
    if (lenis) lenis.scrollTo(0, { duration: 3, easing: (t) => 1 - Math.pow(1 - t, 3) });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const socials = [
    contact.instagram && { label: 'Instagram', href: `https://instagram.com/${contact.instagram}` },
    contact.whatsapp && { label: 'WhatsApp', href: `https://wa.me/${contact.whatsapp}` },
    contact.email && { label: 'Email', href: `mailto:${contact.email}` },
  ].filter(Boolean);

  return (
    <footer className="credits" ref={rootRef}>
      <div className="credits__roll">
        <div className="credits__block" data-credit>
          <p className="credits__role">A film by</p>
          <p className="credits__name credits__name--big">{name}</p>
        </div>

        {crew.length > 0 && (
          <div className="credits__block" data-credit>
            <p className="credits__role">Crew · {crewTitle}</p>
            {crew.map((c) => (
              <p key={c} className="credits__name">
                {c}
              </p>
            ))}
          </div>
        )}

        {films.length > 0 && (
          <div className="credits__block" data-credit>
            <p className="credits__role">Featuring</p>
            {films.map((f) => (
              <p key={f} className="credits__name">
                {f}
              </p>
            ))}
          </div>
        )}

        <div className="credits__block" data-credit>
          <p className="credits__role">Thanks for watching</p>
        </div>
      </div>

      <div className="credits__end" data-credit>
        <p className="credits__brand">{name}</p>
        {socials.length > 0 && (
          <ul className="credits__socials">
            {socials.map((s) => (
              <li key={s.label}>
                <a href={s.href} target={s.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        )}
        <div className="credits__bottom">
          <span>
            © {new Date().getFullYear()} {name}
          </span>
          <button type="button" className="credits__rewind" onClick={rewind}>
            <span aria-hidden="true">◀◀</span> Rewind to start
          </button>
        </div>
      </div>
    </footer>
  );
}
