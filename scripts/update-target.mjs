// WHICH BRANCH REACHES RUTH'S PHONE. One declaration, read by the publisher and
// by the check, so the two cannot disagree.
//
// Ruth, 10 October 2026, looking at her Settings screen: "Update 01a11712 - 7
// Oct 16:53 - thats the latest update.....i don't think youre publishing to the
// right place."
//
// She was right. Two full days of work - five bug fixes, the Health Flower, the
// cycle bars, the symptom list - published cleanly to `production` and reached
// nobody, because the only build she has installed is an internal APK on the
// `preview` channel. The same fault was diagnosed on 1 October and a check was
// written for it the same day. The check passed every night while this happened,
// because its first line was:
//
//     const BRANCH = process.argv[2] ?? 'preview';
//
// So it answered "WOULD publishing to preview reach her?" - yes, always - and
// never "DID the thing I published go there?". A check whose subject is a
// hypothesis cannot fail for the real reason.
//
// The branch now lives here instead of in an argv default, and the check asserts
// the newest update in the whole project is on it. Publish anywhere else and that
// fails on the next run.

/** The branch her installed build listens to, via the channel of the same name. */
export const DELIVERY_BRANCH = 'preview';

/**
 * Why this branch and not `production`:
 *
 * her phone has an internal-distribution APK (profile `preview`, version code 1,
 * built 1 October), and an installed build only ever sees the branch its own
 * channel points at. `production` exists for the Play bundle, which is on the
 * internal testing track with an empty tester list - so it is installed on no
 * device at all. Publishing there is writing to a drawer nobody opens.
 *
 * THIS CHANGES THE DAY SHE INSTALLS FROM PLAY. Once her phone runs the store
 * build, its channel is `production` and this constant moves with it. Until then
 * `production` is a ghost and `preview` is the only branch with a listener.
 */
export const WHY = 'her installed build is an internal APK on the preview channel';
