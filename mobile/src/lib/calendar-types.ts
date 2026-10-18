// The shape of one diary row, alone in a file so calendar.ts and
// calendar-time.ts can both have it without importing each other.

export type CalendarEvent = {
  id: string;
  title: string;
  /** YYYY-MM-DD. Always present. */
  event_date: string;
  /** 'HH:MM:SS', or null when the day is known and the hour is not. */
  event_time: string | null;
  place: string | null;
  what_to_bring: string | null;
  notes: string | null;
  remind_at: string | null;
  remind_offset_minutes: number | null;
  reminder_cancelled_at: string | null;
};
