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
//   - SETTLED 2026-09-27. SELODÍA LTD is the data controller, not Ruth
//     personally: "Always Selodía Ltd, not me personally." This now matches
//     app/terms/page.tsx, which was changed the same day and had been
//     disagreeing with this page since it was written.
//
//     SETTLED 2026-09-30. IT EXISTS AND IT IS IN THE COMPANY'S NAME. Tier 1,
//     direct debit set up, application C2047751, Selodía Ltd. The question this
//     comment asked - naming a controller in a policy is not the same as being
//     registered as one - is answered.
//
//     DONE 2026-10-02. The reference arrived: ZC263754, Selodia Ltd, with the
//     direct debit confirmation. It is in the controller paragraph below, and
//     the application number C2047751 is NOT - the distinction this comment was
//     written to protect.
//
//     AND PRIVACY_POLICY_VERSION IS DELIBERATELY NOT BUMPED. consent.ts states
//     the rule: bump "whenever the SUBSTANCE changes". Naming the regulator's
//     registration reference changes nothing about what is collected, who
//     handles it, or what anybody may ask for. Bumping it would re-ask every
//     person for consent and tell them something about their data had changed,
//     which would be false - and she has already been re-asked once this week.
//     The UPDATED date below is hers to change if she wants the page to say so.
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
// BROUGHT UP TO DATE 2026-10-01, and UPDATED moved, which re-asks everybody to
// confirm. It is the right call and Ruth made it explicitly: three new kinds of
// SPECIAL CATEGORY data had started being collected and were not named here -
// where somebody is with the menopause, the hormones they take, and their
// medication. Eight further categories were missing too (sleep, daily mood and
// energy ratings, movement constraints including clinical advice, the week,
// goals and skills, beta membership, in-app feedback, operational records) and
// one processing activity was absent entirely: clinical documents are
// photographed, read and discarded.
//
// FOUR SENTENCES IN THE DRAFT WERE NOT TRUE, found by checking each against the
// code before applying - Ruth asked for exactly that check and it earned its
// keep:
//
//   "used for nothing else" - the consent screen takes an OPTIONAL second
//   permission for de-identified product improvement. Worse, the old text here
//   said the data is not used "to compare you against other users" while the
//   consent screen asks to "understand patterns across users". Two documents
//   describing one thing and disagreeing. The permission is now described, and
//   the honest part is that NOTHING reads research_opt_in - it is recorded and
//   acted on by nobody.
//
//   "not used to decide anything about you" - too strong. The app decides what
//   to suggest every day. The defensible claim is the Article 22 one, and it is
//   what the DPIA already says.
//
//   "not used to train anybody's AI model" - evidenced for Anthropic, whose
//   commercial terms say so. NOT evidenced for ElevenLabs, whose retention
//   setting has been an open pre-launch item since 10 September. Narrowed to
//   the claim that can be shown.
//
//   "Medication is only ever recorded after you have seen it written down" -
//   FALSE as a statement about the record. True of the Medications CARD, which
//   is written only on a yes. But the raw turn goes into chat_messages before
//   any model call (route.ts, userRowWritten at the top of the turn), so a
//   medication mentioned in passing is stored the moment Send is pressed. The
//   sentence now says which of the two it is talking about.
//
// REVISED THE SAME EVENING, 2026-10-01, AND THE VERSION MOVED AGAIN. Ruth
// switched ElevenLabs' training opt-out on at 20:06 and confirmed their retention
// period, which answers the "[to confirm before launch]" bracket that had been
// sitting in the processor list since 10 September.
//
// IT IS NOT ONLY GOOD NEWS, which is why the version moved rather than the text
// being quietly improved. The opt-out stops training; it does NOT stop retention.
// ElevenLabs hold audio and transcripts for UP TO THREE YEARS. Two other
// documents said flatly that audio "is not retained" - the Play Data Safety form
// and the App Store label - and both were wrong on a point that decides whether
// "Voice or sound recordings" is declared at all.
//
// SHE HAD ALREADY RE-CONSENTED, at 18:51, to the 1 October text that said the
// retention setting was unconfirmed. Leaving the string alone would mean her
// consent pointed at wording that no longer exists, on a material point about a
// processor. So "(revised)" is appended and she is asked once more. It is ugly
// on screen and it is correct; a cleaner date would have been a quieter lie.
//
// UPDATED IS NOW DISPLAY ONLY (2026-10-01, evening). It used to double as the
// consent version, and that coupling cost three re-asks in one evening: Ruth had
// already answered the re-ask for one revision when the next one landed, and
// there was no string left to move that would not also change what she reads
// here - which she had asked to leave alone.
//
// The comparison key is PRIVACY_POLICY_VERSION in mobile/src/lib/consent.ts and
// is opaque on purpose. Change this line for her; bump that one whenever the
// SUBSTANCE changes. They no longer have to match, and the rule for the one that
// matters is written beside it.
//
// 2026-09-28: THE COMPANY'S REGISTERED PARTICULARS WERE ADDED and UPDATED was
// deliberately LEFT AT 19 SEPTEMBER. The Companies Act and the E-Commerce
// Regulations want the number, the place of registration and the registered
// office stated; none of that changes what is collected or who sees it, and
// UPDATED is the field that re-asks every existing user to confirm their consent.
// Making the whole userbase re-consent to learn Selodia's postcode is the wrong
// trade. Bump it when the SUBSTANCE changes, which is what the note above means.
//
// NO CLIENT JAVASCRIPT, matching the landing page: one server-rendered document.

