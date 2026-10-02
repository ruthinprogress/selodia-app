// THE SEED LADDERS. A rung with no clip is shown as text, not withheld.
//
// THIS RULE CHANGED ON 29 SEPTEMBER AND THE OLD ONE IS WORTH KEEPING VISIBLE.
// The overnight brief said "seed only ladders the library can honestly show",
// and that was read as: a ladder with any undemonstrable rung cannot exist. The
// consequence was severe and immediate - the 923-clip library has no handstand,
// no muscle up, no scapular pull, no dead hang and no bar dip, so **Ruth's own
// joy track could not be offered at all**, and her headline goal was absent
// from an app built for her.
//
// Her correction: show those rungs TEXT-ONLY - name, cue, and the "Needs: X
// first" line - with no placeholder image and no broken clip frame. That is the
// right reading of "honestly". The dishonesty was never in naming a movement;
// it was only ever in pretending to demonstrate one.
//
// WHAT IS STILL NOT IN THE LIBRARY, checked against movement_assets:
//
//   handstand        0 clips   (wall hold, freestanding, handstand splits)
//   muscle up        0 clips   - her headline goal
//   scapular         0 clips   (scapular pulls)
//   dead hang        0 clips   as a movement of its own
//   bar dip          0 clips   (ring dips exist; a bar dip does not)
//   front/middle split  0 clips   (every "split" clip is a split SQUAT)
//
// THE GAP LIST STAYS, and its job has changed rather than ended. It is no
// longer the reason a ladder is missing - it is the commission brief for
// Exercise Animatic, and each line is one clip to be drawn.
//
// A RUNG WITH A NAMED CLIP MUST HAVE THAT CLIP, and
// scripts/check-skill-clips.mjs fails if one stops existing. `clip: null` is an
// honest declaration; a named clip that is not there is the failure, because
// the screen would show nothing while claiming to show something. That is how
// the movement coverage claim went wrong twice in September.

export type Stage = 'now' | 'next' | 'goal';

export type LadderRung = {
  name: string;
  /** A target on the rung she is on; a prerequisite on the ones above it. */
  target?: string;
  needs?: string;
  /** Why this step is here. Ruth's "Why:" line. */
  detail?: string;
  /**
   * What this rung builds. Ruth's "Develops:" line, kept apart from the why
   * because a reason and an outcome are different things and she wrote them
   * separately. Never a prediction about her.
   */
  develops?: string;
  /**
   * How to perform it - a breathing cue, say. Ruth's "Add:" line.
   *
   * GUIDANCE, NEVER AN EXCLUSION. Her note on the approved wording: "This is
   * guidance for HOW to do a move. It is not a Rule. It excludes nothing and
   * must NOT be written to user_rules." Keeping it on the rung is what stops it
   * reaching the rules gate, which removes movements.
   */
  cue?: string;
  /**
   * Her own grouping, where she has given one. Set on every rung of a ladder or
   * none of them: `placeRungs` treats any declared stage as "she grouped this
   * herself" and stops imposing one Now and one Next.
   */
  stage?: Stage;
  /** movement_assets.match_key, or null when nothing can demonstrate it. */
  clip: string | null;
};

export type Ladder = {
  key: string;
  name: string;
  /** One of the six Insights dimensions. */
  dimension: string;
  /** One note that applies to every rung. Guidance, not a rule. */
  note?: string;
  /** Lowest rung first. Stage is assigned from her answer, not stored here. */
  rungs: LadderRung[];
};

