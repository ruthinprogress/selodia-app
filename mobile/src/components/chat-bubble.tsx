import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

type ChatBubbleProps = {
  role: 'assistant' | 'user';
  children: string;
};

export function ChatBubble({ role, children }: ChatBubbleProps) {
  return (
    <ThemedView
      type={role === 'assistant' ? 'backgroundElement' : 'backgroundSelected'}
      style={[styles.bubble, role === 'user' && styles.userBubble]}>
      <ThemedText type="small">{children}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  bubble: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    maxWidth: '85%',
    alignSelf: 'flex-start',
  },
  userBubble: {
    alignSelf: 'flex-end',
  },
});
