import { useEffect } from 'react';

import { ActivityLevelChoices } from '@/components/activity-level-choices';
import { OnboardingQuestion } from '@/components/onboarding-question';
import { useOnboardingAction } from '@/components/onboarding-action';
import { StepPermissionOffer } from '@/components/step-permission-offer';
import { ACTIVITY_SCREEN } from '@/lib/body-mode';
import { advanceOnboardingStep } from '@/lib/onboarding-step';
import { useOneQuestion } from '@/lib/one-question';
import { supabase } from '@/lib/supabase';

// STEP 3 OF 7: HOW ACTIVE ARE YOU (Ruth, 5 October 2026).
//
// Her order: how your days feel, your approach, how active you are, what you
// already do, something you would like to do, anything to steer around, about
// your body. This sits third because the approach decides what the figure is FOR
// and this decides what it is built on - and the panel on step 2 quotes it, so
// being asked straight afterwards is the first time it means anything.
//
// IT IS NOT A SECOND SCREEN. The question is the same component More renders; see
// components/activity-level-choices.tsx. The level sets the single biggest term in
// her calorie figure, and it has already been derived in two places once.
//
// EVERY TAP SAVES, which is why there is no save on Continue. The choices write
// immediately and show the figure they produce, so Continue only has to move her
// on - and a second write here would be a second opinion about the same answer.

export default function ActivityLevelStep() {
  const { fromManual, leave } = useOneQuestion();

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      if (!fromManual) advanceOnboardingStep(supabase, user.id, 'activity_level');
    })();
  }, [fromManual]);

  useOnboardingAction({
    label: 'Continue',
    enabled: true,
    onPress: () => leave('/onboarding/activities'),
    // SKIPPING IS A REAL ANSWER HERE. Without a level the guide assumes very
    // little movement and says so, which is honest - and better than a number
    // she did not choose, which is the fault this screen was built to end.
    secondary: { label: 'Skip this question', onPress: () => leave('/onboarding/activities') },
  });

  return (
    <OnboardingQuestion question={ACTIVITY_SCREEN.question} subtitle={ACTIVITY_SCREEN.subtitle}>
      <ActivityLevelChoices />
      {/* THE ONLY PLACE SETUP ASKS THE PHONE FOR HER STEPS (10 October 2026).
          It used to be onboarding/equipment, which came out of the flow on 2
          October when nine screens became seven - and the operating-system
          request went with it unnoticed, so no account created since has been
          asked. See components/step-permission-offer.tsx for the whole of it,
          including why ticking the consent box is not the same thing and why
          that made it invisible. */}
      <StepPermissionOffer />
    </OnboardingQuestion>
  );
}