export const LADDERS: Ladder[] = [
  {
    key: 'strict_pull_up',
    name: 'A strict pull-up',
    dimension: 'strength',
    rungs: [
      {
        name: 'Assisted pull-up',
        target: 'Full range, with as little help as you need',
        detail:
          'A machine or a band takes some of your weight. The point is the full movement, not the number.',
        clip: 'assisted pull up',
      },
      {
        name: 'Band pull-up',
        needs: 'Comfortable with the assisted version first',
        detail: 'A band gives most help at the bottom, where it is hardest, and least at the top.',
        clip: 'band pull up',
      },
      {
        name: 'Strict pull-up',
        needs: 'Band pull-ups with a light band',
        detail: 'From a straight-arm start to chin over the bar, with nothing swinging.',
        clip: 'grip normal pull up',
      },
    ],
  },
  {
    key: 'hanging_core',
    name: 'Hanging core',
    dimension: 'strength',
    rungs: [
      {
        name: 'Hollow hold',
        target: 'A steady hold with your lower back flat to the floor',
        detail: 'The shape every hanging movement needs. Done on the floor, so nothing is at stake.',
        clip: 'hold hollow',
      },
      {
        name: 'Hanging knee raise',
        needs: 'A hollow hold you can keep still',
        clip: 'hanging knee oblique raise',
      },
      {
        name: 'Hanging leg raise',
        needs: 'Knee raises without swinging',
        clip: 'hanging leg raise',
      },
    ],
  },
  {
    key: 'front_lever',
    name: 'Front lever',
    dimension: 'strength',
    rungs: [
      {
        name: 'Hollow hold',
        target: 'The same shape as the hanging ladder. One thing, two uses',
        clip: 'hold hollow',
      },
      {
        name: 'Front lever raise',
        needs: 'A hollow hold and a strict pull-up',
        clip: 'front lever raise',
      },
      {
        name: 'Back lever',
        needs: 'Front lever raises with control',
        detail: 'The other way up, and a different kind of hard.',
        clip: 'back lever',
      },
    ],
  },

  // ---- THE TWO THE LIBRARY CANNOT DEMONSTRATE, added 29 September 2026 ----
  //
  // Every rung below carries a CUE, and that is not decoration: for these the
  // words are the whole demonstration, so a rung with no clip and no cue would
  // genuinely be a name and nothing else. `detail` is required in spirit here
  // even though the type allows it to be absent, and
  // scripts/check-skill-clips.mjs enforces it.
  {
    key: 'muscle_up',
    name: 'Muscle up',
    dimension: 'strength',
    // RUTH'S OWN WORDS, APPROVED 1 OCTOBER 2026, in "2026-10-01 For Claude Code
    // - approved wording and onboarding findings". Every line below is hers.
    //
    // DO NOT EDIT THE COPY. The previous version was mine, written from her plan
    // rather than from her sentences, and it differed in ways that mattered: it
    // called the third rung "Strict pull-up" where she wrote "Pull-up volume"
    // with a target of 3 x 5, and it carried no breathing cues at all. Her brief
    // for Skills says only store what she said.
    note:
      'Keep breathing through every rep. Breathe out on the effort. Do not hold your breath or bear down.',
    rungs: [
      {
        name: 'Dead hang',
        target: '3 x 20-30s',
        stage: 'now',
        detail: 'Every pull starts here, and it decompresses the shoulders and builds grip.',
        develops: 'Grip and shoulder comfort.',
        clip: null,
      },
      {
        name: 'Scapular pulls',
        target: '3 x 8-10 clean reps',
        stage: 'now',
        detail:
          'Arms straight, shoulder blades pulled down. It teaches the shoulder to set before the arms pull and protects it.',
        develops: 'Shoulder-blade control.',
        clip: null,
      },
      {
        name: 'Pull-up volume',
        target: '3 x 5 strict',
        stage: 'now',
        detail:
          'Full range from a dead hang with no kipping. This is the gate to everything above, so build the number before adding anything harder.',
        develops: 'Pulling strength.',
        // The only rung in this ladder the library can show.
        clip: 'grip normal pull up',
      },
      {
        name: 'High pull-ups',
        needs: '5 strict pull-ups',
        stage: 'next',
        target: '3 x 3-5 with full rest',
        detail:
          'Pull so the chest reaches the bar, not just the chin. This trains the height and momentum the transition needs.',
        develops: 'Explosive pulling.',
        cue: 'Breathe out as you pull.',
        clip: null,
      },
      {
        name: 'Bar dips',
        target: '3 x 8 full range',
        stage: 'next',
        detail: 'The last part of a muscle up is a press above the bar.',
        develops: 'Pushing strength in the chest, shoulders and triceps.',
        clip: null,
      },
      {
        name: 'Muscle up',
        needs: '8-10 pull-ups, bar dips and high pull-ups',
        stage: 'goal',
        detail: 'This puts the three together.',
        develops: 'The move over the bar.',
        cue: 'Breathe out through the move over the bar.',
        clip: null,
      },
    ],
  },
  {
    key: 'handstand',
    name: 'Handstand',
    dimension: 'balance',
    rungs: [
      {
        name: 'Wall handstand hold',
        target: '60 seconds accumulated',
        detail:
          'Chest to the wall rather than back to it, so you learn a straight line instead of a banana. Accumulated means across several goes, not in one.',
        clip: null,
      },
      {
        name: 'Freestanding handstand',
        needs: 'a solid 60-second wall hold',
        detail:
          'Balance comes from the fingers, not the shoulders. Learn to bail out sideways before you try to hold on.',
        clip: null,
      },
      {
        name: 'Handstand splits',
        needs: 'a freestanding handstand and flat splits',
        detail:
          'The shape you already have on the floor, upside down. It is the splits ladder and the handstand ladder meeting, which is why it is last on both.',
        clip: null,
      },
    ],
  },
  {
    // ADDED BECAUSE THE CHECK ASKED FOR IT. The gap list wanted a front split
    // and a middle split, and no rung wanted either - which the orphan-gap
    // check flagged as "a ladder is missing", and it was right. Her own
    // prototype carries "Splits flexibility" as a Now rung and the overnight
    // run had dropped it along with everything else the library cannot draw.
    key: 'splits',
    name: 'Splits',
    dimension: 'flexibility',
    rungs: [
      {
        name: 'Front split, both sides',
        target: 'Flat, both sides, without propping',
        detail:
          'Front leg straight, back hip square and pointing down rather than opening out. Daily and unhurried beats hard and occasional; this is the one thing on any of these ladders that genuinely does not respond to effort.',
        clip: null,
      },
      {
        name: 'Middle split',
        needs: 'comfortable flat front splits',
        detail:
          'A different joint and a different limit - this one is hips rather than hamstrings, so progress on the front split does not carry over as much as it feels like it should.',
        clip: null,
      },
    ],
  },
];

