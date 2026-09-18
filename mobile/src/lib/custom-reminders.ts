import { supabase } from '@/lib/supabase';

// The reminders somebody asked for, in their own words (2026-09-18).
//
// SEPARATE FROM THE LOG REMINDERS ON PURPOSE. Those are the app's own daily
// prompt to log, offered once and set in Settings. These are hers: a thing she
// asked to be reminded of, at a time she named, said back to her in her words.
// Turning off the log reminders must not silently cancel a reminder to take
// magnesium, which is why they are stored apart and scheduled together.

export type CustomReminder = {
  id: string;
  label: string;
  at_time: string;
  weekday: number | null;
};

export async function loadCustomReminders(): Promise<CustomReminder[]> {
  try {
    // RLS scopes this to the signed-in person.
    const { data, error } = await supabase
      .from('custom_reminders')
      .select('id, label, at_time, weekday')
      .eq('active', true)
      .order('at_time');
    if (error) throw error;
    return (data ?? []) as CustomReminder[];
  } catch (err) {
    console.log('custom reminders read failed (non-fatal):', err instanceof Error ? err.message : err);
    return [];
  }
}

export async function stopCustomReminder(id: string): Promise<boolean> {
  const { error } = await supabase.from('custom_reminders').update({ active: false }).eq('id', id);
  if (error) console.log('custom reminder stop failed:', error.message);
  return !error;
}

// "9:00" from "09:00", which is how somebody says it back to themselves.
export function spokenTime(atTime: string): string {
  const [h, m] = atTime.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return atTime;
  const suffix = h < 12 ? 'am' : 'pm';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour}${suffix}` : `${hour}:${String(m).padStart(2, '0')}${suffix}`;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function reminderSummary(r: Pick<CustomReminder, 'label' | 'at_time' | 'weekday'>): string {
  const when = r.weekday == null ? 'every day' : `every ${DAYS[r.weekday]}`;
  return `${r.label}, ${when} at ${spokenTime(r.at_time)}`;
}
