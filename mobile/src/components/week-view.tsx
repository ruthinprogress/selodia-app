import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatSteps, syncTodaySteps } from '@/lib/steps';
import { supabase } from '@/lib/supabase';
import { currentWeekStart, daysOfWeek, weekRange } from '@/lib/week';
import { cadenceConflict, cadenceForDays, DAY_KEYS, DAY_LABEL, dayKeyOf, isWalking, logMatchesPlan, placedOnDays, shortDate, type CadenceConflict, type DayKey } from '@/lib/week-plan';

// MY WEEK, AS A WEEK (Ruth's design screen 1, 29 September 2026).
//
// It used to be a flat cadence list - "Ballet / turnout, balance, calf pump /
// 1x/week, 1.5 hrs" - which is what the specification asked for and what her
// earlier reference drew. Seven named days with the activities sitting on them
// answers a different and better question: not "what do I do in a week" but
// "what is today".
//
// WHAT HAS NOT CHANGED, and must not. `user_week` still has no completion
// column. A tick here means A LOG EXISTS, read from activity_logs, and its
// absence means nothing at all - never "missed", never counted, never totalled.
// That is the Witness Principle on the one screen that most invites a score.
//
// THE DAY IS RECURRING, THE DATE IS NOT. `days` holds day names, so "Gym on
// Monday and Thursday" is still true next week. The dates are this week's.
//
// LET ME LEAD PUTS EVERYTHING IN ANYTIME. Her instruction, and it follows from
// what the setting means: somebody who asked not to be led should not open this
// and find her week already assigned. Dragging a card onto a day is her doing
// it herself, which is a different thing, so a dragged day is honoured in both
// modes.

type WeekRow = {
  id: string;
  activity: string;
  purpose: string | null;
  cadence: string | null;
  duration: string | null;
  session_entry_id: string | null;
  days: string[];
  /** Set when SHE put this on its day. Null means the days came from the plan. */
  days_chosen_at: string | null;
  cadence_conflict_asked_at: string | null;
};

type LoggedName = { activity_type: string | null; happened_at: string };

export const WEEK_EMPTY = 'No week yet';
export const WEEK_EMPTY_BODY =
  'Tell Selodía what a normal week looks like for you, and it will keep the shape of it here.';

