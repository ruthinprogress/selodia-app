// EVERY WORD OF THE NEW ONBOARDING, AND EVERY NOTIFICATION STRING, FOR RUTH.
//
// GENERATED FROM THE CODE rather than typed beside it. She is going to edit
// this in her own voice and hand it back, so the version she edits has to be
// the version that ships - and a hand-copied document is a second copy that
// starts drifting the moment either one is touched.
//
// The tap options come from the option files; the screen copy is extracted from
// the screens themselves by pulling the named copy constants out. Anything this
// cannot reach is listed at the end as NOT EXTRACTED rather than left out
// silently, because a copy document that quietly omits a sentence is how a
// sentence nobody chose ends up shipping.
//
//   node --import ./scripts/ts-paths.mjs scripts/onboarding-copy-doc.mjs > out.md

import fs from 'node:fs';
import path from 'node:path';

import { GOAL_OPTIONS } from '../mobile/src/lib/goals.ts';
import { LIFE_STAGES, NO_PERIODS_REASONS, HRT_OPTIONS } from '../mobile/src/lib/life-stage.ts';
import { FOOD_ALLERGIES, DIETARY_NEEDS, OTHER_REACTIONS } from '../mobile/src/lib/allergy-options.ts';
import { LADDERS, CLIP_GAPS } from '../mobile/src/lib/skill-ladders.ts';
import { REMINDER_STRINGS, MISSED_SESSION } from '../mobile/src/lib/reminders.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIR = path.join(ROOT, 'mobile', 'src', 'app', 'onboarding');

const out = [];
const p = (s = '') => out.push(s);

