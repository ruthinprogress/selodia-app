import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

import { getSupabaseForRequest } from '../../lib/supabase';
import { resolveCoverage } from '../../lib/classify-activity';
import { COVER_COLUMN, DIMENSIONS } from '../../lib/health-flower-dimensions';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// PLACING A SESSION THE DRAWING COULD NOT READ.
//
// Ruth, 21 October 2026, on a screenshot of "1 session is not counted here yet,
// because it could not be placed on these six":
//
//   "It needs a link for user to resolve this. Its not clear."
//
// She is right, and the line was half a feature. Saying a session is missing
// and offering nothing to do about it is worse than not saying it: she now
// knows the drawing is under-reporting and has no way to make it stop.
//
// WHY THERE IS ANYTHING LEFT TO PLACE AT ALL. Coverage is written at the
// moment a row is created, from the thirty-one-row weighting table on the
// phone or from the classifier on the server. A row whose name is in neither
// stays null, and null is honest - "not classified yet", never zero. But the
// classifier only ever runs on the path a chat turn takes. A session ticked
// off the Plans tab goes straight to the database, so an unusual name written
// there - "Pull-up practice" - has no second chance and stays null for good.
//
// THIS IS THAT SECOND CHANCE, and it is the same classifier, not a new one. It
// reads the activity_coverage dictionary first, so a name somebody has already
// paid to place costs nothing, and anything new goes in the dictionary for
// everybody. Her whole backlog is a handful of calls on the cheapest model.
//
// ALL SIX OR NONE, as everywhere else that touches these columns. A partial
// write would make a petal read low for a reason nobody could ever find.
//
// AND IT NEVER INVENTS. A name the classifier cannot place is reported back
// unplaced and stays null. The line she tapped then still tells the truth, and
// she is told which one it was, which is the part she could not see before.

/** Rows older than this are not worth a round trip; the drawing shows a year at most. */
const MAX_ROWS = 60;

export async function POST(request: NextRequest) {
  const supabase = getSupabaseForRequest(request);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // THE WINDOW SHE IS LOOKING AT, not her whole history. The count she tapped
  // was for this window, so placing more than this window would report a
  // number she never saw and leave the one she did see unexplained.
  const body = (await request.json().catch(() => null)) as {
    from?: unknown;
    to?: unknown;
  } | null;
  const from = typeof body?.from === 'string' ? body.from : null;
  const to = typeof body?.to === 'string' ? body.to : null;
  if (!from || !to) {
    return NextResponse.json({ error: 'from and to are required' }, { status: 400 });
  }

  const query = supabase
    .from('activity_logs')
    .select('id, activity_type, happened_at')
    .eq('user_id', user.id)
    .is('cover_strength', null)
    .gte('happened_at', from)
    .lt('happened_at', to)
    .order('happened_at', { ascending: false })
    .limit(MAX_ROWS);

  const { data: rows, error: readError } = await query;
  if (readError) {
    console.log('PLACE ACTIVITY READ FAILED:', readError.message);
    return NextResponse.json({ error: 'Could not read your sessions' }, { status: 500 });
  }

  const placed: { id: string; activityType: string; dimensions: string[] }[] = [];
  const stillUnplaced: { id: string; activityType: string }[] = [];

  // ONE LOOKUP PER NAME, not per row. Three "Pull-up practice" sessions are one
  // question, and the dictionary would have made the other two free anyway -
  // this just saves the round trips.
  const byName = new Map<string, typeof rows>();
  for (const row of rows ?? []) {
    const name = String(row.activity_type ?? '').trim();
    const list = byName.get(name) ?? [];
    list.push(row);
    byName.set(name, list);
  }

  for (const [name, group] of byName) {
    const coverage = name ? await resolveCoverage(supabase, anthropic, name, user.id) : null;
    if (!coverage) {
      for (const row of group) stillUnplaced.push({ id: row.id, activityType: name });
      continue;
    }

    const columns: Record<string, number> = {};
    for (const d of DIMENSIONS) columns[COVER_COLUMN[d]] = coverage[d];

    const { error: writeError } = await supabase
      .from('activity_logs')
      .update(columns)
      .eq('user_id', user.id)
      .in(
        'id',
        group.map((r) => r.id)
      );

    if (writeError) {
      // A WRITE THAT FAILED IS NOT A PLACEMENT. Reported as still unplaced,
      // because that is what the next read of the row will say.
      console.log('PLACE ACTIVITY WRITE FAILED:', writeError.message);
      for (const row of group) stillUnplaced.push({ id: row.id, activityType: name });
      continue;
    }

    // WHICH PETALS IT FED, in her words rather than six numbers. Only the ones
    // it actually reaches: a session that is 70% strength and 5% balance is a
    // strength session, and listing all six would say nothing.
    const dimensions = DIMENSIONS.filter((d) => coverage[d] >= 20);
    for (const row of group) {
      placed.push({ id: row.id, activityType: name, dimensions });
    }
  }

  return NextResponse.json({ placed, unplaced: stillUnplaced });
}
