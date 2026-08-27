import { supabase } from '@/lib/supabase';

// The reminder SETTINGS - stored preferences only, and deliberately free of any
// native import.
//
// WHY THIS FILE EXISTS SEPARATELY (2026-08-27, second attempt at the same bug).
// The Chat screen needs to know whether to offer reminders. That is a question
// about a Supabase row, not about push. But it used to be answered by a module
// that also imported expo-notifications - so Chat's module graph reached a
// native module, and on a binary without it the whole screen died: nothing could
// be typed into the message box.
//
// Making the import lazy was NOT enough. Metro resolves the async require
// through its own loader, and expo-notifications throws while EVALUATING
// (requireNativeModule at the top of PushTokenManager), which surfaces as an
// uncaught error rather than rejecting the awaited promise. A try/catch around
// `await import(...)` never sees it.
//
// So the split is structural rather than defensive: anything Chat touches lives
// here and imports nothing native. Push lives in notifications.ts and is reached
// only from the offer card, only after a native-availability probe.

export const DEFAULT_REMINDER_TIMES = ['14:00', '20:00'];

export type ReminderSettings = {
  enabled: boolean;
  times: string[];
  askedAt: string | null;
};

export async function loadReminderSettings(): Promise<ReminderSettings | null> {
  const { data } = await supabase
    .from('reminder_settings')
    .select('enabled, times, asked_at')
    .maybeSingle();
  if (!data) return null;
  return {
    enabled: data.enabled,
    times: (data.times as string[]) ?? [],
    askedAt: data.asked_at ?? null,
  };
}

// True only when this person has never been asked - the one state in which the
// offer may appear. A recorded decline (asked_at set, enabled false) is as final
// as a yes; that distinction is the whole reason a decline is stored at all.
export async function shouldOfferReminders(): Promise<boolean> {
  const settings = await loadReminderSettings();
  return settings === null || settings.askedAt === null;
}

// Records the answer, whichever way it went. Storage only - scheduling the
// actual reminders is the native half's job, and is called separately so this
// can never drag push into a caller that does not want it.
export async function persistReminderChoice(
  userId: string,
  choice: { enabled: boolean; times?: string[] }
): Promise<string[]> {
  const times = choice.times ?? DEFAULT_REMINDER_TIMES;
  await supabase.from('reminder_settings').upsert({
    user_id: userId,
    enabled: choice.enabled,
    times,
    asked_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  return choice.enabled ? times : [];
}
