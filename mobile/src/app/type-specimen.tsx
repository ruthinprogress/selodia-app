import { CormorantGaramond_300Light } from '@expo-google-fonts/cormorant-garamond';
import { CormorantInfant_300Light } from '@expo-google-fonts/cormorant-infant';
import { Fraunces_300Light } from '@expo-google-fonts/fraunces';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif';
import { Inter_300Light, Inter_400Regular } from '@expo-google-fonts/inter';
import { Manrope_300Light, Manrope_400Regular } from '@expo-google-fonts/manrope';
import { Newsreader_300Light } from '@expo-google-fonts/newsreader';
import { useFonts } from 'expo-font';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HealthFlower } from '@/components/health-flower';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandFont, CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// TYPOGRAPHY, AS A SYSTEM (Ruth, 2026-09-18).
//
// The first version of this screen offered four serifs at the sizes already in
// the app, which was the wrong question. Her note: the faces are "not tall
// enough", and what she is after is "the luxury 20s poster feel ... tall but
// rounded, close letters" - editorial luxury from the 1920s and 30s, a bound
// book rather than a wellness app.
//
// So each option here changes four things together, not just the family:
//   - SIZE. Headings run much larger than the 38px in the app now. A display
//     face at 38 is a label; at 52 it is a page.
//   - WEIGHT. Light rather than medium. Weight is what makes a serif look
//     modern and busy; light is what makes it look printed.
//   - LETTER SPACING. A touch of it on headings, which is what poster
//     lettering has and screen type usually does not.
//   - AIR. Line height above the face's natural leading, and real space between
//     a heading and what follows. Nothing here is compressed.
//
// NOTHING IS STRETCHED. Vertical scaling is what makes type look cheap, so the
// height comes from faces with naturally long ascenders and small, quiet
// x-heights, not from a transform.
//
// TEMPORARY. This screen and its Settings link come out when a system is chosen.

type Candidate = {
  id: string;
  name: string;
  note: string;
  family: string;
  // Per-face, because the same numbers do not sit the same way on every drawing.
  displaySize: number;
  displayLeading: number;
  displayTracking: number;
};

const CANDIDATES: Candidate[] = [
  {
    id: 'newsreader',
    name: 'Newsreader',
    note: 'Long ascenders, open counters. Made for reading, quietly bookish.',
    family: 'Newsreader_300Light',
    displaySize: 46,
    displayLeading: 54,
    displayTracking: 0.4,
  },
  {
    id: 'instrument',
    name: 'Instrument Serif',
    note: 'Tall, narrow, high contrast. The closest to a 1920s poster.',
    family: 'InstrumentSerif_400Regular',
    displaySize: 50,
    displayLeading: 56,
    displayTracking: 0.6,
  },
  {
    id: 'fraunces',
    name: 'Fraunces',
    note: 'Soft old-style shapes, warmer and a little characterful.',
    family: 'Fraunces_300Light',
    displaySize: 42,
    displayLeading: 52,
    displayTracking: 0.2,
  },
  {
    id: 'infant',
    name: 'Cormorant Infant',
    note: 'Cormorant with rounder, softer terminals. Tall and delicate.',
    family: 'CormorantInfant_300Light',
    displaySize: 50,
    displayLeading: 56,
    displayTracking: 0.6,
  },
  {
    id: 'cormorant',
    name: 'Cormorant Garamond',
    note: 'What is in the app now, shown at the new size and weight.',
    family: 'CormorantGaramond_300Light',
    displaySize: 50,
    displayLeading: 56,
    displayTracking: 0.6,
  },
];

const BODIES = [
  { id: 'comfortaa', name: 'Comfortaa', family: BrandFont.regular },
  { id: 'inter', name: 'Inter', family: 'Inter_300Light' },
  { id: 'manrope', name: 'Manrope', family: 'Manrope_300Light' },
];

const FLOWER = { strength: 18, cardio: 48, flexibility: 53, balance: 23, bone: 40, recovery: 20 };

