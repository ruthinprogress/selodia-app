// WHAT WOULD AN ILLUSTRATOR ACTUALLY HAVE TO DRAW?
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/scope-illustration-gaps.mjs
//   node --import ./scripts/ts-resolve-hook.mjs scripts/scope-illustration-gaps.mjs --brief
//
// Ruth, 16 October 2026: "What about if we scope all the main movements we
// don't have in video as well as all yoga moves we dont have and compile a
// list as big as possible and ask chat gpt to design a set of illustrations
// for each one?"
//
// WHY A SCRIPT RATHER THAN A LIST SOMEBODY WRITES. The library holds 950 clips
// and the matcher is strict on purpose - an exact name or an exact word set,
// never a near miss, because a confidently wrong demonstration is a form
// fault. So whether the library "has" a movement is not a judgement anybody
// can make by scanning it: it is whatever resolve_movement_refs says, and that
// is what the app will do at save time.
//
// So every candidate below goes through the REAL matcher. A movement counts as
// covered only if the app would actually find it.
//
// TWO SOURCES, and the first matters more than the second:
//
//   1. REAL GAPS. Every movement in a saved plan that resolved to nothing.
//      These have already been prescribed to somebody and already arrived with
//      no demonstration. Nothing on this list is hypothetical.
//
//   2. THE VOCABULARY. The movements and poses a home programme for a woman
//      over forty actually draws on - bodyweight strength, dumbbells, bands, a
//      chair, mobility, rehab, and the standard yoga asanas. Checked against
//      the library so the gaps are real rather than assumed.
//
// Read-only.

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// THE VOCABULARY. Grouped the way an illustrator would want to work, because a
// set drawn in one sitting is cheaper and looks like a set.
const VOCABULARY = {
  'Lower body, bodyweight': [
    'Bodyweight squat', 'Box squat', 'Sit to stand', 'Split squat', 'Reverse lunge',
    'Forward lunge', 'Curtsy lunge', 'Lateral lunge', 'Step up', 'Glute bridge',
    'Single-leg glute bridge', 'Hip thrust', 'Clamshell', 'Side-lying leg lift',
    'Fire hydrant', 'Donkey kick', 'Standing hip abduction', 'Calf raise',
    'Single-leg calf raise', 'Wall sit', 'Heel slide', 'Terminal knee extension',
  ],
  'Lower body, dumbbells': [
    'Goblet squat', 'Dumbbell squat', 'Dumbbell deadlift', 'Romanian deadlift',
    'Single-leg Romanian deadlift', 'Dumbbell lunge', 'Dumbbell step up',
    'Dumbbell glute bridge', 'Dumbbell hip thrust', 'Lying hamstring curl',
    'Standing hamstring curl', 'Dumbbell calf raise', 'Suitcase carry',
  ],
  'Upper body': [
    'Press up', 'Incline press up', 'Knee press up', 'Wall press up',
    'Dumbbell bench press', 'Dumbbell shoulder press', 'Lateral raise',
    'Front raise', 'Bent over row', 'Single-arm row', 'Reverse fly',
    'Bicep curl', 'Hammer curl', 'Tricep kickback', 'Overhead tricep extension',
    'Band pull apart', 'Face pull', 'Scapular squeeze',
  ],
  'Core and back': [
    'Dead bug', 'Bird dog', 'Plank', 'Side plank', 'Forearm plank',
    'Glute bridge march', 'Pallof press', 'Bicycle crunch', 'Heel taps',
    'Superman', 'Back extension', 'Hollow hold', 'Pelvic tilt',
  ],
  'Mobility and stretching': [
    'Cat cow', 'Child pose', 'Thread the needle', 'Thoracic rotation',
    'Hip flexor stretch', 'Couch stretch', 'Hamstring stretch', 'Calf stretch',
    'Figure four stretch', 'Pigeon stretch', 'Butterfly stretch',
    'Seated straddle stretch', 'Frog stretch', 'Wide-leg forward fold',
    'Standing forward fold', 'Shoulder pass through', 'Doorway chest stretch',
    'Neck side bend', 'Ankle circles', 'Wrist stretch',
  ],
  Yoga: [
    'Mountain pose', 'Downward facing dog', 'Upward facing dog', 'Cobra pose',
    'Plank pose', 'Chaturanga', 'Warrior one', 'Warrior two', 'Warrior three',
    'Triangle pose', 'Extended side angle', 'Half moon pose', 'Chair pose',
    'Tree pose', 'Eagle pose', 'Crescent lunge', 'Low lunge', 'High lunge',
    'Bridge pose', 'Camel pose', 'Bow pose', 'Locust pose', 'Fish pose',
    'Seated forward bend', 'Head to knee pose', 'Bound angle pose',
    'Happy baby', 'Reclined twist', 'Legs up the wall', 'Corpse pose',
    'Sun salutation A', 'Sun salutation B', 'Half pigeon', 'Garland pose',
    'Boat pose', 'Side plank pose', 'Dolphin pose', 'Puppy pose',
  ],
};

/** The real matcher, the one the app uses when it saves a plan. */
async function resolve(names) {
  const found = new Map();
  for (let i = 0; i < names.length; i += 60) {
    const batch = names.slice(i, i + 60);
    const { data, error } = await supabase.rpc('resolve_movement_refs', { names: batch });
    if (error) throw new Error(error.message);
    for (const row of data ?? []) found.set(row.input_name, row.join_key);
  }
  return found;
}

