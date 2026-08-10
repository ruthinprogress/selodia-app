import { Platform } from 'react-native';
import AppleHealthKit, { type HealthKitPermissions } from 'react-native-health';
import { getSdkStatus, initialize, requestPermission, SdkAvailabilityStatus } from 'react-native-health-connect';

export type StepPermissionResult = 'granted' | 'declined' | 'unsupported';

export async function requestStepPermission(): Promise<StepPermissionResult> {
  if (Platform.OS === 'ios') return requestIOSStepPermission();
  if (Platform.OS === 'android') return requestAndroidStepPermission();
  return 'unsupported';
}

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
        resolve(error ? 'declined' : 'granted');
      });
    });
  });
}

async function requestAndroidStepPermission(): Promise<StepPermissionResult> {
  // Health Connect may not be installed/updated on the device even on a supported OS version
  const status = await getSdkStatus();
  if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) return 'unsupported';

  const initialized = await initialize();
  if (!initialized) return 'unsupported';

  const granted = await requestPermission([{ accessType: 'read', recordType: 'Steps' }]);
  return granted.length > 0 ? 'granted' : 'declined';
}
