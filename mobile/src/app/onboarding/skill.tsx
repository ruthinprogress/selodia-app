import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { OnboardingQuestion } from '@/components/onboarding-question';
import { useOnboardingAction } from '@/components/onboarding-action';
import { TapChoices } from '@/components/tap-choices';
import { ThemedText } from '@/components/themed-text';
import { ButtonRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { advanceOnboardingStep } from '@/lib/onboarding-step';
import {
  LOAD_FAILED_MESSAGE,
  LOAD_RETRY_LABEL,
  mayContinue,
  mayWrite,
  type LoadState,
} from '@/lib/load-state';
import { useOneQuestion } from '@/lib/one-question';
import { logClientError } from '@/lib/client-error-log';
import { saveOutcomeMessage, type SaveOutcome } from '@/lib/save-outcome';
import {
  PLACEMENTS,
  SKILL_SCREEN,
  skillTitle,
  type PlacementKey,
} from '@/lib/skills-copy';
import { supabase } from '@/lib/supabase';

// SCREEN 3 OF 7: SOMETHING SHE WOULD LOVE TO BE ABLE TO DO.
//
// REBUILT 5 OCTOBER 2026 ON HER PRINCIPLE: "Skills is just a place to keep the
// things someone is working on. The user does not know about progression ladders
// and does not need to."
//
// WHAT THIS REPLACED, AND THE FAULT WAS NOT THE WORDING. The screen offered five
// calisthenics ladders - a strict pull-up, hanging core, a front lever, a
// handstand, the splits - because those were the movements the clip library could
// illustrate end to end. Somebody whose answer is "run 5 km" or "get up off the
// floor more easily" had nothing to tap and nowhere to type. A limitation of the
// asset library had quietly become the question being asked.
//
// SO THE ANSWER IS ALWAYS HER WORDS. The ideas are examples: tapping one fills
// the box, where it can be edited or cleared, and nothing records that one was
// tapped. The box is the answer.
//
// NO MODEL CALL ON THIS SCREEN, and no matching of what she types against the
// written ladders. Her point 2: a skill is her own words, where she is with it,
// and the date. Nothing else.
//
// THE LADDERS ARE OFF, NOT DELETED. See LADDERS_ENABLED in lib/skills-copy.ts.

export default function SkillScreen() {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [placement, setPlacement] = useState<PlacementKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [notSaved, setNotSaved] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');

  const { fromManual, leave } = useOneQuestion();

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
      if (!fromManual) advanceOnboardingStep(supabase, user.id, 'skill');

      // WHAT SHE ALREADY HAS, so coming back does not look like a blank screen.
      // Only the newest: this screen asks for one, and Skills holds the rest.
      const { data, error } = await supabase
        .from('user_skills')
        .select('name, placement')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (!live) return;
      if (error) {
        setLoadState('failed');
        return;
      }
      const existing = (data ?? [])[0] as { name?: string; placement?: string } | undefined;
      if (existing?.name) setText(existing.name);
      if (existing?.placement) setPlacement(existing.placement as PlacementKey);
      setLoadState('ready');
    })();
    return () => {
      live = false;
    };
  }, [fromManual]);

  const entered = text.trim().length > 0;

  async function save(): Promise<SaveOutcome> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 'failed';

    // The refusal is right; reporting it as success was the bug. See
    // lib/save-outcome.ts.
    if (!mayWrite(loadState)) {
      void logClientError('setup-save', `skill refused: loadState=${loadState}`);
      return 'not-ready';
    }
    if (!entered) return 'nothing-chosen';

    const name = skillTitle(text);

    // ONE SKILL FROM THIS SCREEN, REPLACED RATHER THAN ADDED TO. Coming back
    // through setup means the new answer, not both answers - the same rule the
    // goals screen follows. Anything added in chat or in Skills has a different
    // origin and is left alone.
    const { data: mine } = await supabase
      .from('user_skills')
      .select('id, name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);
    const previous = (mine ?? [])[0] as { id: string; name: string } | undefined;

    if (previous && previous.name === name) {
      const { error } = await supabase
        .from('user_skills')
        .update({ placement })
        .eq('id', previous.id)
        .eq('user_id', user.id);
      return error ? 'failed' : 'saved';
    }

    const { error } = await supabase.from('user_skills').insert({
      user_id: user.id,
      name,
      placement,
      // NO ladder_key AND NO dimension. A skill is her words; those two columns
      // belong to the parked ladders and stay null rather than being guessed at
      // from what she typed.
    });
    return error ? 'failed' : 'saved';
  }

  async function goOn(skipping: boolean) {
    if (saving) return;
    setFailed(false);
    setNotSaved(null);
    if (skipping) {
      leave('/onboarding/activities');
      return;
    }
    setSaving(true);
    const outcome = await save();
    setSaving(false);
    if (outcome === 'saved' || outcome === 'nothing-chosen') {
      leave('/onboarding/activities');
      return;
    }
    const message = saveOutcomeMessage(outcome, 'what you would love to be able to do');
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

  return (
    <OnboardingQuestion question={SKILL_SCREEN.question} subtitle={SKILL_SCREEN.subtitle}>
      {/* IDEAS, NOT OPTIONS. Tapping one fills the box below, where it can be
          changed or cleared. Nothing records that one was tapped, and nothing
          matches what she ends up with against a written ladder. */}
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.ideasLabel}>
        {SKILL_SCREEN.ideasLabel}
      </ThemedText>
      <View style={styles.ideas}>
        {SKILL_SCREEN.ideas.map((idea) => (
          <Pressable
            key={idea}
            onPress={() => setText(idea)}
            accessibilityRole="button"
            accessibilityLabel={idea}
            style={({ pressed }) => [
              styles.idea,
              { backgroundColor: theme.backgroundElement },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="small">{idea}</ThemedText>
          </Pressable>
        ))}
      </View>

      {/* THE LABEL IS BEFORE THE BOX, NOT INSIDE IT (her wording). A placeholder
          disappears the moment somebody types, taking the sentence with it. */}
      <ThemedText type="small">{SKILL_SCREEN.entryLabel}</ThemedText>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={SKILL_SCREEN.entryPlaceholder}
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel={SKILL_SCREEN.entryLabel}
        style={[styles.entry, { color: theme.text, borderColor: theme.backgroundSelected }]}
      />

      {/* ONLY ONCE SHE HAS SAID SOMETHING. "Where are you with it?" above an
          empty box is a question about nothing. */}
      {entered && (
        <View style={styles.group}>
          <ThemedText type="small">{SKILL_SCREEN.placementHeading}</ThemedText>
          <TapChoices
            options={PLACEMENTS}
            selected={placement ? [placement] : []}
            onSelect={(key) => setPlacement(key)}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {SKILL_SCREEN.placementNote}
          </ThemedText>
        </View>
      )}

      {loadState === 'failed' && (
        <View style={styles.group}>
          <ThemedText type="small" themeColor="danger">
            {LOAD_FAILED_MESSAGE}
          </ThemedText>
          <Pressable
            onPress={() => setLoadState('loading')}
            accessibilityRole="button"
            accessibilityLabel={LOAD_RETRY_LABEL}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedText type="smallBold" themeColor="accentDeep">
              {LOAD_RETRY_LABEL}
            </ThemedText>
          </Pressable>
        </View>
      )}

      {/* QUIET, NOT ALARMING. Neither outcome here is an error: one is the app
          declining to guess at her answers, the other is her having answered
          nothing. check-save-says-what-it-did.mjs caught this written in the
          danger colour, which is exactly what it exists to prevent - colouring
          care as breakage teaches somebody that using the app properly looks
          like using it wrong. */}
      {notSaved && !failed && (
        <ThemedText type="small" themeColor="textSecondary">
          {notSaved}
        </ThemedText>
      )}
      {failed && (
        <ThemedText type="small" themeColor="danger">
          {SKILL_SCREEN.error}
        </ThemedText>
      )}

      <ThemedText type="small" themeColor="textSecondary">
        {SKILL_SCREEN.footer}
      </ThemedText>
    </OnboardingQuestion>
  );
}

const styles = StyleSheet.create({
  ideasLabel: { textTransform: 'uppercase', letterSpacing: 0.8 },
  ideas: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  idea: {
    borderRadius: ButtonRadius,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  entry: {
    borderWidth: 1,
    borderRadius: ButtonRadius,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    fontSize: 16,
  },
  group: { gap: Spacing.two },
  pressed: { opacity: 0.6 },
});
