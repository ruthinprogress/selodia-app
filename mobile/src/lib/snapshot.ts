import AsyncStorage from '@react-native-async-storage/async-storage';

// WHAT THE SCREEN SHOWED LAST TIME (2026-09-20).
//
// Ruth: "data population are very slow and feel like they're broken until
// something happens. Busy ppl haven't got time to wait to see if it went
// through."
//
// Measured first: her database calls run in 16-150ms, so the data is not slow.
// What is slow is the SEQUENCE - open the app, wait for a session, then a
// query, then a render - and during that sequence the screen has nothing to
// show, which is what reads as broken.
//
// So a screen keeps a copy of what it last displayed and paints that
// immediately, while the real read happens behind it. The numbers are a few
// seconds old for a moment, which is honest for a day's log and invisible for
// a body measurement taken this morning.
//
// WHAT NEVER GOES IN HERE: anything that would be wrong to show to the wrong
// person. The snapshot is cleared on sign-out, and it is only ever written for
// screens whose content is already on this phone's own screen. It is a
// convenience for the person who just closed the app, not a second copy of
// their record - the record is the database.

const PREFIX = 'selodia.snapshot.';

/** Write what the screen is showing now. Failures are silent by design. */
export async function saveSnapshot<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(`${PREFIX}${key}`, JSON.stringify({ at: Date.now(), value }));
  } catch {
    // A snapshot that cannot be written costs a slower first paint, nothing else.
  }
}

/**
 * What the screen showed last time, if it is recent enough to be worth
 * showing. Null when there is nothing, when it is stale, or on any error.
 *
 * `maxAgeMs` is per screen: a day's log is worth showing from an hour ago
 * because the day has not changed underneath it; a live figure would not be.
 */
export async function readSnapshot<T>(key: string, maxAgeMs: number): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`${PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: unknown; value?: unknown };
    if (typeof parsed.at !== 'number' || Date.now() - parsed.at > maxAgeMs) return null;
    return (parsed.value ?? null) as T | null;
  } catch {
    return null;
  }
}

/** Everything this phone remembered, gone. Called when a session ends. */
export async function clearSnapshots(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(PREFIX));
    if (ours.length > 0) await AsyncStorage.multiRemove(ours);
  } catch {
    // Nothing to be done about it here, and the next sign-in overwrites them.
  }
}
