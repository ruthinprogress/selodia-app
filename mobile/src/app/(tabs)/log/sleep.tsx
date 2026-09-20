import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BodyScreen } from '@/components/body-screen';
import { RowDelete } from '@/components/row-delete';
import { SectionIntro } from '@/components/section-intro';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  QUALITY_LABEL,
  formatDuration,
  lastNight,
  loadNights,
  saveNight,
  type SleepNight,
  type SleepQuality,
} from '@/lib/sleep';
import { humanDate } from '@/lib/week';

/** A night is stored as a plain date; midday keeps it on its own day in any zone. */
const nightLabel = (night: string) => humanDate(new Date(`${night}T12:00:00`));

// SLEEP (2026-09-20). Asked for as part of the Log redesign: "Leave out
// medication and mood. Add sleep."
//
// TWO QUESTIONS, AND BOTH ARE OPTIONAL. How long, and how it went. Somebody
// who knows only that it was rough taps one word and is done; somebody who
// watched the clock at four can say six hours as well. Neither answer implies
// the other, and an unanswered one is stored as nothing rather than a guess.
//
// NO SCORE, NO TARGET, NO STREAK. Part Twelve's rule for hydration applies at
// least as strongly here: sleep is the thing people already feel worst about
// when it goes badly, and a number out of ten to fall short of would earn this
// screen a place in that feeling. It records; it does not grade.

const HOURS = [4, 5, 6, 7, 8, 9];
const QUALITIES: SleepQuality[] = ['poor', 'broken', 'ok', 'good'];

export default function SleepScreen() {
  const [nights, setNights] = useState<SleepNight[]>([]);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const night = lastNight();
  const existing = nights.find((n) => n.night_of === night) ?? null;

  useEffect(() => {
    let cancelled = false;
    void loadNights().then((rows) => {
      if (!cancelled) setNights(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function record(patch: { durationMin?: number; quality?: SleepQuality }) {
    if (saving) return;
    setSaving(true);
    setFailed(false);
    const ok = await saveNight({ nightOf: night, ...patch });
    if (ok) {
      setNights(await loadNights());
      setJustSaved(true);
    } else {
      setFailed(true);
    }
    setSaving(false);
  }

  return (
    <BodyScreen>
      <ThemedText type="display">Sleep</ThemedText>

      <SectionIntro title="Last night">
        {`${nightLabel(night)}. Tell me what you know, and leave the rest.`}
      </SectionIntro>

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">How long, roughly?</ThemedText>
        <View style={styles.chips}>
          {HOURS.map((h) => {
            const chosen = existing?.duration_min === h * 60;
            return (
              <Pressable
                key={h}
                onPress={() => void record({ durationMin: h * 60 })}
                disabled={saving}
                accessibilityRole="button"
                accessibilityState={{ selected: chosen }}
                accessibilityLabel={`${h} hours`}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <ThemedView type={chosen ? 'backgroundSelected' : 'background'} style={styles.chip}>
                  <ThemedText type="small">{h}h</ThemedText>
                </ThemedView>
              </Pressable>
            );
          })}
        </View>

        <ThemedText type="smallBold" style={styles.second}>
          How did it feel?
        </ThemedText>
        <View style={styles.chips}>
          {QUALITIES.map((q) => {
            const chosen = existing?.quality === q;
            return (
              <Pressable
                key={q}
                onPress={() => void record({ quality: q })}
                disabled={saving}
                accessibilityRole="button"
                accessibilityState={{ selected: chosen }}
                accessibilityLabel={QUALITY_LABEL[q]}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <ThemedView type={chosen ? 'backgroundSelected' : 'background'} style={styles.chip}>
                  <ThemedText type="small">{QUALITY_LABEL[q]}</ThemedText>
                </ThemedView>
              </Pressable>
            );
          })}
        </View>

        {failed ? (
          <ThemedText type="small" themeColor="danger" style={styles.note}>
            That didn&apos;t save. Check your connection and try again.
          </ThemedText>
        ) : justSaved ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            Kept. Say more about it in chat any time, and it joins the same night.
          </ThemedText>
        ) : (
          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            For anything else - what woke you, how you feel today - tell me in chat.
          </ThemedText>
        )}
      </ThemedView>

      {nights.length > 0 && (
        <>
          <SectionIntro title="Recent nights">
            Only the nights you described. A night that is not here simply was not recorded.
          </SectionIntro>
          <ThemedView type="backgroundElement" style={styles.list}>
            {nights.map((n) => (
              <View key={n.id} style={styles.row}>
                <ThemedText type="small" style={styles.when}>
                  {nightLabel(n.night_of)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.what}>
                  {[
                    formatDuration(n.duration_min),
                    n.quality ? QUALITY_LABEL[n.quality] : null,
                    n.awakenings ? `awake ${n.awakenings}x` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </ThemedText>
                <RowDelete
                  table="sleep_logs"
                  id={n.id}
                  what={`the night of ${nightLabel(n.night_of)}`}
                  onDeleted={() => setNights((rows) => rows.filter((r) => r.id !== n.id))}
                />
              </View>
            ))}
          </ThemedView>
        </>
      )}
    </BodyScreen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.one },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one, paddingTop: Spacing.one },
  chip: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: Spacing.three },
  second: { paddingTop: Spacing.three },
  note: { lineHeight: 18, paddingTop: Spacing.two },
  list: { borderRadius: Spacing.three, paddingHorizontal: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  when: { width: 96 },
  what: { flex: 1 },
  pressed: { opacity: 0.6 },
});
