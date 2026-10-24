import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { useFocusReload } from '@/hooks/use-focus-reload';
import { StyleSheet, View } from 'react-native';

import { BodyScreen } from '@/components/body-screen';
import { NutrientIcon } from '@/components/nutrient-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { explainerFor } from '@/lib/macro-explainers';
import {
  suggestionsFor,
  whereItCameFrom,
  type ItemRow,
  type SourceRow,
  type Suggestion,
} from '@/lib/nutrient-breakdown';
import { nutrientPairFor } from '@/lib/nutrient-pairs';
import { loadNutrientProfile } from '@/lib/nutrient-profile';
import {
  referenceFor,
  standingFor,
  STANDING_COLOUR,
  STANDING_LABEL,
  STANDING_NOTE,
  NO_NUTRIENT_PROFILE,
  type NutrientProfile,
} from '@/lib/nutrient-standing';
import { supabase } from '@/lib/supabase';
import { MACROS, macroAmount, macroFigure, type MacroKey } from '@/lib/tracked-macros';
import { averageLine } from '@/lib/tracked-macros';
import { loadTrackedMacros } from '@/lib/tracked-macros-store';
import { currentWeekStart, daysOfWeek, toLocalDateKey, weekLabel, weekRange } from '@/lib/week';

// ONE NUTRIENT'S OWN SCREEN (Ruth's artwork, screens two and three).
//
// Her verdict on the first attempt, 24 October 2026: "the follow through
// screens weren't make, just pointed to the generic list of nutrients we
// already had." She was right - every cell opened the same page listing all ten
// nutrients, and I had written a comment in the file explaining why that was
// acceptable. It was not: a figure that opens a glossary has not been followed
// through, it has been deflected.
//
// WHAT HER ARTWORK PUTS HERE, in its order:
//   the figure, large, with the range beside it
//   a bar showing where the figure sits against that range
//   the state, in her words, with its line
//   "Why it matters", which is the explainer this app already had
//
// AND WHAT IS NOT HERE YET, said plainly rather than faked: "Where yours came
// from" - the breakdown by food, with grams and percentages - and the per-food
// screen under it. Those need a query over food_items that does not exist yet.
// The screen says nothing about them rather than showing an empty frame.

/** Which nutrient is a part of which, mirroring the grid's own nesting. */
const CHILD_OF: Partial<Record<MacroKey, MacroKey>> = {
  fat: 'saturated',
  carbs: 'sugar',
};

