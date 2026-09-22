import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BodyScreen } from '@/components/body-screen';
import { ReorderableRows } from '@/components/reorderable-rows';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { arrange, layoutOf, loadLayout, saveLayout } from '@/lib/log-layout';

// THE LOG (2026-09-20), rebuilt from Ruth's navigation brief: "Some users don't
// want to chat every time they drink water or weigh themselves. This screen is
// for rapid logging."
//
// It was a switch across three things - food, activity, measurements - which
// made those three the whole idea of logging and left water, sleep and symptoms
// with no home but the conversation. Now it lists what can be recorded, and
// each row goes straight to the quickest way to record it.
//
// WHAT IS NOT ON THE LIST. Medication is in her mock-up and she took it out
// ("Leave out medication and mood. Add sleep."). Mood came back on 21 September
// by a different door - not as a mood diary, which is what she declined, but as
// three of the twelve symptom chips on the Cycle page, where low mood and
// irritability are cycle-linked observations rather than a daily rating. She
// was asked about the difference rather than left to discover it.
//
// Nothing else was invented to fill the space: a row that opened a screen with
// no table behind it would be the same broken promise as a switch that changes
// nothing.
//
// SYMPTOMS AND PHOTOS GO TO CHAT ON PURPOSE. A symptom is a sentence - where,
// when, how it feels - and a form would flatten it into fields; a photo needs
// the conversation to say what it is of. Both rows say where they are taking
// you rather than pretending to be a form.
//
// IT IS HERS TO ARRANGE (Ruth, 21 September 2026): "I don't think everyone will
// want to log everything, so can we make the cards on the logging page so they
// can be reorganised by holding down and just moving up or down?" - saved to
// her profile rather than the phone, and with hiding as well as sinking,
// because a row she never uses should be able to leave rather than queue.
//
// THE ORDER IS A PREFERENCE OVER THIS LIST, NOT A REPLACEMENT FOR IT. A row
// added after she arranged hers appears at the end rather than vanishing; a
// saved id this list no longer has is ignored rather than leaving a hole. See
// log-layout-rules.ts, where both of those are the whole point.

// THE ROWS WEAR THE LIBRARY'S MARKS NOW (21 September 2026), in terracotta
// rather than grey. Her mock put them in the accent and it is right: a grey
// mark reads as furniture, and this screen is a set of choices rather than a
// settings list. The objects are also truer - a bathroom scale and a tape
// measure rather than an outline of a person standing.
type Row = {
  id: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  detail: string;
  go: () => void;
};

