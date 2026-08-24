import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseForRequest } from '../../lib/supabase';
import { logCompletion } from '../../lib/workout-logs';
import type { EccentricLoad, PlanIntensity } from '../../lib/almanac';

// Ticking an exercise done (build item 35, slices B + D).
//
// This exists as a route rather than the app writing to the table directly,
// because a completion is not just a row: it also keeps the session's single
// activity_logs entry in step, rolling eccentric load and intensity up as the
// HIGHEST across the session so the DOMS flag sees the hardest work rather than
// an average. That logic lives server-side in logCompletion, and a direct
// client insert would silently skip it - the exact "feeds interpretation for
// free" gap item 35 flagged.
//
// eccentricLoad and intensity come from the plan, where they were classified at
// authoring time (slice A). They are re-validated here rather than trusted:
// this is a client-supplied payload, and a bad value would poison the DOMS
// signal for the whole session.

const ECCENTRIC: EccentricLoad[] = ['none', 'low', 'moderate', 'high'];
const INTENSITY: PlanIntensity[] = ['light', 'moderate', 'intense'];

const oneOf = <T extends string>(v: unknown, allowed: T[]): T | null =>
  typeof v === 'string' && (allowed as string[]).includes(v) ? (v as T) : null;

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

  const { planId, planTitle, exerciseName, eccentricLoad, intensity } = body as Record<
    string,
    unknown
  >;

  const name = typeof exerciseName === 'string' ? exerciseName.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'exerciseName required' }, { status: 400 });
  }

  const ok = await logCompletion(supabase, user.id, {
    planId: typeof planId === 'string' && planId.length > 0 ? planId : null,
    planTitle: typeof planTitle === 'string' && planTitle.trim().length > 0 ? planTitle.trim() : name,
    exerciseName: name,
    eccentricLoad: oneOf(eccentricLoad, ECCENTRIC),
    intensity: oneOf(intensity, INTENSITY),
  });

  // logCompletion returns false only when the completion itself failed to
  // persist. A failed activity roll-up is swallowed inside it on purpose: the
  // tick is the person's own fact, the activity row is a derived convenience.
  if (!ok) {
    return NextResponse.json({ error: 'Could not record that' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
