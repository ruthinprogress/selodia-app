import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { logRestDay } from '@/lib/log-rest-day';

// TODAY'S FOCUS, AND THE DAY WITH NOTHING ON IT.
//
// Ruth, 21 October 2026, on the Now artwork: "'Today's focus' is nice, warmer
// than on the plan, and the terracotta section breaks up the page a little...
// I like that this section now has an arrow on the right to take you to......
// the week? I suppose so, so they can see where it's coming from."
//
// AND HER IDEA FOR THE EMPTY DAY, which closes a real gap: "If there's nothing
// that day, do we still have the section and actually register it as a rest
// day until an activity gets logged. This might solve the problem that Rest
// has no way of getting logged atm."
//
// REST COULD ALREADY BE LOGGED AND NOBODY KNEW. "rest day today" in chat is
// handled explicitly and skips the duration question every other activity has
// to answer. Her own words: "noone knows that you can say rest day in chat,
// even i didn't really know or remember." So this is not a new capability, it
// is the same one with a door you can see.
//
// IT OFFERS AND NEVER ASSUMES, which was her instruction - "tap to choose,
// never automatic - definitely" - and it is also the only version that holds
// up. A day with nothing planned is not a rest day, it is a day with nothing
// planned. Registering one automatically would mean the app writing a record
// she did not make, and then deleting its own row the moment she logged
// something real.
//
// ONE MARK, NOT AN ICON PER ACTIVITY. The artwork put a leaf here and she
// asked whether it could be the activity's own - ballet shoes for ballet. The
// Week holds free text ("Rope climbing", "French class"), so an icon per
// activity means a few dozen icons and a fallback that shows most of the time,
// which reads as broken. A mark that means "today" is true of every activity.
// Revisit if the vocabulary is ever bounded.

export function TodayFocus({
  planned,
  anythingLogged,
  onLogged,
}: {
  /** "On the plan: ballet", or null when nothing is on today. */
  planned: string | null;
  /** Anything at all in today's movement log. */
  anythingLogged: boolean;
  onLogged: () => void;
}) {
  const theme = useTheme();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  // NOTHING TO SAY, SO NOTHING IS DRAWN. A day with no plan and a session
  // already logged needs nothing from this card, and an empty terracotta block
  // is worse than no block.
  if (!planned && anythingLogged) return null;

  async function rest() {
    if (saving) return;
    setSaving(true);
    setFailed(false);
    const result = await logRestDay();
    setSaving(false);
    // ALREADY COUNTS AS DONE. Something is in today's log either way, which is
    // the thing the offer existed to change.
    if (result === 'failed') {
      setFailed(true);
      return;
    }
    onLogged();
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.mark}>
        <Ionicons name="leaf-outline" size={20} color={theme.accentDeep} />
      </View>

      <View style={styles.words}>
        <ThemedText type="detail" themeColor="textSecondary">
          Today&apos;s focus
        </ThemedText>
        {planned ? (
          <ThemedText type="small">{planned.replace(/^On the plan:\s*/i, '')}</ThemedText>
        ) : (
          // ONE NOTHING, NOT TWO. This said different things depending on
          // whether she had chosen "Guide me", because somebody leading their
          // own week had no week to be empty. The two modes went on 21 October
          // and everybody has a Week, so there is one true sentence.
          <ThemedText type="small" themeColor="textSecondary">
            Nothing planned today
          </ThemedText>
        )}
        {failed ? (
          // SAID OUT LOUD. A tap that silently did nothing is the fault this
          // app has fixed in four other places.
          <ThemedText type="detail" themeColor="danger">
            That did not save. Try again in a moment.
          </ThemedText>
        ) : null}
      </View>

      {planned ? (
        // WHERE IT CAME FROM. Plans opens on the Week, so the arrow lands on
        // the thing that put this line here.
        <Pressable
          onPress={() => router.push('/(tabs)/plans')}
          accessibilityRole="button"
          accessibilityLabel="Open your Week"
          hitSlop={Spacing.two}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
        </Pressable>
      ) : (
        <Pressable
          onPress={() => void rest()}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Log today as a rest day"
          accessibilityState={{ disabled: saving }}
          hitSlop={Spacing.two}
          style={({ pressed }) => [
            styles.rest,
            { borderColor: theme.accentDeep },
            pressed && styles.pressed,
          ]}
        >
          <ThemedText type="detail" themeColor="accentDeep">
            {saving ? 'Saving…' : 'Rest day'}
          </ThemedText>
        </Pressable>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: CardRadius,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.two,
  },
  mark: { width: 24, alignItems: 'center' },
  words: { flexGrow: 1, flexShrink: 1, gap: 1 },
  rest: { borderWidth: 1, borderRadius: 999, paddingHorizontal: Spacing.two, paddingVertical: 3 },
  pressed: { opacity: 0.6 },
});
