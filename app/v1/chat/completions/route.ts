import { NextRequest, NextResponse } from 'next/server';

// THE PIPELINE ITSELF, imported rather than called over HTTP.
//
// This used to fetch https://api.selodia.app/api/ask-selodia - its own public
// URL, for a file three directories away. Measured, that hop cost about 1.4s of
// a 4.4s spoken turn: TLS, edge routing, and a SECOND serverless invocation
// that could cold-start on its own. The give-away was the spread across
// identical calls, 5090/4277/3848ms, which is what cold starts look like.
//
// Importing the handler keeps every line of it in the path - the safety
// classifier, the escalation state machine, logging, corrections, the allergy
// block, the Almanac flow - because it IS the same function, just reached
// without leaving the process.
import { POST as askSelodia } from '../../../api/ask-selodia/route';
import { getSupabaseForRequest } from '../../../lib/supabase';
import { offeredTools, wasHeard, words } from '../../../lib/voice-turns';

// The custom-LLM adapter ElevenLabs talks to.
//
// WHY IT EXISTS. ElevenLabs Agents can select Claude directly in their
// dashboard, which is far simpler and was rejected: on that path the agent
// calls Claude itself and `ask-selodia` never runs. Everything that route
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

// The utterance is the LAST user message, not the whole array. ask-selodia
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

// How long after a turn a new request can still be that turn, sent again.
//
// ElevenLabs sends a turn when it judges she has finished, and sends it again,
// longer, if she carries on. On 2026-09-12 that gap reached 14 seconds, which
// left the old fifteen-second window no room. A longer window costs nothing for
// a turn whose answer she heard, because that is never treated as the same turn.
const SUPERSEDE_WINDOW_MS = 30_000;

// How long a turn may take before the person deserves to hear something.
//
// An ordinary spoken turn measures about 3 seconds, so this sits above that
// and below the point where silence reads as a dropped call. Building a
// workout plan measures 13-15s and will always cross it; logging a meal
// never will, and nobody hears a holding line for their toast.
const HOLDING_AFTER_MS = 4_000;

// Deliberately not "Let me think about that" - which invites a pause and
// then sounds odd when the answer was already ready - and deliberately not
// an apology. It says work is happening, in her own register.
const HOLDING_LINE = 'Let me put that together for you.';

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

// A call to one of the agent's system tools, in the OpenAI streaming shape.
function toolCallChunk(id: string, created: number, model: string, name: string) {
  return sseChunk(
    id,
    created,
    model,
    {
      tool_calls: [
        { index: 0, id: `call_${crypto.randomUUID()}`, type: 'function', function: { name, arguments: '{}' } },
      ],
    },
    null
  );
}

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
};

// Spoken aloud when a turn cannot be answered. It says only what is true -
// something failed - and never claims anything was or was not saved.
const SAY_AGAIN = 'Something went wrong just then. Could you say that again?';

