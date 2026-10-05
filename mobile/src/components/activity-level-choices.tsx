import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ACTIVITY_CHOICES, activitySetLine } from '@/lib/body-mode';
import { supabase } from '@/lib/supabase';

// HOW ACTIVE ARE YOU: ONE SCREEN, TWO DOORS (Ruth, 5 October 2026).
//
//   "How Active are You is already lovely and already sits in the Body Manual.
//   It all just needs ordering as I said."
//
// Her new order puts it third in setup, between the approach and what she already
// does - which is where it belongs, because the approach decides what the figure
// is FOR and this decides what it is built on.
//
// SO IT IS A COMPONENT, NOT A SECOND SCREEN. Setup renders it inside the question
// shell with a Continue; More renders it inside SettingsPage. One list of choices,
// one write, one date on the answer. Two copies of a screen that sets the single
// biggest term in her calorie figure is the fault this whole file exists to undo -
// the level was derived in two places before, and one of them silently won.
//
// WHY THE SCREEN EXISTS AT ALL, kept here because it is the most expensive bug of
// the week. The level was DERIVED from the cadence chips on the activities screen,
// with no guard, and activityLevelFrom([]) returns 'sedentary'. Her chips were not
// saving, so every walk through that screen wrote sedentary over her moderate:
// about four hundred kilocalories a day, silently. She noticed because the number
// looked wrong - "1350 is nothing!"
//
// A DERIVED ANSWER HAS NO DATE AND NOBODY TO ASK. A stated one has both.
//
// AND THE LABELS ARE NOT THE ANSWER. She called her own week "moderately active";
// the figure she expected is what this app calls `light`. Nobody should have to
// guess which word the app means, so the descriptions are what she picks from and
// the key is never shown.

export function ActivityLevelChoices({ onChosen }: { onChosen?: () => void }) {

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
    // next read, so leaving IS the recalculation - there is nothing cached to
    // invalidate, which is the one upside of having had two surfaces disagree
    // enough times to stop caching anything.
    //
    // WHERE "return" GOES IS THE CALLER'S. From More it is back; in setup it is
    // nowhere, because Continue is the way on and taking her there on a tap would
    // skip the figure she just asked to see.
    onChosen?.();
  }


  // THE FIGURE THE CHOSEN LINE COMES TO. The same arithmetic as the number on
  // each card, so the guide below cannot disagree with the option above it.
  const guideKcal = (() => {
    if (!bmr || !current) return null;
    const choice = ACTIVITY_CHOICES.find((c) => c.key === current);
    return choice ? Math.round(bmr * choice.factor) : null;
  })();

  return (
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

    {/* WHAT THE CHOICE COMES TO, AND PERMISSION TO DIFFER FROM IT (Ruth,
        5 October 2026, her words for both lines).

        Her note on why: "That single paragraph gives users permission to
        trust both the guide and their own experience, which feels much more
        aligned with your philosophy than trying to calculate every workout."

        It is the argument against the feature I would otherwise have been
        asked for - reading each session and adjusting the figure daily. A
        number that moves with every workout is a number that has to be
        right, and it invites the person to earn it back. One steady starting
        point, said out loud, with the day's own variation acknowledged
        rather than computed, is the quieter and the more honest of the two. */}
    {guideKcal != null && (
      <View style={styles.guide}>
        <ThemedText type="smallBold">
          Your guide: around {guideKcal.toLocaleString('en-GB')} kcal/day
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Based on the kind of week you described. On unusually active or
          restful days, your body may naturally need a little more or a little
          less.
        </ThemedText>
      </View>
    )}

    <ThemedText type="small" themeColor="textSecondary" style={styles.setLine}>
      {activitySetLine(setAt)}
    </ThemedText>

    {failed && (
      <ThemedText type="small" themeColor="danger">
        That didn&apos;t save. Check your connection and try again.
      </ThemedText>
    )}

    {/* HER WORDING, VERBATIM. Mine said the same fact from the app's side -
        "nothing here is worked out from what you log" - which is an engineer
        explaining what the system does not do. Hers says it from the
        person's, and that is the whole of why it is warmer: she is the
        subject of the sentence rather than the mechanism.

        IT WAS BRIEFLY REMOVED AND PUT BACK the same morning. She asked for it
        gone, then found she had been reading an older build - the page she
        was judging did not have the guide line above it yet. */}
    <ThemedText type="small" themeColor="textSecondary">
      This is based only on the activity level you choose. It won&apos;t change
      automatically unless you update it.
    </ThemedText>
  </View>
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
  guide: { gap: Spacing.one, paddingTop: Spacing.two },
  setLine: { paddingTop: Spacing.two },
  pressed: { opacity: 0.6 },
});
