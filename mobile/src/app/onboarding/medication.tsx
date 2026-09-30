import { router } from 'expo-router';
import { useState } from 'react';

import { OnboardingQuestion } from '@/components/onboarding-question';
import { useOnboardingAction } from '@/components/onboarding-action';
import { TapChoices } from '@/components/tap-choices';
import { ThemedText } from '@/components/themed-text';

// BODY MANUAL: ANYTHING YOU TAKE REGULARLY.
//
// Ruth, 30 September 2026: "Medication often changes how the body behaves and
// how health data should be interpreted... The AI extracts medication, possible
// nutritional considerations, possible movement considerations, potential
// monitoring opportunities. The user confirms the interpretation."
//
// THE GAP THIS CLOSES, named in her own proposal a day earlier: "HRT is asked
// on Screen 3 and stored. No other medication is. So the app knows about the
// one medication most likely to change how a reading should be read, and
// nothing else. That asymmetry is fine as a starting point and would be strange
// as a resting state, because the first woman on a beta blocker whose heart
// rate the app comments on will notice."
//
// THIS SCREEN SAVES NOTHING, and that is the same decision steer-around.tsx
// made for clinical constraints, for the same reason and with more force here.
// A tap on a chip labelled "yes, a few things" is not consent to anything,
// because the app has no idea WHAT. And a medication list is the point at which
// an interpretation can be confidently wrong: levothyroxine and a statin and a
// GLP-1 medication each change what a reasonable suggestion looks like, and
// getting that wrong quietly is worse than not knowing.
//
// So it opens the conversation, where she says it in her own words, the app
// reads its understanding back, and she confirms before any of it is kept. That
// is the route the Me tab already uses and the only one in this app where a
// structured fact is ever written from prose.
//
// A NOTE ABOUT THE PAPERWORK, because it was a live question tonight. Ruth's
// call, 30 September: build it, then update the privacy policy, DPIA and Play
// Data Safety form. She is the data controller and the data subject on her own
// account, so nothing blocks this today. The gate is the FIRST INVITATION -
// medication is special category data and the three documents must be right
// before anybody else's reaches the database. Recorded in the spec rather than
// left to memory.

const QUESTION = 'Anything you take regularly?';
const SUBTITLE =
  'Medication or supplements. It changes how Selodía reads what your body is doing, so it is worth saying - and nothing is kept until you have seen it written down and agreed.';

type OptionKey = 'yes' | 'nothing' | 'skip';

const OPTIONS: { key: OptionKey; label: string; hint?: string }[] = [
  {
    key: 'yes',
    label: 'Yes, a few things',
    hint: 'Prescribed, over the counter, or supplements',
  },
  { key: 'nothing', label: 'Nothing right now' },
  { key: 'skip', label: 'Rather not say' },
];

const NEXT = '/onboarding/first-draft' as const;

export default function MedicationScreen() {
  const [choice, setChoice] = useState<OptionKey | null>(null);

  function goOn() {
    if (choice === 'yes') {
      // INTO CHAT WITH THE QUESTION ALREADY ASKED, so she is answering rather
      // than working out how to begin. The sentence is hers to finish, which is
      // why it does not auto-send.
      router.push({
        pathname: '/',
        params: {
          prefill: 'These are the things I take regularly: ',
          fromOnboarding: '1',
        },
      });
      return;
    }
    router.push(NEXT);
  }

  useOnboardingAction({
    label: 'Continue',
    enabled: true,
    onPress: goOn,
    secondary: { label: 'Skip for now', onPress: () => router.push(NEXT) },
  });

  return (
    <OnboardingQuestion question={QUESTION} subtitle={SUBTITLE}>
      <TapChoices
        options={OPTIONS}
        selected={choice ? [choice] : []}
        onSelect={(key) => setChoice(key as OptionKey)}
      />

      {choice === 'yes' && (
        <ThemedText type="small" themeColor="textSecondary">
          The next screen is chat. Say them however you like - brand names, doses, or just what it
          is for. Selodía will read back what it understood and ask you before keeping any of it.
        </ThemedText>
      )}

      {choice === 'nothing' && (
        <ThemedText type="small" themeColor="textSecondary">
          That is fine, and it can change. Say so in chat whenever it does.
        </ThemedText>
      )}

      {choice === 'skip' && (
        <ThemedText type="small" themeColor="textSecondary">
          Nothing is assumed from that. Selodía will simply not take medication into account,
          because it has not been told about any.
        </ThemedText>
      )}
    </OnboardingQuestion>
  );
}
