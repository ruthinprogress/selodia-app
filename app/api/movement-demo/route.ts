import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseForRequest, getSupabaseServiceRole } from '../../lib/supabase';

// Hand the app a playable URL for one movement demonstration.
//
// WHY THIS ROUTE EXISTS AT ALL, rather than the app reading storage directly:
// the movement-demos bucket is private and has no storage policy for end users.
// Exercise Animatic's licence (ToS 8.4) forbids allowing end users to download or
// extract the files, and its licence page forbids providing access to the raw
// files outside the business. A bucket the client cannot address is the strongest
// available form of that, short of DRM. So the only way to a clip is through here,
// authenticated, one exercise at a time, with a URL that expires.

// Long enough to open the Almanac, read the plan and press play; short enough
// that a URL copied out of a proxy is worthless by the time anyone uses it. A
// clip is about ten seconds long, so this is not a playback constraint.
const SIGNED_URL_TTL_SECONDS = 300;

// The manifest's join_key is lowercase with single spaces. Plans are written by a
// language model, so what arrives is "Landmine Romanian Deadlift" or occasionally
// "landmine  romanian deadlift ". Normalise both ends rather than hoping.
function toJoinKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('exercise');
  if (!name || !name.trim()) {
    return NextResponse.json({ error: 'exercise is required' }, { status: 400 });
  }

  // Authenticate as the user, not as the service role. The service role appears
  // only after we know who is asking.
  const supabase = getSupabaseForRequest(request);
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const { data: asset, error: lookupError } = await supabase
    .from('movement_assets')
    .select('join_key, clip, storage_path, muscle_group, primary_muscles, movement_pattern')
    .eq('join_key', toJoinKey(name))
    .maybeSingle();

  if (lookupError) {
    console.log('MOVEMENT-DEMO: lookup failed', lookupError.message);
    return NextResponse.json({ error: 'Could not look that up' }, { status: 500 });
  }

  // NOT AN ERROR. The library covers movement patterns, not every named exercise,
  // and item 46 handles a gap by talking about it - never by referencing the
  // library's limits. So this answers "there is no demo for this", which the app
  // renders as no player at all, and says nothing about why.
  if (!asset) {
    return NextResponse.json({ demo: null }, { status: 200 });
  }

  const { data: signed, error: signError } = await getSupabaseServiceRole()
    .storage.from('movement-demos')
    .createSignedUrl(asset.storage_path, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed?.signedUrl) {
    console.log('MOVEMENT-DEMO: signing failed', signError?.message);
    return NextResponse.json({ error: 'Could not prepare that clip' }, { status: 500 });
  }

  return NextResponse.json({
    demo: {
      url: signed.signedUrl,
      expiresIn: SIGNED_URL_TTL_SECONDS,
      // Enough for the player to label and lay out the clip without a second
      // request. Deliberately not the storage path - the client has no use for
      // it and no business holding one.
      clip: asset.clip,
      muscleGroup: asset.muscle_group,
      primaryMuscles: asset.primary_muscles,
      movementPattern: asset.movement_pattern,
    },
  });
}
