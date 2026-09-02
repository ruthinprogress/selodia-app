import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

// A chat turn. Ordinarily just text; a turn can also carry a discuss-card image
// (build item 30) — the entry's breakdown card posted into the thread as a
// shared visual reference both the person and Selodia can see.
//
// expo-image is already a dependency, so the image variant adds no native
// module and ships over EAS Update like any other JS change.

type ChatBubbleProps = {
  role: 'assistant' | 'user';
  children?: string;
  // A signed URL (the bucket is private, see chat-images.ts). Null while it is
  // still being signed, or if signing failed — either way the bubble renders
  // its text rather than a broken frame.
  imageUri?: string | null;
};

export function ChatBubble({ role, children, imageUri }: ChatBubbleProps) {
  const hasText = typeof children === 'string' && children.length > 0;

  return (
    <ThemedView
      type={role === 'assistant' ? 'backgroundElement' : 'backgroundSelected'}
      style={[styles.bubble, role === 'user' && styles.userBubble]}>
      {imageUri && (
        <Image
          source={{ uri: imageUri }}
          style={[styles.image, hasText && styles.imageWithText]}
          // contentFit="contain" because a captured card is a document, not a
          // photo: cropping it to fill would cut off the very content the
          // conversation is about.
          contentFit="contain"
          transition={150}
          alt="The entry being discussed"
        />
      )}
      {/* Selectable so a turn can actually be copied - long-press gives the
          platform's own selection handles and copy menu. Found live 2026-08-27:
          nothing in the app was selectable, because RN <Text> defaults to false,
          so neither Selodia's replies NOR the person's own messages could be
          copied out. One prop here covers Chat and all seven onboarding steps,
          since they all render through this component. */}
      {hasText && (
        <ThemedText type="small" selectable>
          {children}
        </ThemedText>
      )}
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
  image: {
    width: 240,
    // Portrait-ish, matching the breakdown card's own shape. Fixed rather than
    // measured so the thread doesn't reflow as images finish loading.
    aspectRatio: 0.8,
    borderRadius: Spacing.two,
  },
  imageWithText: {
    marginBottom: Spacing.two,
  },
});
