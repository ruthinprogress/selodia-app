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

    // THE REQUEST'S OWN ANSWER IS THE AUTHORITATIVE ONE (Ruth, 23 October
    // 2026, with the screenshots that proved it).
    //
    // This used to throw the result away and re-query getGrantedPermissions,
    // on the principle that the record decides rather than the call that was
    // meant to change it. That principle is right for OUR writes and wrong
    // here: requestPermission does not claim anything, it RETURNS the granted
    // set, and re-querying straight afterwards reads a cache Android has not
    // finished committing.
    //
    // So she granted sleep, Health Connect recorded it - 'Sleep, 1 of 1
    // selected', Selodia under Allowed access - and the app told her she had
    // refused, then offered to take her to Settings to fix something that was
    // already fixed.
    const granted = await hc.requestPermission([
      { accessType: 'read', recordType: 'SleepSession' },
    ]);
    const inAnswer = (granted ?? []).some(
      (p) => (p as { recordType?: string }).recordType === 'SleepSession'
    );
    // AND A SECOND LOOK BEFORE GIVING UP, because the opposite staleness is
    // just as possible: a grant that arrives a moment after the dialog
    // closes. Only when both say no is it actually a no.
    if (!inAnswer && !(await hasSleepPermission())) return { state: 'refused' };

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

// "NOTHING NEW" WAS THE APP GIVING UP IN TWO WORDS (Ruth, 23 October 2026).
//
// Her screenshot: the card reads "Your phone is filling these in", so the
// permission is granted and Selodía knows it. She taps "Check for new nights"
// and gets "Nothing new.", and no button. Her words: "Thats all it shows and
// the bitton does nothing."
//
// THE BUTTON WAS WORKING. syncSleepFromPhone returned 0 and 0 has two
// completely different meanings that it cannot tell apart:
//
//   the phone holds nights and we already have them    -> genuinely nothing new
//   the phone holds no sleep at all                    -> nothing is SHARING
//
// The second is the one that was actually happening, and it is the same
// granted-no-data case connectSleep already diagnoses and offers a way out of -
// but only on the FIRST connect. Once connected, that whole branch became
// unreachable, so the one person who most needs the next step is the only one
// who cannot get to it. A count cannot carry a reason, which is why this
// returns an outcome like connectSleep does rather than a number.
//
// IT LOOKS BACK THIRTY DAYS, NOT SEVEN, to answer the question honestly. "Has
// anything ever put sleep in here" is not the same question as "is there a new
// night", and a week of not wearing a watch would otherwise read as a broken
// setting.
export type SleepCheckOutcome =
  /** New or revised nights landed. */
  | { state: 'updated'; nights: number }
  /** The phone has nights and we already hold every one of them. */
  | { state: 'up-to-date' }
  /** Allowed to read, and there is nothing there to read. */
  | { state: 'nothing-on-phone' }
  /** The permission has gone away since the card was drawn. */
  | { state: 'refused' }
  | { state: 'no-health-connect' };

/** How far back to look when asking whether anything shares sleep at all. */
const EVER_DAYS = 30;

/** Check the phone for nights, and say which kind of nothing it found. */
export async function checkForNights(): Promise<SleepCheckOutcome> {
  const hc = healthConnect();
  if (!hc) return { state: 'no-health-connect' };

  // Re-read the permission rather than trusting the card's own state: she may
  // have turned it off in Health Connect since this screen was drawn, and
  // "nothing is sharing" would be the wrong thing to tell her if so.
  if (!(await hasSleepPermission())) return { state: 'refused' };

  const onPhone = await readNightsFromPhone(EVER_DAYS);
  if (onPhone.length === 0) return { state: 'nothing-on-phone' };

  const written = await syncSleepFromPhone(EVER_DAYS);
  return written > 0 ? { state: 'updated', nights: written } : { state: 'up-to-date' };
}
