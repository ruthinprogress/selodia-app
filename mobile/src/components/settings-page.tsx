import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, MaxContentWidth, Spacing } from '@/constants/theme';
import { FigureMark } from '@/components/seed-marks';
import { useTheme } from '@/hooks/use-theme';

// THE FURNITURE EVERY SETTINGS PAGE SHARES (2026-09-20), from Ruth's IA brief:
// "Settings should simply become the hub ... Each opens its own page. This
// gives us somewhere sensible to add future features without redesigning the
// IA every few months."
//
// So the parts are here rather than in each page: one header treatment, one
// row, one card. A page that wants something new asks for it here, and every
// page gets it. The brief's visual direction - calm, airy, serif headings,
// soft dividers rather than heavy borders, a botanical mark - lives in this
// file and nowhere else, so it can be changed in one place.

export function SettingsPage({
  title,
  subtitle,
  back = true,
  children,
  footer,
}: {
  title?: string;
  subtitle?: string;
  /** The hub is reached from Chat and closes; its pages go back to the hub. */
  back?: boolean;
  children: ReactNode;
  /** The quiet line at the foot of a page, in her register. */
  footer?: string;
}) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          {!back && (
            // THE HUB IS A MODAL OVER THE TABS, and after the rebuild its only
            // way out was the Android back button or an iOS swipe (2026-09-20).
            // The single page it replaced had a Done, and a modal without a
            // visible way out is a trap on any phone whose gestures differ.
            <View style={styles.topBar}>
              <Pressable
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel="Close settings"
                hitSlop={Spacing.three}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <ThemedText type="small" themeColor="link">
                  Done
                </ThemedText>
              </Pressable>
            </View>
          )}

          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              {back && (
                <Pressable
                  onPress={() => router.back()}
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                  hitSlop={Spacing.three}
                  style={({ pressed }) => [styles.back, pressed && styles.pressed]}
                >
                  <Ionicons name="chevron-back" size={20} color={theme.textSecondary} />
                </Pressable>
              )}
              {/* THE HUB HAS NO TITLE (Ruth, 24 September 2026: "remove the
                  title entirely from Settings screen"). Calling it Settings was
                  wrong - it holds the profile, the report builder, the data
                  export - and the corner mark that opens it is three seeds
                  meaning "more", which needs no word repeating it underneath.
                  The pages BELOW it keep their titles: those really are one
                  thing each, and a person arriving needs to know which. */}
              {title ? <ThemedText type="display">{title}</ThemedText> : null}
              {subtitle && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
                  {subtitle}
                </ThemedText>
              )}
            </View>
            <Sprig />
          </View>

          <View style={styles.body}>{children}</View>

          {footer && (
            <ThemedView type="backgroundElement" style={styles.footer}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.footerText}>
                {footer}
              </ThemedText>
            </ThemedView>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/** A group of rows on one card, divided by a hairline rather than a border. */
export function SettingsGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      {title && (
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.groupTitle}>
          {title}
        </ThemedText>
      )}
      <ThemedView type="backgroundElement" style={styles.card}>
        {children}
      </ThemedView>
    </View>
  );
}

/** One row: an icon, what it is, what it holds, and where it goes. */
export function SettingsRow({
  icon,
  mark,
  label,
  detail,
  value,
  onPress,
  first,
  danger,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  /** One of the app's own drawn marks, where a borrowed icon would be wrong.
      The profile row uses it: that row is the person, and a stock silhouette
      beside the sprig and the seed looks like it came from somewhere else. */
  mark?: 'figure';
  label: string;
  /** The line under the label: what lives behind this row. */
  detail?: string;
  /** A value shown at the right instead of a chevron - for a row that states something. */
  value?: string;
  onPress?: () => void;
  first?: boolean;
  danger?: boolean;
}) {
  const theme = useTheme();
  const body = (
    <View style={[styles.row, !first && { borderTopColor: theme.backgroundSelected, borderTopWidth: 1 }]}>
      {mark === 'figure' ? (
        <FigureMark size={20} color={danger ? theme.danger : theme.textSecondary} />
      ) : icon ? (
        <Ionicons name={icon} size={20} color={danger ? theme.danger : theme.textSecondary} />
      ) : null}
      <View style={styles.rowText}>
        <ThemedText type="smallBold" themeColor={danger ? 'danger' : 'text'}>
          {label}
        </ThemedText>
        {detail && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.rowDetail}>
            {detail}
          </ThemedText>
        )}
      </View>
      {value ? (
        <ThemedText type="small" themeColor="textSecondary">
          {value}
        </ThemedText>
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
      ) : null}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {body}
    </Pressable>
  );
}

// A sprig, drawn rather than illustrated: two leaves off a stem, in the sand
// tone, sitting quietly beside the heading. The brief asks for "subtle
// botanical illustrations where appropriate"; anything more would compete with
// the serif.
function Sprig() {
  const theme = useTheme();
  return (
    <Svg width={54} height={70} viewBox="0 0 54 70" accessible={false}>
      <Path
        d="M40 4 C 30 22, 24 42, 22 66"
        fill="none"
        stroke={theme.backgroundSelected}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Path
        d="M34 18 C 44 10, 50 14, 48 24 C 46 33, 36 33, 31 28 Z"
        fill={theme.backgroundElement}
        stroke={theme.backgroundSelected}
        strokeWidth={1.3}
      />
      <Path
        d="M28 36 C 18 30, 10 35, 12 45 C 14 54, 24 53, 27 46 Z"
        fill={theme.backgroundElement}
        stroke={theme.backgroundSelected}
        strokeWidth={1.3}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerText: { flex: 1, gap: Spacing.one },
  back: { alignSelf: 'flex-start', marginBottom: Spacing.one },
  topBar: { alignItems: 'flex-end' },
  subtitle: { lineHeight: 20, maxWidth: 260 },
  body: { gap: Spacing.four },
  group: { gap: Spacing.one },
  groupTitle: { marginLeft: Spacing.two },
  card: { borderRadius: CardRadius, paddingHorizontal: Spacing.three },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowText: { flex: 1, gap: 2 },
  rowDetail: { lineHeight: 18 },
  footer: {
    borderRadius: CardRadius,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  footerText: { lineHeight: 20, textAlign: 'center' },
  pressed: { opacity: 0.6 },
});
