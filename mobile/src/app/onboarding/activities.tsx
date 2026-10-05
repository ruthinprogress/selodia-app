import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { OnboardingQuestion } from '@/components/onboarding-question';
import { useOnboardingAction } from '@/components/onboarding-action';
import { ThemedText } from '@/components/themed-text';
import { ButtonRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ACTIVITIES_SCREEN, activityTitle } from '@/lib/activities-copy';
import { logClientError } from '@/lib/client-error-log';
import {
  LOAD_FAILED_MESSAGE,
  LOAD_RETRY_LABEL,
  mayContinue,
  mayWrite,
  type LoadState,
} from '@/lib/load-state';
import { advanceOnboardingStep } from '@/lib/onboarding-step';
import { useOneQuestion } from '@/lib/one-question';
import { saveOutcomeMessage, type SaveOutcome } from '@/lib/save-outcome';
import { supabase } from '@/lib/supabase';
import { planWeekWrite } from '@/lib/week-write-plan';

// WHAT YOU ALREADY DO. Her final text, 5 October 2026: see lib/activities-copy.ts
// for the record and for why the frequency question is gone.
//
// SHE FOUND IT BY ASKING WHAT THE ANSWER WAS FOR. "When the user says eg. ballet
// and selects 'weekly' does it go into the weekly view on a random day? or do
// they all go into the Anytime category at the bottom... if it's the second, why
// do we ask the frequency at all?" It was the second. Nothing was placed on a day,
// and the cadence fed a second write of her activity level that overwrote the one
// she had stated on its own screen.
//
// SO THE SCREEN COLLECTS ACTIVITIES AND NOTHING ELSE. No frequency, and no height
// either - height sits beside the weight question on the approach screen now,
// where the figure it feeds is shown.
//
// AND SHE CAN TYPE HER OWN. The ideas are examples; anything she adds is kept in
// her words.

