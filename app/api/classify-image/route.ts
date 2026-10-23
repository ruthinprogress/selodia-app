import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

import { getSupabaseForRequest } from '../../lib/supabase';
import { coerceImageKind, IMAGE_KIND_PROMPT, type ImageKind } from '../../lib/image-kind';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Haiku, deliberately. This is a four-way visual classification with no
// conversational component - exactly the routine parsing task Part Three
// reserves Haiku for, and it keeps the extra hop cheap and fast.
const MODEL = 'claude-haiku-4-5-20251001';

// Room for the whole forced tool_use block, not just the answer inside it.
//
// This was 20, which looked generous for a one-word classification and was not:
// a complete `classify_image` call costs 33 output tokens, because the block
// carries the tool name and JSON scaffolding before it ever reaches `kind`.
// At 20 the response stopped mid-block with `stop_reason: 'max_tokens'` and
// `input: {}` — no `kind` at all — which coerceImageKind then correctly read as
// 'unclear'. Every image, every time, since the route shipped. Sized well clear
// of the real cost now, because the failure it caused was silent and total.
const MAX_TOKENS = 256;

const ALLOWED_MEDIA = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
type MediaType = (typeof ALLOWED_MEDIA)[number];
const isMediaType = (v: unknown): v is MediaType =>
  typeof v === 'string' && (ALLOWED_MEDIA as readonly string[]).includes(v);

// A CEILING ABOVE THE PLATFORM'S LIMIT IS NOT A CEILING (23 October 2026).
//
// This was 8MB and described as "generous for a compressed phone photo", which
// it would be if the request ever arrived. It does not: a Vercel serverless
// function rejects a body over 4.5MB before this handler runs, so every photo
// between 4.5MB and 8MB died at the edge with no log here and nothing readable
// on the phone. The client's own limit pointed at this number, so both ends
// agreed on a figure neither of them could honour.
//
// Two images reached this app's database in its whole history. The last one was
// a screenshot, which is small enough to get under by accident.
//
// 4MB, under the platform's 4.5MB with room for the JSON around the base64. The
// phone now resizes to a 1600px long edge before sending, which lands a normal
// photo in the hundreds of kilobytes, so this is a guard against a bad client
// rather than something an ordinary photo should ever meet.
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

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const { imageBase64, mediaType } = body as Record<string, unknown>;
  if (typeof imageBase64 !== 'string' || imageBase64.length === 0 || !isMediaType(mediaType)) {
    return NextResponse.json({ error: 'imageBase64 and a supported mediaType are required' }, { status: 400 });
  }
  if (Buffer.byteLength(imageBase64, 'base64') > MAX_BYTES) {
    return NextResponse.json({ error: 'That image is too large' }, { status: 413 });
  }

  let kind: ImageKind;
  // True when 'unclear' is a failure wearing an answer's clothes, rather than a
  // real read of the image. Never changes what the person is told; it exists so
  // the difference is visible to us.
  let degraded = false;
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: IMAGE_KIND_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          ],
        },
      ],
      tools: [
        {
          name: 'classify_image',
          description: 'Say which kind of log this photo is.',
          input_schema: {
            type: 'object',
            properties: {
              kind: {
                type: 'string',
                enum: ['body_measurement', 'food', 'activity', 'document', 'unclear'],
                description: 'The kind of log this photo is, or unclear.',
              },
            },
            required: ['kind'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'classify_image' },
    });

    // A truncated response is a broken call, not a judgement about the photo.
    // Worth naming separately: conflating the two is exactly what hid the
    // max_tokens bug, because a total outage was indistinguishable in the logs
    // and on screen from the model honestly saying it could not tell.
    if (response.stop_reason === 'max_tokens') {
      console.log('CLASSIFY-IMAGE TRUNCATED: raise MAX_TOKENS; output hit the ceiling before `kind`');
      degraded = true;
    }

    const toolUse = response.content.find((b) => b.type === 'tool_use');
    const raw = toolUse && toolUse.type === 'tool_use' ? (toolUse.input as { kind?: unknown }).kind : undefined;
    if (raw === undefined) {
      console.log('CLASSIFY-IMAGE NO KIND: stop_reason=' + response.stop_reason);
      degraded = true;
    }
    kind = coerceImageKind(raw);
  } catch (err) {
    console.log('CLASSIFY-IMAGE FAILED:', err instanceof Error ? err.message : err);
    // Degrade to 'unclear' rather than erroring: the app can still ask the
    // person what it is, which is a far better outcome than losing their photo
    // to a failure message. `degraded` keeps that kindness from also being
    // invisible — the reply is the same, the telemetry is not.
    degraded = true;
    kind = 'unclear';
  }

  return NextResponse.json(degraded ? { kind, degraded: true } : { kind });
}
