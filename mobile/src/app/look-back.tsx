import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ButtonRadius, CardRadius, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  LOOKBACK_ANSWERS,
  LOOKBACK_NOTE_LABEL,
  LOOKBACK_NOTE_PLACEHOLDER,
  LOOKBACK_QUESTION,
  LOOKBACK_SUBTITLE,
  LOOKBACK_TODAY_HEADING,
  startedHeading,
  type LookbackAnswer,
} from '@/lib/feel-goals';
import { supabase } from '@/lib/supabase';

// LOOKING BACK ON HOW HER DAYS FEEL.
//
// Ruth, item 7: "Each look-back is a row with one of four answers (further /
// same / a bit closer / closer) and an optional note. No scores, streaks,
// counters or percentages."
//
// IT SHOWS HER WHAT SHE SAID AT THE START, which is the only reason the question
// can be answered at all. "How are your days feeling?" with nothing to compare
// against is a mood check; with her own chips and her own sentence from the day
// she began, it is a comparison she can actually make. That is what started_at is
// for.
//
// NOTHING IS COUNTED. There is no streak, no total, no "third look-back", no
// percentage and no graph. The four answers are stored as words. Her previous
// answers are not shown as a trend, and this screen does not say whether she is
// doing well - because a look-back that grades her is the thing the whole design
// is avoiding.
//
// REACHED BY A TAP, NOT BY A NUDGE, unless she chose Guide me. Her instruction:
// "The look-back is nudged ONLY if she chose Guide me; otherwise only by tap in
// Plans." This screen does not care how it was opened; the nudge lives where the
// pace preference is read.

export default function LookBackScreen() {
  const theme = useTheme();
  const [loaded, setLoaded] = useState(false);
  const [chips, setChips] = useState<string[]>([]);
  const [ownWords, setOwnWords] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [answer, setAnswer] = useState<LookbackAnswer | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('feel_goals')
        .select('label, source, started_at')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('sort_order', { ascending: true });
      if (!live || error) return;
      const rows = data ?? [];
      setChips(rows.filter((r) => r.source === 'chip').map((r) => String(r.label)));
      const hers = rows.find((r) => r.source === 'her words');
      setOwnWords(hers ? String(hers.label) : null);
      // THE EARLIEST START, because the snapshot is when she began rather than
      // when the last row happened to be written.
      const earliest = rows
        .map((r) => String(r.started_at))
        .filter(Boolean)
        .sort()[0];
      setStartedAt(earliest ?? null);
      setLoaded(true);
    })();
    return () => {
      live = false;
    };
  }, []);

  async function save() {
    if (saving || !answer) return;
    setFailed(false);
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      setFailed(true);
      return;
    }
    const { error } = await supabase.from('feel_lookbacks').insert({
      user_id: user.id,
      // ABOUT HER DAYS AS A WHOLE, which is what the screen asks. See the
      // migration: feel_goal_id stays null for this.
      feel_goal_id: null,
      answer,
      note: note.trim() || null,
    });
    setSaving(false);
    if (error) {
      setFailed(true);
      return;
    }
    router.back();
  }

  if (!loaded) return null;

  // NOTHING TO LOOK BACK ON IS SAID PLAINLY, not left as an empty screen. She
  // can reach this before ever answering question 1.
  if (chips.length === 0 && !ownWords) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.content}>
            <ThemedText type="sectionTitle">{LOOKBACK_QUESTION}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              You have not said yet how you want your days to feel, so there is nothing to compare
              against. Say so in chat, or in setup, and this will have something to show.
            </ThemedText>
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ThemedText type="sectionTitle">{LOOKBACK_QUESTION}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {LOOKBACK_SUBTITLE}
          </ThemedText>

          {/* WHAT SHE SAID AT THE START. Without this the question has nothing
              behind it. Her chips as she chose them, her sentence as she wrote
              it, and the date she began. */}
          <ThemedView type="backgroundElement" style={styles.snapshot}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.eyebrow}>
              {startedHeading(startedAt)}
            </ThemedText>
            {chips.length > 0 && (
              <ThemedText type="small">{chips.join(' · ')}</ThemedText>
            )}
            {ownWords && (
              <ThemedText type="small" themeColor="textSecondary">
                {ownWords}
              </ThemedText>
            )}
          </ThemedView>

          <ThemedText type="small" themeColor="textSecondary" style={styles.eyebrow}>
            {LOOKBACK_TODAY_HEADING}
          </ThemedText>
          <View style={styles.answers}>
            {LOOKBACK_ANSWERS.map((option) => {
              const on = answer === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setAnswer(option.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={option.label}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <ThemedView
                    type={on ? 'backgroundSelected' : 'backgroundElement'}
                    style={[styles.answer, { borderColor: on ? theme.accentDeep : 'transparent' }]}>
                    <ThemedText type="small" themeColor={on ? 'accentDeep' : 'text'}>
                      {option.label}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              );
            })}
          </View>

          <ThemedText type="small">{LOOKBACK_NOTE_LABEL}</ThemedText>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={LOOKBACK_NOTE_PLACEHOLDER}
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel={LOOKBACK_NOTE_LABEL}
            multiline
            style={[styles.field, { color: theme.text, borderColor: theme.backgroundSelected }]}
          />

          {failed && (
            <ThemedText type="small" themeColor="danger">
              That didn&apos;t save. Check your connection and try again.
            </ThemedText>
          )}

          <Pressable
            onPress={() => void save()}
            disabled={!answer || saving}
            accessibilityRole="button"
            accessibilityLabel="Save how your days feel"
            accessibilityState={{ disabled: !answer || saving }}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView
              type={answer && !saving ? 'backgroundSelected' : 'backgroundElement'}
              style={styles.saveButton}>
              <ThemedText
                type="smallBold"
                themeColor={answer && !saving ? 'accentDeep' : 'textSecondary'}>
                {saving ? 'Saving…' : 'Save'}
              </ThemedText>
            </ThemedView>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.six,
    gap: Spacing.three,
  },
  snapshot: { padding: Spacing.four, borderRadius: CardRadius, gap: Spacing.two },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 0.8 },
  answers: { gap: Spacing.two },
  answer: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: ButtonRadius,
    borderWidth: 1,
  },
  field: {
    borderWidth: 1,
    borderRadius: CardRadius,
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 112,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  saveButton: {
    paddingVertical: Spacing.three,
    borderRadius: ButtonRadius,
    alignItems: 'center',
  },
  pressed: { opacity: 0.7 },
});
