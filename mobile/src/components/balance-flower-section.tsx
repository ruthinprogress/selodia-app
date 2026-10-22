import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { HealthFlower } from '@/components/health-flower';
import { SegmentedTabs } from '@/components/segmented-tabs';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useHealthFlower } from '@/hooks/use-health-flower';
import { useTheme } from '@/hooks/use-theme';
import { weekObservation } from '@/lib/health-flower';
import {
  DIMENSION_NOTES,
  EXPLAINER_INTRO,
  EXPLAINER_METHOD,
  EXPLAINER_TITLE,
  EXPLAINER_UNLOGGED,
  EXPLAINER_WEEK,
  EXPLAINER_WEEK_LINK,
  NOTE_ORDER,
} from '@/lib/flower-explainer';
import { canGoBack, canGoForward, flowerRange, type FlowerMode } from '@/lib/flower-range';
import { describeSession, placeUnreadSessions, placementSentence, type Unplaced } from '@/lib/place-unread-sessions';

// THE BALANCE FLOWER, ON THE ALMANAC (Ruth, 25 September 2026, item 8: "Remove
// the 'This week' heading and the balance flower chart from Today entirely.
// Today shows today only. Move the balance flower to Almanac > Insights as a
// 6-week rolling view").
//
// WHY THIS IS THE RIGHT HOME, and it is worth writing down because a morning
// went into keeping it on Today. The flower draws a PATTERN - which dimensions
// a body has been given, over time - and the Almanac is the tab for patterns:
// "Plans = the future = intentions ... Almanac = the past = observations."
// Today is a screen about today. The size fight that dominated this morning,
// the flower coming down from 200 to 158 to make room for a sentence, was the
// screen saying the section did not belong on it; I read it as a layout problem
// for several hours before she said so plainly.
//
// SIX WEEKS, NOT ONE, AND THE MATHS MOVED WITH IT. Coverage is a sum over a
// target, so six weeks of sessions against one week's target would fill every
// petal and the drawing would say nothing at all. The window scales the target
// too - see coverageFromRows.
//
// A SIX-WEEK FLOWER IS ALSO A KINDER ONE. A week is short enough that an
// ordinary busy week looks like a bare drawing; six weeks is long enough for a
// picture to be about somebody's life rather than about their last seven days.

// WEEK AND MONTH, EACH WITH A BACK AND A FORWARD (Ruth, 7 October 2026).
//
// Was a fixed six-week rolling view. Her revision, after I said a free custom
// range was the one genuinely new piece of work: "just do Week and Month ranges,
// each one has a back and forward button... the daily use flower is more
// bounded." The report builder keeps the custom range, where a date picker
// already exists.
//
// SIX WEEKS WAS CHOSEN FOR A REASON AND THE REASON SURVIVES. A week is short
// enough that an ordinary busy week looks like a bare drawing. That is now
// something she can see rather than something the app decided for her: the week
// view will look sparse on a quiet week, and the month view beside it will not.

/** The two windows, in the pill's own shape. */
const FLOWER_WINDOWS = [
  { id: 'days7', label: '7 days' },
  { id: 'days30', label: '30 days' },
] as const;

