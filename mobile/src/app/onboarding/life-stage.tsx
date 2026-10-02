import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { OnboardingQuestion } from '@/components/onboarding-question';
import { SetupTextField } from '@/components/setup-text-field';
import { useOnboardingAction } from '@/components/onboarding-action';
import { TapChoices } from '@/components/tap-choices';
import { ThemedText } from '@/components/themed-text';
import { advanceOnboardingStep } from '@/lib/onboarding-step';
import {
  HORMONE_USE_OPTIONS,
  LIFE_STAGES,
  NO_PERIODS_REASONS,
  hrtFromHormoneUse,
  toggleHormoneUse,
  type HormoneUse,
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

// QUESTION 6 OF 7: A LITTLE ABOUT YOUR BODY. Her approved preview's heading and
// subtitle, which cover three things rather than one - periods, hormones, and
// anything she takes regularly. The old heading named only the first.
const QUESTION = 'A little about your body';
const SUBTITLE = 'All optional. It helps make sense of your week. Skip any of it, or all of it.';

const PERIODS_HEADING = 'Periods';
const HORMONES_HEADING = 'Hormones';
const TAKES_HEADING = 'Anything you take regularly?';
const TAKES_LABEL = 'Medication or supplements';
const TAKES_PLACEHOLDER = 'In your own words';
// HER WORDING, AND THE SECOND SENTENCE IS NOT BOILERPLATE. A box that accepts a
// drug list has to say what the app will and will not do with it; the Medications
// rule in the chat prompt says the same thing to the model.
const TAKES_NOTE =
  'Kept in Me exactly as you type it. Selod\u00eda is not a medical service and does not replace advice from your doctor. Edit or remove it any time.';

const REASON_QUESTION = 'Which of these is closest?';
const USE_QUESTION = 'Are you using any of these?';
const USE_WHY =
  'So a monthly bleed on HRT or the pill is not read as a natural cycle. Tick anything that applies.';

export default function LifeStageScreen() {
  const [stage, setStage] = useState<LifeStage | null>(null);
  const [reason, setReason] = useState<NoPeriodsReason | null>(null);
  const [use, setUse] = useState<HormoneUse[]>([]);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  /** Her own words for what she takes. Saved as typed, no model, no confirm. */
  const [takes, setTakes] = useState('');
  const [takesState, setTakesState] = useState<'saving' | 'saved' | 'failed' | null>(null);
  /** Already on the Medications card, so a redo shows what is there. */
  const [taking, setTaking] = useState<string[]>([]);

  // ITEM 4: A REDO OPENS ON HER ANSWERS. This screen showed blank chips to
  // somebody who had already answered, which on the most personal screen in
  // setup reads as the app having forgotten - and combined with the save guard
  // below meant a redo could look like it had lost her menopause answer.
  useEffect(() => {
    let live = true;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      advanceOnboardingStep(supabase, user.id, 'life_stage');

      const [{ data: profile }, { data: card }] = await Promise.all([
        supabase
          .from('user_profile')
          .select('life_stage, life_stage_detail, hormone_use')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('almanac_entries')
          .select('content')
          .eq('user_id', user.id)
          .eq('kind', 'me')
          .eq('title', 'Medications')
          .maybeSingle(),
      ]);
      if (!live) return;
      if (profile?.life_stage) setStage(profile.life_stage as LifeStage);
      if (profile?.life_stage_detail) setReason(profile.life_stage_detail as NoPeriodsReason);
      if (Array.isArray(profile?.hormone_use)) setUse(profile.hormone_use as HormoneUse[]);
      const items = (card?.content as { items?: { name?: string }[] })?.items;
      setTaking(
        Array.isArray(items) ? items.map((i) => String(i?.name ?? '')).filter(Boolean) : []
      );
      setLoaded(true);
    })();
    return () => {
      live = false;
    };
  }, []);

  /**
   * WHAT SHE TAKES, STRAIGHT ONTO THE MEDICATIONS CARD, EXACTLY AS TYPED.
   *
   * Ruth, item 5: "Text boxes in setup save EXACTLY as typed, straight into Me
   * under the right heading, with no chat panel, no model call and no confirm
   * step." Item 6 puts medication here, "in a plain box".
   *
   * THIS REPLACES A CONVERSATION, AND THE EARLIER REASONING FOR THAT CONVERSATION
   * WAS SOUND. medication.tsx read the list back and asked before keeping it,
   * because "75mcg" heard as "75mg" is a thousandfold error sitting quietly in her
   * record. What makes the box safe is that there is no hearing involved: her
   * characters are the stored characters, so there is nothing to mishear and
   * nothing to confirm. The read-back existed to catch a model's transcription,
   * and with the model gone the error it guarded against cannot occur.
   *
   * ONE CARD CALLED Medications, appended to, so two sittings do not make two
   * lists. Chat can still tidy it into items later.
   */
  async function saveTakes() {
    const text = takes.trim();
    if (!text) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setTakesState('saving');

    const { data: existing } = await supabase
      .from('almanac_entries')
      .select('id, content')
      .eq('user_id', user.id)
      .eq('kind', 'me')
      .eq('title', 'Medications')
      .maybeSingle();
    const current = Array.isArray((existing?.content as { items?: unknown })?.items)
      ? ((existing!.content as { items: unknown[] }).items as { name: string }[])
      : [];
    const items = [...current, { name: text, when: null, purpose: null }];

    const { error } = existing
      ? await supabase
          .from('almanac_entries')
          .update({ content: { items }, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
      : await supabase.from('almanac_entries').insert({
          user_id: user.id,
          kind: 'me',
          title: 'Medications',
          category: 'Medications',
          content: { items },
        });
    if (error) {
      setTakesState('failed');
      return;
    }
    setTakesState('saved');
    setTaking((prev) => [...prev, text]);
    setTakes('');
  }

  async function save(): Promise<boolean> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    // NOTHING SELECTED CHANGES NOTHING (1 October 2026).
    //
    // The same shape as the week wipe found the same evening: with no chip
    // tapped this wrote life_stage: null, hormone_use: [] and hrt: null over
    // whatever was there - so walking through a redo to review the wording would
    // have erased her menopause and hormone answers without touching a control.
    //
    // It had not bitten yet, only because life-stage is reached from "Add more
    // about you" rather than from the main chain. That is luck, not a design,
    // and the redo now starts at step 3 so she will walk past far more of these.
    //
    // A deliberate "prefer not to say" is a real answer and is NOT this: it sets
    // `stage` to that value and saves normally. This is the untouched screen.
    if (stage === null && use.length === 0) return true;
    const { error } = await supabase
      .from('user_profile')
      .update({
        life_stage: stage,
        // The detail only belongs to the branch that asked for it. Leaving a
        // stale "coil" on a profile that later says "regular" would be a fact
        // about her that nothing on screen could explain.
        life_stage_detail: stage === 'no_periods_other' ? reason : null,
        hormone_use: use,
        // Derived and kept in step, so everything written before this column
        // existed keeps working without a migration at ten at night.
        hrt: hrtFromHormoneUse(use),
      })
      .eq('user_id', user.id);
    return !error;
  }

  async function goOn(skipping: boolean) {
    if (saving) return;
    setFailed(false);
    if (skipping) {
      router.push('/onboarding/first-draft');
      return;
    }
    setSaving(true);
    const ok = await save();
    setSaving(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    router.push('/onboarding/first-draft');
  }

  useOnboardingAction({
    label: saving ? 'Saving…' : 'Continue',
    enabled: !saving && loaded,
    onPress: () => void goOn(false),
    secondary: { label: 'Skip this question', onPress: () => void goOn(true) },
  });

  // IT IS NOW ASKED OF EVERYBODY, AND THAT IS A REVERSAL (30 September 2026).
  //
  // This used to skip the question for anybody with regular periods, on the
  // reasoning that HRT "would change nothing for her and every question that
  // changes nothing is a question that costs trust". Sound, and it was only
  // ever true because the question was about HRT alone.
  //
  // Widening it to contraception breaks that reasoning, and the case it breaks
  // on is the most common one in the country: a woman with regular periods who
  // is on the combined pill. Her bleed is a withdrawal bleed, not a natural
  // cycle, and the app has been reading every one of them as evidence of a
  // cycle it can reason from. The question changes plenty for her; nobody had
  // ever asked it.
  //
  // Ruth's Body Manual draft is what surfaced it, by listing contraception and
  // HRT among the life stages. They are not stages - they combine with one -
  // and separating them is what made the gap visible.

  return (
    <OnboardingQuestion question={QUESTION} subtitle={SUBTITLE}>
      {/* THREE SECTIONS WITH THREE HEADINGS, as her preview has them. The screen
          used to run the period chips, the reason chips and the hormone chips
          together under one question, so a woman tapping Continue could not tell
          which of them she had answered. */}
      <ThemedText type="small" themeColor="textSecondary" style={styles.eyebrow}>
        {PERIODS_HEADING}
      </ThemedText>
      <TapChoices
        options={LIFE_STAGES}
        selected={stage ? [stage] : []}
        onSelect={(key) => {
          setStage(key);
          if (key !== 'no_periods_other') setReason(null);
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

      <ThemedText type="small" themeColor="textSecondary" style={styles.eyebrow}>
        {HORMONES_HEADING}
      </ThemedText>
      <ThemedText type="small">{USE_QUESTION}</ThemedText>
      <TapChoices
        options={HORMONE_USE_OPTIONS}
        selected={use}
        onSelect={(key) => setUse((current) => toggleHormoneUse(current, key))}
      />
      <ThemedText type="small" themeColor="textSecondary">
        {USE_WHY}
      </ThemedText>

      {/* ANYTHING SHE TAKES REGULARLY, in a plain box (Ruth, item 6). This
          replaces the chat panel on medication.tsx - see saveTakes() for why a
          box is safe where a conversation was needed: there is no transcription
          to get wrong, so there is nothing to read back. */}
      <ThemedText type="small" themeColor="textSecondary" style={styles.eyebrow}>
        {TAKES_HEADING}
      </ThemedText>
      <SetupTextField
        label={TAKES_LABEL}
        placeholder={TAKES_PLACEHOLDER}
        value={takes}
        onChangeText={(t) => {
          setTakes(t);
          setTakesState(null);
        }}
        onSave={() => void saveTakes()}
        saving={takesState === 'saving'}
        saved={takesState === 'saved'}
        failed={takesState === 'failed'}
      />
      {taking.length > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          Already kept: {taking.join('; ')}
        </ThemedText>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        {TAKES_NOTE}
      </ThemedText>

      {failed && (
        <ThemedText type="small" themeColor="danger">
          That didn&apos;t save. Check your connection and try again.
        </ThemedText>
      )}
    </OnboardingQuestion>
  );
}

const styles = StyleSheet.create({
  eyebrow: { textTransform: 'uppercase', letterSpacing: 0.8 },
});
