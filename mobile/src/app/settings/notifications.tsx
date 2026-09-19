import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CustomReminderList } from '@/components/custom-reminder-list';
import { SettingsGroup, SettingsPage, SettingsRow } from '@/components/settings-page';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { syncRemindersNow } from '@/lib/notifications';
import { DEFAULT_REMINDER_TIMES, loadReminderSettings, persistReminderChoice } from '@/lib/reminder-settings';
import { supabase } from '@/lib/supabase';

// NOTIFICATIONS (2026-09-20). Daily prompts were offered once, in conversation,
// and after that the answer could not be changed anywhere: a yes was permanent
// and a no was final. The same fault step tracking had, and the same fix -
// the way out sits where the way in is.
//
// NOT EVERY SWITCH IN HER BRIEF. Insight notifications and feature
// announcements do not exist, and a toggle for a notification that is never
// sent is a promise the app cannot keep. Quiet hours are not built either: the
// two prompt times ARE the quiet hours in practice, and a second mechanism
// deciding when to stay silent would be a way for them to disagree.
export default function NotificationsScreen() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [times, setTimes] = useState<string[]>(DEFAULT_REMINDER_TIMES);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadReminderSettings().then((s) => {
      if (cancelled) return;
      setEnabled(s?.enabled ?? false);
      if (s?.times?.length) setTimes(s.times);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function set(next: boolean) {
    if (busy) return;
    setBusy(true);
    const before = enabled;
    setEnabled(next);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('no session');
      await persistReminderChoice(user.id, { enabled: next, times });
      // The phone's own schedule is rebuilt from the stored answer, so turning
      // them off cancels what is already queued rather than leaving it to fire.
      await syncRemindersNow();
    } catch {
      setEnabled(before ?? false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsPage
      title="Notifications"
      subtitle="Choose when, and whether, you hear from Selodía."
      footer="A little reminder can go a long way."
    >
      <SettingsGroup title="Daily check-in">
        <SettingsRow
          first
          icon="notifications-outline"
          label="Daily log reminders"
          detail={
            enabled === null
              ? ' '
              : enabled
                ? `A gentle nudge at ${times.join(' and ')}`
                : 'Off. Selodía will not prompt you.'
          }
          value={enabled === null ? '' : enabled ? 'On' : 'Off'}
        />
        <View style={styles.switchRow}>
          <Pressable
            onPress={() => void set(!enabled)}
            disabled={busy || enabled === null}
            accessibilityRole="switch"
            accessibilityState={{ checked: enabled ?? false }}
            accessibilityLabel="Daily log reminders"
            style={({ pressed }) => pressed && styles.pressed}
          >
            <ThemedView type="backgroundSelected" style={styles.action}>
              <ThemedText type="smallBold">
                {busy ? 'Saving…' : enabled ? 'Turn off reminders' : 'Turn on reminders'}
              </ThemedText>
            </ThemedView>
          </Pressable>
        </View>
      </SettingsGroup>

      <CustomReminderList />

      <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
        The weekly review arrives in the conversation when you next open the app after Sunday,
        rather than as a notification, so nothing about your week lands on your lock screen.
      </ThemedText>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  switchRow: { paddingBottom: Spacing.three },
  action: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  note: { lineHeight: 20 },
  pressed: { opacity: 0.6 },
});
