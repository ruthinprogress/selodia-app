import type { Coverage } from '@/lib/activity-weights';
import { COVER_COLUMN, DIMENSIONS } from '@/lib/health-flower';
import { supabase } from '@/lib/supabase';

// WHAT HER OWN LOGS ALREADY KNOW.
//
// Ruth, 20 October 2026, on being told that "Pull-up practice" was not in the
// weighting table and so counted for nothing: "why?"
//
// THE HONEST ANSWER IS THAT THE TABLE IS THIRTY-ONE BROAD ACTIVITY TYPES -
// ballet, yoga, rock climbing, rowing - and "Pull-up practice" is an exercise,
// not an activity type. Anything the table does not hold is classified by an AI
// call on the SERVER, once, at the moment it is logged, and the six resulting
// percentages are written onto that activity_logs row. app/lib/activity-weights
// says why it happens there: "doing that lookup on every Overview render would
// be an AI call per unmatched activity every time the screen opens".
//
// So the answer to "why not" was never that the work is impossible. It is that
// the Week screen cannot make AI calls cheaply. But it does not need to: if she
// has ever logged the thing, the answer is already sitting in her own rows,
// worked out properly, paid for once.
//
// IT IS A LOOKUP, NOT A GUESS. Nothing here infers anything. It reads a
// classification the server already made for an activity of exactly that name,
// and uses it for the card of exactly that name. A card she has never logged
// stays unknown and is still said out loud.

/** The lowercased activity name, to the coverage her log already carries. */
export type KnownCoverage = Record<string, Coverage>;

/**
 * Look up coverage for activity names the weighting table does not hold.
 *
 * ONLY THE NAMES ASKED FOR, and nothing when there are none - so a week of
 * ordinary activities costs no query at all.
 *
 * NEWEST WINS. The same name can appear many times; the most recent
 * classification is the one the server would use today.
 */
export async function knownFromLogs(names: string[]): Promise<KnownCoverage> {
  const wanted = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (wanted.length === 0) return {};

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  // SPELLED OUT RATHER THAN BUILT, because supabase-js parses the select
  // string at TYPE level and a template literal it cannot read collapses the
  // whole result to a parser error. The cost is a list that could drift from
  // COVER_COLUMN, so the line below refuses to run if it ever does - the check
  // is three lines and the alternative is a silently empty lookup.
  const SELECT =
    'activity_type, happened_at, cover_strength, cover_cardio, cover_flexibility, cover_balance, cover_bone, cover_recovery';
  for (const d of DIMENSIONS) {
    if (!SELECT.includes(COVER_COLUMN[d])) {
      console.log(`WEEK COVERAGE: the select is missing ${COVER_COLUMN[d]}`);
      return {};
    }
  }

  const { data, error } = await supabase
    .from('activity_logs')
    .select(SELECT)
    .eq('user_id', user.id)
    .in('activity_type', wanted)
    // NOT NULL ON ONE COLUMN IS ENOUGH: the classifier writes all six or none,
    // and an unclassified row carries null rather than zero. See health-flower,
    // which makes the same distinction for the same reason - a rest day
    // genuinely gives 0 to strength, and an unclassified row gives unknown.
    .not(COVER_COLUMN.strength, 'is', null)
    .order('happened_at', { ascending: false })
    .limit(200);

  if (error || !data) return {};

  const out: KnownCoverage = {};
  for (const row of data as Record<string, unknown>[]) {
    const name = String(row.activity_type ?? '').trim().toLowerCase();
    if (!name || out[name]) continue; // newest first, so the first wins
    const coverage = {} as Coverage;
    let whole = true;
    for (const d of DIMENSIONS) {
      const v = row[COVER_COLUMN[d]];
      if (typeof v !== 'number') {
        whole = false;
        break;
      }
      coverage[d] = v;
    }
    // ALL SIX OR NONE. A half-classified row would quietly understate every
    // dimension it is missing, which is the fault health-flower.ts calls out
    // by name: counting unknown as zero.
    if (whole) out[name] = coverage;
  }
  return out;
}
