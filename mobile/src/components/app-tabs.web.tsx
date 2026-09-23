import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, TabList, TabTrigger, TabSlot, TabTriggerSlotProps, TabListProps } from 'expo-router/ui';
import { Pressable, View, StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// THE WEB STAND-IN FOR THE NATIVE TAB BAR.
//
// NativeTabs has no web implementation, so web gets this instead. That is fine.
// What was not fine is that this file was still the Expo starter template
// (found 23 September 2026 while screenshotting every screen): three triggers -
// Chat, Today, Almanac - a "Docs" link out to docs.expo.dev, and a body icon on
// Today left over from when the tab was called Body.
//
// IT IS NOT DECORATION. expo-router/ui routes only to declared triggers, so the
// two missing ones meant /log and /plans could not be reached in a browser at
// all: asking for them landed silently on Chat with the URL still reading /log.
// Two of the five tabs, and every screen underneath them, simply did not exist
// on web. Nothing on the phone was affected, which is why it went unnoticed.
//
// So this mirrors app-tabs.tsx deliberately: the same five triggers, in the same
// order (talk, record, see the day, follow a plan, understand it), the same
// labels and the same icons. When a tab is added there it has to be added here
// too, or it disappears from this surface without a word.
const TABS = [
  { name: 'chat', href: '/', label: 'Chat', icon: 'chatbubble-ellipses-outline' },
  { name: 'log', href: '/log', label: 'Log', icon: 'create-outline' },
  { name: 'today', href: '/today', label: 'Today', icon: 'today-outline' },
  { name: 'plans', href: '/plans', label: 'Plans', icon: 'compass-outline' },
  { name: 'almanac', href: '/almanac', label: 'Almanac', icon: 'book-outline' },
] as const;

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton iconName={tab.icon} label={tab.label} />
            </TabTrigger>
          ))}
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

type TabButtonProps = TabTriggerSlotProps & {
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
};

export function TabButton({ iconName, label, isFocused, ...props }: TabButtonProps) {
  const colors = useTheme();

  return (
    <Pressable {...props} style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.tabButtonView}>
        {/* Terracotta on the tab you are on, the same as the native bar. */}
        <Ionicons name={iconName} size={20} color={isFocused ? colors.accent : colors.textSecondary} />
        <ThemedText type="smallBold" style={{ color: isFocused ? colors.text : colors.textSecondary }}>
          {label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
        {props.children}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexGrow: 1,
    gap: Spacing.one,
    maxWidth: MaxContentWidth,
  },
  pressed: {
    opacity: 0.7,
  },
  tabButton: {
    flex: 1,
  },
  tabButtonView: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.three,
    alignItems: 'center',
    gap: 2,
  },
});
