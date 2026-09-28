import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { SettingsPage } from '@/components/settings-page';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  FEELINGS,
  STATUS_LABEL,
  myBetaFeedback,
  sendBetaFeedback,
  summarise,
  type BetaFeedbackRow,
  type FeelingId,
} from '@/lib/beta-feedback';
import { lastScreen } from '@/lib/last-screen';
import { humanDate } from '@/lib/week';

// BETA FEEDBACK (Ruth's item 6, 28 September 2026). A wave-one blocker.
//
// NOTHING IS REQUIRED TO PRESS SEND. Her instruction, and it is the design rather
// than a detail. A submission can be one tapped feeling and nothing else, and
// that is complete. A form that asks for a description before it will accept
// anything is a form that collects nothing from somebody holding a toddler, which
// is the exact situation this replaces - three Jotform forms nobody filled in.
//
// ONE TAP FROM WHERE THE PROBLEM WAS. It sits at the top of More, and More is the
// seed mark on every screen, so it is two taps from anywhere and the screen she
// came from is recorded automatically. See lib/last-screen.ts.
//
// WHAT IS ATTACHED AND NOT SHOWN: the screen she came from, the app version, the
// update, the device and the time. Listed in words at the bottom rather than
// presented as fields, because fields invite filling in and this must not.
//
// THE HISTORY BELOW IS NOT DECORATION. Somebody who sends feedback into silence
// stops sending it. Every submission shows sent, read or fixed - three words, not
// a triage vocabulary - so she can see hers was picked up.

