import type { FoodEntry } from './food-logging';
import type { ActivityEntry } from './activity-logging';

// Brief, glance-verifiable summary for the ephemeral Save Confirmation toast in
// the client. Replaces the old in-thread "Logged: …" bubble and buildLoggedReply:
// the confirmation is now a transient visual, and full detail lives in the
// Dashboard, so the summary stays short (label + headline number).
export function foodSaveSummary(entry: FoodEntry): string {
  return `${entry.meal_label} — ${entry.kcal} kcal`;
}

export function activitySaveSummary(entries: ActivityEntry[]): string {
  return entries.map((e) => `${e.activity_type} — ${e.duration_min} min`).join('; ');
}
