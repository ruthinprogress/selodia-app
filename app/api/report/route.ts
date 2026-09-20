import { NextRequest, NextResponse } from 'next/server';

import { loadCatalogue, loadReport, readBlocks, type ReportSelection } from '../../lib/report';
import { renderReport } from '../../lib/report-render';
import { facts, writeSummary } from '../../lib/report-summary';
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

// LONGER THAN THE DEFAULT, because the draft step reads up to ninety records
// and then asks a model to write about them, and the default cuts a function
// off after fifteen seconds. A timeout here would reach her as the generic
// "could not build" - the exact failure that was rewritten this morning for
// telling her nothing. Sixty is what the weekly roundup already uses, so it is
// within what this project's plan allows and is not a new cost decision.
export const maxDuration = 60;

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

  // TWO SHAPES OF POST, ONE SELECTION (2026-09-20).
  //
  // `draft: true` reads the chosen blocks, writes a summary from them, and
  // returns it. Nothing is stored and nothing is built. She then edits it,
  // keeps it, or throws it away - which is her requirement in her own words:
  // the summary is "editable or removable before sharing". A summary she has
  // not read has no business at the top of a document with her name on it.
  //
  // The ordinary POST builds the report, and takes `summary` as TEXT rather
  // than as a flag: whatever arrives is what she approved. The server never
  // writes a summary into a report on its own initiative.

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

  if (body.draft === true) {
    const written = await writeSummary(data);
    // WHICH OF THE THREE THINGS HAPPENED, said rather than swallowed. The
    // first version answered all three with an empty summary, so a model that
    // could not be reached looked exactly like a selection too thin to
    // describe - and she had ticked the box and waited either way.
    return NextResponse.json(
      written.ok
        ? { summary: written.text, dropped: written.dropped.length }
        : { summary: null, reason: written.reason }
    );
  }

  // A REPORT OF NOTHING IS NOT A REPORT (found in review, 2026-09-20). Tick
  // Body alone with "Last 3 months" when the last weigh-in was in May, and
  // everything downstream succeeded: blocks non-empty, the button enabled, the
  // page built, stored and opened - as a cover sheet, an empty Contents and a
  // footer. She would have had a browser tab with a blank document in it and
  // no idea why. The period is nearly always the reason, so the message names
  // the period.
  if (isEmpty(data)) {
    return NextResponse.json(
      {
        error: `Nothing you chose falls in ${selection.periodLabel.toLowerCase()}. Try a longer period, or choose something else to include.`,
      },
      { status: 400 }
    );
  }

  if (typeof body.summary === 'string' && body.summary.trim()) {
    data.summary = body.summary.trim().slice(0, 4000);
    // The figures belong to the app, not to her edit of the paragraphs: she
    // can rewrite every word of the summary and the counts underneath stay
    // what the records actually say.
    data.glance = facts(data).lines;
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

/** True when every chosen block came back with no rows in it. */
function isEmpty(data: Awaited<ReturnType<typeof loadReport>>): boolean {
  return (
    data.profile.length === 0 &&
    data.goals.length === 0 &&
    data.weights.length === 0 &&
    data.metrics.length === 0 &&
    data.symptoms.length === 0 &&
    data.food.length === 0 &&
    data.foodEntries.length === 0 &&
    data.water.length === 0 &&
    data.sleep.length === 0 &&
    data.activity.length === 0 &&
    data.plans.length === 0 &&
    data.insights.length === 0 &&
    data.cards.length === 0
  );
}
