import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { OnboardingQuestion } from '@/components/onboarding-question';
import { useOnboardingAction } from '@/components/onboarding-action';
import { TapChoices } from '@/components/tap-choices';
import { ThemedText } from '@/components/themed-text';
import { advanceOnboardingStep } from '@/lib/onboarding-step';
import { CLIP_GAPS, LADDERS, placeRungs, type Placement } from '@/lib/skill-ladders';
import { supabase } from '@/lib/supabase';

// SCREEN 2: WHICH SKILL, AND WHERE SHE IS WITH IT.
//
// ONLY LADDERS THE LIBRARY CAN SHOW ARE OFFERED, which is Ruth's constraint and
// which turned out to cut deeper than expected. The 923-clip library has no
// handstand, no muscle up, no scapular pull and no dead hang, so her own joy
// track cannot be offered here. The three that CAN be shown end to end are.
//
// THE MISSING ONES ARE NAMED RATHER THAN HIDDEN. A list of three skills with no
// explanation reads as a thin app; the same list with "more are coming, and
// here is what is being drawn" reads as an honest one. It also means the gap
// list is in front of a real person rather than only in a script's output.
//
// PLACEMENT DECIDES THE FIRST NOW AND NEXT and nothing else. There is no
// timeframe anywhere in this, per the brief.

const QUESTION = 'Is there something you would like to be able to do?';
const SUBTITLE = 'Skip this if not. It can be added any time by saying so in chat.';

const PLACEMENTS: { key: Placement; label: string; hint?: string }[] = [
  { key: 'starting', label: 'Just starting' },
  { key: 'some', label: 'Some of it' },
  { key: 'nearly', label: 'Nearly there' },
];

