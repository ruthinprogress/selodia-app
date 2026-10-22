import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Checkbox } from '@/components/checkbox';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { ALWAYS_ON, MACROS, OPTIONAL, type MacroKey } from '@/lib/tracked-macros';
import { loadTrackedMacros, saveTrackedMacros } from '@/lib/tracked-macros-store';

// WHAT I TRACK (Ruth, 24 September 2026).
//
//   "Toggles for: fat, saturated fat, carbohydrates, sugar, fibre,
//   salt/sodium. Calories and protein always on, cannot be toggled. Same
//   toggles appear in onboarding. Whatever is switched on shows on every food
//   row and in daily totals."
//
// ONE COMPONENT, TWO PLACES. Settings and onboarding show the same list, so it
// is the same component rather than two that drift - the onboarding copy of a
// settings screen going stale is a well-worn way to end up with an app that
// contradicts itself at the one moment somebody is deciding whether to trust it.
//
// CHECKBOXES, NOT SWITCHES. There is no Switch anywhere in this app and there
// is a Checkbox used on the consent screen and in the report builder, so this
// is the control people have already met here. A switch would also imply each
// row acts the moment it moves; these are a set being chosen together.
//
// THE TWO THAT CANNOT MOVE ARE SHOWN, NOT HIDDEN. Leaving calories and protein
// out of the list would read as "this app does not track protein", which is the
// opposite of true and the opposite of the point. They are stated, ticked, and
// plainly not pressable, with the reason given once underneath.

export function MacroChoices({
  onChange,
}: {
  /** Fired after a save, so onboarding can enable its forward button. */
  onChange?: (keys: MacroKey[]) => void;
}) {
  const [chosen, setChosen] = useState<MacroKey[]>([]);
  const [loaded, setLoaded] = useState(false);
  // The macro whose last save failed, so the row can say so where she tapped.
  const [failed, setFailed] = useState<MacroKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const keys = await loadTrackedMacros();
      if (cancelled) return;
      setChosen(keys);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // SAVED ON EACH TAP, not behind a Save button. Everything else in Settings
  // behaves that way, and a set of tick boxes with no obvious commit is exactly
  // where somebody backs out and loses what they chose.
  async function toggle(key: MacroKey) {
    const before = chosen;
    const next = chosen.includes(key) ? chosen.filter((k) => k !== key) : [...chosen, key];
    setChosen(next);
    onChange?.(next);
    setFailed(null);

    // THE ANSWER IS READ NOW (22 October 2026). saveTrackedMacros was written
    // to return false "so a caller can say so rather than assume", and this
    // caller assumed - it awaited the promise and threw the result away.
    //
    // WHAT THAT LOOKS LIKE FROM THE OUTSIDE. The tick appears, because the tick
    // is optimistic. Nothing says otherwise. She leaves the screen believing
    // she has switched something on, and the only way she ever finds out is by
    // noticing, days later, that the column she asked for has never appeared -
    // which is exactly how calcium and iron were reported: "Iron and calcium
    // not showing on food logs."
    //
    // So a failed write puts the tick back where it was and says so. A silent
    // wrong tick is worse than an error, because an error can be acted on.
    const saved = await saveTrackedMacros(next);
    if (!saved) {
      setChosen(before);
      onChange?.(before);
      setFailed(key);
    }
  }

  const always = MACROS.filter((m) => ALWAYS_ON.includes(m.key));

  return (
    <View style={styles.wrap}>
      <ThemedView type="backgroundElement" style={styles.card}>
        {always.map((m) => (
          <View key={m.key} style={styles.fixedRow}>
            <ThemedView type="backgroundSelected" style={styles.fixedBox}>
              <ThemedText type="smallBold">✓</ThemedText>
            </ThemedView>
            <ThemedText type="small" style={styles.fixedLabel}>
              {m.label}
            </ThemedText>
          </View>
        ))}
        <ThemedText type="detail" themeColor="textSecondary" style={styles.why}>
          Always shown. Protein is the one worth watching most as you get older, and calories give
          it something to sit against.
        </ThemedText>
      </ThemedView>

      {loaded && (
        <ThemedView type="backgroundElement" style={styles.card}>
          {OPTIONAL.map((m) => (
            <View key={m.key}>
              <Checkbox
                checked={chosen.includes(m.key)}
                onToggle={() => void toggle(m.key)}
                label={m.label}
              />
              {/* SAID WHERE SHE TAPPED, not in a banner at the top. The row is
                  what she was looking at and the row is what did not change. */}
              {failed === m.key && (
                <ThemedText type="detail" themeColor="danger" style={styles.failed}>
                  That did not save. Worth tapping again.
                </ThemedText>
              )}
              {/* AND WHY IT IS WORTH WATCHING, for the two that answer a
                  question somebody her age is actually asking. */}
              {m.detail && (
                <ThemedText type="detail" themeColor="textSecondary" style={styles.detail}>
                  {m.detail}
                </ThemedText>
              )}
            </View>
          ))}
        </ThemedView>
      )}

      <ThemedText type="detail" themeColor="textSecondary" style={styles.foot}>
        Whatever is ticked shows on every food entry and in your daily total. You can change this
        whenever you like.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  failed: { paddingLeft: 34, paddingBottom: 6 },
  detail: { paddingLeft: 34, paddingBottom: 6, lineHeight: 16 },
  wrap: { gap: Spacing.two },
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  fixedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  // The same 24pt square the Checkbox draws, so the two lists line up - but not
  // a Pressable, because it does not do anything and must not look as if it does.
  fixedBox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.55,
  },
  fixedLabel: { flex: 1, opacity: 0.55, lineHeight: 24 },
  why: { lineHeight: 18 },
  foot: { lineHeight: 18, paddingHorizontal: Spacing.one },
});
