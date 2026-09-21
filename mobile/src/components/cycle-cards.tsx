import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// THE PIECES OF THE CYCLE PAGE, from her ChatGPT mock (21 September 2026).
//
// Separated from the screen because the screen's job is already large enough -
// six cards, an arrangement she can change, a date that can be set in hindsight
// and a save. A card here knows only how to draw itself.

export function Card({
  icon,
  title,
  optional,
  onHide,
  children,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  optional?: boolean;
  /** Shown only while she is choosing what to show. */
  onHide?: () => void;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.head}>
        <MaterialCommunityIcons name={icon} size={20} color={theme.accent} />
        <ThemedText style={styles.title}>{title}</ThemedText>
        {optional && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.optional}>
            optional
          </ThemedText>
        )}
        <View style={styles.spacer} />
        {onHide && (
          <Pressable
            onPress={onHide}
            accessibilityRole="button"
            accessibilityLabel={`Put ${title} away`}
            hitSlop={Spacing.two}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <MaterialCommunityIcons name="minus-circle-outline" size={20} color={theme.textSecondary} />
          </Pressable>
        )}
      </View>
      {children}
    </ThemedView>
  );
}

/**
 * A row of choices.
 *
 * CHIPS RATHER THAN A PICKER, because the whole point of this screen is that
 * recording a day takes seconds. A dropdown for "light, medium, heavy" would be
 * three taps for one fact.
 */
export function Chips({
  options,
  selected,
  onToggle,
  single,
}: {
  options: string[];
  selected: string[];
  onToggle: (option: string) => void;
  /** True where only one answer makes sense - flow, mucus. */
  single?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const on = selected.some((s) => s.toLowerCase() === o.toLowerCase());
        return (
          <Pressable
            key={o}
            onPress={() => onToggle(o)}
            accessibilityRole={single ? 'radio' : 'checkbox'}
            accessibilityState={{ selected: on, checked: on }}
            accessibilityLabel={o}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <View
              style={[
                styles.chip,
                { borderColor: on ? theme.accent : theme.backgroundSelected },
                on && { backgroundColor: theme.background },
              ]}
            >
              <ThemedText type="small" themeColor={on ? 'accentDeep' : 'text'}>
                {o}
              </ThemedText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The "Add another" that makes the symptom list hers. */
export function AddAnother({
  value,
  onChange,
  onAdd,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  placeholder: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.add}>
      <TextInput
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onAdd}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        returnKeyType="done"
        maxLength={40}
        style={[styles.addInput, { color: theme.text, backgroundColor: theme.background }]}
        accessibilityLabel={placeholder}
      />
      <Pressable
        onPress={onAdd}
        disabled={!value.trim()}
        accessibilityRole="button"
        accessibilityLabel="Add it"
        hitSlop={Spacing.two}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <ThemedText type="small" themeColor={value.trim() ? 'link' : 'textSecondary'}>
          Add
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: CardRadius,
    padding: Spacing.three,
    marginBottom: Spacing.two,
    gap: Spacing.two,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { fontSize: 17 },
  optional: { fontStyle: 'italic' },
  spacer: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
  },
  add: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  addInput: {
    flex: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    fontSize: 15,
  },
  pressed: { opacity: 0.6 },
});
