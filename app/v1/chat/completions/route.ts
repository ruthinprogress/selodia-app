import { NextRequest, NextResponse } from 'next/server';

// The custom-LLM adapter ElevenLabs talks to.
//
// WHY IT EXISTS. ElevenLabs Agents can select Claude directly in their
// dashboard, which is far simpler and was rejected: on that path the agent
// calls Claude itself and `ask-unflump` never runs. Everything that route
// carries would go with it - the safety classifier and its escalation state
// machine, food/activity/measurement logging, corrections, the allergy block,
// the Almanac flow. A spoken conversation would not be the same product as a
// typed one, and Part Twelve's safety branching is not optional. So voice is
// routed back through the same pipeline, and this file is the shim that lets
// an OpenAI-shaped caller reach it.
//
// THE PATH IS NOT UNDER /api ON PURPOSE. ElevenLabs posts to
// `<base>/v1/chat/completions`, so the route lives at exactly that URL:
// https://api.selodia.app/v1/chat/completions
//
// IDENTITY ARRIVES IN THE BODY, because there is nowhere else for it to be.
// Their platform authenticates at the AGENT level and offers no
// per-conversation header, so the one channel for per-conversation data is
// `elevenlabs_extra_body`, populated from ConversationInitiationData.extra_body
// when the app opens the session. The app puts the person's own Supabase access
// token there and this forwards it as Authorization, so the pipeline
// authenticates exactly as it does for a typed message and RLS stays in the
// enforcement path. The cost is stated rather than hidden: a short-lived
// Supabase token transits ElevenLabs' infrastructure.
//
// NO ANONYMOUS PATH. A request without a token is 401, always. There is no
// fallback user, no service-role branch, nothing that could answer a stranger
// with somebody else's week.
//
// THE TOKEN IS NEVER LOGGED. Not on success, not in an error, not truncated.

export const dynamic = 'force-dynamic';

type ChatMessage = {
  role?: string;
  // OpenAI allows content to be a string or an array of parts. ElevenLabs sends
  // strings today; the array form is handled so a change on their side degrades
  // to "reads the text" rather than "reads nothing".
  content?: string | { type?: string; text?: string }[];
};

const TOKEN_KEYS = ['selodia_access_token', 'access_token', 'supabase_access_token'];

function textOf(content: ChatMessage['content']): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join(' ')
      .trim();
  }
  return '';
}

// The utterance is the LAST user message, not the whole array. ask-unflump
// loads its own history from the database and builds its own context, so
// replaying ElevenLabs' transcript into it would duplicate the conversation
// rather than continue it.
function lastUserUtterance(messages: unknown): string | null {
  if (!Array.isArray(messages)) return null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i] as ChatMessage;
    if (m?.role === 'user') {
      const text = textOf(m.content);
      if (text.trim().length > 0) return text.trim();
    }
  }
  return null;
}

// Split for speech, not for looks. ElevenLabs begins speaking as chunks arrive,
// so handing it whole sentences lets the voice start on the first one instead of
// waiting for the last. Splitting mid-sentence would make the speech stutter at
// the seams, which is why this breaks on terminators rather than length.
function speakableChunks(reply: string): string[] {
  const parts = reply.match(/[^.!?\n]+[.!?]*\s*/g);
  if (!parts || parts.length === 0) return [reply];
  return parts.filter((p) => p.trim().length > 0);
}

const enc = new TextEncoder();

function sseChunk(id: string, created: number, model: string, delta: object, finish: string | null) {
  return enc.encode(
    `data: ${JSON.stringify({
      id,
      object: 'chat.completion.chunk',
      created,
      model,
      choices: [{ index: 0, delta, finish_reason: finish }],
    })}\n\n`
  );
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const extra = (body.elevenlabs_extra_body ?? {}) as Record<string, unknown>;
  const token = TOKEN_KEYS.map((k) => extra[k]).find(
    (v): v is string => typeof v === 'string' && v.length > 0
  );

  if (!token) {
    // Deliberately says what is missing without hinting at a way around it.
    console.log('VOICE ADAPTER: rejected a request with no identity token');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const utterance = lastUserUtterance(body.messages);
  if (!utterance) {
    return NextResponse.json({ error: 'No user message' }, { status: 400 });
  }

  const model = typeof body.model === 'string' ? body.model : 'selodia';
  const id = `chatcmpl-${crypto.randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);

  // Straight back to the same route the Chat composer posts to. Same origin, so
  // this stays one deployment with no second base URL to keep in step.
  let reply: string;
  try {
    const res = await fetch(new URL('/api/ask-unflump', request.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      // `voice: true` is what lets the pipeline defer the food/activity parse
      // to after the response. It changes nothing about the reply or the safety
      // classification - only which work has to finish before we can speak.
      body: JSON.stringify({ message: utterance, voice: true }),
    });

    if (res.status === 401) {
      console.log('VOICE ADAPTER: pipeline rejected the token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!res.ok) {
      console.log('VOICE ADAPTER: pipeline returned', res.status);
      // Spoken aloud, so it has to be a sentence rather than a status code. It
      // says only what is true - something failed - and never claims anything
      // was or was not saved, because at this point we do not know.
      reply = 'Something went wrong just then. Could you say that again?';
    } else {
      const data = (await res.json()) as { reply?: string };
      reply =
        typeof data.reply === 'string' && data.reply.trim().length > 0
          ? data.reply.trim()
          : 'Sorry, I did not catch that.';
    }
  } catch (err) {
    console.log('VOICE ADAPTER: pipeline threw', err instanceof Error ? err.message : err);
    reply = 'Something went wrong just then. Could you say that again?';
  }

  // Non-streaming is not what ElevenLabs asks for, but an OpenAI-compatible
  // endpoint that only speaks SSE is not OpenAI-compatible, and a caller that
  // sends stream:false deserves an answer rather than a broken stream.
  if (body.stream === false) {
    return NextResponse.json({
      id,
      object: 'chat.completion',
      created,
      model,
      choices: [{ index: 0, message: { role: 'assistant', content: reply }, finish_reason: 'stop' }],
    });
  }

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(sseChunk(id, created, model, { role: 'assistant' }, null));
      for (const piece of speakableChunks(reply)) {
        controller.enqueue(sseChunk(id, created, model, { content: piece }, null));
      }
      controller.enqueue(sseChunk(id, created, model, {}, 'stop'));
      controller.enqueue(enc.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
