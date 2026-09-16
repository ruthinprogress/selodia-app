import { Image } from 'expo-image';
import { Image as RNImage, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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

// THE SEEDMARK BESIDE HER TURNS (Ruth, 2026-09-16: "instead of the leaf, use our
// seedmark"). A design she was shown put a leaf avatar next to the assistant's
// replies, and the thing it was reaching for is right - a thread reads as
// somebody speaking rather than text arriving - but the app has its own mark and
// does not need a borrowed one.
//
// THE SAME ASSET THE FLOWER USES, required the same way, so there is one seedmark
// in the app and not two that slowly stop matching. Cream on terracotta, which is
// the approved treatment: the mark never carries its own ground elsewhere either.
//
// Hidden from screen readers. It is decoration on a turn the reader already knows
// is Selodia's, and a second voice announcing "Selodia" before every reply would
// be read out on top of the reply itself.
function SeedAvatar() {
  const theme = useTheme();
  return (
    <View style={[styles.avatar, { backgroundColor: theme.accent }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <RNImage
        /* eslint-disable-next-line @typescript-eslint/no-require-imports --
           an ES import of a .png has no type declaration here, so require is the
           form that resolves. Same call health-flower.tsx makes. */
        source={require('@/assets/images/mark.png')}
        style={styles.avatarMark}
        resizeMode="contain"
      />
    </View>
  );
}

export function ChatBubble({ role, children, imageUri }: ChatBubbleProps) {
  const hasText = typeof children === 'string' && children.length > 0;

  // Assistant turns sit in a row beside the mark; the person's own turns are
  // unchanged and still hug the right edge.
  if (role === 'assistant') {
    return (
      <View style={styles.assistantRow}>
        <SeedAvatar />
        <ThemedView type="backgroundElement" style={[styles.bubble, styles.assistantBubble]}>
          {imageUri && (
            <Image
              source={{ uri: imageUri }}
              style={[styles.image, hasText && styles.imageWithText]}
              contentFit="contain"
              transition={150}
              alt="The entry being discussed"
            />
          )}
          {hasText && (
            <ThemedText type="small" selectable>
              {children}
            </ThemedText>
          )}
        </ThemedView>
      </View>
    );
  }

  // Everything below is the person's own turn: the assistant returned above.
  return (
    <ThemedView type="backgroundSelected" style={[styles.bubble, styles.userBubble]}>
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
  // Bottom-aligned: the mark sits with the last line of a long reply rather than
  // floating at the top of a tall bubble.
  assistantRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  // The row owns the alignment now, and the bubble may take what is left of it.
  assistantBubble: {
    alignSelf: 'flex-end',
    flexShrink: 1,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    // Never squashed when a long reply pushes the row.
    flexShrink: 0,
  },
  avatarMark: {
    width: 18,
    height: 18,
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