export default function TypeSpecimenScreen() {
  const theme = useTheme();
  const [fontIndex, setFontIndex] = useState(0);
  const [bodyIndex, setBodyIndex] = useState(0);
  const [loaded] = useFonts({
    Newsreader_300Light,
    InstrumentSerif_400Regular,
    Fraunces_300Light,
    CormorantInfant_300Light,
    CormorantGaramond_300Light,
    Inter_300Light,
    Inter_400Regular,
    Manrope_300Light,
    Manrope_400Regular,
  });

  const face = CANDIDATES[fontIndex];
  const body = BODIES[bodyIndex];
  const serif = loaded ? face.family : undefined;
  const sans = loaded ? body.family : BrandFont.regular;

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* The choosers. Deliberately plain: nothing here should compete with
              the thing being judged. */}
          <View style={styles.chips}>
            {CANDIDATES.map((c, i) => (
              <Chooser
                key={c.id}
                label={`${i + 1}. ${c.name}`}
                selected={i === fontIndex}
                onPress={() => setFontIndex(i)}
              />
            ))}
          </View>
          <View style={styles.chips}>
            {BODIES.map((b, i) => (
              <Chooser
                key={b.id}
                label={b.name}
                selected={i === bodyIndex}
                onPress={() => setBodyIndex(i)}
              />
            ))}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {face.note}
          </ThemedText>

          {/* THE REAL SCREEN, in that system. Today as it actually is: greeting,
              date, focus line, three figures, water, the week's flower. */}
          <View style={styles.page}>
            <View style={styles.headerBlock}>
              <Text
                style={[
                  styles.display,
                  {
                    fontFamily: serif,
                    color: theme.text,
                    fontSize: face.displaySize,
                    lineHeight: face.displayLeading,
                    letterSpacing: face.displayTracking,
                  },
                ]}
              >
                Good morning, Ruth
              </Text>
              <Text style={[styles.meta, { fontFamily: sans, color: theme.textSecondary }]}>
                Friday 18 September
              </Text>
            </View>

            <Text style={[styles.focus, { fontFamily: sans, color: theme.textSecondary }]}>
              You have logged something every day this week. That is the whole habit.
            </Text>

            <View style={styles.row}>
              {[
                { label: 'Food', value: '1,455', unit: 'kcal' },
                { label: 'Body', value: '56.3', unit: 'kg' },
                { label: 'Activity', value: '6,200', unit: 'steps' },
              ].map((s) => (
                <ThemedView key={s.label} type="backgroundElement" style={styles.card}>
                  <Text style={[styles.cardLabel, { fontFamily: sans, color: theme.textSecondary }]}>
                    {s.label}
                  </Text>
                  <Text style={[styles.cardValue, { fontFamily: sans, color: theme.text }]}>
                    {s.value}
                    <Text style={[styles.cardUnit, { color: theme.textSecondary }]}> {s.unit}</Text>
                  </Text>
                </ThemedView>
              ))}
            </View>

            <ThemedView type="backgroundElement" style={styles.water}>
              <Text style={[styles.cardLabel, { fontFamily: sans, color: theme.textSecondary }]}>
                0ml of about 2L
              </Text>
              <Text style={[styles.cardLabel, { fontFamily: sans, color: theme.accentDeep }]}>
                + Add a drink
              </Text>
            </ThemedView>

            <View style={styles.weekBlock}>
              <Text
                style={[
                  styles.section,
                  {
                    fontFamily: serif,
                    color: theme.text,
                    letterSpacing: face.displayTracking,
                  },
                ]}
              >
                This week
              </Text>
              <View style={styles.flower}>
                <HealthFlower coverage={FLOWER} size={200} />
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Chooser({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={6}>
      <ThemedView
        type={selected ? 'accent' : 'backgroundElement'}
        style={[styles.chip, selected && { backgroundColor: theme.accent }]}
      >
        <ThemedText type="small" themeColor={selected ? 'background' : 'textSecondary'}>
          {label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  content: {
    padding: Spacing.three,
    gap: Spacing.two,
    paddingBottom: Spacing.six,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  chip: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  // THE AIR IS PART OF THE ANSWER. A heading with 32px beneath it reads as a
  // page; the same heading with 8px reads as a form label.
  page: {
    paddingTop: Spacing.four,
    gap: Spacing.four,
  },
  headerBlock: { gap: Spacing.two },
  display: {},
  meta: { fontSize: 13, lineHeight: 20, letterSpacing: 0.6 },
  focus: { fontSize: 15, lineHeight: 26 },
  section: { fontSize: 30, lineHeight: 38 },
  row: { flexDirection: 'row', gap: Spacing.two },
  card: {
    flex: 1,
    borderRadius: CardRadius,
    padding: Spacing.three,
    gap: Spacing.one,
    minHeight: 96,
  },
  cardLabel: { fontSize: 13, lineHeight: 18, letterSpacing: 0.4 },
  cardValue: { fontSize: 22, lineHeight: 28 },
  cardUnit: { fontSize: 13 },
  water: {
    borderRadius: CardRadius,
    padding: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weekBlock: { gap: Spacing.three },
  flower: { alignItems: 'center' },
});
