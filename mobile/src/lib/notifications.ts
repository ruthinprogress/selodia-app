import * as Notifications from 'expo-notifications';
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

export const DEFAULT_REMINDER_TIMES = ['14:00', '20:00'];
const REMINDER_CHANNEL = 'reminders';

export type ReminderSettings = {
  enabled: boolean;
  times: string[];
  askedAt: string | null;
};

// Foreground behaviour: a reminder that arrives while someone is already IN the
// app is noise - they are plainly not failing to remember.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function loadReminderSettings(): Promise<ReminderSettings | null> {
  const { data } = await supabase
    .from('reminder_settings')
    .select('enabled, times, asked_at')
    .maybeSingle();
  if (!data) return null;
  return {
    enabled: data.enabled,
    times: (data.times as string[]) ?? [],
    askedAt: data.asked_at ?? null,
  };
}

// True when this person has never been asked - the only state in which the
// "would you like help remembering to log?" offer may appear.
export async function shouldOfferReminders(): Promise<boolean> {
  const settings = await loadReminderSettings();
  return settings === null || settings.askedAt === null;
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
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

// Records the answer to the first-log offer, whichever way it went, and puts the
// chosen schedule in place. Saying no is recorded just as deliberately as saying
// yes - that is what stops the offer coming back.
export async function saveReminderChoice(
  userId: string,
  choice: { enabled: boolean; times?: string[] }
): Promise<void> {
  const times = choice.times ?? DEFAULT_REMINDER_TIMES;
  await supabase.from('reminder_settings').upsert({
    user_id: userId,
    enabled: choice.enabled,
    times,
    asked_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  await applyReminderSchedule(choice.enabled ? times : []);
}

// Puts the device's scheduled reminders in sync with `times`.
//
// Cancels everything first rather than diffing: the set is two or three items,
// and a diff that drifts leaves someone with a reminder they cannot turn off,
// which is a far worse failure than a redundant reschedule.
export async function applyReminderSchedule(times: string[]): Promise<void> {
  try {
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
