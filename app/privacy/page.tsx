import type { Metadata } from 'next';
import { Comfortaa } from 'next/font/google';

// The privacy policy at selodia.app/privacy.
//
// ⚠ DRAFTED 2026-09-10, NOT YET REVIEWED BY RUTH OR BY A LAWYER. Tracked in
// Part Sixteen (Distribution) as a pre-launch item. It is accurate to the
// codebase as of that date — every category below was written from the actual
// tables and the actual third-party calls, not from a template — but it makes
// commitments on Ruth's behalf and must be read properly before anyone is
// pointed at it.
//
// WHY IT EXISTS NOW: Google Play requires a privacy policy URL before an app can
// be uploaded to any track, including a hidden internal test, and the bar is
// higher for an app processing health data. It is unlinked from the landing page
// deliberately — it is live at a known URL for the store form, not advertised.
//
// TWO THINGS NEED CONFIRMING BEFORE LAUNCH and are marked in the text:
//   - ElevenLabs' retention settings for this specific account. The claim below
//     is deliberately cautious rather than confident.
//   - Whether Selodía Ltd (or whatever the Companies House entity is) is the
//     data controller, which changes the name and the ICO registration line.
//
// NO CLIENT JAVASCRIPT, matching the landing page: one server-rendered document.

const comfortaa = Comfortaa({ variable: '--font-comfortaa', subsets: ['latin'] });

const CREAM = '#F7F3EA';
const CHARCOAL = '#2D2B28';
const ACCENT_DEEP = '#874C3A';
const SAND = '#E9D6C2';
const GREY = '#5F574D';

export const metadata: Metadata = {
  title: 'Privacy — Selodía',
  description: 'What Selodía collects, why, and what you can do about it.',
};

const UPDATED = '10 September 2026';

type Section = { heading: string; body: (string | string[])[] };

