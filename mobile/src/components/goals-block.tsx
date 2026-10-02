import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { displayGoal } from '@/lib/goal-display';
import { readGoalsCollapsed, writeGoalsCollapsed } from '@/lib/goals-collapsed';
import { lookbackLabel } from '@/lib/feel-goals';
import { supabase } from '@/lib/supabase';

// WHAT YOU'RE WORKING TOWARDS. The top of Plans, above the segmented control.
//
// ONE SOURCE NOW, AND IT IS user_goals. This block used to read user_goals AND
// user_context and concatenate them, which produced exactly what Ruth found:
// the same goal twice, and a superseded one that never went away. The fix is a
// database trigger that mirrors any goal written to user_context into
// user_goals, so there is one place to read and the guard sits at the write
// where a future writer cannot miss it.
//
// CURRENT ONLY. History lives on the Goal screen and nowhere else, which is her
// instruction and is also the right shape: a list that shows everything you
// have ever wanted is a list you stop reading.
//
// CAPITALISED AT RENDER, NEVER IN THE DATABASE. See lib/goal-display.ts.
//
// NO COUNTERS, NO PERCENTAGES, NO BARS, and no sense of a deadline.
//
// ---- IT FOLDS SHUT (Ruth, 1 October 2026, UI item 1) --------------------
//
// Two reasons, and the second is the one that shaped this:
//
//   SPACE. Expanded, this was the tallest thing on Plans before the week even
//   started, so the week could not fit on one screen - which is success
//   criterion one of her refinement brief.
//
//   PRIVACY. Her words: "a privacy feature, allowing users to comfortably open
//   Selodía in public." A goal here is "lose body fat" or something about a
//   body, and a phone screen is readable by the person next to you. So COLLAPSED
//   SHOWS NOTHING PERSONAL - not a count, not a first goal, not "2 goals", not a
//   truncated preview. Just the heading. A count is a smaller leak than a
//   sentence but it is still a leak, and the point of one tap is that it is
//   complete.
//
// THE STATE IS ON THE ACCOUNT, not the device - see lib/goals-collapsed.ts and
// the migration. A privacy preference that forgets itself is worse than none,
// because by then she has stopped checking.
//
// AN ICON, NOT AN EMOJI. Her brief drew the collapsed state as "🎯 Working
// Towards". There is no pictorial emoji anywhere in this app - every mark is an
// Ionicon, sized and coloured with the theme - so a lone emoji would be the one
// thing on the screen that ignores the type scale and renders differently on
// every OS. Same idea, in the app's own voice.

export type Goal = {
  id: string;
  label: string;
  detail: string | null;
  set_on: string | null;
};

/**
 * Whether a nudge is worth offering: never looked back, or a fortnight since.
 *
 * NOT A SCHEDULE AND NOT A STREAK. It gates one sentence. Nothing counts how
 * many times she has looked back, nothing says she is overdue, and a fortnight
 * is chosen because asking weekly about how somebody's days feel is itself the
 * friction this app exists to take off her.
 */
export function dueForLookback(lastAt: string | null): boolean {
  if (!lastAt) return true;
  const then = new Date(lastAt).getTime();
  if (Number.isNaN(then)) return true;
  return Date.now() - then >= 14 * 24 * 60 * 60 * 1000;
}

export const GOALS_EMPTY = 'Nothing set yet';
export const GOALS_EMPTY_BODY =
  'Say what you would like to work towards in chat, and it will show here.';
export const GOALS_HEADING = "What you're working towards";

