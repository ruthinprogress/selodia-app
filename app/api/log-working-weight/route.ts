import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseForRequest } from '../../lib/supabase';
import { logWorkingWeight } from '../../lib/workout-logs';

// Logging a working weight (build item 35, slices B + E).
//
// A route rather than a direct client insert, for consistency with the
// completion tick and so validation lives in one place: logWorkingWeight
// already rejects negatives, non-finite values and absurd magnitudes, and
// duplicating that client-side would mean two implementations to keep honest.
//
// APPEND-ONLY. This never updates a previous row - the plan displays
// current = latest, and progressive overload depends on the history being kept
// rather than overwritten (Part Ten).

export async function POST(request: NextRequest) {
  const supabase = getSupabaseForRequest(request);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const { planId, exerciseName, weightKg } = body as Record<string, unknown>;
  const name = typeof exerciseName === 'string' ? exerciseName.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'exerciseName required' }, { status: 400 });
  }

  // Accept a numeric string as well as a number: the control lets the value be
  // typed, so "62.5" is an entirely ordinary thing to receive.
  const kg = typeof weightKg === 'number' ? weightKg : Number(weightKg);

  const ok = await logWorkingWeight(supabase, user.id, {
    planId: typeof planId === 'string' && planId.length > 0 ? planId : null,
    exerciseName: name,
    weightKg: kg,
  });

  if (!ok) {
    return NextResponse.json({ error: 'Could not record that weight' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
