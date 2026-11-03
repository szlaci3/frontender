import { useRef, useState, type FormEvent } from 'react';
import { compileStyle, type Style } from '../../shared/style.ts';

export function SampleWebsite({ style, savedLayers }: { style: Style; savedLayers?: readonly Style[] }) {
  const spaces = useRef<HTMLElement>(null);
  const membership = useRef<HTMLElement>(null);
  const visit = useRef<HTMLElement>(null);
  const [quietHours, setQuietHours] = useState(true);
  const [selectedSpace, setSelectedSpace] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [plan, setPlan] = useState('day');
  const [workspace, setWorkspace] = useState('quiet');
  const [visitDay, setVisitDay] = useState('Tuesday');
  const [visitorName, setVisitorName] = useState('');
  const [visitNote, setVisitNote] = useState('');
  const [visitSubmitted, setVisitSubmitted] = useState(false);

  function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubscribed(true);
  }
  function goTo(section: HTMLElement | null) {
    section?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  }
  function explore() { goTo(spaces.current); }
  function requestVisit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVisitSubmitted(true);
  }

  return (
    <div className="preview-root">
      <style data-preview-selected>{`@layer selected { ${savedLayers
        ? savedLayers.map((layer, index) => `@layer saved${index} { ${compileStyle(layer)} }`).join('\n')
        : compileStyle(style)} }`}</style>
      <article className="sample-page" aria-label="Form and Field sample website">
        <nav className="sample-nav" aria-label="Sample website navigation">
          <span className="sample-brand"><span className="sample-brand-mark" aria-hidden="true">✳</span> form & field<span className="sample-brand-period">.</span></span>
          <div className="sample-nav-links">
            <button className="sample-nav-link" onClick={explore}>Our spaces <span aria-hidden="true">↗</span></button>
            <button className="sample-nav-link" onClick={() => goTo(membership.current)}>Membership</button>
            <button className="sample-nav-link" onClick={() => goTo(visit.current)}>Plan a visit</button>
          </div>
        </nav>

        <section className="sample-hero" aria-labelledby="sample-title">
          <div className="sample-eyebrow"><span aria-hidden="true" /> GOOD SPACE. GREAT POSSIBILITIES.</div>
          <h1 id="sample-title" className="sample-heading">Make room for<br /><em>better work.</em></h1>
          <p className="sample-copy sample-intro">Thoughtful spaces for curious people. Find a little focus,<br className="sample-intro-break" /> a fresh perspective, and somewhere to make it happen.</p>
          <button className="sample-button" onClick={explore}>Find your space <span aria-hidden="true">↗</span></button>
          <span className="sample-hero-note">A place to settle in. A reason to look up.</span>
          <div className="sample-hero-art" aria-hidden="true"><div className="sample-orbit" /><div className="sample-arch" /><div className="sample-art-label">SPACE TO<br />THINK BIG.</div><div className="sample-sun" /></div>
        </section>

        <section ref={spaces} className="sample-spaces" aria-labelledby="spaces-heading">
          <div className="sample-section-heading"><div><span className="sample-eyebrow">FIND YOUR CORNER</span><h2 className="sample-subheading" id="spaces-heading">A different kind of everyday.</h2></div><span className="sample-section-count">01 — 02</span></div>
          <div className="sample-card-grid">
            {[
              { name: 'The quiet corner', tag: 'FOR DEEP FOCUS', description: 'A desk, soft light, and room to follow a thought.', kind: 'quiet' },
              { name: 'The common ground', tag: 'FOR FRESH IDEAS', description: 'Pull up a chair. Good things start with a conversation.', kind: 'common' },
            ].map(space => (
              <article className="sample-card" key={space.kind}>
                <img className="sample-image sample-space-image" src={space.kind === 'quiet' ? '/images/quiet-studio.svg' : '/images/common-table.svg'}
                  alt={space.kind === 'quiet' ? 'Illustration of a sunlit studio with an arched window and a private desk' : 'Illustration of a shared studio table with chairs and plants'} width="800" height="500" />
                <div className="sample-card-content"><span className="sample-eyebrow">{space.tag}</span><h3>{space.name}</h3><p className="sample-copy">{space.description}</p>
                  <button className="sample-card-link" aria-expanded={selectedSpace === space.kind} onClick={() => setSelectedSpace(selectedSpace === space.kind ? null : space.kind)}>Take a closer look <span aria-hidden="true">{selectedSpace === space.kind ? '−' : '↗'}</span></button>
                  {selectedSpace === space.kind && <p className="sample-space-detail">{space.kind === 'quiet' ? 'A private desk, reading lamp, and a view of the garden. Yours for a morning or the whole day.' : 'A shared table for up to six people, a whiteboard, and plenty of fresh coffee.'}</p>}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="sample-preference" aria-label="Workspace preferences"><div><h3>Less noise. More possibility.</h3><p className="sample-copy">A little quiet goes a long way.</p></div><label className="sample-switch-label"><span>Quiet hours</span><input type="checkbox" role="switch" checked={quietHours} onChange={event => setQuietHours(event.target.checked)} /><span className="sample-switch-track" aria-hidden="true" /></label></section>

        <section className="sample-story sample-section" aria-labelledby="story-heading">
          <div><span className="sample-eyebrow">A MORE HUMAN WORKDAY</span><h2 className="sample-subheading" id="story-heading">Come for the desk.<br />Stay for the feeling.</h2>
            <p className="sample-copy">We made Form & Field for people who care about the work and the day around it. Independent minds, a shared table, and enough breathing room to do something good.</p>
            <ul className="sample-amenities sample-copy"><li>Daylight at every desk</li><li>Fresh coffee, always included</li><li>Small teams, warm welcomes</li><li>A garden for the in-between</li></ul>
          </div>
          <aside className="sample-card sample-quote" aria-label="Member story"><span className="sample-eyebrow">FROM OUR COMMUNITY</span>
            <blockquote>“Somewhere between the first coffee and the afternoon light, it stopped feeling like an office.”</blockquote>
            <p className="sample-copy">Alex Morgan<br /><span className="sample-plan-note">Independent designer · member since 2024</span></p>
          </aside>
        </section>

        <section ref={membership} className="sample-section" aria-labelledby="membership-heading">
          <div className="sample-section-heading"><div><span className="sample-eyebrow">ROOM FOR YOUR RHYTHM</span><h2 className="sample-subheading" id="membership-heading">A little space. On your terms.</h2></div></div>
          <p className="sample-copy">Start with a day, find a regular rhythm, or make a corner your own.</p>
          <fieldset className="sample-plan-picker"><legend className="sample-field-label">Choose a membership</legend>
            <div className="sample-plan-grid">{[
              { id: 'day', title: 'Drop in', price: '24', unit: '/ day', description: 'A fresh setting for a focused day.', benefits: 'Shared desk · coffee · garden' },
              { id: 'flex', title: 'Find a rhythm', price: '160', unit: '/ month', description: 'Eight days to make good things happen.', benefits: '8 visits · meeting-room credits' },
              { id: 'resident', title: 'Settle in', price: '290', unit: '/ month', description: 'Your own desk. Your everyday place.', benefits: 'Dedicated desk · storage · all weekdays' },
            ].map(option => <label className="sample-card sample-plan" key={option.id}>
              <span className="sample-plan-title"><span>{option.title}</span><input type="radio" name="sample-membership" value={option.id} checked={plan === option.id} onChange={() => { setPlan(option.id); setVisitSubmitted(false); }} /></span>
              <span className="sample-price">€{option.price}<small>{option.unit}</small></span>
              <span className="sample-copy">{option.description}</span><span className="sample-plan-note">{option.benefits}</span>
            </label>)}</div>
          </fieldset>
          <p className="sample-plan-note">Sample memberships. No payment or subscription is created.</p>
          <button className="sample-button" onClick={() => goTo(visit.current)}>Come and say hello <span aria-hidden="true">↗</span></button>
        </section>

        <section ref={visit} className="sample-section" aria-labelledby="visit-heading">
          <div className="sample-section-heading"><div><span className="sample-eyebrow">YOUR NEXT GOOD WORKDAY</span><h2 className="sample-subheading" id="visit-heading">See how it feels.</h2></div></div>
          <p className="sample-copy">Pick a day for a short tour. We’ll show you around, put the kettle on, and help you find your corner.</p>
          <form className="sample-visit-form" onSubmit={requestVisit} onChange={() => setVisitSubmitted(false)}>
            <div className="sample-form-grid">
              <label className="sample-field-label" htmlFor="sample-visitor-name">Your name<input className="sample-input" id="sample-visitor-name" autoComplete="name" value={visitorName} onChange={event => setVisitorName(event.target.value)} placeholder="How should we greet you?" required maxLength={80} /></label>
              <label className="sample-field-label" htmlFor="sample-workspace">Your corner<select className="sample-input" id="sample-workspace" value={workspace} onChange={event => setWorkspace(event.target.value)}><option value="quiet">The quiet corner</option><option value="common">The common ground</option></select></label>
              <label className="sample-field-label" htmlFor="sample-visit-day">Preferred day<select className="sample-input" id="sample-visit-day" value={visitDay} onChange={event => setVisitDay(event.target.value)}>{['Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => <option key={day}>{day}</option>)}</select></label>
              <div className="sample-visit-hours"><span className="sample-field-label">When to find us</span><p className="sample-copy">Weekdays, 9:00–18:00<br />Tours between 10:00 and 16:00</p></div>
            </div>
            <label className="sample-field-label" htmlFor="sample-visit-note">Anything we should know? <span className="sample-plan-note">Optional</span><textarea className="sample-input" id="sample-visit-note" rows={3} maxLength={500} value={visitNote} onChange={event => setVisitNote(event.target.value)} placeholder="A project, a question, or a particular kind of quiet." /></label>
            <button className="sample-button" type="submit">Preview my visit <span aria-hidden="true">↗</span></button>
            <p className="sample-form-feedback" role="status">{visitSubmitted ? `Thanks, ${visitorName.trim()}. Your sample ${visitDay} tour is set for ${workspace === 'quiet' ? 'the quiet corner' : 'the common ground'} with the ${plan === 'day' ? 'Drop in' : plan === 'flex' ? 'Find a rhythm' : 'Settle in'} plan. No booking was sent.` : 'Try the form. This is a local sample; no booking will be sent.'}</p>
          </form>
        </section>

        <section className="sample-section sample-faq" aria-labelledby="faq-heading"><span className="sample-eyebrow">GOOD TO KNOW</span><h2 className="sample-subheading" id="faq-heading">A few small details.</h2>
          <details><summary>Can I come for just one day?</summary><p className="sample-copy">Of course. Drop in for a day, bring your laptop, and find a seat at the shared table. Coffee and a warm welcome are included.</p></details>
          <details><summary>Is there space for a small team?</summary><p className="sample-copy">The common ground seats up to six. There’s a whiteboard for the big ideas and a garden for a change of scene.</p></details>
          <details><summary>What if I need a quiet day?</summary><p className="sample-copy">Choose the quiet corner and turn on quiet hours above. Private desks and a gentler pace make room for deep focus.</p></details>
        </section>

        <section className="sample-newsletter" aria-labelledby="newsletter-heading"><span className="sample-eyebrow">A NOTE FROM US</span><h2 className="sample-subheading" id="newsletter-heading">Good things, every so often.</h2><p className="sample-copy">Fresh spaces, small ideas, and a little inspiration for your inbox.</p>
          <form onSubmit={subscribe}><label className="sr-only" htmlFor="sample-email">Email address</label><input id="sample-email" className="sample-input" type="email" autoComplete="email" placeholder="Your email address" value={email} onChange={event => { setEmail(event.target.value); setSubscribed(false); }} required /><button className="sample-button" type="submit">Keep me posted <span aria-hidden="true">↗</span></button></form>
          <p className="sample-form-feedback" role="status">{subscribed ? 'You’re on the sample list. No email was sent.' : 'Just a little inspiration. Always room to unsubscribe.'}</p>
        </section>
        <footer className="sample-footer"><span>form & field.</span><span>A little space makes a difference.</span><span>© 2026</span></footer>
      </article>
    </div>
  );
}
