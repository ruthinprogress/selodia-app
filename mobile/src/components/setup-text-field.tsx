import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// A PLAIN BOX THAT SAVES WHAT SHE TYPED. No model, no round trip, no waiting.
//
// Ruth, 1 October 2026: "Remove the setup chat panels and every model call from
// the onboarding path. 'Something else?' and similar boxes become plain text
// fields that save EXACTLY as typed, immediately, and show in the draft. Chat can
// tidy them later."
//
// WHAT IT REPLACES, AND WHY SHE IS RIGHT. Earlier today I moved those
// conversations OUT of the Chat tab and onto the setup screen, which fixed a real
// trap - setup used to throw her into chat with no way back. It did not fix the
// thing she actually minds. Her rule from 28 September, restated tonight:
// onboarding is TAPS ONLY, about a minute, and every answer changes something.
// A chat panel in setup is still a model call, still several seconds, still a
// conversation to have before she has seen the app - and it was still the slowest
// part of a flow whose whole promise is a minute.
//
// SAVED ON BLUR AND ON "Save", not on a Continue she might never press. The
// panel's failure mode was a conversation she had to finish; this one's would be
// a sentence typed and lost, so the save happens as soon as she stops typing.
//
// EXACTLY AS TYPED. No parsing, no tidying, no model deciding what she meant.
// "Nickel, and raw celery sometimes" is stored as that sentence. It is worse
// structured data and it is a true record, and the draft can show it back the
// same evening rather than after a round trip that might fail. Chat can turn it
// into items later, which is the one thing chat is genuinely better at.
//
// IT KEEPS THE KEYBOARD CLEAR. Ruth, finding B3: the Samsung keyboard covered the
// box in the panel. The caller renders this inside the setup page's ScrollView,
// which has keyboardShouldPersistTaps and scrolls the focused input into view -
// a plain input in a scroll view is a solved problem in a way an embedded
// transcript was not.
export function SetupTextField({
  label,
  placeholder,
  value,
  onChangeText,
  onSave,
  saving = false,
  saved = false,
  failed = false,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  /** Called on blur and on Save. Idempotent: the caller may be asked twice. */
  onSave: () => void;
  saving?: boolean;
  saved?: boolean;
  failed?: boolean;
}) {
  const theme = useTheme();
  const [touched, setTouched] = useState(false);

  return (
    <ThemedView style={styles.wrap}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <TextInput
        value={value}
        onChangeText={(t) => {
          setTouched(true);
          onChangeText(t);
        }}
        onBlur={() => {
          if (touched && value.trim()) onSave();
        }}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel={label}
        multiline
        style={[styles.field, { color: theme.text, borderColor: theme.backgroundSelected }]}
      />

      <View style={styles.row}>
        <Pressable
          onPress={onSave}
          disabled={!value.trim() || saving}
          accessibilityRole="button"
          accessibilityLabel="Save this"
          accessibilityState={{ disabled: !value.trim() || saving }}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedText
            type="smallBold"
            themeColor={value.trim() && !saving ? 'accentDeep' : 'textSecondary'}>
            {saving ? 'Saving…' : 'Save'}
          </ThemedText>
        </Pressable>

        {/* SAID, BECAUSE SHE CANNOT SEE A DATABASE. The panel had a reply to
            prove something happened; a text box has nothing unless it says so. */}
        {saved && !saving && (
          <ThemedText type="small" themeColor="textSecondary">
            Saved.
          </ThemedText>
        )}
        {failed && (
          <ThemedText type="small" themeColor="danger">
            That didn&apos;t save. Your words are still here, so try again.
          </ThemedText>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  field: {
    borderWidth: 1,
    borderRadius: CardRadius,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    minHeight: 76,
    textAlignVertical: 'top',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  pressed: { opacity: 0.6 },
});
