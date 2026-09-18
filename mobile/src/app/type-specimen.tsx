import { useFonts } from 'expo-font';
import { EBGaramond_500Medium } from '@expo-google-fonts/eb-garamond';
import { Fraunces_500Medium } from '@expo-google-fonts/fraunces';
import { Lora_500Medium } from '@expo-google-fonts/lora';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandFont, DisplayFont, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// FOUR SERIFS, ON HER OWN PHONE (Ruth, 2026-09-18).
//
// Temporary, and deliberately so: it exists to settle one question and comes out
// once it is settled. She decides visual questions by comparison rather than
// description - five rounds of the Health Flower are the record of it - so the
// four faces are shown doing the exact job they would have to do: the Today
// greeting, the date beneath it, a section title, and one line of Comfortaa, so
// the pairing is visible rather than only the face.
//
// Same size, same weight, same words, same order every time. The only thing
// changing between blocks is the family.

const SAMPLES = [
  {
    id: 'cormorant',
    name: 'Cormorant Garamond',
    note: 'In the app now. Delicate, high contrast, small x-height.',
    family: DisplayFont.medium,
  },
  { id: 'lora', name: 'Lora', note: 'Sturdier, more even colour on the page.', family: 'Lora_500Medium' },
  {
    id: 'fraunces',
    name: 'Fraunces',
    note: 'Warmer, a little quirky, soft old-style shapes.',
    family: 'Fraunces_500Medium',
  },
  {
    id: 'eb-garamond',
    name: 'EB Garamond',
    note: 'Classic garamond, slightly heavier than Cormorant.',
    family: 'EBGaramond_500Medium',
  },
];

export default function TypeSpecimenScreen() {
  const theme = useTheme();
  const [loaded] = useFonts({ Lora_500Medium, Fraunces_500Medium, EBGaramond_500Medium });

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="small" themeColor="textSecondary">
            Four serifs, same words, same size. Tell me a number.
          </ThemedText>

          {SAMPLES.map((s, i) => (
            <ThemedView key={s.id} type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">
                {i + 1}. {s.name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {s.note}
              </ThemedText>

              <View style={styles.sample}>
                <Text style={[styles.display, { fontFamily: loaded ? s.family : undefined, color: theme.text }]}>
                  Good morning, Ruth
                </Text>
                <Text style={[styles.meta, { color: theme.textSecondary }]}>Friday 18 September</Text>
                <Text
                  style={[styles.section, { fontFamily: loaded ? s.family : undefined, color: theme.text }]}
                >
                  This week
                </Text>
                <Text style={[styles.body, { color: theme.textSecondary }]}>
                  Two sessions logged. Water is at 0ml of about 2L.
                </Text>
              </View>
            </ThemedView>
          ))}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  card: {
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  sample: {
    paddingTop: Spacing.two,
    gap: Spacing.half,
  },
  display: { fontSize: 38, lineHeight: 46 },
  section: { fontSize: 26, lineHeight: 34, paddingTop: Spacing.two },
  // Comfortaa, so the pairing is on show rather than the serif alone.
  meta: { fontSize: 14, lineHeight: 20, fontFamily: BrandFont.regular },
  body: { fontSize: 14, lineHeight: 20, fontFamily: BrandFont.regular },
});
