import { Platform } from 'react-native';
import AppleHealthKit, { type HealthKitPermissions, type HealthValue } from 'react-native-health';
import { currentUserId } from '@/lib/current-user';
import { supabase } from '@/lib/supabase';

// HEALTH CONNECT IS LOADED WHERE IT IS USED, NEVER AT IMPORT (23 September
// 2026). It was a static top-level import, and that is the same fault as the
// missing GestureHandlerRootView wearing a worse face.
//
// The package builds its module object BEFORE Platform.select runs, so the
// Android branch is evaluated on every platform, and on the New Architecture
// that branch is TurboModuleRegistry.getEnforcing('HealthConnect') - which
// THROWS when the module is absent. The package is Android-only: no ios
// directory, no podspec.
//
// So a static import meant:
//   - on iOS, opening Today threw during module evaluation. A dead screen, on
//     the path to the first TestFlight build.
//   - on Android, any over-the-air update reaching a binary built before
//     react-native-health-connect was added white-screened the Today tab.
//
// This codebase already documents the hazard three times - see
// lib/document-pages.ts, lib/reminder-settings.ts and lib/notifications.ts -
// and these two files were written afterwards without following it. A
// try/catch around an await import() does not help: the throw happens at
// evaluation, so the require has to be inside the function that needs it.
type HealthConnect = typeof import('react-native-health-connect');

function healthConnect(): HealthConnect | null {
  if (Platform.OS !== 'android') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-health-connect') as HealthConnect;
  } catch {
    // An older binary without the native module. Null reads as "cannot know",
    // which every caller here already handles - and null is never written over
    // a figure that exists.
    return null;
  }
}


// Reading the step count the phone already has, and keeping the day's total.
//
// WHY THIS DID NOT EXIST UNTIL NOW (2026-09-16). The permission has been asked
// for since onboarding was built, and nothing ever read a step: no call to
// getStepCount or aggregateRecord existed anywhere in the app, activity_logs has
// never held a row that came from a phone, and the Overview's Activity square
// carries a comment explaining that steps are deliberately absent rather than
// shown as a zero. Three separate places told the person otherwise - the
// onboarding promise, the "Step tracking is connected" confirmation, and a line
// in the chat model's prompt ordering it to never say the app cannot read steps.
// Ruth's decision when offered the choice between correcting the copy and
// building the feature: build the feature.
//
// NULL IS NOT ZERO, AND THE DIFFERENCE IS THE WHOLE POINT. Every function here
// returns null when it does not know, and a null is never written over a figure
// that exists. A zero is a claim that somebody did not move today, which is the
// exact false statement the Activity square was built to avoid making.
//
// BEST EFFORT, ALWAYS. Nothing here throws into its caller. Steps are a
// convenience on a screen that has to render regardless, and a health platform
// that is missing, unavailable, mid-update or simply refusing is an ordinary
// Tuesday - not an error worth taking the Overview down for.

// What a phone-sourced row is called in daily_activity_summaries.source. The
// only other writer is the Samsung screenshot path in parse-activity, which
// writes "Samsung daily summary"; keeping the two distinguishable is what lets a
// later question - where did this figure come from - be answered at all.
export const STEP_SOURCE = 'phone health platform';

// Thousands separator by hand, not toLocaleString. Hermes on Android ships a
// variable ICU build, so Intl output is not guaranteed identical on every
// device - the same reason week.ts writes its own month names. Lives here rather
// than in either screen that shows a step count, because two copies of one
// display rule is how the two screens start disagreeing.
export function formatSteps(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Local midnight through now. Deliberately not a UTC day: a day belongs to the
// person living it, and week.ts makes the same choice for the same reason.
function todayWindow(): { startISO: string; endISO: string; dateKey: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, '0');
  const d = String(start.getDate()).padStart(2, '0');
  return { startISO: start.toISOString(), endISO: now.toISOString(), dateKey: `${y}-${m}-${d}` };
}

// ---------------------------------------------------------------- Android
//
// Aggregated rather than read record by record. Health Connect stores steps as
// many small records from whichever apps write them, and summing them by hand
// would double-count the overlap between, say, Samsung Health and the phone's
// own sensor. COUNT_TOTAL is the platform's own de-duplicated answer.
//
// PERMISSION IS CHECKED, NEVER REQUESTED. A prompt belongs to a moment the
// person chose - onboarding, or the control in Settings - not to a screen
// refreshing itself. Somebody who declined must not meet the dialog again just
// for opening the app.
async function readAndroidSteps(startISO: string, endISO: string): Promise<number | null> {
  const hc = healthConnect();
  if (!hc) return null;
  try {
    if ((await hc.getSdkStatus()) !== hc.SdkAvailabilityStatus.SDK_AVAILABLE) return null;
    if (!(await hc.initialize())) return null;

    const granted = await hc.getGrantedPermissions();
    const canRead = (granted ?? []).some(
      (p) => (p as { recordType?: string; accessType?: string }).recordType === 'Steps' &&
        (p as { recordType?: string; accessType?: string }).accessType === 'read'
    );
    if (!canRead) return null;

    const result = await hc.aggregateRecord({
      recordType: 'Steps',
      timeRangeFilter: { operator: 'between', startTime: startISO, endTime: endISO },
    });
    const total = result?.COUNT_TOTAL;
    return typeof total === 'number' && Number.isFinite(total) ? total : null;
  } catch (err) {
    console.log('STEPS (android): read failed -', err);
    return null;
  }
}

