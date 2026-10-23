import { StyleSheet, View } from 'react-native';

import { QualityPill } from '@/components/sleep-quality-pill';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, DisplayFont, Spacing } from '@/constants/theme';
import { formatDuration, type SleepNight } from '@/lib/sleep';

// LAST NIGHT, TWO WAYS, FROM RUTH'S TWO ARTWORKS (23 October 2026).
//
// She drew both deliberately: "There needs to be two versions of the screens
// probably because there will be people with wearables and people without."
//
// THE DIFFERENCE IS NOT COSMETIC. With a watch, the clock is already answered
// and the only open question is how the night FELT. Without one, the length is
// a question too - and a rough one, which is why her chips became bands.
//
// SO THE CARD ASKS FOR WHAT IS MISSING AND SHOWS WHAT IS KNOWN, and the
// measured version never offers a duration chip at all. Asking somebody to
// estimate a figure the app has already measured is how a form feels.

/** The measured version: the phone answered the clock. */
export function MeasuredNight({
  night,
  sourceName,
}: {
  night: SleepNight;
  sourceName: string;
}) {
  const bed = clock(night.went_to_bed);
  const woke = clock(night.woke_at);
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.measuredRow}>
        <View style={styles.figureSide}>
          {/* EXACT, BECAUSE IT WAS MEASURED. A band here would throw away the
              one thing a watch is better at than a person. */}
          <ThemedText style={styles.bigFigure}>
            {formatDuration(night.duration_min) ?? '—'}
          </ThemedText>
          {night.quality ? <QualityPill quality={night.quality} /> : null}
        </View>

        <View style={styles.facts}>
          {bed ? <Fact label="Bed" value={bed} /> : null}
          {woke ? <Fact label="Awake" value={woke} /> : null}
          {/* ONLY WHEN THE RECORD CARRIES IT, and never a zero. "Interrupted 0
              times" is a sentence nobody says, and a night whose stages were
              not recorded is not a night that went unbroken. */}
          {typeof night.awakenings === 'number' && night.awakenings > 0 ? (
            <Fact
              label="Interrupted"
              value={`${night.awakenings} time${night.awakenings === 1 ? '' : 's'}`}
            />
          ) : null}
        </View>
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        {`From ${sourceName}`}
      </ThemedText>
    </ThemedView>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="small">{value}</ThemedText>
    </View>
  );
}

function clock(at: string | null | undefined): string | null {
  if (!at) return null;
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  card: { borderRadius: CardRadius, padding: Spacing.three, gap: Spacing.two },
  measuredRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  figureSide: { gap: Spacing.two, flexShrink: 0 },
  bigFigure: { fontFamily: DisplayFont.regular, fontSize: 38, lineHeight: 44 },
  facts: { flex: 1, minWidth: 0, gap: Spacing.one },
  fact: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
});
