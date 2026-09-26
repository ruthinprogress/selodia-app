import type { Metadata } from 'next';

import { PlainPage, type PlainSection } from '../lib/plain-page';

// The terms of use at selodia.app/terms.
//
// ⚠ DRAFTED 2026-09-26, NOT REVIEWED BY RUTH OR BY A LAWYER. Same standing as
// the privacy policy beside it, and the same warning applies twice over: this
// document makes commitments and DISCLAIMS liability on Ruth's behalf, and a
// disclaimer that has not been read by the person it protects is not much of a
// disclaimer. It must be read properly, and a solicitor should see the medical
// and liability sections before the app is in front of strangers.
//
// WHY IT EXISTS NOW. Ruth asked me to check whether selodia.app/terms resolves.
// It returned 404, and had never existed: no route, no file, and no commit in
// the entire history of this repository has ever touched one. /privacy,
// /support and /delete-account were all live. Nothing in the app or the landing
// page links to /terms either, which is why nobody noticed - the likeliest
// explanation for her asking is that the URL was entered into a store listing,
// where a 404 is a submission problem rather than a cosmetic one.
//
// WRITTEN FROM THE APP, NOT FROM A TEMPLATE, exactly as the privacy policy was.
// Every claim below describes something the code actually does. In particular
// the medical section is not boilerplate: it restates, in the language a terms
// page needs, the safety architecture the app genuinely implements - see
// SAFETY_ARCHITECTURE.md and Part Two, principle 1.
//
// WHAT STILL NEEDS DECIDING, and is marked in the text:
//   - The legal entity. Same open question as the privacy policy: whether this
//     is Ruth personally or a company. It changes who is being contracted with.
//   - Governing law. England and Wales is assumed, being where she is.
//   - Whether there will ever be a paid tier. The payment section is written to
//     be honest about there not being one yet rather than to reserve rights
//     over a thing that does not exist.
//
// NO CLIENT JAVASCRIPT, matching the privacy policy and the landing page.

export const metadata: Metadata = {
  title: 'Terms — Selodía',
  description: 'The agreement between you and Selodía, in plain English.',
};

const UPDATED = '26 September 2026';

const SECTIONS: PlainSection[] = [
  {
    heading: 'The short version',
    body: [
      'Selodía helps you understand your own body. It is not a doctor, it does not diagnose anything, and it will not tell you what to weigh.',
      'Your data is yours. You can take it out or delete it whenever you like.',
      'Use it sensibly, do not try to break it, and do not rely on it for anything medical. If something it says worries you, speak to your GP.',
    ],
  },
  {
    heading: 'Who you are agreeing with',
    body: [
      'Selodía is run by Ruth Christianson-Monroy. Using the app means accepting these terms. If you do not accept them, do not use it.',
      'Questions about anything here go to hello@selodia.app.',
    ],
  },
  {
    heading: 'Selodía is not medical advice, and this is not a formality',
    body: [
      'Selodía is a body-literacy app. It shows you what you have recorded, describes what has changed, and helps you notice patterns in your own life. That is all it does.',
      'It does not diagnose, treat, or monitor any medical condition. It is not a medical device and has not been assessed as one. Nothing it says should be used to make a decision you would otherwise take to a doctor, and it will tell you so itself when a question strays that way.',
      'Some things it deliberately will not do. It will not set you a weight target or tell you a number to aim for. It will not praise or criticise a figure you record. It will not encourage you to eat less than your body needs. These are not gaps waiting to be filled in a later version; they are the point of it.',
      'If you have or have had an eating disorder, or you are being treated for any condition affected by food, weight or exercise, please talk to whoever is treating you before using an app that asks you to record those things every day.',
      'If you are ever in crisis, contact your GP, call 111, or call 999 in an emergency. In the UK the Samaritans are on 116 123, free, at any hour.',
    ],
  },
  {
    heading: 'Your account',
    body: [
      'You need to be 18 or over to use Selodía.',
      'Keep your sign-in details to yourself, and use an email address you actually control — it is how you get back in, and how you would be contacted about your data.',
      'One account is for one person. Selodía reads everything you tell it as being about you, and sharing an account would put two people’s bodies in one record.',
    ],
  },
  {
    heading: 'What you put into it',
    body: [
      'What you record stays yours. You are not giving it away by typing it in.',
      'Selodía is allowed to store it, process it, and use it to answer you, because it cannot work otherwise. That permission covers running the app for you and nothing else: your information is never sold, never used for advertising, and never used to train anybody’s models. How it is handled in detail is set out in the privacy policy.',
      'Please do not put other people’s health information into it. It is built for one person’s record, and it has no way to honour somebody else’s rights over data they did not enter.',
    ],
  },
  {
    heading: 'Getting your data out, and deleting it',
    body: [
      'You can export everything you have recorded, from inside the app, whenever you want.',
      'You can delete your account and everything in it, also from inside the app, or at selodia.app/delete-account if you no longer have it installed. Deletion is real: it removes the record rather than hiding it.',
      'Some things may sit in backups for a short period after deletion before they age out. Nothing is kept on purpose after you have asked for it to go.',
    ],
  },
  {
    heading: 'What it costs',
    body: [
      'Selodía is free to use at the moment. There is no paid tier, no subscription and nothing to buy inside it.',
      'If that ever changes, you will be told before anything is charged, and using it without paying will remain possible or the app will stop rather than quietly start billing you.',
    ],
  },
  {
    heading: 'Using it reasonably',
    body: [
      'Do not try to break into other people’s accounts, overload the service, take it apart, or use it to do anything unlawful.',
      'Do not use automated tools to pull data out of it in bulk. Your own export is there for your own data and is the supported way to get it.',
      'If an account is used in any of these ways it may be suspended, and you will be told why.',
    ],
  },
  {
    heading: 'What is not promised',
    body: [
      'Selodía is offered as it is. It is built carefully and tested, but it is software, and software has bad days: it may be unavailable, it may be slow, and it may get something wrong.',
      'The figures it shows are calculated from what you record. Where it estimates something — calories in a meal, energy burned in a day — that is an estimate, and it is described as one. Do not treat an estimate as a measurement.',
      'Nothing here limits liability for death or personal injury caused by negligence, for fraud, or for anything else the law does not allow to be limited. Beyond that, Selodía is not liable for indirect or consequential loss arising from using it.',
      'Your statutory rights as a consumer are unaffected by anything on this page.',
    ],
  },
  {
    heading: 'Changes, and ending it',
    body: [
      'These terms may change as the app does. If they change in a way that matters, you will be asked to confirm the new version inside the app rather than being expected to notice a date at the top of a web page.',
      'You can stop using Selodía at any time, and delete your account with it.',
      'Selodía may withdraw the service, with reasonable notice and with time to export your data first, except where something has to be shut off immediately for safety or legal reasons.',
    ],
  },
  {
    heading: 'Which law applies',
    body: [
      'These terms are governed by the law of England and Wales, and the courts of England and Wales have jurisdiction. If you live elsewhere in the UK, you keep the right to bring a claim in your own local courts.',
    ],
  },
];

export default function TermsPage() {
  return (
    <PlainPage
      title="Terms"
      intro="The agreement between you and Selodía, written to be read rather than skipped."
      updated={UPDATED}
      sections={SECTIONS}
    />
  );
}
