import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, type Href } from 'expo-router';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { BodyModes } from '@/components/body-modes';
import { HydrationCard, type WaterAction } from '@/components/hydration-card';
import { SpotlightTarget } from '@/components/spotlight-target';
import { ThemedText } from '@/components/themed-text';
import { DisplayFont, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { resolveTDEE } from '@/lib/body-metrics';
import { withoutDailySummaries } from '@/lib/daily-summary-rows';
import { calculateCalorieTarget, type FocusState } from '@/lib/calorie-target';
import { hydrationToday } from '@/lib/hydration';
import { hydrationGoal } from '@/lib/hydration-goal';
import { formatLogDate, toLocalDateKey } from '@/lib/week';
import {
  findWeekAgoReading,
  formatWeeklyDelta,
  gapDays,
  weeklyDelta,
  type MeasurementRow,
} from '@/lib/overview-metrics';
import { PERSONAL_LINE_DAY_ONE, pickDailyPersonalLine } from '@/lib/personal-line';
import { calculateProteinTarget, proteinTargetLabel } from '@/lib/protein';
import { formatSteps, syncTodaySteps } from '@/lib/steps';
import { readSnapshot, saveSnapshot } from '@/lib/snapshot';
import { hidesCycleDay, type LifeStage } from '@/lib/life-stage';
import { plannedTodayLine } from '@/lib/reminders';
import { supabase } from '@/lib/supabase';

// The Body tab's landing screen (rewritten 2026-09-03).
//
// Three sections, each headed by a tappable heading that IS the way into that
// section's detail. The heading does two jobs on purpose: a separate "see more"
// control would be a second thing to explain, and a heading that navigates is
// the pattern every settings screen on the phone already uses.
//
// NUMBERS, NOT BARS. The previous version drew calorie, protein and water as
// target-vs-current bars. A bar states a target as a thing to fill, and a
// half-empty one reads as a failure at a glance in a way "1,450" does not. The
// figures are the same; what has gone is the judgement drawn around them.
//
// IT CAN SCROLL, BUT NOTHING HERE SHOULD NEED IT. The no-scroll rule was
// retired on 16 September so "What you burn" could live here at all (see
// today/index.tsx for that reasoning), and the budget immediately stopped being
// enforced by anything: the screen simply grew and the flower went below the
// fold, which is what Ruth reported on 25 September. The rule that replaces it
// is softer and has to be kept by hand - everything down to and including the
// flower fits above the fold on a 360x800 phone, and anything that will not
// belongs in a detail screen.

// WHAT CAME OFF THIS SCREEN, AND WHAT DID NOT (Ruth, 25 September 2026: "The
// whole thing feels too big for the screen as health flower is cut off").
//
// The greeting was the cause, not the flower - see the greeting style below.
// Fixing it, dropping the Activity square and putting steps on the "This week"
// line gave back about 130 points, which is room for the flower and for exactly
// ONE of the two small things that used to sit under it. She was shown both and
// chose the daily line:
//
//   kept  "Understanding yourself is a lifelong practice." - the one warm
//         sentence on the screen, and the app's own voice
//   gone  "What you burn", which is a reference panel behind a chevron and now
//         lives on the Body screen, one tap from the Body square above
//
// The alternative is recorded because it was close: keeping the burn panel here
// meant the flower at 172 and six points of clearance over the tab bar, which
// is not clearance at all on a shorter phone.

type Metric = { value: number | null; delta: string | null };
type OverviewData = {
  hasMeasurement: boolean;
  // When the newest of the three body figures was taken. Null when there are no
  // readings at all. The three can come from different days, so this is the
  // latest of them rather than a date that is true of all three.
  bodyAsOf: string | null;
  personalLine: string;
  weight: Metric;
  muscle: Metric;
  // Only present with a bioimpedance reading behind it. Null means "this scale
  // does not measure that", which is a different thing from zero, and the
  // difference is the whole reason the figure is omitted rather than shown as a
  // dash: a 0% body fat reading would be alarming nonsense.
  bodyFat: Metric;
  todayKcal: number;
  todayProtein: number;
  calorieTargetKcal: number | null;
  proteinTargetLabel: string | null;
  /** 'held' means her training is paused, which Today says out loud. */
  proteinStepped: 'up' | 'held' | 'plain' | null;
  // WHY there is no calorie figure, when there is none. Null when there is
  // one, or when the reason is something this row cannot help with.
  /**
   * Why there is no calorie target, when the reason is one she can fix from
   * Today. Two of them now: she has not said what she is working towards, or
   * there is no weight to work from. Each gets its own sentence, because
   * "say what you are working towards" is useless advice to somebody whose
   * goal is set and whose weight is missing.
   */
  calorieTargetBlockedBy: 'focus-unset' | 'weight-unknown' | null;
  activityCount: number;
  activityMinutes: number;
  // The NAMES of today's sessions, for the Movement row (Ruth, item 7:
  // "7,414 · Run · Ballet"). Sessions only - a tracker's whole-day summary is
  // not something somebody did, it is a day added up, and listing it beside a
  // run would be the app inventing an activity.
  activityNames: string[];
  // Today's steps from the phone's own health platform, or null when it has no
  // answer - a refusal, a phone without one, or a genuinely quiet morning that
  // cannot be told apart from either. Null renders nothing; it is never a zero,
  // because a zero is a claim that somebody has not moved.
  steps: number | null;
  hydrationMl: number;
  // Days since the last recorded period start, 1-based, or null when no cycle
  // has ever been logged. Read, never inferred: a cycle day guessed from an
  // average would be a number about somebody's body that nobody measured.
  cycleDay: number | null;
  // "On the plan: gym", or null. Guide me only, planned days only.
  plannedLine: string | null;
};

type ProfileRow = {
  height_cm: number | null;
  date_of_birth: string | null;
  biological_sex: string | null;
  activity_level: string | null;
  fat_focus_state: string | null;
  muscle_focus_state: string | null;
  has_scales: boolean | null;
  protein_target_g: number | null;
  training_state: string | null;
  deficit_state: string | null;
  first_name: string | null;
  guidance_mode: string | null;
  // Read so the cycle day can be suppressed for anybody who is not on a regular
  // cycle. See cycleDayFrom.
  life_stage: string | null;
};

const round1 = (n: number): number => Math.round(n * 10) / 10;
// Null means not stated, and not stated means no target - NOT maintenance.
// See app/lib/daily-targets.ts for why this used to be the other way round and
// what it cost. Third of the three places the old default lived.
const asFocus = (s: string | null): FocusState | null =>
  s === 'reduce' || s === 'increase' || s === 'maintain' ? s : null;

// "Thursday 17 September", never 2026-09-17. Built by hand rather than through
// toLocaleDateString for the same reason week.ts is: Hermes on Android ships a
// variable ICU build, so the same call can return a different string on a
// different phone, and this one is read every morning.
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function todayLabel(now: Date = new Date()): string {
  return `${WEEKDAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`;
}

// Morning, afternoon or evening, from the phone's own clock. No name unless one
// is stored: a greeting that guesses somebody's name is worse than one without.
//
// TWO LINES, DELIBERATELY (Ruth, 2026-09-18): "Good morning," then "Ruth". Her
// brief: "the two-line composition gives the page presence and creates a
// stronger editorial rhythm", and it is why the leading is set tighter than the
// font size - two lines that belong to each other rather than two sentences.
// With no name there is one line, and nothing is padded out to fake the second.
function greeting(name: string | null, now: Date = new Date()): string {
  const h = now.getHours();
  const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return name ? `${part},\n${name}` : part;
}

// Day 1 is the day the period started, which is how a cycle is counted and how
// she would say it out loud. Anything older than a long cycle is not shown at
// all rather than counted up forever: "Day 96" says the log stopped, not where
// she is.
//
// VERIFIED AND CAPPED AT 45 (Ruth, 26 September 2026). She asked whether this
// counts from the last logged period start or from the start of the WEEK,
// having seen "Day 6" on Friday the 25th and Saturday the 26th, where it
// happened to match the weekday. It counts from the period start - the row it
// reads is cycle_events with event_type 'period_start', most recent first - so
// the number was right and the match was a coincidence. What was wrong is that
// nothing SAID so, which is item 5a's real point: an unlabelled number beside a
// date reads as part of the date.
//
// The ceiling comes down from 60 to 45, her figure. Past that the last logged
// start is too old to mean anything, and a number that is probably wrong is
// worse than no number.
export function cycleDayFrom(lastStart: string | null, stage?: LifeStage | null): number | null {
  // HER LIFE STAGE OVERRULES THE ARITHMETIC (2026-09-28).
  //
  // The 45-day ceiling below is what protects a woman who has simply stopped
  // logging. It does nothing for the woman who told us where she is: somebody
  // post-menopause, or with a coil, can still have a period start from five
  // weeks ago on file, and "Cycle day 34" beside her date is the app telling
  // her something it has been explicitly told is not true.
  //
  // Only a regular cycle gets a cycle day. Everything else - including "not
  // sure" and "prefer not to say" - gets silence, which is the honest answer
  // when the app does not know.
  if (hidesCycleDay(stage ?? null)) return null;
  if (!lastStart) return null;
  const start = new Date(`${lastStart}T00:00:00`);
  if (isNaN(start.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = Math.round((today.getTime() - start.getTime()) / 86_400_000) + 1;
  return day >= 1 && day <= MAX_CYCLE_DAY ? day : null;
}

/** Past this, the last logged start is too old to count from. Her figure. */
const MAX_CYCLE_DAY = 45;

function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// The floating Undo note lives on the screen, outside its scroll view, so it can
// sit above the bottom navigation (see today/index.tsx). The panel reports each
// drink added, and is told when one was undone so its total goes back.
export function OverviewPanel({
  onWaterAdded,
  onWaterRemoved,
  waterUndone,
}: {
  onWaterAdded?: (action: WaterAction) => void;
  onWaterRemoved?: (id: string) => void;
  waterUndone?: { ml: number; id: string } | null;
} = {}) {
  // SPACING THAT SCALES WITH THE SCREEN (Ruth, item 4: "Spacing should scale
  // with screen height, so this also looks balanced on shorter phones"). Fixed
  // numbers tuned on one handset are exactly how a screen ends up top-heavy on
  // another, which is the fault being fixed. Clamped at both ends so a very
  // small phone keeps a usable gap and a tablet does not open a chasm.
  const { height: screenHeight } = useWindowDimensions();
  const topGap = Math.max(16, Math.min(48, Math.round(screenHeight * 0.035)));
  const blockGap = Math.max(12, Math.min(40, Math.round(screenHeight * 0.025)));

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OverviewData | null>(null);

  // WHAT IT SHOWED LAST TIME, WHILE THE REAL READ HAPPENS (2026-09-20). Today
  // is the screen she opens most and the one with the most to gather, so it
  // was the one that sat empty longest. The snapshot paints in a frame; the
  // read below replaces it a moment later, and the figures only ever move if
  // something actually changed. Half an hour old at most: a day's totals do
  // not go stale inside that, and anything older is not worth showing.
  useEffect(() => {
    let cancelled = false;
    void readSnapshot<OverviewData>('today', 30 * 60_000).then((snap) => {
      // Never over the top of a real read that has already landed.
      if (!cancelled && snap) setData((current) => current ?? snap);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // An undo from the floating note: the total goes back as though the tap never
  // happened. Keyed by the drink's id so the same undo is applied once, however often
  // this renders.
  const appliedUndo = useRef<string | null>(null);
  useEffect(() => {
    if (!waterUndone || appliedUndo.current === waterUndone.id) return;
    appliedUndo.current = waterUndone.id;
    setData((d) => (d ? { ...d, hydrationMl: Math.max(0, d.hydrationMl - waterUndone.ml) } : d));
  }, [waterUndone]);
  const [name, setName] = useState<string | null>(null);

  // Refetches on FOCUS, not only on mount. Overview is the root of the Body
  // stack, so it stays mounted while Food, Measurements and Activity are pushed
  // on top of it and popped back off. A mount-only fetch therefore reported
  // whatever was true when the tab was first opened: a meal logged afterwards
  // showed up on the Food screen, which is pushed fresh every visit and reloads
  // itself after its own quick-log bar, while Overview went on saying zero.
  //
  // `loading` is never set back to true here. It guards the first paint only;
  // flipping it on every return would blink the whole screen away for a refresh
  // that usually changes one number.
  /**
   * Bumped when something on this screen changes a figure behind the panel's
   * back. The switches are the only such thing today - see BodyModes.
   */
  const [reloadKey, setReloadKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
      const dayStart = startOfToday();

      // RLS scopes every read to the signed-in user.
      // syncTodaySteps joins the batch rather than following it: it reads the
      // phone's health platform, which is slower than any of these queries and
      // depends on none of them. It also WRITES the day's total on the way
      // through, so the figure survives into the roundups and the Activity
      // screen rather than existing only for as long as this screen is open.
      const [
        { data: measurements },
        { data: profileRow },
        { data: foods },
        { data: activity },
        { data: drinks },
        stepsToday,
        { data: lastPeriod },
        { data: weekRows },
      ] = await Promise.all([
          supabase
            .from('body_measurements')
            .select('measured_at, weight_kg, body_fat_pct, muscle_kg, bmr')
            .order('measured_at', { ascending: false })
            .limit(30),
          supabase
            .from('user_profile')
            .select(
              'height_cm, date_of_birth, biological_sex, activity_level, fat_focus_state, muscle_focus_state, has_scales, protein_target_g, first_name, life_stage, guidance_mode, training_state, deficit_state'
            )
            .maybeSingle(),
          supabase.from('food_logs').select('kcal, protein_g').gte('happened_at', dayStart),
          supabase
            .from('activity_logs')
            // activity_type and source are not displayed here - they are read
            // only to exclude whole-day tracker totals, whose "active minutes"
            // are a day of incidental movement rather than time spent training.
            .select('duration_min, activity_type, source')
            .gte('happened_at', dayStart),
          supabase.from('hydration_logs').select('ml, happened_at').gte('happened_at', dayStart),
          syncTodaySteps(),
          // Cycle day for the Today screen (UI brief, Part 1). One row, the most
          // recent period start; nothing is written and nothing is predicted.
          supabase
            .from('cycle_events')
            .select('event_date')
            .eq('event_type', 'period_start')
            .order('event_date', { ascending: false })
            .limit(1)
            .maybeSingle(),
          // THE WEEK, only so today's planned line can be built. Days are set
          // in Guide me and are empty for everybody else, so for most people
          // this returns rows whose `days` array is empty and the line is null.
          supabase.from('user_week').select('activity, days').order('sort_order', { ascending: true }),
        ]);

      const rows = (measurements ?? []) as MeasurementRow[];
      const latest = rows[0] ?? null;

      // THE LAST KNOWN VALUE FOR EACH FIELD, NOT THE LAST ROW'S (2026-09-04).
      //
      // Rows are ordered newest first, and a row can carry one reading without
      // the others: a scale that only weighs writes weight_kg and leaves body
      // fat null. Reading all three off rows[0] therefore showed dashes for
      // numbers the app already had - Ruth's 3 Sept row has a body fat and no
      // weight, so the card said "-" while 55 kg sat one row down.
      //
      // Each field now finds its own most recent non-null value. The
      // consequence, and it is a real one: the three figures can come from
      // different days, which is why the date beneath is the date of the
      // NEWEST of them and is labelled as the latest reading rather than as
      // the date of all three.
      const lastWith = <K extends keyof MeasurementRow>(key: K) =>
        rows.find((r) => r[key] != null) ?? null;
      const wRow = lastWith('weight_kg');
      const mRow = lastWith('muscle_kg');
      const fRow = lastWith('body_fat_pct');
      const bodyAsOf = [wRow, mRow, fRow]
        .filter((r): r is MeasurementRow => r != null)
        .map((r) => r.measured_at)
        .sort()
        .pop() ?? null;
      const weekAgo = latest ? findWeekAgoReading(rows, latest.measured_at) : null;
      const refGap = latest && weekAgo ? gapDays(latest.measured_at, weekAgo.measured_at) : null;

      const profile = (profileRow ?? null) as ProfileRow | null;
      const todayKcal = (foods ?? []).reduce((n, f) => n + ((f as { kcal: number | null }).kcal ?? 0), 0);
      const todayProtein = (foods ?? []).reduce(
        (n, f) => n + ((f as { protein_g: number | null }).protein_g ?? 0),
        0
      );

      // Sessions only. A daily summary's "active minutes" is a whole day of
      // walking about added up, so counting it here would tell someone they had
      // trained for 42 minutes on a day they did no training at all.
      const acts = withoutDailySummaries(
        (activity ?? []) as { duration_min: number | null; activity_type: string | null; source: string | null }[]
      );

      // The day-one line belongs to someone with nothing logged AT ALL, not to
      // someone who simply has not weighed. Today's rows cannot answer that, so
      // it takes its own look back over everything.
      let isTrueDayOne = false;
      if (!latest) {
        const [{ data: anyFood }, { data: anyActivity }] = await Promise.all([
          supabase.from('food_logs').select('id').limit(1),
          supabase.from('activity_logs').select('id').limit(1),
        ]);
        isTrueDayOne = !(anyFood && anyFood.length) && !(anyActivity && anyActivity.length);
      }
      const tdee = resolveTDEE({
        scaleBmr: latest?.bmr ?? null,
        weightKg: latest?.weight_kg ?? null,
        heightCm: profile?.height_cm ?? null,
        dateOfBirth: profile?.date_of_birth ?? null,
        biologicalSex: profile?.biological_sex ?? null,
        activityLevel: profile?.activity_level ?? null,
      });
      const calorieTarget = calculateCalorieTarget({
        tdeeKcal: tdee?.tdeeKcal ?? null,
        weightKg: latest?.weight_kg ?? null,
        fatFocus: asFocus(profile?.fat_focus_state ?? null),
        muscleFocus: asFocus(profile?.muscle_focus_state ?? null),
        training: (profile?.training_state as never) ?? null,
        deficitState: (profile?.deficit_state as never) ?? null,
      });
      // Lean mass from body fat percentage, not from the scale's muscle field.
      // HER GOAL IS PART OF THE SUM, and this is where Ruth saw it missing: Today
      // read 82-98 g while the goals screen read 101-123 g, one minute apart, on
      // the same body. This call had her body fat and not her goal; that one had
      // her goal and not her body fat. Both now ask the same question.
      const proteinTarget = calculateProteinTarget({
        manualG: profile?.protein_target_g ?? null,
        weightKg: latest?.weight_kg ?? null,
        bodyFatPct: latest?.body_fat_pct ?? null,
        muscleFocus: asFocus(profile?.muscle_focus_state ?? null),
        training: (profile?.training_state as never) ?? null,
      });

      if (cancelled) return;
      const next: OverviewData = {
        hasMeasurement: latest != null,
        personalLine: isTrueDayOne ? PERSONAL_LINE_DAY_ONE : pickDailyPersonalLine(),
        bodyAsOf,
        weight: {
          value: wRow?.weight_kg ?? null,
          delta: formatWeeklyDelta(weeklyDelta(wRow?.weight_kg ?? null, weekAgo?.weight_kg ?? null), refGap),
        },
        muscle: {
          value: mRow?.muscle_kg ?? null,
          delta: formatWeeklyDelta(weeklyDelta(mRow?.muscle_kg ?? null, weekAgo?.muscle_kg ?? null), refGap),
        },
        bodyFat: {
          value: fRow?.body_fat_pct ?? null,
          delta: formatWeeklyDelta(
            weeklyDelta(fRow?.body_fat_pct ?? null, weekAgo?.body_fat_pct ?? null),
            refGap
          ),
        },
        todayKcal,
        todayProtein,
        calorieTargetKcal: calorieTarget?.targetKcal ?? null,
        // AN UNCHOSEN FOCUS IS THE ONE MISSING INPUT SHE CAN ACTUALLY FIX.
        // calculateCalorieTarget returns null for several reasons - no TDEE,
        // no weight, a pregnancy hold - and only this one has an answer that
        // belongs on Today. The others are not her job to solve from here.
        // FOCUS FIRST, THEN WEIGHT, because that is the order she can act in:
        // a weight with no goal still produces no target, so asking for the
        // weight first would be asking for something that changes nothing yet.
        calorieTargetBlockedBy:
          calorieTarget != null
            ? null
            : profile?.fat_focus_state == null && profile?.muscle_focus_state == null
              ? 'focus-unset'
              : latest?.weight_kg == null || latest.weight_kg <= 0
                ? 'weight-unknown'
                : null,
        proteinTargetLabel: proteinTargetLabel(proteinTarget),
        proteinStepped: proteinTarget?.kind === 'range' ? proteinTarget.stepped : null,
        activityCount: acts.length,
        activityMinutes: acts.reduce((n, a) => n + (a.duration_min ?? 0), 0),
        // Sentence case, de-duplicated, in the order they were logged. Two
        // runs in a day is one word on this row: the row says WHAT she did,
        // and the Movement log says how many and how long.
        activityNames: [
          ...new Set(
            acts
              .map((a) => (a.activity_type ?? '').trim())
              .filter(Boolean)
              .map((n) => n.charAt(0).toUpperCase() + n.slice(1))
          ),
        ],
        steps: stepsToday,
        hydrationMl: hydrationToday((drinks ?? []) as { ml: number; happened_at: string }[]).ml,
        cycleDay: cycleDayFrom(
          (lastPeriod as { event_date: string } | null)?.event_date ?? null,
          (profile?.life_stage ?? null) as LifeStage | null
        ),
        plannedLine: plannedTodayLine(
          (weekRows ?? []) as { activity: string; days: string[] }[],
          profile?.guidance_mode ?? null
        ),
      };
      setData(next);
      // Kept for the next opening, so the screen starts full rather than empty.
      void saveSnapshot('today', next);
      // The stored name, and nothing else. It is asked for at sign-up and left
      // null when somebody would rather not give one; the greeting then simply
      // has no name in it.
      setName(profile?.first_name?.trim() || null);
      setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [reloadKey])
  );

  if (loading || !data) {
    return (
      <View style={styles.screen}>
        {/* The same header as the loaded screen, so nothing moves or changes
            size when the data arrives. */}
        <View style={styles.header}>
          <ThemedText type="display" style={styles.greeting}>{greeting(name)}</ThemedText>
          <View style={styles.dateRow}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.dateText}>
              {todayLabel()}
            </ThemedText>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* THE SCREEN GREETS, IT DOES NOT LABEL ITSELF (UI brief, 2026-09-17).
          "Overview" over an overview was a label on a page that explains itself;
          the brief asks for "Good morning, Ruth" with the date, in serif, and
          the tab beneath already says which screen this is. The date is written
          out in full because it is the only place in the app that says which day
          the numbers below belong to.

          The focus line sits under the greeting with no rule beside it and no
          card around it. It is a quiet observation, not a notice: the border it
          used to carry made it look like something the app wanted her to act
          on. */}
      {/* The More mark is NOT drawn here any more. It belongs to the screen,
          not to this panel - see today/index.tsx, and settings-link.tsx for
          why (Ruth, 25 September 2026: it "must sit at the same fixed vertical
          position on every screen"). Drawn inside this panel it was inside the
          scroller, and inside a container already carrying the page margin,
          which put it 64 points from the edge of the screen instead of 32. */}
      <View style={[styles.header, { marginTop: topGap }]}>
        <ThemedText type="display" style={styles.greeting}>{greeting(name)}</ThemedText>
        <View style={styles.dateRow}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.dateText}>
            {todayLabel()}
            {data.cycleDay != null ? `  ·  Cycle day ${data.cycleDay}` : ''}
          </ThemedText>
        </View>
        {/* GUIDE ME, AND ONLY ON A DAY THAT HAS SOMETHING IN IT.
            Ruth's brief: 'Guide me shows one line on Today ("On the plan:
            gym"), only on planned days.'

            A LINE, NOT A PROMPT, AND NEVER A TICK. It states what is in her
            week today and offers no way to mark it done, because Today is not
            where anything is marked done and My Week has no completion at all.
            Somebody who does not do it finds the line gone tomorrow and nothing
            else changed - no carry-over, no count, no note that it did not
            happen. */}
        {data.plannedLine ? (
          <ThemedText type="small" themeColor="accentDeep">
            {data.plannedLine}
          </ThemedText>
        ) : null}
      </View>

      {/* The daily line is NOT here any more - see the foot of this screen
          (Ruth, item 9). It reads as a closing thought rather than a subtitle,
          which is what it always was. */}

      {/* THE CARDS BECAME A LINE OF FIGURES (Ruth, 25 September 2026: "I'd
          happily remove 20% of the content ... Apple don't fill screens.
          Neither should Selodia").

          WHY THESE TWO AND NOT SOMETHING ELSE. Food and Body are the only
          things on Today that are also one tap away in the tab bar - Log ->
          Food and drink, Log -> Measurements. The Health Flower and the water
          strip exist nowhere else in the app, so they are the two that had to
          keep their room. Nothing has been taken away from the screen: every
          figure that was in the two squares is still on it, and still goes to
          the same place when tapped.

          WHAT WENT IS THE CHROME. Two filled tiles with their own headings,
          chevrons and padding spent about 108 points drawing boxes around
          figures that read perfectly well as a line under a serif date. That
          is the twenty per cent, and it bought the air above and the sentence
          under the wheel.

          The figures keep their spotlight ids, so the guided tour still has
          somewhere to point. */}
      <View style={styles.figures}>
        {/* Straight to the view, not to the Log's list (2026-09-20): tapping
            Food on Today means "show me my food", and a list in between would
            be a step that answers nothing. */}
        <FigureRow id="body.food" label="Food" href="/log/food-history">
          {data.todayKcal === 0 && data.todayProtein === 0 ? (
            /* One line rather than two zeros stacked. Nothing was logged, and
               two separate noughts make more of that than it deserves. */
            <ThemedText type="small" themeColor="textSecondary">
              0 kcal · 0g
            </ThemedText>
          ) : (
            <>
              <SpotlightTarget id="overview.calories">
                <Stat value={String(Math.round(data.todayKcal))} unit="kcal" />
              </SpotlightTarget>
              <SpotlightTarget id="overview.protein">
                <Piece>
                  <Stat value={`${Math.round(data.todayProtein)}g`} unit="protein" />
                </Piece>
              </SpotlightTarget>
            </>
          )}
        </FigureRow>

        {/* THE TARGET, SAID OUT LOUD AT LAST (2026-09-28).
            `calorieTargetKcal` and `proteinTargetLabel` have been computed here
            and put into `data` since 2026-08-15, and rendered nowhere at all.
            The app has known what somebody's target was for six weeks and never
            told her.

            STATED, NOT COUNTED. What she ate is on the row above; what she is
            aiming at is here. No remaining figure, no percentage, no bar,
            nothing that can read as behind. Goals are welcome and shame is not,
            and a number counting down is how shame gets in. */}
        {/* NO CALORIE TARGET, AND THE REASON SAID OUT LOUD (Ruth, 1 October
            2026). Her Today showed "81-97g protein" and no calorie figure, with
            nothing to explain the gap.

            IT WAS NOT TONIGHT'S REDO. The migration of 28 September dropped the
            NOT NULL DEFAULT 'maintain' on the focus columns on purpose - "a goal
            nobody chose stops becoming a target" - and backed the old values up.
            Everyone's focus became unset that day and nothing has set hers
            since, so the calorie target has been missing for three days.
            calculateCalorieTarget returns null without it, by design.

            THE DESIGN IS RIGHT AND THE SILENCE IS NOT. Not inventing a target
            from a default she never chose is the whole point of that migration;
            showing her nothing at all, with a goal set and no way to tell why, is
            a different thing. Restoring the backed-up 'maintain' would undo the
            migration rather than answer her.

            NO NUMBER IS INVENTED HERE. It says what is missing and offers the
            screen that asks her. */}
        {/* ONE TAP, AND IT SAYS WHICH THING IS MISSING. Both routes open the
            goals screen, which is where the goal AND the weight are asked.

            NO EM DASH. Ruth, finding 3 of 1 October and again in item 5
            today: screen copy does not use them. The sentence read "No
            calorie target yet - say what you are working towards" with an em
            dash, which she asked to have removed twice. It is now two
            sentences, which is what the dash was standing in for. */}
        {data.calorieTargetKcal == null && data.calorieTargetBlockedBy !== null ? (
          <Pressable
            onPress={() => router.push({ pathname: '/onboarding/goals', params: { redo: '1' } })}
            accessibilityRole="button"
            accessibilityLabel={
              data.calorieTargetBlockedBy === 'weight-unknown'
                ? 'Add your weight, to get a calorie target'
                : 'Choose what you are working towards, to get a calorie target'
            }
            style={({ pressed }) => pressed && styles.pressed}
          >
            <ThemedText type="small" themeColor="textSecondary" style={styles.targetLine}>
              {data.proteinTargetLabel ? `${data.proteinTargetLabel}g protein. ` : ''}
              <ThemedText type="small" themeColor="accentDeep">
                {data.calorieTargetBlockedBy === 'weight-unknown'
                  ? 'Add your weight to see your targets.'
                  : 'No calorie target yet. Say what you are working towards.'}
              </ThemedText>
            </ThemedText>
          </Pressable>
        ) : data.calorieTargetKcal != null || data.proteinTargetLabel ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.targetLine}>
            {[
              data.calorieTargetKcal != null ? `Aiming for ${data.calorieTargetKcal} kcal` : null,
              // THE UNIT IS ADDED HERE, not in proteinTargetLabel. That
              // function returns a bare range ("83-99") because it was written
              // for a caller that supplied its own unit - and then never had
              // one, because nothing rendered it for six weeks. The first
              // screenshot of this line read "Aiming for 1760 kcal · 83-99",
              // which is how the omission finally became visible.
              data.proteinTargetLabel ? `${data.proteinTargetLabel}g protein` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            {/* SAID ONLY WHILE IT IS TRUE (2026-10-02).

                Ruth: "Flag when the user isn't currently training (injury,
                pause, etc.) and show a lower maintenance protein range instead,
                with a note that it steps up once training resumes."

                ONLY ON THE PAUSED SIDE. The matching assumption - that she IS
                training - is named on the goals screen where the figures are
                worked out, and on the Body Manual row where she can change it.
                Printing it here every day as well would make her daily screen
                carry a permanent caveat about a number that is right, which is
                how a disclaimer stops being read. */}
            {data.proteinStepped === 'held'
              ? '\nThe maintenance range, while your training is paused.'
              : ''}
          </ThemedText>
        ) : (
          /* NO TARGET IS NOT AN ERROR, and this line is not a nag.
             Until today an unset focus silently became 'maintain' and she was
             shown a maintenance target nobody had chosen. Now it shows nothing,
             and offers a way to change that - once, quietly, and only here. */
          <Pressable
            onPress={() => router.push('/')}
            accessibilityRole="link"
            accessibilityLabel="Add a goal to see targets, opens chat"
            style={({ pressed }) => [styles.targetLine, pressed && styles.pressed]}>
            <ThemedText type="small" themeColor="accentDeep">
              Add a goal to see targets
            </ThemedText>
          </Pressable>
        )}

        <Hairline />

        {/* ALL THREE ALWAYS SHOW, dashed where the latest reading did not carry
            that value (2026-09-04, Ruth's call).

            This reverses an earlier decision, and the earlier reasoning is kept
            visible rather than deleted: muscle and body fat used to be omitted
            entirely without a bioimpedance reading, because plenty of scales
            weigh and nothing more, and a dash under "muscle" can read as a
            reading that FAILED rather than one the scale never takes. The
            counter-argument won: a card that changes shape depending on which
            fields exist is harder to scan than one with three fixed slots, and
            a dash is honest about the gap rather than hiding it.

            THE CLIPPING THAT FORCED THE OLD WORDING IS GONE. In a square a
            third of the screen wide, "38.5 kg muscle" needed about 93 points
            and had 78, which is how a unit became "m..." on her phone. On a
            full-width line there are about 250 points for all three, so
            nothing has to be abbreviated to fit any more.

            METRIC ONLY, FOR NOW. kg straight from the column. The unit
            preference toggle - metric, imperial, stones - is a spec build item
            (Part One, Internationalisation), and when it lands these values
            must pass through a conversion utility before display rather than
            being formatted here. One place converts; this place renders. */}
        <FigureRow id="body.measurements" label="Body" href="/log/measurements">
          <SpotlightTarget id="overview.stats" style={styles.stretch}>
            {data.bodyAsOf == null ? (
              /* Nothing has ever been recorded. ONE dash, not three: three
                 says three separate readings failed, when in fact none has
                 been taken. */
              <ThemedText type="small" themeColor="textSecondary">
                {'—'}
              </ThemedText>
            ) : (
              <View style={[styles.inlineStats, styles.stretch]}>
                {/* A FIGURE THAT DOES NOT EXIST IS NOT SHOWN AS A DASH ANY MORE
                    (Ruth, 25 September 2026, looking at "64.2 kg · — muscle ·
                    27.8% fat": "i said to add muscle figure previously - looks
                    wrong").

                    Both halves of that are right, and they are not in conflict.
                    She DID ask for all three to always show, on 4 September, and
                    the reason was good: a CARD that changes shape depending on
                    which fields exist is harder to scan than one with three
                    fixed slots, and a dash is honest about the gap rather than
                    hiding it. That argument was about a card with three stacked
                    slots. There are no slots on a line - a dash between two
                    middle dots is not an honest gap, it is an orphan mark - and
                    the shape it was protecting no longer exists.

                    So on THIS line a figure appears when there is a reading
                    behind it and the pair goes when there is not. The
                    Measurements screen keeps all three slots, where the fixed
                    shape is real and the argument still holds. */}
                {data.weight.value != null ? (
                  <Stat value={fmt(data.weight.value, '')} unit="kg" />
                ) : null}
                {data.muscle.value != null ? (
                  <Piece>
                    <Stat value={fmt(data.muscle.value, '')} unit="muscle" />
                  </Piece>
                ) : null}
                {data.bodyFat.value != null ? (
                  <Piece>
                    <Stat value={`${round1(data.bodyFat.value)}%`} unit="fat" />
                  </Piece>
                ) : null}
                {/* Only when the reading is not from today. A date on today's
                    own numbers is noise; a date on Tuesday's is the difference
                    between a current reading and an old one. It wraps onto a
                    second line when it has to, which is the one case on this
                    screen worth an extra line. */}
                {/* NO DOT BEFORE IT (Ruth, item 6: "Remove the trailing '·'
                    after 'fat'"). The row wraps, and a separator that can end
                    up last on a line is a mark pointing at nothing. The date
                    is muted and simply follows, with its own space. */}
                {!isToday(data.bodyAsOf) ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.asOf}>
                    {formatLogDate(new Date(data.bodyAsOf))}
                  </ThemedText>
                ) : null}
              </View>
            )}
          </SpotlightTarget>
        </FigureRow>

        <Hairline />

        {/* MOVEMENT (Ruth, item 7): "Small foot icon + today's step count (no
            'steps' label), then each activity logged today, joined with middle
            dots ... Nothing logged: steps only."

            THE ICON IS THE LABEL for the number beside it. A foot beside 7,414
            says steps to anybody who has ever used a phone, and the word was
            costing a third of the room on a row that also has to carry the
            names of what she did.

            A DAY WITH NEITHER draws no row at all rather than a row of
            nothing. A zero step count is an accusation and not a measurement
            (lib/steps.ts), and "no activity" under a Food and a Body figure
            reads as a third thing she failed to do. */}
        {data.steps != null || data.activityNames.length > 0 ? (
          <FigureRow id="body.activity" label="Movement" href="/log/activity-history">
            <MovementFigures steps={data.steps} names={data.activityNames} />
          </FigureRow>
        ) : null}

        {/* STEPS DO NOT APPEAR HERE. They are on the "This week" heading, which
            is where the Activity square's one irreplaceable figure went when
            the square came out - see that heading below. A null step count
            still draws nothing at all rather than a zero: a refusal, a phone
            with no health platform and a quiet morning are indistinguishable,
            and a zero would pick the one reading that accuses somebody of not
            moving (lib/steps.ts). */}
      </View>

      {/* HOW SHE IS EATING, DIRECTLY UNDER THE FIGURES IT DECIDES (Ruth,
          4 October 2026). Shut by default to one quiet line with Pause on it -
          her instruction that the explanations stay hidden "most of the time as
          they only really need the explanation occasionally". */}
      <View style={{ height: Spacing.three }} />
      {/* THE FIGURES FOLLOW THE SWITCHES IMMEDIATELY (Ruth, 5 October 2026:
          "They need to be instant so the user can see the effect each one has on
          the calorie guide"). The card writes, then says so, and this re-runs the
          same read that focus runs - every figure on this screen is derived from
          that read, so there is nothing else to keep in step. */}
      <BodyModes onChanged={() => setReloadKey((k) => k + 1)} />

      {/* Hydration has no header because it is not a view to go into. It is the
          one thing on this screen you can DO, so it sits inline as an action -
          now a single strip rather than a card, for the same reason the squares
          replaced the tall sections.

          THE GAP ABOVE IT IS PART OF ITEM 4. Her reading of the screen was that
          everything sat high with one large hole between the droplet and the
          closing line. All the slack was collecting in one place, because the
          epigraph's `marginTop: 'auto'` swallowed every spare point on the
          screen. Giving the droplet its own proportional gap above spends some
          of that slack higher up, which is what "distributed evenly" means
          here. */}
      <View style={{ height: blockGap }} />
      <SpotlightTarget id="overview.water">
        {/* The personal goal and its reasons come from what was logged today -
            see lib/hydration-goal.ts and components/hydration-card.tsx. */}
        <HydrationCard
          ml={data.hydrationMl}
          goal={hydrationGoal({ activityMinutesToday: data.activityMinutes })}
          onLogged={(deltaMl) =>
            setData((d) => (d ? { ...d, hydrationMl: Math.max(0, d.hydrationMl + deltaMl) } : d))
          }
          onAdded={(action) => onWaterAdded?.(action)}
          onRemoved={(id) => onWaterRemoved?.(id)}
        />
      </SpotlightTarget>

      {/* THE WEEK LEFT TODAY ENTIRELY (Ruth, 25 September 2026, item 8:
          "Remove the 'This week' heading and the balance flower chart from
          Today entirely. Today shows today only. Move the balance flower to
          Almanac > Insights as a 6-week rolling view").

          This undoes most of a morning's work and the reasoning is better than
          the work was. Today is a screen about today; a week's balance is a
          pattern, and patterns are what the Almanac is for. The size fight -
          the flower down from 200 to 158 to make room for a sentence - was the
          screen telling us the section did not belong on it, and I read it as
          a layout problem for several hours.

          THE SENTENCE UNDER THE WHEEL WENT WITH IT, to the same place. It is
          about the drawing, and it follows the drawing. weekObservation() in
          lib/health-flower.ts is unchanged and now called from the Almanac.

          STEPS MOVED RATHER THAN WENT. They were on the "This week" heading
          line, which no longer exists; they are now the first figure on the
          Movement row above, which is where item 7 puts them. */}

      {/* THE CLOSING LINE (Ruth, item 9): "Move 'Your life is the context.'
          from under the date to the bottom of the page ... Cormorant Infant
          italic, around 22-24pt, centered, muted warm grey, generous space
          above. Nothing else in this space for now."

          It was a subtitle under the date, where it read as a caption on the
          day. At the foot, alone, in the display face's italic, it reads as
          what it is: the thought the screen closes on. The italic is loaded
          for this and nothing else - see DisplayFont in constants/theme.ts. */}
      <ThemedText style={styles.epigraph}>{data.personalLine}</ThemedText>
    </View>
  );
}

// The heading is the link. Wrapped in its spotlight target so "where do I see my
// food" can pulse the heading that goes there, which is the first time an
// Overview element has had a real destination to point at.
// One of the three squares. The label and the chevron sit on one line at the
// top, the numbers beneath, and the whole thing is the link - a separate "see
// more" control would be a second thing to explain.
// ONE ROW OF THE FIGURES BLOCK: a label, its figures, and a chevron, with no
// fill and no box. The whole row is the link, for the same reason the squares
// it replaced were - a separate "see more" control would be a second thing to
// explain.
//
// FORTY POINTS TALL, which is under the 44 a free-floating control wants and
// is the deliberate trade. The target runs the full width of the text column,
// which is the mitigation every list row on this phone already relies on, and
// two rows at 44 would have cost most of what removing the boxes saved.
function FigureRow({
  id,
  label,
  href,
  children,
}: {
  id: 'body.food' | 'body.measurements' | 'body.activity';
  label: string;
  href: Href;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <SpotlightTarget id={id} onActivate={() => router.push(href)}>
      <Pressable
        onPress={() => router.push(href)}
        accessibilityRole="link"
        accessibilityLabel={`${label}, open detail`}
        style={({ pressed }) => [styles.figureRow, pressed && styles.pressed]}
      >
        {/* A fixed column, so Food's figures and Body's start at the same x.
            Ragged right is how text sits; a ragged left edge under a label is
            how a table looks broken. */}
        <ThemedText type="small" themeColor="textSecondary" style={styles.figureLabel}>
          {label}
        </ThemedText>
        <View style={styles.inlineStats}>{children}</View>
        {/* accentDeep, not accent. Full-strength terracotta on sand is 2.43:1,
            under even the 3:1 a non-text control needs; the deeper tone is
            4.76:1 and reads as the same terracotta. */}
        <Ionicons name="chevron-forward" size={16} color={theme.accentDeep} />
      </Pressable>
    </SpotlightTarget>
  );
}

// The one rule on the screen: between Food and Body, and nowhere else. A
// component rather than a style so it can read the theme without the panel
// above growing a hook for one line.
function Hairline() {
  const theme = useTheme();
  return <View style={[styles.hairline, { backgroundColor: theme.backgroundSelected }]} />;
}

// TODAY'S MOVEMENT, AS ONE LINE: the step count behind a foot, then the name
// of each session, joined by the same dot the other rows use.
//
// Both halves are optional and the row above only draws when at least one of
// them exists. A step count with no sessions is an ordinary day; sessions with
// no step count is an ordinary phone, or a refused permission (lib/steps.ts).
function MovementFigures({ steps, names }: { steps: number | null; names: string[] }) {
  const theme = useTheme();
  return (
    <>
      {steps != null ? (
        <View style={styles.stepPair}>
          <Ionicons name="footsteps-outline" size={15} color={theme.textSecondary} />
          <ThemedText type="smallBold" style={styles.statValue}>
            {formatSteps(steps)}
          </ThemedText>
        </View>
      ) : null}
      {names.map((name) => (
        <Piece key={name}>
          <ThemedText type="smallBold" style={styles.statValue}>
            {name}
          </ThemedText>
        </Piece>
      ))}
    </>
  );
}

// ONE FIGURE ON A ROW THAT MIGHT WRAP.
//
// NO MIDDLE DOTS ON THESE THREE ROWS, and it is a deliberate deviation from
// her item 7, which says the Movement row's figures are "joined with middle
// dots". Three attempts at the dots is what earned it:
//
//   1. Dots as their own children. Her item 6: a dot left dangling after
//      "fat" when the date wrapped below it.
//   2. Dot bound to the figure BEFORE it. The Body row then ended a line on
//      "38.2 muscle ·" - the same fault, one line down.
//   3. Dot bound to the figure AFTER it. The wrap then STARTED a line with
//      "· 27.8% fat", which is no better.
//
// None of those can work, because a dot is a CHARACTER. Whichever word it is
// attached to, it goes where that word goes, and at a line break it lands on
// an edge. What a separator has to do at a break is DISAPPEAR, and only space
// does that.
//
// So the figures are spaced rather than punctuated. It reads more editorially
// than a dotted list anyway, which is where the whole screen went today, and
// the Body row can carry all three of her scale figures and wrap without
// leaving a mark pointing at nothing.
function Piece({ children }: { children: React.ReactNode }) {
  return <View style={styles.piece}>{children}</View>;
}

// A number and its unit on one line. Compact by necessity: three of these have
// to sit inside a square about a third of the screen wide.
function Stat({ value, unit, big }: { value: string; unit: string; big?: boolean }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="smallBold" style={big ? styles.statValueBig : styles.statValue}>
        {value}
      </ThemedText>
      {/* No numberOfLines: Android replaces text it measures as too wide with
          an ellipsis, which is how a unit became "m...". The words are now
          short enough to fit, and if a phone is ever narrower still, a unit
          that wraps is honest where one that is cut off is not. */}
      <ThemedText type="small" themeColor="textSecondary" style={styles.statUnit}>
        {unit}
      </ThemedText>
    </View>
  );
}

// Same calendar day in LOCAL time, which is the only comparison that means
// anything to somebody looking at their own day.
const isToday = (iso: string): boolean =>
  toLocalDateKey(new Date(iso)) === toLocalDateKey(new Date());

const fmt = (v: number | null, unit: string): string => (v == null ? '—' : `${round1(v)}${unit}`);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    // Tightened from Spacing.four (2026-09-04), then from Spacing.three
    // (2026-09-25). Six children means five gaps, and 24 apiece was 120px of a
    // 591px budget on a screen that cannot scroll. 12 is off the scale on
    // purpose: it is the one place in the app where four points bought back
    // are four points of flower, and the sections are still plainly separate
    // because each one is a different shape.
    gap: 12,
  },
  // AIR BEFORE THE FIGURES BEGIN (Ruth, 25 September 2026: "then another
  // 24-32px before the cards begin. It feels much more editorial"). The
  // screen's own gap is 12, so 16 more puts 28 between the daily line and the
  // first figure - the largest gap on the screen, which is what makes the
  // header read as a masthead rather than as the first of six things.
  figures: {
    marginTop: Spacing.three,
  },
  hairline: {
    height: 1,
  },
  figureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 40,
  },
  // Wide enough for the LONGEST of them, which is "Movement" since item 7 -
  // at 44 it broke as "Move / ment", which is the kind of thing a fixed column
  // does the moment a new row arrives. Fixed so the three rows line up: ragged
  // right is how text sits, a ragged left edge under a label is how a table
  // looks broken.
  //
  // The cost is real and taken knowingly: a Body row carrying all three scale
  // figures now wraps onto a second line. A wrapped row is honest; a label
  // broken mid-word is not.
  figureLabel: {
    width: 76,
  },
  // Indented to the figures' own left edge, so the target reads as belonging to
  // the Food row above it rather than as a new row of its own.
  targetLine: {
    paddingLeft: 76,
    paddingBottom: Spacing.two,
  },
  // The figures themselves, which take the slack so the chevron keeps the
  // right edge. They wrap rather than clip - see the as-of date above.
  // ANYTHING BETWEEN A ROW AND ITS FIGURES HAS TO PASS THE SHRINK ON.
  // minWidth:0 on the figures is useless if a wrapper above them refuses to
  // give ground - and SpotlightTarget draws a View of its own, which is what
  // was actually holding the Body row open over its chevron. Two wrappers deep
  // and the fix has to be applied at every one of them.
  stretch: { flex: 1, minWidth: 0 },
  // One figure, kept whole. See Piece.
  piece: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.one },
  // The foot and its number, which travel together when the row wraps.
  stepPair: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // The date of a reading that is not today's. Muted, with its own space
  // rather than a separator, so nothing can be left pointing at nothing when
  // the row wraps (Ruth, item 6).
  // AT THE END OF THE ROW, NOT IN THE MIDDLE OF IT (Ruth, 26 September 2026,
  // item 5c): "The date ('24 Sept') sits mid-row. Put it at the end in muted
  // text." It was last in source order already, so on a row that wrapped it
  // landed wherever the figures left it - which reads as belonging to the
  // figure beside it rather than to the row. marginLeft:'auto' pushes it to the
  // far right of whichever line it ends on, where a date on a record belongs.
  asOf: { marginLeft: 'auto' },
  // THE CLOSING EPIGRAPH (Ruth, item 9). The one italic in the app, centred,
  // with the largest space on the screen above it - which is what makes it
  // read as a close rather than as another line of content. The size is the
  // middle of the 22-24 she asked for; the leading is above the size, unlike
  // the greeting's, because this is a sentence rather than a composition.
  epigraph: {
    fontFamily: DisplayFont.italic,
    fontSize: 23,
    lineHeight: 30,
    textAlign: 'center',
    // AUTO, NOT A FIXED GAP. "Generous space above. If the page is short, it
    // sits in the lower third of the screen." A fixed margin left it floating
    // in the middle with a void underneath, which reads as a page that ran
    // out; pushed to the foot, the space above it IS the generous space and
    // the void is gone because it is on the other side.
    marginTop: 'auto',
    paddingHorizontal: Spacing.three,
    opacity: 0.75,
  },
  inlineStats: {
    flex: 1,
    // WITHOUT THIS THE ROW OVERRUNS ITS CHEVRON. A flex child will not shrink
    // below its own content width unless it is told it may, so a Body row
    // carrying all three scale figures simply ran past the right edge and
    // printed "27.8% fa>" over the arrow - it never got the chance to wrap.
    //
    // This is the second time today: quick-log-bar.tsx carries the same note
    // about the same trap, written this morning about the Add button, and I
    // still wrote a flex:1 without it this afternoon.
    minWidth: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    // The separator. Clearly wider than the 4 inside a figure, so "64.2 kg"
    // reads as one thing and the next figure as another - and it costs
    // nothing at a line break, because space is what a break already is.
    columnGap: Spacing.three,
    rowGap: Spacing.half,
  },
  // The sentence under the wheel. Indented by nothing and centred by nothing:
  // it belongs to the section, not to the drawing.
  stat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    // A VALUE AND ITS UNIT DO NOT COME APART (Ruth, 26 September 2026, item
    // 5b): "'112g' and 'protein' are wrapping onto separate lines. Keep each
    // value and its unit together; wrap only whole value-unit pairs."
    //
    // This used to wrap, to stop a unit breaking mid-word - "8,465 step / s".
    // That fixed the break by moving the unit to its own line, which is the
    // same fault one step further out: 112g on one line and "protein" on the
    // next is a number with nothing attached to it.
    //
    // Wrapping belongs one level up and already lives there: inlineStats wraps
    // between whole figures, with a column gap wide enough to read as a
    // separator. So a pair that will not fit drops to the next line ENTIRE,
    // which is exactly what she asked for.
    flexWrap: 'nowrap',
    flexShrink: 0,
  },
  statValue: {
    fontSize: 15,
  },
  statValueBig: {
    fontSize: 22,
  },
  statUnit: {
    fontSize: 11,
    // Not shrinkable: a shrinking Text breaks inside its word. The row wraps
    // instead (see stat), so the whole unit drops a line when it must.
    flexShrink: 0,
  },
  // THE TWO-LINE COMPOSITION AT A SIZE THAT ACTUALLY HOLDS TWO LINES
  // (2026-09-25). Her brief of 18 September asked for "Good morning," over
  // "Ruth", with leading tighter than the size, because "the two-line
  // composition gives the page presence and creates a stronger editorial
  // rhythm". That is kept. What is not kept is 50pt, which never fitted the
  // composition it was set in: the text column is 312 points wide and "Good
  // afternoon," at 50pt is about 405, so from midday onward the greeting
  // silently became THREE lines - "Good" / "afternoon," / "Ruth" - and pushed
  // the flower off the bottom of a screen that cannot scroll. It is the top of
  // the screen that was too big, not the flower.
  //
  // 32 on 38 is the largest size at which "Good afternoon," fits on one line
  // with the three-seeds mark clear of it in the corner, and it keeps the
  // leading tighter than the size, which is the part of the brief that carries
  // the rhythm. The block costs 76 points instead of 141.
  greeting: {
    // UP FROM 32 (Ruth, 26 September 2026, item 4: "Enlarge the greeting by
    // around 15-20%, keeping Cormorant Infant"). 38 is 19% up, and the leading
    // stays just under a 1.2 ratio, which is what keeps a two-line greeting
    // reading as one composition rather than two sentences.
    //
    // It was 50 until the 25th, which put "Good afternoon," on three lines in a
    // 312pt column - a bug only ever visible after midday. 38 clears that with
    // room: the longest greeting is about 300pt at this size.
    fontSize: 38,
    lineHeight: 45,
    // Clear of the three seeds, which now sit in the top-right corner on this
    // screen as they do on every other one.
    paddingRight: Spacing.five,
  },
  header: {
    // THE TOP GAP IS SET AT RUNTIME, from the screen's own height - see
    // `topGap` in the panel. It used to be -10, pulling the heading block above
    // the page inset (Ruth, 2026-09-18: "move the entire heading block 8-12px
    // higher"). That was right when the greeting was the only thing competing
    // for the top of the screen; with the seeds now pinned up there on every
    // screen, and her item 4 on the 26th - "Add more space above the greeting,
    // roughly double the current top margin" - it goes the other way, and it
    // scales rather than being one number that suits one phone.
    marginTop: 0,
    // The display face now carries 10 points of padding for its descenders (see
    // themed-text.tsx), so the gap under the greeting is taken back here to keep
    // this block exactly where she approved it.
    gap: Spacing.one,
  },
  dateRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.three },
  // The date takes the room and the link keeps its own width, so a long date
  // with a cycle day wraps rather than pushing Settings off the edge.
  dateText: { flex: 1 },
  focusLine: {
    // No rule, no card. See the header block above.
    paddingRight: Spacing.four,
  },
  // A strip, not a card. One line: the reading on the left, the taps on the
  // right, everything on one baseline.
  pressed: {
    opacity: 0.7,
  },
});
