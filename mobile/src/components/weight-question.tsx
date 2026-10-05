import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ButtonRadius, CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// ROUGHLY WHAT DO YOU WEIGH? No scales, a guess is fine, and a way to say no.
//
// Ruth, 2 October 2026: "Add 'Roughly what do you weigh?' to the goal screen.
// A guess is fine, no scales. kg / st and lb / lb, and an 'I do not know yet'
// tap."
//
// WHY IT IS ASKED AT ALL, since the app has her weight from a scale import. For
// her it is already there; for everybody else it is the input the calorie target
// cannot do without, and it was asked nowhere in setup. "Lose fat" produces a
// deficit of half a percent of bodyweight a week, which is not a number at all
// without a bodyweight - so the goal saved, the target stayed blank, and nothing
// on any screen explained why.
//
// THREE UNITS BECAUSE BRITISH WOMEN USE THREE. Stone and pounds is what most
// women of Ruth's generation in the UK actually know their weight in; kg is what
// the scales say; plain pounds is what anyone who has used an American app has.
// Asking for kg alone would have meant a mental conversion before answering a
// question whose whole promise is that a rough answer is fine.
//
// "I DO NOT KNOW YET" IS A REAL ANSWER AND IT IS STORED AS ONE. It is not the
// same as leaving the field blank and it is not a failure to answer: it means
// the targets wait, Today says so in one tappable line, and nothing is guessed.
// The alternative - a required field - would have produced made-up weights,
// which is worse than no weight because a made-up one silently produces a
// confident target.
//
// NO TARGET WEIGHT IS EVER ASKED FOR. Her instruction, and this component has
// nowhere to put one.

export type WeightUnit = 'kg' | 'st_lb' | 'lb';

export type WeightAnswer =
  | { known: true; kg: number }
  | { known: false };

const KG_PER_LB = 0.45359237;
const LB_PER_STONE = 14;

