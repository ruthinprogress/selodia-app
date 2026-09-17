import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  // Through useTheme like everything else. This read Colors[scheme] directly
  // until 2026-09-03, which meant the tab bar kept following the system even
  // after the app stopped.
  const colors = useTheme();

  // Order is the user journey, left to right: talk, record, see the day, then
  // understand it. Chat · Log · Today · Almanac, the four tabs the UI brief
  // specifies (2026-09-17). Body was the middle tab until then and is now Today;
  // its three history views became Log.
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

      {/* LOG (UI brief, Part 1, 2026-09-17). Food, Activity and Measurements,
          which were three routes inside the old Body tab. Second from the left
          because logging is the thing done most often after talking. */}
      <NativeTabs.Trigger name="log">
        <NativeTabs.Trigger.Label hidden>Log</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="create-outline" />}
        />
      </NativeTabs.Trigger>

      {/* TODAY, NOT BODY (UI brief, 2026-09-17). The screen is a day, not a
          body: it greets, dates itself, and carries today's figures, water, the
          week's flower and what she burns. The history views it used to hold
          have moved to Log. */}
      <NativeTabs.Trigger name="today">
        <NativeTabs.Trigger.Label hidden>Today</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="today-outline" />}
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
