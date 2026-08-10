export type StepPermissionResult = 'granted' | 'declined' | 'unsupported';

// No web equivalent of HealthKit/Health Connect exists — always unsupported on web
export async function requestStepPermission(): Promise<StepPermissionResult> {
  return 'unsupported';
}
