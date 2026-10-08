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
// A PARAGRAPH REMOVED 2026-09-27, and worth recording because it was the kind
// of mistake a terms page makes easily. It read: "It will not set you a weight
// target or tell you a number to aim for." Ruth: "targets are definitely part
// of selodia if the user wants it, this part is not true."
//
// She is right, and goal-safety.ts says so plainly - the app ACCEPTS a stated
// goal weight and assesses it, declining to coach toward one only when it
// calculates below the WHO underweight threshold. I had written the paragraph
// from the safety architecture's stance rather than from its behaviour, which
// is the same error as writing a spec claim from intent.
//
// It looked like it was doing legal work, propping up the not-a-medical-device
// framing. It was not: that framing is carried by the sentences around it, and
// a contract promising the app will never do something it does on request is a
// misrepresentation - more risk than it removed. Nothing replaced it. If a
// narrower true version is wanted later, the defensible line is the underweight
// refusal, because the code actually enforces it.
//
// The short version carried the same claim in miniature - "it will not tell
// you what to weigh" - and went with it. Worth noticing that a summary had
// quietly inherited the error: a false sentence tends to appear twice,
// because the summary is written from the section rather than from the app.
//
// WRITTEN FROM THE APP, NOT FROM A TEMPLATE, exactly as the privacy policy was.
// Every claim below describes something the code actually does. In particular
// the medical section is not boilerplate: it restates, in the language a terms
// page needs, the safety architecture the app genuinely implements - see
// SAFETY_ARCHITECTURE.md and Part Two, principle 1.
//
// WHAT STILL NEEDS DECIDING, and is marked in the text:
//   - SETTLED 2026-09-27: the contract is with SELODÍA LTD, not with Ruth
//     personally. "Contract is with Selodía Ltd. Not me." The privacy policy
//     still names her personally and now disagrees with this page - it is
//     flagged in the close-out and needs the same change once the ICO
//     registration and controller line are checked, which is not a rename I
//     should make unilaterally on a data-protection document.
//   - Governing law. England and Wales is assumed, being where she is.
//   - SETTLED 2026-09-27. There IS a paid tier and it ships with the public
//     launch: "Paid tier will be shipped from the moment it's public, it will
//     only be free for Beta-users and they will receive their own separate
//     contract attached directly to their account." So the payment section
//     describes a subscription rather than an absence, and names the beta
//     agreement as the thing that overrides this page for those users.
//
//     WHAT IS NOT WRITTEN YET, and is a build item rather than a wording one:
//     the beta agreement itself, the mechanism attaching it to an account, and
//     the billing this page now refers to. See the Beta-ready list in
//     SELODIA_SPEC.md - a terms page describing a subscription that cannot yet
//     be bought is fine while the app is not public, and is not fine after.
//
// NO CLIENT JAVASCRIPT, matching the privacy policy and the landing page.

export const metadata: Metadata = {
  title: 'Terms · Selodía',
  description: 'The agreement between you and Selodía, in plain English.',
};

const UPDATED = '28 September 2026';

const SECTIONS: PlainSection[] = [
  {
    heading: 'The short version',
    body: [
      'Selodía helps you understand your own body. It is not a doctor and it does not diagnose anything.',
      'Your data is yours. You can take it out or delete it whenever you like.',
      'Use it sensibly, do not try to break it, and do not rely on it for anything medical. If something it says worries you, speak to your GP.',
    ],
  },
  {
    heading: 'Who you are agreeing with',
    body: [
      'Selodía is operated by Selodía Ltd. Using the app means accepting these terms, which are an agreement between you and Selodía Ltd. If you do not accept them, do not use it.',
      'Selodía Ltd is registered in England and Wales, company number 12246794, registered office 19 Campbell Road, London, E17 6RR.',
      'Questions about anything here go to hello@selodia.app.',
    ],
  },
  {
    heading: 'Selodía is not medical advice, and this is not a formality',
    body: [
      'Selodía is a body-literacy app. It shows you what you have recorded, describes what has changed, and helps you notice patterns in your own life. That is all it does.',
      'It does not diagnose, treat, or monitor any medical condition. It is not a medical device and has not been assessed as one. Nothing it says should be used to make a decision you would otherwise take to a doctor, and it will tell you so itself when a question strays that way.',
      'If you have or have had an eating disorder, or you are being treated for any condition affected by food, weight or exercise, please talk to whoever is treating you before using an app that asks you to record those things every day.',
      'If you are ever in crisis, contact your GP, call 111, or call 999 in an emergency. In the UK the Samaritans are on 116 123, free, at any hour.',
    ],
  },
  {
    heading: 'Your account',
    body: [
      'You need to be 18 or over to use Selodía.',
      'Keep your sign-in details to yourself, and use an email address you actually control: it is how you get back in, and how you would be contacted about your data.',
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
      'Selodía is a paid subscription. What it costs, and what is included, is shown before you subscribe and you are told before anything is charged.',
      'Beta testers are the exception. If you are taking part in the beta, Selodía is free to you, and the terms of that are set out in a separate agreement attached to your own account rather than on this page. Where that agreement and this page disagree, that agreement is the one that applies to you.',
      'You can cancel at any time. Cancelling stops the next payment; it does not delete your record, which stays yours until you delete it.',
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
      'The figures it shows are calculated from what you record. Where it estimates something, such as calories in a meal or energy burned in a day, that is an estimate, and it is described as one. Do not treat an estimate as a measurement.',
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
