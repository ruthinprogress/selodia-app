import { NextRequest, NextResponse } from 'next/server';

import { loadCatalogue, loadReport, readBlocks, type ReportSelection } from '../../lib/report';
import { renderReport } from '../../lib/report-render';
import { getSupabaseForRequest, supabase as anon } from '../../lib/supabase';

// THE REPORT BUILDER'S SERVER HALF (2026-09-20).
//
// GET with a session: what this person actually has, so the builder on the
// phone can offer exactly that and nothing else.
// POST with a session: render the chosen pieces, store the page for fifteen
// minutes, hand back a link.
// GET with ?id=: the stored page, for a browser that carries no identity -
// which is how it reaches a print dialogue and becomes a PDF.
//
// The identity rules are the Me export's, for the Me export's reasons: never
// the service role, never a token in a URL.

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (id) return servePage(id);

  const db = getSupabaseForRequest(request);
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const catalogue = await loadCatalogue(db, user.id);
  return NextResponse.json(catalogue);
}

export async function POST(request: NextRequest) {
  const db = getSupabaseForRequest(request);
  const {
    data: { user },
    error: userError,
  } = await db.auth.getUser();
  if (userError || !user) {
    return NextResponse.json(
      { error: 'Your session has expired. Sign in again and the report will build.' },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const blocks = readBlocks(body.blocks);
  if (blocks.length === 0) {
    // A PHONE THAT HAS NOT UPDATED YET sends the old {sections, cardIds}, and
    // would otherwise be told to choose something when it already had. Say the
    // true thing instead: the app is behind the server, and closing it twice
    // is the fix.
    const old = Array.isArray(body.sections) || Array.isArray(body.cardIds);
    return NextResponse.json(
      {
        error: old
          ? 'This version of Selodia cannot build the new report. Close the app completely, open it twice, and try again.'
          : 'Choose at least one thing to include.',
      },
      { status: 400 }
    );
  }

  const selection: ReportSelection = {
    from: isDay(body.from) ? (body.from as string) : null,
    to: isDay(body.to) ? (body.to as string) : null,
    periodLabel: typeof body.periodLabel === 'string' ? body.periodLabel.slice(0, 60) : 'All time',
    blocks,
    note: typeof body.note === 'string' ? body.note.slice(0, 400) : null,
  };

  // EACH STEP FAILS IN ITS OWN WAY, AND SAYS SO (2026-09-20). This used to be
  // one try around both with one message - "Could not build the report just
  // now. Please try again." - which was wrong twice over on the day it first
  // failed: trying again could not help, and the server knew exactly what had
  // happened and said none of it. A person cannot act on a sentence that
  // covers every cause.
  let data: Awaited<ReturnType<typeof loadReport>>;
  try {
    data = await loadReport(db, user.id, selection);
  } catch (err) {
    console.log('REPORT: could not read her data -', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Could not read your data just now. Check your connection and try again.' },
      { status: 503 }
    );
  }

  let html: string;
  try {
    html = renderReport(data);
  } catch (err) {
    // The fault is ours, the data is fine, and trying again will do the same
    // thing - so say that rather than inviting a pointless retry.
    console.log('REPORT: the document could not be written -', err instanceof Error ? err.stack : err);
    return NextResponse.json(
      {
        error:
          'Your data is fine, but Selodia could not write it into a report. That is a fault in the app, and it has been recorded.',
      },
      { status: 500 }
    );
  }

  // Expired copies go on the way in, so a report never outlives its link by
  // more than one more report.
  await db.rpc('purge_expired_report_exports');

  // The id is made here rather than returned by the insert: report_exports has
  // no read policy at all, and PostgREST needs read access to hand a row back.
  const id = crypto.randomUUID();
  const { error: storeError } = await db.from('report_exports').insert({ id, user_id: user.id, html });
  if (storeError) {
    console.log('REPORT: could not store the page -', storeError.message);
    return NextResponse.json(
      { error: 'The report was built, but could not be saved for its link. Please try again.' },
      { status: 500 }
    );
  }

  const url = new URL('/api/report', request.url);
  url.searchParams.set('id', id);
  return NextResponse.json({ url: url.toString() });
}

const EXPIRED = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Link expired</title>
<style>body{margin:0;background:#F7F3EA;color:#2D2B28;font:15px/1.55 system-ui,sans-serif}main{max-width:520px;margin:0 auto;padding:48px 24px}</style></head>
<body><main><p>This report has expired. Open Selodia, go to Settings, then Data and export, and build it again.</p></main></body></html>`;

async function servePage(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return new NextResponse(EXPIRED, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  const { data, error } = await anon.rpc('get_report', { report_id: id });
  if (error || typeof data !== 'string' || data.length === 0) {
    return new NextResponse(EXPIRED, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  return new NextResponse(data, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Somebody's health summary. Not for a shared cache, and not for search.
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

function isDay(v: unknown): boolean {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}
