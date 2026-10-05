import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { OnboardingQuestion } from '@/components/onboarding-question';
import { useOnboardingAction } from '@/components/onboarding-action';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { StyleSheet } from 'react-native';
import { advanceOnboardingStep } from '@/lib/onboarding-step';
import { setRedoing } from '@/lib/redo-setup';
import { supabase } from '@/lib/supabase';

// SCREEN 7: HERE IS YOUR FIRST DRAFT.
//
// IT SHOWS WHAT WAS ACTUALLY WRITTEN DOWN, read back from the database rather
// than from the answers held in memory. That is not belt and braces: if a save
// failed three screens ago, this is the screen that has to be honest about it,
// and a summary built from what she typed would cheerfully show her a week that
// does not exist.
//
// A SECTION WITH NOTHING IN IT SAYS SO. "Nothing yet" beside a section heading
// is the app admitting a gap, which is the same rule the reports follow and the
// same reason: an empty row is honest, a hidden row is not. Skipping every
// question is a perfectly good way to use this app, and the draft should look
// like a calm starting point rather than a scolding.
//
// THE LAST LINE IS THE IMPORTANT ONE. Everything here changes by saying so in
// chat, and the app has just spent a minute asking questions, so it owes her
// the sentence that says none of it is fixed.

const QUESTION = "Here's your first draft";
const SUBTITLE = 'Nothing here is fixed. Change any of it by speaking or typing in chat.';

type Draft = {
  goals: string[];
  week: string[];
  skills: string[];
  rules: string[];
  // GROUPED BY KIND, BECAUSE ONE LIST PUT NICKEL ON HER PLATE.
  //
  // Ruth, item 5 of 2 October: "Allergies grouped by KIND in setup, draft and
  // Me... Nickel and hay fever must not appear under 'your plate'." The draft
  // listed every row in the allergies table under "Staying off your plate",
  // so her nickel and her seasonal allergy were both shown as food she avoids.
  //
  // The setup screen was fixed first and this was the other half: the screen
  // that exists to prove the app heard her correctly was proving the opposite.
  allergiesFood: string[];
  allergiesSkinAir: string[];
  allergiesMedicine: string[];
  targetLine: string | null;
};

/**
 * The stored rows of one or more kinds, in her words, capitalised.
 *
 * A ROW WITH NO KIND COUNTS AS FOOD, matching `filtersFood` on the server: an
 * unexplained allergy is treated as edible, and the draft must describe what
 * the app will do rather than what would read more tidily.
 */
function byKind(rows: unknown, kinds: string[]): string[] {
  const list = Array.isArray(rows) ? (rows as { name?: unknown; kind?: unknown }[]) : [];
  return list
    .filter((r) => kinds.includes(typeof r.kind === 'string' ? r.kind : 'other'))
    .map((r) => String(r.name ?? ''))
    .filter(Boolean)
    .map((name) => name.charAt(0).toUpperCase() + name.slice(1));
}