export default function BetaFeedbackScreen() {
  const theme = useTheme();
  // A prompted question arrives as a param, so the same screen serves both the
  // volunteered report and the occasional day-3 / day-10 ask.
  const { question } = useLocalSearchParams<{ question?: string }>();

  const [message, setMessage] = useState('');
  const [feelings, setFeelings] = useState<FeelingId[]>([]);
  const [other, setOther] = useState('');
  const [shot, setShot] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [lostShot, setLostShot] = useState(false);
  const [history, setHistory] = useState<BetaFeedbackRow[]>([]);

  const load = useCallback(() => {
    void myBetaFeedback().then(setHistory);
  }, []);
  useEffect(load, [load]);

  const toggle = (id: FeelingId) =>
    setFeelings((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  async function pick() {
    // GALLERY ONLY, and it is a real limitation rather than a choice. Capturing
    // the screen she came from needs a native view-shot module that is not in
    // this build, and adding one would mean a whole new binary to ship a feedback
    // form. Android's own screenshot is one button press and already in her
    // hands, so the gallery is where it will be.
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!res.canceled && res.assets[0]) setShot(res.assets[0].uri);
  }

  async function send() {
    if (sending) return;
    setSending(true);
    setFailed(null);
    const result = await sendBetaFeedback({
      message,
      feelings,
      feelingOther: other,
      screenshotUri: shot,
      question: typeof question === 'string' ? question : null,
    });
    setSending(false);
    if (!result.ok) {
      setFailed(result.reason);
      return;
    }
    setLostShot(result.screenshotLost);
    setSent(true);
    setMessage('');
    setFeelings([]);
    setOther('');
    setShot(null);
    load();
  }

  const from = lastScreen();

  if (sent) {
    return (
      <SettingsPage title="Thank you" subtitle="That has arrived. A person reads every one.">
        <ThemedView style={styles.doneCard} type="backgroundElement">
          <Ionicons name="checkmark-circle-outline" size={34} color={theme.accentDeep} />
          <ThemedText style={styles.doneText}>
            You&apos;ll see it below with a status, so you can tell when it&apos;s been read and
            when it&apos;s been fixed.
          </ThemedText>
          {/* SAID, NOT SWALLOWED. She chose a picture and it did not arrive; a
              silent loss would have her believing we have something we do not. */}
          {lostShot && (
            <ThemedText type="small" style={{ color: theme.accentDeep, lineHeight: 20 }}>
              The screenshot didn&apos;t upload, though the rest did. Worth attaching it again if it
              mattered.
            </ThemedText>
          )}
          <Pressable onPress={() => setSent(false)} accessibilityRole="button" style={styles.again}>
            <ThemedText type="smallBold" themeColor="accentDeep">
              Tell us something else
            </ThemedText>
          </Pressable>
        </ThemedView>
        <History rows={history} />
      </SettingsPage>
    );
  }

  return (
    <SettingsPage
      title="Beta feedback"
      subtitle={
        typeof question === 'string' && question
          ? question
          : 'Anything at all. Nothing here has to be filled in.'
      }
    >
      <ThemedView style={styles.card} type="backgroundElement">
        {from && (
          <ThemedText type="small" themeColor="textSecondary">
            About {from.replace(/^\//, '').replace(/\(tabs\)\//, '') || 'the app'}
          </ThemedText>
        )}

        {/* A PICTURE FIRST, because it is the one thing that needs no words and
            explains more than a paragraph would. */}
        {shot ? (
          <View style={styles.shotRow}>
            {/* alt is for the web renderer; accessibilityLabel is what a phone screen
                reader announces. Both, because this app builds for both. */}
            <Image
              source={{ uri: shot }}
              style={styles.shot}
              alt="The screenshot you attached"
              accessibilityLabel="The screenshot you attached"
            />
            <Pressable onPress={() => setShot(null)} accessibilityRole="button" hitSlop={Spacing.two}>
              <ThemedText type="small" themeColor="accentDeep">
                Remove
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => void pick()}
            accessibilityRole="button"
            style={[styles.attach, { borderColor: theme.backgroundSelected }]}
          >
            <Ionicons name="image-outline" size={20} color={theme.accentDeep} />
            <ThemedText type="small">Add a screenshot</ThemedText>
          </Pressable>
        )}

        <TextInput
          value={message}
          onChangeText={setMessage}
          multiline
          textAlignVertical="top"
          placeholder="What happened, if you want to say"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
          accessibilityLabel="What happened"
          editable={!sending}
        />

        <ThemedText type="smallBold" themeColor="textSecondary">
          Or just how it felt
        </ThemedText>
        <View style={styles.feelings}>
          {FEELINGS.map((f) => {
            const on = feelings.includes(f.id);
            return (
              <Pressable
                key={f.id}
                onPress={() => toggle(f.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[
                  styles.feeling,
                  {
                    backgroundColor: on ? theme.accentDeep : 'transparent',
                    borderColor: on ? theme.accentDeep : theme.backgroundSelected,
                  },
                ]}
              >
                <ThemedText type="small" style={on ? { color: theme.background } : undefined}>
                  {f.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {feelings.includes('other') && (
          <TextInput
            value={other}
            onChangeText={setOther}
            placeholder="What was it?"
            placeholderTextColor={theme.textSecondary}
            style={[styles.otherInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
            accessibilityLabel="Something else"
            editable={!sending}
          />
        )}

        {/* NEVER DISABLED. Nothing is required, so there is no state in which
            this button should refuse - and a greyed-out Send is the app telling
            somebody their feedback is not good enough yet. */}
        <Pressable
          onPress={() => void send()}
          disabled={sending}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.send,
            { backgroundColor: theme.accentDeep, opacity: sending ? 0.4 : pressed ? 0.8 : 1 },
          ]}
        >
          <ThemedText type="smallBold" style={{ color: theme.background }}>
            {sending ? 'Sending…' : 'Send beta feedback'}
          </ThemedText>
        </Pressable>

        {failed && (
          <ThemedText type="small" style={{ color: theme.accentDeep, lineHeight: 20 }}>
            That didn&apos;t send just now, and everything you put in is still here. Worth another go
            in a moment.
          </ThemedText>
        )}
      </ThemedView>

      <View style={styles.attached}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          Sent with it
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.attachedLine}>
          The screen you came from, which build you&apos;re on, your phone and the time. Nothing you
          have logged: no food, no weight, no measurements, nothing from your conversations.
        </ThemedText>
      </View>

      <History rows={history} />
    </SettingsPage>
  );
}

// HER OWN SUBMISSIONS, in the Log tabs' day-list shape - newest day first, each
// entry a row under it. Her instruction, and it is the right one: it is the
// pattern she already reads everywhere else in the app.
function History({ rows }: { rows: BetaFeedbackRow[] }) {
  const theme = useTheme();
  if (rows.length === 0) return null;

  const byDay = new Map<string, BetaFeedbackRow[]>();
  for (const r of rows) {
    const key = r.created_at.slice(0, 10);
    const list = byDay.get(key);
    if (list) list.push(r);
    else byDay.set(key, [r]);
  }

  return (
    <View style={styles.history}>
      <ThemedText type="smallBold" style={styles.historyHeading}>
        What you&apos;ve sent
      </ThemedText>
      {[...byDay.entries()].map(([day, items]) => (
        <View key={day} style={styles.day}>
          <ThemedText type="small" themeColor="textSecondary">
            {humanDate(new Date(`${day}T12:00:00`))}
          </ThemedText>
          <ThemedView type="backgroundElement" style={[styles.dayCard, { borderColor: theme.backgroundSelected }]}>
            {items.map((r, i) => (
              <View
                key={r.id}
                style={[
                  styles.entry,
                  i < items.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth },
                  { borderBottomColor: theme.backgroundSelected },
                ]}
              >
                <View style={styles.entryText}>
                  <ThemedText type="small" numberOfLines={2}>
                    {summarise(r)}
                  </ThemedText>
                  {r.question && (
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      Answering: {r.question}
                    </ThemedText>
                  )}
                </View>
                <ThemedText
                  type="small"
                  themeColor={r.status === 'fixed' ? 'accentDeep' : 'textSecondary'}
                >
                  {STATUS_LABEL[r.status]}
                </ThemedText>
              </View>
            ))}
          </ThemedView>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, borderRadius: CardRadius, gap: Spacing.three },
  attach: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    justifyContent: 'center',
  },
  shotRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  shot: { width: 64, height: 110, borderRadius: Spacing.two },
  input: {
    minHeight: 96,
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    fontSize: 15,
    lineHeight: 22,
  },
  otherInput: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
  },
  feelings: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  feeling: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  send: {
    alignSelf: 'flex-end',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: 999,
  },
  attached: { gap: Spacing.one, paddingHorizontal: Spacing.one, paddingTop: Spacing.four },
  attachedLine: { lineHeight: 20 },
  doneCard: { padding: Spacing.four, borderRadius: CardRadius, gap: Spacing.three, alignItems: 'flex-start' },
  doneText: { lineHeight: 22 },
  again: { paddingVertical: Spacing.one },
  history: { paddingTop: Spacing.five, gap: Spacing.three },
  historyHeading: { paddingHorizontal: Spacing.one },
  day: { gap: Spacing.one },
  dayCard: { borderWidth: 1, borderRadius: Spacing.three, overflow: 'hidden' },
  entry: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  entryText: { flex: 1, minWidth: 0, gap: 2 },
});
