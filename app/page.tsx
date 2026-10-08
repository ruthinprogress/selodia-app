import { Comfortaa, Cormorant_Infant, Manrope } from 'next/font/google';
import { redirect } from 'next/navigation';

import { HeroArtwork, ThreadDivider } from './lib/hero-artwork';
import {
  CONTACT_EMAIL,
  FOOTER,
  HOW_IT_WORKS,
  INSTAGRAM_URL,
  MASTHEAD,
  META,
  PROBLEM,
  REAL_LIFE,
  RECORD_STAYS_YOURS,
  SEEING_SOMEONE,
  WAITING_LIST,
  WHAT_IT_DOES,
  WRITING,
  WRITING_URL,
} from './lib/homepage-copy';
import { sourceTag } from './lib/source-tag';
import { supabase } from './lib/supabase';

// The selodia.app homepage, rebuilt 8 October 2026 to Ruth's design and copy
// master. The page that stood here until today was a logo, a tagline and an
// email field; this one has to read like the homepage of a real company.
//
// NOT ONE WORD OF COPY LIVES IN THIS FILE. Every string comes from
// `app/lib/homepage-copy.ts`, which is the file Ruth reads and edits. That is
// her instruction and it is also the only way the copy checks can be run at
// all: a rule about vocabulary that has to grep a .tsx is a rule that cannot
// see a sentence split across three JSX nodes.
//
// STILL NO CLIENT JAVASCRIPT. The form posts to a Server Action and the action
// redirects back with a query flag. No 'use client', no bundle, no hydration.
// The brief asks for "minimal JavaScript, only what the form needs", and what
// the form needs turns out to be none.
//
// IT PINS ITS OWN COLOURS, for the same reason it always did: globals.css has a
// `prefers-color-scheme: dark` override that would take this cream page to
// near-black on a phone at night. Part Fifteen is explicit that light and dark
// are a deliberate in-app choice and never follow the system.

// ---------------------------------------------------------------------------
// Typography. Three families, each with one job, per the copy master.
// ---------------------------------------------------------------------------

/** Tagline (300) and category line (400). NOTHING ELSE on the page uses it. */
const comfortaa = Comfortaa({ subsets: ['latin'], weight: ['300', '400'], display: 'swap' });

/** Every heading. Regular weight and never bold, which is stated twice in the brief. */
const cormorant = Cormorant_Infant({ subsets: ['latin'], weight: ['400'], display: 'swap' });

/** All body copy, navigation, forms and footer. */
const manrope = Manrope({ subsets: ['latin'], weight: ['400', '500'], display: 'swap' });

// ---------------------------------------------------------------------------
// Palette. Part Fifteen, confirmed values.
// ---------------------------------------------------------------------------

const CREAM = '#F7F3EA';
const SAND = '#E9D6C2';
const CHARCOAL = '#2D2B28';
const TERRACOTTA = '#C97458';
const FOREST = '#37584A';

/**
 * Deep terracotta: links, and any terracotta carrying text.
 *
 * `#874C3A`, which is `accentDeep` in `mobile/src/constants/theme.ts` and the
 * value the copy master names. Part Fifteen's prose says "around `#834B39`",
 * but `#834B39` is the DARK MODE GROUND in that same file, not the light-mode
 * text colour, and the implemented token has been `#874C3A` since June. The
 * copy master and the code agree, so this follows them.
 *
 * It measures 6.07:1 on cream. Brand terracotta itself is 3.10:1 and fails AA
 * for anything at body size, which is why it never carries text here.
 */
const ACCENT_DEEP = '#874C3A';

/** Body copy that is deliberately quieter. 5.4:1 on cream, so it still clears AA. */
const MUTED = '#6B6258';

/** Small decorative circles below the hero. Sage and sand only: large terracotta is hero-only. */
const SAGE_TINT = '#B9C5AE';
const SAND_TINT = '#E9D6C2';

export const metadata = {
  title: META.title,
  description: META.description,
  openGraph: {
    title: META.title,
    description: META.description,
    url: 'https://selodia.app',
    siteName: 'Selodía',
    locale: 'en_GB',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: META.title,
    description: META.description,
  },
  alternates: { canonical: 'https://selodia.app' },
};

