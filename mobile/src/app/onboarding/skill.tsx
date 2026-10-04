import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { OnboardingQuestion } from '@/components/onboarding-question';
import { useOnboardingAction } from '@/components/onboarding-action';
import { TapChoices } from '@/components/tap-choices';
import { ThemedText } from '@/components/themed-text';
import { advanceOnboardingStep } from '@/lib/onboarding-step';
import { CLIP_GAPS, LADDERS, placeRungs, type Placement } from '@/lib/skill-ladders';
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
  // ONE QUESTION WHEN SHE CAME FROM HER BODY MANUAL. See lib/one-question.ts:
  // until tonight only goals.tsx read this, so every other row of the Manual
  // opened a step of the seven-question chain and walked her into chat.
  const { fromManual, leave } = useOneQuestion();
  const [ladderKey, setLadderKey] = useState<string | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  // Said when Continue deliberately wrote nothing. Not an error - an outcome.
  const [notSaved, setNotSaved] = useState<string | null>(null);

  // ITEM 4: A REDO OPENS ON WHAT SHE ALREADY CHOSE.
  //
  // Ruth, 2 October 2026: "Pull every current selection from where it is kept
  // (Week, Skills, Me, Goals) and show it selected. Deselecting, deleting or
  // choosing something else OVERWRITES, so nothing duplicates."
  //
  // This screen showed blank chips to somebody who had already answered, and the
  // consequence was not only confusion: walking through a redo and pressing
  // Continue looked like "no skill chosen", which saves nothing and leaves the
  // old skill in place. So the screen disagreed with the database and neither
  // the screen nor she could tell.
  //
  // ONLY HER CURATED SKILL IS SHOWN AS A CHIP. A skill added in chat with no
  // ladder has no chip here, exactly as a French class has no chip on the
  // activities screen, and for the same reason: this screen cannot create it, so
  // it must not appear to own it.
  // THREE STATES, NOT A BOOLEAN. `loaded: false` meant both "not yet" and "it
  // failed", and the second one inherited the treatment built for the first:
  // a dead Continue and no message, forever. See lib/load-state.ts.
  const [loadState, setLoadState] = useState<LoadState>('loading');
  // Bumped by Try again, which re-runs the effect.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    void (async () => {
      setLoadState('loading');
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (live) setLoadState('failed');
        return;
      }
      // A ROW TAPPED ON HER PROFILE IS NOT A STEP OF SETUP. Advancing here
      // moves where the app thinks she is in a flow she finished.
      if (!fromManual) advanceOnboardingStep(supabase, user.id, 'skill');

      const { data: skills, error } = await supabase
        .from('user_skills')
        .select('ladder_key')
        .eq('user_id', user.id)
        .not('ladder_key', 'is', null);
      if (!live) return;
      // A FAILED READ IS SAID OUT LOUD AND DOES NOT TRAP HER. The screen will
      // not write without her answers in hand, and she can retry or carry on.
      if (error) {
        setLoadState('failed');
        return;
      }

      const existing = (skills ?? [])
        .map((r) => String(r.ladder_key))
        .find((key) => LADDERS.some((l) => l.key === key));
      if (existing) setLadderKey(existing);
      setLoadState('ready');
    })();
    return () => {
      live = false;
    };
  }, [attempt]);

  async function save(): Promise<SaveOutcome> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 'failed';
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
    // NOTHING IS WRITTEN WITHOUT HER ANSWERS IN HAND. This is the one property
    // worth keeping from the original design: a blank chip row must never be
    // mistaken for "no skill", which would silently leave an old one in place.
    // THE REFUSAL IS RIGHT; REPORTING IT AS SUCCESS WAS THE BUG. See
    // lib/save-outcome.ts.
    if (!mayWrite(loadState)) {
      void logClientError('setup-save', `skill refused: loadState=${loadState}`);
      return 'not-ready';
    }
    const ladder = LADDERS.find((l) => l.key === ladderKey);
    if (!ladder) return 'nothing-chosen';
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
    if (error || !skill) return 'failed';

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
    return rungError ? 'failed' : 'saved';
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
    if (outcome === 'failed') {
      setFailed(true);
      return;
    }
    // SHE IS NEVER MOVED ON FROM A WRITE THAT DID NOT HAPPEN.
    const message = saveOutcomeMessage(outcome, 'skills');
    if (message) {
      setNotSaved(message);
      return;
    }
    leave('/onboarding/activities');
  }

  useOnboardingAction({
    label: saving ? 'Saving…' : 'Continue',
    // Pressable the moment the read settles, either way. A failed read means
    // this screen does not write on the way past, not that she is stuck on it.
    enabled: mayContinue(loadState, saving),
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


      {/* SAID, RATHER THAN SHOWN AS AN EMPTY SCREEN. For two days a failed read
          here looked identical to having no skills. */}
      {loadState === 'failed' && (
        <>
          <ThemedText type="small" themeColor="danger">
            {LOAD_FAILED_MESSAGE}
          </ThemedText>
          <ThemedText
            type="smallBold"
            themeColor="accentDeep"
            accessibilityRole="button"
            accessibilityLabel={LOAD_RETRY_LABEL}
            onPress={() => setAttempt((n) => n + 1)}>
            {LOAD_RETRY_LABEL}
          </ThemedText>
        </>
      )}

      {failed && (
        <ThemedText type="small" themeColor="danger">
          That didn&apos;t save. Check your connection and try again.
        </ThemedText>
      )}

      {/* A WRITE THAT DELIBERATELY DID NOT HAPPEN SAYS SO. Not an error, so not
          in the danger colour: either the screen refused to guess at her existing
          answers, or she selected nothing. Either way she is told, instead of
          being moved on believing it saved. See lib/save-outcome.ts. */}
      {notSaved && !failed && (
        <ThemedText type="small" themeColor="textSecondary">
          {notSaved}
        </ThemedText>
      )}
    </OnboardingQuestion>
  );
}