const ROWS: Row[] = [
  {
    id: 'food',
    icon: 'silverware-fork-knife',
    label: 'Food and drink',
    detail: "Today's meals, and the week behind them",
    go: () => router.push('/log/entries?view=food'),
  },
  {
    id: 'water',
    icon: 'cup-water',
    // HYDRATION, NOT WATER (Ruth, 22 September 2026: "which is still called
    // water, hydration is better"). It stopped being only water the day a milky
    // tea started counting towards it, and the name was the last thing still
    // saying otherwise. The id stays `water` so nobody's saved arrangement of
    // this list breaks over a label.
    label: 'Hydration',
    detail: 'Add a drink, and the week behind it',
    go: () => router.push('/log/water-history'),
  },
  {
    id: 'sleep',
    icon: 'weather-night',
    label: 'Sleep',
    detail: 'How long, and how it felt',
    go: () => router.push('/log/sleep'),
  },
  // CYCLE ARRIVED ON THE LOG ON 21 SEPTEMBER, at her instruction: "I think we
  // need to add the cycle tracker to the Log page afterall. It needs to be
  // visually accessible to a user to build pattern understanding and so it
  // makes sense when the ai starts making observations there's something to
  // check against." Anyone it does not apply to can put it away, which is what
  // the arranging is for.
  // MOOD AND ENERGY CAME BACK ON 21 SEPTEMBER, at her own reversal and with her
  // own reason: "just voice logging meant that users had no idea what was
  // available ... catching things like low mood always 2 days after cocktails
  // eg, could genuinely be unknown to a user and needs something to check if Ai
  // says it." A card is how somebody discovers a thing exists; voice only works
  // for what you already know to ask for.
  {
    id: 'feeling',
    icon: 'weather-partly-cloudy',
    label: 'How you felt',
    detail: 'Mood and energy, in two taps',
    go: () => router.push('/log/feeling'),
  },
  {
    id: 'cycle',
    icon: 'flower-outline',
    label: 'Cycle',
    detail: 'Period, flow, symptoms and observations',
    go: () => router.push('/log/cycle'),
  },
  {
    id: 'body',
    icon: 'scale-bathroom',
    label: 'Body measurements',
    detail: 'Weight, body fat, muscle, and the rest',
    go: () => router.push('/log/entries?view=measurements'),
  },
  {
    id: 'activity',
    icon: 'run',
    label: 'Activity',
    detail: 'Sessions, classes, walks',
    go: () => router.push('/log/entries?view=activity'),
  },
  // THESE TWO OPEN CHAT, AND SAY SO, AND ARRIVE DOING SOMETHING (2026-09-20).
  // Ruth: "the logging going straight to chat for photo needs some kind of
  // recognition. It feels a bit like it's unintentional." So the symptom row
  // lands with the sentence already started in the box, and the photo row
  // lands with the camera-or-gallery choice already open. A row that changes
  // the screen and then looks like nothing happened is the fault.
  {
    id: 'symptom',
    icon: 'heart-pulse',
    label: 'A symptom',
    detail: "Describe something that's bothering you",
    go: () =>
      router.push({
        pathname: '/',
        params: { prefill: "I've noticed " },
      }),
  },
  {
    id: 'photo',
    icon: 'camera-outline',
    label: 'A photo',
    detail: 'A meal, nutrition label or scale reading',
    go: () => router.push({ pathname: '/', params: { add: '1' } }),
  },
];

