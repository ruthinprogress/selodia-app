import { NextRequest, NextResponse } from 'next/server';

import { loadCatalogue, loadReport, readBlocks, type ReportSelection } from '../../lib/report';
import { renderReport } from '../../lib/report-render';
import { readAttachments } from '../../lib/report-attachment';
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
    recipient: typeof body.recipient === 'string' ? body.recipient.trim().slice(0, 80) || null : null,
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
  if (isEmpty(data) && (data.attachments?.length ?? 0) === 0) {
    return NextResponse.json(
      {
        error: `Nothing you chose falls in ${selection.periodLabel.toLowerCase()}. Try a longer period, or choose something else to include.`,
      },
      { status: 400 }
    );
  }

  // THE ID IS MINTED BEFORE THE PAGE IS WRITTEN, not after it. It is printed
  // in the footer of every page and on the cover, so the document has to know
  // it while it is being made - and it is the same id the link carries, so
  // there is one identifier rather than a private one and a printed one.
  const id = crypto.randomUUID();
  data.reportId = id.slice(0, 8).toUpperCase();
  data.recipient = selection.recipient ?? null;

  // WHAT SHE ATTACHED, already read one at a time by /api/report/attachment.
  // What arrives here is the small form - a name, the substance as text, the
  // picture - never the original file, which was never stored anywhere.
  data.attachments = readAttachments(body.attachments);

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

  // Expired copies are swept every fifteen minutes by a pg_cron job, so a
  // report no longer waits for somebody else's export to be cleared away - and
  // the function is not callable from the API at all. See the migration
  // expired_copies_go_on_a_schedule.

  // Stored under the id the pages already carry. report_exports has no read
  // policy at all, so the id could never have come back from the insert.
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

// THREE FAILURES WORE ONE FACE (21 September 2026). Every way of not getting a
// page said "This report has expired ... build it again" - a link that was
// never real, a database that could not be reached, and a link whose two hours
// had genuinely run out. She hit the third and the sentence blamed her for it
// without saying what had happened or that nothing was lost.
//
// It is the same fault fixed on the building side the day before, missed here
// because this path is the one nobody tests: it only runs in a browser that
// carries no session.
function notice(title: string, body: string, reference = ''): string {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<style>body{margin:0;background:#F8F5EF;color:#2D2B28;font:15px/1.6 system-ui,-apple-system,sans-serif}main{max-width:460px;margin:0 auto;padding:64px 24px}h1{font-size:19px;font-weight:600;margin:0 0 12px}p{margin:0 0 10px;color:#6B645B}code{font:12px/1.5 ui-monospace,Menlo,monospace;color:#9A9188;word-break:break-all}</style></head>
<body><main><h1>${title}</h1><p>${body}</p>${reference ? `<p><code>${reference}</code></p>` : ''}</main></body></html>`;
}

const EXPIRED = (id: string) =>
  notice(
    'This link has run out',
    'A report link works for two hours, and this one is past that. Nothing has been lost: open Selodía, go to Settings, then Data and export, and build it again with the same choices.',
    id
  );

const UNKNOWN = (id: string) =>
  notice(
    'This link does not lead anywhere',
    'No report was found for it. It may have been copied incompletely, or it may belong to a report that was replaced. Open Selodía, go to Settings, then Data and export, and build it again for a fresh link.',
    id
  );

const BROKEN = (id: string) =>
  notice(
    'The report could not be fetched',
    'Your report is fine and still stored. Something went wrong reading it just now, which is a fault at our end and has been recorded. Try the link again in a moment.',
    id
  );

async function servePage(id: string) {
  const html = (page: string, status: number) =>
    new NextResponse(page, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    console.log('REPORT PAGE: the id is not an id -', id.slice(0, 60));
    return html(UNKNOWN(id.slice(0, 60)), 404);
  }

  const { data, error } = await anon.rpc('get_report', { report_id: id });

  if (error) {
    // LOGGED, because this one is ours. Nothing about this path is visible
    // from the app, so without a line here a real outage is indistinguishable
    // from a clock running out - which is exactly how this went unnoticed.
    console.log('REPORT PAGE: could not be read -', id, error.message);
    return html(BROKEN(id), 503);
  }

  if (typeof data !== 'string' || data.length === 0) {
    const { data: existed } = await anon.rpc('report_exists', { report_id: id });
    console.log('REPORT PAGE: nothing to serve -', id, existed === true ? 'expired' : 'no such report');
    return html(existed === true ? EXPIRED(id) : UNKNOWN(id), 404);
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
