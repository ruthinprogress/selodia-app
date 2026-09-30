import { router } from 'expo-router';
import { useState } from 'react';

import { OnboardingQuestion } from '@/components/onboarding-question';
import { useOnboardingAction } from '@/components/onboarding-action';
import { TapChoices } from '@/components/tap-choices';
import { ThemedText } from '@/components/themed-text';

// SCREEN 5: ANYTHING TO STEER AROUND?
//
// THIS SCREEN DELIBERATELY SAVES NOTHING. It is a signpost, not a form.
//
// A clinical constraint is the most consequential thing anybody tells this app:
// it removes movements from her sessions in code from then on. Ruth's rule is
// that chat never saves a rule silently, it confirms first - and a tap on a
// chip labelled "an injury or condition" is not consent to anything, because
// the app has no idea yet WHAT to exclude.
//
// So the answer here opens the conversation where the real answer can be given,
// understood, and confirmed. Tapping a chip and being told "noted" would be the
// worst possible outcome: she would believe the app knew about her shoulder.
//
// THE LETTER UPLOAD IS NOT MENTIONED ANYWHERE ON THIS SCREEN, and that is a
// decision rather than an omission (Ruth, 29 September 2026).
//
// Accepting clinical letters needs the Play Data Safety form and the privacy
// policy changed first - both currently say files are not collected - and
// letters carry far more than the constraints: NHS numbers, addresses,
// clinicians' names. Until those two documents change there is nothing to
// upload to.
//
// SO THE COPY PROMISES ONLY WHAT EXISTS. An "or upload the letter" that opens
// nothing is worse than no offer at all: she would put the screen down
// believing the app had her surgeon's instructions, and it would build her a
// session that breaks them.

const QUESTION = 'Anything to steer around?';
const SUBTITLE =
  'An old injury, a condition, something a clinician has told you to avoid. Tell chat. Anything you name stays out of your sessions.';

const OPTIONS = [
  {
    key: 'injury',
    label: 'An injury or a condition',
    hint: 'Something your body will not thank you for',
  },
  {
    key: 'clinician',
    label: 'Advice from a clinician',
    hint: 'A surgeon, a physio, a GP',
  },
  { key: 'nothing', label: 'Nothing right now' },
] as const;

type OptionKey = (typeof OPTIONS)[number]['key'];

export default function SteerAroundScreen() {
  const [choice, setChoice] = useState<OptionKey | null>(null);

  function goOn() {
    if (choice === 'injury' || choice === 'clinician') {
      // STRAIGHT INTO CHAT, with the question already asked. The rule gets
      // written down when she has said what it is and confirmed it, which is
      // the only point at which the app knows enough to write one.
      router.push({
        pathname: '/',
        params: {
          prefill:
            choice === 'clinician'
              ? "There's something a clinician has told me to avoid."
              : "There's something I need to steer around.",
          askNow: '1',
        },
      });
      return;
    }
    router.push('/onboarding/medication');
  }

  useOnboardingAction({
    label: choice === 'injury' || choice === 'clinician' ? 'Tell Selodía' : 'Continue',
    enabled: true,
    onPress: goOn,
    secondary: { label: 'Skip for now', onPress: () => router.push('/onboarding/medication') },
  });

  return (
    <OnboardingQuestion question={QUESTION} subtitle={SUBTITLE}>
      <TapChoices options={OPTIONS} selected={choice ? [choice] : []} onSelect={setChoice} />

      {(choice === 'injury' || choice === 'clinician') && (
        <ThemedText type="small" themeColor="textSecondary">
          Tell Selodía what it is in your own words. It will read it back to you and ask you to
          confirm before anything is kept, because this is the one thing it will never assume.
        </ThemedText>
      )}

      {choice === 'nothing' && (
        <ThemedText type="small" themeColor="textSecondary">
          That is fine, and it can change. Say so in chat whenever it does.
        </ThemedText>
      )}
    </OnboardingQuestion>
  );
}