export default function LogScreen() {
  const theme = useTheme();
  const [shown, setShown] = useState<Row[]>(ROWS);
  const [hidden, setHidden] = useState<Row[]>([]);
  const [editing, setEditing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const layout = await loadLayout('log_layout');
      if (cancelled) return;
      const arranged = arrange(ROWS, layout);
      setShown(arranged.shown);
      setHidden(arranged.hidden);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // SAVED WHEN IT CHANGES, NOT ON A DONE BUTTON. There is no moment where she
  // has finished arranging a list, and a Done she forgets to press is an
  // arrangement silently thrown away.
  const keep = useCallback((nextShown: Row[], nextHidden: Row[]) => {
    setShown(nextShown);
    setHidden(nextHidden);
    void saveLayout('log_layout', layoutOf(nextShown.map((r) => r.id), nextHidden.map((r) => r.id)));
  }, []);

  const hide = (row: Row) => keep(shown.filter((r) => r.id !== row.id), [...hidden, row]);
  const unhide = (row: Row) => keep([...shown, row], hidden.filter((r) => r.id !== row.id));

  return (
    <BodyScreen>
      <ThemedText type="display">Log</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
        Quickly record what&apos;s relevant to you. Anything here can be said in chat instead.
      </ThemedText>

      {/* THE WAY IN, WHERE SHE CAN SEE IT (Ruth, 21 September 2026: "no hide
          buttons on the cards as expected"). The buttons were there - behind an
          edit mode whose only door was a grey line under the list, which she
          never found. A control nobody finds is a control that does not exist,
          so it sits beside the list it changes, in the accent colour, saying
          what it does. */}
      {loaded && (
        <View style={styles.arrangeBar}>
          <Pressable
            onPress={() => setEditing((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={editing ? 'Finish arranging the list' : 'Arrange this list'}
            hitSlop={Spacing.two}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <ThemedText type="smallBold" themeColor="link">
              {editing ? 'Done' : 'Arrange'}
            </ThemedText>
          </Pressable>
        </View>
      )}

      <ThemedView type="backgroundElement" style={styles.card}>
        <ReorderableRows
          items={shown}
          onReorder={(next) => keep(next, hidden)}
          renderRow={(r, i, dragging) => (
            <Pressable
              onPress={r.go}
              // A row in hand is being moved, not tapped.
              disabled={dragging}
              accessibilityRole="button"
              accessibilityLabel={`${r.label}. ${r.detail}. Hold to move it.`}
              style={({ pressed }) => pressed && !dragging && styles.pressed}
            >
              <ThemedView
                type="backgroundElement"
                style={[
                  styles.row,
                  i > 0 && { borderTopWidth: 1, borderTopColor: theme.backgroundSelected },
                  dragging && { borderTopWidth: 0, borderRadius: CardRadius },
                ]}
              >
                <MaterialCommunityIcons name={r.icon} size={22} color={theme.accent} />
                <View style={styles.text}>
                  <ThemedText type="smallBold">{r.label}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.detail}>
                    {r.detail}
                  </ThemedText>
                </View>
                {editing ? (
                  <Pressable
                    onPress={() => hide(r)}
                    accessibilityRole="button"
                    accessibilityLabel={`Hide ${r.label}`}
                    hitSlop={Spacing.two}
                    style={({ pressed }) => pressed && styles.pressed}
                  >
                    <Ionicons name="remove-circle-outline" size={20} color={theme.textSecondary} />
                  </Pressable>
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                )}
              </ThemedView>
            </Pressable>
          )}
        />
      </ThemedView>

      {/* WHAT SHE PUT AWAY, and the way back. A hidden row that could not be
          recovered would be a deletion wearing a softer word. */}
      {loaded && (editing || hidden.length > 0) && (
        <View style={styles.tools}>
          <Pressable
            onPress={() => setEditing((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={editing ? 'Finish choosing what to show' : 'Choose what to show'}
            hitSlop={Spacing.two}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <ThemedText type="small" themeColor="link">
              {editing ? 'Done' : 'Choose what to show'}
            </ThemedText>
          </Pressable>

          {editing && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.detail}>
              Hold any row to move it up or down. Nothing is deleted: anything you put away can come back.
            </ThemedText>
          )}

          {hidden.length > 0 && editing && (
            <View style={styles.putAway}>
              <ThemedText type="small" themeColor="textSecondary">
                Put away
              </ThemedText>
              {hidden.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => unhide(r)}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${r.label} again`}
                  style={({ pressed }) => [styles.putAwayRow, pressed && styles.pressed]}
                >
                  <Ionicons name="add-circle-outline" size={18} color={theme.textSecondary} />
                  <ThemedText type="small">{r.label}</ThemedText>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      {loaded && !editing && hidden.length === 0 && (
        <Pressable
          onPress={() => setEditing(true)}
          accessibilityRole="button"
          accessibilityLabel="Choose what to show"
          hitSlop={Spacing.two}
          style={({ pressed }) => [styles.tools, pressed && styles.pressed]}
        >
          <ThemedText type="small" themeColor="textSecondary">
            Hold a row to move it · Choose what to show
          </ThemedText>
        </Pressable>
      )}
    </BodyScreen>
  );
}

const styles = StyleSheet.create({
  arrangeBar: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: Spacing.two },
  intro: { lineHeight: 20, maxWidth: 300 },
  card: { borderRadius: CardRadius, paddingHorizontal: Spacing.three },
  // Still a fixed height, though the drag no longer needs it to be: seven rows
  // of the same size is what makes this list scannable.
  row: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  text: { flex: 1, gap: 2 },
  detail: { lineHeight: 18 },
  tools: { paddingTop: Spacing.three, gap: Spacing.two },
  putAway: { paddingTop: Spacing.two, gap: Spacing.two },
  putAwayRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  pressed: { opacity: 0.6 },
});
