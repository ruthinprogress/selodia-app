import { useEffect, useRef } from 'react';
import { View, type ScrollView, type StyleProp, type ViewStyle } from 'react-native';

import { useSpotlight, useSpotlightScroll } from '@/components/spotlight-provider';
import type { Rect, SpotlightId } from '@/lib/spotlight';

// Marks one element as something Unflump is allowed to point at (build item 23).
//
// A PLAIN WRAPPER ON PURPOSE. It renders a View around its children and nothing
// else - no styling, no pressability, no layout opinion - so wrapping an element
// cannot change how that element looks or behaves. Anything that made the
// wrapper visible would mean fifteen screens quietly shifting to serve a feature
// that fires almost never.
//
// SCROLLING FIRST, MEASURING SECOND. A target inside a ScrollView may be off
// screen when the request arrives, and measureInWindow would happily return
// coordinates above or below the display - a cut-out over nothing. Passing
// `scrollRef` makes the target bring itself into view first and measure after.
// The delay before measuring is the price of a scroll animation that has no
// completion callback here; it is deliberately generous, since measuring early
// gives a confidently wrong rectangle and measuring late costs a moment.

const SCROLL_SETTLE_MS = 400;
// Leaves the element clear of a header rather than flush against the top edge.
const SCROLL_MARGIN = 96;

export function SpotlightTarget({
  id,
  children,
  scrollRef,
  onActivate,
  style,
}: {
  id: SpotlightId;
  children: React.ReactNode;
  // The ScrollView this target sits inside, when it sits inside one.
  scrollRef?: React.RefObject<ScrollView | null>;
  // What tapping the highlight should do - usually the same handler as the
  // wrapped control's own onPress. Omitted where the control is already visible
  // and tappable once the overlay closes.
  onActivate?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const ref = useRef<View | null>(null);
  const spotlight = useSpotlight();
  // An explicit prop wins; otherwise the screen's own scroller, if it declared
  // one. Neither is an error - a target that is always on screen needs no scroll.
  const contextScroll = useSpotlightScroll();
  const scroller = scrollRef ?? contextScroll;
  // Read through a ref inside measure() so a changing handler never forces a
  // re-registration, which would restart the request it is part of. Written in
  // an effect rather than during render - the React Compiler is right that a
  // ref touched in the render body is a bug waiting to happen.
  const activate = useRef(onActivate);
  useEffect(() => {
    activate.current = onActivate;
  }, [onActivate]);

  useEffect(() => {
    if (!spotlight) return;

    const measure = async (): Promise<Rect | null> => {
      const node = ref.current;
      if (!node) return null;

      if (scroller?.current) {
        await new Promise<void>((resolve) => {
          try {
            node.measureLayout(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- measureLayout's ref overload is untyped on this RN version; the try/catch below is the real guard.
              scroller.current as any,
              (_x, y) => {
                scroller.current?.scrollTo({ y: Math.max(0, y - SCROLL_MARGIN), animated: true });
                setTimeout(resolve, SCROLL_SETTLE_MS);
              },
              // Measuring against the scroller can fail while it is still laying
              // out. Carry on and measure where the element currently is - a
              // visible target is the common case, and refusing to point at it
              // because the scroll check failed would be worse than not scrolling.
              () => resolve()
            );
          } catch {
            resolve();
          }
        });
      }

      return new Promise<Rect | null>((resolve) => {
        const node2 = ref.current;
        if (!node2) return resolve(null);
        try {
          node2.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
        } catch {
          resolve(null);
        }
      });
    };

    return spotlight.register(id, { measure, onActivate: () => activate.current?.() });
  }, [id, spotlight, scroller]);

  return (
    <View ref={ref} style={style} collapsable={false}>
      {children}
    </View>
  );
}