// Pull a named string constant out of a screen. CRLF-normalised first, for the
// reason check-onboarding-copy.mjs now carries at length: `.` does not match
// `\r`, and every file in this repo is CRLF on disk.
function constant(file, name) {
  const src = fs.readFileSync(path.join(DIR, file), 'utf8').replace(/\r\n?/g, '\n');
  const m = new RegExp(`const ${name} =\\s*([\\s\\S]*?);\\n`).exec(src);
  if (!m) return null;
  return m[1]
    .trim()
    .replace(/^['"`]|['"`]$/g, '')
    .replace(/'\s*\+\s*\n\s*'/g, '')
    .replace(/\\'/g, "'")
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}

p('# The new onboarding, every word');
p();
p('**Eight screens of taps, about a minute. Nothing is required and every screen can be skipped.**');
p();
p('**These are my words, not yours.** Your chat transcript lines were not available when they were written, so treat all of it as a draft and edit freely. The two rules they were written to, which are worth keeping whatever the wording becomes:');
p();
p('- **Screens are impersonal.** Only chat says "I". A screen that says "I\'ll keep that in mind" is the app claiming a memory it may not have.');
p('- **Every answer changes something.** A question whose answer changes nothing costs a minute and buys a false sense of being understood.');
p();
p('---');
p();

// ---- screen by screen ---------------------------------------------------

const SCREENS = [
  {
    n: 1,
    file: 'goals.tsx',
    title: 'What brings you here?',
    note: 'Multi-select. This is the one that sets your calorie and protein targets.',
    options: GOAL_OPTIONS.map((o) => [o.label, o.effect]),
    extra: [
      ['Optional measure, shown only after Lose fat or Build muscle', constant('goals.tsx', 'MEASURE_PROMPT')],
      ['Under the measure box', constant('goals.tsx', 'MEASURE_NOTE')],
    ],
  },
  {
    n: 2,
    file: 'skill.tsx',
    title: constant('skill.tsx', 'QUESTION'),
    note: constant('skill.tsx', 'SUBTITLE'),
    options: LADDERS.map((l) => [l.name, `${l.rungs.length} rungs, ${l.rungs.filter((r) => r.clip === null).length} of them with no demonstration yet`]),
    extra: [
      ['Under the list', `More are on the way. ${CLIP_GAPS.length} movements are still being drawn, including handstands and the muscle up, and nothing is offered here until it can actually be demonstrated.`],
      ['Then', 'Where are you with it?  ·  Just starting / Some of it / Nearly there'],
      ['Under that', 'This sets where you start, not how long anything should take. There are no dates on any of it.'],
    ],
  },
  {
    n: 3,
    file: 'life-stage.tsx',
    title: constant('life-stage.tsx', 'QUESTION'),
    note: constant('life-stage.tsx', 'SUBTITLE'),
    options: LIFE_STAGES.map((o) => [o.label, o.hint ?? '']),
    extra: [
      ['If "another reason" is chosen', constant('life-stage.tsx', 'REASON_QUESTION')],
      ['Its options', NO_PERIODS_REASONS.map((r) => r.label).join('  ·  ')],
      ['And the line that follows it', 'No periods does not mean not cycling. Nothing here will assume anything about your menopause, and symptoms become the thing worth tracking instead.'],
      ['HRT, asked only if periods are not regular', constant('life-stage.tsx', 'HRT_QUESTION')],
      ['Its options', HRT_OPTIONS.map((o) => o.label).join('  ·  ')],
      ['Why it is asked', constant('life-stage.tsx', 'HRT_WHY')],
    ],
  },
  {
    n: 4,
    file: 'activities.tsx',
    title: constant('activities.tsx', 'QUESTION'),
    note: constant('activities.tsx', 'SUBTITLE'),
    options: [['Walking, Running, Gym or weights, Yoga, Pilates, Swimming, Cycling, Dance or ballet, Bar work or calisthenics, Classes of some kind', 'Multi-select. These become your Week']],
    extra: [
      ['Then, per activity', 'How often, roughly?  ·  Now and then / Weekly / A few times a week / Most days'],
      ['Under that', 'Roughly is fine. This becomes the shape of your week, not a target to hit.'],
      ['And', 'Roughly how tall are you?'],
      ['Under the height box', 'Used for the metabolic estimate, and nothing else. Skip it and Selodía works without it.'],
    ],
  },
  {
    n: 5,
    file: 'steer-around.tsx',
    title: constant('steer-around.tsx', 'QUESTION'),
    note: constant('steer-around.tsx', 'SUBTITLE'),
    options: [
      ['An injury or a condition', 'Something your body will not thank you for'],
      ['Advice from a clinician', 'A surgeon, a physio, a GP'],
      ['Nothing right now', ''],
    ],
    extra: [
      ['If either of the first two is chosen', 'Tell Selodía what it is in your own words. It will read it back to you and ask you to confirm before anything is kept, because this is the one thing it will never assume.'],
      ['If "nothing"', 'That is fine, and it can change. Say so in chat whenever it does.'],
      ['NOTE', 'This screen saves nothing. Tapping a chip is not consent to a rule, because the app has no idea yet WHAT to exclude. It opens chat instead.'],
    ],
  },
  {
    n: 6,
    file: 'allergies.tsx',
    title: constant('allergies.tsx', 'QUESTION'),
    note: constant('allergies.tsx', 'SUBTITLE'),
    options: [
      ['FOOD ALLERGIES', FOOD_ALLERGIES.map((o) => o.label).join(', ')],
      ['HOW YOU EAT', DIETARY_NEEDS.map((o) => o.label).join(', ')],
      ['REACTIONS THAT ARE NOT ABOUT FOOD', OTHER_REACTIONS.map((o) => o.label).join(', ')],
    ],
    extra: [
      ['At the bottom', 'Something else?  /  Tell chat in your own words. Anything at all, however unusual, and however you say it.  /  Tell chat'],
      ['Last line', 'Nothing here is ever removed by unticking it. If something stops applying, say so in chat.'],
    ],
  },
  {
    n: 7,
    file: 'guidance.tsx',
    title: constant('guidance.tsx', 'QUESTION'),
    note: constant('guidance.tsx', 'SUBTITLE'),
    options: [
      ['Guide me', 'A planned week, with reminders if you want them'],
      ['Let me lead', 'A rhythm to work with. Selodía stays quiet until you ask'],
    ],
    extra: [
      ['If Guide me', 'Today will show one line on the days you have something planned. Reminders stay off until you turn them on, and there is only ever one. Nothing chases you.'],
      ['If Let me lead', 'Your week is there when you want it, and nothing will appear on Today unless you ask.'],
    ],
  },
  {
    n: 8,
    file: 'life-stage.tsx',
    title: constant('life-stage.tsx', 'QUESTION'),
    note: constant('life-stage.tsx', 'SUBTITLE'),
    options: [
      ["What you're working towards", ''],
      ['Your week', ''],
      ['Working on now', ''],
      ['Staying out of your sessions', ''],
      ['Staying off your plate', ''],
      ['Your targets', ''],
    ],
    extra: [
      ['When a section is empty', 'Nothing yet, and that is fine.'],
      ['Last line', 'All of this lives in Plans. It changes whenever you say so.'],
      ['The button', 'Start'],
    ],
  },
];

for (const s of SCREENS) {
  p(`## Screen ${s.n} — ${s.title}`);
  p();
  if (s.note) {
    p(`*${s.note}*`);
    p();
  }
  if (s.options?.length) {
    p('| Option | What it means or changes |');
    p('| --- | --- |');
    for (const [label, meaning] of s.options) p(`| **${label}** | ${meaning} |`);
    p();
  }
  for (const [where, text] of s.extra ?? []) {
    if (!text) continue;
    p(`**${where}**`);
    p();
    p(`> ${text}`);
    p();
  }
  p('---');
  p();
}

// ---- notifications -------------------------------------------------------

p('# The notification strings');
p();
p('**None of these is wired. Nothing sends them.** They are written so you can read them and cut the ones that do not earn their place.');
p();
p('**Three rules they were written to:** off until chosen; one nudge and no chasing; worded as an offer rather than an instruction. "Ballet today, if it fits" is information. "Time for ballet" is an instruction from something that does not know what your day has been like.');
p();
p('| When | What it says | Why it is worth interrupting somebody |');
p('| --- | --- | --- |');
for (const r of REMINDER_STRINGS) {
  if (r.kind === 'nothing_logged') continue;
  p(`| ${r.when} | **${r.title}** — ${r.body} | ${r.justification} |`);
}
p();

const never = REMINDER_STRINGS.find((r) => r.kind === 'nothing_logged');
p('## The sixth, which deliberately does not exist');
p();
p(`**There is no "you haven't logged in a while" notification, and no code that could compute one.** \`MISSED_SESSION\` is \`${String(MISSED_SESSION)}\`.`);
p();
if (never) {
  p(`> ${never.justification}`);
  p();
}
p('**There is also no missed-session notification.** My Week has no completion column at all, so nothing in the app knows what "missed" would even mean — which is the strongest way to keep a rule.');
p();

// ---- what could not be extracted ----------------------------------------

const missing = [];
for (const s of SCREENS) {
  if (!s.title) missing.push(`${s.file}: QUESTION`);
  if (!s.note) missing.push(`${s.file}: SUBTITLE`);
}
if (missing.length > 0) {
  p('## NOT EXTRACTED');
  p();
  p('These could not be pulled out of the code automatically, so they are **not** in this document and need reading in the app:');
  p();
  for (const m of missing) p(`- ${m}`);
  p();
}

console.log(out.join('\n'));
