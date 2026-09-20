// Renders the report with INVENTED data, to look at the typography without
// touching anybody's real log.
//
//   npx tsx scripts/preview-report.mjs > public/zz-report-preview.html

import { renderReport } from '../app/lib/report-render.ts';

const day = (n) => new Date(Date.now() - n * 86400000).toISOString();

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
    food: [
      { day: day(3).slice(0, 10), kcal: 1840, protein: 96, entries: 4 },
      { day: day(2).slice(0, 10), kcal: 2010, protein: 104, entries: 5 },
    ],
    water: [{ day: day(2).slice(0, 10), ml: 1750, drinks: 6 }],
    activity: [
      { at: day(5), what: 'strength session', minutes: 55, intensity: 'moderate' },
      { at: day(2), what: 'ballet class', minutes: 90, intensity: 'hard' },
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
