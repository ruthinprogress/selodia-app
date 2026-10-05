// WHERE SHE IS WITH PERIODS, FOR THE SERVER. One source, not a copy.
//
// Same reasoning as body-mode.ts and body-intent.ts beside it: plain TypeScript,
// no React, so it crosses the boundary by re-export rather than by paste.
//
// WHY IT EXISTS NOW, 5 October 2026. Her hormone question used to have one chip
// for "Hormonal contraception", and life-stage-facts.ts asked for it by name:
// `use.includes('hormonal_contraception')`. Her wording split that into "The
// pill" and "Hormonal coil", because nobody says hormonal contraception, and a
// copper coil is not hormonal at all.
//
// A LINE THAT NAMES A VALUE CANNOT SURVIVE THE VALUE BEING SPLIT, and it does not
// fail when it stops being true: it goes on answering false for everybody on the
// pill, which is the single most useful thing the question buys. So what counts
// as contraception is one list in one file, and the server reads the same one the
// app writes.
export { CONTRACEPTION_VALUES, onContraception, type HormoneUse } from '../../mobile/src/lib/life-stage';
