import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { OnboardingQuestion } from '@/components/onboarding-question';
import { useOnboardingAction } from '@/components/onboarding-action';
import { TapChoices } from '@/components/tap-choices';
import { ThemedText } from '@/components/themed-text';
import { advanceOnboardingStep } from '@/lib/onboarding-step';
import {
  HRT_OPTIONS,
  LIFE_STAGES,
  NO_PERIODS_REASONS,
  type Hrt,
  type LifeStage,
  type NoPeriodsReason,
} from '@/lib/life-stage';
import { supabase } from '@/lib/supabase';

// SCREEN 3: WHERE SHE IS WITH PERIODS.
//
// THE NINTH OPTION IS WHY THIS SCREEN EXISTS IN THIS SHAPE. Ruth added "I don't
// have periods for another reason" on 28 September, and it catches the woman
// every app in this market gets wrong: a coil, or a hysterectomy with the
// ovaries kept, means no bleeding and a body that is still cycling. She fits
// none of the other eight, so she picks post-menopause or not sure, and both
// are wrong in a way that changes how her weight, her symptoms and her whole
// record are read.
//
// NEVER INFER MENOPAUSE FROM ABSENT PERIODS. Her rule, and the reason
// stageForReasoning() returns null for that branch: the app knows she has no
// periods and knows nothing about her menopause status, and those are two
// different facts.
//
// EVERY QUESTION IS SKIPPABLE AND "PREFER NOT TO SAY" IS ALWAYS THERE. This is
// the most personal screen in onboarding and it is the one most likely to be
// the moment somebody decides the app is too nosy. It asks once, it explains
// what the answer changes, and it takes no for an answer.

const QUESTION = 'Where are you with periods?';
const SUBTITLE =
  'This changes how your weight is read and how your cycle is talked about. Skip it if you would rather, and change it any time.';

const REASON_QUESTION = 'Which of these is closest?';
const HRT_QUESTION = 'Are you taking HRT?';
const HRT_WHY = 'So a monthly bleed on sequential HRT is not read as a cycle.';

export default function LifeStageScreen() {
  const [stage, setStage] = useState<LifeStage | null>(null);
  const [reason, setReason] = useState<NoPeriodsReason | null>(null);
  const [hrt, setHrt] = useState<Hrt | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) advanceOnboardingStep(supabase, user.id, 'health_context');
    });
  }, []);

  async function save(): Promise<boolean> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase
      .from('user_profile')
      .update({
        life_stage: stage,
        // The detail only belongs to the branch that asked for it. Leaving a
        // stale "coil" on a profile that later says "regular" would be a fact
        // about her that nothing on screen could explain.
        life_stage_detail: stage === 'no_periods_other' ? reason : null,
        hrt,
      })
      .eq('user_id', user.id);
    return !error;
  }

  async function goOn(skipping: boolean) {
    if (saving) return;
    setFailed(false);
    if (skipping) {
      router.push('/onboarding/activities');
      return;
    }
    setSaving(true);
    const ok = await save();
    setSaving(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    router.push('/onboarding/activities');
  }

  useOnboardingAction({
    label: saving ? 'Saving…' : 'Continue',
    enabled: !saving,
    onPress: () => void goOn(false),
    secondary: { label: 'Skip for now', onPress: () => void goOn(true) },
  });

  // THE HRT QUESTION IS NOT ASKED OF SOMEBODY WITH REGULAR PERIODS, because it
  // would change nothing for her and every question that changes nothing is a
  // question that costs trust. It IS asked after "another reason", because a
  // coil and HRT together is an ordinary combination at this age.
  const askHrt = stage !== null && stage !== 'regular' && stage !== 'prefer_not_to_say';

  return (
    <OnboardingQuestion question={QUESTION} subtitle={SUBTITLE}>
      <TapChoices
        options={LIFE_STAGES}
        selected={stage ? [stage] : []}
        onSelect={(key) => {
          setStage(key);
          if (key !== 'no_periods_other') setReason(null);
          if (key === 'regular' || key === 'prefer_not_to_say') setHrt(null);
        }}
      />

      {stage === 'no_periods_other' && (
        <>
          <ThemedText type="small">{REASON_QUESTION}</ThemedText>
          <TapChoices
            options={NO_PERIODS_REASONS}
            selected={reason ? [reason] : []}
            onSelect={setReason}
          />
          {/* SAID OUT LOUD, because it is the whole reason the option exists and
              because a woman who has been told for years that no periods means
              menopause deserves to see an app get it right. */}
          <ThemedText type="small" themeColor="textSecondary">
            No periods does not mean not cycling. Nothing here will assume anything about your
            menopause, and symptoms become the thing worth tracking instead.
          </ThemedText>
        </>
      )}

      {askHrt && (
        <>
          <ThemedText type="small">{HRT_QUESTION}</ThemedText>
          <TapChoices options={HRT_OPTIONS} selected={hrt ? [hrt] : []} onSelect={setHrt} />
          <ThemedText type="small" themeColor="textSecondary">
            {HRT_WHY}
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
