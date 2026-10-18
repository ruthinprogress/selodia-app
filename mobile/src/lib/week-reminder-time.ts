import { DAY_KEYS } from '@/lib/week-plan';

// WHEN A WEEK REMINDER FIRES, AND ON WHICH DAY.
//
// Pure arithmetic, kept apart from week-reminders.ts because that file reaches
// Supabase and therefore react-native, which cannot be imported by a check
// script. The two things most worth testing here - an offset that crosses
// midnight, and the day numbering - are exactly the two that fail silently on a
// real phone, so they have to be testable without one.
//
// Split out 18 October 2026, when the first check written for them could not
// load the module at all.

/** 'HH:MM:SS' plus an optional offset, as hour and minute. */
export function fireTime(reminder: {
  remind_at: string;
  remind_offset_minutes: number | null;
}): { hour: number; minute: number } | null {
  const [h, m] = reminder.remind_at.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;

  // THE OFFSET IS SUBTRACTED HERE RATHER THAN STORED ALREADY APPLIED, so "half
  // an hour before my class" still means that if the class moves. Storing 18:30
  // for a 19:00 class throws away the fact that it was ever about the class.
  const offset = reminder.remind_offset_minutes ?? 0;
  let total = h * 60 + m - offset;

  // AN OFFSET MUST NEVER MOVE A REMINDER ONTO THE DAY BEFORE. An hour before a
  // 00:30 class is 23:30 the previous evening, which is a day she did not
  // choose. Clamped to the start of her day instead: slightly early on the
  // right day is recoverable, the wrong day is just wrong.
  if (total < 0) total = 0;

  return { hour: Math.floor(total / 60), minute: total % 60 };
}

/**
 * expo-notifications counts SUNDAY as 1. DAY_KEYS starts on Monday.
 *
 * Getting this wrong by one puts every reminder a day out, and nothing would
 * catch it except somebody being nudged on the wrong morning. Unrecognised days
 * return null rather than a guess, for the same reason.
 */
export function weekdayNumber(day: string): number | null {
  const i = DAY_KEYS.indexOf(day as (typeof DAY_KEYS)[number]);
  if (i < 0) return null;
  return i === 6 ? 1 : i + 2;
}
