import { router } from 'expo-router';
import { useState } from 'react';

import { OnboardingQuestion } from '@/components/onboarding-question';
import { useOnboardingAction } from '@/components/onboarding-action';
import { TapChoices } from '@/components/tap-choices';
import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';

// SCREEN 6: HOW WOULD YOU LIKE TO BE LED?
//
// TWO ANSWERS, ONE SETTING, CHANGEABLE ANY TIME. Ruth's brief, and the wording
// below is close to hers: "Guide me: a planned week, with reminders if you want
// them. Let me lead: a rhythm to work with, the app stays quiet until asked."
//
// NEITHER ANSWER IS THE RECOMMENDED ONE. There is no "(recommended)", no
// pre-selection, and the order is not a ranking - Guide me is first because it
// is the one that needs more explaining, not because it is better. An app for
// women who have been told what to do by every other app in this category
// should be careful about which answer it appears to want.
//
// REMINDERS ARE NOT TURNED ON HERE, and nothing in this build sends one. They
// are off until chosen, one nudge with no chasing, and every notification
// string goes to Ruth for review before a single one is wired. Slice 6.

const QUESTION = 'How would you like to be led?';
const SUBTITLE = 'Either is fine, and you can switch whenever you like.';

const OPTIONS = [
  {
    key: 'guide_me',
    label: 'Guide me',
    hint: 'A planned week, with reminders if you want them',
  },
  {
    key: 'let_me_lead',
    label: 'Let me lead',
    hint: 'A rhythm to work with. Selodía stays quiet until you ask',
  },
] as const;

type Mode = (typeof OPTIONS)[number]['key'];

export default function GuidanceScreen() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function goOn(skipping: boolean) {
    if (saving) return;
    setFailed(false);
    if (skipping || !mode) {
      router.push('/onboarding/first-draft');
      return;
    }
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = user
      ? await supabase.from('user_profile').update({ guidance_mode: mode }).eq('user_id', user.id)
      : { error: new Error('no user') };
    setSaving(false);
    if (error) {
      setFailed(true);
      return;
    }
    router.push('/onboarding/first-draft');
  }

  useOnboardingAction({
    label: saving ? 'Saving…' : 'Continue',
    enabled: !saving,
    onPress: () => void goOn(false),
    secondary: { label: 'Skip for now', onPress: () => void goOn(true) },
  });

  return (
    <OnboardingQuestion question={QUESTION} subtitle={SUBTITLE}>
      <TapChoices options={OPTIONS} selected={mode ? [mode] : []} onSelect={setMode} />

      {mode === 'guide_me' && (
        <ThemedText type="small" themeColor="textSecondary">
          Today will show one line on the days you have something planned. Reminders stay off until
          you turn them on, and there is only ever one. Nothing chases you.
        </ThemedText>
      )}

      {mode === 'let_me_lead' && (
        <ThemedText type="small" themeColor="textSecondary">
          Your week is there when you want it, and nothing will appear on Today unless you ask.
        </ThemedText>
      )}

      {failed && (
        <ThemedText type="small" themeColor="danger">
          That didn&apos;t save. Check your connection and try again.
        </ThemedText>
      )}
    </OnboardingQuestion>
  );
}
