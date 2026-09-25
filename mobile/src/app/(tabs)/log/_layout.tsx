import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

// The Log tab is a stack whose root holds the list of what can be recorded,
// with every individual log one level in.
//
// Same reasoning the Body stack was built on and worth keeping: pressing the Log
// tab while inside a week log pops back to the list, which is what a thumb
// already expects. The root carries no header - the tab already says where you
// are - and the screens one level in get one, because arriving somewhere
// deserves a way back that is not a tab press.
export default function LogLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: theme.background },
        gestureEnabled: true,

        // NO TITLE IN A HEADER EITHER (Ruth, 25 September 2026): "Remove the
        // titles on the back buttons ... they don't make any sense. Arrow is
        // sufficient and could be more beautiful." Each screen names itself in
        // the display face instead, through BodyScreen's title prop. With the
        // header gone entirely there is nothing left to leak a route name into
        // - a screenshot once read "water-history".

        // NO NATIVE HEADER ON ANY SCREEN IN THIS STACK (Ruth, 25 September
        // 2026: the More mark "must sit at the same fixed vertical position on
        // every screen, flush top right, not relative to the page heading").
        //
        // A header's right-hand control sits wherever the header's height puts
        // it, which is a different height from the mark on a tab screen, which
        // is the inconsistency she is looking at. It cannot be reconciled while
        // half the app has a native header and half does not - so none of it
        // does. BodyScreen draws the back arrow and the mark itself, both
        // pinned to the screen rather than to anything on it.
        //
        // The swipe-back gesture is a Stack option and survives this: see
        // gestureEnabled above.
        headerShown: false,
      }}
    />
  );
}
