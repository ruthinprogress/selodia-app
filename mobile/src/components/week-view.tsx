import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { byTimeOfDay, pillDetail } from '@/lib/day-time';
import { formatSteps, syncTodaySteps } from '@/lib/steps';
import { supabase } from '@/lib/supabase';
import { addToWeek, moveToDays, withDay } from '@/lib/week-move';
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
  /**
   * WHEN IN THE DAY, IN HER WORDS. Text, not a time column, and deliberately:
   * "7pm", "evening", "after the school run" and "before work" are all answers
   * she might give, and only one of them is a clock time. Parsing it into
   * 19:00:00 would throw away the other three and gain nothing, because nothing
   * sorts or alarms on this - it is read, shown, and spoken back.
   */
  time_of_day: string | null;
  session_entry_id: string | null;
  days: string[];
  /** Set when SHE put this on its day. Null means the days came from the plan. */
  days_chosen_at: string | null;
  cadence_conflict_asked_at: string | null;
};

type LoggedName = { activity_type: string | null; happened_at: string };

/**
 * THE SAME SECOND LINE THE CARD HAD. A pill on a day shows its duration; a
 * card in Anytime shows its cadence and duration. The preview is one
 * component, so it asks where the card was lifted from rather than guessing.
 */
function previewDetail(row: WeekRow, from: string | null): string {
  if (from === ANYTIME) return [row.cadence, row.duration].filter(Boolean).join(' · ');
  // THE SAME LINE THE PILL SHOWS, through the same function - so a carried
  // card cannot disagree with the one it was lifted from about its own time.
  return pillDetail(row.time_of_day, row.duration);
}

/** A place a card can be dropped, in window coordinates. */
type DropZone = { key: string; x: number; y: number; width: number; height: number };

/** The Anytime block's zone key. Not a day, so it cannot collide with one. */
const ANYTIME = 'anytime';

/** Where the finger sits relative to the carried card's top-left corner. */
const GRAB_X = 28;
const GRAB_Y = 52;

