import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  // Through useTheme like everything else. This read Colors[scheme] directly
  // until 2026-09-03, which meant the tab bar kept following the system even
  // after the app stopped.
  const colors = useTheme();

  // Order is the user journey, left to right: do, then measure, then understand.
  // Chat is where things are logged, Body is where they are measured, Almanac is
  // where they are understood. Body sat third until 2026-09-03, which put the
  // thing people open most often furthest from the thumb.
  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      // Terracotta for the tab you are on, softened charcoal for the rest.
      // accent at full strength is 3.10:1 on cream, which clears the 3:1 a
      // non-text control needs but nothing more, so it stays an icon tint and
      // never becomes a label colour.
      tintColor={colors.accent}
      iconColor={colors.textSecondary}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label hidden>Chat</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="chatbubble-ellipses-outline" />}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="body">
        <NativeTabs.Trigger.Label hidden>Body</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="body-outline" />}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="almanac">
        <NativeTabs.Trigger.Label hidden>Almanac</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="book-outline" />}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