// ---------------------------------------------------------------------------
// Joining the waiting list.
//
// UNCHANGED FROM THE PAGE THIS REPLACES, deliberately. Ruth: "Reuse the
// existing waitlist and its Supabase table. Do not rebuild it." The `waitlist`
// table is the only publicly writable one in the schema: RLS allows INSERT to
// anyone and grants no SELECT at all, so a stranger can add themselves and
// nobody can read the list back through the API.
// ---------------------------------------------------------------------------

async function join(formData: FormData) {
  'use server';

  const email = String(formData.get('email') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const src = sourceTag(formData.get('src'));

  // The browser already enforces type="email" and required; this is the version
  // that survives a request that did not come from the browser.
  if (!email || !email.includes('@') || email.length > 320) {
    redirect('/?joined=error#waiting-list');
  }

  const { error } = await supabase
    .from('waitlist')
    .insert({ email, name: name.length > 0 ? name : null, src });

  // 23505 is a unique violation: they are already on the list. That is a success
  // from where they are standing, and telling somebody already signed up that
  // something went wrong would be both untrue and alarming.
  if (error && error.code !== '23505') {
    console.log('WAITLIST INSERT FAILED:', error.message);
    redirect('/?joined=error#waiting-list');
  }

  redirect('/?joined=1#waiting-list');
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ joined?: string; src?: string }>;
}) {
  const { joined, src } = await searchParams;
  // Read here and carried into the form as a hidden field, because a server
  // action sees the submitted form and never the address bar.
  const tag = sourceTag(src);

  return (
    <>
      <style>{`
        body:has(.site) { background: ${CREAM}; margin: 0; }

        .site {
          --cream: ${CREAM};
          --sand: ${SAND};
          --charcoal: ${CHARCOAL};
          --terracotta: ${TERRACOTTA};
          --deep: ${ACCENT_DEEP};
          --forest: ${FOREST};
          --muted: ${MUTED};
          background: var(--cream);
          color: var(--charcoal);
          font-family: ${manrope.style.fontFamily}, system-ui, sans-serif;
          /* 17px floor, which the brief sets and which is also the honest
             minimum for the reader this page is for. */
          font-size: 17px;
          line-height: 1.6;
          overflow-x: hidden;
        }

        .wrap { width: 100%; max-width: 1080px; margin: 0 auto; padding: 0 1.25rem; box-sizing: border-box; }

        /* Headings: Cormorant Infant, regular, NEVER bold. */
        .site h1, .site h2, .site h3 {
          font-family: ${cormorant.style.fontFamily}, Georgia, serif;
          font-weight: 400;
          letter-spacing: 0.005em;
          line-height: 1.15;
          margin: 0;
          text-wrap: balance;
        }
        .site h2 { font-size: clamp(1.9rem, 5.2vw, 2.9rem); }
        .site h3 { font-size: clamp(1.3rem, 3.6vw, 1.55rem); }

        .site p { margin: 0 0 1.05rem; max-width: 36em; }
        .site a { color: var(--deep); }
        .site a:focus-visible,
        .site button:focus-visible,
        .site input:focus-visible { outline: 2px solid var(--forest); outline-offset: 3px; border-radius: 2px; }

        /* ----------------------------------------------------------------- */
        /* Top navigation                                                     */
        /* ----------------------------------------------------------------- */
        /* ON A PHONE THE MARK TAKES ITS OWN ROW. Four links and a mark do not
           fit across 375px: they wrapped, and "Contact" dropped onto a second
           line on its own, next to the lockup. Stacking is the tidy version of
           what it was going to do anyway. */
        .nav { position: relative; z-index: 3; display: flex; flex-direction: column;
               align-items: flex-start; gap: 0.9rem; padding: 1.35rem 0 0; }
        .nav__links { justify-content: flex-start; }
        @media (min-width: 560px) {
          .nav { flex-direction: row; align-items: center; justify-content: space-between; gap: 1rem; }
          .nav__links { justify-content: flex-end; }
        }
        .nav__mark { width: 34px; height: 34px; display: block; }
        .nav__links { display: flex; flex-wrap: wrap; gap: clamp(0.85rem, 3vw, 1.75rem);
                      list-style: none; margin: 0; padding: 0; justify-content: flex-end; }
        .nav__links a { font-size: 15px; color: var(--charcoal); text-decoration: none; }
        .nav__links a:hover { color: var(--deep); text-decoration: underline; }

        /* ----------------------------------------------------------------- */
        /* Hero                                                               */
        /* ----------------------------------------------------------------- */
        .hero { position: relative; }
        .hero__art { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
        .hero__svg { position: absolute; inset: 0; width: 100%; height: 100%; }

        /* THE CONTRAST GUARANTEE. A cream veil over the side the words sit on,
           so no line of type can land on a wash or on the copper thread. It is
           a gradient rather than careful placement because placement has to be
           got right again every time the artwork or the copy changes. */
        /* THE PHONE VEIL HOLDS LONGER THAN THE DESKTOP ONE. On a narrow screen
           the tagline sits low in the hero, which is exactly where a top-down
           fade has given up. Measured rather than guessed: charcoal over the
           wash at this strength is about 11.5:1 and the second tagline line in
           deep terracotta about 5.7:1, both clear of AA. The wash is quieter on
           a phone as a result, which is the right way round. */
        .hero__veil { position: absolute; inset: 0; z-index: 1; pointer-events: none;
                      background: linear-gradient(to bottom,
                        var(--cream) 0%, rgba(247,243,234,0.93) 52%,
                        rgba(247,243,234,0.78) 80%, rgba(247,243,234,0) 100%); }

        .hero__inner { position: relative; z-index: 2; padding: 2.5rem 0 3.5rem; }
        .hero__lockup { display: block; width: clamp(168px, 44vw, 232px); height: auto; }
        .hero__category { font-family: ${comfortaa.style.fontFamily}, system-ui, sans-serif;
                          font-weight: 400; font-size: clamp(1rem, 3.4vw, 1.1rem);
                          color: var(--forest); margin: 1.4rem 0 0.5rem; }
        .hero__join { font-size: 17px; color: var(--deep); text-decoration: underline;
                      text-underline-offset: 3px; display: inline-block; margin-bottom: 2.2rem; }
        /* MORE SPECIFIC THAN THE GENERIC HEADING RULE ON PURPOSE. The tagline
           is the one heading on the site that is NOT Cormorant: it is Comfortaa
           300, which Part Fifteen fixes and the brief repeats. Qualified with
           the element name so it outranks that rule by specificity rather than
           by source order, which a later edit can reshuffle without noticing.
           (And no backticks in here: this whole stylesheet is a template
           literal, and one backtick ends it mid-rule.) */
        .site h1.hero__tagline {
          font-family: ${comfortaa.style.fontFamily}, system-ui, sans-serif;
          font-weight: 300; font-size: clamp(2.1rem, 8vw, 3.6rem);
          line-height: 1.16; margin: 0; display: flex; flex-direction: column;
          max-width: 15em; letter-spacing: 0;
        }
        .hero__tagline .one { color: var(--charcoal); }
        /* DEEP terracotta, not the light terracotta in the design image. At this
           size brand terracotta would pass as large text, but the second line
           drops below the large-text threshold on a phone. */
        .hero__tagline .two { color: var(--deep); }

        @media (min-width: 900px) {
          .hero__inner { padding: 3rem 0 5.5rem; max-width: 58%; }
          .hero__veil { background: linear-gradient(to right,
                          var(--cream) 0%, rgba(247,243,234,0.95) 44%,
                          rgba(247,243,234,0.45) 70%, rgba(247,243,234,0) 100%); }
        }

        /* ----------------------------------------------------------------- */
        /* Generic section rhythm. Typography on cream, no cards, no borders.  */
        /* ----------------------------------------------------------------- */
        .section { position: relative; padding: clamp(3.5rem, 9vw, 6rem) 0; }
        .lede { font-size: clamp(1.25rem, 4vw, 1.6rem); line-height: 1.45;
                font-family: ${cormorant.style.fontFamily}, Georgia, serif;
                max-width: 20em; margin: 0 0 1.4rem; }
        .muted { color: var(--muted); }

        .two-col { display: grid; gap: clamp(1.5rem, 5vw, 3.5rem); }
        @media (min-width: 820px) { .two-col { grid-template-columns: 1.15fr 1fr; align-items: start; } }

        /* The thread between sections. Small, one side only, never behind text. */
        .thread { position: absolute; top: 0; right: 0; width: min(240px, 34vw); height: 110px;
                  z-index: 0; pointer-events: none; }
        .thread--flip { right: auto; left: 0; transform: scaleX(-1); }

        /* A few small circles, drawn in CSS. Large terracotta stays in the hero. */
        .dot { display: inline-block; border-radius: 50%; vertical-align: middle; }

        /* ----------------------------------------------------------------- */
        /* 3. What Selodía does                                               */
        /* ----------------------------------------------------------------- */
        .does { display: grid; gap: 2.4rem; margin-top: 2.6rem; }
        @media (min-width: 760px) {
          .does { grid-template-columns: repeat(4, 1fr); gap: 0; }
          /* A HAIRLINE BETWEEN COLUMNS, as the design shows. Not a card: no box,
             no fill, no radius, and it is gone entirely when the four statements
             stack on a phone, where a vertical rule would mean nothing. */
          .does__item { padding: 0 1.6rem; }
          .does__item + .does__item { border-left: 1px solid rgba(201, 116, 88, 0.22); }
          .does__item:first-child { padding-left: 0; }
          .does__item:last-child { padding-right: 0; }
        }
        .does__item { min-width: 0; }
        .does__dot { width: 26px; height: 26px; margin-bottom: 1rem; }
        .does__item h3 { margin-bottom: 0.6rem; }
        .does__item p { font-size: 17px; color: var(--muted); margin: 0; }

        /* ----------------------------------------------------------------- */
        /* 4. How it works                                                    */
        /* ----------------------------------------------------------------- */
        .steps { display: grid; gap: 2rem; margin: 2.6rem 0 2.4rem; }
        @media (min-width: 680px) { .steps { grid-template-columns: repeat(3, 1fr); gap: 2.5rem; } }
        .steps__n { font-family: ${cormorant.style.fontFamily}, Georgia, serif;
                    font-size: 2.6rem; color: var(--terracotta); opacity: 0.45;
                    line-height: 1; display: block; margin-bottom: 0.5rem; }
        .steps__t { margin: 0; font-size: 17px; }

        /* ----------------------------------------------------------------- */
        /* 6. When you do see someone. A band in sand, not terracotta.        */
        /* ----------------------------------------------------------------- */
        .band { background: var(--sand); padding: clamp(2.5rem, 6vw, 3.5rem) 0; }
        .band__inner { display: grid; gap: 1.25rem; align-items: center; }
        @media (min-width: 820px) { .band__inner { grid-template-columns: 1fr 1.3fr; gap: 3rem; } }
        .band h2 { font-size: clamp(1.7rem, 4.4vw, 2.3rem); }
        .band p { margin: 0; color: #4A433A; }

        /* ----------------------------------------------------------------- */
        /* 7. Your record stays yours                                         */
        /* ----------------------------------------------------------------- */
        .record { list-style: none; margin: 1.8rem 0 0; padding: 0; max-width: 34em; }
        .record li { margin: 0 0 0.7rem; }

        /* ----------------------------------------------------------------- */
        /* 9. Waiting list                                                    */
        /* ----------------------------------------------------------------- */
        .join__grid { display: grid; gap: 2.2rem; align-items: start; }
        @media (min-width: 820px) { .join__grid { grid-template-columns: 1fr 1fr; gap: 3.5rem; } }
        .form { display: flex; flex-direction: column; gap: 1.1rem; max-width: 26rem; }
        .form label { font-size: 15px; color: var(--muted); display: block; margin-bottom: 0.3rem; }
        .field { font: inherit; font-size: 17px; color: var(--charcoal);
                 background: transparent; border: 0; border-bottom: 1px solid #C9BCA9;
                 padding: 0.55rem 0; width: 100%; box-sizing: border-box; border-radius: 0; }
        .field:focus { border-bottom-color: var(--forest); }
        /* FLAT DEEP TERRACOTTA, CREAM TEXT, NO GRADIENT. Cream on #874C3A is
           7.4:1. The design image shows a lighter fill, which would be 2.9:1
           and unreadable. */
        .submit { font: inherit; font-size: 17px; font-weight: 500; cursor: pointer;
                  background: var(--deep); color: var(--cream); border: 0;
                  padding: 0.95rem 1.5rem; border-radius: 2px; width: 100%; }
        .submit:hover { background: #73402F; }
        .consent { font-size: 16px; color: var(--muted); margin: 0.2rem 0 0; max-width: 26rem; }
        .said { font-size: 17px; max-width: 26rem; }
        .said--error { color: var(--deep); }

        /* ----------------------------------------------------------------- */
        /* 10. Footer                                                         */
        /* ----------------------------------------------------------------- */
        .foot { border-top: 1px solid var(--sand); padding: 2.75rem 0 3.5rem; }
        .foot__grid { display: grid; gap: 1.75rem; }
        @media (min-width: 760px) { .foot__grid { grid-template-columns: auto 1fr auto; gap: 2.5rem; align-items: start; } }
        /* FOREST, never the terracotta lockup: this renders well under 160px
           wide and terracotta on cream is 3.10:1. */
        .foot__lockup { width: 148px; height: auto; display: block; }
        .foot p, .foot address { margin: 0 0 0.3rem; font-size: 15px; color: var(--muted);
                                 font-style: normal; line-height: 1.55; }
        .foot__links { display: flex; flex-wrap: wrap; gap: 1.1rem; list-style: none; margin: 0; padding: 0; }
        .foot__links a { font-size: 15px; }

        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
      `}</style>

      <main className="site">
        <div className="wrap">
          <nav className="nav" aria-label="Main">
            {/* eslint-disable-next-line @next/next/no-img-element -- next/image
                needs dangerouslyAllowSVG to serve an SVG at all, and there is
                nothing for the optimiser to do with a vector. */}
            <img className="nav__mark" src="/brand/mark-terracotta.svg" alt="Selodía" width={34} height={34} />
            <ul className="nav__links">
              {MASTHEAD.nav.map((n) => (
                <li key={n.href}>
                  <a href={n.href}>{n.label}</a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* 1. Masthead                                                    */}
        {/* ------------------------------------------------------------- */}
        <header className="hero">
          <div className="hero__art">
            <HeroArtwork />
          </div>
          <div className="hero__veil" />
          <div className="wrap">
            <div className="hero__inner">
              {/* eslint-disable-next-line @next/next/no-img-element -- as above.
                  The all-terracotta stacked lockup, used once, well above its
                  160px floor at every breakpoint (168px minimum). */}
              <img
                className="hero__lockup"
                src="/brand/lockup-stacked-terracotta.svg"
                alt={MASTHEAD.wordmark}
                width={442}
                height={558}
              />
              <p className="hero__category">{MASTHEAD.category}</p>
              <a className="hero__join" href="#waiting-list">
                {MASTHEAD.joinLink}
              </a>
              <h1 className="hero__tagline">
                <span className="one">{MASTHEAD.tagline[0]}</span>
                <span className="two">{MASTHEAD.tagline[1]}</span>
              </h1>
            </div>
          </div>
        </header>

        {/* ------------------------------------------------------------- */}
        {/* 2. The problem                                                 */}
        {/* ------------------------------------------------------------- */}
        <section className="section">
          <ThreadDivider />
          <div className="wrap two-col">
            <div>
              <p className="lede">{PROBLEM.lead}</p>
              <p className="muted">{PROBLEM.second}</p>
            </div>
            <div>
              {PROBLEM.aside.map((p, i) => (
                <p key={i} className={i === 0 ? undefined : 'muted'}>
                  {p}
                </p>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- */}
        {/* 3. What Selodía does                                           */}
        {/* ------------------------------------------------------------- */}
        <section className="section" id="what-it-does">
          <div className="wrap">
            <h2>{WHAT_IT_DOES.heading}</h2>
            <div className="does">
              {WHAT_IT_DOES.items.map((item, i) => (
                <div className="does__item" key={item.title}>
                  <span
                    className="dot does__dot"
                    aria-hidden="true"
                    style={{
                      background: [SAGE_TINT, SAND_TINT, TERRACOTTA, SAGE_TINT][i],
                      opacity: i === 2 ? 0.85 : 1,
                    }}
                  />
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- */}
        {/* 4. How it works                                                */}
        {/* ------------------------------------------------------------- */}
        <section className="section" id="how-it-works">
          <ThreadDivider flip />
          <div className="wrap">
            <h2>{HOW_IT_WORKS.heading}</h2>
            <ol className="steps" style={{ listStyle: 'none', padding: 0 }}>
              {HOW_IT_WORKS.steps.map((s, i) => (
                <li key={s}>
                  {/* Decorative. A screen reader hears three steps, not "zero one". */}
                  <span className="steps__n" aria-hidden="true">
                    {`0${i + 1}`}
                  </span>
                  <p className="steps__t">{s}</p>
                </li>
              ))}
            </ol>
            <a href="#waiting-list" style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>
              {HOW_IT_WORKS.joinLink}
            </a>
          </div>
        </section>

        {/* ------------------------------------------------------------- */}
        {/* 5. Built around real life                                      */}
        {/* ------------------------------------------------------------- */}
        <section className="section" id="real-life">
          <div className="wrap">
            <h2>{REAL_LIFE.heading}</h2>
            <div className="two-col" style={{ marginTop: '2.2rem' }}>
              <div>
                <p>{REAL_LIFE.paragraphs[0]}</p>
                <p>{REAL_LIFE.paragraphs[1]}</p>
              </div>
              <div>
                <p className="muted">{REAL_LIFE.paragraphs[2]}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- */}
        {/* 6. When you do see someone                                     */}
        {/* ------------------------------------------------------------- */}
        <section className="band" id="seeing-someone">
          <div className="wrap band__inner">
            <h2>{SEEING_SOMEONE.heading}</h2>
            <p>{SEEING_SOMEONE.body}</p>
          </div>
        </section>

        {/* ------------------------------------------------------------- */}
        {/* 7 and 8. Your record stays yours, and Writing                  */}
        {/* ------------------------------------------------------------- */}
        <section className="section">
          <ThreadDivider />
          <div className="wrap two-col">
            <div>
              <h2>{RECORD_STAYS_YOURS.heading}</h2>
              <ul className="record">
                {RECORD_STAYS_YOURS.sentences.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <div id="writing">
              <h2>{WRITING.heading}</h2>
              <p style={{ marginTop: '1.4rem' }}>{WRITING.body}</p>
              <a href={WRITING_URL} style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>
                {WRITING.linkText}
              </a>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- */}
        {/* 9. Waiting list                                                */}
        {/* ------------------------------------------------------------- */}
        <section className="section" id="waiting-list">
          <div className="wrap join__grid">
            <div>
              <h2>{WAITING_LIST.heading}</h2>
              <p className="muted" style={{ marginTop: '1.4rem' }}>
                {WAITING_LIST.promise}
              </p>
            </div>

            <div>
              {joined === '1' ? (
                <p className="said">{WAITING_LIST.success}</p>
              ) : (
                <>
                  <form className="form" action={join}>
                    {/* Only when there is one. An empty hidden field would be a
                        tag of "" arriving at the sanitiser, which is the same
                        null by a longer route. */}
                    {tag ? <input type="hidden" name="src" value={tag} /> : null}
                    <div>
                      <label htmlFor="wl-name">{WAITING_LIST.nameLabel}</label>
                      <input
                        className="field"
                        id="wl-name"
                        type="text"
                        name="name"
                        autoComplete="given-name"
                        maxLength={120}
                      />
                    </div>
                    <div>
                      <label htmlFor="wl-email">{WAITING_LIST.emailLabel}</label>
                      <input
                        className="field"
                        id="wl-email"
                        type="email"
                        name="email"
                        autoComplete="email"
                        required
                        maxLength={320}
                      />
                    </div>
                    <button className="submit" type="submit">
                      {WAITING_LIST.button}
                    </button>
                  </form>

                  <p className="consent">
                    {WAITING_LIST.consent.before}
                    <a href="/privacy">{WAITING_LIST.consent.linkText}</a>
                    {WAITING_LIST.consent.after}
                  </p>

                  {joined === 'error' && (
                    <p className="said said--error" style={{ marginTop: '1rem' }}>
                      {WAITING_LIST.error}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- */}
        {/* 10. Footer                                                     */}
        {/* ------------------------------------------------------------- */}
        <footer className="foot" id="contact">
          <div className="wrap foot__grid">
            {/* eslint-disable-next-line @next/next/no-img-element -- as above.
                FOREST, not terracotta: this sits at 148px, below the
                all-terracotta colourway's 160px floor. */}
            <img
              className="foot__lockup"
              src="/brand/lockup-horizontal-forest.svg"
              alt={MASTHEAD.wordmark}
              width={884}
              height={403}
            />
            <div>
              <address>
                {FOOTER.company}
                <br />
                {FOOTER.companyNumber}
                <br />
                {FOOTER.address}
              </address>
              <p>
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                <br />
                <a href={INSTAGRAM_URL} rel="me noopener">
                  Instagram {FOOTER.instagramHandle}
                </a>
              </p>
            </div>
            <ul className="foot__links">
              {FOOTER.links.map((l) => (
                <li key={l.href}>
                  <a href={l.href}>{l.label}</a>
                </li>
              ))}
            </ul>
          </div>
        </footer>
      </main>
    </>
  );
}
