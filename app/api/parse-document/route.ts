import { NextRequest, NextResponse } from 'next/server';

import { cardBody, cardSection, offerLine } from '../../lib/clinical-card';
import { readClinicalDocument } from '../../lib/clinical-document';
import { clearPendingSave, coerceProposal, readPendingSave, storePendingSave } from '../../lib/pending-save';
import { getSupabaseForRequest } from '../../lib/supabase';

// READING A MEDICAL DOCUMENT SHE HAS PHOTOGRAPHED OR UPLOADED.
//
// IT READS, AND IT OFFERS. It does not save. The record is stored as a PENDING
// save - the mechanism built in pending-save.ts, whose own note says why it
// exists: "the database holds the offer, the model only reports whether the
// answer was yes, and the app saves exactly what was offered. The model
// observes; the app decides."
//
// That matters more here than anywhere it has been used before. What gets
// written is a hospital number she will read out on the telephone, and the
// difference between offering it and saving it is the difference between a
// record she has agreed to and one that appeared in her medical history
// because a photograph was taken. She says yes in the conversation, and the
// existing path commits exactly the card she was shown.
//
// THE DOCUMENT ITSELF IS NEVER STORED. Asked what should be kept, she chose the
// extracted record only - so nothing here writes an image or a PDF anywhere.
// The bytes arrive, are read, and are gone when the request ends. That is also
// what the report's own cover has been telling clinicians since this morning:
// Selodia holds no medical documents.
//
// TWO PAGES OR SIX ARE ONE DOCUMENT. A consultant letter runs to three sides
// and the numbers are usually on the first while the plan is on the last, so
// the pages are read together in one call rather than one at a time. Reading
// them separately would produce three records of one letter, each missing what
// the others had.

// Reading several pages twice over, with a vision model, is not a two-second
// job. The default cut-off would surface as a generic failure after she had
// already waited.
//
// SIXTY, NOT A HUNDRED AND TWENTY. The weekly roundup and the report both run
// at 60, which is the only evidence in this repo of what the plan allows; 120
// was a guess, and a value a plan refuses is either clamped silently or fails
// the build. If eight pages ever need longer, that is a deliberate decision
// about the plan rather than a number changed in passing.
export const maxDuration = 60;

// WHAT THE MODEL ACTUALLY ACCEPTS, which is four image types and PDF. HEIC is
// not among them, and listing it here would have sent an iPhone's native format
// upstream to be refused - reaching her as a blank failure after a long upload,
// which is the shape of error this app spent the morning removing. The app says
// so before the upload instead. Converting HEIC needs a native module and
// belongs in the next build, not in a list that quietly lies.
const ALLOWED_IMAGE = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

// THE CEILING IS THE PLATFORM'S, AND IT IS LOW. A serverless function here
// refuses a request body over about 4.5MB, so the 28MB this file used to allow
// was a number with no authority behind it: a two-page letter at photographic
// quality sailed past our own check and was refused by the platform, which
// answers with a non-JSON body - so the app found no message in it and fell
// back to "I could not read that just now". The three-page consultant letter
// this feature exists for was the case that broke.
//
// Stated in DECODED bytes, with base64's third of inflation and the JSON
// around it already allowed for. The app applies the same figure before it
// uploads anything, and resizes pages to stay under it.
const MAX_ONE = 3 * 1024 * 1024;
const MAX_TOTAL = 3 * 1024 * 1024;
const MAX_PAGES = 8;

type Source =
  | { type: 'image'; mediaType: string; base64: string }
  | { type: 'pdf'; base64: string };

function readSources(raw: unknown): { ok: true; sources: Source[] } | { ok: false; error: string; status: number } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: 'Nothing was sent to read.', status: 400 };
  }
  if (raw.length > MAX_PAGES) {
    return {
      ok: false,
      error: `That is more than ${MAX_PAGES} pages. Send the pages that carry the findings and the reference numbers.`,
      status: 400,
    };
  }

  const sources: Source[] = [];
  let total = 0;

  for (const item of raw) {
    const s = (item ?? {}) as Record<string, unknown>;
    const base64 = typeof s.base64 === 'string' ? s.base64 : '';
    if (!base64) return { ok: false, error: 'One of the pages arrived empty.', status: 400 };

    const bytes = Buffer.byteLength(base64, 'base64');
    total += bytes;
    if (bytes > MAX_ONE || total > MAX_TOTAL) {
      return {
        ok: false,
        error:
          'That is more than I can take in one go. Send two or three pages at a time and I will read each set.',
        status: 413,
      };
    }

    const mediaType = typeof s.mediaType === 'string' ? s.mediaType : '';
    if (mediaType === 'application/pdf') {
      sources.push({ type: 'pdf', base64 });
    } else if ((ALLOWED_IMAGE as readonly string[]).includes(mediaType)) {
      sources.push({ type: 'image', mediaType, base64 });
    } else {
      return {
        ok: false,
        error: 'That kind of file cannot be read. A photo or a PDF works.',
        status: 400,
      };
    }
  }

  return { ok: true, sources };
}

