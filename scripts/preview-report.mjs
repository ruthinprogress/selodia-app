// Renders the report with INVENTED data, to look at the typography without
// touching anybody's real log.
//
//   npx tsx scripts/preview-report.mjs > public/zz-report-preview.html

import { renderReport } from '../app/lib/report-render.ts';

const day = (n) => new Date(Date.now() - n * 86400000).toISOString();
/** The Monday `n` weeks back, as a week-beginning label. */
const week = (n) => {
  const d = new Date(Date.now() - n * 7 * 86400000);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

console.log(
  renderReport({
    name: 'Sam Whitfield',
    dateOfBirth: '1984-03-11',
    generated: new Date().toISOString(),
    periodLabel: 'Last 3 months',
    note: 'Prepared for my physiotherapy appointment on Thursday.',
    profile: process.env.SLIM ? [] : [
      { label: 'Date of birth', value: '11 March 1984' },
      { label: 'Biological sex', value: 'Female' },
      { label: 'Height', value: '168 cm' },
    ],
    goals: process.env.SLIM ? [] : ['Build strength without losing flexibility', 'Sleep through the night more often'],
    weights: process.env.SLIM ? [] : [
      { at: day(60), weight: 64.2, fat: 28.9, muscle: 41.1 },
      { at: day(30), weight: 63.6, fat: 28.1, muscle: 41.4 },
      { at: day(3), weight: 63.4, fat: 27.6, muscle: 41.6 },
    ],
    metrics: process.env.SLIM ? [] : [{ at: day(30), name: 'waist', value: '74 cm' }],
    symptoms: process.env.SLIM ? [] : [
      { at: day(21), title: 'Right knee ache after running', content: 'Worse going downstairs, settles within a day.' },
    ],
    // `label` and `days`, not `day` - this fixture still spoke the shape food
    // had before groupFood, so the preview had been crashing on its own first
    // table for some time. Nothing reads a preview script until somebody needs
    // to look at something.
    food: [
      { label: day(3).slice(0, 10), kcal: 1840, protein: 96, entries: 4, days: 1 },
      { label: day(2).slice(0, 10), kcal: 2010, protein: 104, entries: 5, days: 1 },
    ],
    foodGrain: 'daily',
    foodEntries: [],
    sleep: [],
    water: [{ day: day(2).slice(0, 10), ml: 1750, drinks: 6 }],
    activity: [
      { at: day(5), what: 'strength session', minutes: 55, intensity: 'moderate' },
      { at: day(2), what: 'ballet class', minutes: 90, intensity: 'hard' },
    ],
    // HER OWN WORST CASE, so the preview shows the thing the feature exists for
    // (Ruth, 20 October 2026): "going hard 2 weeks and nothing the rest of the
    // time may shoe as adequate when it's actually not." Two strong weeks, then
    // four of nothing, then a thin one.
    activityGrain: 'weekly',
    activityKinds: [
      { what: 'weightlifting', minutes: 330, sessions: 6 },
      { what: 'ballet', minutes: 180, sessions: 2 },
      { what: 'yoga', minutes: 60, sessions: 1 },
    ],
    activityPeriods: [
      {
        label: week(5), sessions: 4, days: 4, minutes: 230, classified: 4,
        kinds: [{ what: 'weightlifting', minutes: 170, sessions: 3 }, { what: 'ballet', minutes: 60, sessions: 1 }],
        coverage: { strength: 100, cardio: 38, flexibility: 30, balance: 52, bone: 88, recovery: 10 },
      },
      {
        label: week(4), sessions: 4, days: 3, minutes: 250, classified: 4,
        kinds: [{ what: 'weightlifting', minutes: 160, sessions: 3 }, { what: 'ballet', minutes: 120, sessions: 1 }],
        coverage: { strength: 95, cardio: 45, flexibility: 42, balance: 70, bone: 80, recovery: 0 },
      },
      { label: week(3), sessions: 0, days: 0, minutes: 0, classified: 0, kinds: [],
        coverage: { strength: 0, cardio: 0, flexibility: 0, balance: 0, bone: 0, recovery: 0 } },
      { label: week(2), sessions: 0, days: 0, minutes: 0, classified: 0, kinds: [],
        coverage: { strength: 0, cardio: 0, flexibility: 0, balance: 0, bone: 0, recovery: 0 } },
      { label: week(1), sessions: 0, days: 0, minutes: 0, classified: 0, kinds: [],
        coverage: { strength: 0, cardio: 0, flexibility: 0, balance: 0, bone: 0, recovery: 0 } },
      {
        label: week(0), sessions: 2, days: 2, minutes: 90, classified: 1,
        kinds: [{ what: 'yoga', minutes: 60, sessions: 1 }],
        coverage: { strength: 0, cardio: 8, flexibility: 42, balance: 38, bone: 2, recovery: 30 },
      },
    ],
    plans: [
      { title: 'Lower body strength, twice weekly', content: 'Squat, hinge, split squat, calf raise. Three sets each.' },
    ],
    insights: [
      { at: day(14), title: 'Knee ache follows downhill running', content: 'Noted after three of the last four downhill runs, and after none of the flat ones.' },
    ],
    cards: [
      {
        title: 'Knee rehabilitation',
        kind: 'Health',
        updated: day(9),
        content: 'Physio advised eccentric quad work three times a week, and to build downhill running back gradually.\n\nCurrent status: pain only on stairs, no swelling.',
      },
    ],
  })
);
