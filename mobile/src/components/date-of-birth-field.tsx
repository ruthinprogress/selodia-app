import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

type DateOfBirthFieldProps = {
  value: Date | null;
  onChange: (date: Date) => void;
};

export function DateOfBirthField({ value, onChange }: DateOfBirthFieldProps) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <ThemedView style={styles.fieldGroup}>
      <ThemedText type="small" themeColor="textSecondary">
        Date of birth
      </ThemedText>
      <Pressable onPress={() => setShowPicker(true)}>
        <ThemedView type="backgroundElement" style={styles.input}>
          <ThemedText themeColor={value ? 'text' : 'textSecondary'}>
            {value ? value.toLocaleDateString() : 'Select date of birth'}
          </ThemedText>
        </ThemedView>
      </Pressable>
      {showPicker && (
        <DateTimePicker
          value={value ?? new Date(2000, 0, 1)}
          mode="date"
          maximumDate={new Date()}
          onChange={(_event, selectedDate) => {
            setShowPicker(Platform.OS === 'ios');
            if (selectedDate) onChange(selectedDate);
          }}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fieldGroup: {
    gap: Spacing.two,
  },
  input: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
});
