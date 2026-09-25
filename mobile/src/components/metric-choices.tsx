import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ReorderableRows } from '@/components/reorderable-rows';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import {
  loadTrackedMetrics,
  METRIC_ICONS,
  metricKeyFor,
  resolveTrackedMetrics,
  saveTrackedMetrics,
  type TrackedMetric,
} from '@/lib/tracked-metrics';

// WHICH MEASUREMENTS SHE TRACKS, AND IN WHAT ORDER (Ruth, 25 September 2026,
// item 11: "The user chooses which metrics they track (name, unit, icon,
// order) once in settings").
//
// HOLD A ROW AND MOVE IT, the same gesture the Log list and the Plans shelf
// use, through the same component. Order here is the order on the Measurements
// screen: Latest, History and Then & now all walk this list.
//
// NOTHING CAN BE DELETED, AND THAT IS THE POINT. A metric with readings behind
// it is a record of somebody's own body; removing it from a list must not
// suggest the readings have gone. So a metric is HIDDEN - it keeps its place,
// draws nowhere, and everything it ever recorded is still in the export and
// still in a report. The only thing that removes a reading is deleting the
// reading.
//
// ADDING ONE ONLY NAMES IT. A new metric has no readings until somebody
// records one, which happens in chat or from the log bar like everything else -
// there is no second way to write a measurement, and there should not be.
export function MetricChoices() {
  const theme = useTheme();
  const [list, setList] = useState<TrackedMetric[] | null>(null);
  const [editing, setEditing] = useState<TrackedMetric | null>(null);
  const [adding, setAdding] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [stored, { data: personal }] = await Promise.all([
        loadTrackedMetrics(),
        supabase.from('personal_metrics').select('metric_name').limit(400),
      ]);
      if (cancelled) return;
      const names = ((personal ?? []) as { metric_name: string }[]).map((p) => p.metric_name);
      setList(resolveTrackedMetrics(stored, names));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // SAVED WHEN IT CHANGES, not on a Done button. Same reasoning as the Log's
  // arrangement: there is no moment where somebody has finished arranging a
  // list, and a Done they forget to press is a list thrown away.
  const keep = useCallback((next: TrackedMetric[]) => {
    setList(next);
    void saveTrackedMetrics(next).then((ok) => setFailed(!ok));
  }, []);

  if (!list) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        …
      </ThemedText>
    );
  }

  const replace = (m: TrackedMetric) => keep(list.map((x) => (x.key === m.key ? m : x)));

  return (
    <View style={styles.wrap}>
      {/* ReorderableRows identifies rows by `id`; a metric's identity is its
          `key`. Adapted here at the one boundary rather than carrying a second
          copy of the same string on every metric for the rest of its life. */}
      <ReorderableRows
        items={list.map((m) => ({ ...m, id: m.key }))}
        onReorder={(next) =>
          // The `id` added above is dropped again on the way back, so the
          // stored list never carries a field the rules do not know about.
          keep(next.map((row) => list.find((m) => m.key === row.id)).filter((m): m is TrackedMetric => m != null))
        }
        renderRow={(m, i, dragging) => (
          <Pressable
            onPress={() => setEditing(m)}
            disabled={dragging}
            accessibilityRole="button"
            accessibilityLabel={`${m.label}${m.hidden ? ', hidden' : ''}. Edit it, or hold to move it.`}
            style={({ pressed }) => pressed && !dragging && styles.pressed}
          >
            <ThemedView
              type="backgroundElement"
              style={[styles.row, i < list.length - 1 && styles.spaced, m.hidden && styles.dim]}
            >
              <Ionicons name={m.icon as never} size={20} color={theme.accentDeep} style={styles.icon} />
              <View style={styles.body}>
                <ThemedText type="smallBold">{m.label}</ThemedText>
                <ThemedText type="detail" themeColor="textSecondary">
                  {[m.unit || 'no unit', m.source === 'scale' ? 'from your scale' : 'measured by you']
                    .filter(Boolean)
                    .join('  ·  ')}
                </ThemedText>
              </View>
              {/* SHOW OR HIDE, never delete. See the note above. */}
              <Pressable
                onPress={() => replace({ ...m, hidden: !m.hidden })}
                accessibilityRole="switch"
                accessibilityState={{ checked: !m.hidden }}
                accessibilityLabel={m.hidden ? `Show ${m.label}` : `Hide ${m.label}`}
                hitSlop={Spacing.two}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Ionicons
                  name={m.hidden ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.textSecondary}
                />
              </Pressable>
            </ThemedView>
          </Pressable>
        )}
      />

      <Pressable
        onPress={() => setAdding(true)}
        accessibilityRole="button"
        accessibilityLabel="Add a measurement"
        style={({ pressed }) => pressed && styles.pressed}
      >
        <ThemedText type="smallBold" themeColor="link" style={styles.add}>
          Add a measurement
        </ThemedText>
      </Pressable>

      {failed ? (
        <ThemedText type="small" themeColor="danger">
          That did not save. It will still be here when you come back.
        </ThemedText>
      ) : null}

      <MetricSheet
        metric={editing}
        adding={adding}
        existingKeys={list.map((m) => m.key)}
        onClose={() => {
          setEditing(null);
          setAdding(false);
        }}
        onSave={(m) => {
          if (adding) keep([...list, m]);
          else replace(m);
          setEditing(null);
          setAdding(false);
        }}
      />
    </View>
  );
}

