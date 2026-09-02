import { Comfortaa } from 'next/font/google';
import { redirect } from 'next/navigation';

import { supabase } from './lib/supabase';

// The selodia.app landing page.
//
// A MARKETING PAGE IN AN API-ONLY PROJECT. The original web frontend was retired
// (Part Four) and the root route has 404'd ever since; this puts something back
// at `/`, deliberately unrelated to the app itself. The mobile app is not served
// from here and never will be — this is the page a stranger lands on.
//
// NO CLIENT JAVASCRIPT AT ALL. The form posts to a Server Action and the action
// redirects back with a query flag, which the page reads to decide what to show.
// That is why there is no 'use client', no useActionState and no loading state:
// the whole thing is one server-rendered document with a form in it. For a page
// whose entire job is a logo, four sentences and an email field, shipping a
// React bundle to achieve it would be the wrong trade.
//
// IT PINS ITS OWN COLOURS. globals.css sets `body { background: var(--background) }`
// with a `prefers-color-scheme: dark` override, which would take this cream page
// to near-black on a phone in dark mode. Part Fifteen is explicit that light/dark
// is a deliberate in-app choice and never follows the system setting, so the
// landing page states its palette outright rather than inheriting one.

// ONE TYPEFACE FOR THE WHOLE LOCKUP: Comfortaa. Wordmark 300, tagline 300,
// category 400. Confirmed 2026-09-02 by comparison testing with real readers,
// not by looking at it - the Work Sans italic this page carried until then was
// reported as fuzzy and hard to read by a 40+ audience, and an upright sans read
// as an instruction. Part Fifteen holds the full reasoning.
//
// That decision also dissolves the mistake made here the day before, when the
// wordmark was set in the tagline's face because a brief quoted one setting
// under the other's heading. With a single family there is no pairing left to
// get backwards, which is worth more than the fix was.
const comfortaa = Comfortaa({
  subsets: ['latin'],
  // 300 carries the wordmark, the tagline and the waiting-list line; 400 the
  // category line. 500 is gone with the heavier wordmark - nothing on the page
  // asks for it now, and shipping a weight nothing uses is a font file for
  // nobody.
  weight: ['300', '400'],
  display: 'swap',
});

// Part Fifteen, confirmed palette.
const CREAM = '#F7F3EA';
const CHARCOAL = '#2D2B28';
const TERRACOTTA = '#C97458';
const SAGE = '#95A987';
const FOREST = '#37584A';
const SAND = '#E9D6C2';

export const metadata = {
  title: 'Selodía',
  description: 'A body literacy app for women 40+. Coming 2027.',
};

