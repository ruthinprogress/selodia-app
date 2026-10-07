// WHERE A SIGN-UP CAME FROM.
//
// Ruth, 7 October 2026: each article links to selodia.app with its own tag -
// selodia.app/?src=post-01 - and the tag is kept with the sign-up so the daily
// log can say which writing actually brought people in.
//
// ITS OWN FILE because it is the only pure function on that page and the page is
// a .tsx, which the checks' resolver cannot load. A guard that cannot be run is
// not a guard.

/**
 * The tag a sign-up arrived with, or null for the plain homepage.
 *
 * SANITISED RATHER THAN TRUSTED. This is a query string a stranger controls and
 * it is about to be written to the one publicly writable table in the schema:
 * `waitlist` allows INSERT to anyone and grants no SELECT at all, which is the
 * right shape for a sign-up form and exactly why what goes in has to be bounded.
 *
 * ANYTHING THAT IS NOT A SHORT LOWERCASE SLUG BECOMES NULL, which reads as the
 * homepage. That is the same answer a missing tag gets, and it is a true one: a
 * sign-up with a mangled tag did come from somewhere nobody can name. It never
 * rejects the sign-up itself, because the person is not the thing in doubt.
 *
 * The column carries the same rule as a CHECK constraint. Two guards for one
 * fact is usually a fault in this repository; here they do different jobs. This
 * one is friendly and always lets somebody join. The database's is the one that
 * holds when this one is wrong.
 */
export function sourceTag(raw: unknown): string | null {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!v || v.length > 40) return null;
  return /^[a-z0-9][a-z0-9-]*$/.test(v) ? v : null;
}