export default function ActivitiesScreen() {
  const theme = useTheme();
  const { fromManual, leave } = useOneQuestion();

  /** Her chosen activities, in the order they were added. Labels, not keys. */
  const [chosen, setChosen] = useState<string[]>([]);
  const [own, setOwn] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [notSaved, setNotSaved] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  /**
   * The rows this screen created, read at mount.
   *
   * IT MAY REMOVE ONLY ITS OWN. Until today that was a fixed list of ten labels
   * in this file; with a box she can type into, a label cannot tell "Lake
   * swimming, typed here" from "Lake swimming, mentioned in chat". user_week.source
   * says which, and this is what the write plan is given as its scope. The goals
   * screen widened exactly this boundary on 2 October and archived a goal it had
   * never shown her.
   */
  const [mine, setMine] = useState<string[]>([]);

  useEffect(() => {
    let live = true;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (live) setLoadState('failed');
        return;
      }
      if (!fromManual) advanceOnboardingStep(supabase, user.id, 'activities');

      const { data, error } = await supabase
        .from('user_week')
        .select('activity, source')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true });
      if (!live) return;
      if (error) {
        void logClientError('week-load', `reading her week failed: ${error.message}`);
        setLoadState('failed');
        return;
      }
      // A REDO IS AN EDIT MODE. Her own instruction: "Pull every current selection
      // from where it is kept and show it selected." Only this screen's rows, so
      // nothing from chat appears here to be taken away by accident.
      const rows = (data ?? []) as { activity: string; source: string | null }[];
      const ours = rows.filter((r) => r.source === 'setup').map((r) => r.activity);
      setMine(ours);
      setChosen(ours);
      setLoadState('ready');
    })();
    return () => {
      live = false;
    };
  }, [fromManual, attempt]);

  function toggle(label: string) {
    setChosen((list) =>
      list.includes(label) ? list.filter((l) => l !== label) : [...list, label]
    );
  }

  function addOwn() {
    const label = activityTitle(own);
    if (!label) return;
    setOwn('');
    setChosen((list) => (list.includes(label) ? list : [...list, label]));
  }

  async function save(): Promise<SaveOutcome> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 'failed';
    if (!mayWrite(loadState)) {
      void logClientError('week-save', `activities refused: loadState=${loadState}`);
      return 'not-ready';
    }

    const { data: existingRows, error: readError } = await supabase
      .from('user_week')
      .select('id, activity, cadence, sort_order, source')
      .eq('user_id', user.id);
    if (readError) {
      void logClientError('week-save', `reading her week failed: ${readError.message}`);
      return 'failed';
    }

    // ITS OWN ROWS, AND THE ONES IT IS ABOUT TO CREATE. Anything else in her week
    // is out of scope and cannot be removed by any arrangement of taps here.
    const ownLabels = Array.from(
      new Set([
        ...mine,
        ...((existingRows ?? [])
          .filter((r) => r.source === 'setup')
          .map((r) => String(r.activity))),
        ...chosen,
      ])
    );

    const plan = planWeekWrite({
      loaded: mayWrite(loadState),
      existing: (existingRows ?? []).map((r) => ({
        id: String(r.id),
        activity: String(r.activity),
        cadence: r.cadence === null || r.cadence === undefined ? null : String(r.cadence),
        sort_order: typeof r.sort_order === 'number' ? r.sort_order : null,
      })),
      ownLabels,
      // NO CADENCE. The screen does not ask, so it does not write one; a cadence
      // she gives in chat ("I swim twice a week") still lands on the row and is
      // still what the week's conflict check reads.
      chosen: chosen.map((activity) => ({ activity, cadence: null })),
    });
    if (!plan) {
      void logClientError('week-save', 'the write plan refused - her week was not in hand');
      return 'failed';
    }

    if (plan.remove.length > 0) {
      const { error } = await supabase.from('user_week').delete().in('id', plan.remove);
      if (error) {
        void logClientError('week-save', `removing rows failed: ${error.message}`);
        return 'failed';
      }
    }

    if (plan.insert.length > 0) {
      const { error } = await supabase.from('user_week').insert(
        plan.insert.map((row) => ({
          user_id: user.id,
          activity: row.activity,
          cadence: row.cadence,
          sort_order: row.sort_order,
          // SAYS WHERE IT CAME FROM, so a later visit knows what it may remove.
          source: 'setup',
        }))
      );
      if (error) {
        void logClientError('week-save', `writing her week failed: ${error.message}`);
        return 'failed';
      }
    }

    // A ROW SHE KEPT IS UPDATED IN PLACE, never removed and re-made, so the day
    // and time she gave it survive. The plan only ever carries a cadence here,
    // and this screen no longer sets one - so in practice this is empty, and it
    // stays because a cadence from chat on a row she also ticked here is a real
    // case the plan already handles.
    for (const row of plan.updateCadence) {
      const { error } = await supabase
        .from('user_week')
        .update({ cadence: row.cadence })
        .eq('id', row.id);
      if (error) {
        void logClientError('week-save', `updating a row failed: ${error.message}`);
        return 'failed';
      }
    }

    return chosen.length === 0 && plan.remove.length === 0 ? 'nothing-chosen' : 'saved';
  }

  async function goOn(skipping: boolean) {
    if (saving) return;
    setFailed(false);
    setNotSaved(null);
    if (skipping) {
      leave('/onboarding/skill');
      return;
    }
    setSaving(true);
    const outcome = await save();
    setSaving(false);
    if (outcome === 'saved' || outcome === 'nothing-chosen') {
      leave('/onboarding/skill');
      return;
    }
    const message = saveOutcomeMessage(outcome, 'your week');
    if (message) {
      setNotSaved(message);
      return;
    }
    setFailed(true);
  }

  useOnboardingAction({
    label: saving ? 'Saving…' : 'Continue',
    enabled: mayContinue(loadState, saving),
    onPress: () => void goOn(false),
    secondary: { label: 'Skip this question', onPress: () => void goOn(true) },
  });

  const ideasLeft = ACTIVITIES_SCREEN.ideas.filter((i) => !chosen.includes(i));

  return (
    <OnboardingQuestion
      question={ACTIVITIES_SCREEN.question}
      subtitle={ACTIVITIES_SCREEN.subtitle}>
      {/* IDEAS, AND THE ONES SHE HAS TAKEN LEAVE THE LIST rather than sitting
          there in a selected state. What she has chosen is shown below as her
          week, which is the thing she is building. */}
      {ideasLeft.length > 0 && (
        <>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
            {ACTIVITIES_SCREEN.ideasLabel}
          </ThemedText>
          <View style={styles.chips}>
            {ideasLeft.map((idea) => (
              <Pressable
                key={idea}
                onPress={() => toggle(idea)}
                accessibilityRole="button"
                accessibilityLabel={`Add ${idea}`}
                style={({ pressed }) => pressed && styles.pressed}>
                <View style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="small">{idea}</ThemedText>
                </View>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <ThemedText type="small">{ACTIVITIES_SCREEN.ownLabel}</ThemedText>
      <View style={styles.addRow}>
        <TextInput
          value={own}
          onChangeText={setOwn}
          placeholder={ACTIVITIES_SCREEN.ownPlaceholder}
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel={ACTIVITIES_SCREEN.ownPlaceholder}
          onSubmitEditing={addOwn}
          returnKeyType="done"
          style={[
            styles.entry,
            styles.grow,
            { color: theme.text, borderColor: theme.backgroundSelected },
          ]}
        />
        <Pressable
          onPress={addOwn}
          disabled={!own.trim()}
          accessibilityRole="button"
          accessibilityLabel="Add this activity"
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedText type="smallBold" themeColor={own.trim() ? 'accentDeep' : 'textSecondary'}>
            Add
          </ThemedText>
        </Pressable>
      </View>

      {chosen.length > 0 && (
        <View style={styles.chips}>
          {chosen.map((label) => (
            <Pressable
              key={label}
              onPress={() => toggle(label)}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${label}`}
              style={({ pressed }) => pressed && styles.pressed}>
              <View
                style={[
                  styles.chip,
                  { backgroundColor: theme.backgroundSelected, borderColor: theme.accentDeep },
                  styles.chosen,
                ]}>
                <ThemedText type="small" themeColor="accentDeep">
                  {label} ×
                </ThemedText>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {loadState === 'failed' && (
        <View style={styles.group}>
          <ThemedText type="small" themeColor="danger">
            {LOAD_FAILED_MESSAGE}
          </ThemedText>
          <Pressable
            onPress={() => {
              setLoadState('loading');
              setAttempt((a) => a + 1);
            }}
            accessibilityRole="button"
            accessibilityLabel={LOAD_RETRY_LABEL}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedText type="smallBold" themeColor="accentDeep">
              {LOAD_RETRY_LABEL}
            </ThemedText>
          </Pressable>
        </View>
      )}

      {/* Quiet, not alarming: a deliberate non-write is not an error. */}
      {notSaved && !failed && (
        <ThemedText type="small" themeColor="textSecondary">
          {notSaved}
        </ThemedText>
      )}
      {failed && (
        <ThemedText type="small" themeColor="danger">
          {ACTIVITIES_SCREEN.error}
        </ThemedText>
      )}

      {/* THE LINE THAT REPLACED THE FREQUENCY QUESTION. It says where these go,
          that arranging them comes later, and that none of it is a measurement. */}
      <ThemedText type="small" themeColor="textSecondary">
        {ACTIVITIES_SCREEN.footer}
      </ThemedText>
    </OnboardingQuestion>
  );
}

const styles = StyleSheet.create({
  label: { textTransform: 'uppercase', letterSpacing: 0.8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    borderRadius: ButtonRadius,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  chosen: { borderWidth: 1 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  grow: { flex: 1, minWidth: 0 },
  entry: {
    borderWidth: 1,
    borderRadius: ButtonRadius,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  group: { gap: Spacing.two },
  pressed: { opacity: 0.6 },
});
