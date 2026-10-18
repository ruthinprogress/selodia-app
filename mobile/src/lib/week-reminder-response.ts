import { cancelWeekReminder } from '@/lib/week-reminders';

// HANDLING "REMOVE THIS REGULAR REMINDER" WHEN IT IS TAPPED.
//
// Ruth, 18 October 2026: "Each time the reminder comes in there should be a way
// to permanently switch off reminders about that item permanently FROM the
// notification alarm without entering the app, so overwhelming ones don't need
// you to go rummaging, you just say 'remove this regular reminder'."
//
// TWO THINGS HAVE TO HAPPEN AND ONLY ONE IS OBVIOUS. The pending alarm is
// cancelled, and the ROW IS MARKED in the database. restoreReminders() rebuilds
// the whole schedule from stored state every time the app launches, so
// cancelling the alarm alone brings the reminder straight back - and it looks
// exactly like the off switch is broken, which is worse than not having one.
//
// WHAT THIS CANNOT DO, STATED PLAINLY. The button is set to not open the app,
// which is the point of it. On a device where the app is not running, the
// response is delivered the next time it launches, so a reminder switched off
// on Tuesday may fire once more before the app is next opened. Everything is
// idempotent, so arriving late is harmless - but it is not instant, and
// pretending otherwise would be the kind of claim this project does not make.

import type * as NotificationsModule from 'expo-notifications';

export const STOP_WEEK_REMINDER = 'stop-week-reminder';

/**
 * Deal with one notification response. Exported on its own so it can be tested
 * without a notification, and so the listener below stays three lines.
 */
export async function handleNotificationResponse(
  response: NotificationsModule.NotificationResponse,
  Notifications: typeof NotificationsModule
): Promise<void> {
  if (response.actionIdentifier !== STOP_WEEK_REMINDER) return;

  const rowId = response.notification.request.content.data?.weekRowId;
  if (typeof rowId !== 'string' || !rowId) return;

  // STORAGE FIRST. If the reschedule below fails - no permission, no network,
  // the module missing on this build - the intent is still recorded and the
  // next launch honours it. The other order loses the decision on any error.
  await cancelWeekReminder(rowId);

  // Then take the pending ones away now, rather than leaving them until the
  // next launch. Everything is rebuilt from storage, which no longer contains
  // this one.
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const item of scheduled) {
      if (item.content.data?.weekRowId === rowId) {
        await Notifications.cancelScheduledNotificationAsync(item.identifier);
      }
    }
  } catch {
    // Already recorded above; the next launch clears it.
  }
}

/**
 * Listen for the button for as long as the app is running.
 *
 * Returns an unsubscribe, or null where notifications are not available on this
 * build - the same shape every other notification helper here uses, so a caller
 * never has to know which case it is in.
 */
export async function listenForWeekReminderActions(): Promise<(() => void) | null> {
  try {
    const Notifications = (await import('expo-notifications')) as typeof NotificationsModule;
    if (!Notifications?.addNotificationResponseReceivedListener) return null;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      void handleNotificationResponse(response, Notifications);
    });
    return () => sub.remove();
  } catch {
    return null;
  }
}
