// THE THIRD KIND OF INFORMATION (Ruth, 2026-09-18).
//
// Her framing, and it is the right one: "there are three kinds of information -
// planned movement completed, planned movement adapted, and additional movement
// not originally in the routine." The first two have had a home since this
// screen was built. The third had none, and was landing in the session note -
// "I added 20 minutes of climbing" filed as a remark about squats.
//
// So an additional movement is recorded AS MOVEMENT: its own row in the same
// session, named in her words. It costs nothing structurally - the completion
// log has always taken a free-text movement name - and it means the record of a
// day contains everything she moved through, not only the parts somebody wrote
// down in advance.
//
// WHY IT SPLITS AT ALL. "Added 3x10 box jumps, ballet hip pulses, finished with
// stretching" is three things she did, and keeping it as one string would make
// it one strangely-named movement. The split is deliberately dull - line breaks,
// semicolons and commas - because anything cleverer would start inventing
// boundaries inside "hip pulses with leg in second, pushing up a medicine ball".

/** Nobody does twenty extra movements; past this it is prose, not a list. */
const MAX_ADDITIONAL = 8;

export function splitAdditional(text: string): string[] {
  return text
    .split(/[\n;,]+/)
    .map((part) =>
      part
        .trim()
        // The lead-in is how people speak, not part of the movement's name:
        // "added box jumps" and "box jumps" are the same thing done.
        .replace(/^(?:and\s+)?(?:i\s+)?(?:also\s+)?(?:added|did|finished with|plus)\s+/i, '')
        .replace(/\.$/, '')
        .trim()
    )
    .filter((part) => part.length > 2)
    .slice(0, MAX_ADDITIONAL);
}
