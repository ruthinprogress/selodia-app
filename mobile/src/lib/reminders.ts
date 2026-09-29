// EVERY WORD A NOTIFICATION WOULD SAY, WRITTEN DOWN AND NOT SENT.
//
// Ruth's overnight brief: "Reminders and notification strings: write them for
// review, but do not wire any live notifications tonight."
//
// So this file is a script, not a scheduler. Nothing here calls
// expo-notifications, nothing schedules anything, and
// scripts/check-no-notifications.mjs fails the build if that changes without
// somebody meaning it. The strings exist so they can be read, argued with and
// approved as writing, which is the only way they get written well.
//
// THE RULES THEY ARE WRITTEN TO, from her brief:
//
//   Off until chosen. A notification nobody asked for is the app deciding it is
//   more important than the person's afternoon.
//
//   One nudge, no chasing. If she does not act on it, that is an answer. A
//   second message is the app arguing with her.
//
//   Worded as an offer. "Ballet today, if you fancy it" and not "Time for
//   ballet" - the first is information, the second is an instruction from
//   something that does not know what her day has been like.
//
//   No streaks, no counts, no "you haven't". The standing rule: goals are
//   welcome and shame is not. There is no notification in this file that could
//   be read as a telling-off, and there is none at all for a missed session,
//   deliberately - see MISSED_SESSION below.

export type ReminderKind =
  | 'planned_day'
  | 'week_ahead'
  | 'roundup_ready'
  | 'report_ready'
  | 'nothing_logged';

export type ReminderString = {
  kind: ReminderKind;
  /** When it would fire, in plain words. Not a cron expression; this is for reading. */
  when: string;
  title: string;
  body: string;
  /** Why it is worth interrupting somebody for. If this is weak, cut the notification. */
  justification: string;
};

export const REMINDER_STRINGS: ReminderString[] = [
  {
    kind: 'planned_day',
    when: 'Morning of a day with something in her week. Guide me only, and only if reminders are on.',
    title: 'Ballet today',
    body: 'If it fits. Nothing to tick off either way.',
    justification:
      'She asked to be guided and put ballet in her week. The second sentence is doing the work: it takes the obligation out before she has a chance to feel it.',
  },
  {
    kind: 'week_ahead',
    when: 'Sunday evening. Guide me only.',
    title: 'Your week',
    body: 'Three things in it this week. Have a look whenever suits.',
    justification:
      'The one notification that is genuinely useful rather than merely timely. Whether it survives review is a real question.',
  },
  {
    kind: 'roundup_ready',
    when: 'Sunday evening, once a roundup exists. Both modes.',
    title: 'Your week, looked at',
    body: 'Selodía has been through what you logged. It is in your Almanac.',
    justification:
      'This is the product. If one notification survives, it is this one: something was made for her and she cannot know unless she is told.',
  },
  {
    kind: 'report_ready',
    when: 'When a report she asked for has finished building. Both modes.',
    title: 'Your report is ready',
    body: 'Ready to look at before you send it anywhere.',
    justification:
      'She asked for it. Telling her it is done is answering a question she asked, which is the only kind of notification nobody objects to.',
  },
  {
    kind: 'nothing_logged',
    when: 'NEVER. Written down so the argument is on the record rather than had again.',
    title: '(not used)',
    body: '(not used)',
    justification:
      'Every tracking app sends this and it is the reason people delete them. "You have not logged in 3 days" is the app noticing she is absent and making it her problem. A woman who stopped logging in a bad week gets told off by her phone for having had a bad week. There is no wording that fixes it, because the FACT of the message is the judgement.',
  },
];

/**
 * THE ONE THAT DOES NOT EXIST, and the reason is worth keeping visible.
 *
 * There is no missed-session notification and there is no place in the app that
 * computes one. The spec's hard rule for My Week is that nothing is ever marked
 * missed, behind or short of the baseline, and a notification is the loudest
 * possible way to break it.
 */
export const MISSED_SESSION = null;

/** The days a week row can carry. Lowercase, stored as an array. */
export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Day = (typeof DAYS)[number];

export const DAY_LABEL: Record<Day, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

/** Today's key, matching what is stored on a week row. */
export function todayKey(now: Date = new Date()): Day {
  // getDay() is 0 = Sunday, and DAYS starts on Monday.
  return DAYS[(now.getDay() + 6) % 7];
}

/**
 * The one line Today shows in Guide me, or null.
 *
 * ONLY ON A PLANNED DAY, and only in Guide me. Ruth's brief: 'Guide me shows one
 * line on Today ("On the plan: gym"), only on planned days.'
 *
 * A LINE, NOT A PROMPT, AND NEVER A TICK. It states what is in her week today
 * and offers no way to mark it done, because Today is not where anything is
 * marked done and My Week has no completion at all. Somebody who does not do it
 * should find the line gone tomorrow and nothing else changed.
 */
export function plannedTodayLine(
  rows: { activity: string; days: string[] }[],
  guidanceMode: string | null,
  now: Date = new Date()
): string | null {
  if (guidanceMode !== 'guide_me') return null;
  const key = todayKey(now);
  const today = rows.filter((r) => r.days.includes(key)).map((r) => r.activity);
  if (today.length === 0) return null;
  const list =
    today.length === 1
      ? today[0]
      : `${today.slice(0, -1).join(', ')} and ${today[today.length - 1]}`;
  return `On the plan: ${list.toLowerCase()}`;
}
