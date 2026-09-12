import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

import { nextFireTime } from '@/lib/quiet-hours';
import { loadReminderSettings } from '@/lib/reminder-settings';
import { supabase } from '@/lib/supabase';

// Push delivery (Part Fourteen).
//
// PERMISSION IS ASKED AT THE FIRST LOG, never as a generic upfront prompt - the
// spec is explicit, and the reason is that a permission dialog before someone
// has any reason to want reminders is asking for trust that has not been earned
// yet. `reminder_settings` therefore distinguishes THREE states, not two:
//   - no row      -> never asked
//   - asked_at set, enabled false -> asked, and they said no. Never ask again.
//   - enabled true -> reminders on
// Collapsing the last two would re-ask someone who already declined, which is
// exactly the nagging the whole app is written against.
//
// The daily reminders themselves are scheduled LOCALLY on the device rather than
// pushed from a server. They are a fixed daily time with no content that has to
// be computed, so a server round trip would add a backend, a cron and a failure
// mode for no gain. Push tokens are still registered, because the roundups DO
// need server-initiated delivery.

export { DEFAULT_REMINDER_TIMES, loadReminderSettings, shouldOfferReminders } from '@/lib/reminder-settings';

const REMINDER_CHANNEL = 'reminders';

// Is expo-notifications' NATIVE side actually in this binary?
//
// requireOptionalNativeModule returns null instead of throwing, and lives in
// expo-modules-core, which is present in every build. So this is the one probe
// that can ask the question without being the thing that breaks.
//
// It has to be asked BEFORE importing expo-notifications, not inside a try/catch
// around the import: the throw happens while the module EVALUATES, and Metro
// surfaces that as an uncaught error rather than a rejected promise.
export function isPushAvailable(): boolean {
  return requireOptionalNativeModule('ExpoPushTokenManager') != null;
}

type NotificationsModule = typeof import('expo-notifications');

let cached: NotificationsModule | null | undefined;

async function loadNotifications(): Promise<NotificationsModule | null> {
  if (cached !== undefined) return cached;
  if (!isPushAvailable()) {
    cached = null;
    return null;
  }
  try {
    const mod = await import('expo-notifications');
    // A reminder arriving while someone is already IN the app is noise - they
    // are plainly not failing to remember. Set here rather than at module scope.
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: false,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    cached = mod;
  } catch {
    cached = null;
  }
  return cached;
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  const Notifications = await loadNotifications();
  if (!Notifications) return;
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    // No sound and no vibration: this is a gentle nudge to log, not an alarm,
    // and Part Fourteen's whole posture is uninsistent.
    sound: null,
    vibrationPattern: [0],
    enableVibrate: false,
  });
}

