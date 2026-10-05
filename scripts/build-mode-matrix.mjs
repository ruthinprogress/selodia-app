// THE MODE MATRIX, GENERATED FROM THE CODE THAT RUNS.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/build-mode-matrix.mjs
//
// Ruth's matrix reply, 4 October 2026, item 7: "The final matrix is a
// machine-readable file that the checks read, so the code cannot drift from it."
//
// So this writes scripts/mode-matrix.json, which is the artefact - the page and
// check-mode-matrix.mjs both read it, and neither restates it. A matrix typed
// out by hand describes what somebody believed the code did on the day they
// wrote it, and this project has lost days to exactly that gap.
//
// FOUR SWITCHES, ONE PAUSE. Lose fat / Maintain weight / Gain weight are one
// weight direction and mutually exclusive; Build muscle is independent. All off
// is NOTHING CHOSEN and has no calorie figure at all. Pause is a single rule for
// every combination, so it is one row rather than a second copy of each.

import { writeFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const MODE = await import(root + '/mobile/src/lib/body-mode.ts');
const CAL = await import(root + '/mobile/src/lib/calorie-target.ts');
const PRO = await import(root + '/mobile/src/lib/protein.ts');
const INTENT = await import(root + '/mobile/src/lib/body-intent.ts');
const RULES = await import(root + '/mobile/src/lib/calorie-rules.ts');
const GUIDE = await import(root + '/mobile/src/lib/starting-guide.ts');

// HER OWN FIGURES, at the activity level she says is right (4 October 2026:
// "mine TDEE is around 1550 so the calculation should land around there").
// 1,551 is BMR 1,128 x 1.375, which the app currently calls "light" - see the
// naming note in the page.
export const BODY = {
  bmrKcal: 1128,
  tdeeKcal: 1551,
  weightKg: 56.55,
  bodyFatPct: 27.6,
  // ONE OF THE REAL PHRASES, not a placeholder. This said "the level you have
  // set" - wording the app stopped using on 5 October, kept alive here because
  // the builder had its own copy of it. A generated document carrying a string
  // the app no longer contains is the drift this file exists to prevent, one
  // level up.
  activityWord: 'training once or twice a week',
};

const ORDER = ['loseFat', 'maintainWeight', 'gainWeight', 'buildMuscle'];

function combinations() {
  const out = [];
  for (let i = 0; i < 16; i++) {
    const mode = {
      loseFat: Boolean(i & 1),
      maintainWeight: Boolean(i & 2),
      gainWeight: Boolean(i & 4),
      buildMuscle: Boolean(i & 8),
    };
    const weightOn = [mode.loseFat, mode.maintainWeight, mode.gainWeight].filter(Boolean).length;
    out.push({ mode, blocked: weightOn > 1 });
  }
  return out;
}

function figuresFor(mode, paused) {
  const focus = MODE.focusFromMode(mode);
  if (!focus) return { kcal: null, mode: null, protein: null, stepped: null, intent: null, stored: 'nothing stored' };

  // PAUSE IS ONE RULE FOR EVERY COMBINATION: at what she uses, protein at the
  // maintenance range, switches untouched. Modelled here rather than in
  // calculateCalorieTarget because it is a hold on the arrangement, not a focus.
  // PAUSE IS ASKED FOR, NOT MODELLED HERE. It lives in calculateCalorieTarget so
  // that every surface gets it from one place; a generator that computed its own
  // paused figure would be describing an app that does not exist.
  const kcal = CAL.calculateCalorieTarget({
    tdeeKcal: BODY.tdeeKcal,
    weightKg: BODY.weightKg,
    bmrKcal: BODY.bmrKcal,
    fatFocus: focus.fat,
    muscleFocus: focus.muscle,
    paused,
    // Build alone and Maintain + Build store the same focus pair and now mean
    // different things, so the record has to come with them.
    weightDirectionStated: MODE.weightDirectionStated(mode),
  })?.targetKcal ?? null;

  const full = CAL.calculateCalorieTarget({
    tdeeKcal: BODY.tdeeKcal,
    weightKg: BODY.weightKg,
    bmrKcal: BODY.bmrKcal,
    fatFocus: focus.fat,
    muscleFocus: focus.muscle,
    weightDirectionStated: MODE.weightDirectionStated(mode),
  });

  const pro = PRO.calculateProteinTarget({
    weightKg: BODY.weightKg,
    bodyFatPct: BODY.bodyFatPct,
    muscleFocus: paused ? 'maintain' : focus.muscle,
  });

  return {
    kcal,
    mode: paused ? 'maintenance' : (full?.mode ?? null),
    delta: paused ? 0 : (full?.deltaKcal ?? null),
    floored: paused ? null : (full?.flooredAt ?? null),
    protein: pro?.kind === 'range' ? `${pro.low}–${pro.high} g` : null,
    stepped: pro?.kind === 'range' ? pro.stepped : null,
    intent: INTENT.intentFromFocus(focus.fat, focus.muscle)?.key ?? null,
    stored: `fat ${focus.fat} · muscle ${focus.muscle}`,
  };
}

const rows = [];
for (const { mode, blocked } of combinations()) {
  if (blocked) {
    rows.push({
      switches: ORDER.map((k) => mode[k]),
      blocked: true,
      why: 'Lose fat, Maintain weight and Gain weight are one weight direction. Turning one on turns the others off, so this cannot be reached.',
    });
    continue;
  }
  const f = figuresFor(mode, false);
  rows.push({
    switches: ORDER.map((k) => mode[k]),
    blocked: false,
    empty: MODE.isEmpty(mode),
    name: MODE.modeLabel(mode),
    ...f,
    line: MODE.modeExplanation(mode),
    safety: MODE.modeSafetyLine(mode),
    safetyDetail: MODE.modeSafetyDetail(mode),
  });
}

// The one paused row, which applies to every combination above.
const pausedExample = figuresFor({ loseFat: true, maintainWeight: false, gainWeight: false, buildMuscle: true }, true);

const out = {
  generatedFrom: 'mobile/src/lib/body-mode.ts, calorie-target.ts, protein.ts, body-intent.ts',
  body: BODY,
  switchOrder: ORDER,
  rows,
  paused: {
    kcal: pausedExample.kcal,
    protein: pausedExample.protein,
    line: MODE.pausedLine(BODY.activityWord, BODY.tdeeKcal),
    explanation: MODE.PAUSE_EXPLANATION,
    rule: 'One rule for every combination: calories at what her body uses, protein at the maintenance range. The switches are untouched and stay visible, dimmed. Resume restores them exactly.',
  },
  usesLine: MODE.usesLine(BODY.activityWord, BODY.tdeeKcal),
  // HER ITEM 3: every rule carries its evidence and the date it was last looked
  // at, in the same file the checks read, so a number cannot change without its
  // reason changing with it. The monthly scan proposes against these entries.
  rules: RULES.CALORIE_RULES,
  // HER STARTING-GUIDE COPY, AS THE PERMANENT RECORD (5 October 2026): "Add the
  // 'Your starting guide' text block I pasted to the matrix as the permanent
  // record: one 'text shown on screen' entry per state (ten), with the frame, the
  // italic lines and the placeholders as written. The checks read it. Do not
  // paraphrase it."
  //
  // COPIED, NOT RETYPED. It comes out of lib/starting-guide.ts, which is the file
  // the app itself renders from, so the record and the screen cannot say two
  // different things. check-starting-guide.mjs compares them both ways.
  startingGuide: {
    frame: GUIDE.GUIDE_FRAME,
    states: GUIDE.GUIDE_STATES.map((g) => ({
      key: g.key,
      name: g.name,
      shownOnScreen: [
        GUIDE.GUIDE_FRAME.title,
        GUIDE.GUIDE_FRAME.intro,
        GUIDE.GUIDE_FRAME.restBullet,
        GUIDE.GUIDE_FRAME.activityBullet,
        g.paragraph,
        ...(g.italic ? [g.italic] : []),
        ...(g.smallLine ? [g.smallLine] : []),
        ...(g.showsFigures
          ? [GUIDE.GUIDE_FRAME.guideFigure, GUIDE.GUIDE_FRAME.proteinFigure, GUIDE.GUIDE_FRAME.closing]
          : [GUIDE.GUIDE_FRAME.closingNoGuide]),
      ],
      // HER WORDING FOR THE COLLAPSED WORKING, where a state has one. Shown on
      // screen behind one tap rather than on the panel.
      shownInWorking: g.working ?? null,
      paragraph: g.paragraph,
      italic: g.italic ?? null,
      smallLine: g.smallLine ?? null,
      showsFigures: g.showsFigures,
      teaches: g.teaches ?? null,
    })),
  },
};

writeFileSync('scripts/mode-matrix.json', JSON.stringify(out, null, 2));

const yn = (b) => (b ? '●' : '○');
console.log('\n  LF MW GW BM   outcome                              kcal   protein     intent');
for (const r of rows) {
  if (r.blocked) {
    console.log(`  ${r.switches.map(yn).join('  ')}   ${'— cannot be reached —'}`);
    continue;
  }
  console.log(
    `  ${r.switches.map(yn).join('  ')}   ${r.name.padEnd(36)}` +
      `${String(r.kcal ?? '—').padStart(5)}  ${(r.protein ?? '—').padEnd(11)} ${r.intent ?? '—'}`
  );
}
console.log(`\n  PAUSED (any combination)              ${String(out.paused.kcal).padStart(5)}  ${out.paused.protein}`);

const valid = rows.filter((r) => !r.blocked);
const names = valid.map((r) => r.name);
const dupes = names.filter((n, i) => names.indexOf(n) !== i);
console.log(
  `\n  ${rows.length} combinations: ${valid.length} reachable, ${rows.length - valid.length} blocked.` +
    `\n  ${new Set(names).size} distinct outcomes.` +
    (dupes.length ? `  REPEATED NAMES: ${[...new Set(dupes)].join(', ')}` : '') +
    '\n'
);

// Identical figures are worth naming even when the states differ, because her
// reply asks for them merged or justified.
const seen = new Map();
for (const r of valid.filter((x) => !x.empty)) {
  const key = `${r.kcal}|${r.protein}`;
  seen.set(key, [...(seen.get(key) ?? []), r.name]);
}
for (const [key, group] of seen) {
  if (group.length > 1) console.log(`  SAME FIGURES (${key.replace('|', ' kcal, ')}): ${group.join('  ·  ')}`);
}
console.log('');
