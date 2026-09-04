// Web has no LiveKit native modules, so there is no conversation to provide.
//
// A passthrough rather than a stub that throws: the app runs on web for
// development and everything that is not voice must keep working there. The
// voice control renders nothing on web (voice-control.web.tsx), so nothing ever
// asks this for a context it does not have.
export function VoiceProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
