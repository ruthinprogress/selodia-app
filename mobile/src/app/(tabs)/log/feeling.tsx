import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { BodyScreen } from '@/components/body-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { currentUserId } from '@/lib/current-user';
import { MEASURES, ratingsByMeasure, type Rating } from '@/lib/daily-ratings';
import { supabase } from '@/lib/supabase';

// HOW TODAY FELT (Ruth, 21 September 2026).
//
// She had taken mood out of the Log in September and put it back this
// afternoon, with the reasoning intact:
//
//   "it was something I didnt want because before we had a different approach
//   but it's sort of evolved as i realised that just voice logging meant that
//   users had no idea what was available ... catching things like low mood
//   always 2 days after cocktails eg, could genuinely be unknown to a user and
//   needs something to check if Ai says it."
//
// And then, immediately: "Not just mood, energy levels, etc."
//
// SO THIS SCREEN IS A LIST OF MEASURES, NOT A MOOD FORM. Mood and energy ship;
// anything added to MEASURES appears here with no change to this file. That is
// the difference between a screen about mood and a screen about how a day felt.
//
// FIVE WORDS PER MEASURE, ONE TAP EACH. The whole thing is two taps and a
// closed keyboard, because a wellbeing check-in that takes a minute is one
// nobody does on the day they most need to.
//
// THE NOTE IS WHERE THE ANSWER USUALLY IS. "Flat" is a data point; "flat,
// second bad night in a row" is the thing that explains a fortnight.

function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shift(day: string, by: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
}

