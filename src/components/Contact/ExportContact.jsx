import { useId, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { REDUCED_MOTION_QUERY } from '../Hero/breakpoints';
import { formatTimecode, pad } from '../../utils/timecode';
import './ExportContact.css';

gsap.registerPlugin(ScrollTrigger, useGSAP);

const TOTAL_FRAMES = 2400; // fake render length shown in the stats (100 s at 24 fps)

const formatMoney = (n, currency) => `${currency}${Number(n).toLocaleString('en-IN')}`;

// The enquiry as a plain-text message (WhatsApp / email body)
function buildMessage(f, contact) {
  const lines = ['Hi Insanegrapher! New project enquiry 🎬', ''];
  if (f.preset) lines.push(`Project: ${f.preset}`);
  if (f.date) lines.push(`Shoot date: ${f.date}`);
  if (f.location) lines.push(`Location: ${f.location}`);
  if (contact.budget && f.budget) lines.push(`Budget: ${formatMoney(f.budget, contact.budget.currency)}`);
  lines.push(`Name: ${f.name}`);
  if (f.phone) lines.push(`Phone: ${f.phone}`);
  if (f.message) lines.push('', f.message);
  return lines.join('\n');
}

/**
 * The contact section, staged as exporting a film from an editor.
 *
 * SCROLL (pinned, scrubbed)
 *   The section pins while a render bar fills 0 → 100% and the preview flicks
 *   through frames of your work ("Rendering your next film…"). At 100% the
 *   pin releases and the export settings — the enquiry form — unlock.
 *
 * SENDING (no server needed)
 *   "Render ▶" opens WhatsApp with the enquiry pre-typed to contact.whatsapp.
 *   Without a WhatsApp number it falls back to an email draft (contact.email).
 *
 * Reduced motion: no pin; the render is already complete.
 *
 * Props
 *  contact      – see src/data/contact.js
 *  frames       – image URLs flicked through in the preview while rendering
 *  sequenceName – shown in the dialog title
 */
export default function ExportContact({ contact, frames = [], sequenceName = 'SEQUENCE_01' }) {
  const sectionRef = useRef(null);
  const barRef = useRef(null);
  const uid = useId();

  const [pct, setPct] = useState(0);
  const [sent, setSent] = useState(null); // null | 'whatsapp' | 'email' | 'none'
  const [form, setForm] = useState({
    preset: '',
    date: '',
    location: '',
    budget: contact.budget ? Math.round((contact.budget.min + contact.budget.max) / 2 / contact.budget.step) * contact.budget.step : '',
    name: '',
    phone: '',
    message: '',
  });

  const ready = pct >= 100;

  useGSAP(
    () => {
      if (window.matchMedia(REDUCED_MOTION_QUERY).matches) {
        setPct(100);
        return;
      }
      gsap.fromTo(
        barRef.current,
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top top',
            end: '+=120%',
            pin: true,
            scrub: 0.4,
            onUpdate: (self) => {
              const next = Math.round(self.progress * 100);
              setPct((prev) => (prev === next ? prev : next));
            },
          },
        }
      );
    },
    { scope: sectionRef }
  );

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = (e) => {
    e.preventDefault();
    const text = buildMessage(form, contact);
    if (contact.whatsapp) {
      window.open(`https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
      setSent('whatsapp');
    } else if (contact.email) {
      const subject = `Project enquiry${form.preset ? ` · ${form.preset}` : ''}`;
      window.location.href = `mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
      setSent('email');
    } else {
      console.warn('[ExportContact] Add a WhatsApp number or email in src/data/contact.js');
      setSent('none');
    }
  };

  // Preview frame + fake render stats, all driven by scroll progress
  const frameIndex = frames.length ? Math.floor((pct / 100) * frames.length * 3) % frames.length : -1;
  const frameNo = Math.round((pct / 100) * TOTAL_FRAMES);
  const elapsed = formatTimecode(frameNo / 24, 24);

  const links = [
    contact.whatsapp && { label: 'WhatsApp', href: `https://wa.me/${contact.whatsapp}` },
    contact.instagram && { label: 'Instagram', href: `https://instagram.com/${contact.instagram}` },
    contact.email && { label: 'Email', href: `mailto:${contact.email}` },
    contact.phone && { label: contact.phone, href: `tel:${contact.phone.replace(/\s+/g, '')}` },
  ].filter(Boolean);

  return (
    <section className={`export${ready ? ' is-ready' : ''}`} ref={sectionRef} aria-labelledby={`${uid}-title`}>
      <div className="export__intro">
        <p className="export__kicker">Final step</p>
        <h2 className="export__headline" id={`${uid}-title`}>
          Let's render <br />
          your next film
        </h2>
      </div>

      <div className="export__dialog">
        {/* ---------- Title bar ---------- */}
        <header className="export__bar">
          <span className="export__bar-title">
            <span className="export__dot" aria-hidden="true" /> Export · {sequenceName}
          </span>
          <span className="export__bar-meta">H.264 · 16:9 · 24 fps</span>
        </header>

        <div className="export__body">
          {/* ---------- Render: preview + progress ---------- */}
          <div className="export__render">
            <div className="export__preview" aria-hidden="true">
              {frameIndex >= 0 && <img key={frameIndex} src={frames[frameIndex]} alt="" draggable={false} />}
              <span className="export__preview-tc">{elapsed}</span>
              {ready && <span className="export__preview-done">✓</span>}
            </div>

            <div className="export__progress">
              <div className="export__progress-head">
                <span>{sent ? 'Export complete' : ready ? 'Ready to export' : 'Rendering your next film…'}</span>
                <span className="export__pct">{pad(pct, 3)}%</span>
              </div>
              <div className="export__track">
                <div className="export__fill" ref={barRef} />
              </div>
              <dl className="export__stats" aria-hidden="true">
                <div>
                  <dt>Frame</dt>
                  <dd>
                    {pad(frameNo, 4)} / {TOTAL_FRAMES}
                  </dd>
                </div>
                <div>
                  <dt>Elapsed</dt>
                  <dd>{elapsed}</dd>
                </div>
              </dl>
              {/* Announce once, when the form unlocks */}
              <p className="export__sr" role="status">
                {ready ? 'Render complete. The project enquiry form is ready.' : ''}
              </p>
            </div>
          </div>

          {/* ---------- Export settings = the enquiry form ---------- */}
          {sent ? (
            <div className="export__done" role="status">
              <p className="export__done-mark" aria-hidden="true">
                ✓
              </p>
              <h3 className="export__done-title">Export complete</h3>
              <p className="export__done-text">
                {sent === 'whatsapp' && 'Your enquiry is open in WhatsApp. Hit send there and we’ll get back to you.'}
                {sent === 'email' && 'Your enquiry is open in your email app. Hit send there and we’ll get back to you.'}
                {sent === 'none' && 'Thanks! Contact details are still being set up, so please reach out on social media for now.'}
              </p>
              <button type="button" className="export__secondary" onClick={() => setSent(null)}>
                Edit enquiry
              </button>
            </div>
          ) : (
            <form className="export__form" onSubmit={onSubmit}>
              <fieldset className="export__fieldset" disabled={!ready}>
                <legend className="export__legend">Export settings</legend>

                <div className="export__field" role="radiogroup" aria-labelledby={`${uid}-preset`}>
                  <span className="export__label" id={`${uid}-preset`}>
                    Preset
                  </span>
                  <div className="export__chips">
                    {contact.presets.map((p) => (
                      <label key={p} className="export__chip">
                        <input type="radio" name="preset" value={p} checked={form.preset === p} onChange={set('preset')} />
                        <span>{p}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="export__row">
                  <label className="export__field">
                    <span className="export__label">Shoot date</span>
                    <input className="export__input" type="date" value={form.date} onChange={set('date')} />
                  </label>
                  <label className="export__field">
                    <span className="export__label">Location</span>
                    <input
                      className="export__input"
                      type="text"
                      placeholder="City"
                      autoComplete="address-level2"
                      value={form.location}
                      onChange={set('location')}
                    />
                  </label>
                </div>

                {contact.budget && (
                  <label className="export__field">
                    <span className="export__label">
                      Budget <output className="export__budget">{formatMoney(form.budget, contact.budget.currency)}</output>
                    </span>
                    <input
                      className="export__range"
                      type="range"
                      min={contact.budget.min}
                      max={contact.budget.max}
                      step={contact.budget.step}
                      value={form.budget}
                      onChange={set('budget')}
                    />
                  </label>
                )}

                <div className="export__row">
                  <label className="export__field">
                    <span className="export__label">Your name *</span>
                    <input
                      className="export__input"
                      type="text"
                      required
                      autoComplete="name"
                      value={form.name}
                      onChange={set('name')}
                    />
                  </label>
                  <label className="export__field">
                    <span className="export__label">Phone *</span>
                    <input
                      className="export__input"
                      type="tel"
                      required
                      inputMode="tel"
                      autoComplete="tel"
                      pattern="[0-9+\s\-]{10,}"
                      title="At least 10 digits"
                      value={form.phone}
                      onChange={set('phone')}
                    />
                  </label>
                </div>

                <label className="export__field">
                  <span className="export__label">Tell us about it</span>
                  <textarea
                    className="export__input export__textarea"
                    rows={3}
                    placeholder="The story, the vibe, anything we should know"
                    value={form.message}
                    onChange={set('message')}
                  />
                </label>

                <button type="submit" className="export__render-btn">
                  Render <span aria-hidden="true">▶</span>
                </button>
                <p className="export__note">
                  {contact.whatsapp ? 'Opens WhatsApp with your enquiry ready to send.' : 'Opens your email app with your enquiry ready to send.'}
                </p>
              </fieldset>
            </form>
          )}
        </div>
      </div>

      {/* ---------- Direct links ---------- */}
      {(links.length > 0 || contact.location) && (
        <div className="export__direct">
          {links.length > 0 && <p className="export__direct-label">Or just say hi</p>}
          {links.length > 0 && (
            <ul className="export__links">
              {links.map((l) => (
                <li key={l.label}>
                  <a href={l.href} target={l.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
                    {l.label} <span aria-hidden="true">↗</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          {contact.location && <p className="export__location">{contact.location}</p>}
        </div>
      )}
    </section>
  );
}
