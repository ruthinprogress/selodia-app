// WHAT REACHED HER RECORD THIS TURN, RECORDED WHERE IT HAPPENS.
//
// Ruth, 1 October 2026: "Make the honesty guard's list of writes structural so a
// new writer cannot be forgotten."
//
// WHAT WENT WRONG. `falseClaimNote` compares what a reply claimed against a list
// of what actually got written. That list was assembled by hand, three hundred
// lines away from any of the writers:
//
//   const wroteThisTurn = [
//     ...attempt.landed,
//     ...(meNote ? ['me card'] : []),
//     ...(planNote ? ['plan'] : []),
//     ...
//   ];
//
// Every writer added since it was built had to remember to walk over there and
// register itself. Three did not - the allergy capture, the week entry and the
// remembered detail - so the app spent weeks telling Ruth "that did not save"
// about rows it had just written. Sardines was in her allergies the whole time.
//
// AN ARRAY IN ONE PLACE AND WRITERS IN TWENTY IS A LIST THAT GOES STALE. Not
// because anybody was careless: the array is invisible from the code you are
// actually editing when you add a writer, and nothing fails when you miss it.
// The failure is silent, and it is silent in the direction of calling her a liar
// about her own data.
//
// SO THE RECORD MOVES TO THE CALL SITE. A writer notes what it wrote on the same
// lines that wrote it - `writes.record('allergy')` directly after the insert -
// and the guard reads the log rather than a list somebody maintained. You cannot
// forget to edit a list you never open; the only way to add a write without
// recording it is to decide not to, on the line where you are already working.
//
// IT RECORDS WHAT LANDED, NEVER WHAT WAS ATTEMPTED. That distinction is the whole
// point of the guard: a failed insert must leave the log untouched so the reply's
// claim is contradicted, which is the case this was built for. Every call site
// therefore records AFTER checking the error, not before.

export type WriteLog = {
  /** Note that something genuinely reached the database. Call it after the write succeeds. */
  record: (what: string) => void;
  /** Everything recorded this turn, for the honesty guard. */
  all: () => string[];
  /** Whether anything at all was written, which is what most callers want. */
  any: () => boolean;
};

export function createWriteLog(initial: string[] = []): WriteLog {
  // A Set, because two writers naming the same thing is not two writes and the
  // guard only ever asks "was anything of this kind written".
  const written = new Set<string>(initial);
  return {
    record: (what: string) => {
      const name = what.trim();
      if (name) written.add(name);
    },
    all: () => [...written],
    any: () => written.size > 0,
  };
}