/** What she typed, in kg, or null when it is not a usable number yet. */
export function weightToKg(
  unit: WeightUnit,
  fields: { kg: string; stone: string; pounds: string }
): number | null {
  const num = (t: string) => {
    const n = Number(t.replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  if (unit === 'kg') {
    const kg = num(fields.kg);
    // A PLAUSIBILITY RANGE, NOT A VALIDATION MESSAGE. Out of range simply means
    // "not a usable answer yet", so the screen stays quiet rather than telling
    // her she is wrong while she is still typing the second digit.
    return kg >= 25 && kg <= 300 ? Math.round(kg * 10) / 10 : null;
  }
  if (unit === 'lb') {
    const lb = num(fields.pounds);
    const kg = lb * KG_PER_LB;
    return kg >= 25 && kg <= 300 ? Math.round(kg * 10) / 10 : null;
  }
  // Stone with pounds. Stone alone is a complete answer: "11 stone" is how a lot
  // of people know it, and demanding the pounds would reject a real answer.
  const st = num(fields.stone);
  const lb = num(fields.pounds);
  if (st === 0) return null;
  const kg = (st * LB_PER_STONE + lb) * KG_PER_LB;
  return kg >= 25 && kg <= 300 ? Math.round(kg * 10) / 10 : null;
}

const UNITS: { key: WeightUnit; label: string }[] = [
  { key: 'kg', label: 'kg' },
  { key: 'st_lb', label: 'st and lb' },
  { key: 'lb', label: 'lb' },
];

export const WEIGHT_QUESTION = 'Roughly what do you weigh?';

export function WeightQuestion({
  value,
  onChange,
}: {
  value: WeightAnswer | null;
  onChange: (answer: WeightAnswer | null) => void;
}) {
  const theme = useTheme();
  const [unit, setUnit] = useState<WeightUnit>('kg');
  const [fields, setFields] = useState({ kg: '', stone: '', pounds: '' });

  const unknown = value?.known === false;

  function update(next: Partial<typeof fields>) {
    const merged = { ...fields, ...next };
    setFields(merged);
    const kg = weightToKg(unit, merged);
    onChange(kg == null ? null : { known: true, kg });
  }

  function pickUnit(next: WeightUnit) {
    setUnit(next);
    // RE-READ IN THE NEW UNIT RATHER THAN CLEARED. Switching from kg to stone
    // with "70" typed must not silently reinterpret 70 as 70 stone - but it must
    // not throw away what she typed either. The fields are per-unit, so the kg
    // box keeps its 70 and the stone box is empty, which is the honest result.
    const kg = weightToKg(next, fields);
    onChange(kg == null ? null : { known: true, kg });
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="small">{WEIGHT_QUESTION}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        A guess is fine. You can change it any time.
      </ThemedText>

      <View style={styles.row}>
        {UNITS.map((u) => {
          const on = unit === u.key && !unknown;
          return (
            <Pressable
              key={u.key}
              onPress={() => pickUnit(u.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`Weight in ${u.label}`}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView
                type={on ? 'backgroundSelected' : 'background'}
                style={[styles.chip, { borderColor: on ? theme.accentDeep : theme.backgroundSelected }]}>
                <ThemedText type="small" themeColor={on ? 'accentDeep' : 'text'}>
                  {u.label}
                </ThemedText>
              </ThemedView>
            </Pressable>
          );
        })}
      </View>

      {!unknown && (
        <View style={styles.row}>
          {unit === 'kg' && (
            <TextInput
              value={fields.kg}
              onChangeText={(t) => update({ kg: t })}
              keyboardType="decimal-pad"
              placeholder="kg"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="Your weight in kilograms"
              style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
            />
          )}
          {unit === 'st_lb' && (
            <>
              <TextInput
                value={fields.stone}
                onChangeText={(t) => update({ stone: t })}
                keyboardType="number-pad"
                placeholder="stone"
                placeholderTextColor={theme.textSecondary}
                accessibilityLabel="Your weight in stone"
                style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
              />
              <TextInput
                value={fields.pounds}
                onChangeText={(t) => update({ pounds: t })}
                keyboardType="number-pad"
                placeholder="lb (optional)"
                placeholderTextColor={theme.textSecondary}
                accessibilityLabel="And pounds, if you know them"
                style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
              />
            </>
          )}
          {unit === 'lb' && (
            <TextInput
              value={fields.pounds}
              onChangeText={(t) => update({ pounds: t })}
              keyboardType="number-pad"
              placeholder="lb"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="Your weight in pounds"
              style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
            />
          )}
        </View>
      )}

      {/* ITS OWN TAP, not a blank field. See the header: "I do not know yet" is
          an answer, and it has to be distinguishable from not having answered. */}
      <Pressable
        onPress={() => {
          if (unknown) {
            onChange(null);
          } else {
            setFields({ kg: '', stone: '', pounds: '' });
            onChange({ known: false });
          }
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: unknown }}
        accessibilityLabel="I do not know yet"
        style={({ pressed }) => pressed && styles.pressed}>
        <ThemedText type="small" themeColor={unknown ? 'accentDeep' : 'textSecondary'}>
          {unknown ? 'I do not know yet (tap to undo)' : 'I do not know yet'}
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  // CardRadius, NOT ButtonRadius. ButtonRadius is 999, which is how you make a
  // pill out of something one line tall and how you make a BLOB out of anything
  // taller: the corners round until they meet and the card becomes an ellipse.
  // Ruth's screenshots of 2 October show it on the weight question and on the
  // panel that explains her targets - two enormous ovals with text inside them.
  //
  // It was invisible to me because I never loaded the screen. A 999 radius reads
  // as "fully rounded" in source and says nothing about the shape it makes.
  card: { padding: Spacing.four, borderRadius: CardRadius, gap: Spacing.three },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, alignItems: 'center' },
  chip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: ButtonRadius,
    borderWidth: 1,
  },
  input: {
    flexGrow: 1,
    flexBasis: 100,
    borderWidth: 1,
    borderRadius: ButtonRadius,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  pressed: { opacity: 0.7 },
});
