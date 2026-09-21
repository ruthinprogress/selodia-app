import { NextRequest, NextResponse } from 'next/server';

import { readAttachment } from '../../../lib/report-attachment';
import { getSupabaseForRequest } from '../../../lib/supabase';

// READING ONE DOCUMENT SHE WANTS TO ATTACH TO A REPORT.
//
// ONE AT A TIME, AND THIS IS THE WHOLE REASON THE ROUTE EXISTS. The build
// request already carries a report's worth of choices, and the platform refuses
// a body much over four megabytes - a lesson learned the hard way this morning,
// when a two-page letter sailed past our own checks and was thrown away by the
// platform with a reply the app could not read a message out of.
//
// So each attachment is read here on its own, and what goes back to the phone
// is the small thing: a name, the substance as text, and the picture it already
// had. The build then carries those rather than the originals.
//
// NOTHING IS STORED. The bytes arrive, are read, and are gone when the request
// ends - the same rule as the chat path, and the reason the app can say it
// holds no medical documents and mean it.

export const maxDuration = 60;

const ALLOWED_IMAGE = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_BYTES = 3 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const db = getSupabaseForRequest(request);
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) {
    return NextResponse.json(
      { error: 'Your session has expired. Sign in again and add the document once more.' },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const base64 = typeof body.base64 === 'string' ? body.base64 : '';
  const mediaType = typeof body.mediaType === 'string' ? body.mediaType : '';
  if (!base64 || !mediaType) {
    return NextResponse.json({ error: 'Nothing was sent to read.' }, { status: 400 });
  }
  if (Buffer.byteLength(base64, 'base64') > MAX_BYTES) {
    return NextResponse.json(
      { error: 'That file is too large to attach. A photo taken in the app is usually smaller than a scan.' },
      { status: 413 }
    );
  }

  const source =
    mediaType === 'application/pdf'
      ? ({ type: 'pdf', base64 } as const)
      : ALLOWED_IMAGE.includes(mediaType)
        ? ({ type: 'image', mediaType, base64 } as const)
        : null;

  if (!source) {
    return NextResponse.json({ error: 'That kind of file cannot be read. A photo or a PDF works.' }, { status: 400 });
  }

  const read = await readAttachment(source);
  if (!read.ok) {
    return NextResponse.json(
      {
        error:
          read.reason === 'unreadable'
            ? 'I could not make out enough of that to name it. A straighter photo in better light usually does it.'
            : 'I could not read that just now. Nothing was added. Please try again in a moment.',
      },
      { status: read.reason === 'unreadable' ? 422 : 503 }
    );
  }

  return NextResponse.json({ attachment: read.attachment });
}
