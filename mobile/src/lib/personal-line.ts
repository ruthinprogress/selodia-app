// The Overview personal line (build item 32, first version). A curated MVP set
// under the hard tone constraint (SELODIA_SPEC.md, The Overview Personal Line):
// never a slogan or affirmation, no "we"/"us" ownership language — a quiet,
// trusted-friend reminder of the philosophy. Rotation is DAILY (stable through
// a calendar day, not flickering on every open). The fuller data-specific
// personalization remains separate future work; this is the curated rotation.

export const PERSONAL_LINE_MVP: string[] = [
  "Helping you notice yourself.",
  "You don't have to remember everything.",
  "Nothing worth remembering gets lost.",
  "Understanding takes time.",
  "Patterns emerge with attention.",
  "There's no rush.",
  "Every observation matters.",
  "Small moments become understanding.",
  "Nothing to prove today.",
  "Staying curious is enough.",
  "Your understanding is building, piece by piece.",
  "Your Almanac grows with you.",
  "Your life is the context.",
  "What works for you is starting to show.",
  "One observation at a time.",
  "Your patterns belong to you.",
  "There's more here to discover.",
  "Getting curious about yourself.",
  "You already know more than you think.",
  "Just paying attention, that's all this is.",
  "This is your story.",
  "Some things are worth remembering.",
  "You don't need to carry it all.",
  "Your experiences are being held.",
  "Understanding yourself is a lifelong practice.",
  "Every person is different. That's the point.",
  // FIVE MORE, 25 September 2026, and they are better than most of the
  // twenty-six above them. They pass the same test the set was written to: an
  // observation about how bodies and understanding work, never a slogan and
  // never an instruction. "Your body isn't asking to be fixed today" is the
  // whole app in seven words.
  //
  // "Small observations become lifelong knowledge" sits down here rather than
  // beside "Small moments become understanding", which it nearly is: the
  // rotation walks this array in order, so two near-twins placed together
  // would come up on consecutive mornings and read as the app repeating
  // itself.
  "Your body has remembered how to keep you alive for decades.",
  "Bodies whisper long before they shout.",
  "Your body isn't asking to be fixed today.",
  "Data becomes understanding through patience.",
  "Small observations become lifelong knowledge.",
];

// A genuine exception, not a rotation member: the true day-one line, shown only
// when the user has ZERO logged entries ever (no measurements, no food, no
// activity). That moment is functionally different — orientation for a
// first-time user, vs. the ambient rotation for someone already using the app —
// the same honest empty-state treatment the Almanac's empty state uses. Every
// day after the first entry, the 26-phrase rotation applies.
export const PERSONAL_LINE_DAY_ONE = "Welcome. Nothing logged yet. Whenever you're ready.";

// Deterministic per calendar day: the same phrase all day, the next one
// tomorrow. Uses local midnight so it turns over at the user's midnight.
export function pickDailyPersonalLine(now: Date = new Date(), phrases: string[] = PERSONAL_LINE_MVP): string {
  const n = phrases.length;
  if (n === 0) return '';
  const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayNum = Math.floor(localMidnight.getTime() / 86_400_000);
  return phrases[((dayNum % n) + n) % n];
}
