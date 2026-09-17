import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseForRequest } from '../../lib/supabase';

// A voice note, turned into text.
//
// THE MIC IN THE COMPOSER RECORDS A NOTE; THE SOUND BARS OPEN A CONVERSATION
// (Ruth, 2026-09-16 and again 2026-09-17: "Microphone icon for voice note ...
// then wave bars icon for voice"). This is the note's server half. The phone
// records, posts the file here, and gets words back to put in the message box,
// where they can be read and changed before sending - the same thing the
// keyboard's own dictation did.
//
// THE KEY STAYS SERVER-SIDE, as for the voice session route: the phone never
// holds the ElevenLabs key. The audio is passed straight through and not kept.
// The transcript is not logged either: it is somebody's own words about their
// body and their food, and it only becomes a record when they choose to send it.

export const dynamic = 'force-dynamic';

const STT_ENDPOINT = 'https://api.elevenlabs.io/v1/speech-to-text';
const MODEL_ID = 'scribe_v2';

// Vercel caps a request body at 4.5 MB. The phone stops recording at two minutes,
// which at the recorder's settings is well under a megabyte; this is the guard
// for anything that arrives larger anyway.
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const supabase = getSupabaseForRequest(request);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.log('TRANSCRIBE: ELEVENLABS_API_KEY is not set');
    return NextResponse.json({ error: 'Voice notes are not available' }, { status: 503 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No recording' }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Recording is empty or too long' }, { status: 400 });
  }

  const upstream = new FormData();
  upstream.append('model_id', MODEL_ID);
  upstream.append('file', file, 'voice-note.m4a');
  // Audio events such as (laughs) are useful in a transcript of a meeting and
  // noise in a food log.
  upstream.append('tag_audio_events', 'false');

  let response: Response;
  try {
    response = await fetch(STT_ENDPOINT, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: upstream,
    });
  } catch (err) {
    console.log('TRANSCRIBE FAILED:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Could not transcribe' }, { status: 502 });
  }

  if (!response.ok) {
    // Status only. The body can echo request details, and never the key.
    console.log('TRANSCRIBE UPSTREAM STATUS:', response.status);
    return NextResponse.json({ error: 'Could not transcribe' }, { status: 502 });
  }

  const data = (await response.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof data?.text === 'string' ? data.text.trim() : '';
  return NextResponse.json({ text }, { headers: { 'Cache-Control': 'no-store' } });
}
