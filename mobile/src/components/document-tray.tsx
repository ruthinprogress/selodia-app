import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { canPickFiles, MAX_PAGES, type DocumentPage } from '@/lib/document-pages';

// WHERE THE PAGES OF A LETTER WAIT (Ruth, 20 September 2026).
//
// Every other photo in this app is logged the moment it is taken, because a
// plate of food is one photograph. A consultant letter is three sides, and the
// parts she needs are spread across them - the hospital number on the first,
// the findings in the middle, the route back in at the end. So a document is
// the one thing here that is gathered before it is read.
//
// IT SITS ABOVE THE COMPOSER, not in a modal. She may want to look back at the
// conversation while deciding whether she has all the pages, and a sheet over
// the top would take that away. It is also how she leaves: nothing has been
// sent, so Cancel costs nothing and says so.
//
// IT SAYS WHAT WILL HAPPEN. Not "upload" - upload is where her last assistant
// kept her medical files, and this app deliberately keeps none. The button says
// Read it, and the line underneath says the pages are not kept.

export function DocumentTray({
  pages,
  busy,
  onAddPhoto,
  onAddLibrary,
  onAddFile,
  onRemove,
  onRead,
  onCancel,
}: {
  pages: DocumentPage[];
  busy: boolean;
  onAddPhoto: () => void;
  onAddLibrary: () => void;
  onAddFile: () => void;
  onRemove: (index: number) => void;
  onRead: () => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  if (pages.length === 0) return null;

  const full = pages.length >= MAX_PAGES;

  return (
    <ThemedView type="backgroundElement" style={styles.tray}>
      <View style={styles.head}>
        <ThemedText type="smallBold">
          {pages.length === 1 ? 'A document, 1 page' : `A document, ${pages.length} pages`}
        </ThemedText>
        <Pressable
          onPress={onCancel}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Cancel this document"
          hitSlop={Spacing.two}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedText type="small" themeColor="textSecondary">
            Cancel
          </ThemedText>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip}>
        {pages.map((p, i) => (
          <ThemedView key={`${p.label}-${i}`} style={styles.chip}>
            <ThemedText type="small" numberOfLines={1} style={styles.chipLabel}>
              {p.mediaType === 'application/pdf' ? 'PDF' : `Page ${i + 1}`}
            </ThemedText>
            <Pressable
              onPress={() => onRemove(i)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={`Remove page ${i + 1}`}
              hitSlop={Spacing.two}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Ionicons name="close" size={14} color={theme.textSecondary} />
            </Pressable>
          </ThemedView>
        ))}
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          onPress={onAddPhoto}
          disabled={busy || full}
          accessibilityRole="button"
          accessibilityLabel="Photograph another page"
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedText type="small" themeColor={full ? 'textSecondary' : 'link'}>
            Photo
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={onAddLibrary}
          disabled={busy || full}
          accessibilityRole="button"
          accessibilityLabel="Add pages from your gallery"
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedText type="small" themeColor={full ? 'textSecondary' : 'link'}>
            Gallery
          </ThemedText>
        </Pressable>

        {/* Only on the build that can open one. See canPickFiles(). */}
        {canPickFiles() && (
          <Pressable
            onPress={onAddFile}
            disabled={busy || full}
            accessibilityRole="button"
            accessibilityLabel="Add a PDF"
            style={({ pressed }) => pressed && styles.pressed}
          >
            <ThemedText type="small" themeColor={full ? 'textSecondary' : 'link'}>
              PDF
            </ThemedText>
          </Pressable>
        )}

        <View style={styles.spacer} />

        <Pressable
          onPress={onRead}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Read this document"
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedView style={[styles.read, { backgroundColor: theme.accentDeep }]}>
            <ThemedText type="smallBold" themeColor="background">
              {busy ? 'Reading…' : 'Read it'}
            </ThemedText>
          </ThemedView>
        </Pressable>
      </View>

      <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
        {busy
          ? 'Reading every page together, and checking the reference numbers twice.'
          : 'Selodía reads the pages and keeps what you agree to. The pages themselves are not kept.'}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  tray: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    gap: Spacing.two,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  strip: { flexGrow: 0 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    marginRight: Spacing.one,
  },
  chipLabel: { maxWidth: 120 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  spacer: { flex: 1 },
  read: { borderRadius: Spacing.three, paddingVertical: Spacing.two, paddingHorizontal: Spacing.four },
  note: { lineHeight: 17 },
  pressed: { opacity: 0.6 },
});
