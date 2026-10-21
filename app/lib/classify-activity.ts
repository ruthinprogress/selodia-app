import type Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';

import { ACTIVITY_WEIGHTS, coverageFor, type Coverage } from './activity-weights';
import { recordModelUsage } from './usage-record';

// THE CLASSIFIER THE COMMENTS PROMISED AND NOBODY BUILT.
//
// activity-logging.ts has said since September that an activity the weighting
// table does not hold is "unclassified until the classifier can judge them".
// There was no classifier. `cover_strength` is written in exactly one place in
// this codebase, from a table lookup, so any activity whose name is not one of
// thirty-one broad types got six nulls and counted for nothing in the Health
// Flower - from the chat, from the phone, from everywhere.
//
// Measured in Ruth's own record on 21 October 2026: 14 of 48 logged sessions,
// including every "Full-Body Barbell Strength Plan", every "Pull-up practice",
// "star jumps", "skipping" and "rope climbing". Nearly a third of her movement
// was invisible to the drawing whose entire job is to show what her movement is
// protecting - and invisible silently, which is why it took a year to notice.
//
// PAID FOR ONCE PER NAME, FOR EVERYBODY. The answer goes in activity_coverage,
// keyed on the lowercased name with no user attached, so the second person to
// log "reformer pilates" costs nothing. Ruth's whole backlog is about a dozen
// calls on the cheapest model, once.
//
// IT IS ANCHORED ON THE TABLE, NOT ON THE MODEL'S OWN IDEA OF EXERCISE. The
// prompt carries the real definitions and a sample of the real rows, so a new
// name is placed on the SAME scale as the thirty-one. Without that, "skipping"
// gets judged against whatever the model thinks 100 means and the flower ends
// up with two different scales in it.
//
// AND THE WEIGHTINGS ARE STILL ESTIMATES AWAITING REVIEW. SELODIA_SPEC.md Part
// Eight says so of the hand-written table, and it is no less true of these.
// Nothing here is cited to anybody; the explainer already says the numbers are
// under expert review, and that sentence now covers these too.

const MODEL = 'claude-haiku-4-5-20251001';

/** The six, as the table stores them. */
const DIMENSION_NOTES = [
  'strength: muscular force production and resistance to load',
  'cardio: cardiovascular and respiratory endurance, heart and lung work',
  'flexibility: range of motion at joints',
  'balance: postural stability and neuromuscular control',
  'bone: mechanical loading of the skeleton, which needs impact or heavy load',
  'recovery: active restoration, parasympathetic activity, rest',
].join('\n');

/** A handful of real rows, so a new name lands on the same scale. */
function anchors(): string {
  const pick = ['running', 'yoga', 'weightlifting', 'swimming', 'walking', 'pilates', 'rest day (intentional)'];
  return pick
    .filter((k) => ACTIVITY_WEIGHTS[k])
    .map((k) => {
      const c = ACTIVITY_WEIGHTS[k];
      return `${k}: strength ${c.strength}, cardio ${c.cardio}, flexibility ${c.flexibility}, balance ${c.balance}, bone ${c.bone}, recovery ${c.recovery}`;
    })
    .join('\n');
}

function whole(n: unknown): number | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  const v = Math.round(n);
  return v >= 0 && v <= 100 ? v : null;
}

/** All six or nothing. A half-classified row is worse than an unclassified one. */
function readCoverage(raw: unknown): Coverage | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const out = {
    strength: whole(r.strength),
    cardio: whole(r.cardio),
    flexibility: whole(r.flexibility),
    balance: whole(r.balance),
    bone: whole(r.bone),
    recovery: whole(r.recovery),
  };
  if (Object.values(out).some((v) => v == null)) return null;
  return out as Coverage;
}

/** The dictionary key: the name as typed, lowercased and trimmed. */
export function nameKey(activityType: string): string {
  return activityType.trim().toLowerCase();
}

/**
 * What an activity covers, from the table, the dictionary, or the model.
 *
 * THE ORDER MATTERS AND IS THE WHOLE DESIGN. The hand-written table first,
 * because it is reviewed and free. Then the dictionary, because somebody has
 * already paid for this name. Only then the model, and what it says is written
 * to the dictionary so nobody pays for that name again.
 *
 * IT NEVER THROWS. A classification that fails leaves the row unclassified,
 * which is exactly where it would have been anyway - this must not be able to
 * cost somebody their log.
 */
export async function resolveCoverage(
  db: SupabaseClient,
  anthropic: Anthropic,
  activityType: string | null | undefined,
  userId: string | null
): Promise<Coverage | null> {
  const known = coverageFor(activityType);
  if (known) return known;
  const key = nameKey(activityType ?? '');
  if (!key) return null;

  try {
    const { data: cached } = await db
      .from('activity_coverage')
      .select('cover_strength, cover_cardio, cover_flexibility, cover_balance, cover_bone, cover_recovery')
      .eq('name_key', key)
      .maybeSingle();
    if (cached) {
      return {
        strength: cached.cover_strength as number,
        cardio: cached.cover_cardio as number,
        flexibility: cached.cover_flexibility as number,
        balance: cached.cover_balance as number,
        bone: cached.cover_bone as number,
        recovery: cached.cover_recovery as number,
      };
    }
  } catch {
    // A dictionary that cannot be read is not a reason to refuse to classify.
  }

  let coverage: Coverage | null = null;
  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content:
            'You are placing one physical activity on a fixed six-dimension scale used by a health app.\n\n' +
            'THE SIX DIMENSIONS:\n' +
            DIMENSION_NOTES +
            '\n\nEach is 0 to 100: how much ONE TYPICAL SESSION of this activity contributes to that dimension. ' +
            'They are independent - they do not add up to 100, and an activity may be high in several or in none.\n\n' +
            'USE THESE EXISTING ENTRIES AS THE SCALE. Your answer must be consistent with them:\n' +
            anchors() +
            '\n\nRULES. Judge the activity as it is named, not as its best possible version. ' +
            'Bone loading needs impact or heavy load - swimming and cycling are near zero however hard they are. ' +
            'Recovery is restoration, not "easy": a gentle run is still cardio, not recovery. ' +
            'If the name describes a PLAN or a programme rather than a session ("Full-Body Barbell Strength Plan"), ' +
            'judge one typical session of it. ' +
            'If the name is too vague to place at all, return null.\n\n' +
            'Reply with ONLY JSON: {"strength":n,"cardio":n,"flexibility":n,"balance":n,"bone":n,"recovery":n} or null.\n\n' +
            'Activity: "' +
            (activityType ?? '') +
            '"',
        },
      ],
    });
    // COUNTED AGAINST WHOEVER TRIGGERED IT, when there is somebody to count it
    // against. The backfill runs without a user and the call still has to be
    // recorded as spend, so it is attributed to nobody rather than skipped.
    if (userId) recordModelUsage({ userId, call: 'extraction', model: MODEL, usage: message.usage });
    const text = message.content[0]?.type === 'text' ? message.content[0].text : '';
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    coverage = readCoverage(JSON.parse(cleaned));
  } catch {
    return null;
  }
  if (!coverage) return null;

  try {
    await db.from('activity_coverage').upsert(
      {
        name_key: key,
        cover_strength: coverage.strength,
        cover_cardio: coverage.cardio,
        cover_flexibility: coverage.flexibility,
        cover_balance: coverage.balance,
        cover_bone: coverage.bone,
        cover_recovery: coverage.recovery,
        classified_by: MODEL,
      },
      { onConflict: 'name_key' }
    );
  } catch {
    // Worth having the answer for this turn even if it cannot be kept.
  }
  return coverage;
}
