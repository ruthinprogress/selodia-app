// THE FOUR BODY INTENTS, FOR THE SERVER. One source, not a copy.
//
// Same reasoning as app/lib/skill-ladders.ts: the module is plain TypeScript
// with no imports and no React, so it crosses the boundary by re-export rather
// than by paste. The alternative is what this project has already paid for three
// times - a list kept in two places, diverging silently, with nothing failing.
//
// `calorieFloor` matters most here. The floor under the deficit and the sentence
// that explains the floor to her must be the same number, and they are the same
// number because there is one function.
export {
  BODY_INTENTS,
  BODY_INTENT_BY_KEY,
  ABSOLUTE_FLOOR_KCAL,
  calorieFloor,
  intentFromFocus,
  explainTarget,
  type BodyIntent,
  type BodyIntentKey,
  type TargetWorking,
} from '../../mobile/src/lib/body-intent';
