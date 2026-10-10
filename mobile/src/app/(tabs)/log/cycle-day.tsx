import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { BodyScreen } from '@/components/body-screen';
import { AddAnother, Card, Chips, GroupedChips } from '@/components/cycle-cards';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  emptyDay,
  FLOWS,
  isEmptyDay,
  MUCUS,
  OVULATION_SIGNS,
  readTemperature,
  SYMPTOM_GROUPS,
  toggleChoice,
  type CycleDay,
} from '@/lib/cycle-day';
import { describeToday, knowledgeFrom } from '@/lib/cycle-history';
import { currentUserId } from '@/lib/current-user';
import { MEASURES, ratingsByMeasure, wordFor, type Rating } from '@/lib/daily-ratings';
import { supabase } from '@/lib/supabase';
import { human, shift, today } from '@/lib/day-names';

// A DAY, AND EVERYTHING RECORDED ON IT.
//
// Build spec, 9 October 2026 ("Settled: what the Cycle screen becomes",
// confirmed by Ruth the same day): "Six of the eight sections - flow, symptoms,
// feeling, ovulation, mucus, notes - move inside a day. What remains is the
// period action and the history, so the Cycle screen IS the history screen."
//
// This is where the six went. It did not exist until 10 October: the night of
// the 9th built the data layer the spec asked for first - symptoms on days,
// cycle position for a past date, the lookback - and then put the new symptom
// list and the new bars into the OLD eight-card screen, which left her with the
// same screen she had complained about, a flat wall of 25 chips, and no day to
// open. Her words on seeing it: "Not what we designed."
//
// THE SYMPTOM PICKER IS NOT A CYCLE PICKER (Ruth, 9 October 2026: "A symptom is
// just a symptom"). It is reached from here because she is already thinking
// about a day, but what it writes is a symptom on a date and nothing more. The
// cycle position of that date is DERIVED - see the line under the date below -
// and is never asked for, because a person sorting her own symptoms into
// cycle-related and not is doing the work the app exists to do.

