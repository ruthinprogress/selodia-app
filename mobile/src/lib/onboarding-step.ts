import type { SupabaseClient } from '@supabase/supabase-js';

export const ONBOARDING_STEPS = [
  'not_started',
  'intro',
  'equipment',
  'goals',
  'health_context',
  'technical_targets',
  'nutrition_targets',
  'activity_tdee',
  'complete',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

// Forward-only: a step reached later should never be overwritten by an
// earlier one, e.g. if a user somehow lands back on an earlier screen.
export async function advanceOnboardingStep(
  supabase: SupabaseClient,
  userId: string,
  step: OnboardingStep
) {
  const { data } = await supabase
    .from('user_profile')
    .select('onboarding_step')
    .eq('user_id', userId)
    .maybeSingle();

  const currentIndex = data ? ONBOARDING_STEPS.indexOf(data.onboarding_step as OnboardingStep) : 0;
  const targetIndex = ONBOARDING_STEPS.indexOf(step);
  if (targetIndex <= currentIndex) return;

  await supabase.from('user_profile').upsert({ user_id: userId, onboarding_step: step });
}
