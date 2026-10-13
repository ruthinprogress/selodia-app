import { useState } from 'react';
import { Linking, Pressable, Share, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isEmail, mailtoFor, type Draft } from '@/lib/draft';

// SOMETHING WRITTEN FOR HER TO SEND, under the reply that offers it.
//
// The step her Ruth's Health project does and Selodía could not: "Claude drafts
// the output ready to use ... Ruth's effort: copy, paste, submit." See
// app/lib/draft.ts for how it is written and why it is a separate call.
//
// SHARE, NOT A COPY BUTTON. There is no clipboard module in the installed app,
// and a new native module cannot arrive as an update - it would mean a new build
// and a reinstall. React Native's own Share sheet needs nothing new, is already
// used by the data export, and on both iPhone and Android offers Copy alongside
// email, messages and everything else. The text is also selectable, so a long
// press copies part of it.
//
// IT DOES NOT SEND ANYTHING. The sheet is the phone's own; she chooses where it
// goes, or copies it, or closes it. Nothing leaves the app without her tap.

// AN EMAIL OPENS IN HER EMAIL APP (Ruth, 13 October 2026: "Write the draft
// email directly into an email client draft with header and email address
// populated"). A mailto link needs no native module, so it ships as an update.
// It opens a draft - the address, subject and message filled in - and the send
// button is still hers. The address is only there when it was found in her
// record or the conversation; otherwise the To line is empty for her to fill.
export function DraftCard({ draft }: { draft: Draft }) {
  const { title, body } = draft;
  const theme = useTheme();
  const [note, setNote] = useState<string | null>(null);
  const email = isEmail(draft);

  async function openEmail() {
    setNote(null);
    try {
      await Linking.openURL(mailtoFor(draft));
    } catch {
      setNote("Your email app didn't open. Use Send or copy instead.");
    }
  }

  async function share() {
    setNote(null);
    try {
      await Share.share({ message: body, title });
    } catch {
      // A sheet that cannot open is said, not swallowed: she is holding a draft
      // she means to send, and silence would read as the button doing nothing.
      setNote("That didn't open. Press and hold the text to copy it instead.");
    }
  }

  return (
    <ThemedView type="backgroundSelected" style={styles.card}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {email ? (
        <View style={styles.header}>
          <ThemedText type="detail" themeColor="textSecondary" selectable>
            To: {draft.to ?? 'add the address when it opens'}
          </ThemedText>
          {draft.subject ? (
            <ThemedText type="detail" themeColor="textSecondary" selectable>
              Subject: {draft.subject}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
      <ThemedText type="small" selectable style={styles.body}>
        {body}
      </ThemedText>
      <View style={styles.row}>
        {email ? (
          <Pressable
            onPress={() => void openEmail()}
            accessibilityRole="button"
            accessibilityLabel={`Open in your email app: ${title}`}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <ThemedView style={[styles.button, { backgroundColor: theme.accentDeep }]}>
              <ThemedText type="smallBold" themeColor="background">
                Open in email
              </ThemedText>
            </ThemedView>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => void share()}
          accessibilityRole="button"
          accessibilityLabel={`Send or copy: ${title}`}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedView style={[styles.button, { backgroundColor: theme.accentDeep }]}>
            <ThemedText type="smallBold" themeColor="background">
              Send or copy
            </ThemedText>
          </ThemedView>
        </Pressable>
      </View>
      {note && (
        <ThemedText type="small" themeColor="textSecondary">
          {note}
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: CardRadius, padding: Spacing.three, gap: Spacing.two, marginTop: Spacing.two },
  body: { lineHeight: 20 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one },
  header: { gap: 2 },
  button: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, borderRadius: Spacing.four },
  pressed: { opacity: 0.6 },
});