export const metadata: Metadata = {
  title: 'Privacy — Selodía',
  description: 'What Selodía collects, why, and what you can do about it.',
};

const UPDATED = '1 October 2026 (revised)';

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
      'Selodía is operated by Selodía Ltd, which is the data controller for everything described here. If you have a question about your data, or want to exercise any of the rights below, email hello@selodia.app.',
      'Selodía Ltd is registered in England and Wales, company number 12246794, registered office 19 Campbell Road, London, E17 6RR. It is registered with the Information Commissioner’s Office as a data controller, reference ZC263754.',
      'If you are not satisfied with how a request is handled, you can complain to the Information Commissioner’s Office (ICO) at ico.org.uk.',
    ],
  },
  {
    heading: 'What is collected',
    body: [
      'Only what you give it, or what follows directly from using it. There is no tracking, no advertising identifier, and no third-party analytics.',
      [
        'Account: your email address, and a password held by our authentication provider as a one-way hash that nobody at Selodía can read.',
        'The waiting list: if you ask to be told when Selodía is ready, we keep your email address, your name if you give one, and a short tag saying which link brought you here, so we know which writing people found useful. That is all of it. We use it once, to email you when the app opens, and for nothing else. Ask at any time and you are removed, by replying to any email from us or writing to hello@selodia.app. The list is deleted once everybody on it has been invited.',
        'About you: date of birth, biological sex, height, activity level, and the goals you set.',
        'Body measurements: weight, body fat, muscle mass and metabolic rate where you record them, plus any other measurement you choose to track such as waist or resting heart rate.',
        'Food and drink: what you log, in your own words, with the nutritional breakdown worked out from it — calories, protein, carbohydrate, fat, and the nutrients that matter most at this stage of life, including calcium, iron and sodium — and any photographs you send.',
        'Movement: activities, duration and intensity, and — only if you grant the permission — step counts, distance and exercise sessions read from your phone’s own health platform (Health Connect on Android, Apple Health on iPhone).',
        'Health context: conditions, markers and allergies you choose to disclose, and menstrual cycle dates if you record them.',
        'Where you are with periods: whether you describe yourself as having regular periods, perimenopausal, post-menopausal, or not having periods for another reason — and the reason, if you give one.',
        'Hormones and medication: whether you use hormonal contraception or HRT, and anything you tell Selodía you take regularly, including prescribed medicine, things bought over the counter, and supplements.',
        'Sleep: when you slept, for how long, how it felt, and how often you woke.',
        'How your days feel: the daily ratings you give for things like mood and energy.',
        'Movement constraints: anything you say you must avoid, including advice a clinician has given you, so it can be kept out of what the app builds for you.',
        'Your week and your plans: the activities in your week and when you do them, the goals you set, and the skills you are working towards.',
        'Beta membership: whether you are in the beta, and which version of the beta agreement you accepted and when.',
        'Feedback: anything you send through the in-app feedback form, together with which screen you were on and which version of the app you were using, so it can be reproduced.',
        'Documents you show it: if you photograph or upload a letter or a result — for example from a clinic — the pages are sent to be read, and what Selodía understood from them is shown to you. The pages themselves are not stored. What is kept is only what you then agree to keep.',
        'Operational records: a note of how much of the AI service each conversation used, and timings for the steps inside it, so faults and costs can be traced. These are attached to your account but contain no part of what you said.',
        'Safety records: if Selodía has raised something with you that it thinks is worth taking to a doctor, a note that it has already been raised, so you are not asked the same thing repeatedly.',
        'Conversations: everything said in chat, including transcripts of anything spoken by voice.',
        'Saved material: plans, insights and notes kept in your Almanac, and the app’s own written observations about your readings.',
        'Device: a notification token if you turn reminders on, so a reminder can reach your phone.',
        'Error reports: if something fails on your phone, a short technical note of which part of the app failed and the error it gave, so it can be fixed. It is stored with your account.',
        'Your consent: what you agreed to on the first screen, and when, so there is a record that your health data is only held with your say-so.',
      ],
      'Special category data. Health information is special category data under UK GDPR, and several of the things above are squarely within it: your menstrual cycle, where you are with the menopause, the hormones and medication you take, any condition you disclose, and anything a clinician has told you to avoid.',
      'They are held on your explicit consent, given on the first screen, for one purpose: so that an app you asked about your own body can answer from your own record.',
      'On that same screen there is a separate, optional permission: to let de-identified information about how you use Selodía help improve it and understand patterns across people using it. That is a different thing from the consent above, it is recorded separately, and you can change it in Settings at any time. Nothing is done with it today — no such use has been built. If that ever changes, you will be told before it does.',
      'None of this is shared with any insurer, employer or advertiser. None of it is used to make an automated decision about you that has a legal or similarly significant effect: Selodía describes and suggests, and does not gate anything on what it finds. Anthropic, whose model writes the replies, states in its commercial terms that data sent through its API is not used to train its models.',
      'Medication, and the card it is kept on. Your Medications card is only ever written after you have seen it written down: Selodía reads back what it understood and keeps nothing unless you agree to it. That is about the card. The conversation itself is saved as you type it, like every other message, so anything you mention in chat is in your record from the moment you send it. Selodía is not a prescriber: it will not tell you whether a dose is right or suggest you start, stop or change anything. That belongs with your GP or pharmacist.',
      'Data read from Apple Health or Health Connect is used only to show you your own movement. It is never used for advertising, never sold, and never shared except with the providers below to make the app work.',
    ],
  },
  {
    heading: 'Why it is held',
    body: [
      'To answer you. Selodía’s whole proposition is noticing patterns in your own data over time, and a pattern needs history. A single day tells nobody anything.',
      'It is not used to build a profile of you for anyone else, and it is not sold. See the next section for who it reaches and why, and the paragraph on special category data above for the one optional permission that is separate from all of this.',
    ],
  },
  {
    heading: 'Who can see what you write',
    body: [
      'Other people using Selodía cannot see any of it. The database refuses to return your records to anyone signed in as somebody else, and that is enforced by the database, not by the app asking nicely.',
      'Like any online service, Selodía holds an administrator key to the database, which means your records could technically be read by the people who run it. That would only happen when something is broken and there is no other way to find out why. If it were ever needed to look at a specific person’s data, we would tell that person.',
      'Your password cannot be read by anybody, including us. It is stored as a one-way hash and cannot be turned back.',
    ],
  },
  {
    heading: 'Who else sees it',
    body: [
      'A small number of providers, each doing one job. No data is shared with anyone else.',
      [
        'Supabase — stores the database and files, and handles sign-in. Data is held in their London region.',
        'Anthropic — provides Claude, the model behind the conversation. Messages, and food photographs you send, are processed to produce a reply. Anthropic’s commercial terms state that data submitted through their API is not used to train their models.',
        'ElevenLabs — provides speech recognition and the spoken voice, and only when you use voice mode. If you use voice, what you say goes to ElevenLabs to be turned into text. Neither ElevenLabs nor Anthropic uses it to train its AI models. ElevenLabs keeps the audio and the transcript for up to 3 years. The training opt-out on this account was switched on on 1 October 2026 and applies from then on; ElevenLabs act as a data processor under their published data processing agreement, which means they may use what they hold only to provide the service to Selod\u00eda.',
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
