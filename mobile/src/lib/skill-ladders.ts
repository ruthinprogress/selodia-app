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
    rungs: [
      {
        name: 'Dead hang',
        target: '3 x 20-30 seconds',
        detail:
          'Hang from the bar with straight arms and shoulders relaxed away from your ears. Grip and shoulder decompression. Always the first thing you do at the bar.',
        clip: null,
      },
      {
        name: 'Scapular pulls',
        target: '3 x 8-10',
        detail:
          'From a dead hang, arms stay straight and you only depress your shoulder blades, so your body rises an inch or two. It looks like almost nothing and it is what protects the shoulder in everything above.',
        clip: null,
      },
      {
        name: 'Strict pull-up',
        needs: 'scapular pulls you can do without bending your arms',
        detail: 'From a straight-arm start to chin over the bar, with nothing swinging.',
        clip: 'grip normal pull up',
      },
      {
        name: 'High pull-up',
        needs: '5 strict pull-ups',
        detail:
          'An explosive pull so your chest clears the bar rather than your chin. This is where the height and momentum for the transition come from.',
        clip: null,
      },
      {
        name: 'Bar dips',
        target: '3 x 8, full range',
        detail:
          'On the bar rather than on rings, because the bar is where the muscle up finishes. Lower until your shoulders are below your elbows, then press.',
        clip: null,
      },
      {
        name: 'Muscle up',
        needs: '8-10 pull-ups, high pull-ups and bar dips',
        detail:
          'The pull and the dip joined by a transition over the bar. Nothing here is a fitness test; it is a skill, and skills arrive when the pieces are ready.',
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
