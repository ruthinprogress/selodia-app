// Which drawn icon an activity gets, from the words it was logged with.
//
// FREE TEXT IN, EIGHT SHAPES OUT. Activities arrive as whatever somebody said -
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
  | 'movement';

const RULES: [ActivityIconKind, RegExp][] = [
  ['yoga', /\b(yoga|pilates|barre|vinyasa|ashtanga|hatha)\b/i],
  // A BALLET SLIPPER WAS TRIED AND DROPPED (2026-09-20). Drawn twice, it read
  // as a blob at the 26 points a card gives it: a slipper needs a ribbon and a
  // sole to be a slipper at all. The dancing figure says the same thing
  // legibly, which is the only test a small drawing has to pass.
  ['dance', /\b(ballet|barre class|pointe|dance|dancing|zumba|salsa|tap class)\b/i],
  ['climb', /\b(climb|climbing|bouldering|scrambl)/i],
  ['swim', /\b(swim|swimming|pool|breaststroke|front crawl|lengths)\b/i],
  ['cycle', /\b(cycle|cycling|bike|biking|spin class|spinning|turbo)\b/i],
  ['run', /\b(run|running|jog|jogging|sprint|5k|10k|parkrun|treadmill)\b/i],
  ['walk', /\b(walk|walking|hike|hiking|steps|stroll|rambl)/i],
  ['stretch', /\b(stretch|stretching|mobility|flexibility|splits?|straddle|pancake|hamstrings?|hip openers?|foam roll|warm[ -]?up|cool[ -]?down)\b/i],
  ['strength', /\b(strength|weights|lifting|gym|resistance|squats?|deadlift|press|kettlebell|dumbbell|barbell|circuit|toning|tone|glutes?|core|abs|upper body|lower body|legs? day)\b/i],
];

export function activityIcon(activityType: string | null | undefined): ActivityIconKind {
  const text = (activityType ?? '').trim();
  if (!text) return 'movement';
  for (const [kind, re] of RULES) if (re.test(text)) return kind;
  return 'movement';
}