export default function FirstDraftScreen() {
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // THE STEP IS NOT ADVANCED HERE, and the first version of this screen did
      // advance it here. Marking onboarding complete on mount makes the layout
      // guard redirect a completed user away from onboarding - straight to
      // Chat, before the draft has drawn a single row. The screenshot showed a
      // chat thread where the summary should have been, which is exactly what a
      // real person would have got.
      //
      // It advances when she taps Start, which is also when it is true.

      const [goalsRes, weekRes, rungRes, rulesRes, profileRes, allergyRes] =
        await Promise.all([
        // ONE SOURCE, AND ARCHIVED ONES EXCLUDED (Ruth, 1 October 2026, B2).
        //
        // This read showed her FOUR goals: her current one, "reduce body fat and
        // get back into old jeans" TWICE, and the long sentence that superseded
        // it. Two faults stacked.
        //
        // It did not filter `archived_at`, so a goal she had replaced came back.
        // goals-block.tsx has always filtered it; this screen never did, and two
        // readers of one table with different rules is how that happens.
        //
        // And it CONCATENATED user_goals with user_context, which double-counts
        // every goal: a database trigger already mirrors anything written to
        // user_context into user_goals, precisely so there is one place to read.
        // goals-block.tsx carries the note about why that trigger exists - the
        // same duplicate-goal complaint, fixed there in September and still
        // standing here.
        supabase.from('user_goals').select('label').is('archived_at', null).order('sort_order', { ascending: true }),
        supabase.from('user_week').select('activity, cadence').order('sort_order', { ascending: true }),
        supabase.from('user_skill_rungs').select('name, stage').eq('stage', 'now'),
        supabase.from('user_rules').select('phrase, kind'),
        supabase.from('user_profile').select('fat_focus_state, muscle_focus_state').maybeSingle(),
        supabase.from('allergies').select('name, kind'),
      ]);

      const goals = ((goalsRes.data ?? []) as { label: string }[]).map((g) => g.label);

      const profile = profileRes.data as
        | { fat_focus_state: string | null; muscle_focus_state: string | null }
        | null;

      setDraft({
        goals,
        week: ((weekRes.data ?? []) as { activity: string; cadence: string | null }[]).map((w) =>
          w.cadence ? `${w.activity}, ${w.cadence}` : w.activity
        ),
        skills: ((rungRes.data ?? []) as { name: string }[]).map((r) => r.name),
        rules: ((rulesRes.data ?? []) as { phrase: string; kind: string }[])
          // ONLY EXCLUSIONS BELONG UNDER "Staying out of your sessions".
          // A 'technique' rule is guidance on how to do a move and rules
          // nothing out, so listing it there told her the opposite of what
          // she meant. This filter was already correct; the Valsalva row was
          // stored as 'never' because there was no third kind until today.
          .filter((r) => r.kind === 'never')
          .map((r) => r.phrase),
        // SHOWN BACK IN THE SAME WORDS THEY WERE STORED IN, capitalised only,
        // and UNDER THE HEADING THAT MATCHES THE KIND. A woman who has just told
        // the app she is coeliac should see that it heard her; a woman who said
        // nickel should not be told it is staying off her plate.
        //
        // 'other' sits with food because that is what the food filter does with
        // it - an unexplained allergy is conservatively treated as edible, so the
        // heading says what the app will actually act on.
        allergiesFood: byKind(allergyRes.data, ['food', 'other']),
        allergiesSkinAir: byKind(allergyRes.data, ['contact', 'environmental']),
        allergiesMedicine: byKind(allergyRes.data, ['medicine']),
        // THE TARGETS ARE DESCRIBED, NOT NUMBERED, on this screen. A calorie
        // figure needs a weight and a TDEE, and onboarding has not necessarily
        // got either yet. Saying what has been set is true; printing a number
        // that might be built on nothing is not.
        targetLine:
          profile?.fat_focus_state || profile?.muscle_focus_state
            ? 'Set from your approach. They show on Today.'
            : null,
      });
    })();
  }, []);

  // THE MANUAL IS OFFERED HERE, NOT GATED ON (Ruth, 30 September 2026).
  //
  // Configuration is what onboarding must finish; the Body Manual is what grows
  // afterwards. Her own line: "It doesn't need to be perfect today. Your Manual
  // will grow as your body, health and life change."
  //
  // WHY OFFERING IT BEATS INCLUDING IT. The flow was already thirteen screens
  // and her draft adds free-text health, medication and hormones on top. The
  // failure that risks is not a thin Manual, it is NO Manual - because she put
  // the phone down at screen nine and Version 1 never existed at all. So
  // Configuration ends here, completely, and the three Manual screens sit
  // behind an invitation that can be taken now or in six months.
  //
  // IT IS THE SECONDARY ACTION, deliberately. "Start" is the primary one
  // because finishing is the thing she came to do, and an invitation dressed as
  // the main button would read as four more screens she has to get through.
  useOnboardingAction({
    label: 'Start',
    enabled: true,
    onPress: () => {
      void (async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) await advanceOnboardingStep(supabase, user.id, 'complete');
        // The visit is over, so the door goes with it.
        setRedoing(false);
        // TODAY, NOT CHAT (Ruth, 5 October 2026): "finishing onboarding should
        // take you to the Today Page."
        //
        // '/' is the chat tab. Landing there at the end of setup drops somebody
        // into a conversation at the exact moment the app has just worked out
        // their figures - and Today is where those figures are. The seven
        // questions were answered to make that screen mean something; it should
        // be the first thing they see.
        router.replace('/today');
      })();
    },
    secondary: {
      // THE MANUAL SCREENS ARE STILL THERE, off the chain, for somebody who
      // wants to add more. They are no longer part of the seven.
      label: 'Add more about you',
      onPress: () => router.push('/onboarding/health-context'),
    },
  });

  if (!draft) return <OnboardingQuestion question={QUESTION} subtitle={SUBTITLE}>{null}</OnboardingQuestion>;

  return (
    <OnboardingQuestion question={QUESTION} subtitle={SUBTITLE}>
      <Section title="What you're working towards" items={draft.goals} />
      <Section title="Your week" items={draft.week} />
      <Section title="Working on now" items={draft.skills} />
      <Section title="Staying out of your sessions" items={draft.rules} />
      <Section
        title="Staying off your plate"
        items={draft.allergiesFood}
        emptyNote="Nothing recorded. Say anything in chat and it will show here."
      />
      {/* ONLY WHEN THERE IS SOMETHING. An empty "Skin and air" heading on every
          draft would be listing what is empty, which is the commonest way this
          app has annoyed her. Food keeps its empty note because that section is
          the one the screen exists to prove. */}
      {draft.allergiesSkinAir.length > 0 && (
        <Section title="Skin and air" items={draft.allergiesSkinAir} />
      )}
      {draft.allergiesMedicine.length > 0 && (
        <Section title="Medicines you react to" items={draft.allergiesMedicine} />
      )}
      <Section
        title="Your guide"
        items={draft.targetLine ? [draft.targetLine] : []}
        emptyNote="Choose an approach any time and it will appear."
      />

      <ThemedText type="small" themeColor="textSecondary">
        All of this lives in Plans. It changes whenever you say so.
      </ThemedText>
    </OnboardingQuestion>
  );
}

function Section({
  title,
  items,
  emptyNote,
}: {
  title: string;
  items: string[];
  emptyNote?: string;
}) {
  return (
    <ThemedView style={styles.section}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.heading}>
        {title}
      </ThemedText>
      {items.length === 0 ? (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="small" themeColor="textSecondary">
            {emptyNote ?? 'Nothing yet, and that is fine.'}
          </ThemedText>
        </ThemedView>
      ) : (
        items.map((item) => (
          <ThemedView key={item} type="backgroundElement" style={styles.card}>
            <ThemedText type="small">{item}</ThemedText>
          </ThemedView>
        ))
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  heading: { textTransform: 'uppercase', letterSpacing: 0.8 },
  card: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: CardRadius,
  },
});