function human(day: string): string {
  if (day === today()) return 'Today';
  if (day === shift(today(), -1)) return 'Yesterday';
  const d = new Date(`${day}T12:00:00Z`);
  return isNaN(d.getTime())
    ? day
    : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function FeelingScreen() {
  const theme = useTheme();
  const router = useRouter();
  // ARRIVING ON A PARTICULAR DAY, because the Cycle page asks about the day it
  // is showing rather than about today. Landing on today after tapping a
  // question about last Tuesday would answer the wrong question.
  const params = useLocalSearchParams<{ day?: string }>();
  const asked = typeof params.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.day) ? params.day : null;
  const [day, setDay] = useState(asked ?? today());
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [filled, setFilled] = useState<'said' | 'spanned' | null>(null);

  // IN HINDSIGHT, LIKE THE CYCLE PAGE, and for the same reason she gave there:
  // "I rarely remember to add it to my calendar on the day." Somebody thinking
  // about how last week went is exactly who this screen is for.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const userId = await currentUserId();
      if (!userId) return;
      const { data } = await supabase
        .from('daily_ratings')
        .select('measure, value, note, source')
        .eq('user_id', userId)
        .eq('day', day);
      if (cancelled) return;
      const rows = (data ?? []) as { measure: string; value: number; note: string | null; source?: string }[];
      const found = ratingsByMeasure(rows);
      setRatings(found);
      // WHERE THIS DAY'S ANSWER CAME FROM (21 September 2026). Once a sentence
      // like "shattered ever since Tuesday" can fill a week, a day can carry a
      // word she never tapped - and finding one with no explanation is how an
      // app stops being trusted. It says so, quietly, and tapping replaces it.
      setFilled(rows.some((r) => r.source === 'spanned') ? 'spanned' : rows.some((r) => r.source === 'said') ? 'said' : null);
      // One note for the day, kept against whichever measure carried it.
      setNote(Object.values(found).find((r) => r.note)?.note ?? '');
      setSaved(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [day]);

  // SAVED ON THE TAP, NOT ON A BUTTON. The tap IS the answer, and a screen that
  // collects two taps and then asks for a third to keep them is a screen that
  // loses answers.
  async function rate(measureId: string, value: number) {
    const userId = await currentUserId();
    if (!userId) return;

    // Tapping the same word again clears it: the way to unsay something.
    const already = ratings[measureId]?.value === value;
    if (already) {
      setRatings((r) => {
        const next = { ...r };
        delete next[measureId];
        return next;
      });
      await supabase
        .from('daily_ratings')
        .delete()
        .eq('user_id', userId)
        .eq('day', day)
        .eq('measure', measureId);
      setSaved(`Cleared for ${human(day).toLowerCase()}.`);
      return;
    }

    setRatings((r) => ({ ...r, [measureId]: { measure: measureId, value, note: note.trim() || null } }));
    setFilled(null);
    const { error } = await supabase.from('daily_ratings').upsert(
      {
        user_id: userId,
        day,
        measure: measureId,
        value,
        note: note.trim() || null,
        // A TAP IS FIRST-HAND, whatever was here before. A day filled in from a
        // remark becomes a real check-in the moment she answers it herself.
        source: 'tapped',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,day,measure' }
    );
    setSaved(error ? 'That did not save. Worth trying again.' : `Saved for ${human(day).toLowerCase()}.`);
  }

  async function saveNote() {
    const userId = await currentUserId();
    if (!userId) return;
    const text = note.trim() || null;
    const ids = Object.keys(ratings);
    if (ids.length === 0) {
      // A NOTE WITH NO RATING IS STILL WORTH KEEPING, and belongs where a
      // sentence belongs in this app.
      setSaved('Tap a word above to keep this with the day, or say it in chat.');
      return;
    }
    await Promise.all(
      ids.map((m) =>
        supabase
          .from('daily_ratings')
          .update({ note: text, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('day', day)
          .eq('measure', m)
      )
    );
    setSaved(`Saved for ${human(day).toLowerCase()}.`);
  }

  return (
    <BodyScreen title="How you felt">
      <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
        Two taps. It is here so that if Selodía ever notices a pattern in how you feel, there is something real to
        check it against.
      </ThemedText>

      <ThemedView type="backgroundElement" style={styles.dayBar}>
        <Pressable
          onPress={() => setDay((d) => shift(d, -1))}
          accessibilityRole="button"
          accessibilityLabel="The day before"
          hitSlop={Spacing.two}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <MaterialCommunityIcons name="chevron-left" size={24} color={theme.accent} />
        </Pressable>
        <View style={styles.dayLabel}>
          <ThemedText type="smallBold">{human(day)}</ThemedText>
          {day !== today() && (
            <Pressable onPress={() => setDay(today())} accessibilityRole="button" accessibilityLabel="Back to today">
              <ThemedText type="small" themeColor="link">
                Back to today
              </ThemedText>
            </Pressable>
          )}
        </View>
        <Pressable
          onPress={() => setDay((d) => (d >= today() ? d : shift(d, 1)))}
          disabled={day >= today()}
          accessibilityRole="button"
          accessibilityLabel="The day after"
          hitSlop={Spacing.two}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={day >= today() ? theme.textSecondary : theme.accent}
          />
        </Pressable>
      </ThemedView>

      {filled && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          {filled === 'spanned'
            ? 'Filled in from a stretch of days you described in chat. Tap a word to answer for this day yourself.'
            : 'Recorded from what you said in chat.'}
        </ThemedText>
      )}

      {MEASURES.map((m) => (
        <ThemedView key={m.id} type="backgroundElement" style={styles.card}>
          <ThemedText style={styles.question}>{m.question}</ThemedText>
          <View style={styles.words}>
            {m.words.map((w, i) => {
              const on = ratings[m.id]?.value === i + 1;
              return (
                <Pressable
                  key={w}
                  onPress={() => void rate(m.id, i + 1)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${m.label}: ${w}`}
                  style={({ pressed }) => [styles.wordWrap, pressed && styles.pressed]}
                >
                  <View
                    style={[
                      styles.word,
                      { borderColor: on ? theme.accent : theme.backgroundSelected },
                      on && { backgroundColor: theme.background },
                    ]}
                  >
                    <ThemedText type="small" themeColor={on ? 'accentDeep' : 'text'}>
                      {w}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ThemedView>
      ))}

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText style={styles.question}>Anything going on?</ThemedText>
        <TextInput
          value={note}
          onChangeText={setNote}
          onBlur={() => void saveNote()}
          placeholder="Second bad night in a row, big week at work…"
          placeholderTextColor={theme.textSecondary}
          multiline
          maxLength={500}
          style={[styles.note, { color: theme.text, backgroundColor: theme.background }]}
          accessibilityLabel="Anything going on today"
        />
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          This is usually where the answer is. A word on its own is a data point; a word with a reason beside it is
          something you can act on later.
        </ThemedText>
      </ThemedView>

      {saved && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          {saved}
        </ThemedText>
      )}

      {/* A WAY OUT, AND PROOF IT WENT IN (Ruth, 21 September 2026): "That screen
          needs a save button to take them back to the previous page or it feels
          like it's not registered it all."
          Every tap here has already saved, so this button saves nothing - but a
          screen that gives you no way to finish reads as a screen that did not
          take your answer, and being right about the data is no defence. It
          says what is true rather than pretending to save: what went in, and
          the way back. */}
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Done, go back"
        style={({ pressed }) => [styles.done, { backgroundColor: theme.accentDeep }, pressed && styles.pressed]}
      >
        <ThemedText type="smallBold" themeColor="background">
          {Object.keys(ratings).length > 0 ? 'Done · saved' : 'Done'}
        </ThemedText>
      </Pressable>
    </BodyScreen>
  );
}

const styles = StyleSheet.create({
  intro: { lineHeight: 20, maxWidth: 330, marginBottom: Spacing.three },
  dayBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.three,
  },
  dayLabel: { alignItems: 'center', gap: 2 },
  card: { borderRadius: CardRadius, padding: Spacing.three, marginBottom: Spacing.two, gap: Spacing.two },
  question: { fontSize: 17 },
  words: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  wordWrap: { flexGrow: 1 },
  word: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    alignItems: 'center',
  },
  note: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    minHeight: 76,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  hint: { lineHeight: 18 },
  done: {
    marginTop: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  pressed: { opacity: 0.6 },
});