export default function CycleDayScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ day?: string }>();
  const asked = typeof params.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.day) ? params.day : null;

  const [day, setDay] = useState(asked ?? today());
  const [entry, setEntry] = useState<CycleDay>(emptyDay(asked ?? today()));
  const [events, setEvents] = useState<{ event_date: string; event_type: string }[]>([]);
  const [usedSymptoms, setUsedSymptoms] = useState<string[]>([]);
  const [newSymptom, setNewSymptom] = useState('');
  const [temperature, setTemperature] = useState('');
  const [showTemperature, setShowTemperature] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [feeling, setFeeling] = useState<Record<string, Rating>>({});

  // Her period history, for the line that says where this day sits, and the
  // words she has used before, so her own lead the picker.
  //
  // ON FOCUS, NOT ON MOUNT. A tab mounts once and then never asks again, so a
  // symptom said in chat would not appear here until the app restarted - which
  // is the whole point of symptoms landing on days. check-tabs-refetch caught
  // this screen the hour it was written.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const userId = await currentUserId();
        if (!userId || cancelled) return;
        const [ev, past] = await Promise.all([
          supabase.from('cycle_events').select('event_date, event_type').eq('user_id', userId),
          supabase.from('daily_observations').select('symptoms').eq('user_id', userId).limit(120),
        ]);
        if (cancelled) return;
        setEvents(ev.data ?? []);
        const used: string[] = [];
        for (const row of (past.data ?? []) as { symptoms: string[] | null }[]) {
          for (const s of row.symptoms ?? []) if (!used.includes(s)) used.push(s);
        }
        setUsedSymptoms(used);
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  // The day's own record, whenever the day changes and whenever she comes back.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
      const userId = await currentUserId();
      if (!userId) return;
      const { data } = await supabase
        .from('daily_observations')
        .select('*')
        .eq('user_id', userId)
        .eq('day', day)
        .maybeSingle();
      if (cancelled) return;
      const row = data as Record<string, unknown> | null;
      setEntry(
        row
          ? {
              day,
              flow: (row.flow as CycleDay['flow']) ?? null,
              symptoms: (row.symptoms as string[]) ?? [],
              ovulation: (row.ovulation as string[]) ?? [],
              mucus: (row.mucus as string) ?? null,
              notes: (row.notes as string) ?? null,
              temperatureC: row.temperature_c != null ? Number(row.temperature_c) : null,
            }
          : emptyDay(day)
      );
      setTemperature(row?.temperature_c != null ? String(row.temperature_c) : '');
      setShowTemperature(row?.temperature_c != null);
      setNote(null);

      const { data: rated } = await supabase
        .from('daily_ratings')
        .select('measure, value, note')
        .eq('user_id', userId)
        .eq('day', day);
      if (!cancelled) {
          setFeeling(ratingsByMeasure((rated ?? []) as { measure: string; value: number; note: string | null }[]));
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [day])
  );

  async function save() {
    if (saving) return;
    setSaving(true);
    setNote(null);
    try {
      const userId = await currentUserId();
      if (!userId) return;
      const value = { ...entry, temperatureC: readTemperature(temperature) };

      // AN EMPTY FORM WRITES NOTHING, and clears what was there. Somebody
      // removing everything from a day is deleting that day's record, not
      // saving an empty one.
      if (isEmptyDay(value)) {
        await supabase.from('daily_observations').delete().eq('user_id', userId).eq('day', day);
        setNote('Nothing recorded for this day.');
        return;
      }

      const { error } = await supabase.from('daily_observations').upsert(
        {
          user_id: userId,
          day,
          flow: value.flow,
          symptoms: value.symptoms,
          ovulation: value.ovulation,
          mucus: value.mucus,
          notes: value.notes?.trim() || null,
          temperature_c: value.temperatureC,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,day' }
      );
      if (error) {
        setNote('That did not save. Worth trying again.');
        return;
      }
      for (const s of value.symptoms) {
        if (!usedSymptoms.includes(s)) setUsedSymptoms((u) => [s, ...u]);
      }
      setTemperature(value.temperatureC != null ? String(value.temperatureC) : '');
      setNote(`Saved for ${human(day)}.`);
    } finally {
      setSaving(false);
    }
  }

  const placement = describeToday(knowledgeFrom(events), day);
  const said = MEASURES.map((m) => ({ m, word: wordFor(m.id, feeling[m.id]?.value) })).filter((x) => x.word);

  return (
    <BodyScreen title={human(day)}>
      {/* WHERE THIS DAY SITS, DERIVED AND NEVER ASKED FOR. The whole reason the
          lookback can work: she records what she noticed, and the app works out
          that it was day 14 both times. */}
      {placement && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
          {placement}
        </ThemedText>
      )}

      {/* THE DAY, WHICH MOVES (Ruth, 21 September 2026): "the cycle 'started'
          and 'ended' needs to be selectable in hindsight. I rarely remember to
          add it to my calendar on the day it started or ended." */}
      <ThemedView type="backgroundElement" style={styles.dayBar}>
        <Pressable
          onPress={() => setDay((d) => shift(d, -1))}
          accessibilityRole="button"
          accessibilityLabel="The day before"
          hitSlop={Spacing.two}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <MaterialCommunityIcons name="chevron-left" size={24} color={theme.accent} />
        </Pressable>
        <View style={styles.dayLabel}>
          <ThemedText type="smallBold">{human(day)}</ThemedText>
          {day !== today() && (
            <Pressable onPress={() => setDay(today())} accessibilityRole="button" accessibilityLabel="Back to today">
              <ThemedText type="small" themeColor="link">
                Back to today
              </ThemedText>
            </Pressable>
          )}
        </View>
        <Pressable
          onPress={() => setDay((d) => (d >= today() ? d : shift(d, 1)))}
          disabled={day >= today()}
          accessibilityRole="button"
          accessibilityLabel="The day after"
          hitSlop={Spacing.two}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={day >= today() ? theme.textSecondary : theme.accent}
          />
        </Pressable>
      </ThemedView>

      <Card icon="wave" title="Flow">
        <Chips
          options={FLOWS.map((f) => f[0].toUpperCase() + f.slice(1))}
          selected={entry.flow ? [entry.flow] : []}
          single
          onToggle={(o) => {
            const f = o.toLowerCase() as CycleDay['flow'];
            setEntry((e) => ({ ...e, flow: e.flow === f ? null : f }));
          }}
        />
      </Card>

      {/* FOUR GROUPS, NAMED FOR WHAT THE SYMPTOM IS. See GroupedChips, and the
          build spec's second correction of 9 October. */}
      <Card icon="star-four-points-outline" title="Symptoms" optional>
        <GroupedChips
          groups={SYMPTOM_GROUPS}
          extras={usedSymptoms}
          selected={entry.symptoms}
          onToggle={(o) => setEntry((e) => ({ ...e, symptoms: toggleChoice(e.symptoms, o) }))}
        />
        <AddAnother
          value={newSymptom}
          onChange={setNewSymptom}
          placeholder="Something else you noticed"
          onAdd={() => {
            const s = newSymptom.trim();
            if (!s) return;
            setEntry((e) => ({ ...e, symptoms: toggleChoice(e.symptoms, s) }));
            setUsedSymptoms((u) => (u.some((x) => x.toLowerCase() === s.toLowerCase()) ? u : [s, ...u]));
            setNewSymptom('');
          }}
        />
      </Card>

      {/* MOOD LEFT THIS PAGE AND LEFT A HOLE (Ruth, 21 September 2026): "if you
          removed it from cycle context, maybe it needs a button there to take
          you to mood". The record lives in one place; the QUESTION belongs
          wherever somebody is already thinking about it. */}
      <Card icon="weather-partly-cloudy" title="Mood and energy">
        {said.length > 0 ? (
          <ThemedText type="small">{said.map((x) => `${x.m.label}: ${x.word}`).join('  ·  ')}</ThemedText>
        ) : (
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            Notice any changes in mood or energy {day === today() ? 'today' : 'that day'}?
          </ThemedText>
        )}
        <Pressable
          onPress={() => router.push({ pathname: '/log/feeling', params: { day } })}
          accessibilityRole="button"
          accessibilityLabel={said.length > 0 ? 'Change how you felt that day' : 'Record how you felt that day'}
          hitSlop={Spacing.two}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedText type="small" themeColor="link">
            {said.length > 0 ? 'Change it' : 'Record it'}
          </ThemedText>
        </Pressable>
      </Card>

      <Card icon="target" title="Ovulation" optional>
        <Chips
          options={OVULATION_SIGNS}
          selected={entry.ovulation}
          onToggle={(o) => setEntry((e) => ({ ...e, ovulation: toggleChoice(e.ovulation, o) }))}
        />
        {showTemperature ? (
          <View style={styles.row}>
            <TextInput
              value={temperature}
              onChangeText={setTemperature}
              keyboardType="decimal-pad"
              placeholder="36.60"
              placeholderTextColor={theme.textSecondary}
              maxLength={6}
              style={[styles.temp, { color: theme.text, backgroundColor: theme.background }]}
              accessibilityLabel="Your temperature this morning"
            />
            <ThemedText type="small" themeColor="textSecondary" style={styles.tempNote}>
              Taken before getting up, at the same time each morning. A rise of two or three tenths, held for days,
              is what says ovulation has already happened.
            </ThemedText>
          </View>
        ) : (
          <Pressable
            onPress={() => setShowTemperature(true)}
            accessibilityRole="button"
            accessibilityLabel="Add a temperature"
            hitSlop={Spacing.two}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <ThemedText type="small" themeColor="link">
              Add a temperature
            </ThemedText>
          </Pressable>
        )}
      </Card>

      <Card icon="sine-wave" title="Cervical mucus" optional>
        <Chips
          options={MUCUS}
          selected={entry.mucus ? [entry.mucus] : []}
          single
          onToggle={(o) => setEntry((e) => ({ ...e, mucus: e.mucus === o ? null : o }))}
        />
      </Card>

      <Card icon="note-text-outline" title="Notes" optional>
        <TextInput
          value={entry.notes ?? ''}
          onChangeText={(v) => setEntry((e) => ({ ...e, notes: v }))}
          placeholder="Write anything else..."
          placeholderTextColor={theme.textSecondary}
          multiline
          maxLength={1000}
          style={[styles.notes, { color: theme.text, backgroundColor: theme.background }]}
          accessibilityLabel="Notes for this day"
        />
      </Card>

      <View style={styles.tools}>
        <Pressable
          onPress={() => void save()}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Save this day"
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedView style={[styles.save, { backgroundColor: theme.accentDeep }]}>
            <ThemedText type="smallBold" themeColor="background">
              {saving ? 'Saving…' : `Save ${human(day)}`}
            </ThemedText>
          </ThemedView>
        </Pressable>

        {note && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            {note}
          </ThemedText>
        )}

        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          Or just tell Selodía in chat.
        </ThemedText>
      </View>
    </BodyScreen>
  );
}

const styles = StyleSheet.create({
  intro: { marginBottom: Spacing.three },
  dayBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    marginBottom: Spacing.four,
  },
  dayLabel: { alignItems: 'center', gap: Spacing.half },
  row: { gap: Spacing.two },
  temp: { borderRadius: Spacing.two, padding: Spacing.three, fontSize: 16 },
  tempNote: { lineHeight: 18 },
  notes: { borderRadius: Spacing.two, padding: Spacing.three, minHeight: 96, fontSize: 15 },
  tools: { marginTop: Spacing.four, gap: Spacing.three },
  save: { paddingVertical: Spacing.three, borderRadius: Spacing.four, alignItems: 'center' },
  hint: { lineHeight: 18 },
  pressed: { opacity: 0.6 },
});