/**
 * THE GAP LIST. Movements a ladder needs and the library cannot show.
 *
 * ITS JOB CHANGED ON 29 SEPTEMBER. It used to be the reason a ladder did not
 * exist; now those ladders exist as text and this is purely **the commission
 * brief for Exercise Animatic**. Each line is one clip to be drawn, and the
 * rung that wants it is already on somebody's screen waiting for it.
 *
 * Kept in code beside the ladders rather than in a document, so it is in front
 * of whoever next writes a ladder rather than in a folder they would have to
 * know to open.
 */
export const CLIP_GAPS: { movement: string; wantedFor: string }[] = [
  { movement: 'Dead hang', wantedFor: 'The first rung of every bar ladder' },
  { movement: 'Scapular pull', wantedFor: 'Shoulder position before any pulling' },
  { movement: 'High pull-up (chest to bar)', wantedFor: 'Muscle-up preparation' },
  { movement: 'Bar dip', wantedFor: 'Muscle-up preparation. Only ring dips exist' },
  { movement: 'Muscle up', wantedFor: 'The goal rung of the calisthenics ladder' },
  { movement: 'Wall handstand hold', wantedFor: 'The first handstand rung' },
  { movement: 'Freestanding handstand', wantedFor: 'The second handstand rung' },
  { movement: 'Handstand splits', wantedFor: 'The goal rung of the handstand ladder' },
  { movement: 'Front split', wantedFor: 'Flexibility ladder. Every "split" clip is a split SQUAT' },
  { movement: 'Middle split', wantedFor: 'Flexibility ladder' },
];

export const LADDER_BY_KEY: Record<string, Ladder> = Object.fromEntries(
  LADDERS.map((l) => [l.key, l])
);

export type Placement = 'starting' | 'some' | 'nearly';

/**
 * Where she says she is, turned into stages.
 *
 * TWO RULES, because two kinds of ladder exist.
 *
 * A LADDER SHE HAS GROUPED HERSELF keeps her grouping. The muscle-up ladder she
 * approved on 1 October puts THREE rungs under NOW - dead hang, scapular pulls,
 * pull-up volume - and two under NEXT. The rule below used to force exactly one
 * Now and one Next, on the reasoning that "two Nows is two answers to what am I
 * working on". That reasoning is sound for a ladder nobody has grouped and wrong
 * for one she wrote: her three Now rungs are not three answers, they are the
 * three things she does at the bar in one visit. Overriding her grouping would
 * have shown her a ladder she had just approved, rearranged.
 *
 * Placement then only says how much she has already passed:
 *   starting - her grouping as written
 *   some     - the lowest rung dropped, the rest unchanged
 *   nearly   - the whole Now group dropped and Next promoted to Now
 *
 * A LADDER WITH NO GROUPING gets the old rule: one Now, one Next, the rest Goal.
 *
 * Nothing below her Now is ever shown as done, because a completed list is a
 * score.
 */
export function placeRungs(ladder: Ladder, placement: Placement): (LadderRung & { stage: Stage })[] {
  const grouped = ladder.rungs.some((r) => r.stage !== undefined);
  if (grouped) return placeGrouped(ladder, placement);

  const last = ladder.rungs.length - 1;
  const nowIndex =
    placement === 'nearly' ? last : placement === 'some' ? Math.min(1, last) : 0;

  return ladder.rungs
    .map((rung, i) => ({
      ...rung,
      stage: (i < nowIndex ? null : i === nowIndex ? 'now' : i === nowIndex + 1 ? 'next' : 'goal') as
        | Stage
        | null,
    }))
    .filter((r): r is LadderRung & { stage: Stage } => r.stage !== null);
}

function placeGrouped(
  ladder: Ladder,
  placement: Placement
): (LadderRung & { stage: Stage })[] {
  // Her own stages, defaulting to 'goal' for anything she left unlabelled.
  const all = ladder.rungs.map((r) => ({ ...r, stage: r.stage ?? 'goal' }));

  if (placement === 'starting') return all;

  if (placement === 'some') {
    // One rung in. Dropping only the lowest keeps every other label hers.
    const [, ...rest] = all;
    return rest.length > 0 ? rest : all;
  }

  // Nearly there: what she called Next is what she is working on.
  const promoted = all
    .filter((r) => r.stage !== 'now')
    .map((r) => ({ ...r, stage: (r.stage === 'next' ? 'now' : r.stage) as Stage }));
  // A ladder that was all Now has nothing to promote; keep the top rung rather
  // than return an empty ladder.
  return promoted.length > 0 ? promoted : [all[all.length - 1]];
}
