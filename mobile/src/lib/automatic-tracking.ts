// AUTOMATIC TRACKING, AS HER ARTWORK DRAWS IT (24 October 2026).
//
// Ruth, on the first version: "no the way it was done is bad. Please see the
// artwork from chatgpt. everything needs to be within the app, clean and easy
// to understand."
//
// WHAT WAS WRONG WITH THE FIRST VERSION, and it is worth naming because the
// code looked reasonable: it lived as a card inside the Sleep log, it explained
// Health Connect at the person, and when something was not working it handed
// them a settings app and a paragraph. Every one of those is the app passing
// its problem outward.
//
// HER FLOW KEEPS IT INSIDE:
//
//   More -> Automatic tracking     one row, everything the phone can send
//   Automatic tracking             every type with its status in one list
//   Sleep                          three states, one action each
//   (the system permission sheet)  the only screen that is not ours
//
// THE FOUR STATES AND THEIR WORDS ARE HERS, from the key at the foot of the
// artwork. They are written here once so that a status in the list and a status
// on the type's own screen can never say two different things:
//
//   Not enabled       "Turn on automatic tracking."
//   Permissions on    "Waiting for first data."
//   Receiving data    "Last night: 7h 12m"
//   Error             "Something isn't right."
//
// THE DISTINCTION THAT MATTERS MOST is between the second and the third, and it
// is the one the old card could not draw. "Permissions are on but nothing has
// arrived" is not a failure - Health Connect can take hours to pass the first
// night through - and telling somebody "Nothing new" at that moment reads as a
// broken app. Her copy says the true thing: it is coming.

export type TrackingState = 'not-enabled' | 'waiting' | 'receiving' | 'error';

/**
 * EVERY TYPE THE APP ASKS FOR, NOT A SHORTLIST (Ruth, 24 October 2026).
 *
 *   "chatgpt may not have got all the data types in as it doesn't know, ofc.
 *    you may need to check this properly so nothing is ommitted that we can
 *    track and should be automatically tracking from phone or apps"
 *
 * She was right. The artwork drew seven; app.json declares TWENTY-FOUR readable
 * types, and the list below is generated from that declaration rather than from
 * anybody's memory of it. A permission the app asks for and never shows the
 * person is the worst of both: they are asked for it at the Health Connect
 * dialog and then given no way to see or change it inside Selodia.
 *
 * GROUPED, BECAUSE TWENTY-FOUR FLAT IS NOT "clean and easy to understand".
 * The groups are the ones the app already thinks in - the same divisions as
 * its own screens - so nothing new has to be learned to read this list.
 *
 * THE TWO META-PERMISSIONS ARE DELIBERATELY ABSENT. READ_HEALTH_DATA_HISTORY
 * and READ_HEALTH_DATA_IN_BACKGROUND are not kinds of data; they are how far
 * back and when. Listing them here would be offering to switch on something
 * that is not a thing anybody tracks.
 */
export type TrackingKind =
  | 'sleep'
  | 'steps'
  | 'distance'
  | 'exercise'
  | 'active-calories'
  | 'total-calories'
  | 'vo2-max'
  | 'weight'
  | 'body-fat'
  | 'lean-mass'
  | 'bone-mass'
  | 'body-water'
  | 'bmr'
  | 'height'
  | 'heart-rate'
  | 'resting-heart-rate'
  | 'blood-pressure'
  | 'oxygen'
  | 'respiratory-rate'
  | 'temperature'
  | 'basal-temperature'
  | 'blood-glucose'
  | 'cycle'
  | 'hydration';

export type TrackingGroup = {
  title: string;
  kinds: TrackingKind[];
};

export const TRACKING_GROUPS: TrackingGroup[] = [
  { title: 'Sleep', kinds: ['sleep'] },
  {
    title: 'Movement',
    kinds: ['steps', 'distance', 'exercise', 'active-calories', 'total-calories', 'vo2-max'],
  },
  {
    title: 'Body',
    kinds: ['weight', 'body-fat', 'lean-mass', 'bone-mass', 'body-water', 'bmr', 'height'],
  },
  {
    title: 'Heart and vitals',
    kinds: [
      'heart-rate',
      'resting-heart-rate',
      'blood-pressure',
      'oxygen',
      'respiratory-rate',
      'temperature',
      'basal-temperature',
      'blood-glucose',
    ],
  },
  { title: 'Cycle', kinds: ['cycle'] },
  { title: 'Food and drink', kinds: ['hydration'] },
];

export const TRACKING_KINDS: TrackingKind[] = TRACKING_GROUPS.flatMap((g) => g.kinds);

export const TRACKING_LABEL: Record<TrackingKind, string> = {
  sleep: 'Sleep',
  steps: 'Steps',
  distance: 'Distance',
  exercise: 'Workouts',
  'active-calories': 'Active calories',
  'total-calories': 'Total calories',
  'vo2-max': 'VO2 max',
  weight: 'Weight',
  'body-fat': 'Body fat',
  'lean-mass': 'Lean mass',
  'bone-mass': 'Bone mass',
  'body-water': 'Body water',
  bmr: 'Basal metabolism',
  height: 'Height',
  'heart-rate': 'Heart rate',
  'resting-heart-rate': 'Resting heart rate',
  'blood-pressure': 'Blood pressure',
  oxygen: 'Blood oxygen',
  'respiratory-rate': 'Breathing rate',
  temperature: 'Body temperature',
  'basal-temperature': 'Basal body temperature',
  'blood-glucose': 'Blood glucose',
  cycle: 'Periods',
  hydration: 'Water',
};

