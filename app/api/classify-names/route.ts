import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

import { getSupabaseForRequest } from '../../lib/supabase';
import { resolveCoverage } from '../../lib/classify-activity';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// WHAT A PLANNED SESSION COVERS, BEFORE IT HAS BEEN DONE.
//
// Ruth, 22 October 2026, on the Week's flower: "The flower in Week saying stuff
// isn't included because it's not been logged yet... reads a bit crazy right
// now, and its not clear why."
//
// It read oddly because it was describing an app limit as if it were a fact
// about her week. The paragraph named five planned sessions and said they were
// not in the drawing, which on a screen headed "If the week goes to plan" is
// the drawing admitting it has not drawn the plan.
//
// WHY IT WAS EVER TRUE. The Week could not make AI calls - week-coverage-lookup
// says so plainly: "doing that lookup on every Overview render would be an AI
// call per unmatched activity every time the screen opens." So it read
// classifications back out of rows she had already logged, and anything she had
// never logged stayed unknown.
//
// WHAT CHANGED. activity_coverage, built on 21 October: a dictionary keyed on
// the name alone, with no user attached. resolveCoverage reads the hand-written
// table first, then that dictionary, and only then asks the model - and writes
// what it learns back. So the expensive case is once per NAME EVER, for
// everybody, rather than once per screen.
//
// IT IS STILL NOT A GUESS. Nothing here infers coverage from a similar name.
// A name the model cannot place comes back null and the Week says so, which is
// the one case where saying so is worth her reading.
//
// AND IT WRITES NOTHING OF HERS. No activity_logs row is touched: this answers
// what a NAME covers, for a plan that has not happened yet.

/** A week holds a handful of sessions. More than this is not a week. */
const MAX_NAMES = 20;

export async function POST(request: NextRequest) {
  const supabase = getSupabaseForRequest(request);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { names?: unknown } | null;
  const names = Array.isArray(body?.names)
    ? [...new Set(body.names.map((n) => String(n ?? '').trim()).filter(Boolean))].slice(0, MAX_NAMES)
    : [];
  if (names.length === 0) {
    return NextResponse.json({ coverage: {} });
  }

  // KEYED ON THE NAME AS ASKED, so the caller can write the answer straight
  // back onto the card it came from without re-deriving anything.
  const coverage: Record<string, unknown> = {};
  for (const name of names) {
    coverage[name] = await resolveCoverage(supabase, anthropic, name, user.id);
  }

  console.log(
    'CLASSIFY NAMES:',
    JSON.stringify({ asked: names.length, placed: Object.values(coverage).filter(Boolean).length })
  );

  return NextResponse.json({ coverage });
}