export default function SkillScreen() {
  const [ladderKey, setLadderKey] = useState<string | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) advanceOnboardingStep(supabase, user.id, 'skill');
    });
  }, []);

  async function save(): Promise<boolean> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    // WHY SPLITS DID NOT SAVE (Ruth, 2 October 2026; diagnosed by reading this
    // line, then confirmed against the schema and the policies).
    //
    // This said:
    //
    //   if (!ladder || !placement) return true; // nothing chosen is a valid answer
    //
    // TWO DIFFERENT STATES, COLLAPSED INTO ONE, and the comment only described
    // the harmless one. "No skill chosen" is genuinely nothing to save. "Splits
    // chosen, no placement" is a real answer - and it was dropped, with `true`
    // returned, so the screen reported success and moved on. She tapped Splits,
    // saw no error, and nothing was written.
    //
    // WHY SPLITS SPECIFICALLY. "Where are you with it?" only appears once a skill
    // is chosen, and it renders BELOW the chips and below a paragraph of
    // explanation. Splits is the last chip in the list, so choosing it pushes
    // that question furthest down the screen - on a phone, below the fold. The
    // chip highlighted, the screen looked answered, and the second question was
    // off-screen.
    //
    // IT IS NOT THE DATABASE. I checked before changing anything: target, needs,
    // detail and clip_match_key are all nullable, sort_order defaults to 0 on
    // both tables, and `manage_own` covers ALL commands on both. A failed insert
    // would also have returned false and shown "That didn't save", which she did
    // not see.
    //
    // THE FIX IS TWO PARTS. The question now sits directly under the chosen chip
    // so it cannot be missed, and an unanswered placement no longer discards her
    // answer: it saves at the bottom of the ladder, which is what "I didn't say"
    // most plainly means and the only reading that claims nothing about her. The
    // screen says which rung that is, so it is a stated default and not a guess
    // made quietly.
    const ladder = LADDERS.find((l) => l.key === ladderKey);
    if (!ladder) return true; // nothing chosen is a valid answer
    const where: Placement = placement ?? 'starting';

    // Replaced rather than merged, for the same reason the goals are: coming
    // back through onboarding means the new answer, not both answers.
    await supabase.from('user_skills').delete().eq('user_id', user.id).eq('ladder_key', ladder.key);

    const { data: skill, error } = await supabase
      .from('user_skills')
      .insert({
        user_id: user.id,
        ladder_key: ladder.key,
        name: ladder.name,
        dimension: ladder.dimension,
        // The whole-ladder guidance, e.g. her breathing note. Not a rule.
        ladder_note: ladder.note ?? null,
      })
      .select('id')
      .single();
    if (error || !skill) return false;

    const rungs = placeRungs(ladder, where).map((rung, i) => ({
      skill_id: (skill as { id: string }).id,
      user_id: user.id,
      name: rung.name,
      stage: rung.stage,
      target: rung.target ?? null,
      needs: rung.needs ?? null,
      detail: rung.detail ?? null,
      develops: rung.develops ?? null,
      cue: rung.cue ?? null,
      clip_match_key: rung.clip,
      sort_order: i,
    }));
    const { error: rungError } = await supabase.from('user_skill_rungs').insert(rungs);
    return !rungError;
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
    secondary: { label: 'Skip this question', onPress: () => void goOn(true) },
  });

  return (
    <OnboardingQuestion question={QUESTION} subtitle={SUBTITLE}>
      <TapChoices
        options={LADDERS.map((l) => ({ key: l.key, label: l.name }))}
        selected={ladderKey ? [ladderKey] : []}
        onSelect={(key) => {
          setLadderKey(key);
          setPlacement(null);
        }}
      />

      {/* DIRECTLY UNDER THE CHIPS, ABOVE THE STANDING NOTE. It used to sit
          below a four-line paragraph, which on a phone put it off the bottom
          of the screen for the last chip in the list - Splits. The chip
          highlighted, the screen looked answered, and the second question was
          never seen. A follow-up question belongs against the answer it
          follows, not after the page's explanatory text. */}
      {ladderKey && (
        <>
          <ThemedText type="small">Where are you with it?</ThemedText>
          <TapChoices
            options={PLACEMENTS}
            selected={placement ? [placement] : []}
            onSelect={setPlacement}
          />
          <ThemedText type="small" themeColor="textSecondary">
            This sets where you start, not how long anything should take. There are no dates on any
            of it.
          </ThemedText>
          {/* SAID RATHER THAN ASSUMED. Leaving this unanswered used to throw the
              whole skill away silently - see the note in save(). It now starts at
              the bottom, and she is told that before she presses Continue, so a
              default she did not choose is never also a default she cannot see. */}
          {!placement && (
            <ThemedText type="small" themeColor="textSecondary">
              Leave this and it starts from the beginning.
            </ThemedText>
          )}
        </>
      )}

      {/* THE LIST AND THE NOTE HAVE TO AGREE (Ruth, 1 October 2026, finding 2).
          Two wrong versions in one day, both caught by her on the phone:

          "nothing is offered here until it can actually be demonstrated" - true
          of this list and reading as a promise about Skills as a whole, while
          chat is being given the ability to add a skill with no clip at all.

          then "these are the ones with a demonstration drawn" - which is simply
          false. Muscle up and Dead hang are BOTH in LADDERS and in CLIP_GAPS:
          offered here, and not yet drawn. She spotted her own muscle up in a
          list the note said was fully illustrated.

          ONE IS THE POINT, which she confirmed: this screen shows how Selodía
          uses Skills rather than collecting them all. The note says that, says
          the clips are still coming without claiming which, and promises
          nothing about the rest of the app.

          NO EM DASH (finding 3). Screen copy does not use them. */}
      <ThemedText type="small" themeColor="textSecondary">
        One is enough here. This is just to show how Skills work. Some of these do not have a
        demonstration drawn yet, and {CLIP_GAPS.length} movements are still being made. Anything
        else can be added later by saying so in chat.
      </ThemedText>


      {failed && (
        <ThemedText type="small" themeColor="danger">
          That didn&apos;t save. Check your connection and try again.
        </ThemedText>
      )}
    </OnboardingQuestion>
  );
}
