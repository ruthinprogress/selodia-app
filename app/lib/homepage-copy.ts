// EVERY WORD ON selodia.app LIVES HERE.
//
// Ruth, 8 October 2026: "Keep all copy in one easy-to-edit file I can read top
// to bottom." This is that file. Nothing on the homepage, and nothing in the
// page metadata, is written anywhere else. To change a sentence on the site,
// change it here and nowhere else.
//
// DRAFT WORDING UNTIL RUTH APPROVES IT. Two kinds of copy are mixed in this
// file and the difference matters:
//
//   FINAL        marked below. The wordmark, the category line and the two
//                tagline blocks. Set exactly as supplied and never rewritten.
//   DRAFT        everything else she supplied. Set exactly as supplied, not
//                improved, with no claims added.
//   MINE         the handful of strings the brief asked for but did not
//                write: the error state, the sign-up promise line, the meta
//                description, the share-image caption, the nav labels. Each
//                is marked `// MINE` so she can find them in one pass.
//
// THE RULES THIS FILE IS CHECKED AGAINST, enforced by
// `scripts/check-homepage-copy.mjs` rather than remembered:
//
//   - NO EM DASHES anywhere a person can read.
//   - NEVER the words tracker, tracking, dashboard, diary or journal.
//   - `score` and `streak` appear in exactly one sentence, in section 5, and
//     the check pins them to it.
//   - British English.
//   - No launch year, no price, no platform names, no comparison to another
//     product, no founder name.
//
// Ruth's standing rule on her own voice applies to all of it: short plain
// sentences, no hype, no exclamation marks, and the reader addressed as "you".

/** The one configurable outbound link. She will give the publication address later. */
export const WRITING_URL = 'https://substack.com/@ruthinprogress';

export const INSTAGRAM_URL = 'https://instagram.com/selodia.app';

export const CONTACT_EMAIL = 'hello@selodia.app';

// ---------------------------------------------------------------------------
// Page metadata
// ---------------------------------------------------------------------------

export const META = {
  title: 'Selodía',
  // MINE. No year, no platform, no price, per the brief. The old description
  // said "Coming 2027" and had to go.
  description:
    'A body literacy app for women 40+. Talk to it in your own words, keep your own record, and see the connections. Coming soon.',
  // MINE. The alt text on the 1200x630 share image.
  shareImageAlt: 'Selodía. A body literacy app for women 40+.',
} as const;

// ---------------------------------------------------------------------------
// 1. Masthead
// ---------------------------------------------------------------------------

export const MASTHEAD = {
  /** FINAL. Rendered from the lockup asset, not as type. Kept here for the alt text. */
  wordmark: 'selodía',
  /** FINAL. */
  category: 'A body literacy app for women 40+',
  /**
   * FINAL. Two separate visual blocks. The line break between them is
   * structural and is the point, so they are two strings rather than one
   * string with a break in it.
   */
  tagline: ['Your body isn’t a problem to solve.', 'It’s something to get to know.'] as const,
  /** DRAFT. The one link above the fold, plain text and never a button. */
  joinLink: 'Join the waiting list',
  // MINE. Nav labels, from the brief's list.
  nav: [
    { label: 'How it works', href: '#how-it-works' },
    { label: 'Writing', href: '#writing' },
    { label: 'Waiting list', href: '#waiting-list' },
    { label: 'Contact', href: '#contact' },
  ],
} as const;

// ---------------------------------------------------------------------------
// 2. The problem
// ---------------------------------------------------------------------------
//
// DRAFT, exactly as supplied. Two paragraphs, not a list.
//
// ONE DEVIATION FROM THE DESIGN IMAGE, and it is deliberate. The image lifts
// "Nobody looks at the whole picture." out as a heading and leaves the rest as
// the paragraph. The copy master sets it as one paragraph and says to set it
// exactly as supplied, and the copy master wins. It is set larger than what
// follows so the hierarchy of the image survives without splitting her sentence
// in two.

export const PROBLEM = {
  lead: 'Nobody looks at the whole picture. So it falls to you to hold it, and that is hardest exactly when you have the least energy for it.',
  second:
    'Women in midlife are routinely dismissed. But the bigger cost is that the pieces never get connected.',
  aside: [
    'Selodía is for women over 40 whose lives are full.',
    'Food, movement, cycle, symptoms, measurements: put down as they happen. Selodía keeps the full record, shows the patterns and builds the reports. Later comes the work of making sense of it all, and deciding what is worth keeping up.',
  ] as const,
} as const;

// ---------------------------------------------------------------------------
// 3. What Selodía does
// ---------------------------------------------------------------------------
//
// DRAFT, exactly as supplied. Four statements, in this order. They stack on a
// phone, which the brief asks for by name.

export const WHAT_IT_DOES = {
  heading: 'What Selodía does',
  items: [
    {
      title: 'Talk, don’t fill in forms.',
      body: 'The things that do not fit a dropdown are usually the things that matter.',
    },
    {
      title: 'Keep your own record.',
      body: 'Everything in one place, kept for as long as you want it. What you logged, what you measured, what you were told, and what changed.',
    },
    {
      title: 'See the connections.',
      body: 'Food, movement, cycle and symptoms, read together, so you can see what keeps coming back and make changes if you want to.',
    },
    {
      title: 'Make your own changes.',
      body: 'Small, gradual, tried over weeks.',
    },
  ] as const,
} as const;

