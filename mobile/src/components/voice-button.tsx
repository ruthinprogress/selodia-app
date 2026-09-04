import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useConversation } from '@elevenlabs/react-native';

import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// The mic in the composer row.
//
// ONE ICON, TWO GESTURES, because there are two different needs and a mode
// picker would serve neither. Long-press starts and ends a conversation; tap
// pauses and resumes it. The quick thing is the quick gesture (Part Eighteen,
// "Three modes, and all three ship") - though the tap-to-log voice note is
// build item 34 and is NOT wired here yet, so a tap while disconnected
// currently does nothing rather than pretending to.
//
// PAUSE IS MUTE, NOT DISCONNECT. The spec says "session stays warm", and the
// SDK has no pause: it has `setMuted`. That is the right mapping rather than a
// near-miss - ending and reopening would drop the conversation and cost another
// connection handshake, which is exactly what "stays warm" rules out.
//
// STATE IS READ FROM THE SDK, NEVER MIRRORED. status and mode come straight
// from `useConversation()` on every render. A local copy would be a second
// source of truth for something the transport already knows, and would drift
// the moment a connection dropped without a gesture to explain it.
//
// THE PULSE IS THE LISTENING STATE. Sage is "on"; the pulse is "your turn".
// Held still under reduced motion, matching RotatingPlaceholder - the colour
// still carries the state, so nothing is lost by not moving.

export type VoiceButtonProps = {
  // Runs the consent check, fetches a conversation token and opens the session.
  // Passed in rather than done here so this component stays about gesture and
  // appearance, and so the token never has to be handled at this layer.
  onRequestStart: () => void;
  // Anything that should stop a session being opened - mid-send, mostly.
  disabled?: boolean;
};

type VisualState = 'off' | 'connecting' | 'active' | 'listening' | 'paused';

const PULSE_MS = 1100;

export function VoiceButton({ onRequestStart, disabled = false }: VoiceButtonProps) {
  const theme = useTheme();
  const { status, mode, isMuted, setMuted, endSession } = useConversation();
  const [reduceMotion, setReduceMotion] = useState(false);
  // useState, not useRef, and not by preference: an Animated.Value in a ref
  // is read during render by `interpolate`, which the React Compiler lint
  // correctly rejects. RotatingPlaceholder holds its value the same way.
  const [pulse] = useState(() => new Animated.Value(0));

  const connected = status === 'connected';
  const state: VisualState = !connected
    ? status === 'connecting'
      ? 'connecting'
      : 'off'
    : isMuted
      ? 'paused'
      : mode === 'listening'
        ? 'listening'
        : 'active';

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (alive) setReduceMotion(on);
      })
      .catch(() => {
        // A missing answer is not a reason to move; leaving it false keeps the
        // default behaviour, and the colour carries the state either way.
      });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (on) => setReduceMotion(on));
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  // Only the listening state animates. "Connecting" deliberately does not: a
  // spinner on a control that is about to change colour anyway is noise, and
  // the connect is usually under a second.
  useEffect(() => {
    if (state !== 'listening' || reduceMotion) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
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
  }, [state, reduceMotion, pulse]);

  const tint = state === 'off' || state === 'connecting' ? theme.textSecondary : theme.sage;
  // Dimmed rather than greyed, because a paused session is still a session -
  // going grey would say it had ended.
  const opacity = state === 'paused' ? 0.45 : 1;

  const label =
    state === 'off'
      ? 'Start a voice conversation. Press and hold.'
      : state === 'connecting'
        ? 'Connecting'
        : state === 'paused'
          ? 'Voice paused. Tap to resume, press and hold to end.'
          : 'Voice on. Tap to pause, press and hold to end.';

  return (
    <Pressable
      onLongPress={() => {
        if (disabled) return;
        // The same gesture in both directions, so there is one thing to
        // remember rather than two.
        if (connected || status === 'connecting') endSession();
        else onRequestStart();
      }}
      onPress={() => {
        // A tap only means something during a session. Starting one on a tap
        // would make the gesture that logs a quick voice note (item 34) open a
        // full conversation instead.
        if (!connected) return;
        setMuted(!isMuted);
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: connected }}
      hitSlop={Spacing.two}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <ThemedView type="backgroundElement" style={[styles.button, disabled && styles.disabled]}>
        <Animated.View
          style={{
            opacity,
            transform: [
              {
                scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }),
              },
            ],
          }}
        >
          <Ionicons name="mic" size={18} color={tint} />
        </Animated.View>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
});
