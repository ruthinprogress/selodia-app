import { supabase } from '@/lib/supabase';

// CHANGING A CARD THAT IS ALREADY IN HER WEEK.
//
// Ruth, 18 October 2026, two findings from one sitting:
//
//   "I cant find how to set the reminder alarm/notification for the activity
//    card."
//   "There is no way to edit the start time or duration time for the activity."
//
// Both were true, and they were the same hole. A card could be created with a
// time and a duration, moved between days, logged and taken out - and never
// changed. The reminder had a whole layer underneath it, tested, scheduled,
// switchable off from the notification itself, and nothing on any screen that
// reached it.
//
// THEY BELONG TOGETHER, which is why this is one write and one sheet rather
// than two. An offset reminder is "half an hour before my class", so it is
// meaningless until the class has a time; somebody setting one is going to
// want to fix the time in the same breath. Splitting them would mean leaving a
// sheet to make the other one possible.
//
// A GUARD BELONGS AT THE WRITE. Her standing rule. The sheet will not offer an
// offset for a card with no clock time, and this refuses to store one anyway,
// because the sheet is one caller and chat will be another.

export type WeekCardEdit = {
  /** Her words for when it happens. Free text on purpose - see day-time.ts. */
  timeOfDay: string | null;
  /** Her words for how long. Free text for the same reason. */
  duration: string | null;
  /** 'HH:MM' the reminder fires, or null for no reminder. */
  remindAt: string | null;
  /** Minutes before remindAt. Only meaningful alongside a real clock time. */
  remindOffsetMinutes: number | null;
};

/**
 * Write the editable parts of a week card.
 *
 * NOT A PARTIAL UPDATE. Every field the sheet owns is sent every time, because
 * a sheet that can clear a time has to be able to send "no time" - and an
 * undefined-means-leave-it-alone contract makes clearing impossible to express
 * without a second flag. Null means null here.
 */
export async function updateWeekCard(rowId: string, edit: WeekCardEdit): Promise<void> {
  const remindAt = /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(edit.remindAt ?? '')
    ? edit.remindAt
    : null;
  const { error } = await supabase
    .from('user_week')
    .update({
      time_of_day: edit.timeOfDay?.trim() ? edit.timeOfDay.trim() : null,
      duration: edit.duration?.trim() ? edit.duration.trim() : null,
      remind_at: remindAt,
      // An offset with no time to be before is not a reminder, it is an
      // arithmetic error waiting to fire at midnight. Dropped rather than
      // stored, whatever the caller thought it was asking for.
      remind_offset_minutes:
        remindAt && typeof edit.remindOffsetMinutes === 'number' && edit.remindOffsetMinutes > 0
          ? Math.round(edit.remindOffsetMinutes)
          : null,
      // SETTING ONE AGAIN UN-CANCELS IT. She has just asked for this, which is
      // a newer answer than the one she gave when she switched it off from a
      // notification. Clearing it is the only way she could ever get a
      // reminder back on a card she had silenced.
      reminder_cancelled_at: remindAt ? null : undefined,
    })
    .eq('id', rowId);
  if (error) throw new Error(error.message);
}

/**
 * The offsets offered when a card has a clock time, in minutes.
 *
 * Ruth named these: "it can offer 10mins, 15mins, 30mins 1hr before."
 */
export const REMINDER_OFFSETS = [0, 10, 15, 30, 60] as const;

/** What each offset is called on the button. 0 is not an offset, it is "then". */
export function offsetLabel(minutes: number): string {
  if (minutes === 0) return 'At the time';
  if (minutes === 60) return '1 hr before';
  return `${minutes} min before`;
}
