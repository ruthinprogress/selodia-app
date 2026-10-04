// THE FOUR SWITCHES, FOR THE SERVER. One source, not a copy.
//
// Same reasoning as body-intent.ts beside it: plain TypeScript, no imports of its
// own beyond a type, no React, so it crosses the boundary by re-export rather than
// by paste. A copy here would be the fifth list kept in two places, and the first
// one where a drift changes somebody's calorie figure rather than a label.
//
// WHY THE SERVER NEEDS IT AT ALL. Build muscle alone is 5% over what she uses and
// Maintain + Build is not, and both store fat=maintain, muscle=increase. Chat
// reads the focus columns, so without body_mode it cannot tell the two apart and
// would quote a figure her phone does not show.
export {
  NO_MODE,
  WEIGHT_KEYS,
  isEmpty,
  modeFromRecord,
  modeLabel,
  weightDirectionStated,
  type BodyMode,
} from '../../mobile/src/lib/body-mode';