// ---- 1. The gaps that have already reached somebody ----------------------
const { data: planRows, error } = await supabase
  .from('almanac_entries')
  .select('title, content')
  .ilike('kind', '%plan%');
if (error) throw new Error(error.message);

const prescribed = new Map();
for (const row of planRows ?? []) {
  for (const ex of row.content?.exercises ?? []) {
    const name = String(ex.name ?? '').trim();
    if (!name) continue;
    const seen = prescribed.get(name) ?? { count: 0, hasClip: false };
    seen.count += 1;
    seen.hasClip = seen.hasClip || Boolean(ex.demoRef);
    prescribed.set(name, seen);
  }
}
const realGaps = [...prescribed.entries()]
  .filter(([, v]) => !v.hasClip)
  .sort((a, b) => b[1].count - a[1].count);

// ---- 2. The vocabulary ---------------------------------------------------
const all = Object.values(VOCABULARY).flat();
const resolved = await resolve(all);
const missingByGroup = {};
let covered = 0;
for (const [group, names] of Object.entries(VOCABULARY)) {
  const missing = names.filter((n) => !resolved.get(n));
  covered += names.length - missing.length;
  missingByGroup[group] = missing;
}

// ---- 3. MISSING, OR MERELY NAMED DIFFERENTLY? ----------------------------
//
// The first run reported 16 of 124 covered, which is not believable for a
// library holding 194 leg clips. "Calf raise" came back missing while the
// library has kettlebell, leg-press and hack-squat calf raises.
//
// That is the matcher doing its job: it wants an exact name or an exact word
// set, so a plain "calf raise" matches none of them. The movement is not
// absent - the NAME is. The two want different fixes, and the alias is the
// better outcome of the two: curate one and the app shows the real animation
// that already exists, for nothing. Drawing it instead gets a still picture
// of something already filmed. So this splits them, and ALIAS comes first.
const { data: library } = await supabase.from('movement_assets').select('join_key');
const libraryNames = (library ?? []).map((r) => String(r.join_key));
// "pose" AND "stretch" ARE NOT NOISE, and stripping them was a real mistake.
// With them gone "Mountain pose" matched "mountain climber" and "Bridge pose"
// matched "plate glute bridge to pullover" - the same subset-matching that
// movement-demos.ts measured and rejected, where a third of the extra matches
// were a different movement under a different load. Only the grammar goes.
const STOP = new Set(['the', 'a', 'to', 'with', 'and', 'of', 'on']);
const words = (n) => n.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w));

/** Library clips that contain every meaningful word of this name. */
function nearest(name) {
  const want = words(name);
  if (want.length === 0) return [];
  return libraryNames
    .filter((n) => {
      const have = new Set(words(n));
      return want.every((w) => have.has(w));
    })
    .slice(0, 3);
}

if (process.argv.includes('--brief')) {
  // THE LIST TO HAND TO SOMEBODY, and nothing else on the page.
  console.log('MOVEMENTS NEEDING AN ILLUSTRATION\n');
  console.log('Already prescribed and arriving with no demonstration:\n');
  for (const [name] of realGaps) console.log(`  ${name}`);
  for (const [group, missing] of Object.entries(missingByGroup)) {
    // ONLY THE ONES WITH NOTHING LIKE THEM. A name whose words all appear in
    // some existing clip might already be filmed under another title, and
    // drawing it would replace an animation with a still. Those are in the
    // full report to be looked at one at a time; they are not on this list.
    const absent = missing.filter((n) => nearest(n).length === 0);
    if (absent.length === 0) continue;
    console.log(`\n${group}:\n`);
    for (const name of absent) console.log(`  ${name}`);
  }
  const total =
    realGaps.length +
    Object.values(missingByGroup).flat().filter((n) => nearest(n).length === 0).length;
  console.log(`\n${total} in total.`);
} else {
  console.log(`\n  THE LIBRARY HOLDS 950 CLIPS, and the matcher is strict by design.\n`);
  console.log(`  ALREADY PRESCRIBED WITH NO DEMONSTRATION: ${realGaps.length}`);
  console.log('  (these have reached somebody already, so they come first)\n');
  for (const [name, v] of realGaps) {
    console.log(`    ${String(v.count).padStart(2)}x  ${name}`);
  }

  console.log(`\n  THE VOCABULARY: ${covered} of ${all.length} covered, ${all.length - covered} missing\n`);
  for (const [group, missing] of Object.entries(missingByGroup)) {
    const names = VOCABULARY[group];
    const vocab = VOCABULARY[group];
    console.log(`    ${group}  -  ${vocab.length - missing.length}/${vocab.length} matched exactly`);
    for (const name of missing) {
      const near = nearest(name);
      console.log(
        near.length > 0
          ? `        CHECK    ${name.padEnd(32)} -> ${near.join('; ')}`
          : `        DRAW     ${name}`
      );
    }
  }

  const unmatched = Object.values(missingByGroup).flat();
  const absent = unmatched.filter((n) => nearest(n).length === 0);
  console.log(
    `\n  ${unmatched.length - absent.length} of the ${unmatched.length} unmatched have a possible clip already.` +
      '\n  Those are worth one look each: an alias gets the real animation for nothing,' +
      '\n  and a wrong one is a form fault, so this script writes no aliases itself.' +
      `\n\n  ${realGaps.length + absent.length} have nothing like them and need drawing.` +
      '\n  Run again with --brief for that list on its own.\n'
  );
}
