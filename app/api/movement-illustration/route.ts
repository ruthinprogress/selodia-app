import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseForRequest, getSupabaseServiceRole } from '../../lib/supabase';
import { resolveIllustrationRef, progressionStages } from '../../lib/movement-illustrations';

// Hand the app a picture for one movement, or for a whole progression.
//
// WHY A ROUTE RATHER THAN THE CLIENT READING STORAGE. The bucket is private, like every
// other bucket here. These illustrations are Selodia's own, so unlike the vendor clips
// no licence compels it - the reasoning is in the bucket's migration. The practical
// effect is the same: the only way to a file is through here, authenticated.
//
// A LONGER TTL THAN THE CLIPS, deliberately. A clip gets five minutes because a leaked
// URL to licensed footage matters. An illustration is ours, appears in lists where a
// dozen load at once, and benefits from sitting in the phone's image cache - so the URL
// outlives a session rather than a scroll.
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

async function sign(path: string): Promise<string | null> {
  const { data, error } = await getSupabaseServiceRole()
    .storage.from('movement-illustrations')
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    console.log('MOVEMENT-ILLUSTRATION: signing failed', error?.message);
    return null;
  }
  return data.signedUrl;
}

export async function GET(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get('ref')?.trim();
  const name = request.nextUrl.searchParams.get('exercise')?.trim();
  const progression = request.nextUrl.searchParams.get('progression')?.trim();

  if (!ref && !name && !progression) {
    return NextResponse.json(
      { error: 'ref, exercise or progression is required' },
      { status: 400 }
    );
  }

  const supabase = getSupabaseForRequest(request);
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  // A WHOLE PROGRESSION, in order. The set is the feature: a progression shown half as
  // pictures and half as gaps reads as broken, so this returns every stage it holds and
  // lets the screen decide what to do about any that are missing.
  if (progression) {
    const stages = await progressionStages(supabase, progression);
    const { data: rows } = await supabase
      .from('movement_illustrations')
      .select('join_key, storage_path, animation_path')
      .eq('progression', progression);

    const paths = new Map(
      (rows ?? []).map((r) => [
        r.join_key as string,
        { still: r.storage_path as string, animation: r.animation_path as string | null },
      ])
    );

    const illustrations = [];
    for (const stage of stages) {
      const found = paths.get(stage.joinKey);
      if (!found) continue;
      const url = await sign(found.still);
      if (!url) continue;
      illustrations.push({
        ref: stage.joinKey,
        title: stage.title,
        stage: stage.stage,
        url,
        animationUrl: found.animation ? await sign(found.animation) : null,
      });
    }

    return NextResponse.json({ progression, illustrations, expiresIn: SIGNED_URL_TTL_SECONDS });
  }

  const joinKey = ref ?? (await resolveIllustrationRef(supabase, name!));
  if (!joinKey) {
    // NOT AN ERROR. Most movements have no illustration yet and many never will. The
    // card falls back to its recipe, and says nothing about the library's limits.
    return NextResponse.json({ illustration: null }, { status: 200 });
  }

  const { data: row, error: lookupError } = await supabase
    .from('movement_illustrations')
    .select('join_key, title, storage_path, animation_path, progression, stage')
    .eq('join_key', joinKey)
    .maybeSingle();

  if (lookupError) {
    console.log('MOVEMENT-ILLUSTRATION: lookup failed', lookupError.message);
    return NextResponse.json({ error: 'Could not look that up' }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ illustration: null }, { status: 200 });
  }

  const url = await sign(row.storage_path as string);
  if (!url) {
    return NextResponse.json({ error: 'Could not prepare that picture' }, { status: 500 });
  }

  return NextResponse.json({
    illustration: {
      ref: row.join_key,
      title: row.title,
      url,
      // An animation is an upgrade on the still, made from its two frames, and the
      // still stays the poster frame. Null for almost every movement, and that is the
      // expected state rather than a gap to apologise for.
      animationUrl: row.animation_path ? await sign(row.animation_path as string) : null,
      progression: row.progression,
      stage: row.stage,
      expiresIn: SIGNED_URL_TTL_SECONDS,
    },
  });
}
