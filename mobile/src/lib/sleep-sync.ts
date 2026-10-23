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
// WHY IT DID NOT WORK IS THE ONLY USEFUL THING TO SAY (Ruth, 23 October
// 2026): "users shouldn't be coming up against this, the app needs to
// facilitate the settings required".
//
// The first version answered every failure with "Not connected", which is
// the app reporting its own disappointment. There are four quite different
// reasons and three of them have an action the app can take her to:
//
//   no-health-connect   Health Connect is not on this phone -> install it
//   needs-update        it is there but too old -> update it
//   refused             Android is holding a no -> open its settings, because
//                       Android stops showing the dialog after a refusal and
//                       tapping Connect again would do nothing forever
//   granted-no-data     allowed, but nothing is sharing sleep INTO Health
//                       Connect. On a Samsung that is Samsung Health's own
//                       setting, which is the likeliest place to get stuck
//                       and the one no app can change for her.
//
// A FIFTH CASE CANNOT BE FIXED FROM HERE AT ALL, and it is the one that was
// actually happening: an APK built BEFORE the permission was declared. The
// twelve health permissions entered app.json on 15 October and her build is
// from the 9th. Android permissions are compiled into the manifest, and an
// over-the-air update carries only JavaScript - so Health Connect was right
// to refuse, and no wording here would have changed it. It needs a new build.
export type SleepConnectOutcome =
  | { state: 'granted'; nights: number }
  | { state: 'granted-no-data' }
  | { state: 'refused' }
  | { state: 'needs-update' }
  | { state: 'no-health-connect' };

/** The Health Connect app, for sending somebody to install or update it. */
export const HEALTH_CONNECT_PACKAGE = 'com.google.android.apps.healthdata';

/** Open Health Connect itself, where a refusal can be undone. */
export function openHealthConnect(): void {
  healthConnect()?.openHealthConnectSettings();
}

/** Open the screen listing what each app may read, for checking a source. */
export function openHealthConnectSources(): void {
  healthConnect()?.openHealthConnectDataManagement();
}

/** Ask for sleep access, and say precisely what happened. */
export async function connectSleep(): Promise<SleepConnectOutcome> {
  const hc = healthConnect();
  if (!hc) return { state: 'no-health-connect' };
  try {
    const status = await hc.getSdkStatus();
    if (status === hc.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
      return { state: 'needs-update' };
    }
    if (status !== hc.SdkAvailabilityStatus.SDK_AVAILABLE) {
      return { state: 'no-health-connect' };
    }
    if (!(await hc.initialize())) return { state: 'no-health-connect' };

    await hc.requestPermission([{ accessType: 'read', recordType: 'SleepSession' }]);
    // READ THE GRANT BACK rather than trusting what the request returned.
    // Same rule as everywhere else in this project: the record decides, not
    // the call that was supposed to change it.
    if (!(await hasSleepPermission())) return { state: 'refused' };

    const nights = await syncSleepFromPhone();
    return nights > 0 ? { state: 'granted', nights } : { state: 'granted-no-data' };
  } catch (err) {
    console.log('SLEEP (android): connect failed -', err);
    return { state: 'no-health-connect' };
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
