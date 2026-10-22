import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTheme } from '@/hooks/use-theme';

// NAMES UNDER THE ICONS (2026-09-20). They were hidden while there were four
// destinations and each icon did the explaining. At five, two of them new, a
// bar of unlabelled symbols is a guessing game - and her design shows the
// names. Android sizes them itself in a five-item bar.
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
        <NativeTabs.Trigger.Label>Chat</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="chatbubble-ellipses-outline" />}
        />
      </NativeTabs.Trigger>

      {/* LOG (UI brief, Part 1, 2026-09-17). Food, Activity and Measurements,
          which were three routes inside the old Body tab. Second from the left
          because logging is the thing done most often after talking. */}
      <NativeTabs.Trigger name="log">
        <NativeTabs.Trigger.Label>Log</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="create-outline" />}
        />
      </NativeTabs.Trigger>

      {/* TODAY, NOT BODY (UI brief, 2026-09-17). The screen is a day, not a
          body: it greets, dates itself, and carries today's figures, water, the
          week's flower and what she burns. The history views it used to hold
          have moved to Log. */}
      <NativeTabs.Trigger name="now">
        <NativeTabs.Trigger.Label>Now</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="today-outline" />}
        />
      </NativeTabs.Trigger>

      {/* PLANS (Ruth's navigation brief, 2026-09-20): "What am I intentionally
          following?" Everything that was the Almanac's Movement view, moved
          rather than rebuilt.

          A MAP, NOT A COMPASS (22 October 2026). It was a compass until today
          and everybody read it as Explore - including ChatGPT, which relabelled
          the tab "Explore" unprompted while drawing her food artwork. That is
          about as clean a piece of evidence as a misread icon ever gives you.

          A compass says "browse around", which is the opposite of both things
          this tab holds: her week, and what she is working towards. A map is a
          route already chosen, which is her own phrase for the tab - what am I
          intentionally following. */}
      <NativeTabs.Trigger name="plans">
        <NativeTabs.Trigger.Label>Plans</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="map-outline" />}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="me">
        <NativeTabs.Trigger.Label>Me</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="person-outline" />}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
