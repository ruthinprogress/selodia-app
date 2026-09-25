// The account the store listing is photographed from.
//
// WHY IT EXISTS. Store screenshots are public the moment the listing is, and
// the demo account holds Ruth's real food logs, a real conversation about her
// son, and a knee she actually hurt. On 23 September a set of screenshots was
// rejected because the chat in them turned out to be a frank exchange about not
// eating - exactly what the app is for, and exactly wrong as a shop window.
//
// So this account is invented from nothing and exists only to be photographed.
// Nobody signs into it, nothing real is ever typed into it, and it is safe to
// wipe and re-seed whenever the screenshots need retaking.
//
//   node scripts/seed-store-account.mjs          # create and fill
//   node scripts/seed-store-account.mjs --wipe   # empty it first
//
// IT REFUSES THE TWO ACCOUNTS THAT MATTER. unflumpapp@gmail.com is Ruth's own,
// and unflumpapp+test@gmail.com is not hers to touch at all. A typo in the
// address below would otherwise overwrite somebody's health record.

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const STORE_EMAIL = 'unflumpapp+store@gmail.com';
const FORBIDDEN = ['unflumpapp@gmail.com', 'unflumpapp+test@gmail.com'];

if (FORBIDDEN.includes(STORE_EMAIL) || !STORE_EMAIL.includes('+store')) {
  console.error('Refusing: this script only ever touches the +store account.');
  process.exit(1);
}