// Adding somebody to the waitlist.
//
// The `waitlist` table is the only publicly writable one in the schema: RLS
// allows INSERT to anyone and grants no SELECT at all, so a stranger can add
// themselves and nobody can read the list back through the API. The anon key
// used here is the same one already public in the mobile bundle, and it buys an
// attacker nothing beyond the ability to add a row.
async function join(formData: FormData) {
  'use server';

  const email = String(formData.get('email') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();

  // The browser already enforces type="email" and required; this is the version
  // that survives a request that did not come from the browser.
  if (!email || !email.includes('@') || email.length > 320) {
    redirect('/?joined=error');
  }

  const { error } = await supabase
    .from('waitlist')
    .insert({ email, name: name.length > 0 ? name : null });

  // 23505 is a unique violation — they are already on the list. That is a
  // success from where they are standing, and telling somebody already signed up
  // that something went wrong would be both untrue and alarming.
  if (error && error.code !== '23505') {
    console.log('WAITLIST INSERT FAILED:', error.message);
    redirect('/?joined=error');
  }

  redirect('/?joined=1');
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ joined?: string }>;
}) {
  const { joined } = await searchParams;

  return (
    <>
      <style>{`
        body:has(.selodia) { background: ${CREAM}; }
        .selodia {
          min-height: 100dvh;
          background: ${CREAM};
          color: ${CHARCOAL};
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          /* Scales with viewport height rather than sitting at a fixed 2rem.
             Measured at 375x812 the fixed value made the column 841px tall -
             29px of scroll on a page that should sit still. A page that almost
             fits is more unsettling than one that clearly scrolls. */
          gap: clamp(1.15rem, 2.9vh, 2rem);
          padding: clamp(2rem, 5vh, 3rem) 1.5rem clamp(2.5rem, 6vh, 4rem);
          text-align: center;
          box-sizing: border-box;
        }
        .selodia__mark { width: 132px; height: 132px; }
        /* Part Fifteen: wordmark is Comfortaa 300, upright, lowercase, charcoal.
           Comfortaa was chosen against Quicksand, Montserrat, Century Gothic and
           a monospace as the most cohesive pairing with the Seed Mark - its
           rounded bowls answer the mark's curves. The weight dropped from 500 to
           300 on 2026-09-02 with the one-family decision. No tracking anywhere
           in this lockup any more. */
        .selodia__wordmark {
          font-family: ${comfortaa.style.fontFamily};
          font-weight: 300;
          font-size: clamp(2.5rem, 11vw, 3.9rem);
          line-height: 1;
          margin: 0;
        }
        /* Part Fifteen: tagline is Comfortaa 300, charcoal. One family for the
           whole lockup, confirmed 2026-09-02 by readers rather than by looking:
           the Work Sans italic that stood here read as fuzzy and hard to read for
           a 40+ audience, and an upright sans read as an instruction. The +0.085em
           tracking went with the italic it existed to support. */
        .selodia__tagline {
          font-family: ${comfortaa.style.fontFamily};
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          font-size: clamp(1rem, 4.2vw, 1.35rem);
          font-weight: 300;
          line-height: 1.75;
          max-width: 22ch;
          margin: 0;
        }
        /* Each sentence gets its own line once there is room for one. The 22ch
           cap above is a phone measure - it keeps the tagline from running the
           full width of a small screen - but on a desktop it was forcing both
           sentences to wrap mid-thought, four lines for two sentences. Above the
           breakpoint the cap comes off and each span refuses to break, so the
           line break falls where the full stop is and nowhere else.

           360px, and the number has been re-measured at every change rather
           than carried forward. Measured with the current setting (Comfortaa
           300, no tracking, 16px at these widths, longest sentence 282px):
           400px leaves 56px of headroom, 375px leaves 45px, 360px leaves 30px,
           and 320px is 10px SHORT - it would overflow, so it must wrap.

           360 rather than the 400 the italic needed, because Comfortaa is a wide
           face and its fallback during swap is narrower, not wider - so the
           transient risk that made a thin margin dangerous with Work Sans does
           not apply here. That buys back every 360px Android, which is a lot of
           phones, at a 30px cushion. */
        @media (min-width: 360px) {
          .selodia__tagline { max-width: none; }
          .selodia__tagline span { white-space: nowrap; }
        }
        /* Part Fifteen: category line is Comfortaa regular (400), forest. */
        .selodia__category {
          font-family: ${comfortaa.style.fontFamily};
          font-size: 0.9rem;
          font-weight: 400;
          letter-spacing: 0.02em;
          color: ${FOREST};
          margin: 0;
        }
        /* Widened from 44px and given room either side: it is the beat between
           the brand statement and the ask, and the eye should cross it. */
        .selodia__rule {
          width: 56px; height: 1px; background: ${SAND}; border: 0;
          margin: clamp(0.4rem, 1.4vh, 1rem) 0;
        }
        /* A footnote, not a second headline. It was competing with the tagline
           at 1rem in full-strength charcoal - two things asking to be read first,
           and the tagline losing because the paragraph below it was longer.
           Smaller, genuinely lighter (Comfortaa 300, loaded above), and dropped
           to 70% charcoal.
           
           70% and no further, deliberately. Blended on cream that is #6A6762 at
           5.08:1, which clears AA for normal text; the next step down, 65%, is
           4.39:1 and fails. This line says when the app arrives and what the form
           does - it is receding, not decorative, and the audience is 40+. */
        .selodia__soon {
          /* Floor raised from 0.8rem: at 375px that resolved to 12.8px, which
             is too small to ask a 40+ reader to work at, and the weight and the
             70% charcoal already do most of the receding. */
          font-size: clamp(0.85rem, 3.2vw, 0.875rem);
          font-weight: 300;
          line-height: 1.65;
          letter-spacing: 0.01em;
          /* Wide enough to fall in two lines rather than three - a short
             stack of three centred lines reads as a block and reclaims the
             attention the smaller type just gave up. */
          max-width: 46ch;
          margin: 0;
          color: ${CHARCOAL};
          opacity: 0.7;
        }
        .selodia__form {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          width: 100%;
          max-width: 22rem;
        }
        .selodia__field {
          font: inherit;
          font-size: 1rem;
          padding: 0.85rem 1rem;
          border: 1px solid ${SAND};
          border-radius: 0.65rem;
          background: #FFFFFF;
          color: ${CHARCOAL};
          width: 100%;
          box-sizing: border-box;
        }
        .selodia__field::placeholder { color: #9A9086; }
        .selodia__field:focus-visible { outline: 2px solid ${SAGE}; outline-offset: 2px; border-color: ${SAGE}; }
        .selodia__submit {
          font: inherit;
          font-size: 1rem;
          font-weight: 400;
          padding: 0.9rem 1rem;
          border: 0;
          border-radius: 0.65rem;
          background: ${TERRACOTTA};
          color: ${CREAM};
          cursor: pointer;
        }
        .selodia__submit:hover { background: #B9694E; }
        .selodia__submit:focus-visible { outline: 2px solid ${FOREST}; outline-offset: 2px; }
        .selodia__said {
          font-size: 1rem;
          font-weight: 400;
          line-height: 1.6;
          max-width: 30ch;
          color: ${FOREST};
          margin: 0;
        }
        .selodia__error { color: ${TERRACOTTA}; }
        @media (prefers-reduced-motion: reduce) {
          .selodia__mark { animation: none; }
        }
      `}</style>

      <main className={`selodia ${comfortaa.className}`}>
        {/* The breathing pulse lives inside the SVG itself — a slow scale and
            fade on the complete, whole mark (3.4s, ease-in-out), never a
            stroke-trace, and it honours prefers-reduced-motion in its own
            stylesheet. Referenced rather than inlined so the motion stays
            defined once, in the brand asset, instead of being re-described
            here and drifting from it. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- next/image
            would need dangerouslyAllowSVG in next.config to serve this at all,
            and turning that on project-wide to render one brand asset is a worse
            trade than a plain img tag. There is nothing here for the optimiser
            to do: it is a 22KB vector whose animation lives in its own
            stylesheet, and rasterising it would delete the motion. */}
        <img
          className="selodia__mark"
          src="/seed-mark-breathing.svg"
          alt=""
          width={132}
          height={132}
        />

        <h1 className="selodia__wordmark">selodía</h1>

        {/* Two sentences, each its own block — the line break is the point, so
            it is structural rather than a <br> that reflows away on a wide
            screen. */}
        <p className="selodia__tagline">
          <span>Your body isn&rsquo;t a problem to solve.</span>
          <span>It&rsquo;s something to get to know.</span>
        </p>

        <p className="selodia__category">A body literacy app for women 40+</p>

        <hr className="selodia__rule" />

        {joined === '1' ? (
          <p className="selodia__said">
            You&rsquo;re on the list. We&rsquo;ll be in touch when Selod&iacute;a launches.
          </p>
        ) : (
          <>
            <p className="selodia__soon">
              Selod&iacute;a is coming in 2027. Leave your email and we&rsquo;ll let you know when
              it&rsquo;s ready.
            </p>

            <form className="selodia__form" action={join}>
              <input
                className="selodia__field"
                type="text"
                name="name"
                autoComplete="given-name"
                placeholder="Your name (optional)"
                aria-label="Your name, optional"
                maxLength={120}
              />
              <input
                className="selodia__field"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="Your email"
                aria-label="Your email"
                required
                maxLength={320}
              />
              <button className="selodia__submit" type="submit">
                Let me know when it&rsquo;s ready
              </button>
            </form>

            {joined === 'error' && (
              <p className="selodia__said selodia__error">
                That didn&rsquo;t go through. Worth trying again in a moment.
              </p>
            )}
          </>
        )}
      </main>
    </>
  );
}
