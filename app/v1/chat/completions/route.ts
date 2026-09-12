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


// IS THIS THE SAME TURN, SAID AGAIN?
//
// The guard was an exact string match until 2026-09-10, when a real session
// produced two answers three seconds apart. What Ruth actually did was say a
// sentence, get no immediate response, and say it again with "Hello?" on the
// end. Two different strings; the same turn; two replies.
//
// So an utterance where one is a PREFIX of the other counts as a repeat. That
// covers both directions: speech-to-text finalising a longer transcript over a
// shorter one, and a person restating themselves with something appended.
//
// THE LENGTH FLOOR IS THE WHOLE SAFETY OF THIS. "no" is a prefix of "no
// thanks", "not for me" and "nothing yet", and swallowing a real answer
// because a similar short word was said ten seconds ago would be far worse
// than the duplicate this prevents. Below the floor, only an exact match
// counts - which is exactly the behaviour that existed before.
const RESTATEMENT_MIN_CHARS = 12;

function looksLikeRestatement(a: string, b: string): boolean {
  const norm = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ');
  const x = norm(a);
  const y = norm(b);
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (short.length < RESTATEMENT_MIN_CHARS) return false;
  return long.startsWith(short);
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

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
};

// Spoken aloud when a turn cannot be answered. It says only what is true -
// something failed - and never claims anything was or was not saved.
const SAY_AGAIN = 'Something went wrong just then. Could you say that again?';

// A well-formed completion carrying nothing to say.
//
// An empty assistant message is valid OpenAI shape, and it was believed to
// leave the conversation open with nothing spoken. FOUND ON DEVICE 2026-09-12:
// that is not what ElevenLabs does with it. Answering a real utterance with
// this ended three calls in one evening, each logged as "Brain returned no
// response". It now answers silence only, and whether a "..." answered this way
// also ends the call is unverified - the agent's skip_turn tool is the likely
// proper answer, and needs an agent change rather than a code one.
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
  return new Response(stream, { headers: SSE_HEADERS });
}

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
// because an empty answer ends the call (see silentCompletion).
function spokenCompletion(
  id: string,
  created: number,
  model: string,
  produce: () => Promise<string>
): Response {
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(sseChunk(id, created, model, { role: 'assistant' }, null));

      let spokeHolding = false;
      const holding = setTimeout(() => {
        spokeHolding = true;
        controller.enqueue(sseChunk(id, created, model, { content: HOLDING_LINE }, null));
      }, HOLDING_AFTER_MS);

      let reply: string;
      try {
        reply = (await produce()).trim();
      } catch (err) {
        console.log('VOICE ADAPTER: pipeline threw', err instanceof Error ? err.message : err);
        reply = SAY_AGAIN;
      } finally {
        clearTimeout(holding);
      }
      if (!reply) reply = SAY_AGAIN;

      // The holding line was already spoken, so the reply follows on from it
      // rather than restarting. Without this the person hears "Let me put that
      // together" and then a sentence that begins as though nothing was said.
      if (spokeHolding) {
        controller.enqueue(sseChunk(id, created, model, { content: ' ' }, null));
      }

      for (const piece of speakableChunks(reply)) {
        controller.enqueue(sseChunk(id, created, model, { content: piece }, null));
      }
      controller.enqueue(sseChunk(id, created, model, {}, 'stop'));
      controller.enqueue(enc.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new Response(stream, { headers: SSE_HEADERS });
}

// How long a restatement waits for the answer to the turn it restates. That
// turn may still be in the pipeline when the restatement arrives - "Yes,
// please." took nine seconds to answer on 2026-09-12 - and a workout plan can
// take fifteen. The holding line covers the wait after four.
const REPLAY_WAIT_MS = 20_000;
const REPLAY_POLL_MS = 750;

type Db = ReturnType<typeof getSupabaseForRequest>;

// The answer the pipeline wrote after a given user turn, once it exists.
// Read from chat_messages because the pipeline writes its reply there, so this
// works whichever serverless instance ran the original turn.
async function answerAfter(db: Db, since: string): Promise<string | null> {
  const deadline = Date.now() + REPLAY_WAIT_MS;
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
  //
  // A RESTATEMENT IS ANSWERED WITH THE ANSWER ALREADY GIVEN, NOT WITH SILENCE
  // (2026-09-12). Silence ended three calls on a real phone in one evening, and
  // what arrived was not a repeat at all. Ruth paused mid-sentence; ElevenLabs
  // sent the first half ("Yes, please."), then, when she carried on, dropped
  // that answer unspoken and sent the whole sentence ("Yes, please. Yes, save
  // it, please."). The half is a prefix of the whole, so the guard answered the
  // whole with nothing, and ElevenLabs hung up. The routine was saved and the
  // reply was written; she heard none of it.
  //
  // So the answer to the turn being restated is spoken instead, waiting for it
  // if that turn is still in the pipeline. The pipeline still runs once - one
  // Claude call, one log - and what she hears is exactly what the thread
  // records as said. The cost: the half-sentence is what got answered, so
  // anything added after the pause is not in the reply. Saying it again is a
  // new turn, and the model was otherwise going to answer an unheard reply.
  let restated: { db: Db; since: string } | null = null;
  try {
    const seen = new NextRequest(new URL('/api/ask-selodia', request.url), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const db = getSupabaseForRequest(seen);
    // Fetches the window's turns rather than asking the database to match,
    // because prefix comparison after normalising whitespace and case is not
    // something a column filter can express. The window is fifteen seconds, so
    // this is a handful of short rows.
    const { data: recent } = await db
      .from('chat_messages')
      .select('content, created_at')
      .eq('role', 'user')
      .gte('created_at', new Date(Date.now() - DEDUP_WINDOW_MS).toISOString())
      .order('created_at', { ascending: false })
      .limit(5);

    const repeat = (recent ?? []).find((r) =>
      looksLikeRestatement(String(r.content ?? ''), utterance)
    );
    if (repeat) restated = { db, since: String(repeat.created_at) };
  } catch (err) {
    // FAIL OPEN, deliberately. If the check itself breaks, the worst outcome
    // is the duplicate we already had; refusing to answer because a guard
    // could not run would turn a logging bug into a mute assistant.
    console.log('VOICE ADAPTER: dedup check failed, continuing -', err instanceof Error ? err.message : err);
  }

  if (restated) {
    console.log('VOICE ADAPTER: restatement of a turn already taken, replaying its answer');
    const { db, since } = restated;
    return spokenCompletion(id, created, model, async () => (await answerAfter(db, since)) ?? SAY_AGAIN);
  }

  // One turn through the pipeline. `voice: true` lets it defer the
  // food/activity parse to after(). It changes nothing about the reply or the
  // safety classification - only which work must finish before we can speak.
  const ask = () =>
    askSelodia(
      new NextRequest(new URL('/api/ask-selodia', request.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: utterance, voice: true }),
      })
    );

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

  return spokenCompletion(id, created, model, async () => {
    const res = await ask();
    if (res.status === 401) {
      console.log('VOICE ADAPTER: pipeline rejected the token');
      return 'I could not reach your account just then. Could you try that again?';
    }
    if (!res.ok) {
      console.log('VOICE ADAPTER: pipeline returned', res.status);
      return SAY_AGAIN;
    }
    const data = (await res.json()) as { reply?: string };
    return typeof data.reply === 'string' && data.reply.trim().length > 0
      ? data.reply
      : 'Sorry, I did not catch that.';
  });
}
