// Which icon an activity gets, from the words it was logged with.
//
// THE DRAWINGS BECAME LIBRARY ICONS ON 21 SEPTEMBER 2026 and none of this
// changed, which is the point of the split: this file decides WHICH mark, and
// activity-icon.tsx decides what that mark looks like. Swapping every drawing
// in the app for Material Community Icons touched one file and left the
// matching alone.
//
// FREE TEXT IN, TEN SHAPES OUT. Activities arrive as whatever somebody said -
// "ballet", "1.5 hours ballet then yoga", "walked the dog", "Samsung daily
// summary" - so this answers one question only: which of the eight drawings
// belongs beside it. Anything unrecognised gets the plain movement mark rather
// than a wrong guess.
//
// ORDER MATTERS, as it did for food. "Strength yoga" is yoga; "yoga with
// weights" is still yoga, because the class is the thing she did. So the named
// disciplines are matched before the equipment.

export type ActivityIconKind =
  | 'walk'
  | 'run'
  | 'yoga'
  | 'dance'
  | 'strength'
  | 'cycle'
  | 'swim'
  | 'climb'
  | 'stretch'
  | 'rest'
  | 'movement';

const RULES: [ActivityIconKind, RegExp][] = [
  // A REST DAY IS NOT A MOVEMENT (Ruth, 22 October 2026): "Rest day needs a
  // more restful icon. Currently the same as pullup practice."
  //
  // Both were falling through to the plain movement mark, so her Thursday read
  // as the same kind of thing as her pull-ups. A rest day is the opposite of
  // everything else on that screen and the one entry that should look it.
  //
  // FIRST, AND DELIBERATELY NARROW. "Recovery run" is a run, so bare
  // "recovery" is not matched - only the phrases that can mean nothing else.
  ['rest', /\b(rest day|rest|recovery day|active recovery|day off)\b/i],
  ['yoga', /\b(yoga|pilates|barre|vinyasa|ashtanga|hatha)\b/i],
  // THE BALLET SLIPPER, RESOLVED (2026-09-21). It was drawn and dropped twice
  // on 20 September and once more the next day - at 26 points a hand-drawn
  // slipper is a blob, because a slipper needs a ribbon and a sole to be a
  // slipper at all. It exists in the icon library, drawn properly, and always
  // did. Two days of drawing answered by one glyph name is worth remembering
  // the next time something small has to be legible.
  ['dance', /\b(ballet|barre class|pointe|dance|dancing|zumba|salsa|tap class)\b/i],
  ['climb', /\b(climb|climbing|bouldering|scrambl)/i],
  ['swim', /\b(swim|swimming|pool|breaststroke|front crawl|lengths)\b/i],
  ['cycle', /\b(cycle|cycling|bike|biking|spin class|spinning|turbo)\b/i],
  ['run', /\b(run|running|jog|jogging|sprint|5k|10k|parkrun|treadmill)\b/i],
  ['walk', /\b(walk|walking|hike|hiking|steps|stroll|rambl)/i],
  ['stretch', /\b(stretch|stretching|mobility|flexibility|splits?|straddle|pancake|hamstrings?|hip openers?|foam roll|warm[ -]?up|cool[ -]?down)\b/i],
  // PULL-UPS ARE STRENGTH, which is the other half of what she circled: "Pull-up
  // practice" fell through to the plain movement mark too, so the only two
  // entries on her Wednesday that were not a named sport looked identical to
  // each other AND to her rest day.
  ['strength', /\b(strength|weights|lifting|gym|resistance|squats?|deadlift|press|kettlebell|dumbbell|barbell|circuit|toning|tone|glutes?|core|abs|upper body|lower body|legs? day|pull[ -]?ups?|chin[ -]?ups?|push[ -]?ups?|press[ -]?ups?|dips?)\b/i],
];

export function activityIcon(activityType: string | null | undefined): ActivityIconKind {
  const text = (activityType ?? '').trim();
  if (!text) return 'movement';
  for (const [kind, re] of RULES) if (re.test(text)) return kind;
  return 'movement';
}
