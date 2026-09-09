export type StepPermissionResult = 'granted' | 'declined' | 'unsupported' | 'unknown';

// No web equivalent of HealthKit/Health Connect exists — always unsupported on web.
// 'unknown' is in the union for parity with the native module rather than because
// the web can ever produce it: the type is shared, so it has to be the same shape.
export async function requestStepPermission(): Promise<StepPermissionResult> {
  return 'unsupported';
}