// Nothing to answer: stay quiet and keep listening.
//
// An empty completion was believed to do this, and does not. ElevenLabs treats
// an empty answer as a failed generation and ends the call - found on device
// 2026-09-12, when a "..." after "See you later" ended a six-minute call as a
// failure, and three earlier calls ended the same way mid-conversation. The
// agent's skip_turn tool is the real way to say nothing; it was added to the
// agent that evening. If a request ever arrives without it offered, the empty
// completion is the fallback, known to be imperfect.
function listenCompletion(id: string, created: number, model: string, canSkip: boolean): Response {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(sseChunk(id, created, model, { role: 'assistant' }, null));
      if (canSkip) {
        controller.enqueue(toolCallChunk(id, created, model, 'skip_turn'));
        controller.enqueue(sseChunk(id, created, model, {}, 'tool_calls'));
      } else {
        controller.enqueue(sseChunk(id, created, model, { content: '' }, null));
        controller.enqueue(sseChunk(id, created, model, {}, 'stop'));
      }
      controller.enqueue(enc.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new Response(stream, { headers: SSE_HEADERS });
}

// What a turn says, and whether the call ends after it.
type Spoken = { text: string; endCall?: boolean };

// A spoken turn: open the response at once, fill it in when the words exist.
//
// OPEN THE RESPONSE FIRST. Until 2026-09-09 the adapter awaited the entire
// pipeline before returning a byte, so time-to-first-byte WAS total generation
// time. A workout plan takes 13-15 seconds to generate and the agent's cascade
// timeout maxes out at 15, so the response has to start sooner. The stream is
// returned immediately and does its waiting inside itself.
//
// A HOLDING LINE IS ONLY SENT WHEN THE WAIT EARNS ONE. Most turns answer in
// about three seconds, and "one moment" in front of a three-second reply is
// worse than silence. So it fires on a timer: if the words are not ready within
// HOLDING_AFTER_MS, the person hears it; if they are, they never know it existed.
//
// NEVER EMPTY. Whatever `produce` returns or throws, something is spoken,
// because an empty answer ends the call (see listenCompletion).
//
// THE CALL ENDS AFTER THE GOODBYE, when she asked for that (2026-09-12: "Can you
// close the chat?" got a goodbye and a call that stayed open). The reply is
// streamed first and the agent's end_call tool called after it, and only when
// ElevenLabs offered that tool on this request.
function spokenCompletion(
  id: string,
  created: number,
  model: string,
  canEnd: boolean,
  produce: () => Promise<Spoken>
): Response {
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(sseChunk(id, created, model, { role: 'assistant' }, null));

      let spokeHolding = false;
      const holding = setTimeout(() => {
        spokeHolding = true;
        controller.enqueue(sseChunk(id, created, model, { content: HOLDING_LINE }, null));
      }, HOLDING_AFTER_MS);

      let spoken: Spoken;
      try {
        spoken = await produce();
      } catch (err) {
        console.log('VOICE ADAPTER: pipeline threw', err instanceof Error ? err.message : err);
        spoken = { text: SAY_AGAIN };
      } finally {
        clearTimeout(holding);
      }
      const reply = spoken.text.trim() || SAY_AGAIN;

      // The holding line was already spoken, so the reply follows on from it
      // rather than restarting. Without this the person hears "Let me put that
      // together" and then a sentence that begins as though nothing was said.
      if (spokeHolding) {
        controller.enqueue(sseChunk(id, created, model, { content: ' ' }, null));
      }

      for (const piece of speakableChunks(reply)) {
        controller.enqueue(sseChunk(id, created, model, { content: piece }, null));
      }
      if (spoken.endCall && canEnd) {
        controller.enqueue(toolCallChunk(id, created, model, 'end_call'));
        controller.enqueue(sseChunk(id, created, model, {}, 'tool_calls'));
      } else {
        controller.enqueue(sseChunk(id, created, model, {}, 'stop'));
      }
      controller.enqueue(enc.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new Response(stream, { headers: SSE_HEADERS });
}

// How long the same words sent again wait for the answer already being written.
// "Yes, please." took nine seconds to answer on 2026-09-12, and a workout plan
// can take fifteen. The holding line covers the wait after four.
const REPLAY_WAIT_MS = 20_000;
// How long a continued turn waits for the half-answered one to finish before
// running, so that turn's logs and saves are already in the thread the model
// reads. Shorter than a replay, because the whole pipeline still runs after it.
const SUPERSEDE_WAIT_MS = 10_000;
const REPLAY_POLL_MS = 750;

type Db = ReturnType<typeof getSupabaseForRequest>;

// The answer the pipeline wrote after a given user turn, once it exists.
// Read from chat_messages because the pipeline writes its reply there, so this
// works whichever serverless instance ran the original turn.
async function answerAfter(db: Db, since: string, waitMs: number): Promise<string | null> {
  const deadline = Date.now() + waitMs;
  do {
    const { data } = await db
      .from('chat_messages')
      .select('content')
      .eq('role', 'assistant')
      .gt('created_at', since)
      .order('created_at', { ascending: true })
      .limit(1);
    const text = data?.[0]?.content;
    if (typeof text === 'string' && text.trim()) return text.trim();
    await new Promise((resolve) => setTimeout(resolve, REPLAY_POLL_MS));
  } while (Date.now() < deadline);
  return null;
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

  // The system tools ElevenLabs offered on this request.
  const tools = offeredTools(body.tools);
  const canEnd = tools.has('end_call');

  // Silence is answered by listening. Returned BEFORE the pipeline, so a
  // non-utterance costs no model call, writes no chat_messages row, and cannot
  // leave a "..." in the thread.
  if (isSilence(utterance)) {
    console.log('VOICE ADAPTER: empty utterance, listening');
    return listenCompletion(id, created, model, tools.has('skip_turn'));
  }

  // IS THIS A TURN ALREADY TAKEN, SENT AGAIN?
  //
  // Each version of this guard was right about something:
  // - 2026-09-09: one sentence arrived four times in 6.4 seconds and each ran
  //   the whole pipeline - four Claude calls and four food rows for one slice
  //   of toast. An exact-match guard answered the repeats with silence.
  // - 2026-09-10: a restatement with "Hello?" on the end got two replies, so the
  //   guard learned to match prefixes.
  // - 2026-09-12: an empty answer turned out to end the call, and replaying the
  //   first half's answer turned out to drop what she said after the pause -
  //   "What is a Baker's cyst?" was never answered, and a "yes, save it" only
  //   survived because a comma defeated the prefix match.
  //
  // WHAT DECIDES IT NOW is not the words but whether she heard the answer.
  // ElevenLabs sends the conversation as it actually happened with every
  // request. If the most recent turn in the thread got an answer she heard,
  // this is a new turn. If that answer is still being written, or was written
  // and never spoken because she carried on talking, this request is that same
  // turn again - usually longer.
  //
  // - The same words again: the answer already being written is the answer, so
  //   it is replayed and the pipeline runs once.
  // - More words: the whole sentence is answered, once the first run has
  //   finished, and the pipeline is told its first answer went unheard so it
  //   does not log or save the same thing twice. That instruction is the
  //   remaining risk - a model can still repeat a log - and it is taken because
  //   losing what she said is worse.
  //
  // The check reads chat_messages rather than any cache of our own, because the
  // pipeline writes the user turn BEFORE it calls the model, so a second request
  // sees the first even on a different serverless instance. RLS scopes the read
  // to this person; the token is the one the pipeline authenticates with next.
  //
  // KNOWN EDGE: a typed message sent within the window just before a call
  // starts has an answer ElevenLabs never saw, so the first spoken turn is
  // treated as continuing it. The cost is one line in the prompt telling the
  // model its last answer went unheard.
  let prior: { db: Db; since: string; sameWords: boolean } | null = null;
  try {
    const seen = new NextRequest(new URL('/api/ask-selodia', request.url), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const db = getSupabaseForRequest(seen);
    const { data: recent } = await db
      .from('chat_messages')
      .select('content, created_at')
      .eq('role', 'user')
      .gte('created_at', new Date(Date.now() - SUPERSEDE_WINDOW_MS).toISOString())
      .order('created_at', { ascending: false })
      .limit(1);
    const last = recent?.[0];
    if (last) {
      const since = String(last.created_at);
      const { data: after } = await db
        .from('chat_messages')
        .select('content')
        .eq('role', 'assistant')
        .gt('created_at', since)
        .order('created_at', { ascending: true })
        .limit(1);
      const answer = after?.[0]?.content;
      const spokenReplies = Array.isArray(body.messages)
        ? (body.messages as ChatMessage[])
            .filter((m) => m?.role === 'assistant')
            .map((m) => textOf(m.content))
        : [];
      if (!(typeof answer === 'string' && wasHeard(answer, spokenReplies))) {
        prior = { db, since, sameWords: words(String(last.content ?? '')) === words(utterance) };
      }
    }
  } catch (err) {
    // FAIL OPEN, deliberately. If the check itself breaks, the worst outcome
    // is a duplicate turn; refusing to answer because a guard could not run
    // would turn a logging bug into a mute assistant.
    console.log('VOICE ADAPTER: turn check failed, continuing -', err instanceof Error ? err.message : err);
  }

  // One turn through the pipeline. `voice: true` lets it defer the
  // food/activity parse to after(). It changes nothing about the reply or the
  // safety classification - only which work must finish before we can speak.
  // `supersedes` tells it this message continues a half-answered one.
  const ask = (supersedes?: string) =>
    askSelodia(
      new NextRequest(new URL('/api/ask-selodia', request.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: utterance, voice: true, ...(supersedes ? { supersedes } : {}) }),
      })
    );

  const spokenFrom = async (res: Response): Promise<Spoken> => {
    if (res.status === 401) {
      console.log('VOICE ADAPTER: pipeline rejected the token');
      return { text: 'I could not reach your account just then. Could you try that again?' };
    }
    if (!res.ok) {
      console.log('VOICE ADAPTER: pipeline returned', res.status);
      return { text: SAY_AGAIN };
    }
    const data = (await res.json()) as { reply?: string; endVoiceSession?: boolean };
    const text =
      typeof data.reply === 'string' && data.reply.trim().length > 0
        ? data.reply
        : 'Sorry, I did not catch that.';
    return { text, endCall: data.endVoiceSession === true };
  };

  if (prior) {
    const { db, since, sameWords } = prior;
    if (sameWords) {
      console.log('VOICE ADAPTER: the same turn sent again, replaying its answer');
      return spokenCompletion(id, created, model, false, async () => ({
        text: (await answerAfter(db, since, REPLAY_WAIT_MS)) ?? SAY_AGAIN,
      }));
    }
    console.log('VOICE ADAPTER: a turn continued after a pause, answering all of it');
    return spokenCompletion(id, created, model, canEnd, async () => {
      await answerAfter(db, since, SUPERSEDE_WAIT_MS);
      return spokenFrom(await ask(since));
    });
  }

  // Non-streaming is not what ElevenLabs asks for, but an OpenAI-compatible
  // endpoint that only speaks SSE is not OpenAI-compatible. A caller that sends
  // stream:false has to wait for the whole thing regardless - there is nothing
  // to stream into - so it takes the plain path.
  //
  // CHECKED BEFORE THE STREAM IS BUILT. A ReadableStream's start() runs the
  // moment it is constructed, and until 2026-09-12 the stream was built first,
  // so a stream:false caller ran the pipeline twice.
  if (body.stream === false) {
    const res = await ask();
    const data = res.ok ? ((await res.json()) as { reply?: string }) : {};
    return NextResponse.json({
      id,
      object: 'chat.completion',
      created,
      model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: typeof data.reply === 'string' && data.reply.trim() ? data.reply.trim() : SAY_AGAIN,
          },
          finish_reason: 'stop',
        },
      ],
    });
  }

  return spokenCompletion(id, created, model, canEnd, async () => spokenFrom(await ask()));
}
