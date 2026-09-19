import type { Metadata } from 'next';

import { PlainPage, type PlainSection } from '../lib/plain-page';

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
// BROUGHT UP TO DATE 2026-09-19 for the store submissions. The 10 September
// text had fallen behind the app in five places: error reports from the phone
// and the consent record were collected but not named; Vercel (the servers) and
// Google (Google sign-in, and Android push delivery) handle data but were not
// listed; the Me page's fifteen-minute printable copy was not mentioned; and
// there was no way to ask for deletion without the app, which Google Play
// requires. Changing UPDATED here means changing PRIVACY_POLICY_VERSION in
// mobile/src/lib/consent.ts too: the app asks everybody to confirm again when
// the version they agreed to is not the current one, which is how "you will be
// told in the app" below is kept.
//
// NO CLIENT JAVASCRIPT, matching the landing page: one server-rendered document.

export const metadata: Metadata = {
  title: 'Privacy — Selodía',
  description: 'What Selodía collects, why, and what you can do about it.',
};

const UPDATED = '19 September 2026';

const SECTIONS: PlainSection[] = [
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
        'Movement: activities, duration and intensity, and — only if you grant the permission — step counts, distance and exercise sessions read from your phone’s own health platform (Health Connect on Android, Apple Health on iPhone).',
        'Health context: conditions, markers and allergies you choose to disclose, and menstrual cycle dates if you record them.',
        'Conversations: everything said in chat, including transcripts of anything spoken by voice.',
        'Saved material: plans, insights and notes kept in your Almanac, and the app’s own written observations about your readings.',
        'Device: a notification token if you turn reminders on, so a reminder can reach your phone.',
        'Error reports: if something fails on your phone, a short technical note of which part of the app failed and the error it gave, so it can be fixed. It is stored with your account.',
        'Your consent: what you agreed to on the first screen, and when, so there is a record that your health data is only held with your say-so.',
      ],
      'Special category data. Health, and information about your menstrual cycle, are special category data under UK GDPR. They are held because you asked an app about your body to help you understand it, which is explicit consent for that specific purpose, and for no other.',
      'Data read from Apple Health or Health Connect is used only to show you your own movement. It is never used for advertising, never sold, and never shared except with the providers below to make the app work.',
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
      'A small number of providers, each doing one job. No data is shared with anyone else.',
      [
        'Supabase — stores the database and files, and handles sign-in. Data is held in their London region.',
        'Anthropic — provides Claude, the model behind the conversation. Messages, and food photographs you send, are processed to produce a reply. Anthropic’s commercial terms state that data submitted through their API is not used to train their models.',
        'ElevenLabs — provides speech recognition and the spoken voice, and only when you use voice mode. Audio is processed to produce a transcript and a reply. [To confirm before launch: retention settings on this account.]',
        'Vercel — runs Selodía’s servers, which pass your data between the app, the database and the providers above. Server logs are kept briefly, to fix faults.',
        'Google — confirms who you are if you choose to sign in with Google. On Android, Google’s Firebase Cloud Messaging delivers reminders, using a device token rather than your data.',
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
        'Delete your account and all of its data, from Settings. It is not recoverable afterwards. If you no longer have the app, you can ask by email instead: see selodia.app/delete-account.',
        'Print or share your Me page. To let your browser open it, a copy is kept for fifteen minutes and then deleted.',
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
  return <PlainPage title="Privacy" updated={UPDATED} sections={SECTIONS} />;
}
