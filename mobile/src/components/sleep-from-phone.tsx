import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import {
  hasSleepPermission,
  requestSleepPermission,
  syncSleepFromPhone,
} from '@/lib/sleep-sync';

// LET THE PHONE FILL IN THE NIGHT (Ruth, 23 October 2026).
//
//   "we need any data that comes from the phone as it will be build into the
//    app since the whole idea is to reduce friction ... if it doesn't do that
//    people with wearables will think selodia is junk, simple as that."
//
// Her reasoning is the product's, not a preference: Lynda and Dunia wear
// trackers, and a tracker that logs a night while an app asks you to type it is
// an app that has not noticed the thing on your wrist.
//
// WHY A CONTROL AND NOT A SILENT SYNC. Health Connect's dialog is Android's,
// not ours, and meeting it because a screen loaded is how people decline
// something they would have agreed to. It is asked once, from a thing she
// tapped, and never again on its own - the same rule steps follow.
//
// AND IT SAYS WHAT IT WILL AND WILL NOT TAKE. A watch knows when sleep started,
// when it ended and how often it broke. It cannot know how the night FELT, and
// this says so, because the chips underneath ask her exactly that and the two
// would otherwise look like the same question asked twice.

export function SleepFromPhone({ onSynced }: { onSynced: () => void }) {
  const [state, setState] = useState<'checking' | 'off' | 'on' | 'busy'>('checking');
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setState((await hasSleepPermission()) ? 'on' : 'off');
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ANDROID ONLY, FOR NOW, AND SAID RATHER THAN HIDDEN ELSEWHERE. The iOS read
  // is not written yet; drawing nothing on an iPhone would leave somebody
  // hunting for a control that is not coming.
  if (Platform.OS !== 'android') return null;
  if (state === 'checking') return null;

  async function connect() {
    setState('busy');
    setNote(null);
    const granted = await requestSleepPermission();
    if (!granted) {
      setState('off');
      setNote('Not connected. You can still tell me about a night yourself.');
      return;
    }
    const written = await syncSleepFromPhone();
    setState('on');
    // WHAT ACTUALLY LANDED, counted from the writes rather than claimed. A
    // phone with no sleep data looks identical to a refusal unless this says
    // which happened.
    setNote(
      written > 0
        ? `Brought in ${written} night${written === 1 ? '' : 's'} from your phone.`
        : 'Connected, though your phone had no nights recorded yet.'
    );
    onSynced();
  }

  async function again() {
    setState('busy');
    setNote(null);
    const written = await syncSleepFromPhone();
    setState('on');
    setNote(written > 0 ? `Updated ${written} night${written === 1 ? '' : 's'}.` : 'Nothing new.');
    onSynced();
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">
        {state === 'on' ? 'Your phone is filling these in' : 'Let your phone fill these in'}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {state === 'on'
          ? 'Nights tracked by your phone or watch appear here on their own. How a night felt is still yours to say.'
          : 'If your phone or watch tracks your sleep, Selodía can read when you slept and how often the night broke, so you do not have to type it. It never reads how the night felt - that is yours to say.'}
      </ThemedText>

      <Pressable
        onPress={() => void (state === 'on' ? again() : connect())}
        disabled={state === 'busy'}
        accessibilityRole="button"
        accessibilityLabel={state === 'on' ? 'Check for new nights' : 'Connect your phone'}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <ThemedView type="background" style={styles.button}>
          <ThemedText type="small" themeColor="accentDeep">
            {state === 'busy' ? 'One moment…' : state === 'on' ? 'Check for new nights' : 'Connect'}
          </ThemedText>
        </ThemedView>
      </Pressable>

      {note ? (
        <ThemedText type="small" themeColor="textSecondary">
          {note}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: CardRadius, padding: Spacing.three, gap: Spacing.two },
  button: {
    borderRadius: CardRadius,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    alignSelf: 'flex-start',
  },
  pressed: { opacity: 0.6 },
});
