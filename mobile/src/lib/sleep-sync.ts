import { Platform } from 'react-native';

import { currentUserId } from '@/lib/current-user';
import {
  mergeNights,
  nightFromSession,
  type NightFromPhone,
  type Session,
} from '@/lib/sleep-night';
import { supabase } from '@/lib/supabase';

// LAST NIGHT, FROM THE PHONE, WITHOUT BEING ASKED FOR IT.
//
// Ruth, 23 October 2026: "we need any data that comes from the phone as it will
// be build into the app since the whole idea is to reduce friction, so a run
// logged on samsung health flows in automatically from the phone or the
// wearable. if it doesn't do that people with wearables will think selodia is
// junk, simple as that."
//
// WHAT WAS ACTUALLY THERE BEFORE THIS FILE. app.json asks Android for twelve
// health permissions - sleep, weight, body fat, menstruation, exercise and the
// rest - and the whole app read exactly one data type: steps. Every one of her
// seven sleep rows says source 'log', because typing was the only way in. The
// permission had been requested since September and nothing had ever used it.
//
// A permission asked for and never read is worse than not asking: Health
// Connect shows the person a list of what Selodía wants, and until today that
// list promised a product that did not exist behind it.
//
// WHAT A WEARABLE CAN AND CANNOT TELL US, and the line matters for the screen
// as much as for this file:
//
//   IT KNOWS   when sleep started and ended, and therefore how long
//              how many times the night was broken, from the awake stages
//   IT CANNOT  how it FELT. "broken", "deep", "restless" is a judgement only
//              the person can make, and a watch that infers it is guessing
//              about the one thing they are best placed to say.
//
// So this fills the facts and leaves `quality` null, always. The screen asks
// for the feeling; the phone supplies the clock. Neither is asked for what it
// does not know.

type HealthConnect = typeof import('react-native-health-connect');

function healthConnect(): HealthConnect | null {
  if (Platform.OS !== 'android') return null;
  try {
    // Required lazily for the same reason steps.ts does it: the module is
    // native and importing it on web or iOS throws at load.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-health-connect') as HealthConnect;
  } catch {
    return null;
  }
}

/** Nights the phone holds for the last `days` days. Empty when it has none. */
export async function readNightsFromPhone(days = 7): Promise<NightFromPhone[]> {
  const hc = healthConnect();
  if (!hc) return [];
  try {
    if ((await hc.getSdkStatus()) !== hc.SdkAvailabilityStatus.SDK_AVAILABLE) return [];
    if (!(await hc.initialize())) return [];

    const granted = await hc.getGrantedPermissions();
    const canRead = (granted ?? []).some(
      (p) =>
        (p as { recordType?: string; accessType?: string }).recordType === 'SleepSession' &&
        (p as { recordType?: string; accessType?: string }).accessType === 'read'
    );
    // NOT A PROMPT. Asking here would meet somebody with the dialog just for
    // opening a screen; the ask belongs to a control they chose. Same rule as
    // steps.
    if (!canRead) return [];

    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - days);

    const result = await hc.readRecords('SleepSession', {
      timeRangeFilter: {
        operator: 'between',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
    });

    const records = ((result as { records?: Session[] } | undefined)?.records ?? []) as Session[];
    return mergeNights(
      records.map(nightFromSession).filter((n): n is NightFromPhone => n !== null)
    );
  } catch (err) {
    console.log('SLEEP (android): read failed -', err);
    return [];
  }
}

/** Whether sleep is already readable, without asking for anything. */
export async function hasSleepPermission(): Promise<boolean> {
  const hc = healthConnect();
  if (!hc) return false;
  try {
    if ((await hc.getSdkStatus()) !== hc.SdkAvailabilityStatus.SDK_AVAILABLE) return false;
    if (!(await hc.initialize())) return false;
    const granted = await hc.getGrantedPermissions();
    return (granted ?? []).some(
      (p) =>
        (p as { recordType?: string; accessType?: string }).recordType === 'SleepSession' &&
        (p as { recordType?: string; accessType?: string }).accessType === 'read'
    );
  } catch {
    return false;
  }
}
/** Ask for sleep access. Only ever from a control the person tapped. */
export async function requestSleepPermission(): Promise<boolean> {
  const hc = healthConnect();
  if (!hc) return false;
  try {
    if ((await hc.getSdkStatus()) !== hc.SdkAvailabilityStatus.SDK_AVAILABLE) return false;
    if (!(await hc.initialize())) return false;
    const granted = await hc.requestPermission([
      { accessType: 'read', recordType: 'SleepSession' },
    ]);
    return (granted ?? []).some(
      (p) => (p as { recordType?: string }).recordType === 'SleepSession'
    );
  } catch (err) {
    console.log('SLEEP (android): permission request failed -', err);
    return false;
  }
}

/**
 * Bring the phone's nights into sleep_logs, and hand back how many landed.
 *
 * WHAT SHE TYPED ALWAYS WINS. A night she described in her own words carries
 * how it felt, which the phone cannot know, so a row with source 'log' is never
 * touched - not its duration, not its times. The phone only fills nights that
 * are not there, and updates its OWN earlier rows when the watch later revises
 * them, which Samsung Health does once it has finished processing a night.
 */
export async function syncSleepFromPhone(days = 7): Promise<number> {
  const nights = await readNightsFromPhone(days);
  if (nights.length === 0) return 0;

  const userId = await currentUserId();
  if (!userId) return 0;

  const { data: existing } = await supabase
    .from('sleep_logs')
    .select('id, night_of, source')
    .in('night_of', nights.map((n) => n.nightOf));

  const have = new Map(
    ((existing ?? []) as { id: string; night_of: string; source: string | null }[]).map((r) => [
      r.night_of,
      r,
    ])
  );

  let written = 0;
  for (const night of nights) {
    const row = have.get(night.nightOf);
    if (row && row.source !== SLEEP_SOURCE) continue; // hers, and hers wins

    const fields = {
      user_id: userId,
      night_of: night.nightOf,
      duration_min: night.minutes,
      went_to_bed: night.wentToBed,
      woke_at: night.wokeAt,
      awakenings: night.awakenings,
      // NEVER A QUALITY. See the note at the top: how a night felt is hers to
      // say, and a watch filling it in would put words in her mouth.
      source: SLEEP_SOURCE,
    };

    const { error } = row
      ? await supabase.from('sleep_logs').update(fields).eq('id', row.id)
      : await supabase.from('sleep_logs').insert(fields);
    if (!error) written += 1;
    else console.log('SLEEP sync: write failed -', error.message);
  }
  return written;
}

/** What the source column says for a night that came from the phone. */
export const SLEEP_SOURCE = 'phone health platform';
