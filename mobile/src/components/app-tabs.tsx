import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : (scheme ?? 'light')];

  // Order is the user journey, left to right: do, then measure, then understand.
  // Chat is where things are logged, Body is where they are measured, Almanac is
  // where they are understood. Body sat third until 2026-09-03, which put the
  // thing people open most often furthest from the thumb.
  return (
    <NativeTabs backgroundColor={colors.background} indicatorColor={colors.backgroundElement}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label hidden>Chat</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="chatbubble-ellipses-outline" />}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="dashboard">
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
