import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { OnboardingQuestion } from '@/components/onboarding-question';
import { SetupTextField } from '@/components/setup-text-field';
import { useOnboardingAction } from '@/components/onboarding-action';
import { TapChoices } from '@/components/tap-choices';
import { ThemedText } from '@/components/themed-text';
import { BODY_NOTES_SCREEN } from '@/lib/body-notes-copy';
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
import {
  LOAD_FAILED_MESSAGE,
  LOAD_RETRY_LABEL,
  mayContinue,
  type LoadState,
} from '@/lib/load-state';
import { useOneQuestion } from '@/lib/one-question';
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

// HER WORDING LIVES IN lib/body-notes-copy.ts, which is the record the matrix
// copies and check-body-notes-copy.mjs compares. Nothing here restates it, and
// that file carries the three things her wording changes besides the words.

export default function LifeStageScreen() {
  // ONE QUESTION WHEN SHE CAME FROM HER BODY MANUAL. See lib/one-question.ts:
  // until tonight only goals.tsx read this, so every other row of the Manual
  // opened a step of the seven-question chain and walked her into chat.
  const { fromManual, leave } = useOneQuestion();
  const [stage, setStage] = useState<LifeStage | null>(null);
  const [reason, setReason] = useState<NoPeriodsReason | null>(null);
  const [use, setUse] = useState<HormoneUse[]>([]);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  // Three states, not a boolean: see lib/load-state.ts. A failed read used to
  // leave this screen with a dead Continue and no message.
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [attempt, setAttempt] = useState(0);
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
      // A SCREEN MUST NEVER SIT ON 'loading' FOREVER (2 October 2026, 21:02).
      //
      // Ruth: "I tried to add to Week via profile and it dragged me through
      // onboarding again but saved nothing. Twice. And ended up in Chat at the
      // end. Twice."
      //
      // `if (!user) return;` left loadState on 'loading', and 'loading' is the
      // one state that disables Continue. So the forward button was dead, the
      // only live control was "Skip this question", and skipping writes nothing
      // and walks her to the next screen - five activities and their cadences
      // discarded without a word, twice over.
      //
      // THIS IS THE DEAD SCREEN OF 1 OCTOBER, IN THE ERROR PATH OF THE MODULE
      // WRITTEN TO END IT. load-state.ts exists because `if (error) return` left
      // five screens blank with a dead button; I moved the error case to three
      // states and left the no-user case returning into the same trap.
      //
      // 'failed' is the honest state: it says so, offers Try again, and lets her
      // past without writing - which is what 'loading' pretended to do while
      // actually just locking the door.
      if (!user) {
        setLoadState('failed');
        return;
      }
      // A ROW TAPPED ON HER PROFILE IS NOT A STEP OF SETUP. Advancing here
      // moves where the app thinks she is in a flow she finished.
      if (!fromManual) advanceOnboardingStep(supabase, user.id, 'life_stage');

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
      setLoadState('ready');
    })();
    return () => {
      live = false;
    };
  }, [attempt]);

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
      leave('/onboarding/first-draft');
      return;
    }
    setSaving(true);
    const ok = await save();
    setSaving(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    leave('/onboarding/first-draft');
  }

  useOnboardingAction({
    label: saving ? 'Saving…' : 'Continue',
    // Pressable once the read settles. This screen's own save guard already
    // treats "nothing selected" as changing nothing, so a failed read cannot
    // overwrite her answers on the way past.
    enabled: mayContinue(loadState, saving),
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
    <OnboardingQuestion
      question={BODY_NOTES_SCREEN.question}
      subtitle={BODY_NOTES_SCREEN.subtitle}>
      {/* THREE SECTIONS WITH THREE HEADINGS, as her preview has them. The screen
          used to run the period chips, the reason chips and the hormone chips
          together under one question, so a woman tapping Continue could not tell
          which of them she had answered. */}
      <ThemedText type="small" themeColor="textSecondary" style={styles.eyebrow}>
        {BODY_NOTES_SCREEN.periodsHeading}
      </ThemedText>
      <ThemedText type="small">{BODY_NOTES_SCREEN.periodsQuestion}</ThemedText>
      <TapChoices
        options={LIFE_STAGES}
        selected={stage ? [stage] : []}
        onSelect={(key) => {
          setStage(key);
          if (key !== 'no_periods_other') setReason(null);
        }}
      />

      {/* HER NOTE, SHOWN ALWAYS (5 October 2026). The screen only said this after
          she had already picked the ninth option, so the woman about to pick the
          wrong one never read it. It is the rule the app follows: see
          stageForReasoning, which returns null rather than a menopause status. */}
      <ThemedText type="small" themeColor="textSecondary">
        {BODY_NOTES_SCREEN.periodsNote}
      </ThemedText>

      {stage === 'no_periods_other' && (
        <>
          <ThemedText type="small">{BODY_NOTES_SCREEN.reasonQuestion}</ThemedText>
          <TapChoices
            options={NO_PERIODS_REASONS}
            selected={reason ? [reason] : []}
            onSelect={setReason}
          />
          {/* ONE SENTENCE THAT ONLY APPLIES HERE, kept because it says what
              happens INSTEAD. Her general note above says the app assumes
              nothing; this says symptoms become the thing worth tracking. */}
          <ThemedText type="small" themeColor="textSecondary">
            Symptoms become the thing worth tracking instead.
          </ThemedText>
        </>
      )}

      <ThemedText type="small" themeColor="textSecondary" style={styles.eyebrow}>
        {BODY_NOTES_SCREEN.hormonesHeading}
      </ThemedText>
      <ThemedText type="small">{BODY_NOTES_SCREEN.hormonesQuestion}</ThemedText>
      <TapChoices
        options={HORMONE_USE_OPTIONS}
        selected={use}
        onSelect={(key) => setUse((current) => toggleHormoneUse(current, key))}
      />
      <ThemedText type="small" themeColor="textSecondary">
        {BODY_NOTES_SCREEN.hormonesNote}
      </ThemedText>

      {/* ANYTHING SHE TAKES REGULARLY, in a plain box (Ruth, item 6). This
          replaces the chat panel on medication.tsx - see saveTakes() for why a
          box is safe where a conversation was needed: there is no transcription
          to get wrong, so there is nothing to read back. */}
      <ThemedText type="small" themeColor="textSecondary" style={styles.eyebrow}>
        {BODY_NOTES_SCREEN.takesHeading}
      </ThemedText>
      <SetupTextField
        label={BODY_NOTES_SCREEN.takesLabel}
        placeholder={BODY_NOTES_SCREEN.takesPlaceholder}
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
          {BODY_NOTES_SCREEN.takesAlreadyLabel} {taking.join('; ')}
        </ThemedText>
      )}
      {/* HER CLOSING LINE. It replaces "Selodía is not a medical service and does
          not replace advice from your doctor", which is still on the Body
          Manual's own row for this and in the privacy policy. See the note at the
          top of lib/body-notes-copy.ts: this is the removal worth a second look,
          because this box is the first place anybody types a drug name. */}
      <ThemedText type="small" themeColor="textSecondary">
        {BODY_NOTES_SCREEN.closing}
      </ThemedText>

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
    </OnboardingQuestion>
  );
}

const styles = StyleSheet.create({
  eyebrow: { textTransform: 'uppercase', letterSpacing: 0.8 },
});
