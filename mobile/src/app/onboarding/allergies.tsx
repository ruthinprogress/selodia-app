import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { OnboardingQuestion } from '@/components/onboarding-question';
import { useOnboardingAction } from '@/components/onboarding-action';
import { TapChoices } from '@/components/tap-choices';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import {
  ALLERGY_BY_NAME,
  DIETARY_NEEDS,
  FOOD_ALLERGIES,
  OTHER_REACTIONS,
} from '@/lib/allergy-options';
import { supabase } from '@/lib/supabase';

// ANYTHING YOU CANNOT EAT, OR WOULD RATHER NOT.
//
// WHY THIS SCREEN HAD TO EXIST BEFORE THE MERGE. The conversational
// health-context step used to be the only way an allergy ever reached the
// database, and the tap spine took it out of the chain. Two things depend on
// that data and both would have failed silently:
//
//   the ALLERGY GATE, which is a four-layer safety mechanism that cannot
//   protect anybody from an allergy it has never been told about; and
//
//   MEAL SUGGESTIONS, which would cheerfully have offered a vegetarian a
//   chicken salad and a coeliac a sandwich.
//
// Neither would have thrown an error. The app would simply have been confidently
// wrong at somebody, which is this project's most expensive failure shape.
//
// IT WRITES WHERE THE GATE READS - the `allergies` table, through the same
// recorder the chat route uses, with the same upsert on (user_id, name). There
// is no second store and no syncing, because two places holding the same fact
// is how they come to disagree.
//
// THE LIST IS A SHORTCUT, NOT A VOCABULARY. "Something else" opens chat, where
// anything can be said in her own words. See lib/allergy-options.ts.

const QUESTION = 'Anything you cannot eat, or would rather not?';
const SUBTITLE =
  'This changes every meal Selodía ever suggests. Tap what applies, and say anything else in chat.';

export default function AllergiesScreen() {
  const [chosen, setChosen] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  function toggle(name: string) {
    setChosen((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }

  async function save(): Promise<boolean> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    if (chosen.length === 0) return true;

    const rows = chosen.map((name) => ({
      user_id: user.id,
      name,
      kind: ALLERGY_BY_NAME[name]?.kind ?? 'other',
      // The recorder keeps the raw input beside the name so there is always a
      // record of HOW the app came to believe this. "Chosen in onboarding" is
      // the honest answer here; for chat it is her sentence.
      raw_input: 'Chosen in onboarding',
    }));

    // UPSERT, IGNORING DUPLICATES, exactly as recordAllergies does. Somebody
    // coming back through onboarding must not have her existing allergies
    // wiped and re-added - `disclosed_at` records when the app FIRST learned
    // this, and refreshing it would lose the only thing that column is for.
    //
    // NOTHING IS DELETED HERE EITHER, and that is deliberate rather than an
    // oversight. Unticking something on this screen does not remove it, because
    // an allergy quietly disappearing from a safety list is a far worse failure
    // than one lingering. Removing one is a conversation.
    const { error } = await supabase
      .from('allergies')
      .upsert(rows, { onConflict: 'user_id,name', ignoreDuplicates: true });
    return !error;
  }

  async function goOn(skipping: boolean) {
    if (saving) return;
    setFailed(false);
    if (skipping) {
      router.push('/onboarding/guidance');
      return;
    }
    setSaving(true);
    const ok = await save();
    setSaving(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    router.push('/onboarding/guidance');
  }

  useOnboardingAction({
    label: saving ? 'Saving…' : 'Continue',
    enabled: !saving,
    onPress: () => void goOn(false),
    secondary: { label: 'Skip for now', onPress: () => void goOn(true) },
  });

  return (
    <OnboardingQuestion question={QUESTION} subtitle={SUBTITLE}>
      <ThemedView style={styles.group}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.eyebrow}>
          Food allergies
        </ThemedText>
        <TapChoices options={FOOD_ALLERGIES.map(asChoice)} selected={chosen} onSelect={toggle} multi />
      </ThemedView>

      <ThemedView style={styles.group}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.eyebrow}>
          How you eat
        </ThemedText>
        <TapChoices options={DIETARY_NEEDS.map(asChoice)} selected={chosen} onSelect={toggle} multi />
      </ThemedView>

      <ThemedView style={styles.group}>
        {/* SEPARATE, AND SAID TO BE SEPARATE. A contact or environmental
            reaction is not a food restriction, and treating one as a food
            restriction is exactly what blocked two honest questions about
            nickel in September. The heading is doing real work. */}
        <ThemedText type="small" themeColor="textSecondary" style={styles.eyebrow}>
          Reactions that are not about food
        </ThemedText>
        <TapChoices options={OTHER_REACTIONS.map(asChoice)} selected={chosen} onSelect={toggle} multi />
      </ThemedView>

      {/* NOT A CHIP. "Something else" is not another thing to tick, it is a way
          out of the list entirely, and making it look like an option would
          suggest the list is meant to be complete. It never is. */}
      <ThemedView type="backgroundElement" style={styles.elseCard}>
        <ThemedText type="small">Something else?</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Tell chat in your own words. Anything at all, however unusual, and however you say it.
        </ThemedText>
        <ThemedText
          type="small"
          themeColor="accentDeep"
          accessibilityRole="link"
          accessibilityLabel="Tell chat about something else, opens chat"
          onPress={() =>
            router.push({
              pathname: '/',
              params: {
                prefill: "There's something I can't eat.",
                askNow: '1',
              },
            })
          }>
          Tell chat
        </ThemedText>
      </ThemedView>

      {failed && (
        <ThemedText type="small" themeColor="danger">
          That didn&apos;t save. Check your connection and try again.
        </ThemedText>
      )}

      <ThemedText type="small" themeColor="textSecondary">
        Nothing here is ever removed by unticking it. If something stops applying, say so in chat.
      </ThemedText>
    </OnboardingQuestion>
  );
}

const asChoice = (o: { name: string; label: string }) => ({ key: o.name, label: o.label });

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 0.8 },
  elseCard: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: CardRadius,
    gap: Spacing.one,
  },
});
