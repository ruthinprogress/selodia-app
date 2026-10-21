// LOOKING A MOVEMENT UP, INSTEAD OF CARRYING ALL 950 OF THEM EVERYWHERE.
//
// Ruth, 21 October 2026, choosing between three ways of dealing with the
// prompt's biggest block: "do option 1, make it a tool - i'm assuming this
// means it's like a database it can go to when needed. we grow the database of
// illustrations and videos over time."
//
// That is exactly it, and the second sentence is the better half of the
// reason. FILMED_MOVEMENTS is a generated constant: every upload meant
// regenerating a 27,573-character string into the prompt and paying to send it
// again on every turn after that. A library that is queried grows by having
// something put in it.
//
// WHAT IT WAS COSTING, measured from model_usage rather than guessed: $72.32 of
// model calls over thirty days, 42% of it cache WRITES, and this one block is
// ~7,659 of the tokens written each time the cache went cold. About $15 of the
// $72 was a list of exercise names, sent whether the turn was about building a
// workout or about her period starting.
//
// SEARCH IS NOT RESOLUTION, AND THE DIFFERENCE IS THE WHOLE DESIGN HERE.
// movement-demos.ts matches a saved plan's exercise name to a clip and is
// strict on purpose - an exact name or an exact word set, never a near miss,
// because a confidently wrong demonstration is a form fault. THIS is the other
// thing: the model knows what movement it wants and is asking what the library
// calls it. A loose match is correct here, because the model reads the
// candidates and chooses. Nothing is resolved from this, and nothing is shown
// to anybody from this - it only tells the model which names are real.
//
// SO THE ONE RULE THAT SURVIVES IS THE OLD ONE: a name that is not in the
// library is not a name. The tool exists so the model can find out, rather than
// having to be told 950 of them in advance and trusted to remember.

/** A library entry, as the search knows it. */
export type MovementEntry = {
  joinKey: string;
  muscleGroup: string;
  /** True when Selodía has drawn this one, which the model uses as a tie-break. */
  drawn?: boolean;
};

export type MovementHit = {
  name: string;
  muscleGroup: string;
  drawn: boolean;
};

export type MovementSearchResult = {
  lookingFor: string;
  hits: MovementHit[];
};

// "pose" AND "stretch" ARE NOT NOISE. Stripping them was a measured mistake in
// scope-illustration-gaps.mjs: with them gone "Mountain pose" matched "mountain
// climber" and "Bridge pose" matched "plate glute bridge to pullover". Only the
// grammar goes, and only where it cannot be the whole of a name.
const STOP = new Set(['the', 'a', 'an', 'to', 'with', 'and', 'of', 'on', 'for', 'in']);

/** The meaningful words of a name, lowercased. */
export function words(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOP.has(w));
}

/**
 * How well a library name answers what was asked for.
 *
 * THE SCALE IS DELIBERATELY COARSE, because this is a shortlist for a model to
 * read, not a ranking anybody sees. Every meaningful word present beats most
 * words present beats some; a shorter name wins a tie, because the extra words
 * in a library name are usually equipment ("band two legs calf raise - (band
 * under both legs) version 2") and the plainer entry is the one somebody wants
 * on their card.
 */
export function score(query: string[], name: string): number {
  if (query.length === 0) return 0;
  const have = new Set(words(name));
  // SPACING IS NOT MEANING. "deadbug" and "dead bug" are one movement, and the
  // first run of this returned NOTHING FILMED for "deadbug" while the library
  // held "dead bug" - a real movement reported as absent because of a space.
  const glued = [...have].join('');
  let matched = 0;
  for (const w of query) if (have.has(w) || (w.length > 5 && glued.includes(w))) matched += 1;
  if (matched === 0) return 0;

  // HALF THE WORDS IS NOT A MATCH, and this is the line that keeps the search
  // honest. Measured on the real library: "bird dog" matched "3 leg dog pose"
  // and "downward dog toe to heel" on the strength of the word dog, and "hip
  // hinge" came back full of hip thrusts. Both are the fault this project calls
  // the worst one available - a confidently wrong demonstration, which somebody
  // then copies.
  //
  // A MISS COSTS ALMOST NOTHING BY COMPARISON. The prompt has always said a
  // plan with no demonstrations is a perfectly ordinary plan, and the tool says
  // so again in its answer. So the bar is set where a miss is cheap and a wrong
  // hit is not: every word, or a clear majority of them.
  if (matched / query.length < 0.6) return 0;

  // All of them is worth far more than most of them, so an exact phrase always
  // outranks a name that merely shares most words with it.
  const completeness = matched === query.length ? 1000 : Math.round((matched / query.length) * 500);
  // Then the plainest name that achieved it.
  return completeness - Math.min(have.size, 40);
}

/**
 * Search the library for each phrase, independently.
 *
 * EACH PHRASE GETS ITS OWN ANSWER rather than one merged list, because the
 * model asks for the movements of a whole session at once - "hip hinge",
 * "calf raise", "glute bridge" - and needs to know which of them the library
 * actually has. A merged list would let a well-covered phrase hide an empty
 * one, and an empty one is the single most useful thing this can report: it
 * means build the plan around something else.
 */
export function searchMovements(
  library: MovementEntry[],
  lookingFor: string[],
  perPhrase = 6
): MovementSearchResult[] {
  return lookingFor.map((phrase) => {
    const query = words(phrase);
    const scored = library
      .map((entry) => ({ entry, s: score(query, entry.joinKey) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.entry.joinKey.localeCompare(b.entry.joinKey))
      .slice(0, perPhrase);
    return {
      lookingFor: phrase,
      hits: scored.map(({ entry }) => ({
        name: entry.joinKey,
        muscleGroup: entry.muscleGroup,
        drawn: entry.drawn === true,
      })),
    };
  });
}

/** Everything in one body area, for a model that wants to browse rather than aim. */
export function byMuscleGroup(
  library: MovementEntry[],
  group: string,
  limit = 60
): MovementHit[] {
  const want = group.trim().toLowerCase();
  return library
    .filter((e) => e.muscleGroup.toLowerCase() === want)
    .slice(0, limit)
    .map((e) => ({ name: e.joinKey, muscleGroup: e.muscleGroup, drawn: e.drawn === true }));
}

/**
 * What the model is handed back.
 *
 * PLAIN LINES, NOT JSON. It is read by a language model and then thrown away,
 * and the JSON would spend a third of its tokens on punctuation.
 *
 * A PHRASE WITH NOTHING IS SAID OUT LOUD. "nothing filmed" is the answer that
 * changes what it does next, and an empty list it has to notice the absence of
 * is an answer it will skim past.
 */
export function formatResults(results: MovementSearchResult[]): string {
  const lines: string[] = [];
  for (const r of results) {
    if (r.hits.length === 0) {
      lines.push(`${r.lookingFor}: NOTHING FILMED. Use it anyway if it is the right movement - it simply arrives without a demonstration.`);
      continue;
    }
    lines.push(
      `${r.lookingFor}: ${r.hits
        .map((h) => (h.drawn ? `${h.name} [drawn]` : h.name))
        .join('; ')}`
    );
  }
  return lines.join('\n');
}
