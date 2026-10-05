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
  sprig = true,
  children,
  footer,
}: {
  title?: string;
  subtitle?: string;
  /** The hub is reached from Chat and closes; its pages go back to the hub. */
  back?: boolean;
  /**
   * The drawn sprig beside the heading.
   *
   * OFF ON THE HUB (Ruth, 5 October 2026: "remove the odd illustration"). It was
   * drawn to sit beside a serif heading, and the hub had no heading - so it hung
   * in the top right corner next to a line of body text, attached to nothing. It
   * stays on the pages that have a title for it to sit beside.
   */
  sprig?: boolean;
  children: ReactNode;
  /** The quiet line at the foot of a page, in her register. */
  footer?: string;
}) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* THE "DONE" BAR IS GONE (Ruth, 5 October 2026: "Remove 'Done' button
              and replace with the same back button in rest of app").

              It was right when this was the only modal: a modal with no visible
              way out is a trap on any phone whose gestures differ. But it was
              one word, top right, in a different place and a different shape
              from the way back on every other page - so the hub was the one
              screen where leaving worked differently, and it is the screen
              somebody new reaches first. The chevron does the same thing,
              router.back(), in the place they have already learned. */}
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
            {sprig && <Sprig />}
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
  // NO accessible={false} ON THESE SVGs (2026-09-26). react-native-svg passes
  // it straight through to the DOM on web, where `accessible` is not a boolean
  // attribute, so React logs "Received `false` for a non-boolean attribute" -
  // which the app's own error toast then shows over the page. A decorative
  // drawing with no text in it announces nothing to a screen reader anyway, so
  // the prop was buying nothing and costing a warning on every screen that
  // draws one.
  return (
    <Svg width={54} height={70} viewBox="0 0 54 70">
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
    // ROOM TO SCROLL PAST THE PHONE'S OWN BAR (Ruth, 5 October 2026: "cant access
    // bottom of options cards... just increase blank space at the end to scroll
    // past phone bottom banner").
    //
    // SafeAreaView insets the bottom, which keeps content OUT from under the
    // navigation bar but leaves the last card sitting flush against it with
    // nowhere further to scroll - so on a long page the final option is pinned in
    // the one place a thumb is least able to reach. Spacing.six twice over is a
    // screen-bottom's worth of quiet, and it costs a short page nothing.
    paddingBottom: Spacing.six * 2,
    gap: Spacing.four,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerText: { flex: 1, gap: Spacing.one },
  back: { alignSelf: 'flex-start', marginBottom: Spacing.one },
  // NO maxWidth (5 October 2026). 260 was a measure chosen to keep the
  // subtitle clear of the sprig; with no sprig it simply made a full sentence
  // break early and sit short of the cards under it - Ruth: "Bring the text...
  // down and aligned with the cards much more." It keeps the page's own measure
  // instead, which is what the cards keep.
  subtitle: { lineHeight: 20 },
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
