import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Animated, Easing } from 'react-native';

import { useSpotlight } from '@/components/spotlight-provider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ANCHOR_GAP, anchorBelow, HOLE_PADDING, type Rect } from '@/lib/spotlight';

// The spotlight itself (Part Six, build item 23 — Tier A).
//
// A PULSE, NOT A GLOW, and Part Six says why in its own parenthesis: "to
// actively prompt a tap rather than passively sit there". A static ring is
// decoration; a ring that breathes is an invitation. So the ring's opacity and
// scale cycle continuously rather than settling.
//
// FOUR RECTANGLES, NOT A MASK. The dim is drawn as the four regions around the
// element - above, below, left, right - which leaves the element itself
// untouched and needs no SVG, no mask and no extra dependency. The element is
// not re-rendered into the overlay: it is the real control, seen through a gap,
// so what someone taps is the thing itself.
//
// A MODAL, because the dim has to cover the whole window. It also means the
// overlay survives the screen underneath scrolling or re-rendering.
//
// TAPPING ANYWHERE DISMISSES, per Part Six, and there is no confirm button - a
// "got it" would turn a hint into a task. Tapping the element forwards the press
// to the control underneath (see the provider) so the hint completes the action
// it was hinting at.
//
// REACT NATIVE'S OWN Animated, NOT REANIMATED, for the loop. Reanimated is in
// the project and used by the splash, but a shared value assigned from an effect
// is exactly what the React Compiler's immutability rule rejects, and the honest
// workarounds all involve telling the linter it is wrong about a component that
// cannot be device-tested here. An opacity-and-scale loop on the native driver is
// the smaller, older, more predictable primitive, and it is all a pulse needs.
//
// NOT DEVICE-VERIFIED. Geometry, the cut-out alignment and the pulse cannot be
// checked by typecheck or lint, and there is no cheap render path for a native
// overlay. Everything here is arithmetic over a measured rect, written to fail
// safe - an unmeasurable target renders nothing at all rather than a ring around
// the origin - but the alignment itself needs a real build on a real device.

const PULSE_MS = 900;

export function SpotlightOverlay() {
  const spotlight = useSpotlight();
  const theme = useTheme();
  const { width: winW, height: winH } = useWindowDimensions();
  // Keyed by the target it belongs to, so a stale measurement can never be drawn
  // against a newer request - and so the effect never has to clear state
  // synchronously, which is a cascading render the compiler rightly objects to.
  const [measured, setMeasured] = useState<{ id: string; rect: Rect } | null>(null);
  const pulse = useMemo(() => new Animated.Value(0), []);

  const active = spotlight?.active ?? null;
  const showing = active?.showing ?? null;
  const measureActive = spotlight?.measureActive;

  useEffect(() => {
    if (!showing || !measureActive) return;
    let cancelled = false;
    // Measured on activation rather than on layout: a target's position is only
    // interesting at the moment it is pointed at, and measuring fifteen wrappers
    // continuously to serve a rare event would be a real cost for no gain.
    measureActive().then((r) => {
      if (!cancelled && r) setMeasured({ id: showing, rect: r });
    });
    return () => {
      cancelled = true;
    };
  }, [showing, measureActive]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: PULSE_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: PULSE_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // Nothing measurable means nothing shown. A request for a target that has
  // scrolled away, unmounted, or laid out at zero size ends as silence rather
  // than as a ring around the top-left corner - and a measurement belonging to a
  // previous request is treated as no measurement at all.
  const rect = measured && measured.id === showing ? measured.rect : null;
  if (!active || !rect) return null;

  const hole = {
    x: Math.max(0, rect.x - HOLE_PADDING),
    y: Math.max(0, rect.y - HOLE_PADDING),
    width: rect.width + HOLE_PADDING * 2,
    height: rect.height + HOLE_PADDING * 2,
  };
  const below = anchorBelow(hole, winH, 140);

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => spotlight?.dismiss()}>
      {/* The four dim regions. Each dismisses, which is what "tapping anywhere"
          means everywhere except the gap. */}
      <Pressable
        onPress={() => spotlight?.dismiss()}
        accessibilityLabel="Dismiss"
        style={[styles.dim, { backgroundColor: theme.scrim, top: 0, left: 0, right: 0, height: hole.y }]}
      />
      <Pressable
        onPress={() => spotlight?.dismiss()}
        accessibilityLabel="Dismiss"
        style={[
          styles.dim,
          {
            backgroundColor: theme.scrim,
            top: hole.y + hole.height,
            left: 0,
            right: 0,
            height: Math.max(0, winH - (hole.y + hole.height)),
          },
        ]}
      />
      <Pressable
        onPress={() => spotlight?.dismiss()}
        accessibilityLabel="Dismiss"
        style={[
          styles.dim,
          { backgroundColor: theme.scrim, top: hole.y, left: 0, width: hole.x, height: hole.height },
        ]}
      />
      <Pressable
        onPress={() => spotlight?.dismiss()}
        accessibilityLabel="Dismiss"
        style={[
          styles.dim,
          {
            backgroundColor: theme.scrim,
            top: hole.y,
            left: hole.x + hole.width,
            width: Math.max(0, winW - (hole.x + hole.width)),
            height: hole.height,
          },
        ]}
      />

      {/* The gap. Pressing it hands the tap to the real control underneath. */}
      <Pressable
        onPress={() => spotlight?.activateShowing()}
        accessibilityRole="button"
        accessibilityLabel="Open what is highlighted"
        style={[styles.hole, { top: hole.y, left: hole.x, width: hole.width, height: hole.height }]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              borderColor: theme.accent,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
              transform: [
                { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) },
              ],
            },
          ]}
        />
      </Pressable>

      {/* Unflump's own words, anchored to the thing they are about. Part Six
          asks for the message below; it moves above when the element sits too
          near the bottom for "below" to be on screen at all. */}
      <View
        pointerEvents="box-none"
        style={[
          styles.anchor,
          below
            ? { top: hole.y + hole.height + ANCHOR_GAP }
            : { bottom: Math.max(0, winH - hole.y) + ANCHOR_GAP },
        ]}
      >
        <ThemedView type="backgroundElement" style={styles.bubble}>
          <ThemedText type="small">{active.message}</ThemedText>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { position: 'absolute' },
  hole: { position: 'absolute' },
  ring: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderRadius: Spacing.two,
  },
  anchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
  },
  bubble: {
    maxWidth: MaxContentWidth,
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
});
