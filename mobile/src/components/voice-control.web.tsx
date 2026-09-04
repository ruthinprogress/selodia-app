// No voice on web: the SDK is LiveKit WebRTC and its native modules do not
// exist there. Rendering nothing is the honest answer - a greyed-out mic would
// advertise a feature the platform cannot run, and Part Eighteen's whole point
// about the mic being visible is that it should be reachable.
export function VoiceControl(_: { onNotice: (message: string) => void; disabled?: boolean }) {
  return null;
}
