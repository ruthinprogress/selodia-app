import { Comfortaa, Cormorant_Infant, Manrope } from 'next/font/google';
import { redirect } from 'next/navigation';

import {
  ChangesDiagram,
  ConnectionsDiagram,
  HowItWorksDiagram,
  RealLifeDiagram,
  RecordDiagram,
  SectionThread,
  TalkDiagram,
} from './lib/diagrams';
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
  FIRST_ARTICLE_URL,
  WRITING,
  WRITING_URL,
} from './lib/homepage-copy';
import { Reveal } from './lib/reveal';
import { sourceTag } from './lib/source-tag';
import { supabase } from './lib/supabase';

// The selodia.app homepage, rebuilt to Ruth's brief of 8 October 2026.
//
// NOT ONE WORD OF COPY LIVES IN THIS FILE. Every string comes from
// `app/lib/homepage-copy.ts`, which is the file she reads and edits. It is also
// the only way the vocabulary checks can work at all: a rule about the word
// "tracker" that has to grep a .tsx cannot see a sentence split across three
// JSX nodes.
//
// WHAT CHANGED FROM THE FIRST BUILD, and each was an instruction:
//
//   THE HERO IS HER ARTWORK NOW. The first build drew its own watercolour in
//   SVG because the files had not reached the repository. They have, so the
//   drawn version is deleted. "Delete any CSS blur or blob background. No blur
//   filters or gradients anywhere."
//
//   EVERYTHING IS CENTRED IN 1100px. "Nothing hugging the left edge."
//
//   BODY COPY IS CHARCOAL AT 17px, never pale grey. The first build used a
//   muted grey for supporting paragraphs. That is gone.
//
//   SIX DIAGRAMS instead of description. "Show, don't tell."
//
// THE JAVASCRIPT IS TWENTY LINES, in `reveal.tsx`, and the page is complete
// without it. The form still posts to a Server Action and the action redirects
// back with a query flag, so there is no bundle for the form at all.
//
// IT PINS ITS OWN COLOURS, because globals.css has a `prefers-color-scheme:
// dark` override that would take this cream page to near-black on a phone at
// night. Part Fifteen is explicit that light and dark are a deliberate in-app
// choice and never follow the system.

// ---------------------------------------------------------------------------
// Typography. Three families, each with one job.
// ---------------------------------------------------------------------------

/** Tagline (300) and category line (400). NOTHING ELSE on the page uses it. */
const comfortaa = Comfortaa({ subsets: ['latin'], weight: ['300', '400'], display: 'swap' });

/** Every heading, and the quoted sentence in the Talk diagram. Regular, never bold. */
const cormorant = Cormorant_Infant({ subsets: ['latin'], weight: ['400'], display: 'swap' });

/** All body copy, navigation, forms, diagram labels and footer. */
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
 * Deep terracotta: links, the thread, the button, and any terracotta carrying text.
 *
 * `#874C3A`, which is `accentDeep` in `mobile/src/constants/theme.ts` and the
 * value the copy master names. Part Fifteen's prose says "around `#834B39`",
 * but `#834B39` is the DARK MODE GROUND in that same file, not the light-mode
 * text colour, and the implemented token has been `#874C3A` since June.
 *
 * It measures 6.07:1 on cream, and cream on it measures 7.4:1. Brand terracotta
 * itself is 3.10:1 and fails AA for anything at body size, which is why it
 * never carries text here.
 */
const ACCENT_DEEP = '#874C3A';

/** Diagram fills only. Sage is a fill colour and never type: 2.28:1 on cream. */
const SAGE_SOFT = '#C3CEB9';
const TERRACOTTA_SOFT = '#EBC3B1';

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
// UNCHANGED, deliberately. Ruth: "Reuse the existing waitlist and its Supabase
// table. Do not rebuild it." The `waitlist` table is the only publicly writable
// one in the schema: RLS allows INSERT to anyone and grants no SELECT at all.
// ---------------------------------------------------------------------------

