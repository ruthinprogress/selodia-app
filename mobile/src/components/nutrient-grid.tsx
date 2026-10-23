import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { NutrientIcon } from '@/components/nutrient-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { MACROS, macroAmount, macroFigure, type MacroKey } from '@/lib/tracked-macros';
import {
  referenceFor,
  standingFor,
  STANDING_COLOUR,
  STANDING_LABEL,
  type Reference,
  type Standing,
} from '@/lib/nutrient-standing';
import type { NutrientProfile } from '@/lib/nutrient-profile';

// WHERE THE DAY STANDS, AT A GLANCE (Ruth, 23 October 2026).
//
//   "I can't tell that from a glance and that's actually not very good body
//    litaracy training... I actually don't think it's a nice to have - it's the
//    missing piece that was making it feel pointless and a chore."
//
// The food log already held every figure. What it could not do was say whether
// any of them was all right, so reading it was data entry with no answer at the
// end - and she is describing precisely why people stop logging.
//
// THREE OF THE FOUR QUESTIONS, ON THE TILE. The spec's rule is that every
// metric answers Status, Meaning, Evidence and Action. A tile this size carries
// three of them honestly:
//
//   STATUS    the bar's colour, and the word beneath it in plain English
//   EVIDENCE  the figure, and what it is being measured against
//   MEANING   one tap away - the whole tile opens "What these mean", which is
//             an existing screen with a paragraph per nutrient
//
// ACTION IS NOT HERE YET, and a half-built Action is worse than none: the form
// it has to take is arithmetic ("a handful of berries carries about 2 g of
// fibre"), never an instruction, and inventing those per nutrient in a tile
// this size is how "Try adding chia seeds" gets shipped.
//
// THE REFERENCE IS ON EVERY TILE, never implied. "In range" with nothing beside
// it is a verdict with no basis, and somebody is entitled to disagree with the
// figure rather than with themselves. So each tile says the number and whose it
// is - and says GUIDELINE for a published one and TARGET only for the two she
// set herself, because the alternative is quietly assigning her a goal she
// never agreed to. See nutrient-standing.ts.
//
// A NUTRIENT WITH NOTHING TO COMPARE AGAINST IS DRAWN GREY AND SAYS SO.
// Carbohydrate has no published daily gram figure and total sugar cannot be
// measured against a free-sugar limit. Those two tiles carry the figure and no
// colour, which is the design refusing to make something up rather than a gap
// in it.

/** A tile's worth: everything resolved, so the render has no arithmetic in it. */
type Tile = {
  key: MacroKey;
  label: string;
  figure: string;
  reference: Reference | null;
  standing: Standing | null;
};

function tilesFor(
  values: Record<string, unknown>,
  tracked: MacroKey[],
  profile: NutrientProfile
): Tile[] {
  const tiles: Tile[] = [];
  for (const spec of MACROS) {
    if (!tracked.includes(spec.key)) continue;
    const figure = macroFigure(spec.key, values);
    // NOTHING WORKED OUT, NOTHING SHOWN. A zero would assert the food contained
    // none of it, which is a different claim and usually the wrong one.
    if (figure == null) continue;
    const reference = referenceFor(spec.key, profile);
    tiles.push({
      key: spec.key,
      label: spec.short,
      figure,
      reference,
      standing: standingFor(macroAmount(spec.key, values), reference),
    });
  }
  return tiles;
}

/**
 * Would the grid draw anything?
 *
 * A CALLER CANNOT ASK A COMPONENT WHETHER IT RENDERED NULL. The first version
 * of the food log wrote `<NutrientGrid … /> ?? <ThemedText …>`, which looks
 * like a fallback and is dead code: a JSX element is an object, so it is never
 * null and the right-hand side can never run. A day with no figures would have
 * shown an empty space where its totals used to be.
 *
 * It takes no profile because a tile appears whenever there is a FIGURE. Having
 * nothing to compare it against makes the tile grey, not absent.
 */
export function hasNutrientTiles(values: Record<string, unknown>, tracked: MacroKey[]): boolean {
  return tilesFor(values, tracked, { ageYears: null, targetKcal: null, proteinLow: null, proteinHigh: null }).length > 0;
}

/** "of 30 g a day · NHS guideline", or null where there is nothing to say. */
function basisOf(reference: Reference | null): string | null {
  if (!reference) return null;
  const kind = reference.kind === 'target' ? 'target' : 'guideline';
  return `${reference.stated} · ${reference.source} ${kind}`;
}

