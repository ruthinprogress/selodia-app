import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

import { getSupabaseForRequest } from '../../lib/supabase';
import { coerceImageKind, IMAGE_KIND_PROMPT, type ImageKind } from '../../lib/image-kind';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Haiku, deliberately. This is a four-way visual classification with no
// conversational component - exactly the routine parsing task Part Three
// reserves Haiku for, and it keeps the extra hop cheap and fast.
const MODEL = 'claude-haiku-4-5-20251001';

const ALLOWED_MEDIA = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
type MediaType = (typeof ALLOWED_MEDIA)[number];
const isMediaType = (v: unknown): v is MediaType =>
  typeof v === 'string' && (ALLOWED_MEDIA as readonly string[]).includes(v);

// Generous for a compressed phone photo, and a real ceiling on what a bad
// client can push through.
const MAX_BYTES = 8 * 1024 * 1024;

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
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 20,
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
                enum: ['body_measurement', 'food', 'activity', 'unclear'],
                description: 'The kind of log this photo is, or unclear.',
              },
            },
            required: ['kind'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'classify_image' },
    });

    const toolUse = response.content.find((b) => b.type === 'tool_use');
    kind = coerceImageKind(
      toolUse && toolUse.type === 'tool_use' ? (toolUse.input as { kind?: unknown }).kind : undefined
    );
  } catch (err) {
    console.log('CLASSIFY-IMAGE FAILED:', err instanceof Error ? err.message : err);
    // Degrade to 'unclear' rather than erroring: the app can still ask the
    // person what it is, which is a far better outcome than losing their photo
    // to a failure message.
    kind = 'unclear';
  }

  return NextResponse.json({ kind });
}