export function WeekView({
  onLogPlan,
  onLogWeek,
  reloadKey,
  onChanged,
}: {
  onLogPlan?: (plan: { id: string; activity: string; duration: string | null }) => void;
  onLogWeek?: () => void;
  reloadKey?: number;
  onChanged?: () => void;
}) {
  const theme = useTheme();
  const [rows, setRows] = useState<WeekRow[]>([]);
  const [logged, setLogged] = useState<LoggedName[]>([]);
  const [steps, setSteps] = useState<number | null>(null);
  const [guidance, setGuidance] = useState<string | null>(null);
  const [dragUsed, setDragUsed] = useState(true);
  const [loaded, setLoaded] = useState(false);

  // The card being moved, and the sheet that moves it. See the note on the
  // sheet itself for why this is a sheet rather than a drag gesture.
  const [moving, setMoving] = useState<WeekRow | null>(null);
  // The "+" on a day, which offers the Anytime activities to put there.
  const [addingTo, setAddingTo] = useState<DayKey | null>(null);
  const [conflict, setConflict] = useState<{ row: WeekRow; detail: CadenceConflict } | null>(null);

  const weekStart = useMemo(() => currentWeekStart(), []);
  const days = useMemo(() => daysOfWeek(weekStart), [weekStart]);
  const todayKey = dayKeyOf(new Date());

  const load = useCallback(async () => {
    const { startISO, endISO } = weekRange(weekStart);
    const [planRes, logRes, profileRes, stepCount] = await Promise.all([
      supabase
        .from('user_week')
        .select('id, activity, purpose, cadence, duration, session_entry_id, days, days_chosen_at, cadence_conflict_asked_at')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('activity_logs')
        .select('activity_type, happened_at')
        .gte('happened_at', startISO)
        .lt('happened_at', endISO),
      supabase.from('user_profile').select('guidance_mode, week_drag_used_at').maybeSingle(),
      syncTodaySteps(),
    ]);

    const planRows = (planRes.error ? [] : (planRes.data ?? [])) as WeekRow[];
    setRows(planRows);
    setLogged((logRes.error ? [] : (logRes.data ?? [])) as LoggedName[]);
    const p = profileRes.data as { guidance_mode: string | null; week_drag_used_at: string | null } | null;
    setGuidance(p?.guidance_mode ?? null);
    setDragUsed(Boolean(p?.week_drag_used_at));
    setSteps(stepCount);
    setLoaded(true);

    // ASK ONCE, AND ONLY WHEN BOTH ANSWERS ARE DEFINITE. See week-plan.ts.
    const clash = planRows.find(
      (r) => !r.cadence_conflict_asked_at && cadenceConflict(r.cadence, r.days ?? [])
    );
    if (clash) {
      const detail = cadenceConflict(clash.cadence, clash.days ?? []);
      if (detail) setConflict({ row: clash, detail });
    }
  }, [weekStart]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        await load();
        if (cancelled) return;
      })();
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, reloadKey])
  );

  // LET ME LEAD: "everything in Anytime UNLESS DRAGGED" (Ruth, 29 September).
  //
  // The days on a plan are a SUGGESTION - they were filled in when the plan was
  // written, for everybody. Under "Guide me" that suggestion is the point, and
  // a card sits on its day. Under "Let me lead" it is exactly what she asked
  // not to be given, so a card starts in Anytime and only takes a day once she
  // has put it on one. `days_chosen_at` is the difference between the two, and
  // it has to be per row: the profile's week_drag_used_at says only that she
  // has dragged SOMETHING, which cannot place a card.
  //
  // THE DAYS ARE NEVER CLEARED by the setting. She may switch back, and
  // throwing away her answer because of a mode would lose it.
  // THE ANSWER COMES FROM week-plan.ts, so the "Log the week" sheet cannot
  // reach a different one. See placedOnDays there.
  const sits = (r: WeekRow) => placedOnDays(guidance, r);

  const walking = rows.find((r) => isWalking(r.activity)) ?? null;
  const planned = rows.filter((r) => !isWalking(r.activity));

  const onDay = (key: DayKey) => planned.filter((r) => sits(r).includes(key));
  // ANYTIME HOLDS WHATEVER IS NOT ON A DAY - the ones with no days at all, and
  // under "Let me lead" the ones she has not placed yet.
  const anytime = planned.filter((r) => sits(r).length === 0);

  /** Has this plan been logged this week? A tick, never a cross. */
  const isLogged = useCallback(
    (activity: string) => logged.some((l) => logMatchesPlan(l.activity_type ?? '', activity)),
    [logged]
  );

  async function setDays(row: WeekRow, days: string[]) {
    // THE STAMP GOES ON AT THE WRITE, which is the only place that knows she
    // did this rather than the plan. Every path that moves a card comes
    // through here - the move sheet and the day's "+" both call it - so there
    // is no second place for it to be forgotten.
    const chosen = new Date().toISOString();
    // SAVES IMMEDIATELY, as she asked. Optimistic locally so the card moves
    // under her finger rather than after a round trip.
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, days, days_chosen_at: chosen } : r))
    );
    await supabase.from('user_week').update({ days, days_chosen_at: chosen }).eq('id', row.id);
    await markDragUsed();
    onChanged?.();
  }

  async function markDragUsed() {
    if (dragUsed) return;
    setDragUsed(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('user_profile')
        .update({ week_drag_used_at: new Date().toISOString() })
        .eq('user_id', user.id);
    }
  }

  async function resolveConflict(keepDays: boolean) {
    if (!conflict) return;
    const { row, detail } = conflict;
    const patch: Record<string, unknown> = { cadence_conflict_asked_at: new Date().toISOString() };
    if (keepDays) patch.cadence = cadenceForDays(detail.plannedDays);
    else patch.days = [];
    setConflict(null);
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id
          ? {
              ...r,
              cadence_conflict_asked_at: String(patch.cadence_conflict_asked_at),
              cadence: keepDays ? cadenceForDays(detail.plannedDays) : r.cadence,
              days: keepDays ? r.days : [],
            }
          : r
      )
    );
    await supabase.from('user_week').update(patch).eq('id', row.id);
    onChanged?.();
  }

  if (!loaded) return null;

  if (rows.length === 0) {
    return (
      <Pressable
        onPress={() => router.push('/')}
        accessibilityRole="link"
        accessibilityLabel={`${WEEK_EMPTY}. ${WEEK_EMPTY_BODY}`}
        style={({ pressed }) => pressed && styles.pressed}>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">{WEEK_EMPTY}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {WEEK_EMPTY_BODY}
          </ThemedText>
        </ThemedView>
      </Pressable>
    );
  }

  return (
    <ThemedView style={styles.block}>
      {/* ---- the seven days ---- */}
      {/* SHOWN IN BOTH MODES. They were hidden under "Let me lead", which made
          "unless dragged" impossible to satisfy: with no day rows there was
          nowhere to put a card, and moving one changed nothing on screen. An
          empty week with seven "+" is also a truer picture of a week she leads
          than no week at all. */}
      {days.map((date) => {
          const key = dayKeyOf(date);
          const isToday = key === todayKey;
          const items = onDay(key);
          return (
            <ThemedView
              key={key}
              type={isToday ? 'backgroundSelected' : 'background'}
              style={[styles.dayRow, isToday && { borderColor: theme.accentDeep }]}>
              <View style={styles.dayLabel}>
                <ThemedText type="smallBold" themeColor={isToday ? 'accentDeep' : 'text'}>
                  {DAY_LABEL[key]}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {shortDate(date)}
                </ThemedText>
              </View>

              <View style={styles.pills}>
                {items.map((row) => (
                  <PlanPill
                    key={row.id}
                    row={row}
                    logged={isLogged(row.activity)}
                    onPress={() => onLogPlan?.({ id: row.id, activity: row.activity, duration: row.duration })}
                    onLongPress={() => setMoving(row)}
                  />
                ))}
              </View>

              <Pressable
                onPress={() => setAddingTo(key)}
                accessibilityRole="button"
                accessibilityLabel={`Add an activity to ${DAY_LABEL[key]} ${shortDate(date)}`}
                hitSlop={Spacing.three}
                style={({ pressed }) => pressed && styles.pressed}>
                <Ionicons name="add" size={20} color={theme.accentDeep} />
              </Pressable>
            </ThemedView>
          );
        })}

      {/* ---- anytime ---- */}
      <ThemedText type="sectionTitle" style={styles.anytimeHeading}>
        Anytime this week
      </ThemedText>
      {anytime.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Everything has a day. Hold a card to move one back here.
        </ThemedText>
      ) : (
        <View style={styles.grid}>
          {anytime.map((row) => (
            <View key={row.id} style={styles.gridCell}>
              <PlanCard
                row={row}
                logged={isLogged(row.activity)}
                onPress={() => onLogPlan?.({ id: row.id, activity: row.activity, duration: row.duration })}
                onLongPress={() => setMoving(row)}
              />
            </View>
          ))}
        </View>
      )}

      {/* ---- walking, its own card ---- */}
      {walking && (
        <ThemedView type="backgroundElement" style={styles.walkCard}>
          <ThemedText type="smallBold">{walking.activity}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {/* THE NUMBER IS THE PHONE'S, and when there is none the card says
                so rather than showing a zero. A zero is a claim that nobody
                has moved. */}
            {walking.cadence ? `${walking.cadence.toLowerCase()} · ` : ''}
            {steps == null ? 'no step count today' : `${formatSteps(steps)} steps today`}
          </ThemedText>
        </ThemedView>
      )}

      {/* ---- the hint, and the week button ---- */}
      <View style={styles.footer}>
        {/* SHOWN UNTIL SHE HAS MOVED ONE, AND THEN NEVER AGAIN. Her
            instruction. A hint that stays forever becomes furniture, and
            furniture is what people stop reading. */}
        {!dragUsed && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            Hold a card to move it to another day, or back to Anytime.
          </ThemedText>
        )}
        {onLogWeek && (
          <Pressable
            onPress={onLogWeek}
            accessibilityRole="button"
            accessibilityLabel="Log the week"
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundElement" style={styles.weekButton}>
              <ThemedText type="smallBold">Log the week</ThemedText>
            </ThemedView>
          </Pressable>
        )}
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        This is the shape of your week, not a score. Nothing here is ever marked done or missed.
      </ThemedText>

      {/* ---- move sheet ---- */}
      <MoveSheet
        row={moving}
        days={days}
        onClose={() => setMoving(null)}
        onPick={(picked) => {
          const row = moving;
          setMoving(null);
          if (!row) return;
          void setDays(row, picked);
        }}
      />

      {/* ---- add to a day ---- */}
      <AddToDaySheet
        dayKey={addingTo}
        date={addingTo ? days[DAY_KEYS.indexOf(addingTo)] : null}
        candidates={planned}
        onClose={() => setAddingTo(null)}
        onPick={(row) => {
          const key = addingTo;
          setAddingTo(null);
          if (!key || !row) return;
          const next = [...new Set([...(row.days ?? []), key])];
          void setDays(row, next);
        }}
        onNew={() => {
          const key = addingTo;
          setAddingTo(null);
          router.push({
            pathname: '/',
            params: {
              prefill: key
                ? `I'd like to add something to my week on ${DAY_LABEL[key]}.`
                : "I'd like to add something to my week.",
              askNow: '1',
            },
          });
        }}
      />

      {/* ---- cadence disagreement ---- */}
      {conflict && (
        <Modal visible transparent animationType="fade" onRequestClose={() => void resolveConflict(true)}>
          <View style={styles.scrim}>
            <ThemedView style={styles.dialog}>
              <ThemedText type="sectionTitle">{conflict.row.activity}</ThemedText>
              <ThemedText type="small">
                This says {conflict.row.cadence}, and it is on {conflict.detail.plannedDays} days. Which is
                right?
              </ThemedText>
              <Pressable
                onPress={() => void resolveConflict(true)}
                accessibilityRole="button"
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView type="backgroundElement" style={styles.dialogButton}>
                  <ThemedText type="smallBold">
                    The days. Make it {cadenceForDays(conflict.detail.plannedDays)}
                  </ThemedText>
                </ThemedView>
              </Pressable>
              <Pressable
                onPress={() => void resolveConflict(false)}
                accessibilityRole="button"
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView type="backgroundElement" style={styles.dialogButton}>
                  <ThemedText type="smallBold">
                    The cadence. Move it back to Anytime
                  </ThemedText>
                </ThemedView>
              </Pressable>
              <ThemedText type="small" themeColor="textSecondary">
                Asked once. It will not come back.
              </ThemedText>
            </ThemedView>
          </View>
        </Modal>
      )}
    </ThemedView>
  );
}

