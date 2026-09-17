// Labels for a new Exercise Animatic clip, from its NAME, its vendor FOLDER and
// the vendor's own METADATA SHEET. Nothing else.
//
// LICENCE, AND THE REASON THIS FILE EXISTS. Exercise Animatic ToS 8.3 forbids
// content being "uploaded, supplied, analysed, or otherwise used to ... generate
// output from" a model. The 770 clips labelled in August were labelled by sending
// frames to one (classify.mjs), which the spec now records as a breach. Every
// label here comes from text the vendor published about the clip, or from fixed
// rules over its name. No clip, frame or thumbnail is read, by anything.
//
// Rows written from these labels carry human_verified = false. They go live at
// once (Ruth, 2026-09-17: "it must grow on its own"), and the flag says honestly
// that nobody has looked yet.

// --- movement pattern --------------------------------------------------------
// The vendor sheet has no pattern column, so this is rules over the name. ORDER
// MATTERS: the first rule that matches wins, and the order encodes which word is
// more telling. "Bent Over Row" is a row before it is a hinge; "Split Squat" is a
// lunge before it is a squat; "Pull Up" must be caught before "Up" means anything.
const PATTERN_RULES = [
  ['mobility_stretch', /\b(stretch|pose|yoga|foam roller|cobra|pigeon|child pose|toe touch|salutation)/i],
  ['vertical_pull', /\b(pull[\s-]?ups?|chin[\s-]?ups?|pull[\s-]?downs?|lat pull|lat prayer|pullover|upright row|over ?head pull)\b/i],
  ['horizontal_pull', /\b(rows?|face pull|reverse fly|rear delt)\b/i],
  ['vertical_push', /\b(shoulders? press|overhead press|push press|arnold|military press|handstand push|dips?)\b/i],
  ['horizontal_push', /\b(bench press|chest press|floor press|push[\s-]?ups?|pushups?|chest fly|flyes?|fly)\b/i],
  ['lunge', /\b(lunges?|split squat|step[\s-]?ups?|step out|curtsy)\b/i],
  ['isolation', /\bside bend\b/i],
  ['hinge', /\b(deadlifts?|good mornings?|hip[\s-]?thrust(s|ers?)?|glute bridge|hyperextension|reverse hyper|back extension|pull ?through|swings?|superman|snatch)\b/i],
  ['squat', /\b(squats?|leg press|thrusters?|wall sit|wall ball|press under|clean)\b/i],
  ['loaded_carry', /\b(carry|farmer|sled|suitcase walk)\b/i],
  ['core_antimovement', /\b(plank|crunch(es)?|sit[\s-]?ups?|dead bug|hollow|twist|chop|leg raises?|flutter|scissors?|v[\s-]?ups?|knee tucks?|jack ?knives?|bicycles?|wipers?|walkout|heel touch|oblique|ab wheel|rollout|shoulder tap|mountain climber|l sit)/i],
  ['gait_cardio', /\b(run|running|jog|jogging|walk|walking|skip|skipping|jumps?|jumping|jacks?|burpees?|butt kicks?|high knees?|sprint|rowing machine|airbike|elliptical|ergometer|rebounder|boxing|punch(es|ing)?|kicks?|agility|hops?|stepmill)\b/i],
  ['isolation', /\b(curls?|extensions?|raises?|kickbacks?|shrugs?|pulses|wrist|calf|calve|abduction|adduction|clamshell)\b/i],
];

// When no word decides it, the vendor's folder does. These are the patterns the
// existing 770 overwhelmingly carry per folder, measured on 2026-09-17.
const FOLDER_DEFAULT = {
  Abdominals: 'core_antimovement',
  Back: 'horizontal_pull',
  Biceps: 'isolation',
  Triceps: 'isolation',
  Forearms: 'isolation',
  Shoulders: 'isolation',
  Chest: 'horizontal_push',
  Legs: 'isolation',
  Powerlifting: 'hinge',
  'Calisthenics-Cardio-Plyo-Functional': 'gait_cardio',
  'Stretching - Mobility': 'mobility_stretch',
  Yoga: 'mobility_stretch',
};

// Folders where the folder IS the answer, whatever the name says. A biceps curl
// "to shoulder press" is still a biceps clip; a yoga "chair pose" is not a squat.
const FOLDER_DECIDES = new Set(['Biceps', 'Triceps', 'Forearms', 'Stretching - Mobility', 'Yoga']);

export function movementPattern(name, folder) {
  if (FOLDER_DECIDES.has(folder)) return FOLDER_DEFAULT[folder];
  for (const [pattern, re] of PATTERN_RULES) if (re.test(name)) return pattern;
  return FOLDER_DEFAULT[folder] ?? 'isolation';
}

