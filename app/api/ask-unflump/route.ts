// COMPATIBILITY SHIM. The route moved to /api/ask-selodia on 2026-09-10, when the
// last of the old product name was cleaned out of the code.
//
// WHY THIS FILE EXISTS RATHER THAN A CLEAN RENAME. The endpoint is baked into
// every JS bundle already installed - the development build on Ruth's phone and
// the preview APK that was building at the moment of the rename both call the old
// path. Renaming in place would 404 them the instant it deployed, and "the app
// stopped working" is a bad way to discover a tidy-up.
//
// It re-exports rather than redirects: a 307 would work for a fetch but loses the
// Authorization header on some clients, and this route is authenticated.
//
// SAFE TO DELETE once nothing calls it. Check the Vercel logs for requests to
// /api/ask-selodia; when a week passes with none, remove this directory. Until
// then it costs one file and no behaviour.
export { POST } from '../ask-selodia/route';
