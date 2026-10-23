import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BodyScreen } from '@/components/body-screen';
import { ReportLink } from '@/components/report-link';
import { SectionIntro } from '@/components/section-intro';
import { MeasuredNight } from '@/components/sleep-last-night';
import { SleepFromPhone } from '@/components/sleep-from-phone';
import { SleepNightsTable } from '@/components/sleep-nights-table';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  QUALITY_LABEL,
  SLEEP_BANDS,
  lastNight,
  loadNights,
  saveNight,
  type SleepNight,
  type SleepQuality,
} from '@/lib/sleep';
import { loadMorningDays, observationFor } from '@/lib/sleep-observation';
import { humanDate } from '@/lib/week';

/** A night is stored as a plain date; midday keeps it on its own day in any zone. */
const nightLabel = (night: string) => humanDate(new Date(`${night}T12:00:00`));

const QUALITIES: SleepQuality[] = ['poor', 'broken', 'ok', 'good'];

const PHONE_SOURCE = 'phone health platform';

/** Open the conversation about a night, the way every other log does it. */
function askAbout(night: string) {
  router.push({
    pathname: '/',
    params: {
      prefill: `About the night of ${nightLabel(night)}: `,
      askNow: '1',
      askNonce: String(Date.now()),
    },
  });
}

// SLEEP (2026-09-20), REDRAWN FROM TWO ARTWORKS (Ruth, 23 October 2026).
//
// She drew it twice on purpose: "There needs to be two versions of the screens
// probably because there will be people with wearables and people without."
//
// THE TWO VERSIONS ARE NOT STYLES OF ONE CARD. With a watch the clock is
// already answered - how long, when she went, when she woke, how often it
// broke - and the only thing left is how it FELT, which no watch can know.
// Without one, the length is a question too, and a rough one.
//
// So the measured card never offers a duration chip. Asking somebody to
// estimate a figure the app has already measured is how software starts
// feeling like a form instead of like help.
//
// HOW LONG BECAME A BAND. Her chips were 4h 5h 6h 7h 8h 9h and are now <5h,
// 5-6h, 6-7h, 7-8h, 8h+. Nobody waking up knows whether they slept seven hours
// or seven and a quarter, and her own heading had said "roughly" all along.
//
// NO SCORE, NO TARGET, NO STREAK, unchanged and worth repeating: sleep is the
// thing people already feel worst about when it goes badly, and a number to
// fall short of would earn this screen a place in that feeling. It records; it
// does not grade.
export default function SleepScreen() {
  const theme = useTheme();
  const [nights, setNights] = useState<SleepNight[]>([]);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [observation, setObservation] = useState<string | null>(null);

  const night = lastNight();
  const existing = nights.find((n) => n.night_of === night) ?? null;
  const measured = existing?.source === PHONE_SOURCE && existing.duration_min != null;

  const refresh = useCallback(async () => {
    const rows = await loadNights();
    setNights(rows);
    setObservation(observationFor(rows, await loadMorningDays()));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function record(patch: { durationMin?: number; quality?: SleepQuality }) {
    if (saving) return;
    setSaving(true);
    setFailed(false);
    const ok = await saveNight({ nightOf: night, ...patch });
    if (ok) await refresh();
    else setFailed(true);
    setSaving(false);
  }

  return (
    <BodyScreen title="Sleep">
      <SleepFromPhone onSynced={() => void refresh()} />

      <SectionIntro title="Last night">
        {measured
          ? nightLabel(night)
          : `${nightLabel(night)}. Tell me what you know, and leave the rest.`}
      </SectionIntro>

      {measured && existing ? <MeasuredNight night={existing} sourceName="your phone" /> : null}

      <ThemedView type="backgroundElement" style={styles.card}>
        {/* NO DURATION QUESTION WHEN A PHONE ALREADY MEASURED IT. */}
        {!measured ? (
          <>
            <ThemedText type="smallBold">How long?</ThemedText>
            <View style={styles.chips}>
              {SLEEP_BANDS.map((band) => {
                const chosen =
                  existing?.duration_min != null &&
                  existing.duration_min >= band.min &&
                  existing.duration_min <= band.max;
                return (
                  <Pressable
                    key={band.key}
                    onPress={() => void record({ durationMin: band.store })}
                    disabled={saving}
                    accessibilityRole="button"
                    accessibilityState={{ selected: chosen }}
                    accessibilityLabel={band.label}
                    style={({ pressed }) => pressed && styles.pressed}
                  >
                    <ThemedView type={chosen ? 'accentWash' : 'background'} style={styles.chip}>
                      <ThemedText type="small">{band.label}</ThemedText>
                    </ThemedView>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        <ThemedText type="smallBold" style={measured ? undefined : styles.second}>
          How was it?
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
                <ThemedView
                  type={chosen ? (q === 'good' ? 'sage' : 'accentWash') : 'background'}
                  style={styles.chip}
                >
                  <ThemedText type="small">{QUALITY_LABEL[q]}</ThemedText>
                </ThemedView>
              </Pressable>
            );
          })}
        </View>

        {/* ANYTHING WORTH MENTIONING, as a control rather than a sentence
            telling her to go elsewhere. It used to read "For anything else -
            what woke you, how you feel today - tell me in chat", which is an
            instruction about a door rather than a door. Her artwork draws the
            field with a chevron, so this is the door. */}
        <Pressable
          onPress={() => askAbout(night)}
          accessibilityRole="button"
          accessibilityLabel="Say more about last night"
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedView type="background" style={styles.field}>
            <Ionicons name="chatbubble-outline" size={16} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.fieldText}>
              Anything worth mentioning?
            </ThemedText>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </ThemedView>
        </Pressable>

        {failed ? (
          <ThemedText type="small" themeColor="danger" style={styles.note}>
            That didn&apos;t save. Check your connection and try again.
          </ThemedText>
        ) : null}
      </ThemedView>

      {/* THE OBSERVATION, WITH NO HEADING OVER IT (Ruth, 23 October 2026):
          "dont say 'selodia notices', just the insight I think."

          She is right, and it is not only tone. A heading naming the app as the
          noticer makes it somebody delivering a verdict about her. The sentence
          on its own is a thing that is true about her record, sitting there,
          for her to decide what it is worth.

          ABSENT FAR MORE OFTEN THAN PRESENT, by design. See sleep-insight.ts:
          it needs three nights on each side of the comparison and twenty
          minutes of difference before it will say anything at all. */}
      {observation ? (
        <ThemedView type="sage" style={styles.observation}>
          <Ionicons name="leaf-outline" size={18} color={theme.text} />
          <ThemedText type="small" style={styles.observationText}>
            {observation}
          </ThemedText>
        </ThemedView>
      ) : null}

      {nights.length > 0 ? (
        <>
          <SectionIntro title="Recent nights">
            Only the nights you described. A night that is not here simply was not recorded.
          </SectionIntro>
          <SleepNightsTable nights={nights} onOpen={(n) => askAbout(n.night_of)} />
          <ReportLink start={['sleep']} label="Build a report from this" />
        </>
      ) : null}
    </BodyScreen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: CardRadius, padding: Spacing.three, gap: Spacing.one },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one, paddingTop: Spacing.one },
  chip: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: CardRadius },
  second: { paddingTop: Spacing.three },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: CardRadius,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.three,
  },
  fieldText: { flex: 1, minWidth: 0 },
  observation: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    borderRadius: CardRadius,
    padding: Spacing.three,
  },
  observationText: { flex: 1, minWidth: 0, lineHeight: 20 },
  note: { lineHeight: 18, paddingTop: Spacing.two },
  pressed: { opacity: 0.6 },
});