export function GoalsBlock() {
  const theme = useTheme();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Null until the stored preference arrives, so nothing is drawn in the wrong
  // state first. See below on why that matters more here than usually.
  const [collapsed, setCollapsed] = useState<boolean | null>(null);
  // HOW MANY EARLIER GOALS THERE ARE, for item 4's small link to the history.
  // Counted rather than fetched: the link needs to know whether there is
  // anything behind it, and nothing else.
  const [earlierCount, setEarlierCount] = useState(0);
  // HOW SHE WANTS HER DAYS TO FEEL (item 7). Grouped separately from the body
  // goals because they are a different kind of thing, and because the one that
  // has a look-back is this one.
  const [days, setDays] = useState<{ label: string; source: string }[]>([]);
  /** Her last answer, so the section can say when she last looked. */
  const [lastLookback, setLastLookback] = useState<{ answer: string; at: string } | null>(null);
  /**
   * HER PACE. Ruth, item 7: "The look-back is nudged ONLY if she chose Guide me;
   * otherwise only by tap in Plans."
   *
   * NULL IS NOT GUIDE ME, and that matters now that `guidance` is no longer one
   * of the seven questions: somebody who has never been asked is never nudged,
   * which is the quiet default and the right way round. Let me lead is also
   * never nudged. The tap below is always there either way.
   */
  const [guidance, setGuidance] = useState<string | null>(null);
  // SHE HID HER GOALS AND IT DID NOT STICK. Said out loud rather than swallowed:
  // they are folded away for now, but they will be back on show next time, and
  // if she is relying on this in a public place she needs to know that. The one
  // place in this component that gets a sentence about a failure.
  const [failedToHide, setFailedToHide] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [{ data, error }, folded] = await Promise.all([
          supabase
            .from('user_goals')
            .select('id, label, detail, set_on')
            .is('archived_at', null)
            .order('set_on', { ascending: false })
            .order('created_at', { ascending: false }),
          readGoalsCollapsed(),
        ]);
        const { count } = await supabase
          .from('user_goals')
          .select('id', { count: 'exact', head: true })
          .not('archived_at', 'is', null);
        const [{ data: feelRows }, { data: lookRows }, { data: pace }] = await Promise.all([
          supabase
            .from('feel_goals')
            .select('label, source')
            .is('archived_at', null)
            .order('sort_order', { ascending: true }),
          supabase
            .from('feel_lookbacks')
            .select('answer, created_at')
            .order('created_at', { ascending: false })
            .limit(1),
          supabase.from('user_profile').select('guidance_mode').maybeSingle(),
        ]);
        if (cancelled) return;
        setGoals(error ? [] : ((data ?? []) as Goal[]));
        setEarlierCount(count ?? 0);
        setDays((feelRows ?? []).map((r) => ({ label: String(r.label), source: String(r.source) })));
        const last = (lookRows ?? [])[0];
        setLastLookback(
          last ? { answer: String(last.answer), at: String(last.created_at) } : null
        );
        setGuidance((pace as { guidance_mode?: string | null } | null)?.guidance_mode ?? null);
        setCollapsed(folded);
        setLoaded(true);
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  // NOTHING IS DRAWN BEFORE THE ANSWER ARRIVES. An empty state that appears for
  // a moment and is then replaced reads as "you have nothing", which is the one
  // thing this block must never say by accident.
  //
  // AND IT NOW GUARDS THE PRIVACY SIDE TOO. Rendering expanded while the stored
  // preference is still in flight would flash her goals on screen every time she
  // opens Plans, which defeats the point of having folded them away. Both reads
  // are awaited together above so there is no window where one has landed and
  // the other has not.
  if (!loaded || collapsed === null) return null;

  async function toggle() {
    const next = !collapsed;
    // OPTIMISTIC, DELIBERATELY. The fold must feel instant, and a failed write
    // is reported rather than fought: the UI stays where she put it for this
    // session, and lib/goals-collapsed.ts explains why a failure is worth
    // knowing about rather than swallowing.
    setCollapsed(next);
    const stored = await writeGoalsCollapsed(next);
    if (!stored && next) setFailedToHide(true);
    else setFailedToHide(false);
  }

  return (
    <ThemedView style={styles.block}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: !collapsed }}
        accessibilityLabel={GOALS_HEADING}
        accessibilityHint={collapsed ? 'Shows your goals' : 'Hides your goals'}
        // A COMFORTABLE TARGET ON A SMALL HEADING. The row is deliberately
        // short, so the hit area is grown rather than the text.
        hitSlop={Spacing.two}
        style={({ pressed }) => [styles.headingRow, pressed && styles.pressed]}>
        <Ionicons
          // The disclosure mark carries the state, so the heading does not have
          // to change its words.
          name={collapsed ? 'chevron-forward' : 'chevron-down'}
          size={14}
          color={theme.textSecondary}
        />
        <ThemedText type="small" themeColor="textSecondary" style={styles.heading}>
          {GOALS_HEADING}
        </ThemedText>
      </Pressable>

      {failedToHide && (
        <ThemedText type="small" themeColor="textSecondary">
          Hidden for now, but that didn&apos;t save, so they will show again next time.
        </ThemedText>
      )}

      {/* GROUPED: YOUR BODY, THEN YOUR DAYS (Ruth, item 7).
          The eyebrow appears only when there is something in the other group,
          because a lone "Your body" heading over the only list on the screen is
          a label doing no work. */}
      {!collapsed && goals.length > 0 && days.length > 0 && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.groupLabel}>
          Your body
        </ThemedText>
      )}

      {/* COLLAPSED IS THE HEADING AND NOTHING ELSE. No count, no preview. */}
      {collapsed ? null : goals.length === 0 ? (
        <Pressable
          onPress={() => router.push('/')}
          accessibilityRole="link"
          accessibilityLabel={`${GOALS_EMPTY}. ${GOALS_EMPTY_BODY}`}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="small">{GOALS_EMPTY}</ThemedText>
            <ThemedText type="small" themeColor="accentDeep">
              {GOALS_EMPTY_BODY}
            </ThemedText>
          </ThemedView>
        </Pressable>
      ) : (
        goals.map((goal) => (
          <Pressable
            key={goal.id}
            onPress={() => router.push({ pathname: '/goal', params: { id: goal.id } })}
            accessibilityRole="link"
            accessibilityLabel={`${displayGoal(goal.label)}. Open the goal`}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundElement" style={[styles.card, styles.cardRow]}>
              <View style={styles.cardText}>
                <ThemedText type="small">{displayGoal(goal.label)}</ThemedText>
                {goal.detail ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {goal.detail}
                  </ThemedText>
                ) : null}
              </View>
              {/* accentDeep rather than accent: full-strength terracotta on sand
                  is 2.43:1, under even the 3:1 a non-text control needs. */}
              <Ionicons name="chevron-forward" size={16} color={theme.accentDeep} />
            </ThemedView>
          </Pressable>
        ))
      )}

      {/* A SMALL LINK TO THE HISTORY (Ruth, 2 October 2026, item 4: "the Goals
          section gets a small link to that history").

          ONLY WHEN THERE IS A HISTORY. A link to an empty list is a promise of
          something that is not there, and until today the Earlier goals screen
          was always empty because nothing ever archived a goal - it deleted them.

          SMALL, AND NOT A COUNT IN THE HEADING. A number beside "What you are
          working towards" would read as a score of how many goals she has been
          through, which is the opposite of the point. */}
      {/* YOUR DAYS. Her feel goals, and the one tap that opens the look-back.
          NO SCORE, NO COUNT, NO STREAK. The last answer is shown as the words she
          chose and nothing else: not "3rd look-back", not a direction, not a
          trend. Her instruction for item 7 forbids all of those, and the reason is
          that a look-back which grades her is the thing this is replacing.

          THE LOOK-BACK IS A TAP HERE. It is nudged only if she chose Guide me;
          this link is how she reaches it otherwise, and it is always available. */}
      {!collapsed && days.length > 0 && (
        <>
          <ThemedText type="small" themeColor="textSecondary" style={styles.groupLabel}>
            Your days
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.card}>
            {days.filter((d) => d.source === 'chip').length > 0 && (
              <ThemedText type="small">
                {days.filter((d) => d.source === 'chip').map((d) => d.label).join(' · ')}
              </ThemedText>
            )}
            {days
              .filter((d) => d.source === 'her words')
              .map((d) => (
                <ThemedText key={d.label} type="small" themeColor="textSecondary">
                  {d.label}
                </ThemedText>
              ))}
            {lastLookback && (
              <ThemedText type="small" themeColor="textSecondary">
                Last time you looked back: {lookbackLabel(lastLookback.answer)?.toLowerCase()}.
              </ThemedText>
            )}
          </ThemedView>
          {/* THE NUDGE, AND ONLY FOR GUIDE ME. Her instruction. It is one quiet
              line above a link that is always there, never a badge, a count or a
              reminder that something is overdue - there is no schedule to be late
              for. Shown when she has never looked back, or when the last time was
              a fortnight or more ago, because asking weekly about how her days
              feel is the friction this app exists to remove. */}
          {guidance === 'guide_me' && dueForLookback(lastLookback?.at ?? null) && (
            <ThemedText type="small" themeColor="textSecondary">
              {lastLookback
                ? 'It has been a while. Worth a look back when you have a minute.'
                : 'Whenever you are ready, you can look back on how your days feel.'}
            </ThemedText>
          )}
          <Pressable
            onPress={() => router.push('/look-back')}
            accessibilityRole="link"
            accessibilityLabel="Look back on how your days feel"
            hitSlop={Spacing.two}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedText type="small" themeColor="accentDeep">
              Look back on this
            </ThemedText>
          </Pressable>
        </>
      )}

      {!collapsed && earlierCount > 0 && (
        <Pressable
          onPress={() => router.push('/goal')}
          accessibilityRole="link"
          accessibilityLabel="Earlier goals"
          hitSlop={Spacing.two}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedText type="small" themeColor="accentDeep">
            Earlier goals
          </ThemedText>
        </Pressable>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  groupLabel: { textTransform: 'uppercase', letterSpacing: 0.8 },
  // Spacing.one rather than two: the heading sits closer to its own card now,
  // which is part of the density pass and makes the fold read as one object.
  block: { gap: Spacing.one },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  heading: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  card: {
    // Was Spacing.three/four. A goal is one or two lines; the padding was making
    // the tallest thing on the page out of the shortest content.
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: CardRadius,
    gap: 2,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  // Takes the slack so the chevron keeps the right edge, and wraps rather than
  // clipping when a goal runs to two lines - which most of them do.
  cardText: { flex: 1, gap: 2 },
  pressed: { opacity: 0.7 },
});
