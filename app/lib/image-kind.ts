// Classifying what a logged photo actually is (build item 10b).
//
// The composer's "+" is SOURCE-based — take a photo, choose from library,
// choose a file — and deliberately never asks what the person is photographing.
// Making someone categorise their own photo is the closed menu the free-text
// philosophy exists to reject. So the image is classified once, and dispatched
// to whichever parse path already handles it.
//
// The three destinations already exist and accept images: parse-body-measurement
// (a scale readout), parse-food (a meal, a nutrition label), and parse-activity
// (a treadmill display, a Samsung Health screenshot).

export type ImageKind = 'body_measurement' | 'food' | 'activity' | 'unclear';

const KINDS: ImageKind[] = ['body_measurement', 'food', 'activity', 'unclear'];

// Valid-or-unclear, never valid-or-guess. An invented kind would send a photo to
// the wrong parser and store nonsense against someone's real data, so anything
// unrecognised degrades to 'unclear' and the app asks rather than assuming.
export function coerceImageKind(v: unknown): ImageKind {
  return typeof v === 'string' && (KINDS as string[]).includes(v) ? (v as ImageKind) : 'unclear';
}

// Which route handles each kind. 'unclear' has none by design — the caller asks
// the person instead of picking a default, because every default here is a way
// of being confidently wrong about their data.
export function routeForKind(kind: ImageKind): string | null {
  switch (kind) {
    case 'body_measurement':
      return '/api/parse-body-measurement';
    case 'food':
      return '/api/parse-food';
    case 'activity':
      return '/api/parse-activity';
    default:
      return null;
  }
}

export const IMAGE_KIND_PROMPT = `You are looking at ONE photo someone has just added to a body-literacy app, to be logged. Say which of these it is:

- "body_measurement" — a reading from bioimpedance scales or a scale app: weight, body fat percentage, muscle mass, BMR. Usually a phone screenshot of an app like Zepp Life, or a scale's own display.
- "food" — something eaten or drunk, or something that describes it: a meal, a snack, a drink, a menu, a nutrition label, a packet.
- "activity" — movement that was done, or a device reporting it: a treadmill or bike display, a fitness watch, a step count, a workout summary screen.
- "unclear" — anything else, or genuinely ambiguous between the above.

Choose "unclear" rather than guessing. A wrong guess files a photo against the wrong kind of data and is worse than asking. Respond with the classification only.`;
