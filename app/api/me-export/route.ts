import { NextRequest, NextResponse } from 'next/server';

import { renderMeExport, type ExportRow } from '../../lib/me-export';
import { getSupabaseForRequest, supabase as anon } from '../../lib/supabase';

// THE ME EXPORT, in two halves (built 2026-09-19).
//
// POST, from the app, with the person's session: read their Me cards through
// RLS, render the page, store it for fifteen minutes, and hand back a link.
// GET, from the phone's browser, with no session at all: fetch that page by its
// id through get_me_export, which can do nothing else.
//
// Why not simply render on GET: the browser carries no identity, so a GET that
// rendered live would need either the person's token in the URL - which ends up
// in browser history and server logs - or the service role, which this codebase
// keeps to one job. Rendering with the person's own session and serving a
// stored copy by an unguessable, expiring id needs neither.

export async function POST(request: NextRequest) {
  const db = getSupabaseForRequest(request);
  const {
    data: { user },
    error: userError,
  } = await db.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [{ data: rows, error }, { data: profile }] = await Promise.all([
    db
      .from('almanac_entries')
      .select('title, category, content, created_at')
      .eq('user_id', user.id)
      .eq('kind', 'me')
      .order('created_at', { ascending: true }),
    db.from('user_profile').select('first_name').eq('user_id', user.id).maybeSingle(),
  ]);
  if (error) {
    console.log('ME EXPORT: could not read cards -', error.message);
    return NextResponse.json({ error: 'Could not read your Me tab' }, { status: 500 });
  }

  const name =
    profile && typeof (profile as { first_name?: unknown }).first_name === 'string'
      ? ((profile as { first_name: string }).first_name.trim() || null)
      : null;

  const html = renderMeExport((rows ?? []) as ExportRow[], {
    name,
    today: new Date().toISOString(),
  });

  // THE ID IS MADE HERE, not returned by the insert. me_exports has no read
  // policy on purpose - nobody may read it except through get_me_export - and
  // PostgREST needs read access to hand an inserted row back, so asking the
  // insert for its id would be refused and every export would fail.
  // EXPIRED COPIES ARE SWEPT ON A SCHEDULE NOW (21 September 2026), not here.
  // This used to call purge_expired_me_exports on the way in, which meant a
  // maintenance function had to be callable by every signed-in person - and
  // that expired health data only left when somebody else happened to export.
  // A pg_cron job runs it every fifteen minutes instead, and nobody can call it.

  const id = crypto.randomUUID();
  const { error: storeError } = await db.from('me_exports').insert({ id, user_id: user.id, html });
  if (storeError) {
    console.log('ME EXPORT: could not store the page -', storeError.message);
    return NextResponse.json({ error: 'Could not prepare the page' }, { status: 500 });
  }

  const url = new URL('/api/me-export', request.url);
  url.searchParams.set('id', id);
  return NextResponse.json({ url: url.toString() });
}

const EXPIRED = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Link expired</title>
<style>body{margin:0;background:#F7F3EA;color:#2D2B28;font:15px/1.55 system-ui,sans-serif}main{max-width:520px;margin:0 auto;padding:48px 24px}</style></head>
<body><main><p>This page has expired. Open your Me tab in Selodia and tap Export again for a fresh one.</p></main></body></html>`;

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id') ?? '';
  // Shape-checked before it reaches the database: an id is a UUID or it is
  // nothing, and a malformed one is not worth a query.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return new NextResponse(EXPIRED, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  const { data, error } = await anon.rpc('get_me_export', { export_id: id });
  if (error || typeof data !== 'string' || data.length === 0) {
    return new NextResponse(EXPIRED, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  return new NextResponse(data, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Somebody's health protocol. Not for a shared cache, and not for search.
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
