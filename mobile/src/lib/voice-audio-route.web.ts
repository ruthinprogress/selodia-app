// THE WEB BUILD HAS NO NATIVE AUDIO SESSION, AND SAYING SO FIXES EVERY ROUTE.
//
// Ruth, 2 October 2026: "Please fix your screens view that stops you seeing
// screens."
//
// WHAT WAS BROKEN, AND HOW WIDELY. `voice-audio-route.ts` imports AudioSession
// from @livekit/react-native at module load. That package calls
// `requireNativeComponent`, which does not exist in react-native-web, so the
// import throws. app/_layout.tsx mounts VoiceProvider, VoiceProvider imports this
// file, and the root layout is loaded for EVERY route - so every single page of
// the web build returned a 500 with "(0 , _reactNative.requireNativeComponent) is
// not a function", and the stack was entirely inside Expo's bundled renderer so
// nothing named the culprit.
//
// WHY IT MATTERS MORE THAN A BROKEN PREVIEW. It is the reason I spent two days
// telling Ruth features worked without ever looking at one. Every "done" rested
// on a typecheck, a script reading my own source as text, or a database query.
// The blob-shaped cards she found this evening were a 999px border radius on a
// tall container - invisible in source, obvious in one screenshot. So was the
// Continue button sitting at the top of a screen whose last line says "Saved when
// you tap Continue".
//
// METRO PICKS THIS FILE ON WEB AUTOMATICALLY, by the `.web.ts` suffix. Native
// builds never see it and keep the real implementation, so the headphone routing
// on her phone is untouched.
//
// IT IS A NO-OP RATHER THAN A POLYFILL, deliberately. There is no voice session on
// web to route audio for, and a web implementation that pretended otherwise would
// be a second thing to keep in step with the real one.

/**
 * On a native build this starts an audio session and routes voice to headphones
 * when they are connected. On web there is no session and nothing to route, so
 * this does nothing and says so rather than throwing.
 */
export function routeVoiceToHeadphones(): void {
  // Intentionally empty. See the header.
}