// ---------------------------------------------------------------- pieces

function PlanPill({
  row,
  logged,
  onPress,
  onLongPress,
}: {
  row: WeekRow;
  logged: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={`${row.activity}${row.duration ? `, ${row.duration}` : ''}${
        logged ? ', logged' : ''
      }. Tap to log it, hold to move it`}
      style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type="backgroundElement" style={styles.pill}>
        {/* A QUIET TICK, AND NOTHING WHEN THERE IS NONE. The absence says
            nothing at all - not "missed", not "0 of 2". */}
        {logged && <Ionicons name="checkmark-circle" size={14} color={theme.accentDeep} />}
        <View>
          <ThemedText type="small">{row.activity}</ThemedText>
          {row.duration ? (
            <ThemedText type="small" themeColor="textSecondary">
              {row.duration}
            </ThemedText>
          ) : null}
        </View>
      </ThemedView>
    </Pressable>
  );
}

function PlanCard({
  row,
  logged,
  onPress,
  onLongPress,
}: {
  row: WeekRow;
  logged: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={`${row.activity}${row.cadence ? `, ${row.cadence}` : ''}${
        logged ? ', logged' : ''
      }. Tap to log it, hold to move it`}
      style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type="backgroundElement" style={styles.gridCard}>
        <View style={styles.gridCardTop}>
          <ThemedText type="small" style={styles.gridCardName}>
            {row.activity}
          </ThemedText>
          {logged && <Ionicons name="checkmark-circle" size={14} color={theme.accentDeep} />}
        </View>
        {row.cadence || row.duration ? (
          <ThemedText type="small" themeColor="textSecondary">
            {[row.cadence, row.duration].filter(Boolean).join(' · ')}
          </ThemedText>
        ) : null}
      </ThemedView>
    </Pressable>
  );
}