async function join(formData: FormData) {
  'use server';

  const email = String(formData.get('email') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const src = sourceTag(formData.get('src'));

  if (!email || !email.includes('@') || email.length > 320) {
    redirect('/?joined=error#waiting-list');
  }

  const { error } = await supabase
    .from('waitlist')
    .insert({ email, name: name.length > 0 ? name : null, src });

  // 23505 is a unique violation: they are already on the list. That is a success
  // from where they are standing.
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
          --terracotta-soft: ${TERRACOTTA_SOFT};
          --sage-soft: ${SAGE_SOFT};
          --deep: ${ACCENT_DEEP};
          --forest: ${FOREST};
          background: var(--cream);
          color: var(--charcoal);
          font-family: ${manrope.style.fontFamily}, system-ui, sans-serif;
          font-size: 17px;
          line-height: 1.62;
          overflow-x: hidden;
        }

        /* EVERYTHING CENTRED IN 1100px. Nothing hugs the left edge. */
        .wrap { width: 100%; max-width: 1100px; margin: 0 auto; padding: 0 1.5rem; box-sizing: border-box; }

        /* Headings: Cormorant Infant, regular, NEVER bold. */
        .site h1, .site h2, .site h3 {
          font-family: ${cormorant.style.fontFamily}, Georgia, serif;
          font-weight: 400;
          line-height: 1.16;
          margin: 0;
          text-wrap: balance;
          color: var(--charcoal);
        }
        .site h2 { font-size: clamp(2rem, 5vw, 2.9rem); }
        .site h3 { font-size: clamp(1.3rem, 3.4vw, 1.55rem); }

        /* BODY COPY IS CHARCOAL AT 17px, never pale grey. */
        .site p { margin: 0 0 1.1rem; max-width: 36em; font-size: 17px; color: var(--charcoal); }
        .site a { color: var(--deep); }
        .site a:focus-visible, .site button:focus-visible, .site input:focus-visible {
          outline: 2px solid var(--forest); outline-offset: 3px; border-radius: 2px;
        }

        /* ----------------------------------------------------------------- */
        /* Navigation                                                         */
        /* ----------------------------------------------------------------- */
        .nav { position: relative; z-index: 3; display: flex; flex-direction: column;
               align-items: flex-start; gap: 0.9rem; padding: 1.4rem 0 0; }
        .nav__mark { width: 36px; height: 36px; display: block; }
        .nav__links { display: flex; flex-wrap: wrap; gap: clamp(0.9rem, 3vw, 1.8rem);
                      list-style: none; margin: 0; padding: 0; justify-content: flex-start; }
        .nav__links a { font-size: 15px; color: var(--charcoal); text-decoration: none; }
        .nav__links a:hover { color: var(--deep); text-decoration: underline; }
        @media (min-width: 620px) {
          .nav { flex-direction: row; align-items: center; justify-content: space-between; }
          .nav__links { justify-content: flex-end; }
        }

        /* ----------------------------------------------------------------- */
        /* Hero. HER ARTWORK, no blur, no gradient, never scaled up.          */
        /* ----------------------------------------------------------------- */
        .hero { position: relative; isolation: isolate; }

        /* WHERE THE ARTWORK IS EMPTY, MEASURED RATHER THAN EYEBALLED.
           scripts/hero-clear-zones.mjs divides each file into a 6x6 grid and
           reports the contrast charcoal would have against the WORST pixel in
           each cell, not the average, because one copper line through an
           otherwise empty square is exactly the case that matters.

             WIDE  clear from 33% to 66% down, 0% to 67% across (8.1 to 12.4),
                   and the far-left column stays clear from the very top.
             TALL  clear through the whole middle third, full width (12.4).

           Both files are dense top-right and bottom-left, so the type runs down
           the left and stops before the lower corner. The mask below then fades
           the artwork out underneath the tagline, so the composite is cleaner
           than the source measurement. */
        .hero__art {
          position: absolute; top: 0; left: 0; right: 0; z-index: 0; pointer-events: none;
          background-repeat: no-repeat;
          background-position: top center;
          background-image: url('/brand/hero-tall-720.webp');
          background-size: 100% auto;
          /* At its own aspect ratio, never cropped and never scaled up, so the
             measured percentages above mean the same thing on every screen. */
          aspect-ratio: 1072 / 1467;
          /* THE LOWER EDGE FADES INTO THE PAGE CREAM, and nothing else does.
             A mask rather than a gradient overlay, so the cream underneath is
             the page's own cream and cannot drift from it. On a phone it starts
             fading at the point the measurement says the artwork stops being
             empty, which is what keeps the tagline on clean ground. */
          -webkit-mask-image: linear-gradient(to bottom, #000 0%, #000 52%, transparent 86%);
          mask-image: linear-gradient(to bottom, #000 0%, #000 52%, transparent 86%);
        }
        @media (min-width: 721px) {
          .hero__art { background-image: url('/brand/hero-tall-1072.webp'); }
        }
        /* DESKTOP: the wide artwork. 1774px is its natural width and the cap. */
        @media (min-width: 900px) {
          .hero__art {
            background-image: url('/brand/hero-wide-1774.webp');
            aspect-ratio: 1774 / 887;
            /* FADES EARLIER THAN IT LOOKS LIKE IT NEEDS TO, and the reason is
               measured. The tagline's second line is deep terracotta, which
               starts at 6.07:1 on cream and has far less to give away than
               charcoal. With the fade ending at 94% that line sat on a
               terracotta wash at 2.71:1, under the 3:1 floor for large text,
               while the charcoal line above it was comfortably fine at 5.7:1.
               Ending the fade at 74% puts the whole tagline on clean cream.
               check-hero-text-contrast.mjs is the arithmetic. */
            -webkit-mask-image: linear-gradient(to bottom, #000 0%, #000 42%, transparent 74%);
            mask-image: linear-gradient(to bottom, #000 0%, #000 42%, transparent 74%);
          }
        }
        @media (min-width: 1774px) {
          /* Never wider than the file itself. */
          .hero__art { background-size: 1774px auto; background-position: top center; }
        }

        .hero__inner { position: relative; z-index: 2; padding: 2.5rem 0 4rem; }
        .hero__lockup { display: block; width: clamp(168px, 42vw, 230px); height: auto; }
        .hero__category { font-family: ${comfortaa.style.fontFamily}, system-ui, sans-serif;
                          font-weight: 400; font-size: clamp(1rem, 3.2vw, 1.1rem);
                          color: var(--forest); margin: 1.4rem 0 0.5rem; }
        .hero__join { font-size: 17px; color: var(--deep); text-decoration: underline;
                      text-underline-offset: 3px; display: inline-block; margin-bottom: 2.4rem; }

        /* THE TAGLINE SITS ON EMPTY CREAM, never over a circle. The artwork's
           dense area is top-right on both files, so the type runs down the left
           on desktop and below the wash on a phone. */
        .site h1.hero__tagline {
          font-family: ${comfortaa.style.fontFamily}, system-ui, sans-serif;
          font-weight: 300; font-size: clamp(2.05rem, 7.2vw, 3.5rem);
          line-height: 1.18; margin: 0; display: flex; flex-direction: column;
          max-width: 15em; letter-spacing: 0;
        }
        .hero__tagline .one { color: var(--charcoal); }
        .hero__tagline .two { color: var(--deep); }

        @media (min-width: 900px) {
          .hero__inner { padding: 3rem 0 6rem; max-width: 56%; }
        }

        /* ----------------------------------------------------------------- */
        /* Section rhythm                                                     */
        /* ----------------------------------------------------------------- */
        /* TIGHTER THAN THE FIRST BUILD, at her instruction to reduce the large
           empty gaps while keeping the calm. The clamp still grows with the
           screen; it just starts and stops lower. */
        .section { position: relative; padding: clamp(2.25rem, 5vw, 3.75rem) 0; }
        .section--sand { background: var(--sand); }
        .section--sand p, .section--sand h2 { color: #3A3129; }

        .two-col { display: grid; gap: clamp(1.5rem, 4vw, 3.25rem); align-items: start; }
        @media (min-width: 860px) { .two-col { grid-template-columns: 1.05fr 1fr; } }

        .lede { font-size: clamp(1.15rem, 3.2vw, 1.3rem); line-height: 1.5; max-width: 22em; }

        /* The seam between sections. Its own block, so it can never sit behind text. */
        .seam { width: 100%; max-width: 1100px; margin: 0 auto; padding: 0 1.5rem;
                box-sizing: border-box; line-height: 0; }
        .seam-svg { width: 100%; height: clamp(60px, 9vw, 110px); display: block; }
        .seam--flip .seam-svg { transform: scaleX(-1); }

        /* ----------------------------------------------------------------- */
        /* Diagrams                                                           */
        /* ----------------------------------------------------------------- */
        .dg { margin: 0; position: relative; }
        .dg-svg { width: 100%; height: auto; display: block; overflow: visible; }
        /* Labels are real text at 17px, in Manrope, at full contrast. */
        .dg-label { fill: var(--charcoal); font-family: ${manrope.style.fontFamily}, system-ui, sans-serif; }
        .dg-centre { fill: var(--deep); font-family: ${cormorant.style.fontFamily}, Georgia, serif; }
        .dg-quote { fill: var(--charcoal); font-family: ${cormorant.style.fontFamily}, Georgia, serif; }
        /* The text alternative. Present for screen readers, not shown. */
        .dg-alt { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
                  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

        /* NARROW BY DEFAULT, WIDE WHEN THERE IS ROOM, and this is a hard floor
           rather than a preference. An SVG label's size on screen is its
           font-size times the viewBox scale: a 630-unit viewBox on a 390px
           phone renders a 17px label at 9.2px. Measured in the browser, because
           the stylesheet says 17 either way. Each wide diagram therefore has a
           narrow twin built for about 320 units, where 17 means 17. */
        .dg--wide { display: none; }
        .dg--narrow { display: block; }
        @media (min-width: 820px) {
          .dg--wide { display: block; }
          .dg--narrow { display: none; }
        }
        /* EVERY CAP MATCHES ITS VIEWBOX WIDTH, so the scale is 1 and a 17px
           label is 17px on the glass. That is the whole sizing rule. */
        .dg--connections.dg--wide { max-width: 480px; margin: 0 auto; }
        .dg--connections.dg--narrow { max-width: 320px; margin: 0 auto; }
        .dg--how.dg--narrow { max-width: 320px; }
        .dg--how.dg--wide { max-width: 1030px; }
        .dg--real.dg--narrow { max-width: 320px; }
        .dg--real.dg--wide { max-width: 700px; }
        /* These two sit inside a quarter-width column, which is about 245px on
           a 1100px page, so they are drawn for 200 and capped at 200. */
        .dg--talk { max-width: 200px; }
        .dg--record { max-width: 200px; }
        .dg--changes { max-width: 200px; }

        /* ----------------------------------------------------------------- */
        /* 3. What Selodía does. FOUR HEADINGS ON ONE TOP LINE.               */
        /* ----------------------------------------------------------------- */
        .does { display: grid; gap: 2.25rem; margin-top: 2.2rem; }
        @media (min-width: 860px) {
          .does { grid-template-columns: repeat(4, 1fr); gap: 2rem;
                  /* Named rows, so every heading starts on the same line
                     whatever the column beside it does, and so do the
                     paragraphs and the pictures. This is the "align the four
                     statement headings to one top line" instruction, done by
                     the grid rather than by hoping the text is the same
                     length. */
                  grid-template-rows: auto auto auto; }
          .does__item { display: grid; grid-row: span 3; grid-template-rows: subgrid; gap: 0.7rem; }
        }
        .does__item { min-width: 0; }
        .does__item h3 { align-self: start; margin-bottom: 0.6rem; }
        .does__item p { font-size: 17px; margin: 0 0 0.9rem; }
        .does__fig { margin-top: 0.2rem; }
        .does__fig:empty { display: none; }

        /* ----------------------------------------------------------------- */
        /* 9. Waiting list                                                    */
        /* ----------------------------------------------------------------- */
        .join__grid { display: grid; gap: 2.25rem; align-items: start; }
        @media (min-width: 860px) { .join__grid { grid-template-columns: 1fr 1fr; gap: 3.5rem; } }
        .form { display: flex; flex-direction: column; gap: 1.1rem; max-width: 26rem; }
        .form label { font-size: 15px; color: #5A5249; display: block; margin-bottom: 0.3rem; }
        .field { font: inherit; font-size: 17px; color: var(--charcoal); background: transparent;
                 border: 0; border-bottom: 1px solid #C2B4A1; padding: 0.55rem 0; width: 100%;
                 box-sizing: border-box; border-radius: 0; }
        .field:focus { border-bottom-color: var(--forest); }
        /* FLAT DEEP TERRACOTTA, CREAM TEXT, NO GRADIENT. 7.4:1. */
        .submit { font: inherit; font-size: 17px; font-weight: 500; cursor: pointer;
                  background: var(--deep); color: var(--cream); border: 0;
                  padding: 0.95rem 1.5rem; border-radius: 2px; width: 100%; }
        .submit:hover { background: #73402F; }
        .consent { font-size: 16px; color: #5A5249; margin: 0.4rem 0 0; max-width: 26rem; }
        .said { font-size: 17px; max-width: 26rem; }
        .said--error { color: var(--deep); }

        /* ----------------------------------------------------------------- */
        /* 10. Footer                                                         */
        /* ----------------------------------------------------------------- */
        .foot { border-top: 1px solid var(--sand); padding: 2.75rem 0 3.5rem; }
        .foot__grid { display: grid; gap: 1.75rem; }
        @media (min-width: 800px) { .foot__grid { grid-template-columns: auto 1fr auto; gap: 2.5rem; align-items: start; } }
        /* FOREST, never terracotta: 148px is below the colourway's 160px floor. */
        .foot__lockup { width: 148px; height: auto; display: block; }
        .foot p, .foot address { margin: 0 0 0.3rem; font-size: 15px; color: #5A5249;
                                 font-style: normal; line-height: 1.55; max-width: none; }
        .foot__links { display: flex; flex-wrap: wrap; gap: 1.1rem; list-style: none; margin: 0; padding: 0; }
        .foot__links a { font-size: 15px; }

        /* ----------------------------------------------------------------- */
        /* Motion. THE FINISHED STATE IS THE DEFAULT.                         */
        /* ----------------------------------------------------------------- */
        /* EVERY RULE THAT HIDES ANYTHING IS BEHIND .js-reveal, and that is the
           whole safety design rather than a detail.

           The first version of this hid un-revealed diagrams in CSS alone, and
           I wrote a comment next to it claiming the page failed open. It did
           not. The CSS hid them whenever .is-in was absent, which includes
           every case where the script is slow, blocked, throws, or never loads,
           and in those cases six diagrams were simply invisible for ever.

           Now the script's own first act is to add .js-reveal to the document.
           No script, no class, nothing hidden: the page renders complete and
           static. Hiding is something only a working animator is allowed to do. */
        .thread-draw { stroke-dasharray: 1400; stroke-dashoffset: 0; }
        .fade-up { opacity: 1; }

        @media (prefers-reduced-motion: no-preference) {
          .js-reveal [data-reveal]:not(.is-in) .thread-draw { stroke-dashoffset: 1400; }
          .js-reveal [data-reveal]:not(.is-in) .fade-up { opacity: 0; }
          [data-reveal].is-in .thread-draw {
            animation: draw 1200ms cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
          }
          [data-reveal].is-in .fade-up {
            animation: rise 620ms cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
          }
        }
        @keyframes draw { from { stroke-dashoffset: 1400; } to { stroke-dashoffset: 0; } }
        @keyframes rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

        @media (prefers-reduced-motion: reduce) {
          .thread-draw, .fade-up { animation: none !important; opacity: 1 !important;
                                   stroke-dashoffset: 0 !important; transform: none !important; }
        }
      `}</style>

      <Reveal />

      <main className="site">
        <div className="wrap">
          <nav className="nav" aria-label="Main">
            {/* eslint-disable-next-line @next/next/no-img-element -- next/image
                needs dangerouslyAllowSVG to serve an SVG at all, and there is
                nothing for the optimiser to do with a vector. */}
            <img className="nav__mark" src="/brand/mark-terracotta.svg" alt="Selodía" width={36} height={36} />
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
          <div className="hero__art" />
          <div className="wrap">
            <div className="hero__inner">
              {/* eslint-disable-next-line @next/next/no-img-element -- as above.
                  The all-terracotta stacked lockup, used once, at 168px minimum,
                  above the 160px floor its 3.10:1 contrast earns it. */}
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
        {/* 2. The problem, with the centre diagram beside it              */}
        {/* ------------------------------------------------------------- */}
        <section className="section" data-reveal>
          <div className="wrap two-col">
            <div>
              {/* A HEADING NOW, at her instruction of 8 October. The first build
                  kept it inside the paragraph because the copy master set it as
                  one sentence; she has since asked for it as a Cormorant
                  heading, and the rest of her sentence follows it unchanged. */}
              <h2>{PROBLEM.leadHeading}</h2>
              <p className="lede" style={{ marginTop: '1.4rem' }}>
                {PROBLEM.leadRest}
              </p>
              <p>{PROBLEM.second}</p>
            </div>
            <div>
              <ConnectionsDiagram />
            </div>
          </div>
        </section>

        <SectionThread />

        <section className="section" data-reveal>
          <div className="wrap">
            <div>
              <h2>{PROBLEM.asideHeading}</h2>
              <p style={{ marginTop: '1.4rem' }}>{PROBLEM.asideBody}</p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- */}
        {/* 3. What Selodía does                                           */}
        {/* ------------------------------------------------------------- */}
        <section className="section" id="what-it-does" data-reveal>
          <div className="wrap">
            <h2>{WHAT_IT_DOES.heading}</h2>
            <div className="does">
              {WHAT_IT_DOES.items.map((item, i) => (
                <div className="does__item" key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                  {/* Each picture under the statement it illustrates, at her
                      instruction of 8 October. Both are built for 200 units so
                      that inside a quarter-width column the scale is 1 and the
                      labels are the 17px they claim to be. */}
                  <div className="does__fig">
                    {[<TalkDiagram key="t" />, <RecordDiagram key="r" />, null, null][i]}
                  </div>
                </div>
              ))}
            </div>
            {/* UNLABELLED, so it is the one diagram that can be any size. It
                sits under the four statements as the transition into How it
                works, which is also what it means: small changes, tried over
                weeks, leading somewhere. */}
            <div style={{ maxWidth: 200, margin: '1.6rem auto 0' }}>
              <ChangesDiagram />
            </div>
          </div>
        </section>

        <SectionThread flip />

        {/* ------------------------------------------------------------- */}
        {/* 4. How it works                                                */}
        {/* ------------------------------------------------------------- */}
        <section className="section" id="how-it-works" data-reveal>
          <div className="wrap">
            <h2>{HOW_IT_WORKS.heading}</h2>
            <div style={{ margin: '2.4rem 0 2rem' }}>
              <HowItWorksDiagram />
            </div>
            <a href="#waiting-list" style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>
              {HOW_IT_WORKS.joinLink}
            </a>
          </div>
        </section>

        {/* ------------------------------------------------------------- */}
        {/* 5. Built around real life                                      */}
        {/* ------------------------------------------------------------- */}
        <section className="section" id="real-life" data-reveal>
          <div className="wrap">
            <h2>{REAL_LIFE.heading}</h2>
            <div style={{ margin: '2.2rem 0 2.4rem' }}>
              <RealLifeDiagram />
            </div>
            <div className="two-col">
              <div>
                <p>{REAL_LIFE.paragraphs[0]}</p>
                <p>{REAL_LIFE.paragraphs[1]}</p>
              </div>
              <div>
                <p>{REAL_LIFE.paragraphs[2]}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- */}
        {/* 6. When you do see someone                                     */}
        {/* ------------------------------------------------------------- */}
        <section className="section section--sand" id="seeing-someone" data-reveal>
          <div className="wrap two-col">
            <h2>{SEEING_SOMEONE.heading}</h2>
            <p>{SEEING_SOMEONE.body}</p>
          </div>
        </section>

        {/* ------------------------------------------------------------- */}
        {/* 7 and 8. Your record stays yours, and Writing                  */}
        {/* ------------------------------------------------------------- */}
        <section className="section" data-reveal>
          <div className="wrap two-col">
            <div>
              <h2>{RECORD_STAYS_YOURS.heading}</h2>
              <div style={{ marginTop: '1.6rem' }}>
                {RECORD_STAYS_YOURS.sentences.map((s) => (
                  <p key={s} style={{ marginBottom: '0.6rem' }}>
                    {s}
                  </p>
                ))}
              </div>
            </div>
            <div id="writing">
              <h2>{WRITING.heading}</h2>
              <p style={{ marginTop: '1.5rem' }}>{WRITING.body}</p>
              {/* The article first, then the publication. Somebody who has
                  come this far wants the piece, not the index of it. */}
              <p style={{ marginTop: '1.5rem' }}>
                <a
                  href={FIRST_ARTICLE_URL}
                  style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}
                >
                  {WRITING.firstArticle}
                </a>
              </p>
              <a href={WRITING_URL} style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>
                {WRITING.linkText}
              </a>
            </div>
          </div>
        </section>

        <SectionThread />

        {/* ------------------------------------------------------------- */}
        {/* 9. Waiting list                                                */}
        {/* ------------------------------------------------------------- */}
        <section className="section" id="waiting-list" data-reveal>
          <div className="wrap join__grid">
            <div>
              <h2>{WAITING_LIST.heading}</h2>
              <p style={{ marginTop: '1.4rem' }}>{WAITING_LIST.promise}</p>
            </div>

            <div>
              {joined === '1' ? (
                <p className="said">{WAITING_LIST.success}</p>
              ) : (
                <>
                  <form className="form" action={join}>
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
            {/* eslint-disable-next-line @next/next/no-img-element -- as above. */}
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
