import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type DateOfBirthFieldProps = {
  value: Date | null;
  onChange: (date: Date) => void;
};

// No web implementation exists in @react-native-community/datetimepicker
// (it renders null and warns) - a plain HTML date input is the standard,
// good way to do this in a browser anyway.
export function DateOfBirthField({ value, onChange }: DateOfBirthFieldProps) {
  const theme = useTheme();

  return (
    <ThemedView style={{ gap: Spacing.two }}>
      <ThemedText type="small" themeColor="textSecondary">
        Date of birth
      </ThemedText>
      <input
        type="date"
        value={value ? value.toISOString().slice(0, 10) : ''}
        max={new Date().toISOString().slice(0, 10)}
        onChange={(e) => {
          if (e.target.value) onChange(new Date(e.target.value));
        }}
        style={{
          padding: Spacing.three,
          borderRadius: Spacing.three,
          border: 'none',
          backgroundColor: theme.backgroundElement,
          color: theme.text,
          fontSize: 16,
          fontFamily: 'inherit',
        }}
      />
    </ThemedView>
  );
}