// A SHEET RATHER THAN A DRAG GESTURE, and this is a deliberate trade worth
// stating plainly.
//
// Ruth asked for long-press and drag. A cross-container drag in React Native
// means measuring every drop target, tracking an absolute overlay and resolving
// a hit on release - and it cannot be verified anywhere but a real phone, which
// is precisely where a half-working one would land on the first morning of her
// test week.
//
// So the GESTURE is hers - long-press picks a card up - and the DESTINATION is
// a list rather than a drop. It saves immediately, moves between days and back
// to Anytime, and works with a screen reader, which a drag does not. The drag
// itself is worth building once there is a device to test it on.
function MoveSheet({
  row,
  days,
  onClose,
  onPick,
}: {
  row: WeekRow | null;
  days: Date[];
  onClose: () => void;
  onPick: (days: string[]) => void;
}) {
  const theme = useTheme();
  if (!row) return null;
  const current = row.days ?? [];
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrimFull} onPress={onClose} accessibilityLabel="Close" />
      <ThemedView style={styles.sheet}>
        <View style={[styles.grabber, { backgroundColor: theme.backgroundSelected }]} />
        <View style={styles.sheetBody}>
          <ThemedText type="sectionTitle">Move {row.activity}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Tap a day to put it there, or tap it again to take it off.
          </ThemedText>
          <View style={styles.moveGrid}>
            {days.map((d) => {
              const key = dayKeyOf(d);
              const on = current.includes(key);
              return (
                <Pressable
                  key={key}
                  onPress={() => onPick(on ? current.filter((k) => k !== key) : [...current, key])}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${DAY_LABEL[key]} ${shortDate(d)}`}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <ThemedView
                    type={on ? 'backgroundSelected' : 'backgroundElement'}
                    style={[styles.moveChip, { borderColor: on ? theme.accentDeep : 'transparent' }]}>
                    <ThemedText type="small" themeColor={on ? 'accentDeep' : 'text'}>
                      {DAY_LABEL[key]}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            onPress={() => onPick([])}
            accessibilityRole="button"
            accessibilityLabel="Move to Anytime this week"
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundElement" style={styles.moveAnytime}>
              <ThemedText type="smallBold">Anytime this week</ThemedText>
            </ThemedView>
          </Pressable>
        </View>
      </ThemedView>
    </Modal>
  );
}

function AddToDaySheet({
  dayKey,
  date,
  candidates,
  onClose,
  onPick,
  onNew,
}: {
  dayKey: DayKey | null;
  date: Date | null;
  candidates: WeekRow[];
  onClose: () => void;
  onPick: (row: WeekRow) => void;
  onNew: () => void;
}) {
  const theme = useTheme();
  if (!dayKey || !date) return null;
  // Anything not already on this day, which includes things that are on other
  // days: "also on Thursday" is a real thing to want.
  const choices = candidates.filter((r) => !(r.days ?? []).includes(dayKey));
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrimFull} onPress={onClose} accessibilityLabel="Close" />
      <ThemedView style={styles.sheet}>
        <View style={[styles.grabber, { backgroundColor: theme.backgroundSelected }]} />
        <View style={styles.sheetBody}>
          <ThemedText type="sectionTitle">
            Add to {DAY_LABEL[dayKey]} {shortDate(date)}
          </ThemedText>
          {choices.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              Everything in your week is already on this day.
            </ThemedText>
          ) : (
            choices.map((row) => (
              <Pressable
                key={row.id}
                onPress={() => onPick(row)}
                accessibilityRole="button"
                accessibilityLabel={row.activity}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView type="backgroundElement" style={styles.moveAnytime}>
                  <ThemedText type="small">{row.activity}</ThemedText>
                </ThemedView>
              </Pressable>
            ))
          )}
          <Pressable
            onPress={onNew}
            accessibilityRole="link"
            accessibilityLabel="Add something new, opens chat"
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedText type="small" themeColor="accentDeep" style={styles.addNew}>
              Something else — tell chat
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  block: { gap: Spacing.two },
  card: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: CardRadius,
    gap: Spacing.one,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: CardRadius,
    borderWidth: 1,
    borderColor: 'transparent',
    // Room for two pills before it wraps, and it wraps rather than clipping.
    minHeight: 52,
  },
  // Fixed so every day's activities start at the same x, which is what makes
  // the column read as a week rather than as seven unrelated rows.
  dayLabel: { width: 58 },
  pills: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: CardRadius,
  },
  anytimeHeading: { marginTop: Spacing.three },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  // Two columns. Percentage rather than a measured width so it survives a
  // rotation and a bigger font without measuring anything.
  gridCell: { width: '48.5%' },
  gridCard: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: CardRadius,
    gap: 2,
    minHeight: 64,
    justifyContent: 'center',
  },
  gridCardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  gridCardName: { flexShrink: 1 },
  walkCard: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: CardRadius,
    gap: 2,
    marginTop: Spacing.two,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    marginTop: Spacing.three,
  },
  // AT NORMAL SIZE, which is her instruction. It used to be drawn at a size
  // nobody could read, which is the same as not showing it.
  hint: { flex: 1 },
  weekButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 999,
  },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(23, 13, 9, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  scrimFull: { flex: 1, backgroundColor: 'rgba(23, 13, 9, 0.35)' },
  dialog: { padding: Spacing.four, borderRadius: CardRadius, gap: Spacing.three, width: '100%' },
  dialogButton: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: CardRadius,
  },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  grabber: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.three,
  },
  sheetBody: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six },
  moveGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  moveChip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: CardRadius,
    borderWidth: 1,
  },
  moveAnytime: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: CardRadius,
  },
  addNew: { marginTop: Spacing.two },
  pressed: { opacity: 0.7 },
});