const SECTIONS: Section[] = [
  {
    heading: 'The short version',
    body: [
      'Selodía is a body-literacy app. To do its job it holds things you tell it about your body, your food, your movement and how you feel. That is health information, and it is treated as such.',
      'It is never sold, never used for advertising, and never shared with anyone except the service providers listed below who are needed to make the app work. You can export everything or delete all of it, from inside the app, at any time.',
    ],
  },
  {
    heading: 'Who is responsible',
    body: [
      'Selodía is run by Ruth Christianson-Monroy. If you have a question about your data, or want to exercise any of the rights below, email hello@selodia.app.',
      'If you are not satisfied with how a request is handled, you can complain to the Information Commissioner’s Office (ICO) at ico.org.uk.',
    ],
  },
  {
    heading: 'What is collected',
    body: [
      'Only what you give it, or what follows directly from using it. There is no tracking, no advertising identifier, and no third-party analytics.',
      [
        'Account: your email address, and a password held by our authentication provider as a one-way hash that nobody at Selodía can read.',
        'About you: date of birth, biological sex, height, activity level, and the goals you set.',
        'Body measurements: weight, body fat, muscle mass and metabolic rate where you record them, plus any other measurement you choose to track such as waist or resting heart rate.',
        'Food and drink: what you log, in your own words, with the nutritional breakdown worked out from it, and any photographs you send.',
        'Movement: activities, duration and intensity, and — only if you grant the permission — step counts read from your phone’s own health platform.',
        'Health context: conditions, markers and allergies you choose to disclose, and menstrual cycle dates if you record them.',
        'Conversations: everything said in chat, including transcripts of anything spoken by voice.',
        'Saved material: plans, insights and notes kept in your Almanac, and the app’s own written observations about your readings.',
        'Device: a notification token if you turn reminders on, so a reminder can reach your phone.',
      ],
      'Special category data. Health, and information about your menstrual cycle, are special category data under UK GDPR. They are held because you asked an app about your body to help you understand it, which is explicit consent for that specific purpose, and for no other.',
    ],
  },
  {
    heading: 'Why it is held',
    body: [
      'To answer you. Selodía’s whole proposition is noticing patterns in your own data over time, and a pattern needs history. A single day tells nobody anything.',
      'It is not used to build a profile of you for anyone else, to compare you against other users, or to train any AI model. See the next section for what that means in practice.',
    ],
  },
  {
    heading: 'Who else sees it',
    body: [
      'Four providers, each doing one job. No data is shared with anyone else.',
      [
        'Supabase — stores the database and files, and handles sign-in. Data is held in their London region.',
        'Anthropic — provides Claude, the model behind the conversation. Messages, and food photographs you send, are processed to produce a reply. Anthropic’s commercial terms state that data submitted through their API is not used to train their models.',
        'ElevenLabs — provides speech recognition and the spoken voice, and only when you use voice mode. Audio is processed to produce a transcript and a reply. [To confirm before launch: retention settings on this account.]',
        'Expo — delivers push notifications and app updates. It sees a device token, not your data.',
      ],
      'Selodía does not sell data, does not run advertising, and has no affiliate or data-sharing arrangements of any kind.',
    ],
  },
  {
    heading: 'How long it is kept',
    body: [
      'Until you delete it. Health information is only useful over time, so nothing expires on its own — but nothing is kept once you ask for it to go.',
      'Deleting your account removes your data from the live database. Encrypted backups roll off on our providers’ own schedules, within 30 days.',
    ],
  },
  {
    heading: 'What you can do',
    body: [
      'All of these are yours by law, and the first two are buttons in the app rather than requests you have to make.',
      [
        'Export everything, in a readable format, from Settings.',
        'Delete your account and all of its data, from Settings. It is not recoverable afterwards.',
        'Ask for a copy, a correction, or for processing to stop — email hello@selodia.app.',
        'Withdraw consent at any time by deleting your account, which is the same thing in practice for an app that exists to hold this information.',
      ],
      'A request will be answered within one month.',
    ],
  },
  {
    heading: 'Children',
    body: ['Selodía is for adults and is not directed at anyone under 18.'],
  },
  {
    heading: 'Security',
    body: [
      'Data is encrypted in transit and at rest by our providers. Access to your rows is enforced at the database itself, so one account cannot read another’s data even if the application asked it to.',
      'Photographs and other files are held in private storage and reached only through short-lived links generated for you at the moment you open them.',
    ],
  },
  {
    heading: 'Changes',
    body: [
      'If this policy changes in a way that affects what is collected or who sees it, you will be told in the app rather than by a quietly updated page.',
    ],
  },
];

export default function PrivacyPage() {
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
        .wrap h2 { font-family: var(--font-comfortaa), system-ui, sans-serif;
                   font-size: 1.05rem; font-weight: 700; color: ${ACCENT_DEEP};
                   margin: 2.25rem 0 .6rem; }
        .wrap p, .wrap li { font-size: .95rem; line-height: 1.65; margin: 0 0 .9rem; }
        .wrap ul { padding-left: 1.1rem; margin: 0 0 1rem; }
        .wrap li { margin-bottom: .5rem; }
        .rule { height: 1px; background: ${SAND}; border: 0; margin: 2.5rem 0 0; }
        a { color: ${ACCENT_DEEP}; }
      `}</style>

      <div className="wrap">
        <h1>Privacy</h1>
        <p className="updated">Last updated {UPDATED}</p>

        {SECTIONS.map((s) => (
          <section key={s.heading}>
            <h2>{s.heading}</h2>
            {s.body.map((block, i) =>
              Array.isArray(block) ? (
                <ul key={i}>
                  {block.map((li) => (
                    <li key={li}>{li}</li>
                  ))}
                </ul>
              ) : (
                <p key={i}>{block}</p>
              )
            )}
          </section>
        ))}

        <hr className="rule" />
      </div>
    </main>
  );
}
