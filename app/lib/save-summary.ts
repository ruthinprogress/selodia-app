import type { FoodEntry } from './food-logging';
import type { ActivityEntry } from './activity-logging';

// Brief, glance-verifiable summary for the ephemeral Save Confirmation toast in
// the client. Replaces the old in-thread "Logged: …" bubble and buildLoggedReply:
// the confirmation is now a transient visual, and full detail lives in the
// Dashboard, so the summary stays short (label + headline number).
// Several rows can land at once now: one message can be a week of catch-up
// (2026-09-16), so this reads a list, exactly as the activity summary does. A
// single meal is unchanged, which is almost every log.
export function foodSaveSummary(entries: FoodEntry[]): string {
  return entries.map((e) => `${e.meal_label} · ${e.kcal} kcal`).join('; ');
}

export function activitySaveSummary(entries: ActivityEntry[]): string {
  return entries.map((e) => `${e.activity_type} · ${e.duration_min} min`).join('; ');
}