// NAME, UNIT AND MARK. Nothing else is editable: where a metric's values come
// from is decided by where they were written, not by a preference.
function MetricSheet({
  metric,
  adding,
  existingKeys,
  onClose,
  onSave,
}: {
  metric: TrackedMetric | null;
  adding: boolean;
  existingKeys: string[];
  onClose: () => void;
  onSave: (m: TrackedMetric) => void;
}) {
  const open = adding || metric != null;
  if (!open) return null;

  // MOUNTED FRESH PER METRIC, rather than seeded by an effect. The fields used
  // to be state filled in by a useEffect watching `metric`, which is the
  // pattern the React Compiler rule objects to and is right to: a setState in
  // an effect body is a second render nobody asked for, and it is also how a
  // form ends up showing the last thing you edited. The key does it instead -
  // a different metric is a different form.
  return (
    <MetricForm
      key={metric?.key ?? 'new'}
      metric={metric}
      adding={adding}
      existingKeys={existingKeys}
      onClose={onClose}
      onSave={onSave}
    />
  );
}

function MetricForm({
  metric,
  adding,
  existingKeys,
  onClose,
  onSave,
}: {
  metric: TrackedMetric | null;
  adding: boolean;
  existingKeys: string[];
  onClose: () => void;
  onSave: (m: TrackedMetric) => void;
}) {
  const theme = useTheme();
  const [label, setLabel] = useState(metric?.label ?? '');
  const [unit, setUnit] = useState(metric?.unit ?? '');
  const [icon, setIcon] = useState<string>(metric?.icon ?? METRIC_ICONS[3]);

  const trimmed = label.trim();
  // A new metric cannot take the name of one that already exists, or the two
  // would share a key and the screen would read one history under two names.
  const clashes = adding && trimmed !== '' && existingKeys.includes(metricKeyFor(trimmed));
  const valid = trimmed.length > 0 && !clashes;

  const save = () => {
    if (!valid) return;
    if (adding) {
      onSave({
        key: metricKeyFor(trimmed),
        label: trimmed,
        unit: unit.trim(),
        icon,
        source: 'personal',
        // The name rows are stored under. Lower case, because that is what the
        // conversation writes and what readingsFor matches on.
        name: trimmed.toLowerCase(),
      });
      return;
    }
    if (metric) onSave({ ...metric, label: trimmed, unit: unit.trim(), icon });
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        {/* The sheet swallows taps so pressing inside it does not close it. */}
        <Pressable style={styles.sheetWrap} onPress={() => {}}>
          <ThemedView type="background" style={styles.sheet}>
            <ThemedText type="sectionTitle">{adding ? 'Add a measurement' : 'Edit'}</ThemedText>

            <ThemedText type="small" themeColor="textSecondary">
              What do you call it?
            </ThemedText>
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder="Waist"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
              autoFocus
            />

            <ThemedText type="small" themeColor="textSecondary">
              And the unit? Leave it blank if it has none.
            </ThemedText>
            <TextInput
              value={unit}
              onChangeText={setUnit}
              placeholder="cm"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />

            <ThemedText type="small" themeColor="textSecondary">
              A mark for it
            </ThemedText>
            <View style={styles.icons}>
              {METRIC_ICONS.map((name) => (
                <Pressable
                  key={name}
                  onPress={() => setIcon(name)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: icon === name }}
                  accessibilityLabel={`Use the ${name.replace('-outline', '')} mark`}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <ThemedView
                    type={icon === name ? 'backgroundSelected' : 'backgroundElement'}
                    style={[styles.iconChoice, icon === name && { borderColor: theme.accentDeep }]}
                  >
                    <Ionicons name={name as never} size={20} color={theme.accentDeep} />
                  </ThemedView>
                </Pressable>
              ))}
            </View>

            {clashes ? (
              <ThemedText type="small" themeColor="danger">
                You already track something by that name.
              </ThemedText>
            ) : null}

            <View style={styles.sheetFoot}>
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cancel">
                <ThemedText type="small" themeColor="textSecondary">
                  Cancel
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={save}
                disabled={!valid}
                accessibilityRole="button"
                accessibilityLabel={adding ? 'Add it' : 'Save'}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <ThemedText type="smallBold" themeColor={valid ? 'link' : 'textSecondary'}>
                  {adding ? 'Add it' : 'Save'}
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: CardRadius,
    paddingVertical: 12,
    paddingHorizontal: Spacing.three,
  },
  // The air between rows, which the reorderable list's plain container does
  // not provide - see movement-library for the same note.
  spaced: { marginBottom: Spacing.two },
  dim: { opacity: 0.5 },
  icon: { width: 22 },
  body: { flex: 1, minWidth: 0, gap: 1 },
  add: { paddingVertical: Spacing.two },
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.three },
  sheetWrap: { width: '100%', maxWidth: 420 },
  sheet: { borderRadius: CardRadius, padding: Spacing.four, gap: Spacing.two },
  input: {
    fontSize: 15,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  iconChoice: {
    width: 44,
    height: 44,
    borderRadius: 22,
    // Transparent until chosen, so the selected one is the only ring.
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.two,
  },
  pressed: { opacity: 0.7 },
});
