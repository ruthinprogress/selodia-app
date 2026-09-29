import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatSteps, syncTodaySteps } from '@/lib/steps';
import { supabase } from '@/lib/supabase';
import { moveToDays, withDay } from '@/lib/week-move';
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

/** A place a card can be dropped, in window coordinates. */
type DropZone = { key: string; x: number; y: number; width: number; height: number };

/** The Anytime block's zone key. Not a day, so it cannot collide with one. */
const ANYTIME = 'anytime';

/** The carried preview's size. Fixed, so the worklet can centre it on the finger. */
const PREVIEW_W = 130;
const PREVIEW_H = 34;

export const WEEK_EMPTY = 'No week yet';
export const WEEK_EMPTY_BODY =
  'Tell Selodía what a normal week looks like for you, and it will keep the shape of it here.';

export function WeekView({
  onLogPlan,
  onLogWeek,
  reloadKey,
  onChanged,
}: {
  onLogPlan?: (plan: { id: string; activity: string; duration: string | null; days: string[] }) => void;
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


  // ---- dragging ----------------------------------------------------------
  //
  // WHY THIS IS A REAL GESTURE AND NOT Pressable's onLongPress.
  //
  // The first version used onLongPress, which lives in React Native's own JS
  // responder system. A parent ScrollView can claim the responder the moment a
  // finger moves a few pixels, and claiming it CANCELS the pending long press.
  // So "press and drag" - which is exactly what she was doing, and exactly
  // what the word drag means - cancelled itself before the 350ms timer could
  // fire. Nothing happened, and nothing was going to.
  //
  // Gesture.Pan().activateAfterLongPress() is the tool built for this: the
  // ScrollView keeps the touch until the hold wins, and then the pan takes it
  // and keeps it through the movement. The same library already does the swipe
  // on Measurements and the re-order on Log, both on this phone.
  //
  // COORDINATES ARE WINDOW COORDINATES throughout. Every drop zone is measured
  // with measureInWindow at the moment the drag starts, and the finger arrives
  // as absoluteX/absoluteY, so nothing anywhere has to know the scroll offset.
  // Measuring at drag start rather than on layout is what keeps that true
  // after she has scrolled.
  const rootRef = useRef<View | null>(null);
  const zoneRefs = useRef<Record<string, View | null>>({});
  /** Drop targets in window coordinates, read by the gesture worklet. */
  const zones = useSharedValue<DropZone[]>([]);
  /** Where the week's own top-left is, so the preview can be placed inside it. */
  const rootAt = useSharedValue({ x: 0, y: 0 });
  /** The finger, in window coordinates. */
  const fingerX = useSharedValue(0);
  const fingerY = useSharedValue(0);
  /** Which zone the finger is over. A shared value so the worklet can compare. */
  const overKey = useSharedValue<string | null>(null);
  /** The row being carried, for the preview. JS state: it changes once a drag. */
  const [carrying, setCarrying] = useState<WeekRow | null>(null);
  /** The highlighted zone, mirrored into JS only when it actually changes. */
  const [over, setOver] = useState<string | null>(null);
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

  // MEASURE EVERY DROP TARGET, ONCE, AT THE MOMENT SHE PICKS A CARD UP.
  //
  // measureInWindow is callback-based and one call per view, so this gathers
  // them and writes the finished list into a shared value in a single
  // assignment - the worklet must never see a half-built list.
  const measureZones = useCallback(() => {
    const entries = Object.entries(zoneRefs.current).filter(([, v]) => v);
    let left = entries.length + 1;
    const found: DropZone[] = [];
    const done = () => {
      left -= 1;
      if (left === 0) zones.set(found);
    };
    rootRef.current?.measureInWindow((x, y) => {
      rootAt.set({ x, y });
      done();
    });
    if (!rootRef.current) done();
    for (const [key, node] of entries) {
      node?.measureInWindow((x, y, width, height) => {
        // A zone with no size is a zone that is not on screen. Dropping onto
        // one would be dropping onto nothing.
        if (width > 0 && height > 0) found.push({ key, x, y, width, height });
        done();
      });
    }
  }, [rootAt, zones]);

  // DECLARED BEFORE THE GESTURES THAT USE IT, and that ordering is load
  // bearing rather than tidy. A Reanimated worklet captures the variables it
  // references AT THE MOMENT THE WORKLET IS BUILT, not when it runs - so a
  // gesture built above this line would read `clearCarry` while it was still
  // in the temporal dead zone and throw before the Week tab drew anything.
  const clearCarry = useCallback(() => {
    setCarrying(null);
    setOver(null);
  }, []);

  // THE GESTURES MUST OUTLIVE A RE-RENDER, and a drag causes re-renders: the
  // highlighted zone and the carried card are both React state, so the week
  // re-renders several times between picking a card up and letting it go. A
  // gesture object rebuilt during that hand-off can be re-attached
  // mid-gesture, which cancels it - the drag would die the instant the first
  // day row highlighted, and look exactly like a drag that does not work.
  //
  // So the gestures are memoised on the SET OF ROW IDS, and they close over an
  // id rather than a row. Closing over the row would put a stale `days` inside
  // a gesture that survives the move that changed it.
  const rowsRef = useRef<WeekRow[]>([]);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const liftCard = useCallback(
    (rowId: string) => {
      const row = rowsRef.current.find((r) => r.id === rowId) ?? null;
      setCarrying(row);
      measureZones();
    },
    [measureZones]
  );

  // WHERE IT LANDED. `key` is a day, 'anytime', or null for a drop that hit
  // nothing - and a drop that hit nothing puts the card back where it was
  // rather than guessing, because a guess here silently rearranges her week.
  const dropCard = useCallback(
    (rowId: string, key: string | null) => {
      setCarrying(null);
      setOver(null);
      if (!key) return;
      const row = rowsRef.current.find((r) => r.id === rowId);
      if (!row) return;
      const next = key === ANYTIME ? [] : withDay(row.days, key);
      const already =
        next.length === (row.days ?? []).length &&
        next.every((d) => (row.days ?? []).includes(d));
      // Dropping a card back on the day it already sits on is not a change,
      // and writing it would stamp days_chosen_at for nothing.
      if (already) return;
      void applyMove(row, next);
    },
    // applyMove is stable for the life of the screen; listing it would make
    // every gesture rebuild on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /**
   * ONE GESTURE PER CARD. Built here rather than inside the card so every card
   * shares the same zones, the same finger and the same drop - a gesture built
   * in the child would have its own copy of all three.
   */
  const makeGesture = useCallback(
    (rowId: string) =>
      Gesture.Pan()
        // THE HOLD HAS TO WIN BEFORE THE PAN STARTS. Until it does, the touch
        // belongs to the ScrollView and the page scrolls normally. 250ms is
        // the same feel as a long press and short enough not to read as a
        // hang.
        .activateAfterLongPress(250)
        .onStart((e) => {
          'worklet';
          fingerX.set(e.absoluteX);
          fingerY.set(e.absoluteY);
          overKey.set(null);
          runOnJS(liftCard)(rowId);
        })
        .onUpdate((e) => {
          'worklet';
          fingerX.set(e.absoluteX);
          fingerY.set(e.absoluteY);
          const list = zones.get();
          let hit: string | null = null;
          for (let i = 0; i < list.length; i += 1) {
            const z = list[i];
            if (
              e.absoluteX >= z.x &&
              e.absoluteX <= z.x + z.width &&
              e.absoluteY >= z.y &&
              e.absoluteY <= z.y + z.height
            ) {
              hit = z.key;
              break;
            }
          }
          // ONLY WHEN IT CHANGES. This runs every frame; crossing the bridge
          // sixty times a second to set the same value is how a drag becomes
          // a stutter.
          if (hit !== overKey.get()) {
            overKey.set(hit);
            runOnJS(setOver)(hit);
          }
        })
        .onEnd(() => {
          'worklet';
          runOnJS(dropCard)(rowId, overKey.get());
        })
        // FINALIZE, NOT JUST END. A gesture cancelled by the system - a call
        // arriving, the app backgrounding - never reaches onEnd, and without
        // this the card would stay lifted with no finger on it.
        .onFinalize(() => {
          'worklet';
          overKey.set(null);
          runOnJS(clearCarry)();
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [liftCard, dropCard]
  );

  // ONE STABLE GESTURE PER CARD, rebuilt only when the set of cards changes.
  const rowIds = rows.map((r) => r.id).join('|');
  const gestures = useMemo(() => {
    const map = new Map<string, ReturnType<typeof makeGesture>>();
    for (const id of rowIds ? rowIds.split('|') : []) map.set(id, makeGesture(id));
    return map;
    // rowIds is the identity of the set; `rows` itself is a new array every load.
  }, [rowIds, makeGesture]);

  /** The preview that follows her finger, placed inside the week's own box. */
  const previewStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: fingerX.get() - rootAt.get().x - PREVIEW_W / 2 },
      { translateY: fingerY.get() - rootAt.get().y - PREVIEW_H - 12 },
    ],
  }));

  async function applyMove(row: WeekRow, days: string[]) {
    // THE WRITE ITSELF IS IN lib/week-move.ts, because three routes reach it
    // now - the drag, the hold, and "Move to…" in the tap sheet - and the
    // days_chosen_at stamp is silent when it is forgotten.
    const chosen = new Date().toISOString();
    // SAVES IMMEDIATELY, as she asked. Optimistic locally so the card moves
    // under her finger rather than after a round trip.
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, days, days_chosen_at: chosen } : r))
    );
    setDragUsed(true);
    try {
      await moveToDays(row.id, days);
    } catch {
      // PUT IT BACK. A card that stays where she dropped it while the database
      // still has it somewhere else is the worst of both - it looks saved and
      // is not. Reloading shows the truth.
      await load();
    }
    onChanged?.();
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
    <ThemedView ref={rootRef} style={styles.block} collapsable={false}>
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
              // MEASURED, SO IT CAN BE DROPPED ON. collapsable={false} is not
              // optional: without it Android may flatten a plain view out of
              // the native tree entirely, and measureInWindow on something
              // that is not there returns zeros - which reads as a drop zone
              // in the top-left corner of the screen.
              ref={(node: View | null) => {
                zoneRefs.current[key] = node;
              }}
              collapsable={false}
              type={isToday || over === key ? 'backgroundSelected' : 'background'}
              style={[
                styles.dayRow,
                isToday && { borderColor: theme.accentDeep },
                // WHERE IT WILL LAND, shown while she is still holding it.
                // Without this a drag is a guess until she lets go.
                over === key && { borderColor: theme.accentDeep, borderWidth: 2 },
              ]}>
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
                  <GestureDetector key={row.id} gesture={gestures.get(row.id)!}>
                    <View collapsable={false}>
                      <PlanPill
                        row={row}
                        logged={isLogged(row.activity)}
                        carrying={carrying?.id === row.id}
                        onPress={() =>
                          onLogPlan?.({
                            id: row.id,
                            activity: row.activity,
                            duration: row.duration,
                            days: row.days ?? [],
                          })
                        }
                      />
                    </View>
                  </GestureDetector>
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
      <View
        ref={(node) => {
          zoneRefs.current[ANYTIME] = node;
        }}
        collapsable={false}
        style={[
          styles.anytimeZone,
          over === ANYTIME && { borderColor: theme.accentDeep, borderWidth: 2 },
        ]}>
        {anytime.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Everything has a day. Drag a card back here, or hold one and choose Anytime.
          </ThemedText>
        ) : (
          <View style={styles.grid}>
            {anytime.map((row) => (
              <View key={row.id} style={styles.gridCell}>
                <GestureDetector gesture={gestures.get(row.id)!}>
                  <View collapsable={false}>
                    <PlanCard
                      row={row}
                      logged={isLogged(row.activity)}
                      carrying={carrying?.id === row.id}
                      onPress={() =>
                        onLogPlan?.({
                          id: row.id,
                          activity: row.activity,
                          duration: row.duration,
                          days: row.days ?? [],
                        })
                      }
                    />
                  </View>
                </GestureDetector>
              </View>
            ))}
          </View>
        )}
      </View>

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
            Hold a card and drag it to another day, or tap it and choose Move
            to…
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

      {/* ---- the card she is carrying ----

          It follows the finger rather than the card moving in place, which
          matters on Android: a transformed child can be clipped by the row it
          sits in, and a drag you cannot see is a drag that "does nothing".
          This is a sibling of the day rows, so nothing can clip it.

          pointerEvents none, or it would sit under her finger and eat the very
          gesture that is driving it. */}
      {carrying && (
        <Animated.View pointerEvents="none" style={[styles.preview, previewStyle]}>
          <ThemedView type="backgroundSelected" style={styles.previewInner}>
            <ThemedText type="small" numberOfLines={1}>
              {carrying.activity}
            </ThemedText>
          </ThemedView>
        </Animated.View>
      )}

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
          void applyMove(row, next);
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
  carrying,
  onPress,
}: {
  row: WeekRow;
  logged: boolean;
  /** Lifted: the real card dims and the preview carries the name instead. */
  carrying: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      // NO onLongPress. The hold is the drag's, and it cannot be shared:
      // Pressable's long press and the pan gesture both fired, so holding a
      // card lifted it AND threw the move sheet up over the week she was
      // dragging it across. Caught in a mid-drag screenshot.
      //
      // Nothing is lost by removing it. "Move to…" is in the tap sheet, which
      // is the route that works with a screen reader, and a tap is easier to
      // find than a hold ever was.
      accessibilityRole="button"
      accessibilityLabel={`${row.activity}${row.duration ? `, ${row.duration}` : ''}${
        logged ? ', logged' : ''
      }`}
      // TWO ROUTES, BOTH SPOKEN. A screen reader user cannot drag, so the hint
      // names the one they can use. See move-sheet.tsx.
      accessibilityHint="Opens the log sheet, which has Move to…"
      style={({ pressed }) => [pressed && styles.pressed, carrying && styles.lifted]}>
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
  carrying,
  onPress,
}: {
  row: WeekRow;
  logged: boolean;
  /** Lifted: the real card dims and the preview carries the name instead. */
  carrying: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      // NO onLongPress. The hold is the drag's, and it cannot be shared:
      // Pressable's long press and the pan gesture both fired, so holding a
      // card lifted it AND threw the move sheet up over the week she was
      // dragging it across. Caught in a mid-drag screenshot.
      //
      // Nothing is lost by removing it. "Move to…" is in the tap sheet, which
      // is the route that works with a screen reader, and a tap is easier to
      // find than a hold ever was.
      accessibilityRole="button"
      accessibilityLabel={`${row.activity}${row.cadence ? `, ${row.cadence}` : ''}${
        logged ? ', logged' : ''
      }`}
      accessibilityHint="Opens the log sheet, which has Move to…"
      style={({ pressed }) => [pressed && styles.pressed, carrying && styles.lifted]}>
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
  // The whole block is the drop target, not each card, so "back to Anytime"
  // does not require her to hit a gap between two cards. The border is
  // transparent until she is over it, so nothing is drawn at rest.
  anytimeZone: {
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: CardRadius,
    padding: Spacing.one,
  },
  // Dimmed, not hidden: the space it leaves is what tells her where it came
  // from if she changes her mind.
  lifted: { opacity: 0.3 },
  preview: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: PREVIEW_W,
    height: PREVIEW_H,
    zIndex: 50,
    elevation: 50,
  },
  previewInner: {
    flex: 1,
    borderRadius: CardRadius,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