export function NutrientGrid({
  values,
  tracked,
  profile,
  title,
}: {
  /** The totals being judged, keyed by column - a day's or a week's average. */
  values: Record<string, unknown>;
  tracked: MacroKey[];
  profile: NutrientProfile;
  /** What these figures are, in her words: "Today", "Daily average". */
  title?: string;
}) {
  const tiles = tilesFor(values, tracked, profile);
  if (tiles.length === 0) return null;

  // ONLY THE STATES ACTUALLY ON SCREEN. A legend listing four colours when two
  // are drawn is a legend about the design rather than about the day, and it
  // teaches the reader to stop looking at it.
  const shown: Standing[] = (['in-range', 'a-little-low', 'lower', 'higher'] as Standing[]).filter(
    (s) => tiles.some((t) => t.standing === s)
  );

  return (
    <View style={styles.wrap}>
      {title ? <ThemedText type="smallBold">{title}</ThemedText> : null}

      <View style={styles.grid}>
        {tiles.map((tile) => (
          <Pressable
            key={tile.key}
            onPress={() => router.push('/log/nutrients')}
            accessibilityRole="button"
            // THE WHOLE STATE, SPOKEN. A screen reader gets the word and the
            // basis, because the bar carries no text and the colour carries
            // nothing at all to somebody listening.
            accessibilityLabel={
              `${tile.label}, ${tile.figure}`
              + (tile.standing ? `, ${STANDING_LABEL[tile.standing].toLowerCase()}` : '')
              + (basisOf(tile.reference) ? `, ${basisOf(tile.reference)}` : '')
              + '. What this means'
            }
            style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
          >
            <ThemedView type="backgroundElement" style={styles.tile}>
              {/* THE BAR, AND WHY IT IS A BAR. A tile filled with the standing
                  colour cannot carry legible text on it - measured, charcoal on
                  the four runs 3.25 to 3.27 against a 4.5 floor - and ten
                  saturated tiles is the "overbearing" she has already named
                  once on this screen. A bar is the colour at full strength
                  against a ground that keeps the words readable. */}
              <View style={[styles.bar, { backgroundColor: tile.standing ? STANDING_COLOUR[tile.standing] : 'transparent' }]} />

              {/* THE ICON TAKES THE STANDING COLOUR, NOT CHARCOAL (Ruth,
                  23 October 2026: "I rejected a charcoal text for the icon").
                  A charcoal mark is the same grey on every tile, so the icon
                  column reads as decoration and the only thing carrying the
                  state is a four-pixel bar. Coloured, the mark and the bar say
                  one thing twice, which is what makes a glance work.

                  GREY IS RESERVED, and it is reserved for the one case it
                  means something: carbohydrate and total sugar have nothing
                  honest to compare against, so those two marks stay secondary
                  and the tile says "No guideline" underneath. Grey here is the
                  absence of a state, never the default. */}
              <View style={styles.head}>
                <NutrientIcon
                  macroKey={tile.key}
                  size={16}
                  color={tile.standing ? STANDING_COLOUR[tile.standing] : undefined}
                />
                <ThemedText type="detail" themeColor="textSecondary" style={styles.label}>
                  {tile.label}
                </ThemedText>
              </View>

              <ThemedText type="small" style={styles.figure}>
                {tile.figure}
              </ThemedText>

              {/* THE WORD, ALWAYS BESIDE THE COLOUR. Never the colour alone -
                  see nutrient-standing.ts. Where there is no standing it says
                  so plainly rather than leaving a space somebody reads as a
                  figure that failed to load. */}
              <ThemedText type="detail" themeColor={tile.standing ? 'text' : 'textSecondary'}>
                {tile.standing ? STANDING_LABEL[tile.standing] : 'No guideline'}
              </ThemedText>

              <ThemedText type="detail" themeColor="textSecondary" style={styles.basis}>
                {basisOf(tile.reference) ?? 'Nothing published to compare this to'}
              </ThemedText>
            </ThemedView>
          </Pressable>
        ))}
      </View>

      {shown.length > 0 ? (
        <View style={styles.legend}>
          {shown.map((s) => (
            <View key={s} style={styles.key}>
              <View style={[styles.swatch, { backgroundColor: STANDING_COLOUR[s] }]} />
              <ThemedText type="detail" themeColor="textSecondary">
                {STANDING_LABEL[s]}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Two to a row. Each tile carries four lines, and three across clips them. */
const PER_ROW = 2;

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  // BASIS, NOT WIDTH. Two cells at a flat 50% plus the row's gap overflow the
  // row and wrap one tile onto a line of its own, every other line. A basis
  // just under half with room to grow lets the gap come out of the tiles.
  cell: { flexBasis: `${100 / PER_ROW - 2}%`, flexGrow: 1 },
  tile: {
    borderRadius: CardRadius,
    // Clear of the bar, which is drawn over the top four pixels.
    paddingTop: Spacing.two + 4,
    paddingBottom: Spacing.two,
    paddingHorizontal: Spacing.two,
    gap: 2,
    overflow: 'hidden',
  },
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  label: { flex: 1 },
  // Sized against the log rows beneath it, which are `small` at 14 - one step
  // above the thing it summarises and no further. Her rule, from the week card.
  figure: { fontSize: 16, lineHeight: 20 },
  basis: { lineHeight: 14 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.three, rowGap: Spacing.one },
  key: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  swatch: { width: 12, height: 4, borderRadius: 2 },
  pressed: { opacity: 0.6 },
});