// --- muscles -----------------------------------------------------------------
// The vendor writes "Middle Back (Latissimus Dorsi, Teres Major), Shoulders
// (Deltoids)". Split on commas OUTSIDE brackets, then read the plain name before
// the bracket, falling back to what is inside it for vague heads like "Arms".
const MUSCLE_WORDS = [
  ['lats', /latissimus|middle back|\blats?\b/i],
  ['upper_back', /upper back|rhomboid|trapezius|\btraps?\b/i],
  ['lower_back', /lower back|erector/i],
  ['abdominals', /abdominals|rectus abdominis|\bcore\b|\babs\b/i],
  ['obliques', /oblique/i],
  ['chest', /chest|pectoral/i],
  ['rotator_cuff', /rotator|infraspinatus|supraspinatus/i],
  ['shoulders', /shoulder|deltoid/i],
  ['biceps', /biceps/i],
  ['triceps', /triceps/i],
  ['forearms', /forearm|brachioradialis|wrist|flexor carpi|extensor carpi/i],
  ['glutes', /glute/i],
  ['hamstrings', /hamstring/i],
  ['quadriceps', /quadricep|quads?\b/i],
  ['adductors', /adductor/i],
  ['abductors', /abductor|tensor fasciae/i],
  ['calves', /calf|calves|gastrocnemius|soleus/i],
  ['tibialis', /tibialis/i],
  ['hip_flexors', /hip flexor|iliopsoas/i],
  ['neck', /\bneck\b|sternocleidomastoid/i],
];

function topLevelParts(text) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of String(text ?? '')) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if ((ch === ',' || ch === ';') && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

export function musclesFrom(text) {
  const out = [];
  for (const part of topLevelParts(text)) {
    const head = part.split('(')[0];
    let hit = MUSCLE_WORDS.find(([, re]) => re.test(head));
    if (!hit) hit = MUSCLE_WORDS.find(([, re]) => re.test(part));
    if (hit && !out.includes(hit[0])) out.push(hit[0]);
  }
  return out;
}

// --- equipment -----------------------------------------------------------------
const EQUIPMENT_WORDS = [
  ['suspension trainer', /suspension trainer|trx/i],
  ['resistance band', /\bband(s|ed)?\b|resistance band|theraband/i],
  ['kettlebell', /kettlebell/i],
  ['dumbbell', /dumbbell/i],
  ['ez bar', /\bez bar\b/i],
  ['barbell', /barbell|land ?mine/i],
  ['smith machine', /smith machine/i],
  ['cable machine', /\bcable\b/i],
  ['medicine ball', /med(icine)? ball/i],
  ['pull up bar', /pull[\s-]?ups?|chin[\s-]?ups?/i],
  ['machine', /machine/i],
];

export function equipmentFrom(vendorValue, name) {
  const v = String(vendorValue ?? '').trim();
  if (v && !/^none/i.test(v)) return v.toLowerCase();
  for (const [label, re] of EQUIPMENT_WORDS) if (re.test(name)) return label;
  return 'bodyweight';
}

// --- the vendor sheet ------------------------------------------------------------
// Keyed by the clip's own name, lowercased, with and without the gender suffix, so
// a "_Female" clip finds its own row first and the unsuffixed row second.
export function indexVendorRows(rows) {
  const byName = new Map();
  for (const r of rows) {
    const name = String(r.Exercise ?? '').trim();
    if (!name) continue;
    const key = name.toLowerCase().replace(/\s+/g, ' ');
    if (!byName.has(key)) byName.set(key, r);
  }
  return byName;
}

export function vendorRowFor(index, clip) {
  const exact = clip.toLowerCase().replace(/\s+/g, ' ');
  const bare = exact.replace(/_female(_\d+)?$/, '').trim();
  // The vendor appends a "_Female" row for each new clip but fills in the
  // anatomy on the UNMARKED row of the same exercise (measured on the 17
  // September sheet: 0 of 149 female rows had muscles, 134 of their unmarked
  // twins did). Same movement, same muscles, so the first row that actually
  // carries anatomy wins.
  const candidates = [index.get(exact), index.get(`${bare}_female`), index.get(bare)].filter(Boolean);
  return candidates.find((r) => r['Primary Activating Muscles']) ?? candidates[0] ?? null;
}

// join_key as the existing 770 have it: the clip name without "_Female",
// lowercased, whitespace collapsed.
export function joinKeyFor(clip) {
  return clip.replace(/_female(_\d+)?$/i, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function labelClip({ clip, folder, vendorIndex }) {
  const row = vendorRowFor(vendorIndex, clip);
  const bare = clip.replace(/_female(_\d+)?$/i, '');
  const primary = musclesFrom(row?.['Primary Activating Muscles']);
  const secondary = musclesFrom(row?.['Secondary Activating Muscles']).filter((m) => !primary.includes(m));
  return {
    join_key: joinKeyFor(clip),
    clip,
    muscle_group: folder,
    primary_muscles: primary,
    secondary_muscles: secondary,
    equipment: equipmentFrom(row?.Equipment, bare),
    movement_pattern: movementPattern(bare, folder),
    human_verified: false,
    // Not an AI label. Recorded as where the label came from, so a later review
    // pass can find exactly these.
    ai_confidence: primary.length > 0 ? 'rules+vendor_sheet' : 'rules_only',
  };
}
