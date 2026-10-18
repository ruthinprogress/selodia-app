// THE LOOSE MOVEMENTS, which are most of the library.
//
// illustration-progressions.mjs holds the four ladders, where the order is part
// of the meaning. This holds everything else: movements that stand on their own
// and are drawn because somebody's plan asked for them.
//
// THE LIST COMES FROM HER PLANS, NOT FROM A CATALOGUE. scope-illustration-gaps
// says 99 movements have no demonstration of any kind;
// illustration-list.mjs narrows that to the ones the model has actually written
// into a saved plan, which is the far shorter list worth drawing first. These
// are those, minus the two handstand entries that are still unsettled - the
// chat asks for a "chest-to-wall handstand hold" and "kick-up practice against
// the wall" while the drawn ladder offers neither by those names, and whether
// the vocabulary or the ladder moves is Ruth's call, not a drawing problem.
//
// THE NAME IS THE JOIN KEY. It is matched against a plan's exercise name
// exactly or by its exact word set, so it is the plain name of the movement and
// nothing else: no entry method, no equipment, no qualifier. "tuck handstand
// hold, pressed from crow" was a stage name that nothing could ever have
// reached. Where the model writes something longer, an alias carries it.

// WEIGHTS ARE THE ANIMATICS' JOB, NOT THE ILLUSTRATIONS' (Ruth, 18 October):
// "The idea was that the gym and weights images came from animatics, and all
// the illustrations were to cover yoga-style and floor work and stretches and
// calisthenics work first to make a broader coverage. Leave anything on the
// list with weights for now, use the credits on the gap we actually have."
//
// The clip library is 950 movements and overwhelmingly a gym library: 194 Legs,
// 108 Back, 84 Shoulders, 76 Chest, 14 Powerlifting. A barbell deadlift drawn
// by hand duplicates a clip that already exists and teaches less, because a
// clip moves.
//
// So anything requiring a barbell, dumbbell or plate is PARKED below rather
// than deleted - the descriptions are written and correct, and if the animatic
// route ever fails for one of them it can come back in a line.
//
// AND THE AIM IS COVERAGE, NOT THE BACKLOG. Her words: "we can then cover most
// user cases: ie, create a movements plan from our library to support the user
// with most goals across the full body goal spectrum." A list built only from
// what has already appeared in a plan can never do that - it describes where
// she has been, not where somebody new might go.

/** @typedef {{ name: string, start: string, finish: string, inverted?: boolean, ruleOut?: string, connects?: string }} Movement */

/** @type {Movement[]} */
export const MOVEMENTS = [
  // ---- Lower body ----
  {
    name: 'sumo squat',
    start:
      'Standing with the feet much wider than the hips and the toes turned clearly outward, hands together at the chest, body upright.',
    finish:
      'Squatted straight down between the feet with the hips to about knee height, the knees travelling out over the turned-out toes, the torso staying vertical rather than leaning forward.',
    ruleOut: 'an ordinary squat with the feet at hip width',
  },
  {
    name: 'split squat',
    start:
      'Standing in a split stance, one foot a long stride ahead of the other, the back heel lifted, hips square and facing forward, hands at the chest.',
    finish:
      'Lowered straight down so the back knee comes close to the floor and the front knee is bent to about a right angle, the torso still upright, the weight through the front foot.',
    ruleOut: 'a forward lunge where the front foot steps out',
    connects: 'The feet do not move between the frames; only the body lowers.',
  },
  {
    name: 'curtsy lunge',
    start: 'Standing tall with the feet hip width, hands together at the chest.',
    finish:
      'One leg swept behind and ACROSS the other, so the back foot lands outside the line of the front hip, both knees bent, the hips staying square and facing forward rather than turning with the leg.',
    ruleOut: 'a reverse lunge where the foot steps straight back',
  },
  {
    name: 'sit to stand',
    start:
      'Seated on the front half of a plain chair with both feet flat on the floor beneath the knees, torso leaning slightly forward, arms reaching ahead.',
    finish:
      'Standing tall in front of the chair, hips and knees straight, arms coming back down, the chair still drawn behind her.',
  },
  {
    name: 'standing calf raise',
    start:
      'Standing tall with the feet hip width and flat on the floor, arms at the sides, body straight.',
    finish:
      'Risen onto the balls of the feet with the heels lifted high, ankles straight rather than rolling out, body still vertical and not leaning forward.',
  },
  {
    name: 'single-leg glute bridge',
    start:
      'Lying on the back with one foot flat on the floor and that knee bent, the other leg lifted with the knee straight, arms resting along the floor at the sides.',
    finish:
      'The hips lifted so the body makes one straight line from the shoulders to the lifted knee, the supporting foot still flat, the raised leg still straight and in line with the body.',
  },
  {
    name: 'side-lying leg lift',
    start:
      'Lying on one side with the legs stacked and straight, the head resting on the lower arm, the upper hand on the floor in front of the chest, hips square.',
    finish:
      'The top leg lifted straight up, the foot level rather than turned out, the hips staying stacked and not rolling backward.',
  },

  // ---- Trunk, upper body, mobility ----
  {
    name: 'dead bug',
    start:
      'Lying on the back with both arms reaching straight up toward the ceiling and both knees above the hips bent to a right angle, the lower back flat on the floor.',
    finish:
      'One arm lowered back past the head and the OPPOSITE leg straightened out along the floor just above it, the other arm and knee staying exactly where they started, the lower back still flat.',
    ruleOut: 'both arms and both legs moving together',
  },
  {
    name: 'plank shoulder taps',
    start:
      'In a plank on both hands with the feet set wide for balance, body in one straight line from head to heels, hips level.',
    finish:
      'One hand lifted clear of the floor to touch the opposite shoulder, the body still in one straight line and the HIPS STILL LEVEL rather than twisting toward the lifted side.',
  },
  {
    name: 'incline press up',
    start:
      'Hands on a raised flat surface a little wider than the shoulders, feet on the floor behind, body in one straight line from head to heels, arms straight.',
    finish:
      'Chest lowered to the surface with the elbows travelling back at about forty-five degrees rather than flaring straight out, the body still one straight line.',
    ruleOut: 'a press up with the hands on the floor',
  },
  {
    name: 'cat cow',
    start:
      'On hands and knees with the hands under the shoulders and the knees under the hips, the belly lowered and the chest and tailbone lifted so the back makes a gentle dip.',
    finish:
      'The same hands and knees position with the back rounded up toward the ceiling instead, the head and the tailbone both dropping, the shoulders pressing away from the floor.',
    connects: 'The hands and knees stay in exactly the same place; only the spine changes.',
  },
  {
    name: 'shoulder pass through',
    start:
      'Standing tall holding a long light stick in both hands against the front of the thighs, the hands set very wide apart, arms straight.',
    finish:
      'The stick carried up and over the head to rest behind the hips, the ARMS STAYING STRAIGHT the whole way and the hands still wide, the ribs staying down rather than the back arching.',
    ruleOut: 'the elbows bending to bring the stick over',
  },
  {
    name: "world's greatest stretch",
    start:
      'In a deep lunge with the front foot flat and both hands planted on the floor on the INSIDE of that front foot, the back leg long with the knee off the floor.',
    finish:
      'The inside hand lifted and reaching straight up toward the ceiling with the chest rotating open to follow it, the eyes going up after the hand, the other hand still on the floor and the lunge unchanged.',
  },
  {
    name: 'wrist prep',
    start:
      'On hands and knees with the palms flat and the fingers pointing forward, the wrists directly under the shoulders, arms straight.',
    finish:
      'The weight rocked gently forward over the hands so the wrists bend further and the heels of the palms stay pressed down, the fingertips gripping lightly, the arms still straight.',
  },
  {
    name: 'pike hold on a box',
    start:
      'In a plank with both hands on the floor and both feet up on a low box behind, body in one straight line, arms straight.',
    finish:
      'The hands walked back toward the box so the hips lift high over the shoulders into a sharp inverted V, the legs staying straight and the feet still on the box, the head between the arms.',
    inverted: true,
  },
];


