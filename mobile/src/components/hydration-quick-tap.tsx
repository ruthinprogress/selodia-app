import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { QUICK_MEASURES, type QuickMeasure } from '@/lib/hydration';
import { supabase } from '@/lib/supabase';

// The zero-calorie drinks quick-tap (build item 26 — Part Twelve).
//
// WHY THIS EXISTS. Water is the most repeated log of anyone's day, and until now
// it cost a typed sentence plus a round trip: the message goes to the model,
// the model sets logIntent 'hydration', and only then does the volume get parsed
// in code. That is a lot of machinery to say "another glass". The spec asks for
// exactly this — "a quick-tap shortcut for common zero-calorie drinks (removing
// the friction of typing each time)".
//
// WRITES DIRECTLY, no model. The open-ended judgement the model exists for is
// "is this message about a drink at all", and a tap on a button labelled Glass
// has already answered it. Routing a tap through the language model would add
// latency and a failure mode to a question nobody asked.
//
// NOT ON THE "+" SHEET, deliberately. That sheet is SOURCE-based by design —
// camera, library — and composer-add.ts argues at length against letting a type
// of thing in among the sources. This belongs beside the water bar it moves,
// where the person is already looking at their intake.
//
// NOT GAMIFIED, per an unusually blunt spec: no streak, no chain, no badge, no
// yesterday-versus-today. It logs, the bar moves, and nothing is celebrated.
//
// UNDO IS PART OF THE FEATURE, not a nicety. A one-tap write needs a one-tap
// reversal, and hydration has no other route back: `resolveCorrection` in
// ask-unflump covers food, activity, measurement and personal_metric — there is
// no conversational path to unpick a drink. Without undo here, a mis-tap would
// be permanent, so the undo removes the row this component just inserted, by id,
// and never anything else.

export function HydrationQuickTap({ onLogged }: { onLogged: (deltaMl: number) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  const [lastLabel, setLastLabel] = useState<string | null>(null);

  async function add(measure: QuickMeasure) {
    if (busy) return;
    setBusy(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('hydration_logs')
          .insert({ user_id: user.id, ml: measure.ml, happened_at: new Date().toISOString() })
          .select('id')
          .maybeSingle();
        if (!error && data?.id) {
          setLastId(data.id as string);
          setLastLabel(measure.label);
          // Optimistic by design: the bar moves on the tap, not on the round
          // trip. The insert has already succeeded by the time this runs.
          onLogged(measure.ml);
        }
      }
    } catch {
      // Silent. A drink that failed to log is not worth an error dialogue over
      // the top of someone's Overview; the bar simply will not have moved, which
      // is itself the honest signal.
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (busy || !lastId) return;
    setBusy(true);
    const id = lastId;
    try {
      const { error } = await supabase.from('hydration_logs').delete().eq('id', id);
      if (!error) {
        const undone = QUICK_MEASURES.find((m) => m.label === lastLabel);
        if (undone) onLogged(-undone.ml);
        setLastId(null);
        setLastLabel(null);
      }
    } catch {
      // Same reasoning as above.
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Add a drink"
        style={({ pressed }) => pressed && styles.pressed}
      >
        <ThemedText type="small" themeColor="link" style={styles.trigger}>
          + Add a drink
        </ThemedText>
      </Pressable>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.chips}>
        {QUICK_MEASURES.map((m) => (
          <Pressable
            key={m.label}
            onPress={() => add(m)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Add a ${m.label.toLowerCase()}, ${m.ml} millilitres`}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <ThemedView type="backgroundSelected" style={styles.chip}>
              <ThemedText type="small">{m.label}</ThemedText>
            </ThemedView>
          </Pressable>
        ))}
      </View>

      <View style={styles.footer}>
        {lastId && lastLabel ? (
          <Pressable
            onPress={undo}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Undo the ${lastLabel.toLowerCase()} just added`}
            style={({ pressed }) => pressed && styles.pressed}
          >
            {/* States what it will undo. "Undo" alone makes someone remember
                which tap they are reversing. */}
            <ThemedText type="small" themeColor="link">
              Undo {lastLabel.toLowerCase()}
            </ThemedText>
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable
          // Closing clears the undo. Otherwise reopening hours later would offer
          // to undo a drink from that morning, which is not what "undo" means to
          // anyone — undo reaches back to the tap you just made, not to the last
          // one this component happens to remember.
          onPress={() => {
            setOpen(false);
            setLastId(null);
            setLastLabel(null);
          }}
          accessibilityRole="button"
          accessibilityLabel="Close the drink shortcuts"
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedText type="small" themeColor="textSecondary">
            Done
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two, marginTop: Spacing.one },
  trigger: { marginTop: Spacing.one },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  chip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pressed: { opacity: 0.6 },
});
