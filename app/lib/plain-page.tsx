import type { ReactNode } from 'react';
import { Comfortaa } from 'next/font/google';

// The plain public pages at selodia.app - privacy, delete-account and support.
// One layout so they read as one set, and so a store reviewer following a link
// from any of them lands on something that looks like the same company.
//
// NO CLIENT JAVASCRIPT, matching the landing page: each is one server-rendered
// document.

const comfortaa = Comfortaa({ variable: '--font-comfortaa', subsets: ['latin'] });

const CREAM = '#F7F3EA';
const CHARCOAL = '#2D2B28';
const ACCENT_DEEP = '#874C3A';
const SAND = '#E9D6C2';
const GREY = '#5F574D';

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
    <main className={`${comfortaa.variable} selodia`} style={{ background: CREAM, color: CHARCOAL }}>
      <style>{`
        body:has(.selodia) { background: ${CREAM}; margin: 0; }
        .selodia { min-height: 100vh; padding: 3rem 1.5rem 5rem; }
        .wrap { max-width: 42rem; margin: 0 auto; }
        .wrap h1 { font-family: var(--font-comfortaa), system-ui, sans-serif;
                   font-size: 2rem; font-weight: 700; color: ${ACCENT_DEEP};
                   margin: 0 0 .25rem; letter-spacing: -0.01em; }
        .updated { font-size: .8rem; color: ${GREY}; margin: 0 0 2.5rem; }
        .intro { margin-top: 1rem; }
        .wrap h2 { font-family: var(--font-comfortaa), system-ui, sans-serif;
                   font-size: 1.05rem; font-weight: 700; color: ${ACCENT_DEEP};
                   margin: 2.25rem 0 .6rem; }
        .wrap p, .wrap li { font-size: .95rem; line-height: 1.65; margin: 0 0 .9rem; }
        .wrap ul, .wrap ol { padding-left: 1.1rem; margin: 0 0 1rem; list-style: disc; }
        .wrap li { margin-bottom: .5rem; }
        .rule { height: 1px; background: ${SAND}; border: 0; margin: 2.5rem 0 1rem; }
        .foot { font-size: .8rem; color: ${GREY}; }
        a { color: ${ACCENT_DEEP}; }
      `}</style>

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

        <hr className="rule" />
        <p className="foot">
          <a href="/privacy">Privacy</a> · <a href="/delete-account">Delete your account</a> ·{' '}
          <a href="/support">Support</a>
        </p>
      </div>
    </main>
  );
}
