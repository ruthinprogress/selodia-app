// No voice notes on web: the recorder is a native module. Rendering nothing is
// the same honest answer as voice-control.web.tsx gives for the conversation.
export function VoiceNoteButton(_: {
  onText: (text: string) => void;
  onNotice: (message: string) => void;
  disabled?: boolean;
}) {
  return null;
}