const E = {};
for (const line of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) E[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const SUPA = E.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = E.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(SUPA, SERVICE, { auth: { persistSession: false } });

// ---- find or create ----------------------------------------------------
async function findUser() {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const hit = data.users.find((u) => u.email === STORE_EMAIL);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

let user = await findUser();
if (!user) {
  const { data, error } = await admin.auth.admin.createUser({
    email: STORE_EMAIL,
    email_confirm: true,
    user_metadata: {
      full_name: 'Alex Morgan',
      biological_sex: 'female',
      date_of_birth: '1981-04-12',
    },
  });
  if (error) {
    console.error('could not create the store account:', error.message);
    process.exit(1);
  }
  user = data.user;
  console.log(`  created ${STORE_EMAIL}`);
} else {
  console.log(`  found ${STORE_EMAIL}`);
}
const uid = user.id;

// ---- dates -------------------------------------------------------------
// Everything is placed relative to today, so the screenshots never show a week
// that has obviously gone stale.
const day = (back, h = 12, m = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - back);
  d.setHours(h, m, 0, 0);
  return d;
};
const iso = (d) => d.toISOString();
const dateOnly = (d) => d.toISOString().slice(0, 10);

const TABLES = [
  'chat_messages', 'food_logs', 'activity_logs', 'hydration_logs', 'sleep_logs',
  'body_measurements', 'daily_activity_summaries', 'almanac_entries', 'user_context',
  'daily_summaries', 'cycle_events', 'user_profile', 'allergies', 'daily_ratings',
  'consent_records',
];

if (process.argv.includes('--wipe')) {
  for (const t of TABLES) {
    const { error } = await admin.from(t).delete().eq('user_id', uid);
    if (error && !/does not exist/i.test(error.message)) console.log(`  wipe ${t}: ${error.message}`);
  }
  console.log('  wiped');
}

const put = async (table, rows) => {
  if (!rows.length) return;
  const { error } = await admin.from(table).insert(rows.map((r) => ({ ...r, user_id: uid })));
  console.log(`  ${table.padEnd(26)} ${error ? `FAILED: ${error.message}` : `${rows.length} rows`}`);
};

// ---- who she is --------------------------------------------------------
// PAST THE TWO GATES, or every route bounces to onboarding step 1 of 10.
//
// The auth guard checks two things before it lets anybody into the app, and a
// freshly created account fails both. First a consent record, which must match
// the CURRENT privacy policy version - an older one counts as "outdated" and
// asks again. Then user_profile.onboarding_step, which has to read 'complete'.
//
// Found by shooting the whole set and getting six identical pictures of the
// consent screen.
// source is CHECK-constrained to onboarding | reconfirm | settings, so a
// descriptive value like 'seed-store-account' is rejected. The first version of
// this did exactly that, did not check the error, and printed "recorded" - and
// the whole screenshot run then photographed the consent screen six times.
// Every write here is asserted now, for that reason.
const { error: consentError } = await admin.from('consent_records').insert({
  user_id: uid,
  core_consent: true,
  marketing_opt_in: false,
  research_opt_in: false,
  policy_version: '19 September 2026',
  source: 'onboarding',
});
if (consentError) {
  console.error('  consent_records            FAILED:', consentError.message);
  process.exit(1);
}
console.log('  consent_records            recorded');

const { error: profileError } = await admin.from('user_profile').upsert({
  user_id: uid,
  onboarding_step: 'complete',
  height_cm: 167,
  date_of_birth: '1981-04-12',
  biological_sex: 'female',
  activity_level: 'moderate',
  fat_focus_state: 'reduce',
  muscle_focus_state: 'increase',
  protein_target_g: 95,
});
if (profileError) {
  console.error('  user_profile               FAILED:', profileError.message);
  process.exit(1);
}
console.log('  user_profile               set');

// ---- the week of movement, which is what fills the flower --------------
//
// Six dimensions, each needing about 200 across the week to fill its petal.
// Spread so no petal is empty and none is pinned at full: a flower that is all
// or nothing reads as a mock-up rather than as somebody's actual week.
const activities = [
  { back: 0, at: 7, type: 'Run', dur: 32, kcal: 310, dist: 5.0, raw: 'run 5k',
    intensity: 'moderate', ecc: 'moderate', c: [15, 95, 5, 20, 45, 0] },
  { back: 1, at: 18, type: 'Strength training', dur: 45, kcal: 240, raw: 'barbell session, deadlifts and rows',
    intensity: 'intense', ecc: 'high', c: [95, 10, 10, 25, 80, 0] },
  { back: 2, at: 8, type: 'Yoga', dur: 40, kcal: 130, raw: 'morning yoga',
    intensity: 'light', ecc: 'low', c: [15, 5, 85, 60, 5, 55] },
  { back: 3, at: 19, type: 'Walk', dur: 50, kcal: 160, dist: 4.2, raw: 'evening walk',
    intensity: 'light', ecc: 'low', c: [5, 45, 5, 15, 30, 40] },
  { back: 4, at: 18, type: 'Strength training', dur: 40, kcal: 220, raw: 'squats and overhead press',
    intensity: 'intense', ecc: 'high', c: [90, 10, 10, 35, 75, 0] },
  { back: 5, at: 9, type: 'Pilates', dur: 35, kcal: 120, raw: 'pilates class',
    intensity: 'moderate', ecc: 'moderate', c: [35, 5, 70, 75, 10, 35] },
  { back: 6, at: 10, type: 'Swim', dur: 30, kcal: 250, dist: 1.2, raw: 'swim',
    intensity: 'moderate', ecc: 'low', c: [30, 70, 30, 20, 5, 45] },
];

await put('activity_logs', activities.map((a) => ({
  happened_at: iso(day(a.back, a.at)),
  activity_type: a.type,
  duration_min: a.dur,
  kcal_burned: a.kcal,
  distance_km: a.dist ?? null,
  raw_input: a.raw,
  source: 'chat',
  intensity: a.intensity,
  eccentric_load: a.ecc,
  cover_strength: a.c[0],
  cover_cardio: a.c[1],
  cover_flexibility: a.c[2],
  cover_balance: a.c[3],
  cover_bone: a.c[4],
  cover_recovery: a.c[5],
})));

// ---- an ordinary week of food -----------------------------------------
const FOOD = [
  [0, 8, 'porridge with blueberries and a spoon of almond butter', 340, 11],
  [0, 13, 'chicken and avocado salad with seeds', 480, 38],
  [1, 8, 'two poached eggs on rye toast', 360, 20],
  [1, 13, 'lentil and squash soup with sourdough', 420, 18],
  [1, 19, 'salmon, new potatoes and green beans', 560, 42],
  [2, 8, 'overnight oats with banana', 380, 13],
  [2, 13, 'feta and roasted vegetable wrap', 450, 19],
  [2, 19, 'stir fried tofu with rice and broccoli', 520, 26],
  [3, 8, 'scrambled eggs and spinach', 300, 22],
  [3, 13, 'tuna and white bean salad', 430, 36],
  [3, 19, 'chicken thighs with sweet potato mash', 610, 45],
  [4, 8, 'porridge with grated apple and cinnamon', 330, 10],
  [4, 13, 'egg and watercress sandwich', 390, 18],
  [4, 19, 'prawn linguine with courgette', 540, 33],
  [5, 9, 'granola with kefir and raspberries', 400, 16],
  [5, 14, 'butter bean and tomato stew', 380, 17],
  [5, 20, 'roast chicken, potatoes and greens', 650, 48],
  [6, 9, 'two boiled eggs and a slice of rye', 280, 16],
  [6, 13, 'halloumi and grain bowl', 520, 24],
  [6, 19, 'cod with lentils and kale', 470, 40],
];
await put('food_logs', FOOD.map(([back, h, text, kcal, protein]) => ({
  happened_at: iso(day(back, h)),
  raw_text: text,
  kcal,
  protein_g: protein,
})));

// ---- water, part filled today, which is what she asked to see ----------
const HYDRATION = [];
for (let back = 0; back <= 6; back++) {
  // Today deliberately part way, so the ring reads as in progress.
  const pours = back === 0 ? [[8, 250], [10, 300], [13, 250]] : [[8, 250], [10, 300], [13, 350], [16, 250], [19, 400]];
  for (const [h, ml] of pours) HYDRATION.push({ happened_at: iso(day(back, h)), ml });
}
await put('hydration_logs', HYDRATION);

// ---- sleep, measurements, steps ---------------------------------------
await put('sleep_logs', [
  [1, 432, 'good', 1], [2, 401, 'ok', 2], [3, 455, 'good', 0],
  [4, 388, 'poor', 3], [5, 447, 'good', 1], [6, 462, 'good', 0],
].map(([back, dur, quality, wakes]) => ({
  night_of: dateOnly(day(back)), duration_min: dur, quality, awakenings: wakes,
})));

await put('body_measurements', [
  [0, 64.2, 27.8], [3, 64.5, 28.0], [7, 64.9, 28.3], [14, 65.4, 28.6],
].map(([back, kg, fat]) => ({
  measured_at: iso(day(back, 7, 30)), weight_kg: kg, body_fat_pct: fat,
})));

await put('daily_activity_summaries', [
  [0, 8420], [1, 11230], [2, 6890], [3, 9940], [4, 7610], [5, 12080], [6, 8350],
].map(([back, steps]) => ({
  date: dateOnly(day(back)),
  steps,
  kcal_burned: Math.round(steps * 0.04),
  active_kcal: Math.round(steps * 0.028),
  active_minutes: Math.round(steps / 120),
  distance_km: Math.round((steps / 1350) * 10) / 10,
})));

// ---- the Almanac: a plan, and something worth keeping ------------------
await put('almanac_entries', [
  {
    kind: 'plan',
    title: 'Lower body strength, twice a week',
    content: {
      programType: 'strength',
      goal: 'Build lower body strength and protect bone density',
      exercises: [
        { name: 'Barbell deadlift', group: 'posterior chain', sets: 3, reps: '5',
          eccentricLoad: 'high', intensity: 'intense',
          safetyNote: 'Round the lower back under load and the discs take what the hips should. Brace before the bar leaves the floor, and stop the set when the back starts to round rather than at the rep you planned.' },
        { name: 'Goblet squat', group: 'quadriceps', sets: 3, reps: '10',
          eccentricLoad: 'moderate', intensity: 'moderate',
          safetyNote: 'Knees collapsing inward is the failure to watch. Drive them out over the middle toes, and drop the weight before the depth.' },
        { name: 'Romanian deadlift', group: 'hamstrings', sets: 3, reps: '8',
          eccentricLoad: 'high', intensity: 'moderate',
          safetyNote: 'The hamstrings are lengthened under load here, which is what makes it work and what makes it ache two days later. Add weight slowly.' },
      ],
    },
  },
  {
    kind: 'plan',
    title: 'Morning mobility, most days',
    content: {
      programType: 'flexibility',
      goal: 'Keep hips and shoulders easy through a desk day',
      exercises: [
        { name: 'Cat cow', group: 'spine', sets: 2, reps: '8', eccentricLoad: 'low', intensity: 'light',
          safetyNote: 'Move within the range that is comfortable today rather than the one you had last week. This is a warm-up, not a stretch to win.' },
        { name: 'World greatest stretch', group: 'hips', sets: 2, reps: '5 each side', eccentricLoad: 'low', intensity: 'light',
          safetyNote: 'The back knee takes weight here. On a hard floor put something under it.' },
        { name: 'Shoulder pass through', group: 'shoulders', sets: 2, reps: '10', eccentricLoad: 'low', intensity: 'light',
          safetyNote: 'Widen your grip until it is easy. Forcing a narrow grip is where shoulders get pinched.' },
      ],
    },
  },
  {
    kind: 'plan',
    title: 'Twenty minutes, no equipment',
    content: {
      programType: 'general strength',
      goal: 'A session that works in a hotel room or a front room',
      exercises: [
        { name: 'Sit to stand', group: 'quadriceps', sets: 3, reps: '12', eccentricLoad: 'moderate', intensity: 'moderate',
          safetyNote: 'Lower under control rather than dropping onto the chair. The slow half is the half that builds anything.' },
        { name: 'Incline press up', group: 'chest', sets: 3, reps: '10', eccentricLoad: 'moderate', intensity: 'moderate',
          safetyNote: 'Raise the hands higher if the lower back starts to sag. A clean rep on a kitchen counter beats a poor one on the floor.' },
        { name: 'Split squat', group: 'quadriceps', sets: 3, reps: '8 each side', eccentricLoad: 'high', intensity: 'moderate',
          safetyNote: 'Hold something for balance to begin with. Wobbling recruits the wrong things and teaches nothing.' },
        { name: 'Dead bug', group: 'core', sets: 3, reps: '10', eccentricLoad: 'low', intensity: 'light',
          safetyNote: 'The lower back stays flat to the floor. When it lifts, the set is finished whatever the count says.' },
      ],
    },
  },
  {
    kind: 'insight', category: 'Sleep',
    title: 'Short nights land the next afternoon, not the next morning',
    content: { condition: 'Under six and a half hours', expectation: 'Energy holds until about three, then drops sharply' },
  },
  {
    kind: 'me', category: 'Supplements', title: 'Vitamin D, 1000iu',
    content: { status: 'Daily through the winter', why: 'Started October last year after a low reading' },
  },
]);

// ---- a clean conversation for the chat screenshot ----------------------
// THE THREAD THE LISTING SHOWS (Ruth, 25 September 2026).
//
// The first version had the agent say "that's your cardio petal filling up
// nicely", which is exactly what the system prompt forbids in capitals:
// ACKNOWLEDGE, DO NOT EVALUATE, never praise a number for being bigger. Seed
// copy that breaks the product's own rule is worse than dull seed copy.
//
// It also had the person ask "what should I think about for the rest of
// today?", which Ruth called fake, and she is right - nobody talks like that.
// This shape is hers: log a thing, ask a real question, get a specific answer.
// That is the product, and it is what somebody deciding whether to install
// needs to see in one screen.
const CHAT = [
  ['user', 'Did a 5k run in the park', 0, 8, 12],
  ['assistant', 'Got it, 5k in the park. How did it feel?', 0, 8, 13],
  ['user', 'Felt good, starving now. Porridge for breakfast with blueberries and milk', 0, 8, 21],
  ['assistant', 'Good to hear. Porridge is down as well.', 0, 8, 22],
  ['user', 'How can I get more protein into that?', 0, 8, 26],
  ['assistant', 'A spoon of nut butter stirred through, or a dollop of Greek yoghurt on top. Both sit well with porridge and would nudge your protein up for the day.', 0, 8, 27],
];
await put('chat_messages', CHAT.map(([role, content, back, h, m]) => ({
  role, content, source: 'chat', created_at: iso(day(back, h, m)),
})));

console.log(`\n  ${STORE_EMAIL} is ready to photograph. User id ${uid}\n`);
