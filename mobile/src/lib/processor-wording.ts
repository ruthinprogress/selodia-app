// WHAT THE PROCESSORS DO WITH HER WORDS, IN ONE PLACE.
//
// Ruth's own wording, 1 October 2026. She asked for this exact paragraph on the
// consent screen, the voice sheet, the privacy policy and in the DPIA.
//
// WHY IT IS A CONSTANT AND NOT FOUR PARAGRAPHS. Earlier the same evening the
// voice sheet said "The audio isn't kept." I corrected that sentence in the
// privacy policy, reported it fixed, and left the app's own copy standing in a
// different file - so at 21:15 she opened the sheet on her phone and read a
// claim my report had called corrected fifteen minutes earlier.
//
// Four copies of a sentence is four chances for one to rot, and the one that
// rots will be the one somebody is reading at the moment they decide whether to
// speak to the app at all. There is one string now. Change it here and every
// screen changes with it.
//
// THE POLICY PAGE CANNOT IMPORT THIS - it is a Next.js server component in a
// different workspace - so app/privacy/page.tsx carries the same sentences
// inline, with the surrounding detail a policy needs and a screen does not.
// scripts/check-audio-claims.mjs holds the two together and fails if either
// starts claiming the audio is not kept.
//
// WHAT IT DELIBERATELY DOES NOT SAY. Nothing about Anthropic's retention period.
// Their DPA does not authorise training and provides for deletion within 30 days
// on termination; what it does NOT state anywhere I have read is how long an
// ordinary request is held. Saying "30 days" here would be the same mistake as
// "the audio isn't kept" - a number that sounds reassuring and was never checked.
export const PROCESSOR_WORDING =
  'To understand what you write or say, Selodía sends it to Claude, an AI model made by ' +
  'Anthropic. If you use voice, what you say goes to ElevenLabs to be turned into text. ' +
  'Neither company uses it to train its AI models. ElevenLabs keeps the audio and the ' +
  'transcript for up to 3 years.';
