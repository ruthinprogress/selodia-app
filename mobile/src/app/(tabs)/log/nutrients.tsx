import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BodyScreen } from '@/components/body-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { explainerFor } from '@/lib/macro-explainers';
import { MACROS, type MacroKey } from '@/lib/tracked-macros';
import { loadTrackedMacros } from '@/lib/tracked-macros-store';

// WHAT THESE NUMBERS MEAN.
//
// Ruth, 21 October 2026, on two artworks: "it does need some improvement to
// increase user literacy of what they are eating and how it's affecting them...
// keeping in mind we need to maintain it, keep costs realistic for MVP, and
// start moving towards shipping, not constant rebuilding."
//
// Both artworks reached for the same idea and built it differently: one screen
// per nutrient, with a "Tell me more" that opens a second layer, reached from a
// figure on the day. That is eight screens of navigation to maintain for
// content that fits on one, so this is one screen - the nutrients she is
// actually watching, each with what it does and where it comes from.
//
// HERS FIRST, BECAUSE THE LIST IS THE POINT. Somebody who has switched on fibre
// and salt and nothing else does not want a lesson on carbohydrate; she wants
// the two columns she keeps seeing explained. The rest are underneath, because
// reading what calcium does is also how somebody decides to start watching it.
//
// NOTHING ON THIS SCREEN IS ABOUT HER. No figure of hers, no judgement, no
// target - see macro-explainers.ts for why, and for the check that keeps it
// that way. What her own numbers mean against published guidance is a question
// for the chat, which can put them against her real days.

export default function NutrientsScreen() {
  const [tracked, setTracked] = useState<MacroKey[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const keys = await loadTrackedMacros();
      if (!cancelled) setTracked(keys);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const watching = MACROS.filter((m) => tracked.includes(m.key));
  const rest = MACROS.filter((m) => !tracked.includes(m.key));

  return (
    <BodyScreen title="What these mean">
      <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
        What each one does in your body, and the foods it comes from. Nothing here is about your own
        figures - ask in chat for that.
      </ThemedText>

      {watching.map((m) => (
        <Nutrient key={m.key} label={m.label} macroKey={m.key} />
      ))}

      {rest.length > 0 && (
        <>
          <ThemedText type="smallBold" style={styles.restHead}>
            Not currently shown on your food
          </ThemedText>
          {rest.map((m) => (
            <Nutrient key={m.key} label={m.label} macroKey={m.key} />
          ))}
        </>
      )}
    </BodyScreen>
  );
}

function Nutrient({ label, macroKey }: { label: string; macroKey: MacroKey }) {
  const e = explainerFor(macroKey);
  if (!e) return null;
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <ThemedText type="small" style={styles.body}>
        {e.what}
      </ThemedText>
      <View style={styles.where}>
        <ThemedText type="detail" themeColor="textSecondary">
          Where it comes from
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
          {e.where}
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  intro: { lineHeight: 20, marginBottom: Spacing.three },
  card: { gap: Spacing.two, padding: Spacing.four, borderRadius: CardRadius, marginBottom: Spacing.three },
  // LINE HEIGHT, BECAUSE THIS IS THE ONE SCREEN IN THE APP WITH PARAGRAPHS ON
  // IT. The default leading is set for labels and single lines.
  body: { lineHeight: 21 },
  where: { gap: 2, marginTop: Spacing.two },
  restHead: { marginTop: Spacing.three, marginBottom: Spacing.three },
});