export async function POST(request: NextRequest) {
  const db = getSupabaseForRequest(request);
  const {
    data: { user },
    error: userError,
  } = await db.auth.getUser();
  if (userError || !user) {
    return NextResponse.json(
      { error: 'Your session has expired. Sign in again and try the document once more.' },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const read = readSources(body.pages);
  if (!read.ok) return NextResponse.json({ error: read.error }, { status: read.status });

  const result = await readClinicalDocument(read.sources);

  if (!result.ok) {
    // THE TWO FAILURES ARE DIFFERENT and she can act on only one of them. A
    // page too dark to read is hers to fix; a model that would not answer is
    // not, and telling her to retake a photograph she took correctly is the
    // kind of advice that wastes somebody's evening.
    return NextResponse.json(
      {
        error:
          result.reason === 'unreadable'
            ? 'I could not make out enough of that to keep a record of it. A straighter photo in better light usually does it, or send the page with the letterhead and reference numbers on it.'
            : 'I could not read that just now. Nothing was saved. Please try again in a moment.',
      },
      { status: result.reason === 'unreadable' ? 422 : 503 }
    );
  }

  const doc = result.document;
  const body_ = cardBody(doc);

  // WHY, for a Me card, is what makes it worth having - and for a document it
  // is what the document was about. Without one the save is refused upstream,
  // which is the right rule: a card with no reason is a filing cabinet, and Me
  // is not a filing cabinet.
  const why =
    doc.about ??
    `A record of ${doc.kind === 'other' ? 'a medical document' : `a ${doc.kind}`}${doc.dated ? ` dated ${doc.dated}` : ''}, kept so the paper is not needed.`;

  // COERCED HERE, NOT ONLY ON THE WAY BACK OUT. `readPendingSave` runs every
  // proposal through `coerceProposal`, so an offer that cannot survive that
  // stores fine, asks its question, and then reads back as nothing - and her
  // yes does nothing, for ever, with no error anywhere. Checking now turns a
  // silent permanent failure into one honest sentence.
  const proposal = coerceProposal({
    type: 'me',
    title: doc.title,
    content: { section: cardSection(doc), why, detail: body_ },
  });

  if (!proposal) {
    console.log('DOCUMENT: the record could not be made into a save', doc.title);
    return NextResponse.json(
      { error: 'I read the document, but could not make a record of it that would keep. That is a fault in the app, and it has been recorded.' },
      { status: 500 }
    );
  }

  // ONE QUESTION AT A TIME, which the chat route has always enforced and this
  // one did not. Selodia offers to keep an insight, she reads a letter instead
  // of answering, and the letter overwrote the insight's offer - so scrolling
  // up and saying "yes" to the insight question wrote a MEDICAL RECORD to her
  // Me tab. The waiting offer is cleared and named, so the question she can
  // still see on screen no longer has an answer that means something else.
  const { data: profile } = await db
    .from('user_profile')
    .select('pending_save, pending_save_asked_at')
    .eq('user_id', user.id)
    .maybeSingle();

  const waiting = readPendingSave(profile);
  const dropped = waiting.proposal?.title ?? null;
  if (dropped) await clearPendingSave(db, user.id);

  const stored = await storePendingSave(db, user.id, proposal);

  if (!stored) {
    // The reading worked and the offer did not, so saying yes would save
    // nothing. Better to say so now than to let her agree to a ghost.
    return NextResponse.json(
      { error: 'I read the document, but could not hold on to it long enough to offer it. Please try once more.' },
      { status: 503 }
    );
  }

  return NextResponse.json({
    document: doc,
    // The draft, so the phone can show what it is agreeing to. Built here so
    // the app never has to know how a clinical record is laid out.
    card: { title: doc.title, section: cardSection(doc), body: body_ },
    // AND SAY SO IF A QUESTION WAS SET ASIDE. The earlier offer is still on
    // her screen, further up the thread; dropping it without a word would
    // leave a question there that no longer has an answer.
    message: dropped
      ? `${offerLine(doc)}

(I had also asked about keeping "${dropped}" - that one is set aside for now, and I can offer it again.)`
      : offerLine(doc),
  });
}
