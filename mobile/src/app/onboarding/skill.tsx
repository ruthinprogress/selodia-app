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
    const ladder = LADDERS.find((l) => l.key === ladderKey);
    if (!ladder || !placement) return true; // nothing chosen is a valid answer

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
      })
      .select('id')
      .single();
    if (error || !skill) return false;

    const rungs = placeRungs(ladder, placement).map((rung, i) => ({
      skill_id: (skill as { id: string }).id,
      user_id: user.id,
      name: rung.name,
      stage: rung.stage,
      target: rung.target ?? null,
      needs: rung.needs ?? null,
      detail: rung.detail ?? null,
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
