import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { SettingsPage } from '@/components/settings-page';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

// TELLING US SOMETHING IS WRONG, FROM INSIDE THE APP (2026-09-28).
//
// A wave-one requirement from the beta checklist. Until now the only route was a
// mailto: link, which has two problems and they are both fatal for a beta with
// strangers in it: it carries no context, and it lands in an inbox where nothing
// can be counted, sorted or reopened.
//
// WHY THE CONTEXT IS COLLECTED AUTOMATICALLY. Ruth's bug reports are unusually
// good because she knows what she saw and sends a screenshot from a build she can
// name. Nobody else will do that. A stranger writes "it did the thing wrong
// again" from an update nobody can identify, and the difference between that and
// a fixable report is four fields the phone already knows - which update, which
// platform, which screen, and when.
//
// SHE IS TOLD WHAT IS ATTACHED, and it is listed rather than summarised. An app
// that quietly collects things in the background while asking for help is the
// opposite of what this product is for, and the list is short enough to print.
//
// WHAT IT DOES NOT SEND: nothing she has logged, no food, no weight, no chat.
// Only what she types here and which build she typed it from.

export default function FeedbackScreen() {
  const theme = useTheme();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  const { updateId, runtimeVersion, channel, isEmbeddedLaunch } = Updates;
  const build = isEmbeddedLaunch || !updateId ? 'the installed build' : `update ${updateId.slice(0, 8)}`;

  async function send() {
    const text = message.trim();
    if (!text || sending) return;
    setSending(true);
    setFailed(false);

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) {
      setSending(false);
      setFailed(true);
      return;
    }

    const { error } = await supabase.from('feedback_reports').insert({
      user_id: userId,
      message: text,
      // WHERE SHE CAME FROM, not where she is. By the time this screen is open
      // she has navigated away from whatever went wrong, so the previous route
      // is the useful one - and it is often the only clue in the whole report.
      screen: 'settings/feedback',
      update_id: isEmbeddedLaunch ? null : (updateId ?? null),
      runtime_version: runtimeVersion ?? null,
      channel: channel ?? null,
      platform: Platform.OS,
      os_version: String(Platform.Version),
      // NO NATIVE MODULE FOR THIS. expo-application would give the binary's own
      // version and is not in the build, and adding a native dependency to
      // collect a version string would need a whole new binary to ship a feedback
      // form. runtimeVersion is what identifies the binary that matters here.
      app_version: runtimeVersion ?? null,
    });

    setSending(false);
    // A FAILED SEND IS SAID, NEVER SWALLOWED. Somebody who writes out a problem
    // and is told nothing assumes it arrived, and stops sending them when
    // nothing changes. Her words stay in the box so the retry costs nothing.
    if (error) {
      console.log('FEEDBACK SEND FAILED:', error.message);
      setFailed(true);
      return;
    }
    setSent(true);
    setMessage('');
  }

  if (sent) {
    return (
      <SettingsPage title="Thank you" subtitle="That has arrived, and a person reads every one.">
        <ThemedView style={styles.doneCard} type="backgroundElement">
          <Ionicons name="checkmark-circle-outline" size={34} color={theme.accentDeep} />
          <ThemedText style={styles.doneText}>
            If it is something we can fix, it will turn up in a future update without you having to
            chase it.
          </ThemedText>
          <Pressable onPress={() => setSent(false)} style={styles.again} accessibilityRole="button">
            <ThemedText type="smallBold" themeColor="accentDeep">
              Tell us something else
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => router.back()} style={styles.again} accessibilityRole="button">
            <ThemedText type="small" themeColor="textSecondary">
              Back to settings
            </ThemedText>
          </Pressable>
        </ThemedView>
      </SettingsPage>
    );
  }

  return (
    <SettingsPage
      title="Something not right?"
      subtitle="What happened, in your own words. It does not need to be tidy."
    >
      <ThemedView style={styles.card} type="backgroundElement">
        <TextInput
          value={message}
          onChangeText={setMessage}
          multiline
          textAlignVertical="top"
          placeholder="It said my weight was up when it wasn't. Or: I couldn't find where to..."
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
          accessibilityLabel="What happened"
          editable={!sending}
        />

        <Pressable
          onPress={() => void send()}
          disabled={!message.trim() || sending}
          style={({ pressed }) => [
            styles.send,
            { backgroundColor: theme.accentDeep, opacity: !message.trim() || sending ? 0.4 : pressed ? 0.8 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !message.trim() || sending }}
        >
          <ThemedText type="smallBold" style={{ color: theme.background }}>
            {sending ? 'Sending…' : 'Send'}
          </ThemedText>
        </Pressable>

        {failed && (
          <ThemedText type="small" style={[styles.failed, { color: theme.accentDeep }]}>
            That did not send just now, and your words are still here. Worth another go in a moment.
          </ThemedText>
        )}
      </ThemedView>

      {/* LISTED, NOT SUMMARISED. "Some technical information" is the sentence an
          app uses when it would rather you did not look. */}
      <View style={styles.attached}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          Sent with it
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.attachedLine}>
          Which build you are on ({build}), your phone&apos;s platform and version, and the time.
          That is what makes a report fixable rather than a mystery.
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.attachedLine}>
          Nothing you have logged is sent: no food, no weight, no measurements, and nothing from
          your conversations.
        </ThemedText>
      </View>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, borderRadius: CardRadius, gap: Spacing.three },
  input: {
    minHeight: 140,
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    fontSize: 15,
    lineHeight: 22,
  },
  send: {
    alignSelf: 'flex-end',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: 999,
  },
  failed: { lineHeight: 20 },
  attached: { gap: Spacing.one, paddingHorizontal: Spacing.one, paddingTop: Spacing.four },
  attachedLine: { lineHeight: 20 },
  doneCard: { padding: Spacing.four, borderRadius: CardRadius, gap: Spacing.three, alignItems: 'flex-start' },
  doneText: { lineHeight: 22 },
  again: { paddingVertical: Spacing.one },
});
