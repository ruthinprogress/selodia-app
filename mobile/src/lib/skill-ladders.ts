// THE SEED LADDERS, AND ONLY THE ONES THE LIBRARY CAN ACTUALLY SHOW.
//
// Ruth's brief: "Seed only ladders the library can honestly show; list the
// missing clips." That constraint turned out to be the whole story of this
// slice, because the 923-clip library cannot show most of her own joy track.
//
// WHAT IS NOT IN THE LIBRARY, checked against movement_assets on 2026-09-28:
//
//   handstand        0 clips   (wall hold, freestanding, handstand splits)
//   muscle up        0 clips   - her headline goal
//   scapular         0 clips   (scapular pulls)
//   dead hang        0 clips   as a movement of its own
//   bar dip          0 clips   (ring dips exist; a bar dip does not)
//   front/middle split  0 clips   (every "split" clip is a split SQUAT)
//
// So the muscle-up ladder cannot be seeded honestly and is not seeded. It is on
// the gap list instead, which is the point of having one. Three ladders CAN be
// shown end to end, and they are below.
//
// EVERY RUNG NAMES ITS CLIP, and scripts/check-skill-clips.mjs fails if any of
// them stops existing. A ladder whose rungs quietly lose their demonstrations
// is how the movement coverage claim went wrong in September.

export type Stage = 'now' | 'next' | 'goal';

export type LadderRung = {
  name: string;
  /** A target on the rung she is on; a prerequisite on the ones above it. */
  target?: string;
  needs?: string;
  detail?: string;
  /** movement_assets.match_key, or null when nothing can demonstrate it. */
  clip: string | null;
};

export type Ladder = {
  key: string;
  name: string;
  /** One of the six Insights dimensions. */
  dimension: string;
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
];

/**
 * THE GAP LIST. Movements a ladder would want and the library cannot show.
 *
 * Kept in code beside the ladders rather than in a document, so it is in front
 * of whoever next writes a ladder. Each line is a commission brief for the
 * animatics vendor.
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
 * "Just starting" puts her on the bottom rung; "some of it" on the middle;
 * "nearly there" on the top. Everything below her Now is dropped rather than
 * shown as done, because a completed list is a score, and everything above the
 * one after it is a Goal.
 *
 * ONE 'now' AND ONE 'next', ALWAYS. Two Nows is two answers to "what am I
 * working on", which is the question this screen exists to answer.
 */
export function placeRungs(ladder: Ladder, placement: Placement): (LadderRung & { stage: Stage })[] {
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
