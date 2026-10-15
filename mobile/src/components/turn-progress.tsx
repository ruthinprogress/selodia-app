import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';

// WHAT IS HAPPENING WHILE SHE WAITS.
//
// Ruth, 14 October 2026, on a turn taking up to 28 seconds: "28seconds is not
// workable". Measured in production the next morning: the app's own work is 0.4
// seconds and the two model calls are the other 97%, so there is nothing left
// to speed up in our code - the turn is as long as it is.
//
// What CAN change is that the screen said nothing at all. A single "…" bubble
// for sixteen seconds reads as a hang; sixteen seconds of visible progress
// reads as thinking. This does not make a turn faster by one millisecond and is
// not meant to.
//
// THE LABELS ARE THE REAL PHASES, IN THE REAL ORDER. Every turn reads the
// record, then makes the call that decides what the turn needs, then makes the
// call that writes the reply. That sequence is not a guess and not decoration.
//
// THE TIMINGS ARE ESTIMATES, AND THAT IS THE HONEST LIMIT OF THIS. They come
// from the median of real turns (context ready by about 0.4s, the deciding call
// landing around 6s, the reply from then on), because the server returns one
// response at the end and tells the phone nothing on the way. So a fast turn
// may never show the last label and a slow one sits on it. What this must never
// do is claim something specific it cannot know - never "logging your porridge",
// only the phase that is genuinely running.
//
// AND THE SERVER NOW TELLS IT ONE REAL THING (15 October 2026). Ruth chose the
// two-stage reply over shortening the turn, so the app publishes what it DID as
// soon as that is true - about seven seconds in - and `acted` is that, read off
// turn_stage by lib/turn-stage.ts.
//
// When it arrives the guessing stops. The estimated phases are replaced by what
// actually happened, which is both specific and certain, and the phase line
// underneath moves to the one part still genuinely running. The note above
// still holds for the rest: everything NOT in `acted` is an estimate, and this
// must never claim something specific it cannot know.

/** The phases, with the second each becomes true on a median turn. */
const PHASES: { at: number; says: string }[] = [
  { at: 0, says: 'Reading your record' },
  { at: 1, says: 'Working out what you need' },
  { at: 6, says: 'Writing back' },
  // PAST HERE SOMETHING IS WRONG, AND SAYING SO IS BETTER THAN A LABEL THAT HAS
  // RUN OUT. A turn this long is rare and she should not be left wondering
  // whether it is still alive.
  { at: 30, says: 'Still going, this one is taking a while' },
];

export type TurnProgressProps = {
  /**
   * What the app has already done this turn, once the server has said so.
   * Null until then, which is the whole of the first six seconds.
   */
  acted?: { summary?: string | null; almanacTitle?: string | null; reminder?: string | null } | null;
};

/** The one line worth showing, or null when there is nothing certain yet. */
function confirmed(acted: TurnProgressProps['acted']): string | null {
  if (!acted) return null;
  if (acted.summary) return acted.summary;
  if (acted.almanacTitle) return `Kept: ${acted.almanacTitle}`;
  if (acted.reminder === 'created') return 'Reminder set';
  if (acted.reminder === 'cancelled') return 'Reminder stopped';
  return null;
}

export function TurnProgress({ acted = null }: TurnProgressProps) {
  const [phase, setPhase] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      const seconds = (Date.now() - started) / 1000;
      // The last phase whose moment has passed.
      let next = 0;
      for (let i = 0; i < PHASES.length; i += 1) if (seconds >= PHASES[i].at) next = i;
      setPhase((was) => {
        if (was === next) return was;
        // A short fade on the change, so the words do not snap.
        Animated.sequence([
          Animated.timing(fade, { toValue: 0.35, duration: 160, useNativeDriver: true }),
          Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
        ]).start();
        return next;
      });
    }, 300);
    return () => clearInterval(timer);
  }, [fade]);

  const said = confirmed(acted);

  return (
    <Animated.View style={[styles.row, { opacity: fade }]}>
      {said ? (
        <>
          {/* WHAT HAPPENED, which is known rather than estimated. */}
          <ThemedText type="small">{said}</ThemedText>
          {/* AND THE ONE THING STILL RUNNING. The stage row cannot exist until
              the deciding call has returned and the writes have landed, so at
              this point the reply is the only phase left - no timer needed. */}
          <ThemedText type="small" themeColor="textSecondary">
            {'Writing back…'}
          </ThemedText>
        </>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {PHASES[phase].says}
          {'…'}
        </ThemedText>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Sits where the reply will, so the words do not jump when it arrives.
  row: { paddingVertical: 2 },
});
