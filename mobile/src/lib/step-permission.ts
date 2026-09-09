import { Platform } from 'react-native';
import AppleHealthKit, { type HealthKitPermissions, type HealthValue } from 'react-native-health';
import {
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

// Asking the phone for step data, and being honest about the answer.
//
// Three defects were found on 1 September and all three came from the same
// mistake: treating "the OS did not say yes" as "the person said no". They are
// different failures on each platform and both were fixed on 2026-09-09.
//
// 'unknown' is the state that was missing. iOS genuinely cannot tell us whether
// read access was granted - Apple withholds it deliberately, so that an app
// cannot detect a refusal and pester - and pretending that ambiguity is a yes or
// a no is what made the iOS failure silent. A fourth state is the honest shape.
export type StepPermissionResult = 'granted' | 'declined' | 'unsupported' | 'unknown';

export async function requestStepPermission(): Promise<StepPermissionResult> {
  if (Platform.OS === 'ios') return requestIOSStepPermission();
  if (Platform.OS === 'android') return requestAndroidStepPermission();
  return 'unsupported';
}

// ---------------------------------------------------------------------- iOS
//
// DEFECT 2: iOS always reported granted, and so failed silently.
//
// `initHealthKit`'s callback sets an error only on genuine failure. Apple never
// reveals whether READ access was allowed - `authorizationStatus(for:)` reports
// sharing (write) permission and returns notDetermined for read types however the
// person answered, on purpose, so that an app cannot detect a refusal. So a
// decline arrived here as a null error and was recorded as success, the app then
// never received any step data, and nothing anywhere said why.
//
// The only honest signal is to ASK FOR DATA and see what comes back. A sample in
// hand proves access; no sample proves nothing, because somebody who genuinely
// did not walk yesterday looks identical to somebody who declined. That case is
// 'unknown', and 'unknown' must never be written down as a decline - doing so
// would suppress a later retry on the strength of a guess.
function requestIOSStepPermission(): Promise<StepPermissionResult> {
  return new Promise((resolve) => {
    AppleHealthKit.isAvailable((_err, available) => {
      if (!available) {
        resolve('unsupported');
        return;
      }
      const permissions: HealthKitPermissions = {
        permissions: { read: [AppleHealthKit.Constants.Permissions.StepCount], write: [] },
      };
      AppleHealthKit.initHealthKit(permissions, (error) => {
        if (error) {
          console.log('STEP PERMISSION (ios): initHealthKit failed —', error);
          resolve('declined');
          return;
        }

        // A week, not a day: somebody setting the app up on a quiet morning may
        // legitimately have almost no steps today, and a single empty day would
        // read as no access at all.
        const since = new Date();
        since.setDate(since.getDate() - 7);

        AppleHealthKit.getDailyStepCountSamples(
          { startDate: since.toISOString(), endDate: new Date().toISOString() },
          (readError: string, samples: HealthValue[]) => {
            if (readError) {
              // Includes an outright authorisation refusal, which iOS surfaces
              // here rather than at init. Still not conclusive on its own, so it
              // is logged and treated as unknown rather than asserted as a no.
              console.log('STEP PERMISSION (ios): step read failed —', readError);
              resolve('unknown');
              return;
            }
            const hasData = Array.isArray(samples) && samples.some((s) => (s?.value ?? 0) > 0);
            if (!hasData) {
              console.log(
                'STEP PERMISSION (ios): no step samples in the last 7 days. ' +
                  'Either access was refused or there genuinely are none — iOS does not say which.'
              );
            }
            resolve(hasData ? 'granted' : 'unknown');
          }
        );
      });
    });
  });
}

// ------------------------------------------------------------------ Android
//
// DEFECT 1: `getGrantedPermissions()` was never consulted.
//
// `requestPermission()` returns only the permissions granted BY THAT CALL. On a
// second run, where access already exists, it returns an empty array and nothing
// is wrong - but an empty array was read as a decline. So the app could lose an
// access it already had, and record the person as having refused something they
// had in fact allowed.
//
// Asking what is already granted comes first, which also means somebody who has
// already said yes is never prompted twice.
async function requestAndroidStepPermission(): Promise<StepPermissionResult> {
  // Health Connect may not be installed or updated on the device even on a
  // supported OS version.
  const status = await getSdkStatus();
  if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) return 'unsupported';

  const initialized = await initialize();
  if (!initialized) return 'unsupported';

  if (await hasStepsRead()) return 'granted';

  try {
    const granted = await requestPermission([{ accessType: 'read', recordType: 'Steps' }]);
    if (grantsSteps(granted)) return 'granted';
  } catch (err) {
    console.log('STEP PERMISSION (android): requestPermission threw —', err);
  }

  // The fallback that was missing. An empty or unexpected response from the
  // request says nothing on its own; the granted list is the authority.
  if (await hasStepsRead()) return 'granted';

  return 'declined';
}

type MaybePermission = { accessType?: string; recordType?: string };

function grantsSteps(permissions: readonly MaybePermission[] | null | undefined): boolean {
  return (permissions ?? []).some((p) => p?.recordType === 'Steps' && p?.accessType === 'read');
}

async function hasStepsRead(): Promise<boolean> {
  try {
    return grantsSteps(await getGrantedPermissions());
  } catch (err) {
    // Never let this throw into the caller: a failure to READ the permission list
    // is not evidence that permission is absent, and the request path below is
    // still worth trying.
    console.log('STEP PERMISSION (android): getGrantedPermissions failed —', err);
    return false;
  }
}
