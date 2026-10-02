import { router } from 'expo-router';
import { useState } from 'react';

import { OnboardingQuestion } from '@/components/onboarding-question';
import { useOnboardingAction } from '@/components/onboarding-action';
import { SetupChatPanel } from '@/components/setup-chat-panel';
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
// THE CONVERSATION HAPPENS HERE, ON THIS SCREEN (Ruth, 1 October 2026). It used
// to `router.push('/')` into the Chat tab, which left setup with nothing to
// bring anybody back - and bounced a brand-new user to an older screen entirely,
// because the auth guard sends an unfinished account that lands in the tabs to
// RESUME_ROUTE[step]. Her rule: "setup should never send someone out of the
// flow." See components/setup-chat-panel.tsx.
//
// AND THE PROMISE IS NOW TRUE. This screen has always said "Selodía will read
// back what it understood and ask you before keeping any of it", and until today
// nothing in the server knew what to do with a medication list - no prompt rule,
// no destination. It now goes to a Medications card on the Me tab, offered first
// and written only on a yes, editable afterwards in chat like any other Me card.
// See MEDICATION in reply-prompt.ts and the medication paragraph in the classify
// tool.
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
  const [talking, setTalking] = useState(false);

  function goOn() {
    if (choice === 'yes' && !talking) {
      // THE PANEL OPENS ON THIS SCREEN. No navigation, so there is nothing to
      // come back from.
      setTalking(true);
      return;
    }
    router.push(NEXT);
  }

  useOnboardingAction({
    // THE BUTTON SAYS WHAT IT DOES. "Continue" on a screen that is about to open
    // a conversation is a small lie, and it is the kind that makes somebody
    // stop trusting buttons.
    label: choice === 'yes' && !talking ? 'Tell Selodía' : 'Continue',
    enabled: true,
    onPress: goOn,
    secondary: { label: 'Skip this question', onPress: () => router.push(NEXT) },
  });

  return (
    <OnboardingQuestion question={QUESTION} subtitle={SUBTITLE}>
      <TapChoices
        options={OPTIONS}
        selected={choice ? [choice] : []}
        onSelect={(key) => setChoice(key as OptionKey)}
      />

      {choice === 'yes' && !talking && (
        <ThemedText type="small" themeColor="textSecondary">
          Say them however you like - brand names, doses, or just what each one is for. Selodía
          will read back what it understood and ask you before keeping any of it.
        </ThemedText>
      )}

      {/* DELIBERATE SECOND STEP, and the claim in the copy below is true.

          check-continue-saves.mjs flags any screen that says "nothing is saved
          until..." because that sentence was a lie on the goals screen - it
          promised a Save button for a press that had already saved nothing.
          Here the second step is the CONVERSATION: the panel reads the list
          back and the write happens on her yes, through the confirm-first
          proposal machinery in pending-save.ts. Nothing is stored until she
          answers, so the sentence describes what happens.

          The reason a medication list earns a read-back at all: "75mcg" heard
          as "75mg" is a thousandfold error sitting quietly in her record, and
          this is the one screen where a model is transcribing. The plain box on
          "about your body" needs no read-back precisely because there is no
          transcription - her characters are the stored characters.

          This screen is off the setup chain as of 2 October; it remains
          reachable, so its copy still has to be true. */}
      {choice === 'yes' && talking && (
        <SetupChatPanel
          intro="Selodía will read back what it understood and ask before keeping anything. Nothing is saved until you say yes."
          prefill="These are the things I take regularly: "
          placeholder="Levothyroxine 75mcg each morning, vitamin D in winter…"
          doneLabel="Done - continue"
          onDone={() => router.push(NEXT)}
        />
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