// -------------------------------------------------------------------- iOS
//
// initHealthKit runs first and every time. It is how the native side learns
// which types this app may ask for, and that registration does not survive a
// process restart - so a reader that assumes onboarding already did it works on
// the day someone sets the app up and silently returns nothing ever after.
// Calling it again on a phone that has already granted access shows no prompt.
//
// Apple never reveals whether READ access was granted (see step-permission.ts),
// so an empty result is genuinely ambiguous: a refusal and a person who has not
// walked today are indistinguishable. Both come back as null, which is the
// honest answer, and neither is written down.
function readIOSSteps(dayStartISO: string): Promise<number | null> {
  return new Promise((resolve) => {
    const permissions: HealthKitPermissions = {
      permissions: { read: [AppleHealthKit.Constants.Permissions.StepCount], write: [] },
    };
    AppleHealthKit.initHealthKit(permissions, (initError) => {
      if (initError) {
        console.log('STEPS (ios): initHealthKit failed -', initError);
        resolve(null);
        return;
      }
      AppleHealthKit.getStepCount({ date: dayStartISO }, (err: string, result: HealthValue) => {
        if (err) {
          console.log('STEPS (ios): getStepCount failed -', err);
          resolve(null);
          return;
        }
        const value = result?.value;
        resolve(typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null);
      });
    });
  });
}

/** Today's step count from the phone's own health platform, or null if unknown. */
export async function readTodaySteps(): Promise<number | null> {
  const { startISO, endISO } = todayWindow();
  if (Platform.OS === 'android') return readAndroidSteps(startISO, endISO);
  if (Platform.OS === 'ios') return readIOSSteps(startISO);
  return null;
}

/** The day's stored step figure, without touching the health platform. */
export async function loadStoredSteps(): Promise<number | null> {
  const { dateKey } = todayWindow();
  // RLS scopes the read to the signed-in user.
  const { data } = await supabase
    .from('daily_activity_summaries')
    .select('steps')
    .eq('date', dateKey)
    .maybeSingle();
  const steps = (data as { steps: number | null } | null)?.steps;
  return typeof steps === 'number' ? steps : null;
}

// Read the platform, keep the answer, and hand it back for display.
//
// MERGED, NOT OVERWRITTEN. daily_activity_summaries is keyed on (user_id, date)
// and this is its SECOND writer: parse-activity already upserts the same row
// from a photographed Samsung summary, carrying kcal_burned, active_minutes and
// distance_km. Rather than depend on which columns an upsert leaves alone, the
// existing row is read and merged, so neither writer can erase the other's
// figures. It costs one extra read on a screen that already makes five.
//
// A NULL READING CHANGES NOTHING. If the platform has no answer, whatever is
// already stored stands - including a figure typed in or photographed earlier.
// Writing a null over it would lose real data to a temporary refusal.
export async function syncTodaySteps(): Promise<number | null> {
  // OFF MEANS NOT READ (2026-09-19). The Today panel called this without
  // looking at the person's answer, so a "turn off" that only stored a
  // preference would have kept reading their steps. Whatever is already stored
  // for today is still shown; nothing new is taken from the phone.
  const { data: pref } = await supabase
    .from('user_profile')
    .select('steps_permission_declined')
    .maybeSingle();
  if ((pref as { steps_permission_declined: boolean | null } | null)?.steps_permission_declined) {
    return loadStoredSteps();
  }

  const steps = await readTodaySteps();
  if (steps == null) return loadStoredSteps();

  const { dateKey } = todayWindow();
  try {
    const userId = await currentUserId();
    if (!userId) return steps;

    const { data: existing } = await supabase
      .from('daily_activity_summaries')
      .select('kcal_burned, active_kcal, active_minutes, distance_km, source')
      .eq('date', dateKey)
      .maybeSingle();
    const prior = (existing ?? {}) as {
      kcal_burned?: number | null;
      active_kcal?: number | null;
      active_minutes?: number | null;
      distance_km?: number | null;
      source?: string | null;
    };

    const { error } = await supabase.from('daily_activity_summaries').upsert(
      {
        user_id: userId,
        date: dateKey,
        steps,
        kcal_burned: prior.kcal_burned ?? null,
        active_kcal: prior.active_kcal ?? null,
        active_minutes: prior.active_minutes ?? null,
        distance_km: prior.distance_km ?? null,
        // A row that already came from a photographed summary keeps saying so,
        // with the steps refreshed inside it. Only a row this function created
        // claims the phone as its source.
        source: prior.source ?? STEP_SOURCE,
      },
      { onConflict: 'user_id,date' }
    );
    if (error) console.log('STEPS: daily summary upsert failed -', error.message);
  } catch (err) {
    console.log('STEPS: could not store today -', err);
  }

  return steps;
}
