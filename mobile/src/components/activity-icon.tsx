import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { useTheme } from '@/hooks/use-theme';
import type { ActivityIconKind } from '@/lib/activity-icon';

// THE MOVEMENT MARKS, FROM THE LIBRARY (21 September 2026).
//
// Ruth, looking at three directions I had drawn by hand: "they are not very
// pretty - do you think we could use an icon database from somewhere, have
// better illustrations and save money on api calls".
//
// She was right about the first half and it is worth saying plainly: the marks
// below used to be mine, drawn path by path, and they were the weakest artwork
// in the app. A ballet slipper was attempted three times across two days and
// abandoned each time because it read as a blob at 26 points. It is in the
// library, drawn properly, and always was.
//
// NO API CALLS WERE EVER INVOLVED, which is the one part of her question that
// needed correcting rather than acting on: an icon here is a glyph in a font
// that ships inside the app. No network, no model, no per-render cost. The
// saving is in the drawing, not the bill.
//
// IT IS NOT A NEW DEPENDENCY EITHER. Material Community Icons ships inside
// @expo/vector-icons, which this app has used since the first screen for the
// tab bar and every chevron - 7,448 icons already in the bundle, of which we
// were using about eleven. The licence is SIL Open Font plus Apache 2.0: free
// commercially, no attribution required in the interface, which is exactly the
// standing rule (find licensed artwork, never generate it).
//
// WHAT IS STILL DRAWN BY HAND, and deliberately: the seed mark, the botanical
// empty states, the water droplet and the drink marks. Those carry the brand
// and a library would flatten them. This file is the small functional marks in
// lists, where being instantly legible beats being ours.
//
// TERRACOTTA, NOT GREY (from her ChatGPT mock the same day). A grey mark reads
// as furniture; the accent makes the Log read as a set of choices rather than a
// settings screen. The colour prop still wins where a caller needs it to.

const GLYPH: Record<ActivityIconKind, keyof typeof MaterialCommunityIcons.glyphMap> = {
  walk: 'walk',
  run: 'run',
  yoga: 'meditation',
  // The slipper, at last.
  dance: 'shoe-ballet',
  strength: 'dumbbell',
  cycle: 'bike',
  swim: 'swim',
  climb: 'hiking',
  // A figure mid-split says flexibility where a mat or a bending spine did not.
  stretch: 'gymnastics',
  // Anything unrecognised: a movement, not a sport.
  movement: 'human-handsup',
};

export function ActivityIcon({
  kind,
  size = 20,
  color,
}: {
  kind: ActivityIconKind;
  size?: number;
  color?: string;
}) {
  const theme = useTheme();
  return <MaterialCommunityIcons name={GLYPH[kind]} size={size} color={color ?? theme.accent} />;
}
