import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { BodyScreen } from '@/components/body-screen';
import { AddAnother, Card, Chips } from '@/components/cycle-cards';
import { ReorderableRows } from '@/components/reorderable-rows';
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
  symptomChoices,
  toggleChoice,
  type CycleDay,
} from '@/lib/cycle-day';
import { describeToday, expectedNextPeriod, knowledgeFrom } from '@/lib/cycle-history';
import { MEASURES, ratingsByMeasure, wordFor, type Rating } from '@/lib/daily-ratings';
import { currentUserId } from '@/lib/current-user';
import { arrange, layoutOf, loadLayout, saveLayout } from '@/lib/log-layout';
import { supabase } from '@/lib/supabase';

// THE CYCLE PAGE (Ruth, 21 September 2026, from her ChatGPT mock).
//
// "It needs to be visually accessible to a user to build pattern understanding
// and so it makes sense when the ai starts making observations there's
// something to check against."
//
// IN HINDSIGHT, ALWAYS. Her first note on the mock, and the one that decides
// the shape of the top card: "the cycle 'started' and 'ended' needs to be
// selectable in hindsight. I rarely remember to add it to my calendar on the
// day it started or ended." So there is no "today" button. There is a day,
// which begins as today and moves, and every card on the screen describes THAT
// day. A screen that could only record now would be a screen most people used
// once.
//
// THE CARDS ARE HERS TO ARRANGE, the same as the Log's rows: hold one to move
// it, put away the ones that do not apply. Somebody not tracking ovulation
// should never see two cards about it again.
//
// WHAT IT WILL NOT DO is tell her what her cycle means. It records, it counts,
// and where it estimates it says so and says on what - see cycle-history.ts,
// where one logged period earns a position and no prediction at all.

type CardId = 'period' | 'history' | 'flow' | 'symptoms' | 'feeling' | 'ovulation' | 'mucus' | 'notes';
type Section = { id: CardId };

const SECTIONS: Section[] = [
  { id: 'period' },
  // WHERE SHE CHECKS IT LANDED (Ruth, 21 September 2026): "where do I check it
  // landed? where is the history for Cycle to look back on? it's very
  // confused."
  //
  // The page could record a period start and then showed no sign of having
  // done it, so the buttons read as dead and the only proof was the sentence
  // that appeared for a moment. A log you cannot look back at is not a log.
  { id: 'history' },
  { id: 'flow' },
  { id: 'symptoms' },
  // MOOD LEFT THIS PAGE AND LEFT A HOLE (Ruth, 21 September 2026): "if you
  // removed it from cycle context, maybe it needs a button there to take you to
  // mood, something like, 'notice any changes in mood or energy today?'"
  //
  // Exactly right, and it is the difference between moving a thing and losing
  // it. The record lives in one place; the QUESTION belongs wherever somebody
  // is already thinking about it, and on a cycle page they are.
  { id: 'feeling' },
  { id: 'ovulation' },
  { id: 'mucus' },
  { id: 'notes' },
];

const TITLES: Record<CardId, string> = {
  period: 'Period',
  history: 'Recorded so far',
  flow: 'Flow',
  symptoms: 'Symptoms',
  ovulation: 'Ovulation',
  feeling: 'Mood and energy',
  mucus: 'Cervical mucus',
  notes: 'Notes',
};

/** Their own plain words for a stored event type. */
const EVENT_WORDS: Record<string, string> = {
  period_start: 'Period started',
  period_end: 'Period ended',
  spotting: 'Spotting',
};

const ICONS: Record<CardId, keyof typeof MaterialCommunityIcons.glyphMap> = {
  period: 'water',
  history: 'history',
  flow: 'wave',
  symptoms: 'star-four-points-outline',
  ovulation: 'target',
  feeling: 'weather-partly-cloudy',
  mucus: 'sine-wave',
  notes: 'note-text-outline',
};

function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shift(day: string, by: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
}