// ---------------------------------------------------------------------------
// 4. How it works
// ---------------------------------------------------------------------------
//
// DRAFT, exactly as supplied. Text only. The decorative 01 to 03 are set light
// and are aria-hidden, so a screen reader hears three steps and not three
// numbers it cannot use.

export const HOW_IT_WORKS = {
  heading: 'How it works',
  steps: ['You tell it.', 'It notices, and says why.', 'You decide.'] as const,
  joinLink: 'Join the waiting list',
} as const;

// ---------------------------------------------------------------------------
// 5. Built around real life
// ---------------------------------------------------------------------------
//
// DRAFT, exactly as supplied. Short paragraphs, not a list and not a
// disclaimer.
//
// THE ONLY PLACE `streaks` AND `scores` MAY APPEAR, and the only place the
// calorie and protein plan is mentioned at all. `check-homepage-copy.mjs` pins
// both facts to this constant: if either word turns up anywhere else on the
// site the check fails.

export const REAL_LIFE = {
  heading: 'Built around real life',
  paragraphs: [
    'Most women at this stage of life are carrying more than they ever have. An app that adds targets to be missed does not help.',
    'Selodía holds everything while life happens. Tell it how your days really are and how you want them to feel, and it shapes what it says around that. Pause your targets whenever you need to. Everything is here when you come back.',
    'When something is bothering you, it talks through what could be behind it and asks what would help narrow it down. It does not diagnose, and there are no streaks, scores or badges. Your goals are yours. If you want to lose fat or build muscle, Selodía supports that with a calorie and protein plan and food suggestions, never turned into a game.',
  ] as const,
} as const;

// ---------------------------------------------------------------------------
// 6. When you do see someone
// ---------------------------------------------------------------------------
//
// DRAFT, exactly as supplied. A short horizontal band, not a major section.

export const SEEING_SOMEONE = {
  heading: 'When you do see someone',
  body: 'Build a report from your own record, choosing what goes in and for what period, to print or share. Selodía also helps you prepare: a few questions, a short timeline, a note to hand over. You are never left with “ask your GP” and nothing in your hands.',
} as const;

// ---------------------------------------------------------------------------
// 7. Your record stays yours
// ---------------------------------------------------------------------------
//
// DRAFT, exactly as supplied, and the brief is explicit: use this wording and
// ADD NO OTHER PRIVACY CLAIM. Never say or imply that nobody can see your data.
//
// That instruction is the same decision as the privacy policy's new "Who can
// see what you write" section, which says plainly that an administrator key
// exists. A homepage sentence that went further than the policy would make the
// policy a correction rather than a detail.

export const RECORD_STAYS_YOURS = {
  heading: 'Your record stays yours',
  sentences: [
    'Your record is stored in the UK.',
    'It is never sold and never used for advertising.',
    'There are no advertising identifiers and no third-party analytics.',
    'You can export all of it, or delete it, from Settings whenever you like.',
    'Delete means delete, and backups clear within 30 days.',
    'A few features use outside services to read or speak your words, and the privacy policy says which, and what each keeps.',
  ] as const,
} as const;

// ---------------------------------------------------------------------------
// 8. Writing
// ---------------------------------------------------------------------------
//
// DRAFT, exactly as supplied. No article titles and no biography, because no
// posts exist yet and a slot with nothing in it is worse than no slot.

export const WRITING = {
  heading: 'Writing',
  body: 'The story of building it, written as it happens.',
  linkText: 'Read on Substack',
} as const;

// ---------------------------------------------------------------------------
// 9. Waiting list
// ---------------------------------------------------------------------------

export const WAITING_LIST = {
  /** DRAFT. "Coming soon" and nothing more: no date, no year, no platform. */
  heading: 'Coming soon.',
  // MINE. The brief says to promise only these two things, and no more.
  promise:
    'Join the waiting list and you will be emailed when it opens. You can ask to be removed at any time.',
  nameLabel: 'Your name (optional)',
  emailLabel: 'Your email',
  /** DRAFT. The button label, supplied. */
  button: 'Join the waiting list',
  /**
   * DRAFT, supplied in the deviations note, including the link.
   * The link text is the second sentence and points at /privacy.
   */
  consent: {
    before: 'Your details are used only to tell you when Selodía opens. ',
    linkText: 'Privacy policy',
    after: '.',
  },
  /** DRAFT, supplied. */
  success: 'Thank you. We will email you when it opens.',
  // MINE. The brief asked for an error state and did not write one. Deliberately
  // says nothing about why, because the page does not know why, and a guess
  // ("check your connection") is a claim it cannot stand behind.
  error: 'That did not go through. Worth trying again in a moment.',
} as const;

// ---------------------------------------------------------------------------
// 10. Footer
// ---------------------------------------------------------------------------
//
// DRAFT, exactly as supplied. The company details are the thing that stops this
// reading as a holding page, so they are real and they are checked: company
// 12246794 is the number already in the privacy policy and the terms.

export const FOOTER = {
  company: 'Selodía Ltd',
  companyNumber: 'Company No. 12246794',
  address: '19 Campbell Road, London, E17 6RR',
  email: CONTACT_EMAIL,
  instagramHandle: '@selodia.app',
  links: [
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
    { label: 'Support', href: '/support' },
  ],
} as const;
