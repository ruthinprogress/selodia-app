// HOW A NIGHT FROM A WATCH BECOMES A NIGHT IN HER RECORD.
//
// SEPARATE FROM sleep-sync.ts BECAUSE IT HAS TO BE TESTABLE. That file
// imports react-native for Platform, and a plain Node check cannot load
// react-native at all - so every rule in here would have been unverifiable
// while living beside the thing that reads the phone.
//
// Nothing in this file touches a device, a network or a database. It takes
// the shape Health Connect hands back and decides what is true about the
// night: how long she was ASLEEP rather than in bed, which evening it belongs
// to, how many times it broke, and never how it felt.
/** Health Connect's stage numbers. From the installed library's constants. */
const STAGE = {
  UNKNOWN: 0,
  AWAKE: 1,
  SLEEPING: 2,
  OUT_OF_BED: 3,
  LIGHT: 4,
  DEEP: 5,
  REM: 6,
} as const;

/** The stages that are actually sleep, as opposed to lying there. */
const ASLEEP: number[] = [STAGE.SLEEPING, STAGE.LIGHT, STAGE.DEEP, STAGE.REM];

export type NightFromPhone = {
  /** The evening the night belongs to, YYYY-MM-DD, as sleep_logs keys it. */
  nightOf: string;
  minutes: number;
  wentToBed: string;
  wokeAt: string;
  /** Times the night was broken, when the stages say. Null when they do not. */
  awakenings: number | null;
};

export type Stage = { startTime: string; endTime: string; stage: number };
export type Session = { startTime: string; endTime: string; stages?: Stage[] };

function minutesBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 60000) : 0;
}

/**
 * The evening a night belongs to.
 *
 * sleep_logs keys a night on the evening it BEGAN, so a session starting at
 * 23:40 on Tuesday and one starting at 00:20 on Wednesday are both Tuesday
 * night. Anything starting before 6pm is treated as belonging to the previous
 * evening, which covers a nap-shaped record and anyone on nights.
 */
export function nightOfFor(startISO: string): string {
  const start = new Date(startISO);
  const d = new Date(start);
  if (start.getHours() < 18) d.setDate(d.getDate() - 1);
  d.setHours(12, 0, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Turn one Health Connect session into the night we store.
 *
 * DURATION COMES FROM THE STAGES WHEN THERE ARE ANY, because a watch records
 * the whole time in bed as the session and the stages are what separate that
 * from sleep. Eight hours in bed and six and a half asleep are different facts,
 * and the second is the one she is being shown. Without stages - which is what
 * a phone-only record usually looks like - the session's own length is all
 * there is, and it is used as-is rather than discounted by a guess.
 */
export function nightFromSession(session: Session): NightFromPhone | null {
  if (!session?.startTime || !session?.endTime) return null;
  const stages = Array.isArray(session.stages) ? session.stages : [];

  const asleep = stages.filter((s) => ASLEEP.includes(s.stage));
  const minutes =
    asleep.length > 0
      ? asleep.reduce((n, s) => n + minutesBetween(s.startTime, s.endTime), 0)
      : minutesBetween(session.startTime, session.endTime);
  if (minutes <= 0) return null;

  // AWAKE STAGES, NOT A COUNT OF GAPS. An awake stage at the very start or end
  // is getting into or out of bed rather than a broken night, so only the ones
  // between sleep are counted. Null when the record carries no stages at all:
  // "0 awakenings" would be a claim about a night nobody observed.
  let awakenings: number | null = null;
  if (stages.length > 0) {
    const ordered = [...stages].sort((a, b) => a.startTime.localeCompare(b.startTime));
    const first = ordered.findIndex((s) => ASLEEP.includes(s.stage));
    const last = ordered.length - 1 - [...ordered].reverse().findIndex((s) => ASLEEP.includes(s.stage));
    awakenings =
      first < 0
        ? null
        : ordered
            .slice(first, last + 1)
            .filter((s) => s.stage === STAGE.AWAKE || s.stage === STAGE.OUT_OF_BED).length;
  }

  return {
    nightOf: nightOfFor(session.startTime),
    minutes,
    wentToBed: session.startTime,
    wokeAt: session.endTime,
    awakenings,
  };
}

/** Several sessions in one night - a wake-up and a return - become one night. */
export function mergeNights(nights: NightFromPhone[]): NightFromPhone[] {
  const byNight = new Map<string, NightFromPhone>();
  for (const n of nights) {
    const had = byNight.get(n.nightOf);
    if (!had) {
      byNight.set(n.nightOf, n);
      continue;
    }
    byNight.set(n.nightOf, {
      nightOf: n.nightOf,
      minutes: had.minutes + n.minutes,
      wentToBed: had.wentToBed < n.wentToBed ? had.wentToBed : n.wentToBed,
      wokeAt: had.wokeAt > n.wokeAt ? had.wokeAt : n.wokeAt,
      awakenings:
        had.awakenings == null && n.awakenings == null
          ? null
          : (had.awakenings ?? 0) + (n.awakenings ?? 0),
    });
  }
  return [...byNight.values()];
}