export const WEEK_EMPTY = 'No week yet';
export const WEEK_EMPTY_BODY =
  'Tap to add something you do, or talk it through with Selodía, and the shape of your week will live here.';

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
  /** The section the card was picked up from, which never lights up on lift. */
  const originKey = useSharedValue<string | null>(null);
  /** Set once the finger leaves where it started, so returning can light up. */
  const leftOrigin = useSharedValue(false);
  /** The row being carried, for the preview. JS state: it changes once a drag. */
  const [carrying, setCarrying] = useState<WeekRow | null>(null);
  /** And the section it came from, so the preview shows the same second line. */
  const [carryFrom, setCarryFrom] = useState<string | null>(null);
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
        .select('id, activity, purpose, cadence, duration, time_of_day, session_entry_id, days, days_chosen_at, cadence_conflict_asked_at')
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

  // CHRONOLOGICAL WITHIN THE DAY (Ruth, 1 October, UI item 3). Her example:
  // Thursday reads French 10:00 then Gym ~19:00, not whatever order the rows
  // happen to be stored in. "The goal is not to create a calendar. The goal is
  // to give the week a natural rhythm."
  //
  // THE ORDER COMES OUT OF HER OWN WORDS, derived rather than stored - see
  // lib/day-time.ts. "Morning" sorts before "evening" without ever being shown
  // as a clock, and anything with no time at all sorts last, so the timed things
  // are the spine of the day.
  const onDay = (key: DayKey) => byTimeOfDay(planned.filter((r) => sits(r).includes(key)));
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
    setCarryFrom(null);
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
    (rowId: string, from: string) => {
      const row = rowsRef.current.find((r) => r.id === rowId) ?? null;
      setCarrying(row);
      setCarryFrom(from);
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
      setCarryFrom(null);
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
    (rowId: string, from: string) =>
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
          originKey.set(from);
          leftOrigin.set(false);
          runOnJS(liftCard)(rowId, from);
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
            if (hit !== originKey.get()) leftOrigin.set(true);
            // WHAT LIGHTS UP IS NOT WHAT WILL RECEIVE IT. `overKey` above is
            // the truth - the drop still works for Anytime and for the section
            // it came from. This is only what she SEES, and Ruth asked for two
            // things to stay dark:
            //
            //   the section it came from, on lift. Picking a card up lit the
            //   whole row under her finger, which reads as "this row is the
            //   thing happening" when the thing happening is the card. Once
            //   she has left it, going back does light it - by then it is a
            //   destination she has chosen rather than where she happened to
            //   be standing.
            //
            //   Anytime, always. "Only the card itself shows it's being
            //   moved." It is a big two-column block, and tinting the whole of
            //   it swamps the card.
            //
            // 'anytime' inline rather than the ANYTIME constant: a worklet
            // captures what it references when it is built, and a literal
            // cannot be got wrong.
            const hideIt =
              hit === 'anytime' || (hit === originKey.get() && !leftOrigin.get());
            runOnJS(setOver)(hideIt ? null : hit);
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

  // ONE STABLE GESTURE PER CARD **PER SECTION**. A plan on Monday and Thursday
  // is drawn twice, and the two copies are not interchangeable: each has to
  // know which section it was lifted from, or "never highlight the one it came
  // from" has nothing to compare against.
  const placements: string[] = [];
  for (const r of planned) {
    const on = sits(r);
    if (on.length === 0) placements.push(`${r.id}|${ANYTIME}`);
    else for (const d of on) placements.push(`${r.id}|${d}`);
  }
  const placementKey = placements.join(',');
  const gestures = useMemo(() => {
    const map = new Map<string, ReturnType<typeof makeGesture>>();
    for (const p of placementKey ? placementKey.split(',') : []) {
      const bar = p.indexOf('|');
      map.set(p, makeGesture(p.slice(0, bar), p.slice(bar + 1)));
    }
    return map;
    // The joined string is the identity of the set; the array itself is new
    // on every render.
  }, [placementKey, makeGesture]);

  /**
   * The preview follows her finger, placed inside the week's own box.
   *
   * ANCHORED BY ITS TOP-LEFT, not centred. Centring needs the preview's width,
   * and the preview is now sized by its contents so that it matches the card
   * it came from - a card with a long name is wider than one without. Sitting
   * just above and left of the finger keeps it out from under her hand, which
   * is the thing centring was really for.
   */
  const previewStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: fingerX.get() - rootAt.get().x - GRAB_X },
      { translateY: fingerY.get() - rootAt.get().y - GRAB_Y },
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

  // AN EMPTY WEEK STILL HAS TO HAVE A DOOR, and until now its only door was
  // chat. The seven days are not drawn when there are no rows, so there is no
  // "+" anywhere, so the text box added today was unreachable on a fresh
  // account - which is the one-door bug again, one commit after fixing it. The
  // card opens the same sheet, on today, and the sheet still offers chat.
  if (rows.length === 0) {
    return (
      <Pressable
        onPress={() => setAddingTo(todayKey)}
        accessibilityRole="button"
        accessibilityLabel={`${WEEK_EMPTY}. ${WEEK_EMPTY_BODY}`}
        style={({ pressed }) => pressed && styles.pressed}>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">{WEEK_EMPTY}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {WEEK_EMPTY_BODY}
          </ThemedText>
        </ThemedView>
        <AddToDaySheet
          dayKey={addingTo}
          date={addingTo ? days[DAY_KEYS.indexOf(addingTo)] : null}
          candidates={[]}
          onClose={() => setAddingTo(null)}
          onPick={() => setAddingTo(null)}
          onAdd={async (activity, timeOfDay) => {
            const key = addingTo;
            if (!key) return false;
            try {
              await addToWeek(activity, [key], timeOfDay);
            } catch {
              return false;
            }
            await load();
            onChanged?.();
            setAddingTo(null);
            return true;
          }}
          onNew={() => {
            setAddingTo(null);
            router.push({
              pathname: '/',
              params: { prefill: "I'd like to add something to my week.", askNow: '1' },
            });
          }}
        />
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
              // TWO STATES THAT MUST NOT LOOK ALIKE (Ruth, 29 September).
              //
              // Today and "the card will land here" were both a filled
              // backgroundSelected row with an accentDeep border, so on a
              // Tuesday the drop target and today were the same picture.
              //
              // The drop is now the only filled row on the screen, in the
              // terracotta wash, and today is a dot. A tint and a dot cannot
              // be confused with each other at any size or font scale, which
              // an outline and a slightly thicker outline could.
              type={over === key ? 'accentWash' : 'background'}
              // AN EMPTY DAY IS THINNER THAN A FULL ONE (Ruth, UI item 6:
              // "empty days currently consume too much space... the visual
              // emphasis should naturally fall on days containing activities").
              //
              // It keeps its label, its date and its "+", because an empty
              // Thursday is a real and useful fact about her week and a day she
              // can still drop onto. It just stops claiming the height of a day
              // with something in it. That difference IS the emphasis - no extra
              // weight had to be added to the busy days to get it.
              style={[
                styles.dayRow,
                items.length === 0 && styles.dayRowEmpty,
                over === key && { borderColor: theme.accentDeep },
              ]}>
              <View style={styles.dayLabel}>
                <View style={styles.dayName}>
                  {/* TODAY IS A DOT. Quieter than a filled row, and it says
                      the one thing today needs to say.
                      SAGE, NOT TERRACOTTA (Ruth, 1 October): "it reads like an
                      alarm at the moment". She is right, and the reason is that
                      terracotta is this app's ACTION colour - it is the "+", the
                      chevrons, the buttons - so a small filled terracotta circle
                      reads as something needing attention rather than as a
                      marker. Today needs no attention; it is just where she is.
                      Brand sage is the quiet member of the palette and carries
                      no instruction. */}
                  {isToday && (
                    <View style={[styles.todayDot, { backgroundColor: theme.sage }]} />
                  )}
                  {/* AND THE LABEL GOES BACK TO ORDINARY TEXT. With the dot no
                      longer shouting, an accentDeep day name was the louder half
                      of the pair and did the same job twice. */}
                  <ThemedText type="smallBold">{DAY_LABEL[key]}</ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {shortDate(date)}
                </ThemedText>
              </View>

              <View style={styles.pills}>
                {items.map((row) => (
                  <GestureDetector key={row.id} gesture={gestures.get(`${row.id}|${key}`)!}>
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

              {/* THE "+" SUPPORTS THE CONTENT, IT DOES NOT COMPETE WITH IT
                  (Ruth, UI item 10). Seven of these down a page, each in
                  full-strength terracotta at 20px, were the loudest marks on the
                  screen - and they are the least important thing on it.
                  Smaller, in secondary text rather than the accent, and at
                  reduced opacity. THE TOUCH TARGET IS UNCHANGED: hitSlop still
                  gives it 44pt, so it is quieter to look at and no harder to
                  hit, which is the only version of "quieter" worth having. */}
              <Pressable
                onPress={() => setAddingTo(key)}
                accessibilityRole="button"
                accessibilityLabel={`Add an activity to ${DAY_LABEL[key]} ${shortDate(date)}`}
                hitSlop={Spacing.three}
                style={({ pressed }) => [styles.addDay, pressed && styles.pressedStrong]}>
                <Ionicons name="add" size={16} color={theme.textSecondary} />
              </Pressable>
            </ThemedView>
          );
        })}

      {/* ---- anytime ---- */}
      {/* VISUALLY LIGHTER THAN THE SCHEDULED WEEK (Ruth, UI item 8). These are
          "flexible intentions rather than appointments", so the heading steps
          down from sectionTitle - which is the size the Plans segments use - to
          the same small uppercase label the goal block uses. Same family, less
          weight, and it stops competing with the seven days above it. */}
      {/* SENTENCE CASE IN THE SOURCE, uppercased by the stylesheet. A literal
          all-caps string is read out letter by letter by some screen readers;
          textTransform changes only what is drawn. */}
      <ThemedText type="small" themeColor="textSecondary" style={styles.anytimeHeading}>
        Anytime this week
      </ThemedText>
      <View
        ref={(node) => {
          zoneRefs.current[ANYTIME] = node;
        }}
        collapsable={false}
        // STILL A DROP TARGET, NEVER A HIGHLIGHT. Ruth: "Dropping into
        // Anytime: don't highlight the Anytime section. Only the card itself
        // shows it's being moved." The block is two columns deep, and tinting
        // all of it drowns the card she is carrying.
        style={styles.anytimeZone}>
        {anytime.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Everything has a day. Drag a card here to make it flexible.
          </ThemedText>
        ) : (
          <View style={styles.grid}>
            {anytime.map((row) => (
              <View key={row.id} style={styles.gridCell}>
                <GestureDetector gesture={gestures.get(`${row.id}|${ANYTIME}`)!}>
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

      {/* ---- walking ---- */}
      {/* ONE LINE, NOT A CARD (Ruth, UI item 7: "the Walking card is currently
          much larger than surrounding content... it should feel like another part
          of the week's rhythm rather than a separate feature").
          It had a filled background, two stacked lines and its own padding, which
          made the quietest thing in her week the biggest object on the screen.
          Now it reads as a line of the page: the name, then the step count.
          THE NUMBER IS STILL THE PHONE'S, and when there is none it says so
          rather than showing a zero - a zero is a claim that nobody moved. */}
      {walking && (
        <View style={styles.walkRow}>
          <ThemedText type="small">{walking.activity}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.walkSteps}>
            {steps == null ? 'no step count today' : `${formatSteps(steps)} steps today`}
          </ThemedText>
        </View>
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
          {/* IT IS THE CARD, LIFTED (Ruth: "should look like the card being
              moved ... not a grey pill").
              
              It was grey because it used backgroundSelected - the token for a
              selected tab - while every card on this screen is
              backgroundElement, the brand sand. One token wrong, and the thing
              under her finger looked like a different object from the thing
              she picked up.
              
              Same colour, same name, same second line, and a shadow doing the
              lifting. */}
          <ThemedView type="backgroundElement" style={[styles.previewCard, styles.lift]}>
            <ThemedText type="small" numberOfLines={1}>
              {carrying.activity}
            </ThemedText>
            {previewDetail(carrying, carryFrom) ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {previewDetail(carrying, carryFrom)}
              </ThemedText>
            ) : null}
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
        onAdd={async (activity, timeOfDay) => {
          const key = addingTo;
          if (!key) return false;
          try {
            await addToWeek(activity, [key], timeOfDay);
          } catch {
            return false;
          }
          // THE SHEET CLOSES ONLY ON A SUCCESS, and the week is reloaded before
          // it does, so the card she typed is already on the day behind it.
          await load();
          onChanged?.();
          setAddingTo(null);
          return true;
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
  const detail = pillDetail(row.time_of_day, row.duration);
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
      // SPOKEN IN HER OWN WORDS, not the normalised clock. A screen reader
      // saying "nineteen thirty" for a card she created by typing "7pm" is
      // correct and unrecognisable; the 24-hour column exists to be scanned by
      // eye, and there is nothing to scan when it is being read aloud.
      accessibilityLabel={`${row.activity}${row.time_of_day ? `, ${row.time_of_day}` : ''}${
        row.duration ? `, ${row.duration}` : ''
      }${logged ? ', logged' : ''}`}
      // TWO ROUTES, BOTH SPOKEN. A screen reader user cannot drag, so the hint
      // names the one they can use. See move-sheet.tsx.
      accessibilityHint="Opens the log sheet, which has Move to…"
      style={({ pressed }) => [pressed && styles.pressed, carrying && styles.lifted]}>
      <ThemedView type="backgroundElement" style={styles.pill}>
        {/* A QUIET TICK, AND NOTHING WHEN THERE IS NONE. The absence says
            nothing at all - not "missed", not "0 of 2". */}
        {logged && <Ionicons name="checkmark-circle" size={13} color={theme.accentDeep} />}
        {/* TWO LINES, AND THE SECOND ONE IS THE TIME (Ruth, UI item 5: "Gym /
            ~09:00 • 60 mins instead of multiple rows").
            THE TIME IS NORMALISED TO A 24-HOUR CLOCK and her own words are kept
            when there is no clock in them - "evening" shows as evening. The
            whole reason is scanability: a column of 19:30 and 09:00 can be read
            down a week, and "7pm / 9.30am / 14:00" cannot. See lib/day-time.ts;
            the database still holds exactly what she typed, and chat still
            speaks it back in her words. */}
        <View style={styles.pillText}>
          <ThemedText type="small" numberOfLines={1}>
            {row.activity}
          </ThemedText>
          {detail ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {detail}
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

/**
 * ADD TO A DAY - from what she already does, or by typing a new thing.
 *
 * THE TEXT FIELD IS WHY THIS SHEET CHANGED (Ruth, 1 October 2026): "I tap plus
 * and at the bottom of pre-existing activities I do, I can Text add." Before
 * today the only thing at the bottom was "Something else — tell chat", which
 * sent her to another tab to type a sentence so a model could extract a name
 * she had already decided on. For "French class" that is four screens and a
 * round trip to do what a text box does.
 *
 * CHAT STILL WORKS, AND STILL BELONGS. Her own words: "I can always discuss it
 * with chat if I want to." A conversation is where the purpose and the cadence
 * come from. So the link stays, demoted: the box is for when she knows what she
 * wants, chat is for when she wants to talk about it.
 */
function AddToDaySheet({
  dayKey,
  date,
  candidates,
  onClose,
  onPick,
  onAdd,
  onNew,
}: {
  dayKey: DayKey | null;
  date: Date | null;
  candidates: WeekRow[];
  onClose: () => void;
  onPick: (row: WeekRow) => void;
  onAdd: (activity: string, timeOfDay: string) => Promise<boolean>;
  onNew: () => void;
}) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [when, setWhen] = useState('');
  const [adding, setAdding] = useState(false);
  const [failed, setFailed] = useState(false);

  // THE SHEET STAYS OPEN ON A FAILURE AND KEEPS WHAT SHE TYPED. Closing it and
  // showing nothing is the shape the delete bug had this morning: she did the
  // thing, the thing did not happen, and the screen said so by saying nothing.
  async function submit() {
    if (adding || !name.trim()) return;
    setAdding(true);
    setFailed(false);
    const ok = await onAdd(name, when);
    setAdding(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    setName('');
    setWhen('');
  }

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
            // TWO DIFFERENT NOTHINGS. An empty week has nothing to offer yet;
            // a full day has everything on it already. Saying the second when
            // the first is true is a sentence about a week she does not have.
            <ThemedText type="small" themeColor="textSecondary">
              {candidates.length === 0
                ? 'Nothing in your week yet. Type the first thing below.'
                : 'Everything in your week is already on this day.'}
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
          {/* ---- something else, typed ---- */}
          <View style={[styles.addRule, { backgroundColor: theme.backgroundSelected }]} />
          <ThemedText type="small" themeColor="textSecondary">
            Something else
          </ThemedText>
          <TextInput
            value={name}
            onChangeText={(t) => {
              setName(t);
              setFailed(false);
            }}
            // HER OWN EXAMPLE AS THE PLACEHOLDER, and not an exercise, because
            // the whole point is that a week holds whatever takes the time.
            placeholder="French class"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="What is it"
            returnKeyType="next"
            style={[styles.addField, { color: theme.text, borderColor: theme.backgroundSelected }]}
          />
          <TextInput
            value={when}
            onChangeText={setWhen}
            // IN HER WORDS, NOT A TIME PICKER. "evening" and "after work" are
            // answers a picker cannot take, and the column is text.
            placeholder="When? 7pm, evening, after work (optional)"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="When in the day, optional"
            returnKeyType="done"
            onSubmitEditing={() => {
              if (name.trim() && !adding) void submit();
            }}
            style={[styles.addField, { color: theme.text, borderColor: theme.backgroundSelected }]}
          />
          {failed && (
            <ThemedText type="small" themeColor="textSecondary">
              That did not save. Worth trying again.
            </ThemedText>
          )}
          <Pressable
            onPress={() => void submit()}
            disabled={!name.trim() || adding}
            accessibilityRole="button"
            accessibilityLabel={`Add to ${DAY_LABEL[dayKey]}`}
            accessibilityState={{ disabled: !name.trim() || adding }}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView
              type="backgroundElement"
              style={[
                styles.addButton,
                { backgroundColor: theme.accentDeep },
                (!name.trim() || adding) && styles.addButtonOff,
              ]}>
              <ThemedText type="small" style={{ color: theme.background }}>
                {adding ? 'Adding…' : `Add to ${DAY_LABEL[dayKey]}`}
              </ThemedText>
            </ThemedView>
          </Pressable>
          <Pressable
            onPress={onNew}
            accessibilityRole="link"
            accessibilityLabel="Talk it through with chat instead"
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedText type="small" themeColor="accentDeep" style={styles.addNew}>
              Or talk it through with chat
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // THE DENSITY PASS (Ruth, 1 October, UI item 2: "the entire week should
  // ideally fit on one phone screen"). Spacing.two between seven day rows, a
  // heading, a section and a footer was ~64pt of pure gap. Spacing.one halves it
  // and the rows keep their own internal padding, so the page gets denser
  // without anything getting tighter to read.
  block: { gap: Spacing.one },
  card: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: CardRadius,
    gap: Spacing.one,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // Spacing.two between the label and the pills: enough to read as a column,
    // not enough to waste a quarter of the width on a phone.
    gap: Spacing.two,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    // SMALLER THAN CardRadius ON PURPOSE. A 20pt radius on a 40pt-tall row is
    // almost a stadium, and seven stadiums down a page read as seven buttons.
    // These are lines of a diary, so the corner is barely there.
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    // ONE FLOOR, DOWN FROM 52. It keeps the seven days an even column when some
    // are empty and some are not, which is what lets the week be read as a
    // shape. 44 is a 34pt pill plus the row's own padding - the old 52 was
    // commented as "room for two pills", which it never was: two pills and
    // their gap come to 72 and have always wrapped.
    minHeight: 44,
  },
  // Fixed so every day's activities start at the same x, which is what makes
  // the column read as a week rather than as seven unrelated rows.
  // AN EMPTY DAY GIVES UP ITS HEIGHT, not its place. Item 6: the emphasis
  // falls on the days with something in them, and it falls there because the
  // empty ones stopped claiming the same room - nothing was added to the busy
  // ones to achieve it.
  dayRowEmpty: { minHeight: 30, paddingVertical: 0 },
  dayLabel: { width: 54 },
  dayName: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  // Small, because it marks a day rather than announcing one.
  todayDot: { width: 6, height: 6, borderRadius: 3 },
  pills: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    // Item 5: a shorter card. The name and the time are two short lines, and
    // Spacing.two above and below them was making a block out of a label.
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: 12,
    // So a pill on a day and the same pill carried under her finger are the
    // same object. Without a floor a one-line pill is visibly shorter than a
    // two-line one and the row wobbles as times get added.
    minHeight: 34,
  },
  // Wraps rather than pushing the pill past the edge when an activity has a
  // long name and a long time. Both lines are numberOfLines={1}.
  pillText: { flexShrink: 1 },
  anytimeHeading: {
    marginTop: Spacing.two,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
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
  // from if she changes her mind. The LIFT is on the preview under her finger,
  // which is the card that is actually moving.
  lifted: { opacity: 0.3 },
  preview: {
    position: 'absolute',
    top: 0,
    left: 0,
    // No width or height: it is the size of the card it is carrying.
    alignSelf: 'flex-start',
    zIndex: 50,
  },
  // THE SAME LIFT THE LOG'S RE-ORDER USES - #2D2B28 at 0.16, offset 6,
  // radius 12, elevation 6 (reorderable-rows.tsx). Two drags in one app that
  // lift by different amounts read as two different apps.
  lift: {
    shadowColor: '#2D2B28',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 6,
    transform: [{ scale: 1.02 }],
  },
  previewCard: {
    borderRadius: CardRadius,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    gap: Spacing.one,
    // Wide enough not to read as a chip, narrow enough not to cover the week.
    minWidth: 96,
    maxWidth: 220,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  // Two columns. Percentage rather than a measured width so it survives a
  // rotation and a bigger font without measuring anything.
  gridCell: { width: '48.5%' },
  gridCard: {
    // LIGHTER THAN A SCHEDULED DAY (item 8). These are intentions, not
    // appointments, so they lost half their height and their big radius - a
    // 64pt card with a 20pt corner was heavier than anything in the week above.
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: 12,
    gap: 2,
    minHeight: 40,
    justifyContent: 'center',
  },
  gridCardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  gridCardName: { flexShrink: 1 },
  // A LINE, NOT A CARD (item 7). No fill, no radius, no padding of its own -
  // the name on the left and the step count on the right, sitting in the page's
  // own rhythm like a row of a diary.
  walkRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    marginTop: Spacing.one,
  },
  walkSteps: { flexShrink: 1, textAlign: 'right' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.two,
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
  addNew: { marginTop: Spacing.two, textAlign: 'center' },
  addRule: { height: 1, marginTop: Spacing.two },
  addField: {
    borderWidth: 1,
    borderRadius: CardRadius,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    // THE TOUCH TARGET, NOT THE TEXT SIZE. A 44pt minimum on a field somebody
    // is typing a class name into with one hand.
    minHeight: 44,
  },
  addButton: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: CardRadius },
  addButtonOff: { opacity: 0.4 },
  // THE "+" AT REST (item 10). Quiet enough to sit under the content, and the
  // hitSlop on the Pressable keeps the target at 44pt.
  addDay: { opacity: 0.5 },
  // A QUIET CONTROL NEEDS A LOUDER PRESS. Dropping an already-50% mark to 0.7
  // of its opacity is a change nobody can see, so the "+" confirms a tap by
  // going the other way - briefly full strength.
  pressedStrong: { opacity: 1 },
  pressed: { opacity: 0.7 },
});
