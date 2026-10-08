import type { ReactNode } from 'react';
import { Cormorant_Infant, Manrope } from 'next/font/google';

import { CONTACT_EMAIL, FOOTER, INSTAGRAM_URL, MASTHEAD } from './homepage-copy';

// The plain public pages at selodia.app: privacy, terms, support and
// delete-account. One layout so they read as one set, and so a store reviewer
// following a link from any of them lands on something that looks like the same
// company.
//
// RESTYLED 8 OCTOBER 2026 to match the rebuilt homepage. Ruth: "Build real
// /privacy, /terms and /support pages in the same style, with stable URLs."
// The URLs are unchanged, which is the part that matters most: Apple and Google
// hold these addresses in a store listing, and a page that moves is a rejected
// submission. Only the typography, the palette and the footer changed.
//
// It takes its type and its company details from `homepage-copy.ts` rather than
// restating them, so the address in the footer cannot drift from the address on
// the homepage.
//
// NO CLIENT JAVASCRIPT, matching the homepage: each is one server-rendered
// document.

const cormorant = Cormorant_Infant({ subsets: ['latin'], weight: ['400'], display: 'swap' });
const manrope = Manrope({ subsets: ['latin'], weight: ['400', '500'], display: 'swap' });

const CREAM = '#F7F3EA';
const SAND = '#E9D6C2';
const CHARCOAL = '#2D2B28';
const FOREST = '#37584A';
/** `accentDeep`. 6.07:1 on cream; brand terracotta is 3.10:1 and never carries text. */
const ACCENT_DEEP = '#874C3A';
const MUTED = '#6B6258';

export type PlainSection = { heading: string; body: (ReactNode | ReactNode[])[] };

export function PlainPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated?: string;
  intro?: ReactNode;
  sections: PlainSection[];
}) {
  return (
    <main className="plain" style={{ background: CREAM, color: CHARCOAL }}>
      <style>{`
        body:has(.plain) { background: ${CREAM}; margin: 0; }
        .plain {
          font-family: ${manrope.style.fontFamily}, system-ui, sans-serif;
          /* The same 17px floor as the homepage. These pages were at 15.2px. */
          font-size: 17px;
          line-height: 1.65;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          overflow-x: hidden;
        }
        .plain__body { flex: 1; padding: 2.5rem 1.25rem 4rem; }
        .wrap { width: 100%; max-width: 44rem; margin: 0 auto; box-sizing: border-box; }

        .plain h1, .plain h2 {
          font-family: ${cormorant.style.fontFamily}, Georgia, serif;
          font-weight: 400;
          line-height: 1.15;
          margin: 0;
          text-wrap: balance;
        }
        .plain h1 { font-size: clamp(2.1rem, 6vw, 3rem); color: ${CHARCOAL}; margin-bottom: .35rem; }
        .plain h2 { font-size: clamp(1.35rem, 4vw, 1.7rem); color: ${CHARCOAL}; margin: 2.75rem 0 .9rem; }
        .updated { font-size: 15px; color: ${MUTED}; margin: 0 0 2.5rem; }
        .intro { margin-top: 1rem; }
        .plain p, .plain li { margin: 0 0 1rem; max-width: 36em; }
        .plain ul, .plain ol { padding-left: 1.15rem; margin: 0 0 1rem; list-style: disc; }
        .plain li { margin-bottom: .6rem; }
        .plain a { color: ${ACCENT_DEEP}; }
        .plain a:focus-visible { outline: 2px solid ${FOREST}; outline-offset: 3px; border-radius: 2px; }

        /* The same footer as the homepage, so the two read as one site and a
           reviewer landing straight on /privacy still sees a real company. */
        .plain__foot { border-top: 1px solid ${SAND}; padding: 2.5rem 1.25rem 3.25rem; }
        .foot__grid { display: grid; gap: 1.75rem; width: 100%; max-width: 44rem; margin: 0 auto;
                      box-sizing: border-box; }
        @media (min-width: 760px) { .foot__grid { grid-template-columns: auto 1fr auto; gap: 2.5rem; align-items: start; } }
        /* Forest, never the all-terracotta colourway: this renders at 132px and
           terracotta on cream is 3.10:1. */
        .foot__lockup { width: 132px; height: auto; display: block; }
        .plain__foot p, .plain__foot address { margin: 0 0 .3rem; font-size: 15px; color: ${MUTED};
                                               font-style: normal; line-height: 1.55; max-width: none; }
        .foot__links { display: flex; flex-wrap: wrap; gap: 1.1rem; list-style: none; margin: 0; padding: 0; }
        .foot__links a { font-size: 15px; }
      `}</style>

      <div className="plain__body">
        <div className="wrap">
          <h1>{title}</h1>
          {updated && <p className="updated">Last updated {updated}</p>}
          {intro && <div className="intro">{intro}</div>}

          {sections.map((s) => (
            <section key={s.heading}>
              <h2>{s.heading}</h2>
              {s.body.map((block, i) =>
                Array.isArray(block) ? (
                  <ul key={i}>
                    {block.map((li, j) => (
                      <li key={j}>{li}</li>
                    ))}
                  </ul>
                ) : (
                  <p key={i}>{block}</p>
                )
              )}
            </section>
          ))}
        </div>
      </div>

      <footer className="plain__foot">
        <div className="foot__grid">
          {/* eslint-disable-next-line @next/next/no-img-element -- next/image
              needs dangerouslyAllowSVG to serve an SVG at all, and there is
              nothing for the optimiser to do with a vector. */}
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
            <li>
              <a href="/">Home</a>
            </li>
            {FOOTER.links.map((l) => (
              <li key={l.href}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
            <li>
              <a href="/delete-account">Delete your account</a>
            </li>
          </ul>
        </div>
      </footer>
    </main>
  );
}