export function BalanceFlowerSection({
  mode,
  back,
  onMode,
  onBack,
}: {
  mode: FlowerMode;
  back: number;
  onMode: (m: FlowerMode) => void;
  onBack: (b: number) => void;
}) {
  const theme = useTheme();
  // Rebuilt only when the choice changes, because the hook keys its read on the
  // two timestamps and a fresh Date every render would re-query forever.
  const range = useMemo(() => flowerRange(mode, back), [mode, back]);
  const { coverage, loading, unclassifiedCount, reload } = useHealthFlower(range);
  // The tap that resolves an unplaced session, and what came of it. Null
  // until she asks, so the line stays one quiet sentence until it is useful.
  const [placing, setPlacing] = useState(false);
  const [placement, setPlacement] = useState<string | null>(null);
  // THE ONES NOTHING COULD PLACE, which are the only ones she can help with.
  const [stuck, setStuck] = useState<Unplaced[]>([]);
  const [describing, setDescribing] = useState<Record<string, string>>({});
  const note = coverage ? weekObservation(coverage, range.label) : null;
  // SHUT BY DEFAULT, and not remembered. The log layout store exists for folds
  // somebody arranges; this one is read once or twice ever and then not again,
  // so persisting it would be machinery for a preference nobody holds.
  const [explaining, setExplaining] = useState(false);

  const pick = (next: FlowerMode) => {
    onMode(next);
    // BACK TO NOW ON A SWITCH. Three weeks back and then tapping Month would
    // otherwise land on three months back, which is not what the tap asked for.
    onBack(0);
  };

  // NO HEADING OF ITS OWN. It had one, and the fold it now sits inside has one
  // too, so the screen read "Balance" twice in a row (Ruth's screenshot,
  // 7 October). The section that contains a thing names it.
  return (
    <View style={styles.wrap}>

      {/* A PILL, NOT TWO WORDS IN A ROW (Ruth, 21 October 2026): "pill in
          artwork to decide 7 day and 30 days is nice, let's do it."

          THE SAME CONTROL THE REST OF THE APP USES, rather than a second one
          drawn here. SegmentedTabs is the pill on Plans and on the Log, and it
          carries five rounds of clipping history and the fix that finally held
          - a label that fills its tab instead of being sized by its own
          measurement. A hand-rolled pill here would start that story again.

          NARROW AND CENTRED, because two short words should not span the page
          the way four tab names do. */}
      <View style={styles.modesWrap}>
        <SegmentedTabs
          items={FLOWER_WINDOWS}
          value={mode}
          onChange={(m) => pick(m as FlowerMode)}
        />
      </View>

      {/* THE WINDOW NAMES ITSELF BETWEEN ITS OWN ARROWS. Without the label a
          person paging back has no way to know where they are, and the drawing
          looks like it is changing for no reason. */}
      <View style={styles.pager}>
        <Pressable
          onPress={() => onBack(back + 1)}
          disabled={!canGoBack(back)}
          accessibilityRole="button"
          accessibilityLabel={
            mode === 'days7' ? 'The seven days before that' : 'The thirty days before that'
          }
          hitSlop={Spacing.two}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Ionicons
            name="chevron-back"
            size={18}
            color={canGoBack(back) ? theme.accentDeep : theme.backgroundSelected}
          />
        </Pressable>

        <ThemedText type="small" themeColor="textSecondary" style={styles.rangeLabel}>
          {range.label}
        </ThemedText>

        <Pressable
          onPress={() => onBack(Math.max(0, back - 1))}
          disabled={!canGoForward(back)}
          accessibilityRole="button"
          accessibilityLabel={
            mode === 'days7' ? 'The seven days after that' : 'The thirty days after that'
          }
          hitSlop={Spacing.two}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Ionicons
            name="chevron-forward"
            size={18}
            color={canGoForward(back) ? theme.accentDeep : theme.backgroundSelected}
          />
        </Pressable>
      </View>

      {/* Nothing until the read returns. An unloaded window and an empty one
          are different things, and six absent petals popping into shape is the
          second telling a lie about the first. */}
      <View style={styles.flower}>
        {coverage ? (
          <HealthFlower
            coverage={coverage}
            size={SIZE}
            // Typed-routes form: the pathname is the file, the segment is a
            // param. Building the string by hand would not typecheck.
            onSelectDimension={(d) =>
              router.push({ pathname: '/now/[dimension]', params: { dimension: d } })
            }
          />
        ) : null}
      </View>

      {/* It names what led and stops - see weekObservation for why there is no
          second sentence recommending anything. */}
      {note ? (
        <ThemedText type="small" themeColor="textSecondary">
          {note}
        </ThemedText>
      ) : !loading && coverage ? (
        /* A WINDOW WITH NOTHING IN IT SAYS SO. She can page back twelve of
           these, and most of them will be before she had the app. Silence here
           would read as the drawing being broken. */
        <ThemedText type="small" themeColor="textSecondary">
          Nothing logged in {range.label}.
        </ThemedText>
      ) : null}

      {/* A SESSION THE DRAWING COULD NOT PLACE IS SAID OUT LOUD (21 October
          2026). The hook has counted these since the window went rolling and
          nothing ever showed the number.

          THIS IS THE SAME HONESTY THE WEEK'S FLOWER ALREADY HAS, where an
          activity the weighting table does not hold is named rather than
          quietly dropped. Here it could not be named - there may be several,
          and this is a drawing rather than a list - so it is counted.

          WHY IT MATTERS MORE THAN IT LOOKS. Until this morning a third of
          Ruth's logged sessions carried no classification at all, and a petal
          reading low was indistinguishable from a petal reading low BECAUSE
          the app could not read what she had done. A number here is the
          difference between "you did less" and "I could not see some of it",
          and only one of those is a statement about her. */}
      {!loading && unclassifiedCount > 0 ? (
        /* AND SOMETHING TO DO ABOUT IT (Ruth, 21 October 2026, on a screenshot
           of the line with nothing to tap): "It needs a link for user to
           resolve this. Its not clear."

           The sentence alone left her knowing the drawing was under-reporting
           and holding no way to stop it, which is worse than not knowing. One
           tap runs the same classifier a chat turn would have run - see
           api/place-activity for why these rows were ever left behind.

           THE WHOLE LINE IS THE TARGET, not a word inside it. The thing she
           wants to act on is the sentence she just read. */
        <Pressable
          onPress={async () => {
            if (placing) return;
            setPlacing(true);
            setPlacement(null);
            const outcome = await placeUnreadSessions(range);
            setPlacement(placementSentence(outcome));
            setStuck(outcome.ok ? outcome.unplaced : []);
            setPlacing(false);
            // The drawing re-reads itself, so a petal that just gained a
            // session grows while she is looking at it.
            if (outcome.ok && outcome.placed.length > 0) reload();
          }}
          accessibilityRole="button"
          accessibilityLabel={
            unclassifiedCount === 1
              ? 'One session is not counted yet. Place it on the six.'
              : `${unclassifiedCount} sessions are not counted yet. Place them on the six.`
          }
          accessibilityHint="Works out which of the six they fed"
          accessibilityState={{ busy: placing }}
          hitSlop={Spacing.two}
          style={({ pressed }) => [styles.unplaced, pressed && styles.pressed]}
        >
          <ThemedText type="detail" themeColor="textSecondary">
            {unclassifiedCount === 1
              ? '1 session is not counted here yet, because it could not be placed on these six.'
              : `${unclassifiedCount} sessions are not counted here yet, because they could not be placed on these six.`}
          </ThemedText>
          {/* THE WORDS THAT SAY IT IS A THING YOU CAN PRESS. A sentence in the
              same grey as every other note reads as a notice; this is the half
              that makes it an offer. */}
          <ThemedText type="detail" themeColor="link">
            {placing ? 'Working it out…' : 'Count them'}
          </ThemedText>
        </Pressable>
      ) : null}

      {/* WHAT CAME OF IT, including the ones it still could not place. A silent
          success would leave her to work out whether anything happened by
          watching the petals. */}
      {placement ? (
        <ThemedText type="detail" themeColor="textSecondary">
          {placement}
        </ThemedText>
      ) : null}

      {/* AND THE ONES NOTHING CAN PLACE GET THE QUESTION SHE EXPECTED.
          Ruth, 22 October 2026: "I thought the reason we put that there was
          because it needed more info to make sense to the algorithm of the
          flower. What did it do? That was a bit odd and pointless."

          She was right. Everything the classifier can do alone now happens when
          the row is written. What reaches here is a name with nothing in it -
          "gym session" describes a building - and the only thing that can place
          it is her saying what she did there. */}
      {stuck.map((u) => (
        <View key={u.id} style={styles.describe}>
          <ThemedText type="detail" themeColor="textSecondary">
            What did your {u.activityType} involve?
          </ThemedText>
          <TextInput
            value={describing[u.id] ?? ''}
            onChangeText={(t) => setDescribing((d) => ({ ...d, [u.id]: t }))}
            placeholder="squats, bench press, rows"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]}
            accessibilityLabel={`What your ${u.activityType} involved`}
            returnKeyType="done"
            onSubmitEditing={async () => {
              const said = (describing[u.id] ?? '').trim();
              if (!said || placing) return;
              setPlacing(true);
              const outcome = await describeSession(u.id, said);
              setPlacement(placementSentence(outcome));
              // Gone from the list only when it actually landed; a description
              // that still could not be placed leaves the question up.
              if (outcome.ok && outcome.placed.length > 0) {
                setStuck((rest) => rest.filter((x) => x.id !== u.id));
                reload();
              }
              setPlacing(false);
            }}
          />
        </View>
      ))}

      {/* WHAT THIS SHOWS (Ruth, 20 October 2026): "an explanation of why it is
          those categories and how it's calculated might be useful in a
          collapsible below it."

          SHUT BY DEFAULT and quiet, because the drawing is the point and this
          is for the once or twice somebody wonders. Its content is in
          lib/flower-explainer.ts, tied to the spec by a check - an explainer is
          the longest label in the app and the likeliest to quietly stop being
          true. */}
      <Pressable
        onPress={() => setExplaining((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: explaining }}
        accessibilityLabel={EXPLAINER_TITLE}
        accessibilityHint={explaining ? 'Folds this away' : 'Explains the six and how they fill'}
        hitSlop={Spacing.two}
        style={({ pressed }) => [styles.explainBar, pressed && styles.pressed]}
      >
        <Ionicons
          name={explaining ? 'chevron-down' : 'chevron-forward'}
          size={14}
          color={theme.textSecondary}
        />
        <ThemedText type="small" themeColor="textSecondary">
          {EXPLAINER_TITLE}
        </ThemedText>
      </Pressable>

      {explaining ? (
        <View style={styles.explainer}>
          <ThemedText type="small">{EXPLAINER_INTRO}</ThemedText>

          {NOTE_ORDER.map((d) => (
            <View key={d} style={styles.note}>
              <ThemedText type="smallBold">{DIMENSION_NOTES[d].title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {DIMENSION_NOTES[d].plain}
              </ThemedText>
            </View>
          ))}

          <ThemedText type="small" themeColor="textSecondary">
            {EXPLAINER_METHOD}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {EXPLAINER_UNLOGGED}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {EXPLAINER_WEEK}
          </ThemedText>

          {/* A LIVE LINK, NOT A MENTION (Ruth: the mention of the Week planner
              "needs a live link to it, so they're not left to fend for
              themselves"). Plans opens on the Week segment already - "WEEK
              FIRST ON ARRIVAL" - so this lands where the sentence above says
              it will, rather than on a tab she then has to read. */}
          <Pressable
            onPress={() => router.push('/(tabs)/plans')}
            accessibilityRole="button"
            accessibilityLabel={EXPLAINER_WEEK_LINK}
            accessibilityHint="Opens your Week, where a regular activity can be added"
            hitSlop={Spacing.two}
            style={({ pressed }) => [styles.weekLink, pressed && styles.pressed]}
          >
            <ThemedText type="small" themeColor="accentDeep">
              {EXPLAINER_WEEK_LINK}
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

// Bigger than it ever was on Today, which was the other half of the problem:
// there it was competing with a day's figures for a screen that does not
// scroll, and it lost twice in one morning. Here it has the room the approved
// drawing was designed at.
const SIZE = 220;

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  // The quietest control on the section, and still a full-height target.
  explainBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
    marginTop: Spacing.two,
  },
  unplaced: { gap: 2, minHeight: 44, justifyContent: 'center' },
  describe: { gap: Spacing.two, marginTop: Spacing.two },
  input: { borderWidth: 1, borderRadius: Spacing.three, paddingHorizontal: Spacing.three, minHeight: 44 },
  explainer: { gap: Spacing.three },
  note: { gap: 2 },
  weekLink: { minHeight: 44, justifyContent: 'center' },
  // Week and Month sit together as a pair of words rather than a control: the
  // tab's own switch is the only segmented thing on this screen and a second
  // one would read as a second level of navigation.
  // The pill is narrower than the page and centred. SegmentedTabs fills
  // whatever it is given, so the width is set here rather than inside it.
  modesWrap: { alignSelf: 'center', width: 220 },
  // The arrows hug the label rather than the screen edges, so the three read as
  // one object: back, where you are, forward.
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  rangeLabel: { minWidth: 120, textAlign: 'center' },
  pressed: { opacity: 0.6 },
  flower: {
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.two,
  },
});
