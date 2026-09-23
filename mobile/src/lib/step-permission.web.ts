export type StepPermissionResult = 'granted' | 'declined' | 'unsupported' | 'unknown';

// No web equivalent of HealthKit/Health Connect exists — always unsupported on web.
// 'unknown' is in the union for parity with the native module rather than because
// the web can ever produce it: the type is shared, so it has to be the same shape.
export async function requestStepPermission(): Promise<StepPermissionResult> {
  return 'unsupported';
}

// AN OVERRIDE HAS TO EXPORT EVERYTHING THE REAL FILE DOES (23 September 2026).
// This one was missing releaseStepPermission, which step-tracking.tsx imports
// and calls when somebody turns step tracking off. On web Metro resolves this
// file instead of the native one, so the name was simply undefined and the
// switch threw a TypeError.
//
// Nothing to release: there is no permission on the web to give back. It is a
// no-op rather than an absence, because an absent export is a crash and a
// no-op is the truth.
export async function releaseStepPermission(): Promise<void> {
  return;
}
