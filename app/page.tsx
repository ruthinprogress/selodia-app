import { Work_Sans } from 'next/font/google';
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

const workSans = Work_Sans({
  subsets: ['latin'],
  weight: ['300', '400'],
  style: ['normal', 'italic'],
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
          gap: clamp(1.25rem, 3.2vh, 2rem);
          padding: clamp(2rem, 5vh, 3rem) 1.5rem clamp(2.5rem, 6vh, 4rem);
          text-align: center;
          box-sizing: border-box;
        }
        .selodia__mark { width: 132px; height: 132px; }
        /* The wordmark, exactly as locked in Part Fifteen: Work Sans, italic,
           weight 300, letter-spacing +0.085em, lowercase. The tracking is what
           stops a light italic from reading as cramped at display size. */
        .selodia__wordmark {
          font-weight: 300;
          font-style: italic;
          letter-spacing: 0.085em;
          font-size: clamp(2.75rem, 12vw, 4.25rem);
          line-height: 1;
          margin: 0;
          /* Optical: the trailing letter-space pushes the word off-centre. */
          text-indent: 0.085em;
        }
        .selodia__tagline {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          font-size: clamp(1.05rem, 4.5vw, 1.4rem);
          font-weight: 300;
          line-height: 1.45;
          max-width: 22ch;
          margin: 0;
        }
        /* Each sentence gets its own line once there is room for one. The 22ch
           cap above is a phone measure - it keeps the tagline from running the
           full width of a small screen - but on a desktop it was forcing both
           sentences to wrap mid-thought, four lines for two sentences. Above the
           breakpoint the cap comes off and each span refuses to break, so the
           line break falls where the full stop is and nowhere else.

           360px, not 700px, and not unconditional. The type scales with 4.5vw
           below its cap, so the sentence shrinks nearly as fast as the screen
           does - measured, the longest one leaves 56px of headroom at 375px but
           only 2px at 320px. Two pixels is not a margin, it is a coincidence
           waiting for a wider fallback font to load, so the smallest phones keep
           wrapping and everything from 360px up gets one line per sentence. */
        @media (min-width: 360px) {
          .selodia__tagline { max-width: none; }
          .selodia__tagline span { white-space: nowrap; }
        }
        .selodia__category {
          font-size: 0.9rem;
          font-weight: 400;
          letter-spacing: 0.04em;
          color: ${FOREST};
          margin: 0;
        }
        .selodia__rule { width: 44px; height: 1px; background: ${SAND}; border: 0; margin: 0; }
        .selodia__soon {
          font-size: 1rem;
          font-weight: 300;
          line-height: 1.6;
          max-width: 34ch;
          margin: 0;
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

      <main className={`selodia ${workSans.className}`}>
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
            You&rsquo;re on the list — we&rsquo;ll be in touch when Selod&iacute;a launches.
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
                That didn&rsquo;t go through — worth trying again in a moment.
              </p>
            )}
          </>
        )}
      </main>
    </>
  );
}
