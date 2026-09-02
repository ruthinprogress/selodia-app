import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ComposerAddSheet } from '@/components/composer-add-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authedPost } from '@/lib/api';
import type { AddSource } from '@/lib/composer-add';
import { classifyAndLog, messageForResult, pickImage } from '@/lib/image-logging';

// Logging from the tab you are already looking at (Part Five).
//
// WHY IT EXISTS. The Food tab told people to go to Chat to log food, and the
// Activity tab did the same. That is a tab that describes its own job and then
// declines to do it — someone looking at today's meals, noticing one is missing,
// had to leave the screen that showed them the gap in order to fill it.
//
// NOTHING NEW BEHIND IT. Text goes to `ask-unflump`, exactly as the Chat
// composer's does, and photos go through `classifyAndLog`, exactly as the Chat
// composer's do. There is no food-tab parser and no activity-tab route: one
// pipeline, reached from a second place. That is the whole design, and it is why
// a meal logged here is indistinguishable downstream from one logged in Chat.
//
// THE THREAD STAYS COMPLETE. `ask-unflump` writes both turns itself, and
// `classifyAndLog` now persists its acknowledgment (see lib/log-turn.ts), so
// whatever is logged here is in the conversation when the person next opens it.
// They simply did not have to go there to do it.
//
// THE PHOTO IS NOT CONSTRAINED TO THE TAB. `classifyAndLog` decides what an
// image is, and a food photo taken on the Activity tab is logged as food. That
// is deliberate: refusing a correct log because of which tab someone happened to
// be on would be a worse answer than logging it from the "wrong" place. The
// acknowledgment says what it did, so nothing is silent about it.

export function QuickLogBar({
  kind,
  onLogged,
}: {
  kind: 'food' | 'activity';
  // Fired after anything lands, so the view above can re-read itself. The point
  // of logging here is seeing it appear here.
  onLogged: () => void;
}) {
  const theme = useTheme();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  // The last thing that happened, in one line. Not a chat thread — this surface
  // logs and gets out of the way, and the conversation is a tab away for anyone
  // who wants it.
  const [note, setNote] = useState<string | null>(null);

  const placeholder =
    kind === 'food' ? 'What did you eat?' : 'What did you do?';

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || busy) return;
    setInput('');
    setBusy(true);
    setNote(null);
    try {
      // The same route the Chat composer posts to, which also writes both turns
      // to the thread — so this costs nothing extra to keep history complete.
      const data = await authedPost<{ saved?: { summary?: string } }>('/api/ask-unflump', {
        message: trimmed,
      });
      setNote(data?.saved?.summary ?? 'Saved.');
      onLogged();
    } catch {
      setNote('That did not save. Worth trying again.');
    } finally {
      setBusy(false);
    }
  }

  async function addPhoto(source: AddSource) {
    setAddOpen(false);
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      const picked = await pickImage(source);
      if (!picked.ok) {
        setNote(
          picked.reason === 'denied'
            ? 'I need permission to reach your photos for that.'
            : picked.reason === 'cancelled'
              ? null
              : 'That image did not come through. Worth trying again.'
        );
        return;
      }
      const result = await classifyAndLog(picked.image);
      setNote(messageForResult(result));
      if (result.status === 'logged') onLogged();
    } catch {
      setNote('That did not save. Worth trying again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemedView style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          onPress={() => setAddOpen(true)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={kind === 'food' ? 'Add a photo of food' : 'Add a photo'}
          hitSlop={Spacing.two}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedView type="backgroundElement" style={[styles.addButton, busy && styles.disabled]}>
            <ThemedText type="smallBold">+</ThemedText>
          </ThemedView>
        </Pressable>

        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          editable={!busy}
          onSubmitEditing={() => void send()}
          returnKeyType="send"
        />

        <Pressable
          onPress={() => void send()}
          disabled={!input.trim() || busy}
          accessibilityRole="button"
          accessibilityLabel="Save this"
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedView
            type="backgroundElement"
            style={[styles.sendButton, (!input.trim() || busy) && styles.disabled]}
          >
            <ThemedText type="smallBold">{busy ? '…' : 'Save'}</ThemedText>
          </ThemedView>
        </Pressable>
      </View>

      {note && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          {note}
        </ThemedText>
      )}

      <ComposerAddSheet
        visible={addOpen}
        onSelect={(source) => void addPhoto(source)}
        onCancel={() => setAddOpen(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two, marginBottom: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  sendButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  note: { paddingHorizontal: Spacing.one },
  pressed: { opacity: 0.6 },
});
