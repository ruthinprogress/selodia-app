import { Platform } from 'react-native';

// READING STEPS FROM HEALTHKIT, ON THE LIBRARY THAT STILL COMPILES.
//
// 10 October 2026, the first iOS build Selodía has ever attempted:
//
//   no visible @interface for 'RCTCallableJSModules' declares the selector 'setBridge:'
//
// react-native-health calls `[self.callableJSModules setBridge:self.bridge]`,
// and React Native 0.86 declares that method inside
//
//   #ifndef RCT_REMOVE_LEGACY_ARCH
//
// so on a build with the legacy architecture removed - which 0.86 is - it does
// not exist. react-native-health last published in OCTOBER 2024 and 1.19.0 is
// the final version, so there was nothing to upgrade to and no prospect of one.
// Android was unaffected throughout, because that path is Health Connect and
// this library is iOS-only, which is why a year of green Android builds said
// nothing about it.
//
// @kingstinct/react-native-healthkit is the replacement: maintained, last
// published three days before this was written, and supporting React Native
// 0.79 and up.
//
// LOADED WHERE IT IS USED, NEVER AT IMPORT. The same rule as react-native-
// health-connect, for the same reason and with a worse blast radius: this is a
// Nitro module with no Android side at all, so evaluating it on Android throws
// during module evaluation rather than at the call. A try/catch around an
// `await import()` does not help - the throw happens at evaluation, so the
// require has to sit inside the function that needs it. That fault has already
// cost this codebase a dead Today tab on iOS and a white screen on Android, and
// is documented in lib/steps.ts, lib/document-pages.ts, lib/reminder-settings.ts
// and lib/notifications.ts.
type HealthKit = typeof import('@kingstinct/react-native-healthkit');

function healthKit(): HealthKit | null {
  if (Platform.OS !== 'ios') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@kingstinct/react-native-healthkit') as HealthKit;
  } catch {
    // An older binary without the native module. Null reads as "cannot know",
    // which every caller handles, and null is never written over a real figure.
    return null;
  }
}

/** The one type Selodía asks for. It reads steps and writes nothing. */
export const STEP_TYPE = 'HKQuantityTypeIdentifierStepCount' as const;

/** False when this is not an iPhone, or HealthKit is unavailable on it. */
export function appleHealthAvailable(): boolean {
  const hk = healthKit();
  if (!hk) return false;
  try {
    return hk.isHealthDataAvailable();
  } catch {
    return false;
  }
}

/**
 * Ask for read access to the step count.
 *
 * THE BOOLEAN IS NOT AN ANSWER ABOUT ACCESS. It reports that the request
 * completed. Apple deliberately never tells an app whether READ access was
 * granted, so that an app cannot detect a refusal and pester - see
 * step-permission.ts, where a whole defect came from treating "no error" as
 * "yes". The only honest signal is to ask for data and see what arrives.
 */
export async function requestAppleStepAccess(): Promise<boolean> {
  const hk = healthKit();
  if (!hk) return false;
  try {
    return await hk.requestAuthorization({ toRead: [STEP_TYPE] });
  } catch (err) {
    console.log('APPLE HEALTH: requestAuthorization failed -', err);
    return false;
  }
}

/**
 * Total steps between two moments, or null when that cannot be known.
 *
 * cumulativeSum rather than summing samples by hand, for the same reason the
 * Android path uses COUNT_TOTAL: HealthKit holds steps as many small records
 * from whichever sources wrote them, and adding them up double-counts the
 * overlap between the phone, a watch and anything else writing steps.
 *
 * NULL IS NOT ZERO. A refusal and a person who has not walked today are
 * indistinguishable on iOS, and both arrive here as an absent sum. Zero would
 * be a claim that somebody did not move, which is the exact false statement the
 * Activity square exists to avoid making.
 */
export async function readAppleSteps(start: Date, end: Date): Promise<number | null> {
  const hk = healthKit();
  if (!hk) return null;
  try {
    const stats = await hk.queryStatisticsForQuantity(STEP_TYPE, ['cumulativeSum'], {
      filter: { date: { startDate: start, endDate: end } },
      unit: 'count',
    });
    const n = stats?.sumQuantity?.quantity;
    return typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : null;
  } catch (err) {
    console.log('APPLE HEALTH: step statistics failed -', err);
    return null;
  }
}