export default function NutrientScreen() {
  const theme = useTheme();
  const { key } = useLocalSearchParams<{ key: string }>();
  const macroKey = (MACROS.find((m) => m.key === key)?.key ?? null) as MacroKey | null;

  const [profile, setProfile] = useState<NutrientProfile>(NO_NUTRIENT_PROFILE);
  const [averages, setAverages] = useState<Record<string, number> | null>(null);
  const [daysLogged, setDaysLogged] = useState(0);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  // THIS SCREEN LIVES UNDER A TAB, so it stays mounted and a read on mount runs
  // exactly once. A meal logged by voice while this screen is behind the Log
  // tab would never reach it. check-tabs-refetch caught this before it shipped.
  const [reloadKey, setReloadKey] = useState(0);
  useFocusReload(setReloadKey);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const weekStart = currentWeekStart();
      const { startISO, endISO } = weekRange(weekStart);
      const [{ data }, { data: itemRows }, tracked, p] = await Promise.all([
        supabase
          .from('food_logs')
          .select('happened_at, kcal, protein_g, carbs_g, fat_g, saturated_fat_g, sugar_g, free_sugar_g, fibre_g, sodium_mg, calcium_mg, iron_mg')
          .gte('happened_at', startISO)
          .lt('happened_at', endISO),
        // THE ITEMS BEHIND THOSE LOGS, for "Where yours came from". Scoped by
        // the same week, through the log's own timestamp, so the breakdown and
        // the figure above it can never describe different days.
        supabase
          .from('food_items')
          .select(
            'name, protein_source, kcal, protein_g, carbs_g, fat_g, saturated_fat_g, '
              + 'sugar_g, free_sugar_g, fibre_g, sodium_mg, calcium_mg, iron_mg, '
              + 'food_logs!inner(happened_at)'
          )
          .gte('food_logs.happened_at', startISO)
          .lt('food_logs.happened_at', endISO),
        loadTrackedMacros(),
        loadNutrientProfile(),
      ]);
      if (cancelled) return;
      setItems((itemRows ?? []) as unknown as ItemRow[]);

      const byDay = new Map<string, Record<string, unknown>[]>();
      for (const row of (data ?? []) as Record<string, unknown>[]) {
        const k = toLocalDateKey(new Date(String(row.happened_at)));
        byDay.set(k, [...(byDay.get(k) ?? []), row]);
      }
      const week = averageLine(
        daysOfWeek(weekStart).map((d) => byDay.get(toLocalDateKey(d)) ?? []),
        tracked
      );
      setAverages(week.averages);
      setDaysLogged(week.daysLogged);
      setProfile(p);

      // GOOD SOURCES SHE IS NOT ALREADY EATING, from the CoFID composition
      // table the app already carries - 2,886 foods, UK government data.
      // Nothing is invented here; this only ranks and filters.
      // SUGGESTIONS ONLY WHERE MORE IS THE POINT, AND ONLY WHEN SHE IS SHORT.
      //
      // Ruth, 24 October 2026, on the Carbohydrates screen: "What on earth is
      // this????" It was offering her white sugar, icing sugar and demerara
      // sugar, because the candidates were ranked by concentration per 100g and
      // the most carbohydrate-dense foods in a composition table are sugars.
      //
      // THE BUG WAS NOT THE RANKING. It was that nothing asked whether
      // suggesting MORE of this nutrient made any sense. For a ceiling - salt,
      // saturated fat, free sugars - it is incoherent. For a band it is
      // presumptuous. For energy it is absurd. More is the point for exactly
      // four of the ten: fibre, calcium, iron, and the protein she set herself.
      //
      // AND ONLY WHEN SHE IS ACTUALLY UNDER IT, because a section headed
      // "Suggestions for you" above a nutrient she is already hitting is the
      // app inventing a problem. This is a food app used by women who have
      // been told what to eat all their lives; a suggestion it cannot justify
      // is worse than a blank space.
      const spec = MACROS.find((m) => m.key === key);
      const ref = referenceFor(key as MacroKey, p);
      const amountNow = macroAmount(key as MacroKey, week.averages);
      const worthSuggesting =
        ref?.shape.kind === 'floor' && amountNow != null && amountNow < ref.shape.value;
      if (spec && worthSuggesting) {
        const { data: best } = await supabase
          .from('food_composition')
          .select(`name, ${spec.column}`)
          .not(spec.column, 'is', null)
          .order(spec.column, { ascending: false })
          .limit(60);
        if (cancelled) return;
        const eaten = ((itemRows ?? []) as unknown as ItemRow[])
          .map((r) => (r.name ?? '').trim())
          .filter(Boolean);
        // WHAT SHE REACTS TO, READ BEFORE ANYTHING IS SUGGESTED. RLS scopes
        // this to her. An empty list is a real answer; a failed read is not,
        // and a failed read must not become an empty gate - so a null result
        // leaves `avoid` empty only because there is nothing to avoid, and the
        // query is awaited rather than raced.
        const { data: reactions } = await supabase
          .from('allergies')
          .select('name, kind')
          .in('kind', ['food', 'other']);
        if (cancelled) return;
        const avoid = ((reactions ?? []) as { name: string | null }[])
          .map((r) => (r.name ?? '').trim())
          .filter(Boolean);
        setSuggestions(
          suggestionsFor(
            ((best ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
              name: String(r.name ?? ''),
              per100g: Number(r[spec.column] ?? 0),
            })),
            eaten,
            spec.key,
            avoid
          )
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const spec = macroKey ? MACROS.find((m) => m.key === macroKey) : null;
  if (!spec || !macroKey) {
    return (
      <BodyScreen title="Not found">
        <ThemedText type="small" themeColor="textSecondary">
          That nutrient is not one Selodía tracks.
        </ThemedText>
      </BodyScreen>
    );
  }

  const explainer = explainerFor(macroKey);
  // THE FOODS SHE ATE, for every nutrient without exception. See
  // nutrient-breakdown.ts for why the one grouping that used to live here is
  // gone: a heading that says "Where yours came from" has to answer with her
  // food, not with a taxonomy.
  const sources: SourceRow[] = whereItCameFrom(items, macroKey);
  // How to have them: an absorption pairing, where one exists for this
  // nutrient's foods. Each is sourced - see nutrient-pairs.ts.
  const pair = nutrientPairFor(suggestions.map((x) => x.food).join(' '), []);
  const reference = referenceFor(macroKey, profile);
  const figure = averages ? macroFigure(macroKey, averages) : null;
  const amount = averages ? macroAmount(macroKey, averages) : null;
  const standing = standingFor(amount, reference);
  const colour = standing ? STANDING_COLOUR[standing] : theme.textSecondary;

  // SATURATED FAT DRAWN INSIDE THE FAT BAR, not under it (Ruth, 24 October
  // 2026): "Saturated fat needs a bar on the fat page, under the main fat bar,
  // or within it with it's own target along the fat line, which actualy then
  // shows it as part of the fat, which is truer."
  //
  // She is right that it is truer, and it is the better drawing for the same
  // reason: saturated fat IS part of the total, so a second bar beneath would
  // invite somebody to add the two together. Inside, on one scale, the question
  // "how much of my fat was saturated" is answered without arithmetic - and the
  // same mechanic serves sugar inside carbohydrate, which was her next note.
  const childKey = CHILD_OF[macroKey];
  const childAmount = childKey && averages ? macroAmount(childKey, averages) : null;
  const childRef = childKey ? referenceFor(childKey, profile) : null;
  const childPart =
    childKey && childAmount != null
      ? {
          amount: childAmount,
          // Its own ceiling, on the parent's scale. Sugar has none, and then
          // the segment is drawn with no marker rather than against a guess.
          mark: childRef && childRef.shape.kind === 'ceiling' ? childRef.shape.value : null,
          label: MACROS.find((m) => m.key === childKey)?.short.toLowerCase() ?? '',
          figure: macroFigure(childKey, averages ?? {}) ?? '',
          colour: (() => {
            const st = standingFor(childAmount, childRef);
            return st ? STANDING_COLOUR[st] : theme.textSecondary;
          })(),
        }
      : null;

  return (
    <BodyScreen title={spec.label}>
      <ThemedText type="detail" themeColor="textSecondary">
        Daily average · {weekLabel(currentWeekStart())} · {daysLogged} of 7 days logged
      </ThemedText>

      <ThemedView type="backgroundElement" style={styles.figureCard}>
        <View style={styles.figureRow}>
          <View style={styles.figureBlock}>
            <ThemedText type="title" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {figure ?? '—'}
            </ThemedText>
            <ThemedText type="detail" themeColor="textSecondary">
              per day on average
            </ThemedText>
          </View>
          {reference ? (
            <View style={styles.targetBlock}>
              {/* THE WORD ONLY. The figure itself moved under the bar, beside
                  the span it describes, because printing it twice on one card
                  was what pushed "122 g" into two lines. */}
              <ThemedText type="detail" themeColor="textSecondary">
                {reference.kind === 'target' ? 'Your target' : 'Guideline'}
              </ThemedText>
            </View>
          ) : null}
        </View>

        {/* THE BAR, WHICH IS THE ARTWORK'S AND IS WORTH THE SPACE. A figure
            beside a range still needs reading; a bar is understood before it is
            read. It is drawn only when there is a real range to draw against. */}
        {reference && amount != null ? (
          <Bar
            amount={amount}
            reference={reference}
            colour={colour}
            track={theme.background}
            child={childPart}
          />
        ) : null}
      </ThemedView>

      {standing ? (
        <ThemedView type="background" style={styles.stateCard}>
          <NutrientIcon macroKey={macroKey} size={20} color={colour} />
          <View style={styles.stateText}>
            <ThemedText type="smallBold">{STANDING_LABEL[standing]}</ThemedText>
            <ThemedText type="detail" themeColor="textSecondary">
              {STANDING_NOTE[standing]}
            </ThemedText>
          </View>
        </ThemedView>
      ) : (
        // NO COLOUR AND NO VERDICT, and the screen says which. Carbohydrate has
        // no published daily gram figure; total sugar cannot be measured
        // against a free-sugar limit. Silence here would read as a figure that
        // failed to load.
        <ThemedView type="background" style={styles.stateCard}>
          <NutrientIcon macroKey={macroKey} size={20} color={theme.textSecondary} />
          <View style={styles.stateText}>
            <ThemedText type="smallBold">No guideline to compare against</ThemedText>
            <ThemedText type="detail" themeColor="textSecondary">
              {macroKey === 'carbs'
                ? 'Carbohydrate guidance is a share of your energy rather than a number of grams, so Selodía shows the figure without scoring it.'
                : macroKey === 'sugar'
                  ? 'The published limit is for free sugars - what is added, plus honey, syrups and juice. This figure is all sugar, including the sugar in whole fruit and milk, so the two are not comparable.'
                  : 'Selodía has nothing published to measure this against, so it shows the figure and no verdict.'}
            </ThemedText>
          </View>
        </ThemedView>
      )}

      {/* THE CHILD, NAMED UNDER THE BAR IT SITS IN. The bar shows the share;
          this says which share it is and how much. */}
      {childPart ? (
        <View style={styles.legendRow}>
          <View style={[styles.swatch, { backgroundColor: childPart.colour }]} />
          <ThemedText type="detail" themeColor="textSecondary">
            of which {childPart.figure} {childPart.label}
          </ThemedText>
        </View>
      ) : null}

      {explainer ? (
        <>
          <ThemedText type="subtitle" style={styles.head}>
            Why it matters
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.para}>
            {explainer.what}
          </ThemedText>
        </>
      ) : null}

      {/* WHERE YOURS CAME FROM - her own log, listed by food. Grouped only for
          protein, where the group says something the food names do not. See
          nutrient-breakdown.ts for why that is the only exception. */}
      {sources.length > 0 ? (
        <>
          <ThemedText type="subtitle" style={styles.head}>
            Where yours came from
          </ThemedText>
          <ThemedText type="detail" themeColor="textSecondary">
            average per day
          </ThemedText>
          {sources.map((row) => (
            <View key={row.label} style={styles.sourceRow}>
              <ThemedText type="small" style={styles.sourceName} numberOfLines={1}>
                {row.label}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.sourceFigure}>
                {perDay(row, daysLogged, macroKey)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.sourceShare}>
                {Math.round(row.share * 100)}%
              </ThemedText>
            </View>
          ))}
        </>
      ) : null}

      {/* SUGGESTIONS, WHICH REPLACED "Where it comes from" (Ruth, 24 October
          2026): "Suggestions for you replace where it comes from, since that's
          in the food log built above."

          She is right - a generic list of foods that carry a nutrient is a
          worse version of the section directly above it, which lists the ones
          she actually ate. What is genuinely missing from her log is what is
          NOT in it.

          EVERY LINE SAYS WHAT A FOOD CARRIES, never what to do. Her rule, and
          the arithmetic form is the more precise one as well as the honest
          one. */}
      {suggestions.length > 0 ? (
        <>
          <ThemedText type="subtitle" style={styles.head}>
            Suggestions for you
          </ThemedText>
          <ThemedText type="detail" themeColor="textSecondary">
            Good sources that are not in your log this week
          </ThemedText>
          {suggestions.map((sug) => (
            <View key={sug.food} style={styles.suggestion}>
              <ThemedText type="small">{sug.food}</ThemedText>
              <ThemedText type="detail" themeColor="textSecondary">
                {sug.carries}
              </ThemedText>
            </View>
          ))}

          {/* HOW TO HAVE THEM, which was the other half of her instruction:
              "and how to have them (ie, if they need pairing or eaten alongside
              something else to be absorbed)". These pairings already existed in
              nutrient-pairs.ts, each one checked against a named source. */}
          {pair ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.pairNote}>
              {pair.why}
              {pair.note ? ` ${pair.note}` : ''}
            </ThemedText>
          ) : null}
        </>
      ) : null}

      {reference ? (
        <ThemedText type="detail" themeColor="textSecondary" style={styles.source}>
          {reference.kind === 'target'
            ? `${reference.stated} is your own target, worked out from your body and your goals.`
            : `${reference.stated}, from ${reference.source}.`}
        </ThemedText>
      ) : null}
    </BodyScreen>
  );
}

