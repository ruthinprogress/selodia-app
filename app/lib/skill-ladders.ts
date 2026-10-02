// THE LADDERS, FOR THE SERVER. One source, not a copy.
//
// Ruth, Skills brief item 1: "Do not create duplicate storage. This team has
// already built a second system for something that existed."
//
// The curated ladders live in the mobile app because that is where they were
// written and where the setup screen renders them. Chat now needs them too - it
// must add a skill WITH its ladder, and must say so plainly when no curated
// ladder exists - and the obvious move was to paste them into app/lib. That is
// the pattern this codebase has been bitten by three times already: a list kept
// in two places diverges silently, and nothing fails when it does. The
// muscle-up wording Ruth approved yesterday would have been correct on her
// phone and stale in chat, or the reverse.
//
// So this re-exports across the boundary instead. The ladder module is plain
// TypeScript with no imports and no React, which is what makes that safe:
// nothing in it needs a bundler, a native module or a DOM.
//
// scripts/check-skill-ladders-shared.mjs fails if a second copy of the data
// appears anywhere, because the next person to need these on the server will
// reach for a paste, exactly as I did.

export {
  LADDERS,
  LADDER_BY_KEY,
  CLIP_GAPS,
  placeRungs,
  type Ladder,
  type LadderRung,
  type Placement,
  type Stage,
} from '../../mobile/src/lib/skill-ladders';