function human(day: string): string {
  if (day === today()) return 'Today';
  if (day === shift(today(), -1)) return 'Yesterday';
  const d = new Date(`${day}T12:00:00Z`);
  return isNaN(d.getTime())
    ? day
    : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function CycleScreen() {
  const theme = useTheme();
  const [day, setDay] = useState(today());
  const [entry, setEntry] = useState<CycleDay>(emptyDay(today()));
  const [events, setEvents] = useState<{ event_date: string; event_type: string }[]>([]);
  const [usedSymptoms, setUsedSymptoms] = useState<string[]>([]);
  const [shown, setShown] = useState<Section[]>(SECTIONS);
  const [hidden, setHidden] = useState<Section[]>([]);
  const [editing, setEditing] = useState(false);
  const [newSymptom, setNewSymptom] = useState('');
  const [temperature, setTemperature] = useState('');
  const [showTemperature, setShowTemperature] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // READ, NEVER WRITTEN HERE. This page asks the question; the answer is kept
  // once, on its own screen, in its own table.
  const [feeling, setFeeling] = useState<Record<string, Rating>>({});

  // Her arrangement and her history, once.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const userId = await currentUserId();
      if (!userId || cancelled) return;

      const [layout, ev, past] = await Promise.all([
        loadLayout('cycle_layout'),
        supabase.from('cycle_events').select('event_date, event_type').eq('user_id', userId),
        supabase.from('cycle_days').select('symptoms').eq('user_id', userId).limit(120),
      ]);
      if (cancelled) return;

      const arranged = arrange(SECTIONS, layout);
      setShown(arranged.shown);
      setHidden(arranged.hidden);
      setEvents(ev.data ?? []);
      // WHAT SHE HAS USED BEFORE, most recent first, so her own words lead the
      // list. This is the "Add another" she asked to be real.
      const used: string[] = [];
      for (const row of (past.data ?? []) as { symptoms: string[] | null }[]) {
        for (const s of row.symptoms ?? []) if (!used.includes(s)) used.push(s);
      }
      setUsedSymptoms(used);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The day's own record, whenever the day changes.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const userId = await currentUserId();
      if (!userId) return;
      const { data } = await supabase
        .from('cycle_days')
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
  }, [day]);

  const keep = useCallback((nextShown: Section[], nextHidden: Section[]) => {
    setShown(nextShown);
    setHidden(nextHidden);
    void saveLayout('cycle_layout', layoutOf(nextShown.map((s) => s.id), nextHidden.map((s) => s.id)));
  }, []);

  // What is already recorded on the day showing, and the recent log behind it.
  const onThisDay = events.filter((e) => e.event_date === day);
  const recent = [...events].sort((a, b) => b.event_date.localeCompare(a.event_date)).slice(0, 12);

  const knowledge = knowledgeFrom(events);
  const todayLine = describeToday(knowledge, day);
  const next = expectedNextPeriod(knowledge);

  async function markPeriod(type: 'period_start' | 'period_end') {
    const userId = await currentUserId();
    if (!userId) return;
    // THE DAY ON SCREEN, NOT TODAY. The whole reason the day is movable.
    // UPSERT, because saying it twice is not two periods. There is a unique
    // index on the day and the kind, so a second press on the same day is a
    // quiet no-op rather than an error reported as a failure to save.
    const { error } = await supabase
      .from('cycle_events')
      .upsert(
        { user_id: userId, event_date: day, event_type: type },
        { onConflict: 'user_id,event_date,event_type' }
      );
    if (error) {
      setNote('That did not save. Worth trying again.');
      return;
    }
    setEvents((e) =>
      e.some((x) => x.event_date === day && x.event_type === type)
        ? e
        : [...e, { event_date: day, event_type: type }]
    );
    setNote(type === 'period_start' ? `Period start recorded for ${human(day)}.` : `Period end recorded for ${human(day)}.`);
  }

  /** Taking back a mark on the day showing - the other half of being able to make one. */
  async function unmarkPeriod(type: string) {
    const userId = await currentUserId();
    if (!userId) return;
    const { error } = await supabase
      .from('cycle_events')
      .delete()
      .eq('user_id', userId)
      .eq('event_date', day)
      .eq('event_type', type);
    if (error) {
      setNote('That did not clear. Worth trying again.');
      return;
    }
    setEvents((e) => e.filter((x) => !(x.event_date === day && x.event_type === type)));
    setNote(`Removed from ${human(day)}.`);
  }

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
        await supabase.from('cycle_days').delete().eq('user_id', userId).eq('day', day);
        setNote('Nothing recorded for this day.');
        return;
      }

      const { error } = await supabase.from('cycle_days').upsert(
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
      // A temperature typed in Fahrenheit comes back as Celsius, so the field
      // has to show what was actually kept rather than what was typed.
      setTemperature(value.temperatureC != null ? String(value.temperatureC) : '');
      setNote(`Saved for ${human(day)}.`);
    } finally {
      setSaving(false);
    }
  }

  const body = (id: CardId) => {
    switch (id) {
      case 'period':
        return (
          <>
            <View style={styles.row}>
              <Pressable
                onPress={() => void markPeriod('period_start')}
                accessibilityRole="button"
                accessibilityLabel={`Record a period starting on ${human(day)}`}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <ThemedView style={[styles.action, { backgroundColor: theme.accentDeep }]}>
                  <ThemedText type="smallBold" themeColor="background">
                    Started {human(day).toLowerCase()}
                  </ThemedText>
                </ThemedView>
              </Pressable>
              <Pressable
                onPress={() => void markPeriod('period_end')}
                accessibilityRole="button"
                accessibilityLabel={`Record a period ending on ${human(day)}`}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <ThemedView type="background" style={styles.action}>
                  <ThemedText type="small">Ended {human(day).toLowerCase()}</ThemedText>
                </ThemedView>
              </Pressable>
            </View>
            {/* WHAT IS ACTUALLY ON THIS DAY. The buttons say what they WOULD
                record, which is why the labels changing with the day read as
                the recorded date moving. This says what is there. */}
            {onThisDay.length > 0 && (
              <View style={styles.marks}>
                {onThisDay.map((m) => (
                  <View key={m.event_type} style={styles.mark}>
                    <MaterialCommunityIcons name="check-circle" size={16} color={theme.accentDeep} />
                    <ThemedText type="small" style={styles.markText}>
                      {EVENT_WORDS[m.event_type] ?? m.event_type} recorded for {human(day).toLowerCase()}
                    </ThemedText>
                    <Pressable
                      onPress={() => void unmarkPeriod(m.event_type)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${EVENT_WORDS[m.event_type] ?? m.event_type} from ${human(day)}`}
                      hitSlop={Spacing.two}
                      style={({ pressed }) => pressed && styles.pressed}
                    >
                      <ThemedText type="small" themeColor="link">
                        Remove
                      </ThemedText>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
            {todayLine && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                {todayLine}
              </ThemedText>
            )}
            {next && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                Next one expected around {human(next.on)}
                {next.give > 0 ? `, give or take ${next.give} ${next.give === 1 ? 'day' : 'days'}` : ''}.
              </ThemedText>
            )}
            {!next && knowledge.basis === 'nominal' && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                Once a few periods are recorded, Selodía can say when the next one is likely. One is not enough to
                say anything useful about it.
              </ThemedText>
            )}
          </>
        );

      case 'history':
        // NEWEST FIRST, because the question somebody brings to this card is
        // almost always "when did it last start", not "when did it ever start".
        return recent.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            Nothing recorded yet. Move to the day it started, then tap Started.
          </ThemedText>
        ) : (
          <View style={styles.history}>
            {recent.map((e) => (
              <Pressable
                key={`${e.event_date}-${e.event_type}`}
                onPress={() => setDay(e.event_date)}
                accessibilityRole="button"
                accessibilityLabel={`Go to ${human(e.event_date)}`}
                style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}
              >
                <MaterialCommunityIcons
                  name={e.event_type === 'period_end' ? 'ray-end' : e.event_type === 'spotting' ? 'circle-small' : 'ray-start'}
                  size={18}
                  color={theme.accent}
                />
                <ThemedText type="small" style={styles.markText}>
                  {EVENT_WORDS[e.event_type] ?? e.event_type}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {human(e.event_date)}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        );
      case 'flow':
        return (
          <Chips
            options={FLOWS.map((f) => f[0].toUpperCase() + f.slice(1))}
            selected={entry.flow ? [entry.flow] : []}
            single
            onToggle={(o) => {
              const f = o.toLowerCase() as CycleDay['flow'];
              setEntry((e) => ({ ...e, flow: e.flow === f ? null : f }));
            }}
          />
        );

      case 'symptoms':
        return (
          <>
            <Chips
              options={symptomChoices(usedSymptoms)}
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
          </>
        );

      case 'feeling': {
        const said = MEASURES.map((m) => ({ m, word: wordFor(m.id, feeling[m.id]?.value) })).filter((x) => x.word);
        return (
          <>
            {said.length > 0 ? (
              <ThemedText type="small">
                {said.map((x) => `${x.m.label}: ${x.word}`).join('  ·  ')}
              </ThemedText>
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
          </>
        );
      }

      case 'ovulation':
        return (
          <>
            <Chips
              options={OVULATION_SIGNS}
              selected={entry.ovulation}
              onToggle={(o) => setEntry((e) => ({ ...e, ovulation: toggleChoice(e.ovulation, o) }))}
            />
            {/* THE TEMPERATURE LIVES HERE, and that answers her question about
                discovery: "hidden but then how do ppl ever know its there for
                use?" Somebody who has put the Ovulation card away has said they
                do not track ovulation, so it is correctly gone for them. Anyone
                who keeps the card sees the offer. */}
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
                  Taken before getting up, at the same time each morning. A rise of two or three tenths, held for
                  days, is what says ovulation has already happened.
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
          </>
        );

      case 'mucus':
        return (
          <Chips
            options={MUCUS}
            selected={entry.mucus ? [entry.mucus] : []}
            single
            onToggle={(o) => setEntry((e) => ({ ...e, mucus: e.mucus === o ? null : o }))}
          />
        );

      case 'notes':
        return (
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
        );
    }
  };

  return (
    <BodyScreen>
      <ThemedText type="display">Cycle</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
        Log what&apos;s relevant, for any day. You can always say it in chat instead.
      </ThemedText>

      {/* THE DAY, WHICH MOVES. Her first note on the mock, and the reason there
          is no "today" button anywhere on this screen. */}
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

      <ReorderableRows
        items={shown}
        onReorder={(next_) => keep(next_, hidden)}
        renderRow={(s) => (
          <Card
            icon={ICONS[s.id]}
            title={TITLES[s.id]}
            optional={s.id === 'symptoms' || s.id === 'ovulation' || s.id === 'mucus' || s.id === 'notes'}
            onHide={editing ? () => keep(shown.filter((x) => x.id !== s.id), [...hidden, s]) : undefined}
          >
            {body(s.id)}
          </Card>
        )}
      />

      <View style={styles.tools}>
        <Pressable
          onPress={() => void save()}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={`Save this day`}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedView style={[styles.save, { backgroundColor: theme.accentDeep }]}>
            <ThemedText type="smallBold" themeColor="background">
              {saving ? 'Saving…' : `Save ${human(day).toLowerCase()}`}
            </ThemedText>
          </ThemedView>
        </Pressable>

        {note && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            {note}
          </ThemedText>
        )}

        <Pressable
          onPress={() => setEditing((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={editing ? 'Finish choosing what to show' : 'Choose what to show'}
          hitSlop={Spacing.two}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedText type="small" themeColor={editing ? 'link' : 'textSecondary'}>
            {editing ? 'Done' : 'Hold a card to move it · Choose what to show'}
          </ThemedText>
        </Pressable>

        {editing && hidden.length > 0 && (
          <View style={styles.putAway}>
            <ThemedText type="small" themeColor="textSecondary">
              Put away
            </ThemedText>
            {hidden.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => keep([...shown, s], hidden.filter((x) => x.id !== s.id))}
                accessibilityRole="button"
                accessibilityLabel={`Show ${TITLES[s.id]} again`}
                style={({ pressed }) => [styles.putAwayRow, pressed && styles.pressed]}
              >
                <MaterialCommunityIcons name="plus-circle-outline" size={18} color={theme.textSecondary} />
                <ThemedText type="small">{TITLES[s.id]}</ThemedText>
              </Pressable>
            ))}
          </View>
        )}

        <Pressable
          onPress={() => router.push({ pathname: '/', params: { prefill: 'My period started ' } })}
          accessibilityRole="button"
          accessibilityLabel="Say it in chat instead"
          hitSlop={Spacing.two}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedText type="small" themeColor="textSecondary">
            Or just tell Selodía in chat
          </ThemedText>
        </Pressable>
      </View>
    </BodyScreen>
  );
}

const styles = StyleSheet.create({
  intro: { lineHeight: 20, maxWidth: 320, marginBottom: Spacing.three },
  dayBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.three,
  },
  dayLabel: { alignItems: 'center', gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  action: { borderRadius: Spacing.three, paddingVertical: Spacing.two, paddingHorizontal: Spacing.four },
  temp: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 17,
    minWidth: 92,
  },
  tempNote: { flex: 1, minWidth: 180, lineHeight: 17 },
  notes: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    minHeight: 88,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  tools: { paddingTop: Spacing.three, gap: Spacing.three },
  save: { borderRadius: Spacing.three, paddingVertical: Spacing.three, alignItems: 'center' },
  putAway: { gap: Spacing.two },
  putAwayRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  marks: { gap: Spacing.one },
  mark: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  markText: { flex: 1 },
  history: { gap: Spacing.two },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  hint: { lineHeight: 18 },
  pressed: { opacity: 0.6 },
});
