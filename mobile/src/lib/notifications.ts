import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

import { nextFireTime } from '@/lib/quiet-hours';
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

// Registers this device for server-initiated delivery (the roundups). Returns
// null when permission is refused or when running somewhere without push, and
// never throws - a failure here must never break the log that triggered it.
export async function registerPushToken(userId: string): Promise<string | null> {
  try {
    const Notifications = await loadNotifications();
    if (!Notifications) return null;
    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!granted) return null;

    await ensureAndroidChannel();
    const { data: token } = await Notifications.getExpoPushTokenAsync();
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
          title: 'Unflump',
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
