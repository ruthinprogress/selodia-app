import { AudioSession } from '@livekit/react-native';

// VOICE GOES TO YOUR HEADPHONES WHEN YOU ARE WEARING THEM (Ruth's bug list,
// item 7, 18 September: "Voice does not route to headphones. Audio comes out of
// the phone speaker with headphones connected").
//
// THE CAUSE IS NOT IN THIS APP. The ElevenLabs React Native SDK (1.2.26)
// configures the audio session for every call with
//
//     android: { preferredOutputList: ["speaker"], ... }
//
// A preference list with one entry has only one answer, so Android routes the
// call to the loudspeaker whatever is plugged in or paired. LiveKit's own
// default order, which the SDK throws away, is exactly the right one:
// Bluetooth, then a wired headset, then the speaker.
//
// HOW IT IS FIXED WITHOUT TOUCHING THE LIBRARY. The SDK calls
// AudioSession.configureAudio by property access at the moment a call starts,
// and that property is a writable static on the one shared LiveKit module. So
// it is wrapped once, here, and every configuration the SDK sends has its
// output order corrected on the way through. Nothing else in what it asks for
// is changed. Patching node_modules instead would be undone by the next
// install without anybody noticing, and this would still be broken.
//
// THE EARPIECE IS LEFT OUT DELIBERATELY. It is the fourth entry in LiveKit's
// default, and it is the right fallback for a phone call held to the ear. A
// voice conversation with an app is not held to the ear, so with nothing
// connected it should stay on the speaker, as it always has.
//
// iOS NEEDS NOTHING. There the SDK's `defaultOutput: "speaker"` only chooses
// between the speaker and the earpiece, and iOS already prefers a connected
// headset or Bluetooth device over both.

const PREFERRED_OUTPUT: ('bluetooth' | 'headset' | 'speaker')[] = ['bluetooth', 'headset', 'speaker'];

let installed = false;

export function routeVoiceToHeadphones(): void {
  if (installed) return;
  installed = true;

  const original = AudioSession.configureAudio;
  AudioSession.configureAudio = async (config) =>
    original({
      ...config,
      ...(config.android
        ? { android: { ...config.android, preferredOutputList: PREFERRED_OUTPUT } }
        : {}),
    });
}
