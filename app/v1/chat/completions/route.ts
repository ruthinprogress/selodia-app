import { NextRequest, NextResponse } from 'next/server';

// THE PIPELINE ITSELF, imported rather than called over HTTP.
//
// This used to fetch https://api.selodia.app/api/ask-unflump - its own public
// URL, for a file three directories away. Measured, that hop cost about 1.4s of
// a 4.4s spoken turn: TLS, edge routing, and a SECOND serverless invocation
// that could cold-start on its own. The give-away was the spread across
// identical calls, 5090/4277/3848ms, which is what cold starts look like.
//
// Importing the handler keeps every line of it in the path - the safety
// classifier, the escalation state machine, logging, corrections, the allergy
// block, the Almanac flow - because it IS the same function, just reached
// without leaving the process.
import { POST as askUnflump } from '../../../api/ask-unflump/route';
import { getSupabaseForRequest } from '../../../lib/supabase';

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

// Silence is not a turn.
//
// FOUND ON DEVICE, 2026-09-09. With the microphone publishing an empty track,
// ElevenLabs' transcriber rendered the silence as "..." and handed each one to
// us as a genuine user message. The agent answered all of them: 33 turns in
// four minutes, Freya gently checking in on a person who had not said a word,
// and sixteen full Claude calls billed for it.
//
// The mic fault was separate and is fixed. This is not: any room with enough
// background noise to trip the voice-activity detector produces the same empty
// transcript, so the guard belongs here whatever the microphone is doing.
//
// Punctuation-only rather than a fixed list of strings: "...", "…", ".", "?"
// and any combination are all the same non-utterance, and matching on the
// absence of letters and digits catches the ones nobody thought to enumerate.
// Deliberately NOT a length check - "no" and "ok" are two characters and are
// real answers.
function isSilence(utterance: string): boolean {
  return !/[\p{L}\p{N}]/u.test(utterance);
}

// How long an identical utterance counts as the same one.
//
// Measured, not guessed: on 2026-09-09 the same sentence arrived four times
// across 6.4 seconds - at +0.4s, +2.0s and +6.4s - and each ran a full
// pipeline turn and wrote its own food row. Fifteen seconds covers that with
// room to spare.
//
// THE TRADE IS REAL AND WORTH STATING. Somebody genuinely saying "yes" twice
// inside fifteen seconds gets the second one swallowed. The costs are not
// symmetrical: an unanswered repeat is fixed by speaking again, while a
// duplicate log is a wrong number in someone's day that they then have to
// find and delete - and until the delete UI exists, cannot.
const DEDUP_WINDOW_MS = 15_000;


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

// A well-formed completion carrying nothing to say.
//
// An empty assistant message is valid OpenAI shape, so the agent speaks
// nothing and the conversation stays open - which is the right outcome both
// for silence and for a repeat that has already been answered.
function silentCompletion(id: string, created: number, model: string): Response {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(sseChunk(id, created, model, { role: 'assistant' }, null));
      controller.enqueue(sseChunk(id, created, model, { content: '' }, null));
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

  // Answer silence with silence. An empty assistant message is a valid,
  // well-formed completion, so the agent simply has nothing to speak and the
  // conversation stays open - which is what someone who has not spoken yet
  // wants. Returned BEFORE the pipeline, so a non-utterance costs no model
  // call, writes no chat_messages row, and cannot leave a "..." in the thread.
  if (isSilence(utterance)) {
    console.log('VOICE ADAPTER: empty utterance, answering with silence');
    return silentCompletion(id, created, model);
  }

  // THE SAME SENTENCE TWICE IS ONE TURN.
  //
  // Found on device 2026-09-09: one spoken sentence produced FOUR identical
  // requests within 6.4 seconds, and because nothing here knew it had just
  // seen that utterance, each ran the whole pipeline - four Claude calls,
  // four food rows, four slightly different calorie estimates for one slice
  // of toast. The person had spoken once.
  //
  // The check reads chat_messages rather than any cache of our own, because
  // the pipeline writes the user turn BEFORE it calls the model - so the
  // second request can already see the first, even when the two land on
  // different serverless instances. An in-process Map would have worked for
  // the warm case and quietly failed for the cold one.
  //
  // RLS scopes the read to this person automatically; the token is the same
  // one the pipeline will authenticate with a moment later.
  try {
    const seen = new NextRequest(new URL('/api/ask-unflump', request.url), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const { data: duplicate } = await getSupabaseForRequest(seen)
      .from('chat_messages')
      .select('id')
      .eq('role', 'user')
      .eq('content', utterance)
      .gte('created_at', new Date(Date.now() - DEDUP_WINDOW_MS).toISOString())
      .limit(1)
      .maybeSingle();
    if (duplicate) {
      console.log('VOICE ADAPTER: duplicate utterance within window, answering with silence');
      return silentCompletion(id, created, model);
    }
  } catch (err) {
    // FAIL OPEN, deliberately. If the check itself breaks, the worst outcome
    // is the duplicate we already had; refusing to answer because a guard
    // could not run would turn a logging bug into a mute assistant.
    console.log('VOICE ADAPTER: dedup check failed, continuing -', err instanceof Error ? err.message : err);
  }

  // The exact same handler the Chat composer reaches, invoked in-process.
  //
  // It reads only two things off the request - the JSON body and the
  // authorization header - so a constructed NextRequest carries everything it
  // needs. Checked rather than assumed: request.json() is its only use of the
  // object beyond getSupabaseForRequest reading that header.
  let reply: string;
  try {
    const inner = new NextRequest(new URL('/api/ask-unflump', request.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      // `voice: true` lets the pipeline defer the food/activity parse to
      // after(). It changes nothing about the reply or the safety
      // classification - only which work must finish before we can speak.
      body: JSON.stringify({ message: utterance, voice: true }),
    });
    const res = await askUnflump(inner);

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