/*
 * PARKED: weights. The animatics cover these. Un-park by moving an object
 * back into MOVEMENTS above - the descriptions are written and correct.
 *
 * barbell deadlift
 * romanian deadlift
 * goblet squat
 * lying hamstring curl
 * barbell overhead press
 *
 *   barbell deadlift:
 *     {
 *       name: 'barbell deadlift',
 *       start:
 *         'Standing over a barbell with the feet hip width, hinged forward at the hips so the shins touch the bar, both hands gripping it just outside the knees, arms straight, back flat and long from the hips to the head, chest lifted.',
 *       finish:
 *         'Standing tall with the barbell resting against the top of the thighs, hips and knees straight, shoulders down and back, arms still straight, the bar close to the body throughout.',
 *       ruleOut: 'a squat',
 *     },
 *   romanian deadlift:
 *     {
 *       name: 'romanian deadlift',
 *       start:
 *         'Standing tall holding a barbell against the front of the thighs, feet hip width, knees softly bent, shoulders back.',
 *       finish:
 *         'Hinged back at the hips with the barbell lowered to just below the knees, shins staying vertical, the knees no more bent than at the start, back flat, weight back in the heels. THE HIPS TRAVEL BACKWARD, not down.',
 *       ruleOut: 'a barbell deadlift from the floor',
 *       connects: 'The bar slides down the thighs and stays touching the legs the whole way.',
 *     },
 *   goblet squat:
 *     {
 *       name: 'goblet squat',
 *       start:
 *         'Standing with the feet a little wider than the hips, toes turned slightly out, holding a single dumbbell upright against the chest with both hands cupped under its top end, elbows pointing down.',
 *       finish:
 *         'Squatted down with the hips below the knees, the dumbbell still at the chest, elbows tracking down inside the knees, chest tall and the back long rather than rounded.',
 *     },
 *   lying hamstring curl:
 *     {
 *       name: 'lying hamstring curl',
 *       start:
 *         'Lying face down with the legs straight and together, a single dumbbell held upright between the feet, forearms folded under the forehead.',
 *       finish:
 *         'Both knees bent to draw the lower legs up toward the buttocks, the dumbbell still held between the feet, the hips staying down on the floor.',
 *     },
 *   barbell overhead press:
 *     {
 *       name: 'barbell overhead press',
 *       start:
 *         'Standing tall with a barbell resting across the front of the shoulders at collarbone height, the elbows pointing forward and underneath the bar, feet hip width, ribs down.',
 *       finish:
 *         'The barbell pressed to straight arms directly above the head, the head having moved through so the bar sits over the middle of the body rather than out in front, legs straight.',
 *       ruleOut: 'a push press where the legs bend to drive the bar up',
 *     },
 */

/** Every movement name, for the scripts that need just the list. */
export const MOVEMENT_NAMES = MOVEMENTS.map((m) => m.name);
