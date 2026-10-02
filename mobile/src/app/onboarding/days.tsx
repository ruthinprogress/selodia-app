import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { OnboardingQuestion } from '@/components/onboarding-question';
import { useOnboardingAction } from '@/components/onboarding-action';
import { TapChoices } from '@/components/tap-choices';
import { ThemedText } from '@/components/themed-text';
import { CardRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  FEEL_CHIPS,
  FEEL_HONEST_NOTE,
  FEEL_OWN_WORDS_LABEL,
  FEEL_OWN_WORDS_PLACEHOLDER,
  FEEL_QUESTION,
  FEEL_SUBTITLE,
} from '@/lib/feel-goals';
import { advanceOnboardingStep } from '@/lib/onboarding-step';
import {
  LOAD_FAILED_MESSAGE,
  LOAD_RETRY_LABEL,
  mayContinue,
  mayWrite,
  type LoadState,
} from '@/lib/load-state';
import { supabase } from '@/lib/supabase';

// QUESTION 1 OF 7: HOW DO YOU WANT YOUR DAYS TO FEEL?
//
// Ruth's approved preview opens here, and that order is the argument. Every
// version before this opened on the body - what do you want to change about your
// weight, your fat, your muscle - and the app's actual purpose is the one in item
// 7: take mental load off, reduce friction and stress, support long-term health.
// Opening on the body told a different story about what Selodía is for, in the
// first ten seconds, to somebody deciding whether to bother.
//
// IT IS ALSO THE ONE QUESTION WITH NO ARITHMETIC BEHIND IT, and that is why it
// comes first rather than last. Everything else here feeds a target. This feeds
// how she is spoken to.
//
// THE HONEST LINE IS SHOWN, NOT BURIED. "Selodía cannot promise to fix any of
// this." A screen that collects "more energy" and says nothing is implying a
// promise; saying so costs one paragraph and is the difference between a record
// and a claim.
//
// NOTHING HERE IS SCORED. No chip is worth more than another, the answers are
// stored as words, and there is no counter anywhere downstream. See
// lib/feel-goals.ts and the migration for why that is structural rather than a
// decision somebody has to keep making.

export default function DaysScreen() {
  const theme = useTheme();
  const [chosen, setChosen] = useState<string[]>([]);
  const [ownWords, setOwnWords] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  // THREE STATES, NOT A BOOLEAN. `loaded: false` meant both "not yet" and "it
  // failed", and the second inherited the treatment built for the first: a dead
  // Continue and no message, forever. See lib/load-state.ts.
  const [loadState, setLoadState] = useState<LoadState>('loading');
  /** Bumped by Try again, which re-runs the read. */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      advanceOnboardingStep(supabase, user.id, 'days');

      // ITEM 4: A REDO OPENS ON HER ANSWERS.
      const { data, error } = await supabase
        .from('feel_goals')
        .select('label, source')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('sort_order', { ascending: true });
      if (!live) return;
      if (error) {
        setLoadState('failed');
        return;
      }
      const rows = data ?? [];
      setChosen(
        rows
          .filter((r) => r.source === 'chip')
          .map((r) => String(r.label))
          .filter((l) => (FEEL_CHIPS as readonly string[]).includes(l))
      );
      const hers = rows.find((r) => r.source === 'her words');
      if (hers) setOwnWords(String(hers.label));
      setLoadState('ready');
    })();
    return () => {
      live = false;
    };
  }, [attempt]);

  function toggle(label: string) {
    setChosen((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]));
  }

  async function save(): Promise<boolean> {
    if (!mayWrite(loadState)) return true;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const words = ownWords.trim();
    if (chosen.length === 0 && !words) return true; // nothing chosen is a real answer

    // ARCHIVED, NEVER DELETED, for the same reason the body goals are: the
    // snapshot is what a look-back compares against, and deleting the thing she
    // started from makes every earlier look-back unreadable. A redo replaces
    // what is current and keeps what was.
    const { error: archiveError } = await supabase
      .from('feel_goals')
      .update({ archived_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('archived_at', null);
    if (archiveError) return false;

    const rows = [
      ...chosen.map((label, i) => ({
        user_id: user.id,
        label,
        source: 'chip',
        sort_order: i,
      })),
      // HER OWN SENTENCE, EXACTLY AS TYPED, and marked as hers so the look-back
      // screen can show it as a sentence rather than as another chip.
      ...(words
        ? [{ user_id: user.id, label: words, source: 'her words', sort_order: chosen.length }]
        : []),
    ];
    const { error } = await supabase.from('feel_goals').insert(rows);
    return !error;
  }

  async function goOn(skipping: boolean) {
    if (saving) return;
    setFailed(false);
    if (skipping) {
      router.push('/onboarding/goals');
      return;
    }
    setSaving(true);
    const ok = await save();
    setSaving(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    router.push('/onboarding/goals');
  }

  useOnboardingAction({
    label: saving ? 'Saving…' : 'Continue',
    // Pressable once the read settles, either way. A failed read means this
    // screen does not write on the way past, not that she is stuck on it.
    enabled: mayContinue(loadState, saving),
    onPress: () => void goOn(false),
    secondary: { label: 'Skip this question', onPress: () => void goOn(true) },
  });

  return (
    <OnboardingQuestion question={FEEL_QUESTION} subtitle={FEEL_SUBTITLE}>
      <TapChoices
        options={FEEL_CHIPS.map((label) => ({ key: label, label }))}
        selected={chosen}
        onSelect={toggle}
        multi
      />

      <ThemedText type="small">{FEEL_OWN_WORDS_LABEL}</ThemedText>
      <TextInput
        value={ownWords}
        onChangeText={setOwnWords}
        placeholder={FEEL_OWN_WORDS_PLACEHOLDER}
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel={FEEL_OWN_WORDS_LABEL}
        multiline
        style={[styles.field, { color: theme.text, borderColor: theme.backgroundSelected }]}
      />

      <ThemedText type="small" themeColor="textSecondary">
        {FEEL_HONEST_NOTE}
      </ThemedText>

      {/* SAID, RATHER THAN SHOWN AS AN EMPTY SCREEN. For two days a failed read
          on screens like this one looked identical to having nothing saved. */}
      {loadState === 'failed' && (
        <>
          <ThemedText type="small" themeColor="danger">
            {LOAD_FAILED_MESSAGE}
          </ThemedText>
          <ThemedText
            type="smallBold"
            themeColor="accentDeep"
            accessibilityRole="button"
            accessibilityLabel={LOAD_RETRY_LABEL}
            onPress={() => setAttempt((n) => n + 1)}>
            {LOAD_RETRY_LABEL}
          </ThemedText>
        </>
      )}

      {failed && (
        <ThemedText type="small" themeColor="danger">
          That didn&apos;t save. Check your connection and try again.
        </ThemedText>
      )}
    </OnboardingQuestion>
  );
}

const styles = StyleSheet.create({
  field: {
    borderWidth: 1,
    borderRadius: CardRadius,
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 112,
    fontSize: 16,
    textAlignVertical: 'top',
  },
});
