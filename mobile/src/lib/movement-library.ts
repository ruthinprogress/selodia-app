import { readContent, type PlanView } from '@/lib/almanac-content';
import { supabase } from '@/lib/supabase';

// What a Movement card needs to say about a saved practice, beyond its name.
//
// MOVEMENT IS A LIBRARY OF PRACTICES, NOT A WORKOUT LIST (Ruth's brief,
// 2026-09-18): "a growing library of ways a person has learned to care for their
// body". A gym programme, a yoga flow, a rehab plan and a breathing sequence all
// live here, so nothing in this file may assume weights, reps or a gym.

export type MovementSummary = {
  /** "Movement plan", "Mobility", "Flow" - what kind of practice it is. */
  kind: string;
  /** Rough minutes, e.g. "~32 min". Null when the plan carries no exercises. */
  duration: string | null;
  /** "6 movements", or null when there are none to count. */
  movements: string | null;
  /** "Last done today", "Last done 3 days ago", or null if never. */
  lastDone: string | null;
};

// HOW LONG A PRACTICE TAKES, ESTIMATED HONESTLY.
//
// Nobody has ever timed these, so this is arithmetic and says so by rounding to
// five minutes and wearing a "~". A set is taken as a minute and a half of work
// and rest together, which is the ordinary pace of a strength set; an exercise
// with no sets recorded - a stretch, a flow position, a breathing round - is
// taken as two minutes. Two minutes is added once for settling in.
//
// It is deliberately not a promise. A routine that says ~32 min and takes 40 is
// an estimate; one that says 32 and takes 40 is a broken clock.
export function estimateMinutes(plan: PlanView): number | null {
  if (plan.exercises.length === 0) return null;
  const minutes = plan.exercises.reduce((total, x) => total + (x.sets ? x.sets * 1.5 : 2), 2);
  return Math.max(5, Math.round(minutes / 5) * 5);
}

export function formatDuration(minutes: number | null): string | null {
  return minutes == null ? null : `~${minutes} min`;
}

// "Last done today" / "3 days ago" / "a week ago". Deliberately vague past a
// week: an exact count of days since somebody last did their mobility work is a
// number that starts to feel like a debt.
export function formatLastDone(when: string | null): string | null {
  if (!when) return null;
  const then = new Date(when);
  if (!Number.isFinite(then.getTime())) return null;
  const day = new Date(then);
  day.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (days <= 0) return 'Last done today';
  if (days === 1) return 'Last done yesterday';
  if (days < 7) return `Last done ${days} days ago`;
  if (days < 14) return 'Last done a week ago';
  if (days < 31) return `Last done ${Math.round(days / 7)} weeks ago`;
  return 'Last done a while ago';
}

// The most recent completion for each plan, from the append-only log. One query
// for the whole library rather than one per card.
export async function loadLastDoneByPlan(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    const { data, error } = await supabase
      .from('workout_completion_log')
      .select('plan_id, completed_at')
      .order('completed_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    for (const row of (data ?? []) as { plan_id: string | null; completed_at: string }[]) {
      if (row.plan_id && !out.has(row.plan_id)) out.set(row.plan_id, row.completed_at);
    }
  } catch (err) {
    console.log('last-done read failed (non-fatal):', err instanceof Error ? err.message : err);
  }
  return out;
}

// What the card says under the title. The kind comes from the entry's own
// category where it has one - Ruth's own words for the practice, "Mobility",
// "Pilates", "Recovery" - and falls back to the plan's program type.
export function summarise(
  content: unknown,
  category: string | null,
  lastDoneAt: string | null
): MovementSummary {
  const view = readContent(content);
  const plan = view.shape === 'plan' ? view.plan : null;
  const count = plan?.exercises.length ?? 0;
  return {
    kind: (category ?? plan?.programType ?? 'Movement plan').trim(),
    duration: formatDuration(plan ? estimateMinutes(plan) : null),
    movements: count > 0 ? `${count} movement${count === 1 ? '' : 's'}` : null,
    lastDone: formatLastDone(lastDoneAt),
  };
}