/**
 * The short status beside a row, in her words.
 *
 * `detail` is only ever filled for `receiving`, where there is a real figure to
 * show. The artwork's own example is "Last night: 7h 12m" - the status line
 * carries the most recent true thing rather than the word "on", because "on"
 * tells somebody nothing they cannot already see.
 */
export function statusLabel(state: TrackingState, detail?: string | null): string {
  switch (state) {
    case 'receiving':
      return detail && detail.trim() ? detail : 'Receiving data';
    case 'waiting':
      return 'Waiting for first data';
    case 'error':
      return 'Nothing is sharing this yet';
    case 'not-enabled':
    default:
      return 'Not enabled';
  }
}

/** The fuller sentence on the type's own screen. */
export const STATE_BODY: Record<TrackingState, string> = {
  'not-enabled':
    'Selodía can import this from your phone or wearable. Choose what you would like to share - you can change it any time.',
  waiting:
    'Selodía will import this automatically. It can take a few hours for the first data to arrive.',
  receiving: 'This is arriving from your phone on its own.',
  // THE ONE CASE "WAITING" MUST NOT SWALLOW. See NOTHING_SHARING below.
  error:
    'Selodía is allowed to read this, and nothing has put any in. That switch lives in the app that '
    + 'tracks it, not here.',
};

/**
 * WAITING IS TRUE FOR A FEW HOURS AND A LIE AFTER A MONTH.
 *
 * Health Connect can take hours to pass a first night through, so
 * permissions-on-but-nothing-yet is a real and patient state. Thirty days of
 * nothing is not that state: it means nothing has ever written this kind of
 * data into Health Connect at all, which is a different problem with a
 * different answer.
 *
 * Ruth hit exactly this. She granted sleep, the app said "waiting for first
 * data", and it would have gone on saying it indefinitely while the actual
 * cause - Samsung Health not sharing sleep into Health Connect - sat
 * undiagnosed behind a reassuring sentence.
 *
 * SELODIA CANNOT FLIP THAT SWITCH, and should stop pretending the question is
 * open. What it can do is say which app, which screen, and which switch.
 */
export const NOTHING_SHARING =
  'Nothing has written any of this into Health Connect yet. The switch is inside the app that '
  + 'tracks it - in Samsung Health it is Settings, then Health Connect, then turn the type on. '
  + "Selodía is not allowed to change another app's settings, so this one is yours to tap, and it "
  + 'only has to be done once.';

/** How long an empty read stops meaning "any moment now". */
export const PATIENCE_DAYS = 30;

/** The heading on the type's own screen, with the type's name folded in. */
export function stateHeading(state: TrackingState, label: string): string {
  const name = label.toLowerCase();
  switch (state) {
    case 'receiving':
      return `Automatic ${name} tracking is on`;
    case 'waiting':
      return 'Permissions are on';
    case 'error':
      return 'Nothing is sharing this yet';
    case 'not-enabled':
    default:
      return `Automatic ${name} tracking isn't turned on yet`;
  }
}

/**
 * ONLY A STATE WITH SOMETHING TO DO GETS A BUTTON.
 *
 * `not-enabled` is the one that does: a single primary action, as the artwork
 * draws it. `waiting` deliberately has none - there is nothing to press and
 * offering a button that cannot help is what "Check for new nights" was.
 * `error` offers the way back to the permissions, because that is the only
 * thing that ever fixes it.
 */
export function primaryAction(state: TrackingState): string | null {
  switch (state) {
    case 'not-enabled':
      return 'Turn on automatic tracking';
    case 'error':
      return 'Manage permissions';
    default:
      return null;
  }
}

/**
 * WHICH TYPES SELODÍA CAN ACTUALLY READ TODAY.
 *
 * The artwork lists seven and the app reads two. That is not a problem to hide:
 * the drawing itself shows five of them as "Not enabled", which is the honest
 * state of a thing that is coming. What would be dishonest is a row that offers
 * to turn something on and then does nothing - so a type that cannot be read
 * yet says so plainly on its own screen and has no button at all.
 */
export const READABLE: Record<TrackingKind, boolean> = {
  sleep: true,
  steps: true,
  distance: false,
  exercise: false,
  'active-calories': false,
  'total-calories': false,
  'vo2-max': false,
  weight: false,
  'body-fat': false,
  'lean-mass': false,
  'bone-mass': false,
  'body-water': false,
  bmr: false,
  height: false,
  'heart-rate': false,
  'resting-heart-rate': false,
  'blood-pressure': false,
  oxygen: false,
  'respiratory-rate': false,
  temperature: false,
  'basal-temperature': false,
  'blood-glucose': false,
  cycle: false,
  hydration: false,
};

export const NOT_YET_BODY =
  'Selodía does not read this from your phone yet. When it does, it will appear here and you will be asked before anything is read.';
