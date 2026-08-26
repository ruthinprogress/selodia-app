import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

import { getSupabaseForRequest } from '../../lib/supabase';
import {
  ACK_VOICE,
  composeAcknowledgment,
  factsBlock,
  isEmptyAck,
  type AckKind,
  type ActivityFacts,
  type BodyFacts,
  type FoodFacts,
} from '../../lib/log-acknowledgment';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Sonnet, not Haiku. This is the one part of a photo log that is genuinely
// conversational - a specific comparative read of someone's own data, in
// Unflump's voice. Part Three reserves Haiku for routine parsing, which the
// classification and extraction steps already are; this is the other kind.
const MODEL = 'claude-sonnet-5';

// Two sentences of prose. Sized well clear of what that needs, after
// classify-image shipped with max_tokens so tight the model could never finish
// a tool call.
const MAX_TOKENS = 400;

const KINDS: AckKind[] = ['body_measurement', 'food', 'activity'];
const isKind = (v: unknown): v is AckKind => typeof v === 'string' && (KINDS as string[]).includes(v);

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

  const { kind, facts } = body as { kind?: unknown; facts?: unknown };
  if (!isKind(kind) || !facts || typeof facts !== 'object') {
    return NextResponse.json({ error: 'kind and facts are required' }, { status: 400 });
  }

  const typed = facts as BodyFacts & FoodFacts & ActivityFacts;
  const block = factsBlock(kind, typed as never);
  const interpretation = kind === 'body_measurement' ? (typed.interpretation ?? null) : null;
  const proteinNote = kind === 'food' ? (typed.proteinNote ?? null) : null;

  // The facts block is what the person is looking at, so it is what the model
  // is shown - not the raw row. Anything not in the block is not on screen, and
  // a read that leans on it would refer to something they cannot see.
  const prompt = [
    `They logged this by photo. This block is already on their screen, directly above where your words will appear:`,
    '',
    block,
    interpretation ? `\nThe app has also already told them, in these exact words:\n"${interpretation}"` : '',
    proteinNote ? `\nA protein-quality note is also being shown:\n"${proteinNote}"` : '',
    // The ONLY grounds for a comparative claim. Absent when the caller has no
    // history to offer, and the voice guidance then forbids reaching for one.
    typed.recent ? `\nTheir recent history, the only basis you have for any comparison:\n${typed.recent}` : '',
    '',
    'Write the read that follows.',
  ]
    .filter((s) => s !== '')
    .join('\n');

  let read: string | null = null;
  let degraded = false;
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: ACK_VOICE,
      messages: [{ role: 'user', content: prompt }],
    });
    if (response.stop_reason === 'max_tokens') {
      console.log('ACKNOWLEDGE-LOG TRUNCATED: raise MAX_TOKENS');
      degraded = true;
    }
    const text = response.content.find((b) => b.type === 'text');
    read = text && text.type === 'text' ? text.text : null;
  } catch (err) {
    console.log('ACKNOWLEDGE-LOG FAILED:', err instanceof Error ? err.message : err);
    // The facts and the interpretation are already composed and are the part
    // that carries real information. Losing the read degrades the reply rather
    // than the log, so the person still gets something true.
    degraded = true;
  }

  const message = composeAcknowledgment({
    facts: block,
    interpretation: interpretation ?? proteinNote,
    read: isEmptyAck(read) ? null : read,
  });

  return NextResponse.json(degraded ? { message, degraded: true } : { message });
}
