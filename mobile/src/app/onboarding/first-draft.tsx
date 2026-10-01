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
  allergies: string[];
  targetLine: string | null;
};

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

      const [goalsRes, contextRes, weekRes, rungRes, rulesRes, profileRes, allergyRes] =
        await Promise.all([
        supabase.from('user_goals').select('label').order('sort_order', { ascending: true }),
        supabase.from('user_context').select('category, content'),
        supabase.from('user_week').select('activity, cadence').order('sort_order', { ascending: true }),
        supabase.from('user_skill_rungs').select('name, stage').eq('stage', 'now'),
        supabase.from('user_rules').select('phrase, kind'),
        supabase.from('user_profile').select('fat_focus_state, muscle_focus_state').maybeSingle(),
        supabase.from('allergies').select('name, kind'),
      ]);

      const tapped = ((goalsRes.data ?? []) as { label: string }[]).map((g) => g.label);
      const written = ((contextRes.data ?? []) as { category: string | null; content: string }[])
        .filter((c) => (c.category ?? '').toLowerCase().includes('goal'))
        .map((c) => c.content);

      const profile = profileRes.data as
        | { fat_focus_state: string | null; muscle_focus_state: string | null }
        | null;

      setDraft({
        goals: [...tapped, ...written],
        week: ((weekRes.data ?? []) as { activity: string; cadence: string | null }[]).map((w) =>
          w.cadence ? `${w.activity}, ${w.cadence}` : w.activity
        ),
        skills: ((rungRes.data ?? []) as { name: string }[]).map((r) => r.name),
        rules: ((rulesRes.data ?? []) as { phrase: string; kind: string }[])
          .filter((r) => r.kind === 'never')
          .map((r) => r.phrase),
        // SHOWN BACK IN THE SAME WORDS THEY WERE STORED IN, capitalised only.
        // A woman who has just told the app she is coeliac should be able to
        // see that it heard her, on the screen that exists to prove it did.
        allergies: ((allergyRes.data ?? []) as { name: string }[]).map(
          (a) => a.name.charAt(0).toUpperCase() + a.name.slice(1)
        ),
        // THE TARGETS ARE DESCRIBED, NOT NUMBERED, on this screen. A calorie
        // figure needs a weight and a TDEE, and onboarding has not necessarily
        // got either yet. Saying what has been set is true; printing a number
        // that might be built on nothing is not.
        targetLine:
          profile?.fat_focus_state || profile?.muscle_focus_state
            ? 'Set from your goals. They show on Today.'
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
        router.replace('/');
      })();
    },
    secondary: {
      label: 'Add more about you',
      onPress: () => router.push('/onboarding/life-stage'),
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
        items={draft.allergies}
        emptyNote="Nothing recorded. Say anything in chat and it will show here."
      />
      <Section
        title="Your targets"
        items={draft.targetLine ? [draft.targetLine] : []}
        emptyNote="Add a goal any time and they will appear."
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
