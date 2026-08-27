// Quiet hours (Part Fourteen): nothing fires between 9pm and 7am, whatever
// triggered it.
//
// Pure and node-tested, deliberately. This is the rule that decides whether
// someone's phone lights up at 3am, and it is the last thing that should live
// buried in an effect somewhere.

export const QUIET_FROM_HOUR = 21;
export const QUIET_UNTIL_HOUR = 7;

// The window WRAPS midnight, which is the whole reason this is a function
// rather than a comparison: 22:00 and 03:00 are both inside it, and the obvious
// `hour >= 21 && hour < 7` is never true for anything.
export function isQuiet(at: Date): boolean {
  const h = at.getHours();
  return h >= QUIET_FROM_HOUR || h < QUIET_UNTIL_HOUR;
}

// When something suppressed at `at` should actually arrive: the next 7am.
//
// Suppressed notifications are NOT discarded, and not fired individually the
// moment quiet hours end - they are deferred and bundled into one 7am delivery
// (Part Fourteen), so nobody wakes to a stack of things that happened while
// they were asleep.
export function deferredUntil(at: Date): Date {
  const out = new Date(at);
  // From 9pm it is tomorrow's 7am; before 7am it is still this same morning.
  if (at.getHours() >= QUIET_FROM_HOUR) out.setDate(out.getDate() + 1);
  out.setHours(QUIET_UNTIL_HOUR, 0, 0, 0);
  return out;
}

// The next moment a given "HH:MM" reminder should fire, deferring out of quiet
// hours rather than dropping.
export function nextFireTime(hhmm: string, now: Date = new Date()): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;

  const candidate = new Date(now);
  candidate.setHours(hour, minute, 0, 0);
  if (candidate.getTime() <= now.getTime()) candidate.setDate(candidate.getDate() + 1);

  return isQuiet(candidate) ? deferredUntil(candidate) : candidate;
}