// Permission, with the Android channel created FIRST.
//
// THE ORDER IS THE FIX (2026-09-12). On Android 13 and later the system prompt
// "will not appear until at least one notification channel is created" (Expo 57
// docs). This used to ask first and create the channel afterwards, so on any
// recent phone the prompt never showed, permission came back not granted, and
// registration returned null without a word. That is the third independent
// reason push never worked, and the one that would have survived the other two
// being fixed.
//
// `mayPrompt: false` checks without asking. That is how the launch-time restore
// honours a yes already given without ever becoming a nag.
async function ensurePermission(
  Notifications: NotificationsModule,
  mayPrompt: boolean
): Promise<boolean> {
  await ensureAndroidChannel();
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  if (!mayPrompt || !existing.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

// Registers this device for server-initiated delivery (the roundups). Returns
// null when permission is refused or when running somewhere without push, and
// never throws - a failure here must never break the log that triggered it.
export async function registerPushToken(
  userId: string,
  { mayPrompt = true }: { mayPrompt?: boolean } = {}
): Promise<string | null> {
  try {
    const Notifications = await loadNotifications();
    if (!Notifications) return null;
    if (!(await ensurePermission(Notifications, mayPrompt))) return null;

    // THE projectId IS REQUIRED, and omitting it is why this never worked.
    //
    // Called bare, `getExpoPushTokenAsync()` throws in any build that is not Expo
    // Go - which is every build this app has ever shipped. The catch below then
    // logged "non-fatal" and returned null, so the failure was completely silent:
    // `push_tokens` held ZERO rows on 2026-09-10, not none since the package
    // rename but none ever, while `reminder_settings` had real rows from people
    // who had said yes to reminders they were never going to receive.
    //
    // Read from the resolved config rather than hardcoded, so the dev variant and
    // the store build each report their own project without a second constant to
    // keep in step.
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      console.log('push registration: no EAS projectId in the resolved config');
      return null;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return null;

    // One row per DEVICE. onConflict on the token means a reinstall that hands
    // back the same token refreshes it rather than duplicating.
    await supabase
      .from('push_tokens')
      .upsert(
        { user_id: userId, token, platform: Platform.OS, last_seen_at: new Date().toISOString() },
        { onConflict: 'token' }
      );
    return token;
  } catch (err) {
    console.log('push registration failed (non-fatal):', err instanceof Error ? err.message : err);
    return null;
  }
}

// Records the choice AND puts the schedule in place. The storage half works on
// any binary; the scheduling half quietly does nothing where push is absent.
export async function saveReminderChoice(
  userId: string,
  choice: { enabled: boolean; times?: string[] }
): Promise<void> {
  const { persistReminderChoice } = await import('@/lib/reminder-settings');
  const times = await persistReminderChoice(userId, choice);
  await applyReminderSchedule(times);
}

// Puts the device's scheduled reminders in sync with `times`.
//
// Cancels everything first rather than diffing: the set is two or three items,
// and a diff that drifts leaves someone with a reminder they cannot turn off,
// which is a far worse failure than a redundant reschedule.
export async function applyReminderSchedule(times: string[]): Promise<void> {
  try {
    const Notifications = await loadNotifications();
    if (!Notifications) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (times.length === 0) return;
    await ensureAndroidChannel();

    for (const hhmm of times) {
      const fire = nextFireTime(hhmm);
      if (!fire) continue;
      await Notifications.scheduleNotificationAsync({
        content: {
          // No streak, no count, no "don't break the chain" - Part Fourteen and
          // the hydration rule are both explicit that none of this is gamified.
          title: 'Selodía',
          body: 'Here whenever you want to log something.',
          data: { destination: 'chat' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: fire.getHours(),
          minute: fire.getMinutes(),
          channelId: REMINDER_CHANNEL,
        },
      });
    }
  } catch (err) {
    console.log('reminder scheduling failed (non-fatal):', err instanceof Error ? err.message : err);
  }
}

// Brings THIS DEVICE back in line with a reminder choice already made.
//
// WHY IT EXISTS (2026-09-12). The offer card asks once, ever, and it was the only
// thing that registered a token or scheduled a reminder. So a yes given on a build
// where push was broken was recorded, never asked again, and never acted on again.
// And because reminders are scheduled locally, uninstalling the old package on
// 2026-09-10 wiped them. Ruth had said yes to 2pm and 8pm and received nothing
// after that. reminder-offer.tsx promised "a later build honours it without
// re-asking"; nothing did. This is what does.
//
// Runs once per launch for a signed-in person whose stored choice is enabled.
// It never shows the offer again and never overrides a no.
//
// THE OS PERMISSION PROMPT IS ALLOWED ONCE PER INSTALL, and only here. A reinstall
// on Android loses notification permission, so honouring the yes means asking the
// OS once (agreed with Ruth, 2026-09-12). If they refuse, that is the answer for
// this install and launch never asks again. Granting it later in system settings
// is still picked up on the next launch, because the check without prompting
// runs every time.
const PROMPTED_KEY = 'selodia.reminders.permission-prompted';

export async function restoreReminders(userId: string): Promise<void> {
  try {
    const settings = await loadReminderSettings();
    if (!settings?.enabled) return;
    const Notifications = await loadNotifications();
    if (!Notifications) return;

    const prompted = (await AsyncStorage.getItem(PROMPTED_KEY)) !== null;
    if (!prompted) await AsyncStorage.setItem(PROMPTED_KEY, new Date().toISOString());
    if (!(await ensurePermission(Notifications, !prompted))) return;

    await registerPushToken(userId, { mayPrompt: false });
    await applyReminderSchedule(settings.times);
  } catch (err) {
    console.log('reminder restore failed (non-fatal):', err instanceof Error ? err.message : err);
  }
}
