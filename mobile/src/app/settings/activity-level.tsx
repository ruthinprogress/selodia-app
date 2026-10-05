import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { SettingsPage } from '@/components/settings-page';
import { ThemedText } from '@/components/themed-text';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ACTIVITY_CHOICES, activitySetLine } from '@/lib/body-mode';
import { supabase } from '@/lib/supabase';

// THE ONE PLACE THE ACTIVITY LEVEL IS SET (Ruth's item 2, 4 October 2026).
//
//   "ACTIVITY LEVEL is a link wherever it appears... it opens a small sheet with
//   the levels, one plain line each (say whether usual training is counted),
//   'Last set on [date]', save, recalculate, return. ONE source."
//
// WHY THIS SCREEN EXISTS AT ALL, and it is the most expensive bug of the week.
// The level was DERIVED from the cadence chips on the activities screen, with no
// guard, and activityLevelFrom([]) returns 'sedentary'. Her chips were not
// saving, so every walk through that screen wrote sedentary over her moderate -
// about four hundred kilocalories a day, silently, with nothing anywhere saying
// so. She noticed because the number looked wrong: "1350 is nothing!"
//
// A DERIVED ANSWER HAS NO DATE AND NOBODY TO ASK. A stated one has both, which is
// why this is a screen rather than a smarter inference.
//
// THE QUESTION NOW MEANS WHAT THE SUM MEANS. The old wording asked how much she
// moves "outside exercise" and fed the answer to a whole-day multiplier - so
// answering honestly left her ballet, her training and her ten thousand steps out
// of her own estimate. Each line below describes a WHOLE WEEK with training in it.
//
// AND THE LABELS ARE NOT THE ANSWER. She called her own week "moderately active";
// the figure she expected is what this app calls `light`. Nobody should have to
// guess which word the app means, so the descriptions are what she picks from and
// the key is never shown.

export default function ActivityLevelScreen() {
  const theme = useTheme();
  const [current, setCurrent] = useState<string | null>(null);
  const [setAt, setSetAt] = useState<string | null>(null);
  const [bmr, setBmr] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const [{ data: profile }, { data: measured }] = await Promise.all([
          supabase
            .from('user_profile')
            .select('activity_level, activity_level_set_at')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('body_measurements')
            .select('bmr')
            .eq('user_id', user.id)
            .not('bmr', 'is', null)
            .order('measured_at', { ascending: false })
            .limit(1),
        ]);
        if (cancelled) return;
        const p = profile as {
          activity_level?: string | null;
          activity_level_set_at?: string | null;
        } | null;
        setCurrent(p?.activity_level ?? null);
        setSetAt(p?.activity_level_set_at ?? null);
        setBmr(Number((measured ?? [])[0]?.bmr) || null);
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  async function choose(key: string) {
    if (saving) return;
    const previous = current;
    setCurrent(key);
    setSaving(true);
    setFailed(false);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setCurrent(previous);
      setSaving(false);
      setFailed(true);
      return;
    }
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('user_profile')
      .update({ activity_level: key, activity_level_set_at: now })
      .eq('user_id', user.id);
    setSaving(false);
    if (error) {
      setCurrent(previous);
      setFailed(true);
      return;
    }
    setSetAt(now);
    // RECALCULATE AND RETURN, her words. Every figure is derived from this on the
    // next read, so going back IS the recalculation - there is nothing cached to
    // invalidate, which is the one upside of having had two surfaces disagree
    // enough times to stop caching anything.
    router.back();
  }

  // THE SHARED SHELL, NOT A HAND-ROLLED ONE (5 October 2026). This screen and the
  // Body Manual's were both written as a ThemedView wrapping a ScrollView, and
  // both got the same two things wrong: a small title where every other page
  // carries the serif display one, and no safe-area inset or bottom padding, so
  // the last card sat under the system bar. Her words about the other one: "It
  // all sits too low so cant access bottom of the cards/options."
  //
  // SettingsPage decides all of that once. Writing a page without it is choosing
  // to re-decide five things, and the two I did not decide were the two that
  // broke.
  return (
    <SettingsPage
      title="Your activity level"
      subtitle="Pick the line that sounds most like a usual week, training included. It is the single biggest thing in your daily calorie figure, so it is worth a moment."
      footer="Nothing here is worked out from what you log. It is what you have said, and it stays as you left it until you change it.">
      <View style={styles.choices}>
        {ACTIVITY_CHOICES.map((choice) => {
          const chosen = current === choice.key;
          const kcal = bmr ? Math.round(bmr * choice.factor) : null;
          return (
            <Pressable
              key={choice.key}
              onPress={() => void choose(choice.key)}
              disabled={saving}
              accessibilityRole="radio"
              accessibilityState={{ selected: chosen, disabled: saving }}
              accessibilityLabel={choice.description}
              style={({ pressed }) => [
                styles.choice,
                {
                  backgroundColor: chosen ? theme.accentWash : theme.backgroundElement,
                  borderColor: chosen ? theme.accentDeep : 'transparent',
                },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="small">{choice.description}</ThemedText>
              {/* THE FIGURE EACH ONE PRODUCES, so the choice is visible rather
                  than a guess at what the app will do with it. This is the number
                  she will see on Today, worked out the same way. */}
              {kcal != null && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.figure}>
                  About {kcal.toLocaleString('en-GB')} kcal a day
                </ThemedText>
              )}
            </Pressable>
          );
        })}

        <ThemedText type="small" themeColor="textSecondary" style={styles.setLine}>
          {activitySetLine(setAt)}
        </ThemedText>

        {failed && (
          <ThemedText type="small" themeColor="danger">
            That didn&apos;t save. Check your connection and try again.
          </ThemedText>
        )}
      </View>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  choices: { gap: Spacing.three },
  choice: {
    borderRadius: CardRadius,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  figure: { fontVariant: ['tabular-nums'] },
  setLine: { paddingTop: Spacing.two },
  pressed: { opacity: 0.6 },
});