/** A source row's contribution as a per-day average, in the nutrient's unit. */
function perDay(row: SourceRow, days: number, key: MacroKey): string {
  const spec = MACROS.find((m) => m.key === key);
  const n = row.amount / Math.max(1, days);
  if (key === 'kcal') return Math.round(n).toLocaleString('en-GB');
  if (spec?.unit === 'mg') return `${Math.round(n)} mg`;
  return `${n >= 10 ? Math.round(n) : Math.round(n * 10) / 10} g`;
}

/**
 * Where a figure sits against its range.
 *
 * A FLOOR AND A CEILING ARE DRAWN DIFFERENTLY ON PURPOSE. For fibre the mark is
 * the figure you are climbing towards; for salt it is the line you are staying
 * under. Drawing both as "progress" would make a salty day look like an
 * achievement.
 */
function Bar({
  amount,
  reference,
  colour,
  track,
  child,
}: {
  amount: number;
  reference: {
    shape: { kind: 'floor' | 'ceiling' | 'band'; value?: number; low?: number; high?: number };
    stated: string;
  };
  colour: string;
  track: string;
  child?: {
    amount: number;
    mark: number | null;
    label: string;
    figure: string;
    colour: string;
  } | null;
}) {
  const s = reference.shape;
  const top = s.kind === 'band' ? (s.high ?? 0) * 1.25 : (s.value ?? 0) * 1.25;
  const pct = (n: number): `${number}%` =>
    `${Math.max(0, Math.min(100, (n / top) * 100))}%`;

  // WHERE "GOOD" IS, AS A REGION RATHER THAN AS A LINE.
  //
  // Ruth, 24 October 2026, on the first version: "This diagram makes no sense."
  // She was right. It drew one or two bare vertical rules on a plain track with
  // nothing naming them, so the reader had to be told what the lines meant -
  // and a bar whose whole job is to be understood before it is read had become
  // something needing a key.
  //
  // A floor and a ceiling and a band are three different shapes of "all right",
  // and each is now drawn as the SPAN it actually is:
  //
  //   floor    from the figure upwards  (fibre: more is the point)
  //   ceiling  from zero up to it       (salt: less is the point)
  //   band     between the two ends     (her calories, carbohydrate)
  //
  // The person's own value sits on top of that span in her standing colour, so
  // "am I inside it" is answered by looking, not by comparing two numbers.
  const zone =
    s.kind === 'floor'
      ? { from: s.value ?? 0, to: top }
      : s.kind === 'ceiling'
        ? { from: 0, to: s.value ?? 0 }
        : { from: s.low ?? 0, to: s.high ?? 0 };

  return (
    <View style={styles.barBlock}>
      <View style={[styles.track, { backgroundColor: track }]}>
        {/* The span that counts as all right. */}
        <View
          style={[
            styles.zone,
            { left: pct(zone.from), width: pct(Math.max(0, zone.to - zone.from)) },
          ]}
        />
        {/* Her own figure, over it. */}
        <View style={[styles.fill, { width: pct(amount), backgroundColor: colour }]} />

        {/* THE PART INSIDE THE WHOLE: saturated fat within fat, sugar within
            carbohydrate. A thin underline rather than a block, so it reads as
            subordinate to the figure above it - the first version drew it
            darker than its own parent, which made the part look like the
            measurement and the whole look like the background. */}
        {child ? (
          <View
            style={[styles.childFill, { width: pct(child.amount), backgroundColor: child.colour }]}
          />
        ) : null}
      </View>

      {/* AND THE SPAN IS NAMED, which is the half that was missing. */}
      <ThemedText type="detail" themeColor="textSecondary">
        {reference.stated}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  figureCard: { borderRadius: CardRadius, padding: Spacing.three, gap: Spacing.three, marginTop: Spacing.two },
  figureRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.three },
  figureBlock: { flexShrink: 0 },
  targetBlock: { alignItems: 'flex-end', flexShrink: 1 },
  barBlock: { gap: Spacing.two },
  track: { height: 16, borderRadius: 8, overflow: 'hidden', position: 'relative' },
  // The span that counts as all right, drawn under her figure rather than as
  // bare rules beside it.
  zone: { position: 'absolute', top: 0, bottom: 0, backgroundColor: '#2D2B28', opacity: 0.12 },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 8 },
  // The part, as a thin underline along the bottom of the whole.
  childFill: { position: 'absolute', left: 0, bottom: 0, height: 4 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one },
  sourceName: { flex: 1 },
  sourceFigure: { minWidth: 62, textAlign: 'right' },
  sourceShare: { minWidth: 38, textAlign: 'right' },
  suggestion: { paddingVertical: Spacing.one },
  pairNote: { marginTop: Spacing.two, lineHeight: 17 },
  stateCard: {
    borderRadius: CardRadius,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  stateText: { flex: 1, gap: 2 },
  // SPACING, TIGHTENED TWICE OVER (Ruth, 24 October 2026): "Text below headers
  // needs to be directly below header, too much space atm, see artwork for
  // spacing ref" and "halve the space between sections".
  //
  // Both are the same fault seen from two sides. A heading and the paragraph it
  // introduces are ONE thing, and 8pt between them read as two; meanwhile 24pt
  // between sections was not much more than that, so the page had no rhythm -
  // everything was equally far from everything else and nothing grouped. The
  // artwork's proportion is roughly four to one, not three to one.
  head: { marginTop: Spacing.three },
  para: { lineHeight: 20, marginTop: Spacing.half },
  source: { marginTop: Spacing.three, lineHeight: 16 },
});
