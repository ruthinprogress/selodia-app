import { PermissionsAndroid, Platform } from 'react-native';


import { supabase } from '@/lib/supabase';

// Consent, and the OS permission that follows it. Two separate things, asked in
// that order, and the order is the point.
//
// OFF BY DEFAULT. `voice_consent_at` is null for everyone until they say yes.
// The explanation comes first because the OS dialog cannot carry it: "Selodía
// would like to access the microphone" says nothing about audio leaving the
// phone, and agreeing to a system prompt is not informed consent to a third
// party processing your voice.
//
// ON THE ACCOUNT, NOT THE DEVICE - same reasoning as the tab tooltips. Consent
// given once should not be asked for again after a reinstall or on a second
// phone. The inverse matters more: consent must not silently reset to "never
// asked" in a way that looks like it was withdrawn.
//
// ASKED ONCE, AND THAT IS LOAD-BEARING. If the OS permission is denied AFTER
// consent, the answer is a line pointing at Settings - never the consent sheet
// again. Re-showing it would be asking someone to re-consent to something they
// already agreed to, to fix a problem the sheet cannot fix.

export type MicPermission = 'granted' | 'denied' | 'blocked';

// One line, and it does not nag. "Blocked" is the never-ask-again case, where
// the only route left is Settings and saying so is the whole of the help we can
// give. Written to be read at a glance in the thread, not as an error.
export const MIC_BLOCKED_MESSAGE =
  'Voice needs microphone access. You can turn it on for Selodía in your device settings.';
export const MIC_DENIED_MESSAGE = 'Voice needs microphone access to work. No problem either way.';

export async function hasVoiceConsent(): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_profile')
    .select('voice_consent_at')
    .maybeSingle();
  // Fail CLOSED. An unreadable answer must not be treated as consent - the
  // worst case here is being asked once more, which is far better than opening
  // a microphone on the strength of a failed query.
  if (error || !data) return false;
  return data.voice_consent_at != null;
}

/**
 * TAKING IT BACK, which was impossible until 1 October 2026.
 *
 * Nothing anywhere cleared `voice_consent_at`. Consent could be given from a
 * sheet one tap from the chat box and withdrawn only by somebody with database
 * access - which is not a defensible position for a permission covering a
 * microphone and a third-party processor. Found by Ruth asking the obvious
 * question: what is the tap path to turn it off?
 *
 * IT STOPS NEW AUDIO AND NOTHING ELSE. The transcripts stay in her thread, and
 * ElevenLabs keep their copy for up to 3 years whatever this writes. The screen
 * says so; offering this as an erasure would be the same shape of untrue comfort
 * as "the audio isn't kept".
 *
 * Returns whether it landed, rather than throwing, because the caller is a
 * settings row that must say "that didn't save, so voice is still on" instead of
 * showing an off state that is not real.
 */
export async function withdrawVoiceConsent(): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase
      .from('user_profile')
      .update({ voice_consent_at: null })
      .eq('user_id', user.id);
    return !error;
  } catch {
    return false;
  }
}

export async function recordVoiceConsent(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const { error } = await supabase
    .from('user_profile')
    .update({ voice_consent_at: new Date().toISOString() })
    .eq('user_id', user.id);
  // Thrown rather than swallowed: if the stamp did not land, the sheet has to
  // stay honest about it rather than proceeding as though it had.
  if (error) throw error;
}

// THE HEADPHONE FIX WAS HALF-BUILT AND NOBODY COULD HAVE SEEN IT (23 September
// 2026). Ruth reported on 18 September that voice did not route to her
// headphones, and lib/voice-audio-route.ts was given a preferred output list
// beginning with 'bluetooth'. That list has been asking for something the app
// was never allowed to have.
//
// The audio library underneath (com.github.davidliu:audioswitch, pulled in by
// @livekit/react-native) declares BLUETOOTH with maxSdkVersion="30" - Android
// 11 and below. From Android 12 the permission that lets an app see and route
// to a paired Bluetooth device is BLUETOOTH_CONNECT, and it was declared
// NOWHERE: not in the app, not in any dependency's manifest. Checked by reading
// the AAR itself rather than assuming.
//
// So on any current phone the 'bluetooth' entry silently fell through to
// headset, then speaker. No error, no log, nothing to notice - the fix simply
// did not apply, and the symptom was identical to not having made it.
//
// ASKED ALONGSIDE THE MICROPHONE, not at the moment audio starts. It is a
// dangerous permission on API 31+, so it needs a runtime prompt, and two
// dialogs in a row while somebody is already saying yes to voice is far kinder
// than one arriving mid-sentence. A refusal is not fatal: the route falls back
// to headset or speaker exactly as it does now, which is why nothing here
// returns a failure.
async function askForBluetooth(): Promise<void> {
  const permission = PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT;
  // Absent on Android 11 and below, where BLUETOOTH from the library covers it.
  if (!permission) return;
  try {
    if (await PermissionsAndroid.check(permission)) return;
    await PermissionsAndroid.request(permission);
  } catch {
    // Routing is a convenience, never a reason to stop somebody talking.
  }
}

// The OS dialog, after consent and never before.
//
// Two paths because the platforms answer differently, and the difference is one
// we need. Android distinguishes "denied" from "never ask again", which is
// exactly the distinction between "ask me later" and "only Settings can fix
// this". iOS has no such signal from getUserMedia - a rejection is a rejection -
// so it degrades to 'blocked', which is the safer of the two: it points at
// Settings, which is where an iOS user has to go after the first refusal anyway.
export async function requestMicPermission(): Promise<MicPermission> {
  if (Platform.OS === 'android') {
    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        await askForBluetooth();
        return 'granted';
      }
      if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
      return 'denied';
    } catch {
      return 'denied';
    }
  }

  // iOS: asking for the stream IS the prompt. The track is stopped immediately
  // because this is a permission check, not the start of a session - leaving it
  // open would hold the microphone with the recording indicator lit and nothing
  // listening.
  // IMPORTED HERE RATHER THAN AT THE TOP OF THE FILE (2 October 2026).
  //
  // @livekit/react-native-webrtc calls `requireNativeComponent`, which does not
  // exist in react-native-web, so importing it at module load threw the moment
  // anything on web touched this file. Together with the same fault in
  // voice-audio-route it returned a 500 for EVERY route of the web build - which
  // is why I spent two days unable to look at a single screen before telling Ruth
  // it worked.
  //
  // A lazy import keeps one file instead of a .web.ts copy that would duplicate
  // the consent-writing logic above, which is the part that must never diverge.
  try {
    const { mediaDevices } = await import('@livekit/react-native-webrtc');
    const stream = await mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return 'granted';
  } catch {
    return 'blocked';
  }
}
