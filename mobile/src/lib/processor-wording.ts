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
//
// TWO FACTS FROM 9 OCTOBER 2026, AND THE OLD SENTENCE CONFLATED THEM.
//
// Preparing the first store uploads meant reading the agent's own privacy block
// rather than the documents about it. It said retention_days: -1 with
// delete_audio and delete_transcript_and_pii both false. Not three years.
// Indefinite. Ruth chose 30 days; set, applied to existing conversations, and
// read back the same afternoon.
//
// I THEN REPLACED THE SENTENCE WITH "DELETED AFTER 30 DAYS" AND SHE STOPPED ME:
// "hold on, it says 3 years because that's what eleven labs said i think" -
// "check the reasoning and docs around that, as we've been here before." She was
// right, and checking changed the answer rather than confirming it.
//
// The two figures are about different things:
//   - 3 YEARS is their privacy policy: "ElevenLabs will not keep data it
//     generates about your voice longer than 3 years after your last
//     interaction with us, except as required by law." A ceiling on
//     voice-DERIVED data.
//   - retention_days is the agent setting, and their retention documentation
//     says it governs "conversation transcripts" and "audio recordings".
//
// So the sentence published since 1 October took a ceiling from one clause and
// reported it as the retention period for something else, while the thing it
// claimed to describe was set to indefinite. Wrong in the reassuring direction.
// And my replacement dropped the ceiling, which is an over-claim in the other
// direction - the precise mistake the note below this one warns about.
//
// Both sentences now, because neither covers the other. check-audio-claims.mjs
// asserts both numbers so that dropping either is a failing build and not a
// tidy-up.
export const PROCESSOR_WORDING =
  'To understand what you write or say, Selodía sends it to Claude, an AI model made by ' +
  'Anthropic. If you use voice, what you say goes to ElevenLabs to be turned into text. ' +
  'Neither company uses it to train its AI models. ElevenLabs delete the audio and the ' +
  'transcript after 30 days, and their own policy says they will not keep data they ' +
  'generate about your voice for longer than 3 years.';
