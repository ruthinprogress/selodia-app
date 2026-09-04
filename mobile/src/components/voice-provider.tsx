import { ConversationProvider } from '@elevenlabs/react-native';

// The conversation context, mounted once at the root.
//
// WHY THE ROOT AND NOT THE CHAT SCREEN. `useConversation()` throws outside a
// provider, and a voice session has to survive navigation: somebody talking
// while they walk to the Body tab should not have the conversation torn down by
// the move. A provider inside Chat would unmount with the screen.
//
// MOUNTING IT IS INERT. It opens no socket, takes no microphone and starts no
// audio session - all of that happens inside startSession(), which only a
// deliberate long-press reaches. Voice stays off by default (Part Eighteen)
// because nothing here turns it on.
//
// THERE IS A .web.tsx BESIDE THIS FILE and it is not an optimisation. Importing
// this package runs `registerGlobals()` at module load and pulls in
// @livekit/react-native, whose native modules do not exist on web - so the web
// bundle would fail on an import it can never satisfy. Metro picks the .web
// variant automatically, the same way animated-icon and use-color-scheme
// already split.
export function VoiceProvider({ children }: { children: React.ReactNode }) {
  return <ConversationProvider>{children}</ConversationProvider>;
}
