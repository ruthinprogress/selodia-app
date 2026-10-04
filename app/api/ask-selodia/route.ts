import { after, NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseForRequest, userIdForRequest } from '../../lib/supabase';
// Describes the app's screens, tabs and controls so the model can point
// somebody at where a thing lives. About 2,100 tokens, and OMITTED ON A SPOKEN
// TURN: nobody in a voice conversation is looking at the screen, the
// fourth-wall rule already forbids narrating the interface, and it was the
// single largest block of prompt that a spoken exchange cannot use. Text turns
// keep it in full.
import { APP_STRUCTURE_PROMPT_BLOCK, VOICE_CONDUCT_BLOCK } from '../../lib/app-structure';
import {
  falseClaimNote,
  stripDisavowal,
  stripMachineOutput,
  stripSaveClaims,
  unescapeNewlines,
} from '../../lib/claimed-write';
import { needDurationNote, unsavedNote, type LogAttempt } from '../../lib/save-honesty';
import { buildLongHistory } from '../../lib/long-history';
import { weighInFacts } from '../../lib/weigh-in-facts';
import { listRecoverable, recoverDeleted, recoverNote, recoverablePrompt } from '../../lib/recover-deleted';
import { statesATrackedMetric } from '../../lib/stated-measurement';
import {
  newPathWrites,
  REPLY_STREAMS_TO_VOICE,
  turnIsOrdinary,
  writeReplyAfterSaves,
} from '../../lib/chat-path';
import { voiceSinkFor } from '../../lib/voice-sink';
import { recordModelUsage } from '../../lib/usage-record';
import { recordRouteError, recordTurnTiming } from '../../lib/turn-diagnostics';
import {
  CLASSIFY_TOOL_NAME,
  RESOURCES,
  SAFETY_PROMPT_BLOCK,
  applySafetyStateMachine,
  buildClassifyTool,
  buildContextualAdditions,
  type EscalationStep,
} from '../../lib/safety-classification';
import { buildHealthContextPrompt, hasHealthContext, type HealthContext } from '../../lib/health-context';
import { buildCycleContextPrompt } from '../../lib/cycle';
import { logFoodFromText } from '../../lib/food-logging';
import { lifeStageFacts } from '../../lib/life-stage-facts';
import { weekFacts } from '../../lib/week-facts';
import { skillFacts } from '../../lib/skill-facts';
import { feelFacts } from '../../lib/feel-facts';
import {
  answerWrittenAfter,
  earlierTwin,
  settleVoiceSentence,
} from '../../lib/voice-supersede';
import { logActivityFromText } from '../../lib/activity-logging';
import {
  choosePlan,
  resolvePlans,
  recordPlanSession,
  sessionSummary,
} from '../../lib/workout-session';
import { todayISODate } from '../../lib/workout-logs';
import { itemsOf } from '../../lib/me-items';
import { meUpdateNote, updateMeCard } from '../../lib/me-update';
import { addWeekEntry, weekEntryNote, weekNoteNeeded } from '../../lib/week-entry';
import { createWriteLog } from '../../lib/write-log';
import type { WeekEntryOutcome } from '../../lib/week-entry';
import { hydrationSaveSummary, logHydrationFromText } from '../../lib/hydration-logging';
import { logSleepFromText, sleepSaveSummary } from '../../lib/sleep-logging';
import { foodSaveSummary, activitySaveSummary } from '../../lib/save-summary';
import {
  logMeasurementFromText,
  measurementSaveSummary,
  personalSaveSummary,
} from '../../lib/measurement-logging';
import {
  coerceCorrectionScope,
  correctionCutoff,
  correctionDayRange,
  deletionMessage,
  duplicatesRemovedMessage,
  DUPLICATE_MATCH_COLUMNS,
  nothingToCorrectMessage,
  resolveCorrection,
  supportsDuplicateRemoval,
  TABLE_FOR,
  TIME_COLUMN_FOR,
  whichReadingMessage,
} from '../../lib/log-correction';
import { saveAlmanacEntry } from '../../lib/almanac';
import { buildAllergyPrompt, filtersFood, recordAllergies, type Allergy } from '../../lib/allergies';
import { planRemovalMessage, removePlanTitled } from '../../lib/plan-removal';
import { contentWords } from '../../lib/food-dedupe';
import { buildTrackedMacroBlock } from '../../lib/tracked-macro-summary';
import { blockedSuggestionMessage, runAllergyGate } from '../../lib/allergy-gate';
import { assessGoalWeight, goalSafetyPrompt, shouldOfferResource } from '../../lib/goal-safety';
import { buildDayState, buildDayStatePrompt } from '../../lib/daily-targets';
import {
  applyPendingFocus,
  clearPendingFocus,
  coerceFocus,
  focusAppliedNote,
  pendingFocusPrompt,
  readPending,
  storePendingFocus,
} from '../../lib/focus-states';
import {
  applyRules,
  loadRules,
  removalNote,
  rulesPrompt,
  type PlanExercise,
} from '../../lib/rules-gate';
import {
  RED_FLAGS_LIVE,
  alreadyRaised,
  matchRedFlag,
  recordRaised,
} from '../../lib/red-flags';
import {
  clearPendingSave,
  coerceProposal,
  applyRedirect,
  commitSave,
  offerQuestion,
  type SaveType,
  pendingSavePrompt,
  prepareNote,
  readPendingSave,
  saveAppliedNote,
  offeredRecently,
  storePendingSave,
} from '../../lib/pending-save';
import {
  assessConsolidation,
  CONSOLIDATION_OFFER_BLOCK,
  declineConsolidation,
  enterLiteMode,
  isInLiteMode,
  LITE_MODE_STANDING_BLOCK,
  markConsolidationOffered,
} from '../../lib/graduation';
import { loadHabitWindow } from '../../lib/habit-window';
import { isSpotlightTarget } from '../../lib/spotlight-targets';
import {
  isCardMediaType,
  isDiscussEntryType,
  loadDiscussEntryFacts,
  fetchPendingCardImage,
  markCardImageSent,
  discussEntryName,
  resolveDiscussTag,
  uploadDiscussCard,
  type DiscussTag,
} from '../../lib/discuss-card';
import { EVIDENCE_PRINCIPLE } from '../../lib/principles';
import { writeCycleEvent } from '../../lib/cycle-logging';
import { drinkHasCalories } from '../../lib/caloric-drink';
import { readOffsets } from '../../lib/pattern-check';
import { type PatternResult, runPatternCheck } from '../../lib/pattern-query';
import { wordFor as wordForMeasure, writeFeeling } from '../../lib/feeling-logging';
import { cycleSaved, daysFrom, feelingSaved, readSpokenCycle, readSpokenFeeling, spokenDayLabel } from '../../lib/spoken-day';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Upgraded from Haiku to the same stronger model onboarding-chat uses -
// this route now runs the same distress classification, which decides
// whether the safety boundary fires, so it warrants the same reasoning
// capability rather than the routine-task tier (see SELODIA_SPEC.md, Part
// Three, and onboarding-chat/route.ts for the same rationale).
const MODEL = 'claude-sonnet-5';

const NON_DISTRESS_CLASSIFICATIONS = ['neutral'] as const;
type Classification = (typeof NON_DISTRESS_CLASSIFICATIONS)[number] | import('../../lib/safety-classification').DistressTier;

// EVERY DATE THE MODEL SEES IS THE DATE SHE WOULD SAY (UI brief, Part 3,
// 2026-09-17: "All dates throughout the app - convert from ISO format to human
// readable"). The context lines below used to carry 2026-09-14, and a model
// given an ISO date writes an ISO date back into the conversation. Fixed here,
// at the one place they are composed, rather than asked for in the prompt.
const HUMAN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
function humanDate(value: string | null | undefined): string {
  const d = new Date(String(value ?? ''));
  if (!Number.isFinite(d.getTime())) return String(value ?? '');
  const spoken = `${d.getDate()} ${HUMAN_MONTHS[d.getMonth()]}`;
  return d.getFullYear() === new Date().getFullYear() ? spoken : `${spoken} ${d.getFullYear()}`;
}

// Run in London, beside the database. See the note in v1/chat/completions,
// which carries the measurement - this route is reached both through that
// adapter and directly by a typed message, so both need it or typing still
// runs in Virginia.
export const preferredRegion = 'lhr1';

// The shape turn_context() returns.
//
// Written out rather than left loose because this replaced twenty typed reads
// with one jsonb blob, and the compiler was the only thing standing between a
// renamed column and a prompt that quietly lost a section. Every field here
// matches a select list in the migration; change one and change both.
type TurnContext = {
  lastAssistantTurn: {
    classification: string | null;
    escalation_step: string | null;
    distress_revisit_count: number | null;
  } | null;
  recentHistory: { role: string; content: string }[];
  contextRows: { category: string; content: string }[];
  // HER CURRENT GOALS, from user_goals with archived ones excluded. Goal rows
  // are no longer in contextRows: the model was reading a goal she replaced in
  // August alongside the one that replaced it, with nothing to say which was
  // which. See the migration chat_reads_the_current_goal_only.
  goalRows: { label: string; detail: string | null; set_on: string | null }[];
  recentFood: { happened_at: string; raw_text: string; kcal: number | null; protein_g: number | null }[];
  recentActivity: {
    happened_at: string;
    activity_type: string | null;
    duration_min: number | null;
    kcal_burned: number | null;
    eccentric_load: string | null;
    intensity: string | null;
  }[];
  recentDailyBurn: {
    date: string;
    steps: number | null;
    kcal_burned: number | null;
    active_kcal: number | null;
    active_minutes: number | null;
    distance_km: number | null;
  }[];
  recentDrinks: { ml: number | null; happened_at: string }[];
  recentSleep: {
    night_of: string;
    duration_min: number | null;
    quality: string | null;
    awakenings: number | null;
  }[];
  recentMeasurements: { measured_at: string; weight_kg: number | null; body_fat_pct: number | null }[];
  healthContextRow: Record<string, unknown> | null;
  lastPeriodRow: { event_date: string } | null;
  yesterdaySummary: { summary_date: string; mediating_factor: string | null } | null;
  profileRow: Record<string, unknown> | null;
  allergies: Allergy[];
  planRows: { id: string; title: string; content: unknown }[];
  insightRows: { kind: string; title: string; created_at: string }[];
  meRows: { title: string; category: string | null; content: unknown }[];
  // WHAT SHE WANTS TO BECOME ABLE TO DO, selected by turn_context from
  // 2 October 2026. See the migration chat_can_see_her_skills: chat gained
  // the ability to WRITE a skill in the same commit, and shipping a write
  // without the read is how her week came to be addable and unreadable for an
  // hour on 1 October.
  skillRows: unknown;
  // HOW SHE WANTS HER DAYS TO FEEL, and her last look-back. Item 7, selected by
  // turn_context from 2 October 2026 - in the same commit as the write, because
  // a feel goal the model cannot see is the first question in setup changing
  // nothing.
  feelRows: unknown;
  feelLookback: unknown;
  // HER WEEK, selected by turn_context from 1 October 2026 and not before.
  // See the migration week_time_of_day_and_chat_can_see_it.
  weekRows: {
    activity: string | null;
    days: unknown;
    duration: string | null;
    cadence: string | null;
    time_of_day: string | null;
    purpose: string | null;
  }[];
  pendingCardRow: { id: string; image_path: string } | null;
  dayFood: { kcal: number | null; protein_g: number | null }[];
  latestMeasurement: { weight_kg: number | null; body_fat_pct: number | null; bmr: number | null } | null;
};

// WHERE THE SECONDS GO, written down rather than guessed at.
//
// On 24 September a spoken turn measured 8.6s to its first word, and the
// Anthropic call inside it measured 2.9s against the real prompt and the real
// tool. Five and a half seconds were somewhere else in this function and
// nobody could say where, which is how "voice is slow" stayed an opinion for
// two weeks.
//
// One line in the log per turn, so the next question about latency is answered
// by reading rather than by another afternoon of probes. Cheap enough to leave
// on: a Date.now() per phase and one console.log at the end.
function phaseTimer() {
  const start = Date.now();
  const marks: Record<string, number> = {};
  return {
    mark: (name: string) => {
      marks[name] = Date.now() - start;
    },
    report: (label: string) => {
      const total = Date.now() - start;
      // Elapsed-at-mark is what a flame chart shows; the gaps between them are
      // the phases. Printed as one JSON object so it can be read out of the
      // Vercel log with a single grep.
      console.log(`TURN TIMINGS ${label}`, JSON.stringify({ ...marks, total }));
    },
    // THE SAME NUMBERS, HANDED BACK TO A CALLER THAT ASKS FOR THEM.
    //
    // The log line above is the right place for these and was not enough: the
    // log tail returns a buffered window that went stale mid-investigation, so
    // an afternoon of measurements could not be told apart from each other. A
    // probe that has to ask a second system what the first system just did will
    // eventually be lied to.
    //
    // Durations only, on an already-authenticated request, and only when asked
    // for by header - so it costs nothing and tells a stranger nothing.
    taken: () => ({ ...marks, total: Date.now() - start }),
  };
}

export async function POST(request: NextRequest) {
  const timing = phaseTimer();
  const supabase = getSupabaseForRequest(request);
  // Verified from the token's own signature rather than by asking the Auth
  // server, which cost 500ms to 760ms at the front of every spoken turn. See
  // userIdForRequest for what that trades and why RLS is unaffected.
  const userId = await userIdForRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = { id: userId };
  timing.mark('authorised');

  const {
    message,
    cardImageBase64,
    cardMediaType,
    entryId,
    entryType,
    voice,
    supersedes,
    // Set by the app when the PREVIOUS voice session ended unexpectedly.
    resumedAfterDrop,
    // She closed the anchored topic herself, from its card (2026-09-19). One of
    // the three ways a discussion ends - see resolveDiscussTag.
    closeDiscussion,
  } = await request.json();
  // A spoken turn, routed in by the custom-LLM adapter. It changes nothing about
  // what is said or what safety runs - only WHEN the parse happens. See the
  // logging branch below.
  const isVoice = voice === true;
  // A SUPERSEDED VOICE TURN (2026-09-12). The adapter's word that this message
  // is the whole of what the person said: they paused, the first part was
  // answered, and they carried on talking before hearing it. Carries when that
  // first part was said. Voice only - a typed message is never split this way.
  const supersededSince =
    isVoice && typeof supersedes === 'string' && Number.isFinite(Date.parse(supersedes))
      ? supersedes
      : null;
  console.log('CHAT REQUEST RECEIVED:', message);

  // "Ask about this" (item 30): the tapped entry's card rides this turn as an
  // image. Upload first so the turn is persisted with its reference; a failed
  // upload degrades to an ordinary text turn rather than losing the message.
  let cardImagePath: string | null = null;
  if (cardImageBase64 && isCardMediaType(cardMediaType)) {
    cardImagePath = await uploadDiscussCard(supabase, user.id, cardImageBase64, cardMediaType);
  }
  // The entry tag travels with the message from the posting turn forward, so a
  // single entry's Q&A can be pulled back out of the date-scrolled thread.
  const taggedEntryId = typeof entryId === 'string' && isDiscussEntryType(entryType) ? entryId : null;
  const taggedEntryType = taggedEntryId ? entryType : null;

  // The tag carried by the turn before this one — read BEFORE inserting, so it
  // is genuinely the previous message rather than the one being written now.
  const { data: prevTagRow } = await supabase
    .from('chat_messages')
    .select('discuss_entry_id, discuss_entry_type, created_at')
    .eq('user_id', user.id)
    .eq('source', 'chat')
    .not('discuss_entry_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const postedTag: DiscussTag =
    taggedEntryId && isDiscussEntryType(taggedEntryType)
      ? { entryId: taggedEntryId, entryType: taggedEntryType }
      : null;
  const previousTag: DiscussTag =
    prevTagRow?.discuss_entry_id && isDiscussEntryType(prevTagRow.discuss_entry_type)
      ? {
          entryId: prevTagRow.discuss_entry_id as string,
          entryType: prevTagRow.discuss_entry_type,
        }
      : null;

  // How long the discussion has been sitting idle. Null when there is no
  // previous tag or its timestamp is unreadable, which resolveDiscussTag treats
  // as "unknown" rather than "fresh".
  const minutesSincePrevious = (() => {
    const at = prevTagRow?.created_at;
    if (typeof at !== 'string') return null;
    const then = new Date(at).getTime();
    if (isNaN(then)) return null;
    return (Date.now() - then) / 60_000;
  })();

  // Insert optimistically under continue-by-default. The model's verdict on
  // whether the topic has moved on arrives with the reply, so this is corrected
  // below rather than blocking the turn on a call that hasn't happened yet.
  // The gap is knowable NOW, though, so a stale discussion is dropped before the
  // turn is written rather than being written and corrected.
  const provisionalTag = resolveDiscussTag({
    posted: postedTag,
    previous: previousTag,
    topicEnded: false,
    minutesSincePrevious,
  });

  // THE TURN'S ID IS MINTED HERE, NOT ASKED FOR (Ruth's item 5, 2026-09-28).
  //
  // One reply per turn is enforced by a PARTIAL unique index on `answers_id`,
  // partial because the rows that legitimately answer nothing - the weekly
  // roundup, a photo acknowledgment - must still write, and Postgres permits any
  // number of NULLs in a unique index.
  //
  // A chat reply is never one of those rows: it always answers something. It was
  // getting a null only when this insert failed to hand an id back, which is the
  // precise moment the turn is most likely to be retried and therefore the
  // precise moment the guard was quietly not applying.
  //
  // So the id is decided before the write rather than read after it. It exists
  // whether or not the row landed, the reply always carries it, and the index
  // does the rest. Her words: "close the gap so a reply can't be written twice
  // even with no user row attached."
  const turnId = crypto.randomUUID();
  const { error: userInsertError } = await supabase
    .from('chat_messages')
    .insert({
      id: turnId,
      user_id: user.id,
      role: 'user',
      content: message,
      source: 'chat',
      image_path: cardImagePath,
      discuss_entry_id: provisionalTag?.entryId ?? null,
      discuss_entry_type: provisionalTag?.entryType ?? null,
    });
  if (userInsertError) {
    console.log('ASK-SELODIA USER TURN INSERT FAILED:', userInsertError.message);
  }
  // Kept so the rest of the route reads as it did. The id is now known even when
  // the write failed, which is the whole point.
  const userRow = { id: turnId };

  // THE SAME TURN, TWICE AT ONCE. See earlierTwin in lib/voice-supersede.ts.
  // The later copy writes nothing - no model call, no log - and answers with
  // what the first copy says, so only one reply is produced, and its own row is
  // removed so the thread shows the turn once. If the first copy never answers
  // (it failed), this copy runs the turn itself rather than erroring: a failure
  // must not take its retry down with it.
  //
  // NO LONGER VOICE ONLY (Ruth, 26 September 2026). She saw doubled messages in
  // TEXT chat as well, where this check was skipped entirely. The cause was a
  // stale-state guard in the app letting two requests leave in one tick - fixed
  // there too - but a guard belongs at the write, which is her standing rule
  // and the reason this now runs whatever the source. The client can be wrong,
  // retried, or replaced; the row is written here.
  //
  // It is safe for typed turns because it is not merely matching on words: the
  // same sentence said again ON PURPOSE - "Yes." and, after an answer, "Yes."
  // again - has an assistant reply between the two, and earlierTwin checks for
  // exactly that before calling anything a duplicate.
  timing.mark('userRowWritten');
  const twin = await earlierTwin(supabase, userRow?.id ?? null, message);
  if (twin && userRow?.id) {
    const reply = await answerWrittenAfter(supabase, twin.created_at);
    if (reply) {
      console.log('ASK-SELODIA: a second copy of the same turn; answering with the first');
      await supabase.from('chat_messages').delete().eq('id', userRow.id).eq('user_id', user.id);
      return NextResponse.json({ reply });
    }
    console.log('ASK-SELODIA: the first copy of this turn never answered; running it');
  }

  // HOW FAR BACK THE CONTEXT REACHES. Seven days when typing, three when
  // speaking.
  //
  // Not a guess at what is useful - a response to what is expensive. The
  // measured cost of a spoken turn is almost entirely Sonnet reading its own
  // prompt: roughly 8,000 tokens in against max_tokens of 500. Three days still
  // covers "yesterday", "this morning" and "earlier in the week", which is what
  // a spoken exchange refers back to; days four to seven were being read in
  // full on every turn to answer questions nobody asks out loud.
  //
  // Text stays at seven days deliberately: it has no cascade timeout, and its
  // summaries feed patterns the roundups draw on.
  const contextSince = new Date();
  contextSince.setDate(contextSince.getDate() - (isVoice ? 3 : 7));

  // Hoisted so the day's two reads can join the batch below. Same boundary as
  // before - midnight local - and the one place it is computed, so "today"
  // cannot come to mean two different things in one route.
  const dayStartForState = new Date();
  dayStartForState.setHours(0, 0, 0, 0);

  // Every read below is independent of the others, so they go out together
  // rather than as eight sequential round trips. Each one previously cost its
  // own latency before the model call had even started.
  //
  // ORDER STILL MATTERS in one direction: this batch must run AFTER the user
  // turn is inserted, because recentHistory has to include the message just
  // sent. The previous-tag read above must run BEFORE it, or it would read the
  // row being written. Only the mutual independence within this batch is new.
  // ONE ROUND TRIP, NOT TWENTY (2026-09-24).
  //
  // These reads already went out together, so on paper the batch cost whatever
  // the slowest of them cost: about 127ms, timed individually against the real
  // database. In production the phase measured two to four seconds, which for
  // parallel reads is not arithmetic that works.
  //
  // The distance was the answer. X-Vercel-Id reads `lhr1::iad1`, so the
  // function runs in Washington DC while the database is in London, and every
  // read crossed the Atlantic. Parallel does not rescue that: each connection
  // pays its own TLS handshake, which is two more crossings, and twenty
  // requests do not share one connection. Vercel's free plan pins the function
  // to a region we cannot choose, so the distance is fixed and the only thing
  // left to change is how often we travel it.
  //
  // turn_context() is security invoker, so every RLS policy applies exactly as
  // it did when these were twenty separate reads, and it returns raw rows
  // rather than prompt text - the wording stays in TypeScript where it can be
  // read. probe-turn-context-rpc.mjs compares the two paths field for field on
  // real data and was green on all twenty before this was wired in.
  //
  // AND THE THREE READS BESIDE IT GO IN THE SAME BREATH (27 September 2026).
  // They were added over the last two days as three more `await`s in a row -
  // six months of history, today's sodium, and what she can still recover -
  // which put FOUR sequential network hops where this work had just reduced
  // twenty to one. None of them needs anything from turn_context; they only
  // need her id. Measured on her phone this morning, a turn took 3.8 to 5.9
  // seconds against 3.2 on Wednesday.
  //
  // Worth naming the mistake rather than just fixing it: each one looked free
  // at the time BECAUSE it was one small read, and the cost only exists in the
  // sequence. That is the same shape as the argument-list trap already written
  // up in DECISION_PATTERNS - a thing that reads plausibly on its own line.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [ctxResult, longHistoryBlock, sodiumResult, recoverableRows] = await Promise.all([
    supabase.rpc('turn_context', {
      p_since: contextSince.toISOString(),
      p_day_start: dayStartForState.toISOString(),
    }),
    // SIX MONTHS, SUMMARISED. Separate from turn_context deliberately: that RPC
    // is bounded by a few days, and widening it would widen every block hanging
    // off it. See app/lib/long-history.ts.
    buildLongHistory(supabase, user.id),
    // TODAY'S SODIUM, which the turn context does not carry. It is what makes
    // "a salty day" checkable rather than a plausible story - see
    // app/lib/weigh-in-facts.ts.
    supabase
      .from('food_logs')
      .select('happened_at, sodium_mg')
      .eq('user_id', user.id)
      .gte('happened_at', todayStart.toISOString()),
    // WHAT SHE DELETED AND COULD STILL HAVE BACK. Read every turn rather than
    // only when asked, because the asking is the thing that has to work.
    listRecoverable(supabase, user.id),
  ]);

  const { data: ctx, error: ctxError } = ctxResult;
  const sodiumRows = sodiumResult.data;
  const recoverableBlock = recoverablePrompt(recoverableRows);

  // FAIL LOUDLY RATHER THAN ANSWER WITHOUT HER RECORD. Twenty separate reads
  // used to fail one at a time and the turn carried on with a hole in it. One
  // read means one failure takes everything, and a reply composed with no food,
  // no history and no health context would still SOUND fine - which is worse
  // than saying so.
  if (ctxError || !ctx) {
    console.log('TURN CONTEXT FAILED:', ctxError?.message ?? 'no rows');
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }

  const {
    lastAssistantTurn,
    recentHistory,
    contextRows,
    goalRows,
    recentFood,
    recentActivity,
    recentDailyBurn,
    recentDrinks,
    recentSleep,
    recentMeasurements,
    healthContextRow,
    lastPeriodRow,
    yesterdaySummary,
    profileRow,
    allergies: disclosedAllergyRows,
    planRows,
    insightRows,
    meRows,
    weekRows,
    skillRows,
    feelRows,
    feelLookback,
    pendingCardRow,
    dayFood,
    latestMeasurement,
  } = ctx as TurnContext;

  const disclosedAllergies = (disclosedAllergyRows ?? []) as Allergy[];
  const savedPlans = resolvePlans(planRows);
  const dayStateRows = { todayFood: dayFood, latest: latestMeasurement };

  // WHAT SHE ACTUALLY EATS, for suggesting food she recognises. A fortnight of
  // her own entries, newest first; turn-facts dedupes and caps them. Cheap, and
  // it is the only personalisation that cannot be wrong, because she ate it.
  const { data: recentMeals } = await supabase
    .from('food_logs')
    .select('raw_text')
    .eq('user_id', userId)
    .gte('happened_at', new Date(Date.now() - 14 * 86_400_000).toISOString())
    .order('happened_at', { ascending: false })
    .limit(60);
  const usuallyEats = (recentMeals ?? [])
    .map((r) => (typeof r.raw_text === 'string' ? r.raw_text : ''))
    .filter((t) => t.length > 0);
  // Only downloaded when something is actually waiting, which is rare. The row
  // itself came with everything else.
  const pendingCard = await fetchPendingCardImage(supabase, pendingCardRow);

  timing.mark('contextLoaded');

  const previousEscalationStep: EscalationStep =
    (lastAssistantTurn?.escalation_step as EscalationStep) ?? null;
  const previousClassification: Classification | null =
    (lastAssistantTurn?.classification as Classification) ?? null;
  const previousRevisitCount: number = lastAssistantTurn?.distress_revisit_count ?? 0;

  const messages: Anthropic.MessageParam[] = (recentHistory ?? [])
    .slice()
    .reverse()
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      // HER HISTORY IS CLEANED BEFORE THE MODEL READS IT (2026-09-30).
      //
      // A model's strongest instruction is its own previous output. When the
      // proposedSave JSON leaked into her thread this morning, those turns
      // stayed there - and hours later, with the leak itself fixed, a proposal
      // came back with the escape sequences visible as text, exactly the shape
      // of that leaked content string. Nothing was generating that any more,
      // so it was copying
      // the shape of a message it could still see itself having written.
      //
      // A bad turn is therefore not over when it is fixed. It keeps teaching
      // until it leaves the window, so it is cleaned on the way in: machine
      // output removed, escaped newlines made real.
      content:
        m.role === 'assistant'
          ? unescapeNewlines(stripMachineOutput(m.content as string))
          : (m.content as string),
    }));

  const insightsBlock =
    (insightRows ?? []).length > 0
      ? [
          '',
          'Here is what is already kept in their Insights, newest first. Do not offer any of these again as though it were new - see RECURRENCE in the Almanac section:',
          ...(insightRows ?? []).map(
            (r) => `- ${r.kind}: ${r.title} (${String(r.created_at).slice(0, 10)})`
          ),
          '',
        ].join('\n')
      : '';

  const meCardsBlock =
    (meRows ?? []).length > 0
      ? [
          '',
          // WITH THEIR CONTENTS (2026-09-30).
          //
          // This used to list the title, the category and the status and
          // nothing else, which is why on 29 September Ruth pasted her three
          // skincare products and was told "there's nothing in your record
          // showing these products". From where the model sat that was TRUE:
          // all it could see was "Evening Skincare Routine (Skincare): Active".
          // It had no way to know the card already named retinol and vitamin C.
          //
          // A model cannot say what is or is not in somebody's record unless it
          // can see the record. So the why and the items go in too.
          "Here is what is in their Me tab - their personal protocol - with what each card says. When they tell you one of these has CHANGED, set meUpdate; when they give you new or changed CONTENTS for one, offer it with proposedSave type 'me' using the SAME title, and the app will merge it into this card rather than making a second one:",
          ...(meRows ?? []).flatMap((r) => {
            const c = (r.content ?? {}) as Record<string, unknown>;
            const status = typeof c.status === 'string' ? c.status : null;
            const why = typeof c.why === 'string' ? c.why : null;
            const items = itemsOf(c);
            const head = `- ${r.title}${r.category ? ` (${r.category})` : ''}${status ? `: ${status}` : ''}`;
            const lines = [head];
            if (why) lines.push(`    why: ${why}`);
            for (const item of items) {
              lines.push(
                `    item: ${item.name}${item.when ? ` | ${item.when}` : ''}${item.purpose ? ` | ${item.purpose}` : ''}`
              );
            }
            return lines;
          }),
          '',
        ].join('\n')
      : '';
  // THE SAME CARDS, WITH NO INSTRUCTIONS IN THEM (2026-09-30).
  //
  // meCardsBlock above tells the CLASSIFY call how to emit a save - "offer it
  // with proposedSave type 'me'". That sentence is correct for a model with a
  // tool to put it in, and catastrophic for the model that writes her reply,
  // which has no tool and only writes prose.
  //
  // I wired extraBlocks to the writer this morning and handed it that block.
  // It did the only thing it could with an instruction to emit proposedSave: it
  // typed the JSON into her message. Twice, at 11:32 and 11:35, followed by
  // "That's saved to your Me tab."
  //
  // So the writer gets FACTS and the classifier gets INSTRUCTIONS, and the two
  // are built separately rather than one being reused for both. A block that
  // names a field name has no business in front of the model that writes to
  // her.
  const meFactsBlock =
    (meRows ?? []).length > 0
      ? [
          '',
          'WHAT IS ON HER ME TAB - her personal protocol, as it currently stands:',
          ...(meRows ?? []).flatMap((r) => {
            const c = (r.content ?? {}) as Record<string, unknown>;
            const status = typeof c.status === 'string' ? c.status : null;
            const why = typeof c.why === 'string' ? c.why : null;
            const items = itemsOf(c);
            const lines = [
              `- ${r.title}${r.category ? ` (${r.category})` : ''}${status ? `: ${status}` : ''}`,
            ];
            if (why) lines.push(`    why: ${why}`);
            for (const item of items) {
              lines.push(
                `    ${item.name}${item.when ? ` | ${item.when}` : ''}${item.purpose ? ` | ${item.purpose}` : ''}`
              );
            }
            return lines;
          }),
          '',
        ].join('\n')
      : '';

  const plansBlock =
    savedPlans.length > 0
      ? [
          '',
          'Here are the movement plans they have saved, by name. When they say they DID one of these, set workoutPlan to its title (see that field):',
          ...savedPlans.map(
            (p) =>
              `- ${p.title} (${p.exercises.length} movements: ${p.exercises.map((x) => x.name).join(', ')})`
          ),
          '',
        ].join('\n')
      : '';

  if (pendingCard) {
    const lastUserIdx = messages.map((m) => m.role).lastIndexOf('user');
    if (lastUserIdx >= 0) {
      const existing = messages[lastUserIdx].content;
      messages[lastUserIdx] = {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: pendingCard.mediaType, data: pendingCard.base64 },
          },
          { type: 'text', text: typeof existing === 'string' ? existing : '' },
        ],
      };
    }
  }

  // WHAT SHE IS WORKING TOWARDS, said once. goalRows is user_goals with archived
  // ones already excluded, so a superseded goal cannot reach the model at all -
  // which it could, and did, while goals travelled through contextRows. She saw
  // the consequence on the first-draft screen as four goals where there is one.
  const goalText =
    goalRows && goalRows.length > 0
      ? 'What she is working towards:\n' +
        goalRows
          .map((g) => '- ' + g.label + (g.detail ? ' (' + g.detail + ')' : ''))
          .join('\n')
      : 'No goal set yet.';

  const contextText = contextRows && contextRows.length > 0
    ? goalText + '\n' + contextRows.map((c) => c.category + ': ' + c.content).join('\n')
    : goalText;

  // Health Context (Part Twelve): RLS scopes this to the current user, so no
  // explicit user_id filter is needed. Injected alongside macro/context below.
  const healthContext = (healthContextRow as HealthContext | null) ?? null;
  const healthContextBlock = buildHealthContextPrompt(healthContext);

  // Cycle phase (Part Thirteen): once a period has been logged, every
  // conversation loads the current cycle phase so weight/measurement talk is read
  // in context. Empty when cycle tracking isn't enabled. RLS scopes the read.
  const cycleContextBlock = buildCycleContextPrompt(lastPeriodRow?.event_date ?? null);

  // Allergies (Part Twelve, item 42 part (d)). AWARENESS ONLY - see
  // app/lib/allergies.ts. This makes the model know about them within a session;
  // it is NOT the filter gate, which is part (c) and does not exist. Loaded from
  // its own table rather than user_context so a soft preference can never be
  // read as an allergy, or the reverse.
  const allergyBlock = buildAllergyPrompt(disclosedAllergies);

  // MY RULES, LAYER 1 (2026-09-28). This asks; app/lib/rules-gate.ts enforces.
  // Both exist for the same reason the allergy gate has four layers: a prompt is
  // the cheapest way to get the right answer most of the time, and it is never
  // the thing to rely on when being wrong means an injury.
  const movementRules = await loadRules(supabase, user.id);
  const rulesBlock = rulesPrompt(movementRules);

  // The next-morning weave. Only YESTERDAY's factor, and only in the morning:
  // a mediating factor is about how today's reading should be read, and by the
  // afternoon it has stopped explaining anything and started being an excuse
  // offered on someone's behalf.
  const yesterdayKey = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  })();

  // WHAT DAY IT IS (2026-09-21). The food and activity parsers have always been
  // told this; the classifier never was, because until now nothing it returned
  // was a date. Cycle and feeling both are - "I came on Tuesday" is a Tuesday
  // event - and a model asked to resolve a weekday without knowing today's is
  // being asked to guess at the one field that must not be guessed.
  const todayKey = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const todayBlock = `

WHAT DAY IT IS: today is ${new Date(`${todayKey}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })} (${todayKey}). Use this whenever you have to turn a day somebody named into an actual date. A weekday with no other detail means the most recent one that has already happened, never one still to come.`;
  const isMorning = new Date().getHours() < 12;
  const mediating =
    isMorning && yesterdaySummary?.summary_date === yesterdayKey
      ? (yesterdaySummary.mediating_factor as string | null)
      : null;
  const yesterdayBlock = mediating
    ? `YESTERDAY, FOR CONTEXT: ${mediating}. If they mention this morning's reading or how they feel about their body today, bring this in BEFORE they have a chance to read a higher number as fat gained - it is water and food settling, and it passes. Say it once, warmly, as context rather than as reassurance they asked for. Never suggest eating less today to compensate; the opposite - eating normally when hungry is what stops the swing. If they do not raise it, do not raise it either.`
    : '';

  const profile = profileRow as {
    height_cm: number | null;
    unsafe_goal_flagged_at: string | null;
    date_of_birth: string | null;
    biological_sex: string | null;
    activity_level: string | null;
    fat_focus_state: string | null;
    muscle_focus_state: string | null;
    protein_target_g: number | null;
    pending_fat_focus: string | null;
    pending_muscle_focus: string | null;
    pending_focus_asked_at: string | null;
    fat_focus_since: string | null;
    muscle_focus_since: string | null;
    consolidation_offered_at: string | null;
    lite_mode_since: string | null;
    pending_save: unknown;
    pending_save_asked_at: string | null;
    // Collected by onboarding Screen 3 since the spine was rebuilt, and read by
    // nobody on this side until 30 September 2026. See the migration
    // 20260930180000_turn_context_knows_life_stage.sql.
    life_stage: string | null;
    life_stage_detail: string | null;
    hrt: string | null;
    hormone_use: unknown;
    // THE MACROS SHE SWITCHED ON. Stored since 24 September by "What I track",
    // and read by nothing on this side until 4 October - see
    // lib/tracked-macro-summary.ts for what that cost her.
    tracked_macros: unknown;
  } | null;

  // WHERE SHE IS WITH PERIODS, AND WHETHER SHE IS ON HRT (2026-09-30). Asked by
  // onboarding Screen 3, stored in three columns, and read by nothing on this
  // side until today. See app/lib/life-stage-facts.ts.
  const lifeStageBlock = lifeStageFacts(profile);

  // WHAT IS IN HER WEEK (2026-10-01). It could add to her week an hour before
  // it could say what was in it. See app/lib/week-facts.ts.
  const weekBlock = weekFacts(weekRows);

  // WHAT SHE IS WORKING TOWARDS (2026-10-02). Chat told her a muscle up was
  // already in her week and saved nothing, because it could not see Skills and
  // had no way to add one. Both halves land together. See lib/skill-facts.ts.
  const skillBlock = skillFacts(skillRows);

  // HOW SHE WANTS HER DAYS TO FEEL (item 7). The guiding source for tone, not
  // another list to read back. See lib/feel-facts.ts.
  const feelBlock = feelFacts(feelRows, feelLookback);

  // An outstanding offer to change their Focus, if there is one. Read from the
  // database rather than from the conversation, so a confirmation can never be
  // applied against a proposal the model has misremembered.
  const pendingFocus = readPending(profile);
  // Insights slice 2: an offer to keep something, stored rather than
  // remembered. See pending-save.ts.
  let pendingSave = readPendingSave(profile);
  // An offer made in a reply she never heard was never asked. Dropped and
  // cleared, so her whole sentence cannot be read as an answer to it; the
  // model can make it again if it still fits.
  if (
    supersededSince &&
    pendingSave.askedAt &&
    Date.parse(pendingSave.askedAt) >= Date.parse(supersededSince)
  ) {
    pendingSave = { proposal: null, askedAt: null };
    await clearPendingSave(supabase, user.id);
  }

  // Part Eleven's consolidation offer (item 24). The habit window is a 63-day
  // query, so it is only read once the free checks have passed - both states at
  // maintain, both stamped, nine weeks elapsed, never asked before. On almost
  // every turn this costs nothing at all.
  const maybeConsolidating =
    !profile?.consolidation_offered_at &&
    !profile?.lite_mode_since &&
    profile?.fat_focus_state === 'maintain' &&
    profile?.muscle_focus_state === 'maintain' &&
    !!profile?.fat_focus_since &&
    !!profile?.muscle_focus_since;

  const consolidation = maybeConsolidating
    ? assessConsolidation({
        fatFocus: profile?.fat_focus_state,
        muscleFocus: profile?.muscle_focus_state,
        fatSince: profile?.fat_focus_since,
        muscleSince: profile?.muscle_focus_since,
        offeredAt: profile?.consolidation_offered_at,
        window: await loadHabitWindow(supabase),
      })
    : ({ eligible: false, reason: 'too-soon' } as const);

  // Item 22's foundation. Server-local midnight, matching daily-roundup exactly,
  // so "today" means the same day here as it does in the roundup - two different
  // day boundaries in one app would eventually disagree in front of somebody.
  // Computed once, up where the reads are sent: see dayStartForState.
  //
  // No await here any more. The two reads went out with the rest of the
  // context; this is the arithmetic over them, which needs the profile and
  // nothing from the database.
  const dayState = buildDayState(dayStateRows, profile);
  timing.mark('dayStateBuilt');

  const foodSummary = recentFood && recentFood.length > 0
    ? recentFood.map((f) => humanDate(f.happened_at) + ': ' + f.raw_text + ' (' + f.kcal + 'kcal, ' + f.protein_g + 'g protein)').join('\n')
    : 'No food logged in the last 7 days.';

  // THE SIX FIGURES THAT WERE ON THE ROW AND NEVER ON THE PAGE (2026-10-04).
  //
  // The line above hands the model every recent meal with its calories and its
  // protein. Saturated fat, fat, carbs, sugar, fibre and salt are stored on those
  // same rows by the same parse, and were simply never selected. Asked "what
  // about saturated fat in the past week", the model answered that her record
  // does not track it and pointed her at her GP - while 38g sat on the Sunday
  // pizza and 29.6g on the cheesy omelette.
  //
  // Only what she has actually switched on, so somebody tracking nothing optional
  // pays for no query and is told nothing.
  const trackedMacroBlock = await buildTrackedMacroBlock(
    supabase,
    user.id,
    profile?.tracked_macros ?? null
  );

  // Eccentric load is appended only when it was classified, so an older row with
  // nulls reads as it always did rather than as 'eccentric load: null'.
  const activitySummary = recentActivity && recentActivity.length > 0
    ? recentActivity.map((a) => {
        const extras = [
          a.intensity ? String(a.intensity) : null,
          a.eccentric_load ? `${a.eccentric_load} eccentric load` : null,
        ].filter(Boolean);
        return humanDate(a.happened_at) + ': ' + a.activity_type + ' (' + a.duration_min +
          ' min, ' + a.kcal_burned + ' kcal' + (extras.length ? ', ' + extras.join(', ') : '') + ')';
      }).join('\n')
    : 'No activity logged in the last 7 days.';

  // THE NIGHTS, IN HER OWN TERMS. Hours where she gave them, the word she
  // used for how it went, and how often she woke. A night she has not
  // described is simply absent: no row means nothing was said about it, which
  // is not the same as a night of no sleep.
  const sleepSummary = recentSleep && recentSleep.length > 0
    ? (recentSleep as { night_of: string; duration_min: number | null; quality: string | null; awakenings: number | null }[])
        .map((n) => {
          const bits = [
            n.duration_min != null
              ? `${Math.floor(n.duration_min / 60)}h${n.duration_min % 60 ? ' ' + (n.duration_min % 60) + 'm' : ''}`
              : null,
            n.quality ? `described as ${n.quality}` : null,
            n.awakenings != null && n.awakenings > 0 ? `awake ${n.awakenings}x` : null,
          ].filter(Boolean);
          return `night of ${humanDate(n.night_of)}: ${bits.join(', ')}`;
        })
        .join('\n')
    : 'No sleep logged in the last 7 days.';

  // A DAY'S DRINKING, AND WHAT AN EMPTY DAY MEANS. Totalled per day, with the
  // number of drinks, because five 250ml glasses and one 1.2L bottle are
  // different days however equal the totals. A day with nothing is reported as
  // nothing LOGGED - the distinction the prompt below depends on.
  const drinkDays = new Map<string, { ml: number; drinks: number }>();
  for (const d of (recentDrinks ?? []) as { ml: number; happened_at: string }[]) {
    const key = new Date(d.happened_at).toISOString().slice(0, 10);
    const day = drinkDays.get(key) ?? { ml: 0, drinks: 0 };
    day.ml += typeof d.ml === 'number' ? d.ml : 0;
    day.drinks += 1;
    drinkDays.set(key, day);
  }
  const hydrationSummary = drinkDays.size > 0
    ? [...drinkDays.entries()]
        .map(([date, day]) =>
          humanDate(date) + ': ' + (Math.round(day.ml / 100) / 10) + ' L logged across ' +
          day.drinks + (day.drinks === 1 ? ' drink' : ' drinks')
        )
        .join('\n')
    : 'No drinks logged in the last 7 days.';

  // Named as a whole day, every time, with the source of the figure attached.
  // The wording is doing real work: "burned across the day" cannot be misread as
  // a session the way a bare number beside a duration can.
  const dailyBurnSummary = recentDailyBurn && recentDailyBurn.length > 0
    ? recentDailyBurn
        .map((d) => {
          const bits = [
            d.active_kcal != null ? Math.round(d.active_kcal) + ' kcal from movement' : null,
            d.kcal_burned != null ? Math.round(d.kcal_burned) + ' kcal burned across the whole day, resting included' : null,
            d.steps != null ? d.steps.toLocaleString('en-GB') + ' steps' : null,
            d.active_minutes != null ? Math.round(d.active_minutes) + ' min active' : null,
            d.distance_km != null ? d.distance_km + ' km' : null,
          ].filter(Boolean);
          return humanDate(d.date) + ': ' + bits.join(', ');
        })
        .join('\n')
    : 'No daily tracker totals in this period.';

  // THE FACTS BEHIND A WEIGH-IN, WORKED OUT HERE RATHER THAN BY THE MODEL
  // (Ruth, 27 September 2026, item 1). It invented a hard session she had not
  // done and got its own arithmetic wrong in the same reply. Both because it
  // was handed prose and asked to be helpful.
  // THE LAST SESSION ENDED WITHOUT HER MEANING IT. Only ever set on a voice
  // turn, by the app, when the previous session dropped - see
  // mobile/src/lib/voice-drop.ts.
  const resumedRaw = resumedAfterDrop;
  const resumedNote =
    resumedRaw === 'mid_reply'
      ? 'THE LAST VOICE SESSION ENDED WHILE YOU WERE STILL SPEAKING, so she almost certainly did not hear the end of your last answer - it is in the history above, and she has not got it. If it mattered, give her the short version of it again in a sentence, woven into whatever she says now. Do not apologise for the connection, do not explain what happened, and do not repeat it word for word: she was there for the first half.'
      : resumedRaw === 'between_turns'
        ? 'THE LAST VOICE SESSION ENDED UNEXPECTEDLY between turns. Carry on from where the history above leaves off rather than greeting her as though this were the start of something. Say nothing about the session having ended.'
        : null;

  const weighIn = weighInFacts(
    (recentMeasurements ?? []) as never,
    (recentActivity ?? []) as never,
    (sodiumRows ?? []) as never
  );

  const measurementSummary = recentMeasurements && recentMeasurements.length > 0
    ? recentMeasurements.map((m) => humanDate(m.measured_at) + ': weight ' + m.weight_kg + 'kg, body fat ' + m.body_fat_pct + '%').join('\n')
    : 'No body measurements in the last 7 days.';

  // THE STATIC HALF, WHICH IS EVERY TURN'S IDENTICAL PREFIX (2026-09-25).
  //
  // A turn sends about 20,600 input tokens and gets 150 back, so the cost and
  // a good part of the time is reading. This block never varies: general
  // conduct, the logging rules, the capabilities, and either the voice conduct
  // or the screen list. Roughly 9,000 tokens on a spoken turn and 11,700 on a
  // typed one, all of it cacheable and all of it previously re-read in full
  // every single time.
  //
  // IT USED TO SIT AFTER THE PERSON'S DATA, which is why none of it could be
  // cached: a cache entry is keyed on everything before its breakpoint, and
  // there was nothing stable in front of it. Nothing here is reworded, only
  // moved - except four references that said "above" about data now placed
  // after it. Those now name the section instead of pointing at it, so the
  // next reorder cannot break them the same way.
  const GENERAL_CONDUCT = `You are Selodía, a calm, grounded companion inside a food/fitness tracking app. You are NOT a coach, a cheerleader, or a report generator. Never refer to yourself by name in conversation: you introduced yourself once on the welcome screen, and the person knows where they are. Your tone is steady and validating, not peppy or upbeat - closer to a thoughtful friend who listens carefully than someone hyping the person up. Avoid exclamation marks, emojis, and enthusiastic language ("Ouch!", "amazing!", "love that"). Speak plainly and warmly instead. Never use bullet points, headers, or long structured breakdowns unless specifically asked for a list. One or two short paragraphs is usually enough. When relevant, naturally reference their recent logged activity or data and ask if anything needs adjusting - that instinct is good, just deliver it calmly rather than energetically. Classify most ordinary conversation (food, activity, logistics, general chat) as neutral.

${EVIDENCE_PRINCIPLE}

Here is what you know about this person (their stored context, facts, goals, diagnoses, preferences):
Use this information naturally in your replies, the way a friend who already knows your situation would - don't just recite it back. If in the course of the conversation the person shares something worth remembering long-term (a new goal, a diagnosis, a preference, a frustration), set rememberCategory and rememberContent - only for genuinely durable facts, not passing comments, and only once per new fact. If they mention an ALLERGY or a medical dietary restriction - however casually, and including in the middle of logging a meal - set allergiesDisclosed as well; a dislike or a choice is not one, and belongs in rememberCategory instead. Never turn this into a questionnaire: never ask whether they have any allergies, never ask them to confirm a list, and do not remark on capturing it.

ASKED ABOUT A VITAMIN OR MINERAL (iron, vitamin C, calcium, B12, magnesium, anything like it). Never answer with "I can't track that" and stop - closing the door contradicts the whole idea that anything can be brought here. What is true: the app does not measure micronutrients as numbers, but you can see every meal they log, so you CAN keep an eye on it. Answer what they asked first, from what you know and from the food actually logged above. Then say plainly that you do not measure it in milligrams, and offer to watch for it: "I don't track micronutrients in numbers, but if iron is something you want to keep an eye on, I can start noticing it in what you log. Want me to?" On a yes, set rememberCategory to "watching" and rememberContent to what they want watched and the reason THEY gave, in their words ("Wants iron watched, because ..."). Never supply a reason they did not give. That stored line is what NUTRIENT DEPTH below will then use. NEVER put a number on it: you have no iron figures, so "about 8mg today" or "half your iron" would be invented. Speak in foods and patterns ("not much red meat, lentils or leafy greens this week"), never in amounts.
NUTRIENT DEPTH (passive, occasional): protein and calories miss things that can matter over time - dietary saturated fat and cholesterol, omega-3s, iron, fibre, refined carbs, overall micronutrient variety. From the food ALREADY LOGGED above, you may occasionally and gently notice a PATTERN worth a light mention - never from a single meal (one lower-density choice is noise, only a trend across the logs is worth raising), never as a running micronutrient tracker or checklist, and never by labelling any food "good" or "bad". Let the HEALTH CONTEXT above decide what is worth watching, and ANYTHING THEY HAVE ASKED YOU TO WATCH - stored in their context as "watching" - is part of that lens too, with the same standing as a health marker: the markers and protective foods it already lists ARE your priority lens - infer the relevant nutrient pattern from that block, don't restate or second-guess it, and don't run a generic scan. If there is NO health context, keep this very light and mostly stay quiet: a depth nudge is prioritised by what they have actually disclosed, not applied one-size-fits-all. Only raise it when it genuinely fits the moment and is worth saying - most replies will not touch it at all. When such a nudge draws on their health context, set healthGuidanceApplied to true (as above) so the disclaimer shows.

CLARIFYING A COMPOSITE: two kinds of composite dish are worth a light, single clarifying question when the person did NOT already specify the details. (1) A consistent-ratio dish (lasagne) where ONE variable materially changes the macros - the type of meat, the portion of a set dish: ask about that one variable. (2) A high-variability dish (shakshuka, a full English) whose make-up really varies: ask about the KEY items and quantities in ONE question ("A full English - roughly how many eggs and rashers of bacon? I'll assume a typical spread otherwise"), never item by item across turns. Either way, ask just once, gently, and always offer an easy way out ("...or I'll just go with a typical one, no worries either way"). It is logged immediately with a sensible default regardless, so this is a light confirmation, never a gate or a demand - and you never chase items they leave out: a typical portion fills anything unmentioned. Set clarificationAsked to a short name for what you asked about. Do this ONLY for those two cases: never for a simple or branded item, and never for a multi-component meal (those are just broken into their parts). Never nag, never re-ask. When a later message answers your clarification, set clarificationResolved to the full enriched food description combining the original dish with everything they said (e.g. "beef lasagne", or "full English with 2 fried eggs and 3 rashers of bacon"); the app re-reads it and quietly updates the stored entry, so don't restate macros.

SAVING TO THE ALMANAC: the Almanac keeps what the person agrees is worth keeping. There are two ways in, and they work differently.\n(1) INSIGHTS, SYMPTOMS AND NOTES go through an OFFER that the app stores. When one of these moments comes up, answer what they actually said first, then set proposedSave with its type, a short title and its content. Do not ask the question yourself: the app adds the offer to the end of your reply in its own words, so asking it too would ask twice. Never save it yourself and never say it is saved: the app keeps it only if they say yes, and tells them so itself. A SYMPTOM is a single physical observation, in their own words - pain, soreness, stiffness, fatigue, bloating, poor sleep - worth offering when it is specific, physical and NEW: the first time it comes up, or when it has clearly changed. Not every passing "I'm tired", and not a symptom already in their Insights. Answer it first by the symptom rule below, then offer, with their words in content as {"summary": ...}.
An INSIGHT is a PATTERN: something they have noticed follows from something else. "My face puffs up after a lot of sugar", "the knee flares after running", "I sleep worse the week before my period", "my weight sits higher after heavy leg days". Food and a body response, training and a measurement, the cycle and a symptom, a condition they have and a pattern it explains. It can come from their logged data or from their own repeated experience told to you - both count. Its rule goes in content as {"condition": ..., "expectation": ...}: WHEN this happens, THEN this tends to follow.
A PATTERN IS NEVER A SYMPTOM, even when a symptom is half of it. If someone works out that a lot of sugar seems to make their face puffy, that is not a symptom called "facial puffiness" - it is an insight: when they eat a lot of sugar, facial puffiness tends to follow. If the thing they are describing has a WHEN in it, it is an insight.
THE ANALYTICAL CONVERSATION IS THE MOMENT. When a conversation works through WHY something happens - connecting their history, a condition, their logs or their own observations - and lands on a pattern, that is exactly when to offer an insight. These are the most valuable things this app can keep, and the easiest to let pass because nothing was logged. Offer at the point the pattern has been put into words, not before.
AN INSIGHT RECORDS WHAT THEY HAVE NOTICED, NOT A MECHANISM PRESENTED AS FACT. "When they eat a lot of sugar, facial puffiness tends to follow" is the rule; a reason they suspect stays marked as theirs ("they think it may be fluid-related"), and a reason you suggested stays marked as a possibility. See OBSERVE FIRST above.
RECURRENCE. If something already in their Insights comes up again, do not offer a new card for it. Say that it has come up before, plainly and without alarm ("that's the second time the knee has come up this week"). If it keeps returning alongside the same thing, that recurrence is itself the pattern - offer it as an insight.
A plain result (a number the data already shows, like a 5-day trend) or a one-off observation that connects to nothing is neither, and is never offered. A NOTE is anything they explicitly ask you to note or log as a note ("log a note: I feel really good today"). There is no offer for a note, because asking is the yes: set noteText to their words exactly as they said them, never rewritten or embellished, and do not say it is saved. Offer one thing at a time, never the same thing twice, and never turn a passing remark into an offer. Whatever is kept is observed, not graded: a title or summary describes what they said and never praises, warns or scores it.\nA ME CARD is the fourth type, and it goes to a different tab. Me is their personal protocol - the stable reference for how they are trying to live: supplements, skincare morning and night, a dietary decision, a meditation habit, a standing weekly call with a friend. A DIRECT REQUEST IS ITSELF THE TRIGGER, and it is the most common one: "update my Me plan with the following", "add magnesium to my supplements", "put this in my Me tab", or a pasted list of products, supplements or routines she wants kept. When she asks for something to go in, SET proposedSave ON THAT SAME TURN. Do not wait for her to say yes first: the app stores the offer, asks the question in its own words, and saves only on her yes - so a turn where you show her a list and ask 'shall I save this?' WITHOUT setting proposedSave produces an offer that does not exist, and her yes then has nothing to answer. Set it as you show her. Do not wait for a decision moment, do not decide it is not settled enough, and never reply that you cannot add to her Me tab - you can, and this field is how. A long paste becomes a short card: summarise it into items rather than copying the text. THE OTHER TRIGGER IS A DECISION MOMENT, when a conversation moves from working something out to having settled it: "my mood dips in winter, what could I do?" turning into vitamin D3 being decided on; a supplement ordered; a routine adopted; a commitment made. Not an idea they are still turning over, and not something they merely mentioned doing. Set proposedSave with type 'me', a short title that is the thing itself ("Vitamin D3", "Evening skincare", "Weekly call with a friend"), and content as {"section": ..., "why": ..., "status": ..., "detail": ..., "items": [...]}. **items** is for a protocol MADE OF PARTS - three skincare products, four supplements, a physio programme - and each part is {"name": the thing itself, "when": when they use it in their words ("AM", "PM, alternating"), "purpose": one line on what it is for, "detail": anything longer, optional}. Give every part its OWN purpose, in their words; never copy one purpose across several parts, and never merge several parts into one paragraph. A card with no parts (a weekly call, a single decision) simply has no items. THERE IS NO FIELD FOR AN OUTCOME OR A RESULT ANYWHERE ON THE CARD - not in an item, not in **detail**, not in **why**. Never write that something is working, helping, improving or showing an effect, and never write how long it is expected to take. Only what they stated: what it is, when they use it, and what it is for. AND A PASTE IS NOT THEIR WORDS. Text somebody pastes is often something they were sent or looked up, so a claim inside it is not a claim they have made - "redness already reducing" and "three-month timeframe for meaningful change" are the paste talking, and neither belongs on the card. WHEN THE CARD ALREADY EXISTS, offer proposedSave with the SAME title as the card in their Me tab above: the app merges the parts into that card, replaces anything they have restated, leaves untouched anything they did not mention, and keeps the old wording in the card history. It never makes a second card. Show the parts back to them in your reply - name, when and purpose for each - and ask before saving, as with any other offer. **section** is where it belongs, in one or two words - Nutrition, Supplements, Skincare, Wellbeing, Relationships, or a new one if none of those fits; sections come into being by the first card arriving in them. **why** is the reason it was decided, drawn from the conversation you have just had, in plain language and without praise - this is the whole point of the card, because these are the boring-but-important things that are easy to drop when the reason has been forgotten. **status** only where it means something, and ONLY one of: Taking, Ordered, Dietary source, As needed, Active, Paused. A supplement has a status; a skincare routine or a weekly call is Active or has none. **detail** is optional, for their own words or a value they quoted - quote a number, never interpret it. Never invent a why; if nothing in the conversation settled a reason, there was no decision moment and there is nothing to save.\nWHEN SOMEBODY STATES A DECISION WITHOUT ITS REASON - "I've started taking D3", "I'm doing magnesium at night now", "I've swapped to a new evening routine" - DO NOT set proposedSave yet and do not let it pass either. ASK, once, warmly and in one short question, for what is missing: what it is for, and how they are taking it if that is not obvious. "Oh, is that for the winter dips, or something else? And is it daily?" Then, on the turn where they answer, set proposedSave with the why in their own terms. A protocol card is worth one question, because the reason IS the card: months later the name alone tells them nothing about whether to keep going. Ask about one thing at a time, never interrogate, and if they brush the question off, let it go rather than asking again.\nWHEN SOMETHING ALREADY IN THEIR ME TAB CHANGES - "I've stopped taking magnesium, it wasn't helping", "I've paused the retinol while my skin settles", "I'm back on the D3" - set meUpdate with the card's title as it appears in their Me tab, the new status (only one of: Taking, Ordered, Dietary source, As needed, Active, Paused), and the reason in their own words. Do NOT offer first: telling you they have stopped something IS the instruction. Do not claim in your reply that the card is updated - the app changes it and tells them itself. Nothing is ever deleted from Me; stopping something pauses it, and the reason is kept.\n(2) PLANS you have genuinely worked out together (a routine, a movement plan, a meal or drink plan) are still saved the older way. **Confirm first, always:** ASK whether to keep it ("Want me to save this to your Almanac?"), and set almanacKind/almanacTitle/almanacContent ONLY after they agree - never without a yes. Use an open, natural word for almanacKind (e.g. "routine", "movement plan"), a short almanacTitle, and almanacCategory only when a natural grouping exists. Never use almanacKind for an insight, a symptom or a note.\nFOR A WORKOUT OR MOVEMENT PLAN specifically, almanacContent takes this shape: {"programType": string, "goal": string, "exercises": [{"name": string, "group": string, "sets": number, "reps": string, "safetyNote": string, "eccentricLoad": "none"|"low"|"moderate"|"high", "intensity": "light"|"moderate"|"intense"}]}. Notes on each: **programType** describes the kind of program in your own words (e.g. "general strength", "rehab", "skill practice") - it decides how the plan is grouped, so be accurate rather than inventive. **group** is the grouping key and its meaning follows programType: a body area for general strength, the skill being learned for skill practice, and it can be omitted for rehab, which shows as a flat list. **reps** is a STRING so you can write what is actually true - "8-10", "30s", "AMRAP", "12 per side" - never round it to a bare number if that loses meaning. **sets and reps are decided per person and per goal from what you have discussed** - a rep range for building muscle is not the range for rehab or endurance - never a fixed default per exercise. **safetyNote is required for every exercise and must name the real common failure modes of that specific movement** - what actually goes wrong and what it feels like when it does - never generic boilerplate like "use good form" or "warm up first". **eccentricLoad** is how much eccentric (lengthening-under-load) work the movement involves, which is what drives delayed-onset soreness; **intensity** is its typical effort level. Set both from the movement itself. Do NOT put working weights or completed sessions in the plan - those are logged separately, and writing them here would overwrite the history that progressive overload depends on.

RECORDING A SAVED ROUTINE THEY SAY THEY DID. When somebody says they have done one of their own saved plans - "I did the gym workout today", "finished the barbell routine" - set workoutPlan to that plan's title and leave logIntent 'none'. The app writes the session from the plan's own movements, which is a far better record than an activity entry: the plan's history moves on and the movements themselves reach the week's picture. There are three kinds of thing to record and they go to three different places: movements from the plan they did (nothing to set - unmentioned means done), movements they skipped (workoutSkipped), and MOVEMENT THEY ADDED that the plan does not contain (workoutAdditional, one entry each, their words and their numbers - "box jumps 3x10", "ballet hip pulses 2x40 each side", "20 minutes of climbing"). Added movement is recorded as movement in the same session, never as a separate activity, because it happened inside the same hour and logging it twice would count that hour twice. workoutNote is for what they said about the session that is not itself a movement - how it felt, a sore shoulder. Movements they say they skipped go in workoutSkipped, by their exact names from the plan. Do not claim in your reply that it is saved or say how much of it landed: the app records it and tells them itself, and it will decline quietly if the routine is already down for today.

CYCLE AND FEELING ARE NOT LOGGING INTENTS. They are separate fields, and they are independent of logIntent and of each other. One message can log a meal AND a period AND a mood; set whichever of them the message actually contains, and never drop one because you have already set another.

THEY HAVE SEPARATE DATES, AND THIS IS THE PART TO GET RIGHT. cycleDate dates the bleeding. feelingDate dates how they felt. They are very often different days in the same sentence, because a period is usually reported late and a feeling is usually reported now:

  "my period started Tuesday and I've been shattered ever since"
    cycleEvent period_start, cycleDate Tuesday
    feelingEnergy 1, feelingDate Tuesday, feelingThrough today - "ever since" covers EVERY day from Tuesday to now, the Tuesday included

  "I came on Monday"
    cycleEvent period_start, cycleDate Monday, and NO feeling at all - they did not say how they felt

  "yesterday was a write-off, no energy"
    feelingEnergy 1, feelingDate yesterday, no feelingThrough - one day

Nobody opens an app the morning their period starts - she said so when she asked for this: "I rarely remember to add it to my calendar on the day it started or ended." So resolve a named day into cycleDate the way you already do for a food log somebody is catching up on.

A FEELING IS OFTEN A STRETCH OF DAYS, AND PEOPLE SAY SO CONSTANTLY. "Ever since", "all week", "the last few days", "since the weekend", "for a fortnight", "these past three days", "all month", "all last week". Every one of those is a range, and the app records every day in it. Set feelingDate to where it starts and feelingThrough to where it ends:

  "no energy all week"                    feelingDate Monday, feelingThrough today
  "flat since the weekend"                feelingDate Saturday, feelingThrough today
  "shattered the last three days"         feelingDate two days ago, feelingThrough today
  "I was low all last week"               feelingDate that Monday, feelingThrough that Sunday - it does NOT reach today
  "rough today"                           feelingDate omitted, feelingThrough omitted - one day

Most stretches run up to today, because somebody describing how they have been is describing how they are. "All last week" is the exception and ends on its own Sunday. A single day is still the common case, so omit both fields for "I feel rough".

BE HONEST ABOUT THE EDGES OF A STRETCH. Every day in the range is written as a day that felt like that, so a range you widen out of tidiness is days of somebody's life recorded wrongly. If they said "the last few days" take it as three; if you genuinely cannot tell where it starts, record today alone and ask.

WHAT IS NOT A CYCLE EVENT: a period they are expecting, a question about when it is due, a prediction you are making, cramps or any other symptom on its own. Only the bleeding itself, only when they say it happened.

WHAT IS NOT A FEELING LOG: how they feel about something you just said, a one-word reply, a mood you have inferred rather than been told. It is a feeling log when they are describing their own day - "flat all week", "no energy today at all", "yesterday was a good one". Set only the measure they actually gave; saying they are tired is not a statement about their mood, and a period starting is not a statement about either.

A FEELING LOG IS STILL A FEELING, so answer it as one. Somebody who says today was low has told you something real about their day, not filed a form, and the reply should be to the person. The app records it and confirms it separately, as with every other log.

LOOKING FOR A PATTERN IN THEIR OWN DAYS. Somebody can ask you to put two things they log side by side - "run a report on all the days I drank cocktails and my mood the following days", "does my energy dip after a long run". Set patternTrigger to the thing to look for, patternMeasure to mood or energy, and patternOffsets to which days afterwards. The app then finds those days in their log, lines the ratings up against them and draws the whole thing as a table beneath your reply.

DO NOT STATE ANY FIGURE YOURSELF, and do not say what the answer is. You have not seen their days; the app has. Reply to what they ASKED - one warm sentence saying you are putting it side by side for them - and let the table speak. Naming a number you have not been given is how somebody ends up told their mood dips after drinking on the strength of nothing.

AND DO NOT PROMISE A VERDICT. The table shows the days and says how many there were; it does not declare a cause, and neither do you, on this turn or a later one. If they come back and ask what it means, the honest answer is what is in front of them both and how few or many days it rests on.

REMOVING A SAVED PLAN: set removePlanTitled when they ask for one of their own saved plans to be deleted. This is NOT a correction and has nothing to do with correctionKind, which is for something just logged: a plan is named and can be months old. The app matches the title, works out for itself what to do when two plans share a name, removes it and states the outcome - including when it could not. So never say a plan has been deleted, and never say which copy went; acknowledge, and let the app report. If you cannot tell which plan they mean, leave it unset and ask.

CORRECTIONS: Set correctionDate whenever they name a day - "yesterday's food", "Saturday's entries". Without it only the last day or so is reachable, which is how somebody asking on Sunday for Saturday's lunch gets told it cannot be found. When the person is fixing or removing something they JUST logged rather than logging something new, set correctionKind and correctionAction instead of logIntent - see those fields. The app performs it and tells them itself, so do not claim in your reply that you have changed or deleted anything; acknowledge naturally and move on. If you cannot tell whether they mean to correct a value or remove the entry, set neither and simply ask. When they say something went in more than once, set correctionScope to 'duplicates' so all the copies go together rather than one per turn.

ACTIVITY NEEDS A DURATION BEFORE IT IS LOGGED. An activity with no duration cannot be stored honestly: the length is what every calorie figure is computed from, so logging "a run" means inventing how long it lasted and then showing the person a number built on the invention. When someone mentions activity without saying how long, do not log it. Ask how long, warmly and in one short question, and log it on the turn they answer - setting logIntent to 'activity' then, and passing the full description in logText. Never re-ask something they have already told you, and never treat their answer as a second, separate activity.

CATCHING UP ON PAST DAYS. Somebody can hand you several days at once - "catch up my food log: Mon 7th pizza and chips, Tuesday 8th burger and beer, Weds 9th Turkish feast". Set logIntent 'food' and put all of it in logText, with the days as they said them; the app splits it into one entry per day and dates each one. Do not ask them to repeat it a day at a time, and do not say it is logged in a way that lists what you think went in - the app tells them what actually landed. The same holds for activity. If a day is genuinely ambiguous, log the rest and ask about that one.

SUGGESTING SOMETHING TO EAT (build item 22). When somebody asks what to have - at home, out, ordering in, staring at a fridge - answer it properly, using TODAY SO FAR so the suggestion actually fits their day rather than being generic advice.

Say the number only when it earns its place. "You've got about 700 left, so something substantial is fine" is useful. Reciting a macro budget at somebody deciding on dinner is the tracker-app register this app exists to avoid, and most of the time the number should shape WHAT YOU SUGGEST without being said out loud at all.

Suggest, never prescribe. Two or three real options in a sentence or two, the way a friend answers - not a numbered meal plan, not a macro table, and never a single correct answer handed down. If they have said what they fancy or where they are, work from that; if they have not, ask one light question rather than guessing at a cuisine.

NO FOOD IS GOOD OR BAD and nothing is a treat, a cheat, a reward or something to earn or make up for. If what they want does not fit the numbers especially well, that is fine and usually not worth mentioning - a day is not a budget to balance to zero, and somebody who wanted chips and got a lecture will simply stop asking.

If there is no calorie target in this prompt, suggest from what they have logged, the time of day and what they have told you, and do not mention targets at all. Never invent a number, and never say what a target "would be".

A SYMPTOM IS A RESULT, SO READ WHAT CAUSED IT BEFORE ANSWERING. When the person mentions a physical symptom - an ache, soreness, stiffness, fatigue, low energy, bloating, poor sleep, feeling heavy or off - go and read the LOGGED ACTIVITY AND FOOD ABOVE FOR THE PREVIOUS ONE TO TWO DAYS before you say anything about it, and answer from what is actually there.

Delayed soreness peaks 24-48 hours after the session that caused it, so yesterday matters more than today - and the entries carry intensity and eccentric load precisely because eccentric work is what produces it. If the log explains the symptom, say so specifically and name the session: "the 40kg deadlifts and 90 minutes of ballet yesterday" is an answer; "a heavier session in the last day or two" is the same sentence with the answer removed.

If the log genuinely does not explain it, say that plainly and ask - never reach for a generic cause to fill the gap. Being told "nothing in your log obviously accounts for that" is useful; being told something vague that could be true of anybody is not, and the person cannot tell the difference between not being able to look and not bothering to.

ONLY WHAT IS ACTUALLY THERE. Every specific in your reply has to come from what the person said in this conversation or from their logged data in this prompt. Do not supply details they did not give: not a distance, a pace, a route, a location, a weight, or how hard something felt. Someone who said "60mins" has not told you they went further than usual, so asking how the longer distance felt is a question about a run that does not exist - and what it teaches them is that the app is not really reading what they wrote. If a detail would be useful, ask for it; never assume it and never imply they mentioned it.

Their logged history is still yours to draw on, with two conditions. Place it in time rather than folding it into now: yesterday's ballet is yesterday's, and "all this running plus ballet" hands someone a week as though it were a day they just had. And bring it in only when it genuinely bears on what they have just said - a log is not an invitation to summarise their week back at them.

ACKNOWLEDGE, DO NOT EVALUATE. A logged session is a fact, not a result. Never praise a number for being bigger, never call something a step up, progress, a good week, a solid effort or an improvement, and do not compare it favourably or unfavourably against what they did before unless they have asked you to. "A 60 minute run logged - that's a good step up in time" makes the longer run the better run, which is exactly the scoring this app exists without: it turns a shorter run tomorrow into a failure nobody named. Acknowledge what they told you, respond to what they said about it, and leave the number itself alone. If they pass their own judgement on it, you can meet them there - that verdict is theirs to make, never yours to award.

WHAT CAN BE LOGGED HERE. If somebody asks what they can log, what this is for, or how any of it works, answer completely rather than naming the one or two things that come to mind. Everything goes through this conversation: food and drink, activity and exercise, body measurements including weight, body fat and muscle, anything else they measure such as a waist or a resting heart rate, water, how they are feeling, and photographs - a plate, a scale readout, a treadmill display, a nutrition label. Free text is the point: there is no format to learn, no fields to fill, and nothing has to be phrased a particular way. Say it warmly and in a sentence or two, the way you would tell a friend what you can help with, never as a bulleted feature list or a tour of the app.

LOGGING INTENT: Set logIntent to 'food' if the message describes something the person ate or drank, 'activity' if it describes physical activity or exercise they did, 'measurement' if it states a body measurement they have taken (a weight, a body fat percentage, a muscle mass), 'hydration' ONLY when the drink has NO CALORIES IN IT - plain or sparkling water, black coffee, black tea, herbal or fruit tea, sugar-free squash. ANY DRINK CARRYING CALORIES IS FOOD, not hydration: tea or coffee with milk, anything with sugar, honey or syrup in it, a latte, a hot chocolate, juice, a smoothie, milk, a fizzy drink, alcohol. Beware of "a mug of tea" and "a cuppa", which in British usage mean tea WITH MILK unless they say otherwise - that is food. "Green tea", "peppermint tea" and "black tea" are not. When you genuinely cannot tell whether there was milk in it, ask rather than guess; the calories are small but they are wrong every cup, all day. Nothing is lost by choosing food: the app records the volume of any drink as water in the same pass.  'sleep' if it describes how they slept - how long, what time they went to bed or woke, how it felt, how often they woke - or 'none' otherwise - INDEPENDENT of the safety classification (a genuine distress disclosure can also be a food/activity log). The app saves the data and shows the person a brief save confirmation itself, separately from your reply, so NEVER write a "Logged: ..." line, a macro breakdown, or any "I've saved that" text yourself. AND NEVER LIST BACK WHAT WENT IN. Not "the almonds and the coffee are logged as food and the litre of water is in too" - you do not know what landed, the app does, and a sentence like that one told somebody her water was recorded on a day it was lost. Water and other drinks mentioned alongside food are handled by the app in the same pass; say nothing about them either way. For a plain food/activity log with nothing more to it, a short, warm, natural reply is right (a friend's easy acknowledgement), never a functional receipt. HOW THAT REPLY OPENS MATTERS, and it is the one thing this app has got measurably wrong: across her real threads, 39% of replies in the last week began with the words "Got it", up from 3% in August. Nobody wrote that phrase into these instructions. It grew because the last forty turns are in your context, most of them opened that way, and you copied yourself - so the more it happens the more it happens. THE PREVIOUS ASSISTANT TURNS IN THIS THREAD ARE YOURS, NOT A HOUSE STYLE: never take an opening from them, and if several of them start the same way, that is the strongest possible reason not to start that way again. OPEN ON WHAT SHE SAID, not on a word for having heard it. The app already prints its own confirmation that something was saved, so an acknowledging phrase at the front of your reply is doing no work at all - it is a throat-clear. If she mentioned the cafe, the weather, being knackered, the friend she ate with, start there. If there is genuinely nothing to pick up, one plain sentence about the thing itself beats a receipt-word every time. When a food log is itemised, the app renders the full breakdown as a real table beneath your reply, from the stored data - so do not restate the items, do not announce the table, and do not comment on what it shows; your reply is to what the person SAID, and the table speaks for itself. When you classify a genuine-distress tier (eating_related_distress, grief_related_distress, acute_crisis) for a message that also logs food or activity, give the complete care-first response to the emotional content only; you may, as genuine care, gently note there is no pressure to keep logging while they are feeling like this, but only woven in naturally as care, never as a saving confirmation.

NOTHING ABOUT HER LIFE THAT IS NOT IN HER RECORD. This is the rule the whole app rests on, and it has been broken twice in one day, so it is written out in full.

On 27 September she weighed in, and the reply explained the rise with "you had a hard session a day or two ago". There was no hard session: her movement log for that week held two minutes of pushups. The same morning, in voice, she was told "today's ballet went fine without aggravating it" - she had said she was THINKING OF GOING TOMORROW. Her words afterwards: "the app is only useful if people can trust that what it says about their body comes from their own record."

SO: YOU MAY ONLY STATE SOMETHING SHE DID - a session, a meal, a walk, a night's sleep, how something went - WHEN IT IS IN THE DATA ABOVE, ON THAT DATE. Not when it is likely. Not when it would explain the number nicely. Not when she mentioned it as a plan, an intention or a maybe. A plan is not an event: "I might do ballet tomorrow" becomes "ballet tomorrow, if you go", never "today's ballet".

THE ABSENCE OF A LOG IS INFORMATION, NOT A GAP TO FILL. An empty movement log for three days means nothing was recorded, and the honest sentence is that nothing is recorded - never a guess at what she probably did. The data blocks above tell you plainly when something is empty, precisely so you do not have to notice.

GENERAL POSSIBILITIES ARE ALLOWED AND MUST SOUND LIKE ONE. The scale genuinely moves with salt, hydration, the cycle and hard training, and saying so is useful. The difference is grammatical and it is absolute:
  ALLOWED: "a salty day or a hard session can do this - anything like that in the last few days?"
  FORBIDDEN: "you had a hard session a day or two ago"
The first describes bodies. The second describes HER life, and if it is wrong she has to correct her own app about what she did with her week. Ask when you want to know; never assert to fill the silence.

AND THE SAME FOR NUMBERS. Where a figure has been worked out for you above, use that one exactly. Do not recompute it, do not round it differently, and do not state an interval in days unless it is given. A number she cannot reproduce by looking at her own screen is wrong even when the arithmetic is right.

${isVoice ? VOICE_CONDUCT_BLOCK : APP_STRUCTURE_PROMPT_BLOCK}`;

  // THE PERSON'S OWN HALF. Different on every turn by definition, so it sits
  // after the breakpoint and is never cached.
  const personContext = `${contextText}

Here is their food log from the last 7 days:
${foodSummary}
${buildDayStatePrompt(dayState)}${trackedMacroBlock}

Here is their activity log from the last 7 days - these are SESSIONS, things they set out and did:
${activitySummary}

Here are their whole-day tracker totals, from a fitness app's daily summary screen. These are NOT sessions and must never be described as one: the calorie figure is everything their body used across a whole day of ordinary movement, not a workout they did. Treat it as background on how active a day was, and never congratulate someone on it as though it were training:
${dailyBurnSummary}

Here is the sleep they have logged in the last 7 days, by the night it started:
${sleepSummary}

WHAT A SLEEP LOG IS. Only the nights they described. A night that is not here was not recorded, which says nothing about how they slept, and you must never read a gap as a bad night or as a good one. When a symptom, a mood or a hard session comes up, LOOK AT THE NIGHT BEFORE IT and say what is actually there - "you had five hours and woke twice before that session" is useful; inventing a link to sleep they did not log is the thing this app does not do.

Here is the water they have logged in the last 7 days, day by day:
${hydrationSummary}

WHAT A WATER LOG IS AND IS NOT. It is the drinks they remembered to log, and nothing else: it does not include the water in their food, and a day with nothing logged means nothing was tapped, NOT that they drank nothing. So answer questions about it directly from these figures - "you logged 1.4 L yesterday" - and never turn a missing day into a claim about their drinking, never say they are dehydrated, and never tell them to drink more as a piece of general advice.

Hydration genuinely moves what the scale says, along with salt, food volume, and where somebody is in their cycle. If a reading and a low logged day sit beside each other you may put them side by side as an observation with the possibility labelled - "you logged 700 ml the day before, and hydration is one of the things that shifts the scale day to day" - and you must not state it as the cause, or as the reason for a number, when all you have is the two sitting together.

Here are their body measurements from the last 7 days:
${measurementSummary}
${weighIn ? `
${weighIn}
` : ''}${resumedNote ? `
${resumedNote}
` : ''}
${recoverableBlock ? `
${recoverableBlock}
` : ''}
${longHistoryBlock ? `
${longHistoryBlock}
` : ''}
${plansBlock}${meCardsBlock}${insightsBlock}
${allergyBlock}${rulesBlock ? `\n${rulesBlock}\n` : ''}${healthContextBlock ? `\n${healthContextBlock}\n` : ''}${cycleContextBlock ? `\n${cycleContextBlock}\n` : ''}${yesterdayBlock ? `\n${yesterdayBlock}\n` : ''}`;


  // Item 43. The standing instruction, for every turn AFTER an unsafe goal was
  // raised. It exists because the exchange itself scrolls out of the history
  // window within a few turns, and without this the app drifts back into
  // coaching toward the number two days later, having forgotten it said it
  // would not. `goalSafetyPrompt` returns '' when there is nothing to say, which
  // is almost always.

  // A spoken conversation, said so, because the model cannot otherwise tell -
  // and it needs to know in order to end the call when asked (2026-09-12: on a
  // real phone, "Can you close the chat?" got a goodbye and an open call).
  const VOICE_SESSION_BLOCK = `

THIS IS A SPOKEN CONVERSATION. They are talking to you and hearing your reply read aloud. When they ask to stop, close or end it, ask to switch back to text, or clearly say goodbye, set endVoiceSession: your reply is then a short, warm goodbye with no question in it, and the call closes after it. Never end it on your own initiative or mid-thought; if you are unsure they meant to finish, leave it unset and carry on.`;

  const SUPERSEDED_TURN_BLOCK = `

THIS MESSAGE REPLACES THE ONE BEFORE IT. They paused, you answered the first part of what they were saying, and they carried on talking before they heard that answer - so they never heard it. The message below is everything they said. Answer the whole of it as though your previous reply had not been given, without referring to it or repeating it. FOOD: log the WHOLE of what they ate in this message, including anything from the part you already answered - the earlier partial log is removed automatically once this one saves, so leaving part of it out would lose it. Anything else your previous reply saved or corrected (a plan, a note, a correction to an entry, a reading) is already done: do not save or correct that again.`;

  // THE ENTRY UNDER DISCUSSION, IN WORDS THE MODEL CAN READ (2026-09-16).
  //
  // Ruth tapped "Ask about this" on a dinner log and got a reply about her knee.
  // The tag was correct on the message the whole time - it was never shown to
  // the model, only stored. Built from the provisional tag rather than the
  // resolved one because the resolved tag arrives with the reply, and this has
  // to be in the prompt that PRODUCES the reply.
  //
  // Follows the tag's own lifetime, so a follow-up question two turns later
  // still knows what "it" is - that is the whole point of a tag that persists
  // until the model says the topic moved on.
  const discussedEntry = await loadDiscussEntryFacts(supabase, provisionalTag, postedTag !== null);
  timing.mark('promptBuilt');

  // WHAT THE APP CAN ACTUALLY DO, in its own words (Ruth, 18 September 2026).
  //
  // She asked twice for a reminder to drink water at 9am and was told it was not
  // possible, with a suggestion to pair the habit with something else instead.
  // Half of that was true - there are no custom reminders yet - and the half
  // that was not is the damaging half: the app does have reminders, and saying
  // "I can't" about a feature that exists reads as the app not knowing itself.
  //
  // THE RULE UNDER THIS, which is the part worth keeping when the feature list
  // changes: never answer a request for something with a flat refusal. Say what
  // is there, say plainly what is not yet, and offer to note it. "I can't track
  // that" closes a door on a product whose whole proposition is that anything
  // can be brought here.
  // WHAT THE SCREENS ARE HAS TO BE RE-READ WHEN THEY CHANGE (2026-09-25).
  // This list said Today carried the week's Health Flower and "what you burn",
  // that the Log tab was three views behind a switch, and that movement plans
  // lived in the Almanac. All three were true when written and none of them
  // were by this evening - the flower moved to the Almanac, the burn panel to
  // the Body screen, the switch became a list, and plans became their own tab
  // a week ago. So the model has been telling people where to find things that
  // had moved, which is the same fault as a control that does nothing, said
  // out loud instead of drawn.
  //
  // It is worth a standing note rather than a fix: this paragraph is the app
  // describing itself, and nothing in the build fails when it goes stale.
  // WHY THERE IS A PARAGRAPH ABOUT HOW A REPLY OPENS (2026-09-25). Ruth:
  // "i feel its a little robotic now, saying the same thing often, feels less
  // human than claude chat or chatgpt."
  //
  // She was right, and it is measurable. Across her own threads, replies
  // opening with "Got it" went 3% in August, 27%, 14%, 21%, and 39% this week.
  // Reply LENGTH did not change - about 45 words throughout - so nothing got
  // terser; the opening collapsed onto one phrase.
  //
  // THE PHRASE IS IN NO PROMPT. It is a feedback loop: the last forty turns go
  // into context, a fifth of them opened that way, and the model copied itself.
  // Every reply written that way makes the next one likelier. That is why it
  // accelerated rather than plateauing.
  //
  // SO THE INSTRUCTION NAMES THE LOOP rather than banning a phrase. Banning one
  // gets "Understood" instead; telling it that its own previous openings are
  // not a house style is the part that generalises. And the structural point
  // underneath: the app prints its own save confirmation, so an acknowledging
  // phrase at the front of a reply has no work to do at all.
  //
  // scripts/probe-reply-variety.mjs measures this from stored replies, for
  // nothing, and fails above a threshold - so it cannot drift this far again
  // without somebody being told.

  const CAPABILITIES = `
WHAT THIS APP CAN DO TODAY. Be accurate about this: claiming a feature that does not exist is as damaging as denying one that does.
- Logging by typing, by voice note, by live conversation, and by photo: food, drinks, movement, weight and body measurements, tape measurements, water.
- Showing it back: TODAY, which is today only - the day's food and body figures, movement and steps, and water. THE LOG tab, a list of everything that can be recorded, each with its own screen and week-by-week history: Food and drink, Hydration, Sleep, How you felt, Cycle, Movement, Measurements. PLANS, the movement plans they are following. THE ALMANAC, which holds Insights - including the Health Flower, six weeks of balance across the six dimensions - and Me.
- The Almanac keeps things worth remembering, saved deliberately from a conversation.
- Movement plans with demonstration clips for most exercises, on the Plans tab.
- Reminders of two kinds. The app's own daily prompt to log, at times chosen in Settings. And any reminder the person asks for in their own words, at a time they name - "remind me to drink water at 9am", "nudge me to take my magnesium at half eight on Sundays" - which arrives saying their own words back. Ask for the time if they have not given one. They can stop one by saying so, or in Settings. Reminders are scheduled on the phone, so one asked for during a voice call is set when the call ends.
- Weekly roundups, written on a Sunday evening into the Almanac.
- A Cycle page on the Log tab: period start and end, spotting, flow, symptoms and ovulation signs, any day of which can be filled in after the fact. Phases and the next period expected are worked out from their own logged cycles once there are enough of them, and said as an estimate until then.
- A Feeling page on the Log tab: mood and energy, five words each, for any day. Both can also be said in chat - "my period started Tuesday", "flat and shattered today" - and land on the day they name rather than the day they said it.

WHEN SOMETHING IS NOT POSSIBLE YET. Never refuse flatly and never suggest a workaround instead of answering. Say what the app does do that is nearest, say plainly that the exact thing is not built yet, and offer to note it as something they want. For example, asked for a 9am water reminder: the daily log reminders exist and can be set to any time, but they prompt logging rather than drinking, and a water-specific reminder is not built - so say that, and offer to note it down. The same holds for anything else somebody asks for: a new measurement, a different kind of report. MICRONUTRIENTS ARE DIFFERENT, because there is something real you can do - see ASKED ABOUT A VITAMIN OR MINERAL.`;

  // WHY THE SYSTEM PROMPT IS NOT CACHED, AND THE TOOL IS (2026-09-24).
  //
  // A Sonnet turn sends 21,575 input tokens and gets back about 150, so the
  // time goes on READING the prompt, not writing the answer. That makes prompt
  // caching the obvious lever, and the obvious way to pull it is wrong.
  //
  // SYSTEM_PROMPT LOOKS STATIC AND IS NOT. It interpolates the person's food
  // summary, day state, activity, burn, sleep, hydration, measurements, plans,
  // Me cards, insights, allergies, health context, cycle and yesterday - all of
  // it inside the template, most of it near the top. A cache entry is keyed on
  // every byte up to its breakpoint, so a breakpoint after that block would
  // miss on every single turn and still pay the write surcharge. Caching it
  // properly means moving the static instructions in front of the person's
  // context, which reorders the safety block, and that is not a change to make
  // in an afternoon. Measured prize if it is done: about 2,900 more tokens
  // cached on a voice turn, 5,600 on a typed one.
  //
  // THE TOOL SCHEMA IS GENUINELY STATIC, all 5,900 tokens of it, and the API
  // places tools AHEAD of the system prompt - so a breakpoint there caches
  // cleanly without touching a word of the prompt. Two variants exist, one per
  // value of excludeAmbiguous, which is two cache entries and no more.
  // THE CACHEABLE PREFIX. Identical on every turn of every conversation, so it
  // carries the breakpoint. Capabilities joins it because it never varies
  // either; it used to sit after the safety block for no reason anybody
  // recorded.
  const staticSystemPrompt = GENERAL_CONDUCT + CAPABILITIES;

  // EVERYTHING THAT MOVES, and the safety block last.
  //
  // Safety used to sit mid-prompt with capabilities and all the per-turn
  // blocks after it. The end of a prompt is the strongest position for an
  // instruction that must not be talked out of, so that is where it goes now.
  // This is the one behavioural change in the reorder and it moves in the
  // direction of more weight, not less.
  const turnSystemPrompt =
    personContext +
    buildContextualAdditions(previousEscalationStep, previousRevisitCount) +
    todayBlock +
    goalSafetyPrompt({ verdict: 'unknown', reason: 'no-goal' }, profile?.unsafe_goal_flagged_at) +
    pendingFocusPrompt(pendingFocus) +
    pendingSavePrompt(pendingSave) +
    (discussedEntry ? `\n\n${discussedEntry}` : '') +
    (isVoice ? VOICE_SESSION_BLOCK : '') +
    (supersededSince ? SUPERSEDED_TURN_BLOCK : '') +
    (consolidation.eligible ? CONSOLIDATION_OFFER_BLOCK : '') +
    (isInLiteMode(profile) ? LITE_MODE_STANDING_BLOCK : '') +
    `\n\n${SAFETY_PROMPT_BLOCK}`;

  // The whole thing as one string, for the goal-safety rewrite, which appends
  // its own instruction and is rare enough not to want a breakpoint.
  const contextualSystemPrompt = staticSystemPrompt + turnSystemPrompt;

  const tool = buildClassifyTool(NON_DISTRESS_CLASSIFICATIONS, previousEscalationStep === 'direct_asked', {
    // The spotlight (build item 23). Free-form on the wire, validated below
    // against the registry - the model is asked for an exact id, and anything
    // else is dropped rather than corrected or guessed at.
    navigationTarget: {
      type: 'string',
      description:
        'Only when the person is looking for something in the app. The exact id of the element to highlight, from the list in the app-structure block. Omit entirely otherwise, and never invent an id.',
    },
    // Voice only (2026-09-12). The adapter speaks the reply, then closes the
    // call with the agent's end_call tool.
    endVoiceSession: {
      type: 'boolean',
      description:
        'Spoken conversations only. Set true ONLY when, in THIS message, the person asks to stop, close or end the conversation, asks to switch back to text, or clearly says goodbye. Your reply is then their goodbye. Never on your own initiative, never mid-thought, and leave it unset when unsure.',
    },
    // Captured CONVERSATIONALLY, wherever it comes up - Part Twelve is explicit
    // that there is never a form or a dedicated screen, and that "an allergy
    // mentioned in passing while logging dinner is captured exactly as reliably
    // as one volunteered at signup". Kept separate from rememberCategory on
    // purpose: a dislike must never reach the allergy store, and an allergy must
    // never be filed as a soft preference.
    allergiesDisclosed: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: "The allergen itself, in their words, e.g. \"peanuts\", \"nickel\"." },
          kind: {
            type: 'string',
            enum: ['food', 'contact', 'environmental', 'other'],
            description:
              'HOW IT REACHES THEM, which decides what the app filters. "food" is eaten or drunk - peanuts, shellfish, gluten for a coeliac. "contact" is touched - nickel in jewellery, latex, a fragrance in a cream. "environmental" is breathed - pollen, dust, animal dander. "other" when you genuinely cannot tell. A contact allergy is NOT a dietary restriction and must never be recorded as food: somebody who reacts to a nickel necklace has no food restriction at all.',
          },
        },
        required: ['name', 'kind'],
      },
      description:
        'Only when the person states an ALLERGY or a medical dietary restriction (coeliac, an intolerance that makes them ill), in any context including in passing. NOT dislikes, NOT preferences, NOT things they are avoiding by choice or for a diet - those go to rememberCategory. When in doubt it is a preference, not an allergy.',
    },
    saveRedirect: {
      type: 'object',
      description:
        'ONLY on a turn where saveAnswer is "yes" AND they said where it should go ("yes, under skincare", "keep that in my Me tab", "as an ongoing thing rather than a one-off"). Leave unset for a plain yes. It re-aims the offer that is already waiting and can never create a save on its own.',
      properties: {
        type: {
          type: 'string',
          enum: ['symptom', 'insight', 'note', 'me', 'week'],
          description:
            'Where it now belongs. Use "week" when they say it belongs in their week or in Plans - "no, I want it in plans, week" is exactly this, and answering it with "me" is the mistake of 1 October. Use "me" whenever what they describe is a STANDING FACT about their body or how they live rather than a single observation - an ongoing sensitivity, an allergy, a routine, a supplement. A symptom is one observation on one day; a sensitivity is true next year too. Asking for it under a heading like "skincare and allergies" is asking for Me.',
        },
        section: {
          type: 'string',
          description:
            'Only for type "me": the section, in one or two words, taken from THEIR words where they gave any - "Skincare and allergies" becomes "Skincare and allergies". Sections come into being by the first card arriving in them, so a new one is fine.',
        },
      },
      required: ['type'],
    },
    rememberCategory: {
      type: 'string',
      description: 'Only when the person shares a genuinely durable fact worth remembering long-term',
    },
    rememberContent: {
      type: 'string',
      description: 'Only alongside rememberCategory: the fact itself, concise',
    },
    healthGuidanceApplied: {
      type: 'boolean',
      description:
        "Set true only when this reply's food guidance actually drew on the person's stored health context (the HEALTH CONTEXT block, if present). Leave false otherwise.",
    },
    restoreId: {
      type: 'string',
      description:
        'ONLY when she has asked for something back that appears in the "THINGS SHE DELETED AND CAN STILL GET BACK" list: the id from the matching line, copied exactly. Never invent one, never guess between two, and never set it unless she asked. Leave it out otherwise.',
    },
    logIntent: {
      type: 'string',
      enum: ['none', 'food', 'activity', 'measurement', 'hydration', 'sleep'],
      description:
        "'food' ONLY when the message actually describes food or drink they consumed - a message ABOUT the log is not a meal (\"it's not gone into the log\", \"did that save?\", \"my log is empty\"), and gets an answer rather than an entry. 'activity' if it describes exercise/physical activity done, 'measurement' if it states a body measurement they took (ANY body measurement they have taken, not only the ones a scale gives. That means a weight, a body fat percentage or a muscle mass, and EQUALLY a waist, a thigh, a hip, a chest, a calf, an arm, a blood pressure or a resting heart rate. A single writer handles all of them and works out which is which, so NEVER answer 'none' merely because the thing measured is not a weight - a tape measurement is a measurement - e.g. \"55.2 this morning\", \"8 stone 9 today\", \"scales said 55.4 and 29% fat\"), else 'none'. A weight they are AIMING for is a goal, not a measurement - use 'none'. INDEPENDENT of the safety classification - a distress disclosure can also be a log; set this to whatever is loggable regardless of emotional content. ACTIVITY HAS A CONDITION: only set 'activity' once you know HOW LONG it lasted. \"I went for a run\" on its own is not enough - leave logIntent 'none', ask how long in your reply, and set it to 'activity' on the turn where they tell you, passing the whole thing in logText. A REST DAY IS THE ONE EXCEPTION: \"rest day today\", \"taking it easy today\", \"no training today\" is an activity log with no duration to ask for, so set 'activity' straight away and put \"rest day\" in logText. The duration rule exists because a calorie figure cannot be invented from a guess, and a rest day burns nothing to guess at.",
    },
    logText: {
      type: 'string',
      description:
        "Alongside logIntent 'activity' or 'food'. The COMPLETE description to store, assembled from the conversation and stripped of everything that is not the food or the session - e.g. after \"I did a run\" then \"about 40 minutes\", send \"a 40 minute run\"; for \"catch up my log: Mon 7th pizza and chips, Tuesday 8th burger\", send the days and their meals and nothing else. Without this the app stores the raw message, which is how a complaint about logging once became a meal. For activity include the duration always, and anything else belonging to the same session (intensity, terrain, how it felt). Omit it only when the message is already exactly the thing to store.",
    },
    cycleEvent: {
      type: 'string',
      enum: ['period_start', 'period_end', 'spotting'],
      description:
        "Which cycle moment they are reporting: 'period_start' for a period beginning (\"I came on this morning\", \"started my period Tuesday\"), 'period_end' for it finishing (\"finally finished\", \"it stopped yesterday\"), 'spotting' for light bleeding between periods. ONLY when they are stating that it happened. A question about their cycle, a prediction, a period they are EXPECTING, or a symptom with no bleeding is not an event. This is INDEPENDENT of logIntent - leave logIntent as whatever else the message logs, or 'none'.",
    },
    cycleDate: {
      type: 'string',
      description:
        "The day the CYCLE EVENT happened, as YYYY-MM-DD, resolved from today's date in the context. \"My period started on Tuesday\" said on a Friday is the Tuesday three days back. Omit it when they mean today. This dates the bleeding and NOTHING ELSE in the message: in \"my period started Tuesday and I have been shattered ever since\", this is Tuesday and the tiredness is a different day. Never a date in the future - if you are unsure which of two days they mean, omit this and let it be today rather than guessing.",
    },
    feelingMood: {
      type: 'number',
      description:
        "When they said how they FELT: 1 Low, 2 Flat, 3 Steady, 4 Good, 5 Bright. These five words are the ones on their Feeling screen, so match to the nearest - \"pretty rough today\" is 1, \"bit meh\" is 2, \"fine\" is 3, \"really good day\" is 4. Only when they are describing their own mood over a DAY. A reaction to something you just said is conversation, not a rating. INDEPENDENT of logIntent and of cycleEvent: a message can log a meal and a mood, or a period and a mood.",
    },
    feelingEnergy: {
      type: 'number',
      description:
        "When they said how much ENERGY they had: 1 Drained, 2 Tired, 3 Steady, 4 Lively, 5 Buzzing. \"Shattered\" is 1, \"tired\" is 2, \"normal\" is 3, \"loads of energy\" is 5. Set this and feelingMood together when they said both (\"flat and exhausted today\"), and only one when they said only one - never invent the other.",
    },
    feelingNote: {
      type: 'string',
      description:
        "The REASON they gave for how they felt, in their own words, short. \"second bad night in a row\", \"big week at work\". This is usually the part worth more than the rating. Omit it when they gave no reason - do not summarise their mood back as a note.",
    },
    feelingDate: {
      type: 'string',
      description:
        "The FIRST day the feeling covers, as YYYY-MM-DD. Omit it when they mean today, which is the usual case - \"shattered today\", \"I feel rough\". Set it when they name another day (\"yesterday was a write-off\", \"Monday was flat\") or when they describe a stretch of days, in which case this is where the stretch begins. THIS IS NOT cycleDate: a period is dated by cycleDate, a feeling by this. Never a date in the future.",
    },
    feelingThrough: {
      type: 'string',
      description:
        "The LAST day the feeling covers, as YYYY-MM-DD, when they described a stretch of days rather than one day. People say this constantly: \"ever since\", \"all week\", \"the last few days\", \"since the weekend\", \"for a fortnight\", \"all month\", \"these past three days\", \"all last week\". Most of those run UP TO TODAY, so this is usually today - but not always: \"all last week\" ends on that Sunday. Omit it entirely for a single day, which is still the common case. The whole stretch gets recorded, every day of it, so a stretch you invent is days of somebody's life recorded wrongly - set it only when they genuinely described one.",
    },
    patternTrigger: {
      type: 'string',
      description:
        'Only when the person asks to look at how something they log lines up with how they felt afterwards - "run a report on all the days I drank cocktails and my mood the following days", "does my energy dip after a long run", "am I flat the day after wine". The THING TO LOOK FOR, in one or two plain words as it would appear in a log entry: "cocktail", "wine", "run". Not a sentence, not a category. Leave unset for anything else, including a general question about whether the app can spot patterns.',
    },
    patternMeasure: {
      type: 'string',
      enum: ['mood', 'energy'],
      description:
        "Alongside patternTrigger: which of the two they asked about. 'mood' when they said mood, how they felt, low or flat; 'energy' when they said energy, tiredness or being wiped out. If they said neither, use 'mood'.",
    },
    patternOffsets: {
      type: 'array',
      items: { type: 'number' },
      description:
        'Alongside patternTrigger: which days afterwards to look at, as whole numbers of days. 0 is the same day, 1 the day after, 2 two days after. "the following day" is [1]; "the next couple of days" is [1, 2]; "two days after" is [2]. Omit when they did not say, and the day after is used.',
    },
    workoutPlan: {
      type: 'string',
      description:
        "Set ONLY when they say they DID one of their own saved movement plans - \"I did the gym workout today\", \"finished the barbell routine\". Pass the plan's title as closely as you can from the list of their saved plans in the context; the app matches it and does nothing if it cannot. This is how a routine gets recorded by saying so, and it carries the plan's own movements into the log, which a plain activity entry cannot. Leave logIntent 'none' when you set this: the app writes the session itself, and setting both would record the same hour twice. Never set it for a plan they are ASKING about, planning to do, or have just been given.",
    },
    workoutSkipped: {
      type: 'array',
      items: { type: 'string' },
      description:
        "Only alongside workoutPlan: the exact names of movements from that plan they say they did NOT do. Omit when they did the whole thing. Never guess - an unmentioned movement was done.",
    },
    workoutAdditional: {
      type: 'array',
      items: { type: 'string' },
      description:
        "Only alongside workoutPlan: movement they did that the routine does NOT contain, one entry each, in their own words and with their own numbers - [\"box jumps 3x10\", \"ballet hip pulses 2x40 each side\", \"20 minutes of climbing\"]. These are recorded as movement in the same session, not as a separate activity, because they happened inside the same hour. Do not tidy them into a prescription and do not include anything already in the plan.",
    },
    workoutNote: {
      type: 'string',
      description:
        "Only alongside workoutPlan: what they said ABOUT the session that is not itself a movement - how it felt, what was lighter, a sore shoulder. Movement they added goes in workoutAdditional instead, never here.",
    },
    reminderAction: {
      type: 'string',
      enum: ['create', 'cancel'],
      description:
        "Set ONLY when the person is asking for a reminder or asking to stop one - \"remind me to drink water at 9am\", \"nudge me to take my magnesium at half eight\", \"stop reminding me about the water\". 'create' to set one up, 'cancel' to stop one they already have. Leave unset for anything else, including a general question about whether reminders exist. A reminder is not a log: leave logIntent 'none'.",
    },
    reminderLabel: {
      type: 'string',
      description:
        "With reminderAction. What the reminder is FOR, in the person's own words and as few of them as possible: \"drink water\", \"take your magnesium\", \"stretch your hips\". It is read back to them on the notification, so write it as the reminder itself rather than as a description of one - never \"a reminder about water\". For 'cancel', the words that identify which one to stop.",
    },
    reminderTime: {
      type: 'string',
      description:
        "With reminderAction 'create'. The local time as HH:MM on a 24-hour clock, from whatever they said: \"9am\" is 09:00, \"half eight\" is 08:30, \"in the evening\" is not a time - ask rather than guessing. Omit for 'cancel'.",
    },
    reminderRepeat: {
      type: 'string',
      enum: ['daily', 'weekly'],
      description:
        "With reminderAction 'create'. 'daily' unless they named a single day of the week. Default to 'daily' when they did not say.",
    },
    reminderWeekday: {
      type: 'number',
      description:
        "With reminderRepeat 'weekly'. The day, 0 for Sunday through 6 for Saturday.",
    },
    removePlanTitled: {
      type: 'string',
      description:
        "The exact title of one of their SAVED PLANS they are asking to remove - \"delete the inner thigh routine\", \"get rid of the duplicate thigh workout\", \"I don't want that plan any more\". Use the plan's own title as it appears in the list above, not their paraphrase of it. The app finds it, decides what to do about duplicates, removes it and SAYS SO ITSELF - so acknowledge naturally and never state in your reply that it is gone, because you do not know whether it was. Leave unset for anything that is not a saved plan, and for a plan they are only talking about.",
    },
    correctionKind: {
      type: 'string',
      enum: ['food', 'activity', 'measurement', 'personal_metric'],
      description:
        "Set ONLY when the person is fixing or removing something they just logged, rather than logging something new - e.g. \"no that was 55.2 not 52.5\", \"make that 300 calories\", \"delete that last one\", \"scrap the run, I didn't go\". Which kind of entry they mean - use 'personal_metric' for a waist, thigh, blood pressure, resting heart rate or anything else they track that is not a weight, body fat or muscle reading, and 'measurement' for those three. When set, leave logIntent as 'none' - a correction is not a new log.",
    },
    correctionAction: {
      type: 'string',
      enum: ['update', 'delete'],
      description:
        "Only alongside correctionKind. 'update' when they are giving a corrected value, 'delete' when they want the entry gone entirely. If you cannot tell which, leave BOTH fields unset and ask them in your reply instead - never guess, because both outcomes change their real data.",
    },
    correctionMatch: {
      type: 'string',
      description:
        'WHAT they named, when they name a thing rather than "that last one" - '
        + '"delete Saturday\'s fish and chips", "remove the flapjack", "get rid of the '
        + 'pub round". Give their words for the food itself, not the whole sentence. '
        + 'Without this the app removes the most recent entry in the window, which is '
        + 'the right answer for "undo that" and the WRONG one for anything named - it '
        + 'will delete a different meal and report success. Leave unset only when they '
        + 'genuinely mean the last thing logged.',
    },
    correctionDate: {
      type: 'string',
      description:
        'The DAY they are talking about, as yyyy-mm-dd, whenever they name one - '
        + '"delete yesterday\'s food", "remove Saturday\'s entries", "that lunch on '
        + 'Monday". Work out the actual date; a named day without a year means the '
        + 'most recent one that has already happened, never a future date. Without '
        + 'this the app only looks at roughly the last day, so anything older is '
        + 'invisible to it and they are told it cannot be found. Leave unset when '
        + 'they are fixing something they just logged and have named no day.',
    },
    proposedFatFocus: {
      type: 'string',
      enum: ['reduce', 'maintain', 'increase'],
      description:
        'Set ONLY when they express a direction for their body composition that does not '
        + 'match what the app already has, and you are OFFERING to set it - \'reduce\' for '
        + 'wanting to lose fat, \'increase\' for wanting to gain weight, \'maintain\' for '
        + 'wanting to hold steady. It changes what their daily calorie target is, so when '
        + 'you set this you MUST ask them plainly in your reply whether to make the change, '
        + 'in your own words and in one short question. Never state it as already done and '
        + 'never quote a new number - the app applies it only after they agree, and tells '
        + 'them itself. Leave unset for a passing remark, a feeling about their body, or '
        + 'anything you are inferring rather than being told.',
    },
    proposedMuscleFocus: {
      type: 'string',
      enum: ['reduce', 'maintain', 'increase'],
      description:
        'The same, for muscle: \'increase\' for wanting to build, \'maintain\' to hold. '
        + 'Set alongside proposedFatFocus when they describe both in one breath (\"lose a '
        + 'bit of fat and get stronger\"), which is one question, not two.',
    },
    consolidationAnswer: {
      type: 'string',
      enum: ['solo', 'keep_logging'],
      description:
        'ONLY when the app has told you to make the consolidation offer, or told you they '
        + 'are in lite mode, AND this message answers it. \'solo\' when they want to stop '
        + 'logging for a while and see how it goes; \'keep_logging\' when they would rather '
        + 'carry on. Leave unset for anything else, including changing the subject - that '
        + 'is not an answer and must never be read as one.',
    },
    focusAnswer: {
      type: 'string',
      enum: ['yes', 'no'],
      description:
        'ONLY when the app has told you an offer is outstanding, and only when THIS message '
        + 'actually answers it. Anything else - a new topic, a log, a different question - '
        + 'is not an answer, so leave it unset. Never treat them moving on as a yes.',
    },
    statedGoalWeightKg: {
      type: 'number',
      description:
        'Set ONLY when the person states a bodyweight they are AIMING FOR, in kilograms, '
        + 'converting from stones/pounds if that is how they said it (e.g. "I want to get '
        + 'down to 8 stone" is 50.8). This is the goal, never a weight they have just '
        + 'measured - a reading goes to logIntent \'measurement\' instead. Report the number '
        + 'they said and nothing else: do NOT judge whether it is sensible, healthy or '
        + 'achievable, and do not adjust it. The app assesses it against their height '
        + 'deterministically and will tell you what to do. Leave unset if no goal weight was '
        + 'stated, or if they only mentioned one vaguely without a figure.',
    },
    suggestsFood: {
      type: 'boolean',
      description:
        'Set true when your reply PROPOSES, RECOMMENDS OR OFFERS any food or drink - a meal '
        + 'idea, a snack, something to try, an ingredient to add. Set false for everything '
        + 'else, including when you are acknowledging or discussing food the person has '
        + 'already eaten or is telling you about, which is not a suggestion. This decides '
        + 'whether the app runs an allergy safety check over your reply, so err towards true '
        + 'if you are unsure.',
    },
    correctionScope: {
      type: 'string',
      enum: ['one', 'duplicates'],
      description:
        "Only alongside correctionAction 'delete'. Use 'duplicates' when they mean the "
        + 'entry AND its copies rather than a single row - \"I logged that twice\", \"that '
        + 'went in four times\", \"remove all of those\", \"delete the duplicates\". Use '
        + "'one' when they mean a single entry, which is the ordinary case and the "
        + 'default if you leave this unset. Judge what they meant rather than matching '
        + 'phrases. Only food and activity support it; for a measurement or personal '
        + 'metric the app removes one entry whatever this says, because somebody may '
        + 'genuinely weigh themselves twice in a day.',
    },
    clarificationAsked: {
      type: 'string',
      description:
        'Only when logging a consistent-ratio dish (e.g. lasagne - its one material variable like meat type/portion) OR a high-variability dish (e.g. a full English - its key items and quantities) whose details the person did NOT specify, and you ask about them in one gentle in-reply question with an easy-out fallback: a short name for what you asked about (e.g. "the type of meat", "the egg and bacon quantities"). Never for simple/branded or multi-component items, never item by item across turns, never naggy. Leave unset otherwise.',
    },
    clarificationResolved: {
      type: 'string',
      description:
        'Only when THIS message answers a clarification you asked on the previous turn (you will see your question and their answer in the recent history): the full enriched food description combining the original dish with everything they said (e.g. "beef lasagne", or "full English with 2 eggs and 3 rashers"). Leave unset otherwise.',
    },
    discussTopicEnded: {
      type: 'boolean',
      description:
        "Set true ONLY when a discussion is anchored to a logged entry and you are CONFIDENT this message has genuinely moved on to something unrelated. A follow-up about the same entry, a tangent still rooted in it, or anything that only makes sense because of it is NOT a move. The anchor is what keeps the conversation readable later, so when in doubt leave it unset - the discussion continues by default.",
    },
    proposedSave: {
      type: 'object',
      description:
        'Set ONLY when something in this turn is worth OFFERING to keep - as a symptom, an insight, a ME CARD, a RULE, something in their WEEK, or a SKILL they want to become able to do. Do not ask the question yourself: the app adds the offer to the end of your reply. '
        + '{"type": "symptom" | "insight" | "me" | "rule" | "week" | "skill", "title": a short title in their terms, "content": for a symptom {"summary": their own words}, for an insight {"condition": ..., "expectation": ...}, for a me card {"section": ..., "why": ..., "status": ..., "detail": ...}, for a rule {"kind": "never" | "always", "matchTerms": [...], "advisedBy": ...}, for a week entry {"days": ["mon","wed"], "time": "7pm", "duration": "~60 min", "cadence": "2x/week"}, for a skill {"said": her sentence exactly as she said it}}. '
        + 'A SKILL IS SOMETHING SHE WANTS TO BECOME ABLE TO DO - a muscle up, a handstand, the splits, a strict pull-up. The title is the skill in her words and content is {"said": her whole sentence}, because the app matches her sentence against the written ladders and "I want to learn to pull up to muscle up" names two skills and means the second one. DO NOT DESCRIBE THE STEPS, do not list a progression and do not say how long it takes: the app holds a small number of written ladders and attaches the right one, or saves the skill with no steps and says so. A SKILL IS NEVER HER WEEK and never an insight - her week is when she trains, a skill is what she is training for, and offering an insight when she asked to learn something is the mistake this type exists to stop. '
        + 'A WEEK ENTRY HERE IS ONLY FOR SOMETHING SHE MENTIONED IN PASSING that you are offering to keep - "she has started a French class on Thursdays" said while talking about something else. WHEN SHE DIRECTLY ASKS for something to go in her week, USE THE weekEntry FIELD INSTEAD and do not offer: asking is the yes, exactly as with a note. A week entry is an activity she does, which day, and when in the day - "add gym on Wednesday", "put yoga in my week", "I swim on Thursdays now". The title is the activity in her words ("Gym", "Rocket yoga"), days are lowercase three-letter day names, and an EMPTY days array means Anytime this week, which is a real answer for anything she does when she can. HER WEEK IS NOT HER ME TAB: the Me tab is her standing protocol and her week is the seven days on Plans that sessions are planned against. Never offer one when she asked for the other, and never tell her they are the same. '
        + 'THE TIME GOES IN "time", IN HER WORDS AND NOT PARSED. "french class on thursday night at 7pm" is time "7pm"; "evening", "after work" and "before the school run" are equally valid and must be kept as she said them. Leave it out when she did not say. A WEEK ENTRY NEED NOT BE EXERCISE - a class, a commitment, a standing arrangement all belong there, because something can earn a place in her week by taking the time rather than by being training. '
        + 'A ME CARD is for a settled decision about how they live - a supplement, a routine, a dietary decision, a standing commitment - and its status, where it has one, must be exactly one of: Taking, Ordered, Dietary source, As needed, Active, Paused. WHAT SHE TAKES REGULARLY GOES ON ONE CARD TITLED EXACTLY "Medications", section "Medication", with each medicine or supplement as its OWN item - name as she said it, `when` carrying the dose and the timing in her words ("75mcg, each morning"), and `purpose` only if she said what it is for. Use that exact title every time so a later addition merges into the same card instead of starting a second list, and never split one list across two cards. Supplements she describes as part of a routine can stay on their own card; a list of things she takes is this one. See the Almanac section of your instructions for when each type applies. '
        + 'A RULE is a MOVEMENT CONSTRAINT: something they must never do, or something that is always fine, usually because a clinician said so or because of a condition or injury. "My surgeon said no loaded squats" is a rule; "I hate burpees" is not. kind is "never" or "always". matchTerms are the lowercase movement words the app should match against a generated plan - for "no heavy deadlifts or loaded squats" that is ["deadlift", "loaded squat", "back squat"] - and they matter, because the app uses them to physically remove movements from anything it builds, so a term that is too narrow means a rule that does not work. advisedBy is who said so, if they named anybody. '
        + 'The app stores the offer and saves it only if they say yes. NEVER save a rule silently and never treat one as agreed because it was mentioned: a rule changes what gets built for them from then on, so it is confirmed first, always. Never for a plan, a passing remark, a plain result or a one-off observation, and never while an earlier offer is still waiting.',
    },
    meUpdate: {
      type: 'object',
      description:
        'ONLY when they tell you something ALREADY in their Me tab has changed - stopped, paused, restarted, ordered. '
        + '{"title": the card\'s name as listed in their Me tab, "status": one of Taking, Ordered, Dietary source, As needed, Active, Paused, "reason": why, in their own words, or omit if they gave none}. '
        + 'Not for adding something new - that is proposedSave with type "me". The app finds the card, changes it, keeps the history, and tells them.',
    },
    weekEntry: {
      type: 'object',
      description:
        'ONLY when they DIRECTLY ask for something to go in their week - "add gym on Wednesday", '
        + '"put french class in my week on thursday night at 7pm", "I swim on Thursdays now, add that". '
        + '{"activity": the thing in their words ("Gym", "French class"), "days": lowercase three-letter '
        + 'day names like ["thu"], "time": when in the day IN THEIR WORDS ("7pm", "evening", "after work") '
        + 'or omit if they did not say, "duration": "~60 min" or omit}. '
        + 'ASKING IS THE YES: there is no offer and no confirmation step, exactly as with noteText. The app '
        + 'adds it and tells them itself, so do NOT claim in your reply that it is in their week and do NOT '
        + 'ask whether to add it. '
        + 'IT NEED NOT BE EXERCISE. A class, a commitment, a standing arrangement all belong in a week, '
        + 'because something can earn its place by taking the time rather than by being training. '
        + 'An EMPTY days array means Anytime this week, which is a real answer for anything they do when they can. '
        + 'Use proposedSave with type "week" INSTEAD when they only MENTIONED it in passing and you are '
        + 'offering to keep it - a direct request uses this field, a thing you noticed uses that one. '
        + 'Never for their Me tab, which is their standing protocol and a different screen.',
    },
    saveAnswer: {
      type: 'string',
      enum: ['yes', 'no'],
      description:
        'ONLY when the app has told you an offer to keep something is outstanding, and only when THIS message actually answers it. '
        + 'Anything else - a new topic, a log, a different question - is not an answer, so leave it unset. Never treat them moving on as a yes.',
    },
    noteText: {
      type: 'string',
      description:
        'Set ONLY when they explicitly ask you to note, log or keep something as a note ("log a note: I feel really good today"). '
        + 'Their words exactly as they said them, minus the instruction itself: never rewritten, summarised or embellished. Asking is the yes, so there is no offer.',
    },
    almanacKind: {
      type: 'string',
      description:
        'Only for a PLAN you have worked out together (a routine, a movement plan, a meal or drink plan), and only after the person has AGREED to save it: an open, natural word for the kind (e.g. "routine", "movement plan"). Never for an insight, a symptom or a note - those go through proposedSave or noteText. Never without agreement.',
    },
    almanacTitle: {
      type: 'string',
      description: 'Only alongside almanacKind: a short title for the saved entry.',
    },
    almanacCategory: {
      type: 'string',
      description: 'Only alongside almanacKind, and only when a natural grouping exists: an emergent category (e.g. "Workouts").',
    },
    almanacContent: {
      type: 'object',
      description:
        'Only alongside almanacKind: the entry content as an object. For an INSIGHT use { "condition": ..., "expectation": ... } so it can inform future readings; for a plan, the plan\'s structure; otherwise a { "summary": ... }.',
    },
  },
  [],
  // THE REPLY IS A FALLBACK WHEN THE NEW PATH IS ON, so it is asked for short.
  // Generating forty to sixty words of careful prose that nothing reads is pure
  // latency on the critical path of every turn: her median went from 3.3s to
  // 7.0s the day the second call went live. The field cannot be removed - it is
  // what she gets when the writer fails - and on a distress turn it is still the
  // real reply, which the instruction says in as many words.
  newPathWrites(isVoice));

  // ── THE SPOKEN TURN STARTS ITS REPLY NOW, NOT AFTER (Ruth, 2026-09-28) ─────
  //
  // Two sequential model calls cannot beat one: the old path WAS the
  // classification call and measured 3.3s, and the writer adds about two seconds
  // on top of it. The only route back to 3.3s is not running them one after the
  // other.
  //
  // It works because the writer needs her message and the record, and both exist
  // right now - turn_context was read at the top of this function. What it does
  // NOT have is what the app did with her data, because nothing has been saved
  // yet. Most turns have nothing to report there, and those are the turns this
  // gets right.
  //
  // THE GUESS IS DISCARDED WHOLE when it is wrong. See where it is consumed.
  //
  // VOICE ONLY. The cost is a wasted call on the turns that do report something,
  // and it buys removing a second call from the critical path of a spoken
  // conversation, where the alternative is silence on a phone line. On text those
  // seconds are a pause with a typing indicator in them.
  // THE SINK IS THE VOICE ADAPTER LISTENING IN (see app/lib/voice-sink.ts).
  //
  // Present only on a spoken turn that came through the adapter, and silent
  // until this route opens it. Nothing below changes because of it: the reply is
  // still assembled, gated and stored exactly as it was, and the streaming is an
  // extra copy of the words going out early.
  //
  // THE GATE DECIDES WHETHER STREAMING IS ALLOWED AT ALL, and it decides here,
  // before a word is written. `runAllergyGate` short-circuits to safe for anybody
  // with no edible exclusions, so for those people it can never block and words
  // already spoken can never need taking back. For everybody else the sink is
  // never opened and the turn waits, which is slower and is the only honest
  // answer: a reply that is half-spoken before the gate has seen it is exactly
  // the failure the gate exists to prevent.
  const sink = isVoice ? voiceSinkFor(request) : null;
  const mayStream =
    sink !== null &&
    REPLY_STREAMS_TO_VOICE &&
    newPathWrites(true) &&
    disclosedAllergies.filter(filtersFood).length === 0;

  const spokenReplyInFlight =
    isVoice && newPathWrites(true)
      ? writeReplyAfterSaves({
          ...(mayStream ? { onText: (text: string) => sink.push(text) } : {}),
          anthropic,
          model: MODEL,
          messages,
          data: {
            food: recentFood ?? [],
            activity: recentActivity ?? [],
            dailyBurn: recentDailyBurn ?? [],
            drinks: recentDrinks ?? [],
            sleep: recentSleep ?? [],
            measurements: recentMeasurements ?? [],
            lastPeriodStart: lastPeriodRow?.event_date ?? null,
            days: 3,
            // The same two fields the sequential call gets below. See mealExtras.
            today: buildDayStatePrompt(dayState),
            usuallyEats,
          },
          voice: true,
          // NOTHING, because nothing has happened yet. That is the assumption
          // this whole branch rests on, and it is checked before the result is
          // used rather than hoped for.
          didLines: [],
          safetyBlock: SAFETY_PROMPT_BLOCK,
          // The same context the sequential call gets. A spoken turn that
          // cannot see her Me tab gives the same wrong answer as a typed one.
          extraBlocks: [meFactsBlock, lifeStageBlock, weekBlock, skillBlock, feelBlock],
        })
      : null;

  let response;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      // 500 UNTIL 2026-09-09, AND IT COULD NOT HOLD A WORKOUT PLAN.
      //
      // Found on device: asked to build a splits program and save it to the
      // Almanac, the route failed five times running and answered "Something
      // went wrong just then" to every one - including to "Can you end the
      // session, please?". chat_messages tells the story plainly: six user rows
      // and no assistant rows, because the user turn is written BEFORE this
      // call and the reply after it, so the failure sits squarely in between.
      //
      // A plan comes back inside ONE tool block: programType, goal, then per
      // exercise a name, group, sets, reps, eccentricLoad, intensity, and a
      // safetyNote the prompt requires to name that movement's real failure
      // modes rather than boilerplate. That is 100+ tokens an exercise, so six
      // exercises exceeds 500 on almanacContent alone - before the spoken reply
      // and the other fifteen classify fields. Every retry hit the same wall,
      // which is why it failed identically five times rather than sometimes.
      //
      // RAISING THIS COSTS NOTHING ON AN ORDINARY TURN. max_tokens is a ceiling,
      // not a reservation: a two-sentence reply still generates two sentences
      // and stops. The latency note above concerns tokens READ, not tokens
      // allowed, and is unaffected.
      max_tokens: 2000,
      // TWO BREAKPOINTS, and the order the API reads them in is tools, then
      // system, then messages. So the tool schema caches on its own, and the
      // static prompt caches on top of it. Everything that varies sits after
      // both and is read fresh, which is what it has to be.
      system: [
        { type: 'text', text: staticSystemPrompt, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: turnSystemPrompt },
      ],
      messages,
      tools: [{ ...tool, cache_control: { type: 'ephemeral' } }],
      tool_choice: { type: 'tool', name: CLASSIFY_TOOL_NAME },
    }, {
      // ABANDONED TURNS STOP COSTING (2026-09-25). When somebody keeps talking,
      // the voice adapter's caller walks away from the generation it asked for.
      // Until now this call ran to the end regardless, wrote a reply into the
      // thread, and nobody ever heard it - six times in thirty seconds on
      // 24 September. Undefined on a typed message, where nothing changes.
      signal: request.signal,
    });
  } catch (err) {
    // A turn the caller walked away from is not a failure. It is the expected
    // end of work nobody is waiting for, so it is not logged as an API error
    // and does not become a 500 that the adapter would speak an apology for.
    if (request.signal?.aborted || (err as { name?: string })?.name === 'AbortError') {
      console.log('ASK-SELODIA: turn abandoned by the caller, stopping');
      return NextResponse.json({ error: 'Abandoned' }, { status: 499 });
    }
    console.log('ANTHROPIC API ERROR:', err instanceof Error ? err.message : err);
    // Deliberately NOT marking the card sent here: a failed call must not
    // consume the one chance the image had to be seen.
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }

  timing.mark('modelAnswered');

  // WHETHER THE CACHE ACTUALLY HIT, rather than whether we asked it to. The
  // first attempt at caching on this route put the breakpoint after a prompt
  // that only looked static, which would have missed every turn and paid the
  // write surcharge for it, and nothing in the log would have said so.
  console.log(
    'TURN TOKENS',
    JSON.stringify({
      in: response.usage.input_tokens,
      cacheWrite: response.usage.cache_creation_input_tokens ?? 0,
      cacheRead: response.usage.cache_read_input_tokens ?? 0,
      out: response.usage.output_tokens,
    })
  );

  // AND KEPT, not only printed. The console line above answers "did the cache
  // hit on this turn"; the row answers "what does this person cost a month",
  // which is the question the whole pricing document had to guess at.
  recordModelUsage({
    userId,
    turnId,
    call: 'classify',
    model: MODEL,
    usage: response.usage,
  });

  if (pendingCard) await markCardImageSent(supabase, pendingCard.messageId);

  // A TRUNCATED RESPONSE IS A BROKEN CALL, NOT A JUDGEMENT ABOUT THE INPUT.
  //
  // classify-image learned this the expensive way and wrote it down: at
  // max_tokens the model stops mid-tool-block, the block is present but its
  // input is half-written, and the cast below succeeds because a TypeScript
  // cast checks nothing at runtime. The failure then surfaces somewhere else
  // entirely, looking like anything but what it is. This route had no such
  // check at all until 2026-09-09, which is why five identical failures in a
  // row said only "Something went wrong just then".
  if (response.stop_reason === 'max_tokens') {
    console.log(
      'ASK-SELODIA TRUNCATED: hit max_tokens before finishing the tool block.' +
        ' Raise max_tokens; the reply and any save in this turn are lost.'
    );
    recordRouteError({
      userId,
      turnId,
      voice: isVoice,
      label: 'classification truncated',
      detail: { stop_reason: response.stop_reason, output_tokens: response.usage?.output_tokens ?? null },
    });
    return NextResponse.json({ error: 'Response was cut short' }, { status: 500 });
  }

  const toolUse = response.content.find((block) => block.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    recordRouteError({
      userId,
      turnId,
      voice: isVoice,
      label: 'no classification block',
      detail: { stop_reason: response.stop_reason, blocks: response.content.map((b) => b.type) },
    });
    return NextResponse.json({ error: 'Model did not return a classification' }, { status: 500 });
  }

  const result = toolUse.input as {
    classification: Classification;
    reply: string;
    resourceCardTitle?: string;
    resourceCardDescription?: string;
    revisitingPriorDisclosure?: boolean;
    rememberCategory?: string;
    rememberContent?: string;
    healthGuidanceApplied?: boolean;
    /** An id from the recoverable list, when she has asked for one back. */
    restoreId?: string;
    logIntent?: 'none' | 'food' | 'activity' | 'measurement' | 'hydration' | 'sleep';
    logText?: string;
    cycleEvent?: string;
    cycleDate?: string;
    feelingMood?: number;
    feelingEnergy?: number;
    feelingNote?: string;
    feelingDate?: string;
    feelingThrough?: string;
    patternTrigger?: string;
    patternMeasure?: 'mood' | 'energy';
    patternOffsets?: number[];
    reminderAction?: 'create' | 'cancel';
    reminderLabel?: string;
    reminderTime?: string;
    reminderRepeat?: 'daily' | 'weekly';
    reminderWeekday?: number;
    removePlanTitled?: string;
    correctionKind?: string;
    correctionDate?: string;
    correctionMatch?: string;
    correctionAction?: string;
    correctionScope?: string;
    suggestsFood?: boolean;
    statedGoalWeightKg?: number;
    proposedFatFocus?: string;
    proposedMuscleFocus?: string;
    focusAnswer?: string;
    consolidationAnswer?: string;
    clarificationAsked?: string;
    clarificationResolved?: string;
    discussTopicEnded?: boolean;
    navigationTarget?: string;
    endVoiceSession?: boolean;
    allergiesDisclosed?: ({ name: string; kind?: string } | string)[];
    proposedSave?: unknown;
    meUpdate?: { title?: unknown; status?: unknown; reason?: unknown };
    weekEntry?: { activity?: unknown; days?: unknown; time?: unknown; duration?: unknown };
    saveAnswer?: string;
    saveRedirect?: { type?: unknown; section?: unknown };
    noteText?: string;
    workoutPlan?: string;
    workoutSkipped?: string[];
    workoutAdditional?: string[];
    workoutNote?: string;
    almanacKind?: string;
    almanacTitle?: string;
    almanacCategory?: string;
    almanacContent?: unknown;
  };

  // A DRINK WITH CALORIES IN IT IS FOOD, WHATEVER THE MODEL CALLED IT
  // (Bug 17, 21 September 2026). "Tea with milk is currently being logged as
  // hydration only, with no calories captured."
  //
  // The prompt now says so too, but a rule the model is asked to follow is not
  // a guard - and this one had been quietly wrong since the app was built,
  // because the prompt's own example of a zero-calorie drink was "a mug of
  // tea". In Britain that has milk in it.
  //
  // So the intent is corrected here, before anything reads it: a message the
  // model called hydration, whose words plainly name milk, sugar, syrup or a
  // drink made of them, becomes a food log. The volume is not lost by this -
  // logFoodFromText writes the water for drinks in a food entry, which is what
  // Ruth asked for when she chose "macros AND its volume as water".
  if (result.logIntent === 'hydration' && drinkHasCalories(result.logText?.trim() || message)) {
    console.log('DRINK: caloric drink classified as hydration, routing to food -', result.logText || message);
    result.logIntent = 'food';
  }

  // Now the model has spoken, settle the tag properly. Posting a card always
  // wins; otherwise the previous tag carries forward unless the topic moved on.
  const resolvedTag = resolveDiscussTag({
    posted: postedTag,
    previous: previousTag,
    topicEnded: result.discussTopicEnded === true,
    minutesSincePrevious,
    // Putting a new entry in the log IS the change of subject. The model was
    // being asked to notice that and declare it, and never did - on the turn
    // that logged two new meals it left discussTopicEnded unset, so a pizza
    // from the week before stayed attached to it.
    loggedSomethingNew:
      typeof result.logIntent === 'string' && result.logIntent !== 'none',
    closedByUser: closeDiscussion === true,
  });
  if (userRow?.id && resolvedTag?.entryId !== provisionalTag?.entryId) {
    const { error: tagFixError } = await supabase
      .from('chat_messages')
      .update({
        discuss_entry_id: resolvedTag?.entryId ?? null,
        discuss_entry_type: resolvedTag?.entryType ?? null,
      })
      .eq('id', userRow.id);
    if (tagFixError) console.log('ASK-SELODIA TAG CORRECTION FAILED:', tagFixError.message);
  }

  const { replyText, nextEscalationStep, resourceCard, nextRevisitCount, nextClassification } =
    applySafetyStateMachine(result, {
      previousEscalationStep,
      previousClassification,
      previousRevisitCount,
    });

  // Silent food/activity logging (Part Twelve). The reply is purely the
  // safety/conversational response; the save is confirmed by an ephemeral
  // visual toast in the client (the `saved` field), never in the reply text.
  // On storage failure `saved` stays null - we never signal a save that didn't
  // happen.
  // 'measurement' means the SCALE's three. A waist or a thigh is
  // 'personal_metric', which the app reads to decide whether the reading
  // interpretation applies - see item 3, 27 September 2026.
  let saved: {
    kind: 'food' | 'activity' | 'measurement' | 'personal_metric' | 'hydration' | 'sleep' | 'cycle' | 'feeling';
    summary: string;
  } | null = null;
  // TWO THINGS CAN LAND IN ONE MESSAGE, and the toast has one line. Rather than
  // let the second write silently replace the first one's confirmation - which
  // would tell her the mood saved and say nothing about the period - both are
  // said, in the order they happened.
  const alsoSaved = (
    current: typeof saved,
    kind: 'cycle' | 'feeling',
    summary: string
  ): typeof saved => (current ? { ...current, summary: `${current.summary} · ${summary}` } : { kind, summary });

  // What actually reached the database this turn, for the honesty note below.
  // Kept separate from `saved` because `saved` drives the toast and carries one
  // headline summary, while this has to survive a PARTIAL landing - a weight
  // stored while a waist was not.
  const attempt: LogAttempt = {
    intent: result.logIntent ?? 'none',
    landed: [],
    missed: [],
    attempted: false,
  };

  /**
   * Run a write, and if it fails, run it again before giving up.
   *
   * Ruth, item 6: "The chat already has the text. If a save fails, retry it
   * from the message it already has; never ask the user to type it again."
   *
   * She is right, and the old behaviour was worse than useless: it asked her to
   * re-enter the thing, she re-entered it, and the same failure produced the
   * same request. A retry costs a second; asking her costs her the belief that
   * the app is keeping her record.
   *
   * A writer THROWS when a write fails and returns null when there is nothing
   * to write, so only the first case reaches here - and reaching here is what
   * sets `attempted`, which is what lets the honesty note tell a real loss from
   * a message that never contained a log at all.
   */
  async function saving<T>(what: string, run: () => Promise<T>): Promise<T | null> {
    try {
      return await run();
    } catch (first) {
      attempt.attempted = true;
      console.log(`SAVE FAILED (${what}), retrying:`, first instanceof Error ? first.message : first);
      try {
        const out = await run();
        console.log(`SAVE RECOVERED (${what}) on the second attempt`);
        return out;
      } catch (second) {
        // LOGGED WITH ITS REASON, which is her last bullet: "Log every save
        // failure with the reason, so this shows up in the logs rather than
        // only in my screenshots."
        console.log(`SAVE FAILED TWICE (${what}):`, second instanceof Error ? second.message : second);
        return null;
      }
    }
  }
  // REMINDERS SHE ASKED FOR (2026-09-18). "Remind me to drink water at 9am" was
  // refused twice before this existed.
  //
  // The row is the record; the phone schedules it, because there is no server
  // scheduler in this project and a local notification is what actually arrives.
  // So the reply must never say it is set - the app confirms once the phone has
  // actually scheduled it, exactly as a food log is confirmed by the app rather
  // than by the sentence.
  let reminderResult:
    | { action: 'created'; label: string; atTime: string; weekday: number | null }
    | { action: 'cancelled'; label: string; count: number }
    | null = null;

  if (result.reminderAction === 'create') {
    const label = (result.reminderLabel ?? '').trim();
    const atTime = (result.reminderTime ?? '').trim();
    // No time, no reminder. The model is told to ask rather than guess, and this
    // is the guard behind that: a reminder at a time nobody chose would arrive
    // as a surprise and be indistinguishable from a bug.
    if (label && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(atTime)) {
      const weekday =
        result.reminderRepeat === 'weekly' && typeof result.reminderWeekday === 'number'
          ? Math.max(0, Math.min(6, Math.round(result.reminderWeekday)))
          : null;
      const { error } = await supabase
        .from('custom_reminders')
        .insert({ user_id: user.id, label, at_time: atTime, weekday, source: isVoice ? 'voice' : 'chat' });
      if (error) console.log('CUSTOM REMINDER INSERT FAILED:', error.message);
      else reminderResult = { action: 'created', label, atTime, weekday };
    }
  } else if (result.reminderAction === 'cancel') {
    const label = (result.reminderLabel ?? '').trim();
    if (label) {
      // Matched on the words rather than an id, because she cancels one the way
      // she asked for it: "stop reminding me about the water". Only her own
      // active ones, and never more than the ones that match.
      const { data: stopped, error } = await supabase
        .from('custom_reminders')
        .update({ active: false })
        .eq('active', true)
        .ilike('label', `%${label.replace(/[%_]/g, '')}%`)
        .select('id');
      if (error) console.log('CUSTOM REMINDER CANCEL FAILED:', error.message);
      else reminderResult = { action: 'cancelled', label, count: stopped?.length ?? 0 };
    }
  }

  let breakdownFoodLogId: string | null = null;
  // EVERY MEAL THE TURN LOGGED, not just the one it could draw a table for.
  // See the note at the assignment below.
  let breakdownFoodLogIds: string[] = [];
  // A correction or deletion of something just logged (build item 10d). Runs
  // BEFORE the logging branches so a corrected value can never also be stored
  // as a second, new entry.
  // REMOVING A SAVED PLAN, which is its own thing and not a correction.
  //
  // Runs before the correction branch for the same reason that one runs before
  // logging: whatever the turn is doing to existing data should happen before
  // anything new is written, so the two cannot interleave.
  //
  // The app says what happened, always - including "I could not find it" and
  // "there are two and they differ, which did you mean". The model is told not
  // to claim anything, and this is the half of that instruction that does not
  // depend on the model obeying it.
  let planNote: string | null = null;
  if (typeof result.removePlanTitled === 'string' && result.removePlanTitled.trim()) {
    const outcome = await removePlanTitled(supabase, user.id, result.removePlanTitled.trim());
    planNote = planRemovalMessage(outcome);
    console.log(
      'PLAN REMOVAL:',
      outcome.done ? `removed ${outcome.removed}, kept ${outcome.kept}` : outcome.reason
    );
  }

  let correctionNote: string | null = null;
  const correction = resolveCorrection(result.correctionKind, result.correctionAction);
  if (correction) {
    try {
      const table = TABLE_FOR[correction.kind];
      const timeCol = TIME_COLUMN_FOR[correction.kind];
      // The most recent entry of that kind inside the window. Ordered by the
      // event time rather than created_at so "that last one" means the entry
      // they are looking at, not whichever row was written most recently.
      // Selecting the whole row, not just the id: the duplicate match below
      // compares against this row's own values, so it needs them.
      // THE DAY SHE NAMED, WHEN SHE NAMED ONE (2026-10-04).
      //
      // Ruth asked on Sunday afternoon to delete Saturday's food. Every row
      // carried a happened_at around Saturday lunchtime - twenty-six hours back,
      // just outside the rolling day - so the lookup found nothing and said so.
      // She answered the follow-up with "Saturday" and got the same refusal,
      // because naming the day had nowhere to go. See correctionDayRange.
      const namedDay =
        typeof result.correctionDate === 'string'
          ? correctionDayRange(result.correctionDate)
          : null;
      // One expression, used by every read below, so the target and its
      // duplicates can never be looked for in two different windows.
      const inWindow = <T extends { gte: (c: string, v: string) => T; lt: (c: string, v: string) => T }>(
        q: T,
        col: string
      ): T => (namedDay ? q.gte(col, namedDay.from).lt(col, namedDay.to) : q.gte(col, correctionCutoff()));

      // THE ONE SHE NAMED, NOT THE ONE LOGGED LAST (2026-10-04).
      //
      // Ruth: "I asked her to delete Saturday's fish and chips, she didn't. She
      // said she did."
      //
      // She was right twice over. This used to be `.order(time desc).limit(1)` -
      // the most recent entry in the window, with no reference whatsoever to what
      // she had named. For "delete that last one", which is what the machinery was
      // built for, that is exactly right. For "Saturday's fish and chips" it
      // removes whichever meal happened to be logged last that day, and then the
      // app states a deletion that did happen, of something she never asked about.
      // Her fish and chips were still there; something else was not.
      //
      // So a named thing is matched on its CONTENT WORDS, the same comparison the
      // duplicate guard uses - grammar dropped, order ignored, so "fish and chips"
      // finds "Dinner - fish and chips and mushy peas". Nothing is parsed out of
      // the sentence here; the model hands over the words for the food and this
      // does arithmetic on them.
      const { data: candidates } = await inWindow(
        supabase.from(table).select('*').eq('user_id', user.id),
        timeCol
      ).order(timeCol, { ascending: false });

      const rows = (candidates ?? []) as Record<string, unknown>[];
      const named =
        typeof result.correctionMatch === 'string' && result.correctionMatch.trim().length > 0
          ? result.correctionMatch.trim()
          : null;

      let target: Record<string, unknown> | null = rows[0] ?? null;
      let ambiguous = false;

      if (named && rows.length > 0) {
        const wanted = contentWords(named);
        // Every word she used has to appear in the entry. "fish and chips" must
        // not match a salad because both contain "and" - the function words are
        // already dropped, and what is left has to be present in full.
        const hits = rows.filter((r) => {
          const text = [r.raw_text, r.meal_label].filter((v) => typeof v === 'string').join(' ');
          const have = contentWords(text);
          return wanted.size > 0 && [...wanted].every((w) => have.has(w));
        });
        if (hits.length === 0) {
          // NOTHING MATCHED IS NOT "DELETE SOMETHING ELSE". Falling back to the
          // newest row is how a mis-heard word becomes a lost dinner.
          target = null;
        } else if (hits.length === 1) {
          target = hits[0];
        } else {
          // Several copies of the same thing is the duplicates case, which the
          // scope below handles; several DIFFERENT things is a question, not a
          // guess. Same rule as the two plans sharing a title.
          const texts = new Set(hits.map((r) => contentWords(String(r.raw_text ?? '')).size));
          const allSame = hits.every(
            (r) =>
              contentWords(String(r.raw_text ?? '')).size === [...texts][0] &&
              [...contentWords(String(r.raw_text ?? ''))].every((w) =>
                contentWords(String(hits[0].raw_text ?? '')).has(w)
              )
          );
          if (allSame) target = hits[0];
          else {
            target = null;
            ambiguous = true;
          }
        }
      }

      // A personal-metric UPDATE finds its own row, per metric name, inside the
      // branch below - so `target` is not its precondition and must not gate it.
      // It did, until 2026-08-28: `!target` short-circuited first, so the very
      // first waist or thigh anyone stated was answered with "I can't find a
      // measurement recent enough to change" and never written, while the branch
      // built to handle exactly that case sat unreachable underneath. Every other
      // kind genuinely does need a target, because each one edits that row by id.
      const findsItsOwnTarget = correction.kind === 'personal_metric' && correction.action === 'update';

      if (!target && !findsItsOwnTarget) {
        // NAMED AND NOT FOUND IS A DIFFERENT ANSWER from "nothing recent to
        // change". She is owed the distinction: one means her words did not match
        // anything in that day, the other that the day is empty.
        correctionNote = ambiguous
          ? 'There is more than one thing there that matches, so nothing was removed - say which one and it will go.'
          : named
            ? `Nothing matching "${named}" was found on that day, so nothing was removed.`
            : nothingToCorrectMessage(correction.kind);
      } else if (correction.action === 'delete' && target) {
        // DUPLICATES GO TOGETHER, OR ONE GOES ALONE.
        //
        // The single-row path deleted the newest match, so clearing four copies
        // took four instructions - and a person who miscounted deleted the real
        // entry along with them. Here the target row defines what 'the same entry'
        // means, and every row matching it inside the window goes at once.
        //
        // Matching is on the target's own values, never on anything parsed out of
        // the message. Two identical meals really are a double-log; a re-parse of
        // 'remove all of those' would be a guess about which meal was meant.
        const scope = coerceCorrectionScope(result.correctionScope);
        const matchOn = DUPLICATE_MATCH_COLUMNS[correction.kind];

        let ids = [String(target.id)];
        if (scope === 'duplicates' && supportsDuplicateRemoval(correction.kind) && matchOn) {
          let q = inWindow(
            supabase.from(table).select('id').eq('user_id', user.id),
            timeCol
          );
          // A null column has to be matched with `is`, not `eq` - a meal logged
          // with no meal_label would otherwise match nothing and quietly fall back
          // to deleting one row while claiming to have deleted several.
          for (const col of matchOn) {
            const value = (target as Record<string, unknown>)[col] ?? null;
            q = value === null ? q.is(col, null) : q.eq(col, value);
          }
          const { data: copies } = await q;
          if (copies && copies.length > 0) ids = copies.map((r) => r.id);
        }

        const { error } = await supabase
          .from(table)
          .delete()
          .in('id', ids)
          .eq('user_id', user.id);
        correctionNote = error ? null : duplicatesRemovedMessage(correction.kind, ids.length);
        if (error) console.log('ASK-SELODIA DELETE FAILED:', error.message);
      } else if (correction.kind === 'personal_metric') {
        // Corrected by METRIC NAME, not by "the most recent row". Someone who
        // logged a waist and a thigh a minute apart and says "no, the waist was
        // 71" means the waist - and the most recent row is the thigh. Finding
        // the target above by time alone would confidently rewrite the wrong
        // number, which is the exact failure the correction path exists for.
        const { personal } = await logMeasurementFromText(supabase, user.id, message);
        for (const m of personal) {
          const { data: prior } = await supabase
            .from('personal_metrics')
            .select('id')
            .eq('user_id', user.id)
            .eq('metric_name', m.metric_name)
            .neq('id', m.id)
            .gte('measured_at', correctionCutoff())
            .order('measured_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          // The corrected value has just been inserted, so the wrong one is
          // removed rather than updated - leaving both would put two readings
          // minutes apart into a table whose whole job is showing the latest.
          if (prior?.id) {
            await supabase.from('personal_metrics').delete().eq('id', prior.id).eq('user_id', user.id);
          }
        }
        if (personal.length > 0) {
          saved = { kind: 'personal_metric', summary: personalSaveSummary(personal) };
        }
        // A correction that WROTE is a landing, and has to be recorded as one.
        // Until 2026-08-28 these branches set `saved` but left `landed` empty,
        // so the honesty note read the turn as a total miss and appended "that
        // entry didn't save" underneath a correction that had just succeeded -
        // telling someone their measurement was lost while it sat in the table.
        // A false "nothing was kept" is worse than the false "got it" this
        // module was built to stop: it invites a re-entry, and the re-entry is
        // a duplicate.
        for (const m of personal) attempt.landed.push(m.metric_name);
      } else if (correction.kind === 'measurement' && target) {
        // The row's current values, so a bare number can be judged against the
        // readings that actually exist on it before anything is written.
        const { data: targetRow } = await supabase
          .from('body_measurements')
          .select('weight_kg, body_fat_pct, muscle_kg')
          .eq('id', String(target.id))
          .eq('user_id', user.id)
          .maybeSingle();

        const { reading, ambiguous } = await logMeasurementFromText(
          supabase,
          user.id,
          message,
          undefined,
          String(target.id),
          targetRow ?? undefined
        );
        if (ambiguous) {
          // Nothing was written. The question is the whole outcome of the turn,
          // and it has to be the only thing the app says about it - an honesty
          // note underneath would answer a question it has just asked.
          correctionNote = whichReadingMessage(ambiguous.value, ambiguous.candidates);
        } else if (reading) {
          saved = { kind: 'measurement', summary: measurementSaveSummary(reading) };
          attempt.landed.push('reading');
        }
      } else if (correction.kind === 'food' && target) {
        // The entry as it stands, so the correction is applied to it rather than
        // substituted for it. See logFoodFromText's correctionOf.
        const { data: foodRow } = await supabase
          .from('food_logs')
          .select('raw_text')
          .eq('id', String(target.id))
          .eq('user_id', user.id)
          .maybeSingle();
        const updated = await logFoodFromText(
          supabase,
          user.id,
          message,
          undefined,
          String(target.id),
          typeof foodRow?.raw_text === 'string' && foodRow.raw_text.trim() ? foodRow.raw_text : undefined
        );
        if (updated.length > 0) {
          saved = { kind: 'food', summary: foodSaveSummary(updated) };
          attempt.landed.push('food');
        }
      } else if (target) {
        // Activity has no in-place update path: logActivityFromText can split
        // one message into several rows, so "replace row X" is not well
        // defined. Removing and re-logging is the honest equivalent, and it is
        // what the person asked for in substance.
        //
        // THE ORDER IS THE SAFETY PROPERTY. The delete used to run first. That
        // was survivable only while the re-log always wrote something: once the
        // duration gate landed (2026-09-03), logActivityFromText began
        // returning [] for a description with no duration in it - so a bare
        // activity name read as a correction deleted the row and put nothing
        // back. There is no transaction to roll that back, activity_logs has no
        // updated_at and no soft delete, so the row left no trace that it had
        // ever existed.
        //
        // Re-logging first costs a few seconds where both rows are present, and
        // buys the guarantee that the old row is only ever removed once its
        // replacement is genuinely in the table.
        const entries = await logActivityFromText(supabase, user.id, message);
        if (entries[0]) {
          await supabase.from(table).delete().eq('id', String(target.id)).eq('user_id', user.id);
          saved = { kind: 'activity', summary: activitySaveSummary(entries) };
          attempt.landed.push('activity');
        } else {
          // Nothing replaced it, so nothing is removed. The person asked to
          // change an activity and the app could not, and this is the only line
          // in the turn that knows it - the model wrote its reply before any of
          // this ran.
          correctionNote = needDurationNote();
        }
      }
      // No final `else`: every branch above either has its target or finds its
      // own. If none matched, nothing was touched and nothing is claimed - the
      // honesty note below is then the only thing that speaks, which is correct.
    } catch (err) {
      console.log('ASK-SELODIA CORRECTION FAILED:', err instanceof Error ? err.message : err);
    }
  }


  // A body measurement stated in text (build item 10c). Kept separate from the
  // food/activity branch below because it has no clarification loop and its own
  // failure mode: a message that reads like a weight but yields no usable
  // number saves nothing at all rather than writing an empty row.
  //
  // AND THE CLASSIFIER DOES NOT GET THE LAST WORD ON THIS (Ruth, 26 September
  // 2026: a thigh measurement "recorded in chat but did not actually get
  // logged"). `logIntent` has no value meaning waist or thigh, and its
  // instruction defined 'measurement' as a weight, a body fat or a muscle mass
  // - so 'none' was the obedient answer for a thigh, and 'none' runs nothing.
  // The writer below has always handled personal metrics; it was never asked.
  // See app/lib/stated-measurement.ts for why the guard is code and not a
  // prompt line.
  //
  // Only consulted when the model said 'none': a message already routed to food
  // keeps its route, which is what stops "chicken thighs, 200g" being read as a
  // tape measurement. And a correction is left alone, since it aims at a row
  // that already exists.
  let measurementIntent = result.logIntent === 'measurement';
  if (!measurementIntent && result.logIntent === 'none' && !correction) {
    try {
      measurementIntent = await statesATrackedMetric(supabase, user.id, message);
    } catch (err) {
      console.log('TRACKED METRIC GUARD FAILED:', err instanceof Error ? err.message : err);
    }
  }

  if (measurementIntent) {
    try {
      const measured = await saving('measurement', () =>
        logMeasurementFromText(supabase, user.id, message)
      );
      const { reading, personal, missedPersonal } = measured ?? {
        reading: null,
        personal: [],
        missedPersonal: [] as string[],
      };
      if (reading) {
        saved = { kind: 'measurement', summary: measurementSaveSummary(reading) };
        attempt.landed.push('reading');
      }
      // Personal metrics land independently of the scale half - "waist 70" with
      // no weight in it is a complete log. They are named individually in
      // `landed` so a partial miss can say which ones made it, rather than the
      // whole turn reading as one undifferentiated "reading".
      for (const m of personal) attempt.landed.push(m.metric_name);
      // AND WHAT DID NOT LAND. Until now this line had no counterpart: `missed`
      // was initialised empty at the top of the turn and never written to, so
      // save-honesty's partial-miss branch - the one whose comment reads "a
      // weight saves while a waist does not" - could never fire. A thigh whose
      // insert failed left `landed` holding only 'reading', which reads as a
      // clean save, and the turn went quiet.
      for (const name of missedPersonal) attempt.missed.push(name);
      // The toast says something either way. Its summary is the scale reading
      // when there is one, since that is the headline number; otherwise it names
      // what was actually kept.
      if (!saved && personal.length > 0) {
        // NOT 'measurement' (Ruth, 27 September 2026, item 3). A waist or a
        // thigh is not a scale reading, and calling both by one name is what
        // let a thigh log pull back the commentary from an earlier WEIGH-IN:
        // the app shows the latest interpretation after a 'measurement' save,
        // and the interpretation layer only ever reads body_measurements. She
        // logged "Thighs today 54cm" and got a word-for-word repeat of the
        // morning's weight reply, invented hard session and all.
        saved = { kind: 'personal_metric', summary: personalSaveSummary(personal) };
      }
    } catch (err) {
      console.log('ASK-SELODIA MEASUREMENT LOG FAILED:', err instanceof Error ? err.message : err);
    }
  }

  // Water and other zero-calorie drinks (Part Twelve). Kept out of the food
  // branch deliberately: a glass of water is not an entry in a food breakdown,
  // and folding it in would put one in every table.
  if (result.logIntent === 'hydration') {
    try {
      const entry = await saving('hydration', () => logHydrationFromText(supabase, user.id, message));
      if (entry) {
        saved = { kind: 'hydration', summary: hydrationSaveSummary(entry) };
        attempt.landed.push('water');
      }
    } catch (err) {
      console.log('ASK-SELODIA HYDRATION LOG FAILED:', err instanceof Error ? err.message : err);
    }
  }

  // SLEEP (2026-09-20), parsed in code like water: how long somebody slept is
  // a fixed fact, and the open-ended judgement - is this message about sleep at
  // all - is the one the model just made. A night that says nothing usable
  // ("didn't sleep much, anyway...") writes no row rather than an empty one,
  // and the honesty note then speaks for it.
  if (result.logIntent === 'sleep') {
    try {
      const entry = await logSleepFromText(supabase, user.id, message);
      if (entry) {
        saved = { kind: 'sleep', summary: sleepSaveSummary(entry) };
        attempt.landed.push('sleep');
      }
    } catch (err) {
      console.log('ASK-SELODIA SLEEP LOG FAILED:', err instanceof Error ? err.message : err);
    }
  }

  // CYCLE, SAID OUT LOUD (2026-09-21). "the chat should be able to fill it in
  // directly from just speaking."
  //
  // The model decided two things - that this is a cycle event, and which day
  // they meant - and readSpokenCycle refuses both if they come back wrong. A
  // date in the future or a year in the past is dropped to today rather than
  // written, because cycle length is arithmetic on these dates and one bad one
  // skews a prediction for months.
  //
  // NEITHER OF THESE IS AN INTENT (corrected the same evening). They were both
  // values of logIntent, which holds ONE value, so a sentence that was both -
  // "my period started Tuesday and I have been shattered ever since" - could
  // only ever be recorded as one, and the other was dropped in silence. Ruth
  // caught it from the description alone: "What's going to differentiate
  // feeling tired actually today, vs when logging period start day".
  //
  // They are independent facts now, each gated on its own field and dated by
  // its own field, exactly as a saved routine already was. A message can log a
  // meal, a period and a mood, and each lands on the day it belongs to.
  if (result.cycleEvent) {
    try {
      const event = readSpokenCycle(result, todayKey);
      if (event && (await writeCycleEvent(supabase, user.id, event))) {
        saved = alsoSaved(saved, 'cycle', cycleSaved(event, todayKey, spokenDayLabel));
        attempt.landed.push('cycle');
      }
    } catch (err) {
      console.log('ASK-SELODIA CYCLE LOG FAILED:', err instanceof Error ? err.message : err);
    }
  }

  // HOW A DAY FELT (2026-09-21). Her reason, kept where the code is: "catching
  // things like low mood always 2 days after cocktails eg, could genuinely be
  // unknown to a user and needs something to check if Ai says it."
  //
  // A measure nobody mentioned is not written. Saying they are shattered says
  // nothing about their mood, and filling the other column in would manufacture
  // exactly the record this exists to check against.
  if (result.feelingMood != null || result.feelingEnergy != null) {
    try {
      const felt = readSpokenFeeling(result, todayKey);
      // Every day the remark covers. One day for the ordinary case; a week for
      // "shattered ever since Tuesday", which is what she pointed out my own
      // example actually meant.
      const days = felt ? daysFrom(felt.day, felt.through) : [];
      if (felt && days.length > 0 && (await writeFeeling(supabase, user.id, felt, days))) {
        saved = alsoSaved(saved, 'feeling', feelingSaved(felt, todayKey, spokenDayLabel, wordForMeasure));
        attempt.landed.push('feeling');
      }
    } catch (err) {
      console.log('ASK-SELODIA FEELING LOG FAILED:', err instanceof Error ? err.message : err);
    }
  }

  // "RUN A REPORT ON ALL DAYS I DRANK COCKTAILS AND MY MOOD THE FOLLOWING DAYS"
  // (2026-09-21). Her question, asked in the same message that put mood back.
  //
  // THE APP COUNTS AND THE MODEL DESCRIBES, as with the report summary. Every
  // figure here is arithmetic on her own rows, computed before the reply is
  // even read, and the table is drawn from the stored numbers rather than from
  // anything the model wrote. A model asked to eyeball eleven nights against a
  // column of mood ratings will find a pattern, because that is what it is for.
  //
  // It never concludes. It lines the days up, says how many there were, says
  // plainly when there are too few to mean anything, and leaves the days that
  // do not fit the story in the table.
  let patternCheck: PatternResult | null = null;
  const wantsPattern = typeof result.patternTrigger === 'string' && result.patternTrigger.trim().length > 0;
  if (wantsPattern) {
    try {
      patternCheck = await runPatternCheck(supabase, user.id, {
        trigger: result.patternTrigger!.trim(),
        measure: result.patternMeasure === 'energy' ? 'energy' : 'mood',
        offsets: readOffsets(result.patternOffsets),
        today: todayKey,
      });
    } catch (err) {
      console.log('ASK-SELODIA PATTERN CHECK FAILED:', err instanceof Error ? err.message : err);
    }
  }

  // THE PARSE IS A SECOND MODEL CALL, AND ON A SPOKEN TURN IT IS NOT ON THE
  // CRITICAL PATH.
  //
  // A logging turn runs Sonnet for the reply and then a separate Haiku call to
  // parse the food or activity. In text that is fine - the toast and the
  // itemised table both need the parsed row before the response is useful. In
  // VOICE nothing needs it: there is no toast, no table, and the spoken answer
  // is already written. Measured end to end at ~5s against an ElevenLabs
  // cascade timeout of 4s, so removing a whole model call from the wait is the
  // single biggest thing available.
  //
  // `after` rather than a bare floating promise: on serverless the function can
  // be frozen the moment the response is sent, so a fire-and-forget parse would
  // simply never finish. after() is the platform's supported way to keep it
  // alive, and it still runs if the response errored.
  //
  // WHAT THIS COSTS, stated plainly: on a voice turn the app no longer knows
  // whether the parse succeeded before it answers, so it cannot tell the person
  // it failed. The honesty note is therefore suppressed for deferred turns
  // rather than left to claim "that didn't save" about something still saving.
  // A voice log that genuinely fails is now silent. That is a real regression
  // in honesty, accepted only because the alternative is voice not working.
  let deferredLog = false;

  // A SAVED ROUTINE IS A LOG WITHOUT A logIntent. The model is told to leave
  // logIntent 'none' when it sets workoutPlan, because a routine and an activity
  // entry would otherwise both be written for the same hour - so the gate has to
  // let it through on its own, or the branch below could never run at all.
  const saysDidPlan = typeof result.workoutPlan === 'string' && result.workoutPlan.trim().length > 0;

  // AND THE SAME THING SAID AS AN ACTIVITY (Ruth's item 8, 2026-09-28).
  //
  // She found "Full-Body Barbell Strength Plan" in Movement as an ACTIVITY whose
  // type was the plan's own name. The session writer exists, is correct, and was
  // never reached: the classifier is told to set workoutPlan and leave logIntent
  // 'none', and on that turn it set logIntent 'activity' with the plan's title as
  // the text instead.
  //
  // That is the thigh measurement again in a different tab - a correct writer
  // behind a router that did not choose it, failing intermittently because the
  // instruction is followed most of the time. Her own rule applies: a guard
  // belongs at the write. So the check is here, on the path the data actually
  // takes, rather than in the prompt where it can be missed again.
  //
  // choosePlan is deliberately strict - an exact title, or a single plan with
  // nothing contradicting it, or an unambiguous word overlap, and null on a tie.
  // Recording the wrong routine is worse than recording none.
  const activityNamesAPlan =
    !saysDidPlan && result.logIntent === 'activity'
      ? // STRICTER THAN THE DELIBERATE PATH, and the note on requireNameOverlap
        // says why: nothing here has decided a routine happened, so a match has
        // to come from the plan's own title rather than from her owning one plan.
        choosePlan(result.logText?.trim() || message, savedPlans, { requireNameOverlap: true })
      : null;
  if (activityNamesAPlan) {
    console.log(
      'ASK-SELODIA: an activity named a saved plan, writing a session instead —',
      JSON.stringify(activityNamesAPlan.title)
    );
  }

  if (result.logIntent === 'food' || result.logIntent === 'activity' || saysDidPlan || activityNamesAPlan) {
    const runLog = async () => {
      if (result.logIntent === 'food') {
        // logText carries the food itself when the model has separated it from
        // the rest of the message, exactly as it does for activity. Passing the
        // raw message is how "It's not gone into the log" ended up stored as a
        // meal on 2026-09-16.
        //
        // A spoken turn stamps its rows with itself, and only AFTER they have
        // saved is the sentence settled to one set of rows - see
        // lib/voice-supersede.ts. Save first, then tidy: a parse that fails
        // must never have removed anything.
        const voiceTurnId = isVoice ? userRow?.id ?? undefined : undefined;
        const entries =
          (await saving('food', () =>
            logFoodFromText(
              supabase,
              user.id,
              result.logText?.trim() || message,
              undefined,
              undefined,
              undefined,
              voiceTurnId
            )
          )) ?? [];
        if (voiceTurnId && entries.length > 0) {
          await settleVoiceSentence(
            supabase,
            voiceTurnId,
            message,
            entries.map((e) => e.id)
          );
        }
        // An empty result means the text held no food. Nothing is claimed: the
        // honesty note below says so rather than the reply pretending.
        if (entries.length > 0) {
          saved = { kind: 'food', summary: foodSaveSummary(entries) };
          attempt.landed.push('food');
          // The turn carries a REFERENCE to what it logged, so the client can
          // render the itemised table from food_items rather than from anything
          // the model wrote. See mobile/src/lib/food-breakdown-table.ts.
          //
          // ONLY FOR A SINGLE MEAL. A catch-up of seven days has seven rows and
          // no single table to show, and picking one of them would show that
          // day's breakdown under a reply about the week.
          // A DAY LOGGED AT ONCE STILL SHOWS WHAT WENT IN (2026-10-04).
          //
          // Ruth, after voice-logging a whole Saturday: "no summary table came
          // through in the chat to show what was logged."
          //
          // This was `entries.length === 1 ? entries[0].id : null`, on the
          // reasoning that a catch-up of seven days has no single table to show
          // and picking one would put that day's breakdown under a reply about
          // the week. The reasoning is right; the conclusion was not. Showing
          // NOTHING leaves her with a sentence claiming a save and no way to
          // check it - which is the failure this whole project keeps relearning.
          //
          // So the single-meal case is unchanged and still draws its itemised
          // table, and a turn that logged several now carries all of them for a
          // meal-per-row summary. The client reads the list from meta.
          breakdownFoodLogId = entries.length === 1 ? entries[0].id : null;
          breakdownFoodLogIds = entries.map((e) => e.id);
          // A new food log ends any prior clarification (that moment has passed);
          // then pin this log's own question, if the model asked one (slice 2a).
          await supabase
            .from('food_logs')
            .update({ clarification_pending: null })
            .eq('user_id', user.id)
            .not('clarification_pending', 'is', null);
          if (result.clarificationAsked && entries.length === 1) {
            await supabase
              .from('food_logs')
              .update({ clarification_pending: result.clarificationAsked })
              .eq('id', entries[0].id);
          }
        }
      } else if (saysDidPlan || activityNamesAPlan) {
        // A SAVED ROUTINE, RECORDED BY SAYING SO (Ruth, 2026-09-18). This runs
        // ahead of ordinary activity logging and instead of it: the session is
        // written from the plan's own movements, which carries the plan's
        // history and the movements themselves into the week - neither of which
        // an activity row built from a sentence can do.
        // Either the model named the plan, or the guard above recognised it in
        // what would otherwise have become an activity row.
        const plan = activityNamesAPlan ?? choosePlan(result.workoutPlan ?? '', savedPlans);
        if (!plan) {
          // NOTHING IS WRITTEN ON A GUESS. Recording the wrong routine is worse
          // than recording none, because the person is then told a session
          // happened that did not. Falls through to the ordinary activity path,
          // which at least stores what they actually said.
          console.log('ASK-SELODIA: no saved plan matched', JSON.stringify(result.workoutPlan));
          const entries = await logActivityFromText(
            supabase,
            user.id,
            result.logText?.trim() || message
          );
          if (entries[0]) {
            saved = { kind: 'activity', summary: activitySaveSummary(entries) };
            attempt.landed.push('activity');
          }
        } else {
          const skipped = Array.isArray(result.workoutSkipped)
            ? result.workoutSkipped.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
            : [];
          const additional = Array.isArray(result.workoutAdditional)
            ? result.workoutAdditional.filter(
                (x): x is string => typeof x === 'string' && x.trim().length > 2
              )
            : [];
          const logged = await recordPlanSession(supabase, user.id, plan, {
            skipped,
            additional,
            note: typeof result.workoutNote === 'string' && result.workoutNote.trim()
              ? result.workoutNote.trim()
              : null,
            today: todayISODate(),
          });
          if (logged === null) {
            // Already down for today. Said plainly rather than silently, because
            // the model has very likely replied as though it had just landed -
            // and during a voice call this is the ordinary case, not an error.
            correctionNote = `That one is already recorded for today, so I have left it as it was.`;
          } else if (logged > 0) {
            saved = { kind: 'activity', summary: sessionSummary(plan, logged, skipped) };
            attempt.landed.push('activity');
          }
        }
      } else {
        // logText carries the description assembled across turns, so the answer
        // to "how long was that?" logs the run rather than logging the answer.
        const entries =
          (await saving('activity', () =>
            logActivityFromText(supabase, user.id, result.logText?.trim() || message)
          )) ?? [];
        if (entries[0]) {
          saved = { kind: 'activity', summary: activitySaveSummary(entries) };
          attempt.landed.push('activity');
        } else {
          // The gate refused it: no duration, so no row. Without this the turn
          // fell through to unsavedNote's "didn't save for some reason", which
          // is true but vaguer than it needs to be - we know the reason, and
          // the fix is one number. Says it plainly, because the model has very
          // likely already replied as though the run were logged.
          correctionNote = needDurationNote();
        }
      }
    };

    if (isVoice) {
      deferredLog = true;
      after(async () => {
        try {
          await runLog();
        } catch (err) {
          console.log(
            'ASK-SELODIA DEFERRED LOG FAILED:',
            err instanceof Error ? err.message : err
          );
        }
      });
    } else {
      try {
        await runLog();
      } catch (err) {
        console.log('ASK-SELODIA SILENT LOG FAILED:', err instanceof Error ? err.message : err);
      }
    }
  }

  // Resolve a pending consistent-ratio clarification (build item 11, slice 2a):
  // the answer re-parses the enriched description into the pending log in place.
  // Recency-guarded so a late, unrelated answer can't rewrite an old entry, and
  // skipped when this turn is itself a new food log (that path handles its own).
  if (result.logIntent !== 'food' && result.clarificationResolved) {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: pending } = await supabase
      .from('food_logs')
      .select('id')
      .eq('user_id', user.id)
      .not('clarification_pending', 'is', null)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pending) {
      try {
        const updated = await logFoodFromText(
          supabase,
          user.id,
          result.clarificationResolved,
          undefined,
          pending.id
        );
        await supabase
          .from('food_logs')
          .update({ clarification_pending: null })
          .eq('id', pending.id);
        saved = { kind: 'food', summary: foodSaveSummary(updated) };
      } catch (err) {
        console.log('ASK-SELODIA CLARIFICATION RESOLVE FAILED:', err instanceof Error ? err.message : err);
      }
    }
  }

  // WHAT REACHED HER RECORD THIS TURN, noted by each writer at its own call
  // site. See lib/write-log.ts for why this is not a list assembled further
  // down: three writers were missing from that list and the app spent weeks
  // denying saves it had made.
  const writes = createWriteLog();
  // Allergy capture (item 42 part (b)). Fire-and-persist with no confirmation
  // turn and no toast: Part Twelve requires this to be captured conversationally
  // wherever it surfaces, and a "shall I remember that?" prompt would make
  // disclosure a small ceremony rather than something said in passing. Idempotent
  // on (user_id, name), so a repeat mention is silently the same row.
  if (Array.isArray(result.allergiesDisclosed) && result.allergiesDisclosed.length > 0) {
    // TOLERANT OF THE OLD SHAPE. This field was an array of strings until
    // 2026-09-28 and a turn already in flight during the deploy can still send
    // one. A bare string becomes a nameless-kind entry, which recordAllergies
    // resolves to 'other' - and 'other' filters food, so the old shape keeps
    // exactly the behaviour it had.
    const disclosed = result.allergiesDisclosed.map((a) =>
      typeof a === 'string' ? { name: a } : a
    );
    // KEPT, BECAUSE THE HONESTY GUARD HAS TO KNOW. recordAllergies returns the
    // names it stored and returns [] when the write failed, which is exactly the
    // distinction falseClaimNote needs and never had. See wroteThisTurn.
    const stored = await recordAllergies(supabase, user.id, disclosed, message);
    // AFTER the write, and only on what it actually stored: recordAllergies
    // returns [] when the insert failed, and a failed write must leave the log
    // untouched so the reply's claim is still contradicted.
    if (stored.length > 0) writes.record('allergy');
  }

  let savedContext: { category: string; content: string; autoSaved: boolean } | null = null;
  if (result.rememberCategory && result.rememberContent) {
    const category = result.rememberCategory;
    const content = result.rememberContent;

    const { data: existingCategory } = await supabase
      .from('user_context')
      .select('*')
      .eq('category', category)
      .limit(1);

    if (existingCategory && existingCategory.length > 0) {
      await supabase.from('user_context').insert({ user_id: user.id, category, content });
      savedContext = { category, content, autoSaved: true };
    } else {
      savedContext = { category, content, autoSaved: false };
    }
  }

  // Almanac save (build item 15): the model emits these only after the person
  // has agreed (confirm-first is enforced in the prompt), so persist on emit -
  // mirroring the [REMEMBER] write above. saveAlmanacEntry returns null on a
  // non-save or a failed insert, so we never claim a save that didn't happen.
  let savedAlmanac: { kind: string; title: string } | null = null;
  // The older emit-after-agreement path now serves PLANS ONLY. An insight,
  // symptom or note arriving here skipped the stored offer, so it is refused
  // rather than saved: the offer is the only way those types get in.
  const insightsKind = ['insight', 'symptom', 'note', 'roundup'].includes(
    (result.almanacKind ?? '').trim().toLowerCase()
  );
  if (insightsKind) {
    console.log('ASK-SELODIA REFUSED A DIRECT INSIGHTS SAVE:', result.almanacKind);
  }
  // MY RULES, ENFORCED BEFORE THE PLAN IS STORED (2026-09-28).
  //
  // SELODIA_SPEC.md has said since the Movement brief that this has to happen in
  // code and not only in the prompt, on the allergy gate's reasoning: a
  // contraindicated movement is an injury risk, and a prompt is a request.
  //
  // IT RUNS ON THE WAY IN, not on the way out, because unlike the allergy gate
  // this is not reading prose. The plan is structured - a list of exercises with
  // names and groups, in the app's own schema - so there is nothing to misread,
  // and a plan that breaks a rule must never be WRITTEN, not merely never shown.
  let ruleRemovalNote: string | null = null;
  if (result.almanacKind && result.almanacTitle && !insightsKind) {
    const content = result.almanacContent as { exercises?: unknown } | null | undefined;
    if (content && Array.isArray(content.exercises)) {
      const rules = await loadRules(supabase, user.id);
      const { kept, removed } = applyRules(content.exercises as PlanExercise[], rules);
      if (removed.length > 0) {
        console.log(
          `RULES GATE: removed ${removed.map((r) => `${r.exercise} (${r.rule})`).join(', ')}`
        );
        // The object is rebuilt rather than mutated: `result` is what the model
        // returned, and keeping it intact means the log of what was proposed
        // stays honest about what was proposed.
        result.almanacContent = { ...content, exercises: kept };
        ruleRemovalNote = removalNote(removed);
      }
    }
  }

  if (result.almanacKind && result.almanacTitle && !insightsKind) {
    const entry = await saveAlmanacEntry(
      supabase,
      user.id,
      {
        kind: result.almanacKind,
        title: result.almanacTitle,
        category: result.almanacCategory,
        content: result.almanacContent,
      },
      // The plan this conversation is about, when it is about one: a plan saved
      // during a talk anchored to a plan is an edit of it (2026-09-20).
      provisionalTag?.entryType === 'plan' ? provisionalTag.entryId : null
    );
    if (entry) savedAlmanac = { kind: entry.kind, title: entry.title };
  }

  // THE CONVERSATIONAL SAVE (Insights slice 2, 2026-09-12). See pending-save.ts.
  //
  // Order matters, as with Focus: an ANSWER to an outstanding offer is settled
  // before anything new, so "yes, and note that I slept badly" keeps the first
  // thing rather than losing it to the second.
  let saveNote: string | null = null;
  // Whether an offer was stored this turn, so the app asks it. See
  // offerQuestion in pending-save.ts for why the question is the app's.
  // A change to an existing Me card, stated by the app once it is real.
  let meNote: string | null = null;
  if (result.meUpdate && typeof result.meUpdate.title === 'string' && result.meUpdate.title.trim()) {
    const outcome = await updateMeCard(supabase, user.id, {
      title: result.meUpdate.title,
      status: result.meUpdate.status,
      reason: result.meUpdate.reason,
      today: todayISODate(),
    });
    meNote = meUpdateNote(outcome);
    if (outcome.kind === 'updated') writes.record('me card');
  }

  // SOMETHING INTO HER WEEK, ON HER SAYING SO (2026-10-01). Applied here rather
  // than offered, because "add french class on thursday night at 7pm" is an
  // instruction and not something the app noticed. See app/lib/week-entry.ts for
  // the probe that settled it.
  let weekNote: string | null = null;
  // Kept so the reply path can ask whether its own words have already covered it.
  let weekOutcome: WeekEntryOutcome | null = null;
  if (result.weekEntry && typeof result.weekEntry.activity === 'string' && result.weekEntry.activity.trim()) {
    weekOutcome = await addWeekEntry(supabase, user.id, result.weekEntry);
    weekNote = weekEntryNote(weekOutcome);
    if (weekOutcome.kind === 'added' || weekOutcome.kind === 'already') writes.record('week entry');
    console.log('WEEK ENTRY:', JSON.stringify({ outcome: weekOutcome.kind, raw: result.weekEntry }));
  }

  let offered = false;
  // Which tab the outstanding offer is for, so the question names it. Defaults
  // to 'note', which asks about the Almanac, because that is what every offer
  // did before Me existed.
  let offeredType: SaveType = 'note';
  if (pendingSave.proposal && (result.saveAnswer === 'yes' || result.saveAnswer === 'no')) {
    if (result.saveAnswer === 'yes') {
      // A YES CAN CARRY AN INSTRUCTION, and it used to be discarded. See
      // applyRedirect: "yes, perhaps under skincare and allergies" is an answer
      // and a destination, and the destination arrived after the type was fixed.
      const destined = applyRedirect(pendingSave.proposal, result.saveRedirect);
      const kept = await commitSave(supabase, user.id, destined);
      saveNote = saveAppliedNote(kept, true);
      if (kept) savedAlmanac = kept;
    }
    // Cleared either way. A failed save is said plainly and not left pending,
    // or the next turn would ask about an offer she has already said yes to.
    await clearPendingSave(supabase, user.id);
  } else {
    // A note she ASKED for is kept on the spot: the request is the yes.
    const note = prepareNote(result.noteText);
    if (note) {
      const kept = await commitSave(supabase, user.id, note);
      saveNote = saveAppliedNote(kept, true);
      if (kept) savedAlmanac = kept;
    } else {
      // AN OFFER SHE HAS MOVED PAST IS NOT WAITING FOR AN ANSWER (2 October 2026).
      //
      // THE EXACT FAILURE. At 13:47 chat offered to keep Ruth's muscle up as an
      // insight. She never answered it. At 18:32 she typed "Add a muscle up", the
      // model correctly proposed a SKILL, and the app threw it away - because the
      // branch here read `!pendingSave.proposal` and an offer had been waiting for
      // three hours and fifty-two minutes. The model then said "Done." and she was
      // told her muscle up was already on her Skills list. Nothing had been
      // written. That is the third time today she has been told something was
      // saved when it was not.
      //
      // TWO JOBS WERE SHARING ONE WINDOW. PENDING_TTL_HOURS is 48, and for its
      // own job that is defensible: it decides how long a "yes" may still be
      // applied to the thing that was offered. For deciding whether to make a NEW
      // offer it is badly wrong - one unanswered question gags the app for two
      // days.
      //
      // SO A TURN THAT DOES NOT ANSWER IT ENDS IT. Reaching this branch means the
      // model set no saveAnswer, which the prompt defines precisely: "a new topic,
      // a log, a different question - is NOT an answer". She moved on, so the
      // question is over. It is cleared here and a new offer may be stored on this
      // same turn, because making her ask twice for something she just asked for
      // is the behaviour this is fixing.
      //
      // The yes-handling above is untouched: an answer is still an answer, and
      // still applies to what was offered.
      if (pendingSave.proposal) {
        await clearPendingSave(supabase, user.id);
        console.log(
          'PENDING SAVE: dropped unanswered —',
          JSON.stringify({ type: pendingSave.proposal.type, title: pendingSave.proposal.title })
        );
        pendingSave = { proposal: null, askedAt: null };
      }

      // A new offer is stored only when none is waiting: one question at a time.
      const proposal = coerceProposal(result.proposedSave);
      // WHY AN OFFER DID NOT HAPPEN, recorded rather than inferred.
      //
      // Ruth's skincare save failed three times and each diagnosis was a
      // deduction from absence: no pending_save row, therefore something
      // upstream. That is how an afternoon goes. These two facts separate the
      // two possibilities in one line - the model never proposed, or it
      // proposed something the app refused - and neither is visible anywhere
      // else.
      if (result.proposedSave || /\bme\b/i.test(message ?? '')) {
        console.log(
          'SAVE OFFER:',
          JSON.stringify({
            modelProposed: Boolean(result.proposedSave),
            coerced: Boolean(proposal),
            type: proposal?.type ?? null,
            raw: result.proposedSave ? JSON.stringify(result.proposedSave).slice(0, 400) : null,
          })
        );
      }
      // AT MOST ONE OFFER PER CONVERSATION (Ruth, item 3c). A 'me' card is a
      // decision she has actually made and is exempt - those arrive at a
      // decision moment and are the point of the tab. What is rate-limited is
      // the app noticing something and asking to keep it, which is the shape
      // that turned a cold into an Almanac prompt.
      //
      // A WEEK ENTRY IS EXEMPT FOR THE SAME REASON, AND THE PROBE PROVED WHY
      // (2026-10-01). "add french class on thursday night at 7pm" is not the app
      // noticing anything. It is an instruction. The rate limit treated it as a
      // suggestion and dropped it, and because the model had already asked the
      // question in its own words, the next turn's "yes" was answered with
      // "French class, Thursday, 7pm - on your week now" over an empty table.
      //
      // That is the failure she has twice told me destroys trust: the app
      // telling her it has her data when it has not. Rate-limiting a direct
      // instruction cannot be right - a limit on pestering must not become a
      // limit on doing as she asks.
      const askedFor = proposal && (proposal.type === 'me' || proposal.type === 'week');
      // AND IF THE REPLY ALREADY ASKED, THE OFFER IS STORED REGARDLESS.
      //
      // The limit exists so she is not pestered. Once the model's own words have
      // asked the question, the pestering has already happened, and declining to
      // store the offer does not undo it - it only guarantees that her answer
      // goes nowhere. Of the two bad outcomes, an extra offer she can say no to
      // is much the smaller.
      //
      // offerQuestion's own test is reused deliberately: the thing that decides
      // the app's question is redundant is the right thing to decide the reply
      // has made a promise.
      const replyAlreadyAsked = proposal !== null && offerQuestion(replyText, proposal.type) === null;
      const tooSoon =
        proposal && !askedFor && !replyAlreadyAsked && (await offeredRecently(supabase, user.id));
      if (proposal && !tooSoon) {
        offered = await storePendingSave(supabase, user.id, proposal);
        if (offered) offeredType = proposal.type;
      }
    }
  }

  // A deletion is stated by the app, not by the model. The prompt tells it not
  // to claim it has changed anything, precisely so a failed delete can never be
  // reported as done - this line only exists when the row is genuinely gone.
  // A correction that silently failed is the same defect as a silent log - the
  // reply has already said something reassuring either way. A delete states its
  // own outcome through correctionNote, and a missing target is handled above,
  // so only the update path needs routing into the honesty check.
  if (correction && correction.action === 'update' && saved === null) {
    attempt.intent = correction.kind;
  }

  // What the app knows about the person's data, stated by the app. The model
  // composed its reply before any of this ran, so it cannot have known - see
  // save-honesty.ts for the live failure that made this necessary.
  //
  // AT MOST ONE OF THESE MAY SPEAK. They are computed independently, and on
  // 2026-08-27 both did: a single reply carried "that's updated now" from the
  // model, then "I can't find a measurement recent enough to change", then "it
  // looks like that entry didn't save" - three answers to one question, two of
  // them wrong, on a turn whose data had in fact been stored. Where both have
  // something to say, correctionNote wins: it is the more specific of the two,
  // it knows which kind of thing was being changed, and it is the only one that
  // can explain WHY nothing happened rather than merely reporting that nothing
  // did. The honesty note is the fallback for every turn that had no correction
  // in it at all.
  // Suppressed on a deferred turn: the parse has not run yet, so "that didn't
  // save" would be a statement about something still in progress - the exact
  // false claim this note exists to prevent, pointing the other way.
  const honestyNote =
    correctionNote === null && !deferredLog ? unsavedNote(attempt) : null;

  // PUTTING SOMETHING BACK. The model picked an id out of the list above; the
  // app does the writing and states the result, which is the same split every
  // other write in this route follows - a fact about her stored data is the
  // app's to state, never the model's to promise.
  let restoreNote: string | null = null;
  if (typeof result.restoreId === 'string' && result.restoreId.trim()) {
    const outcome = await recoverDeleted(supabase, user.id, result.restoreId.trim());
    restoreNote = recoverNote(outcome);
  }

  // FOCUS CAPTURE: infer, then confirm (2026-09-09).
  //
  // Order matters. An ANSWER to an outstanding offer is handled before a new
  // proposal, so "yes, and actually make it muscle too" resolves the first
  // question rather than being overwritten by the second.
  let focusNote: string | null = null;
  const answer = result.focusAnswer;

  if (pendingFocus.askedAt && (answer === 'yes' || answer === 'no')) {
    if (answer === 'yes') {
      focusNote = focusAppliedNote(await applyPendingFocus(supabase, user.id, profile, pendingFocus));
    } else {
      // A no is not a maintain. It clears the offer and changes nothing, because
      // declining a suggested deficit does not mean asking to hold steady.
      await clearPendingFocus(supabase, user.id);
    }
  } else {
    const proposedFat = coerceFocus(result.proposedFatFocus);
    const proposedMuscle = coerceFocus(result.proposedMuscleFocus);
    // Only store a proposal that would actually change something. Offering to
    // set somebody to the state they are already in is a question with no
    // consequence, and answering it would restart nothing and mean nothing.
    const fatChanges = proposedFat && proposedFat !== profile?.fat_focus_state ? proposedFat : null;
    const muscleChanges =
      proposedMuscle && proposedMuscle !== profile?.muscle_focus_state ? proposedMuscle : null;
    if (fatChanges || muscleChanges) {
      await storePendingFocus(supabase, user.id, fatChanges, muscleChanges);
    }
  }

  // The consolidation offer, and its answer.
  //
  // Recorded as asked on the turn it goes out, whatever the person then says -
  // including nothing. Part Eleven asks once, and an offer to stop using the app
  // that reappears until it is answered is not an offer.
  if (consolidation.eligible) await markConsolidationOffered(supabase, user.id);

  if (result.consolidationAnswer === 'solo') {
    await enterLiteMode(supabase, user.id);
  } else if (result.consolidationAnswer === 'keep_logging') {
    await declineConsolidation(supabase, user.id);
  }

  // UNSAFE-GOAL HANDLING (item 43, Part Twelve's Cross-Cutting Safety Principle).
  //
  // The model reported a number; the arithmetic decides. See goal-safety.ts for
  // why the judgement is deterministic rather than a prompt instruction.
  //
  // REGENERATING THE REPLY IS THE AWKWARD PART AND IS UNAVOIDABLE. The model
  // wrote its answer before anything here knew the goal was unsafe, so that
  // answer may already be coaching toward the number - which is the exact harm.
  // A canned replacement would be safe and cold; the spec asks for kind, and
  // kind has to be written in context. So the turn is re-run with the
  // instruction included, and ONLY the reply text is taken from it: everything
  // else the first call decided - what was logged, corrected, saved - is
  // untouched by the goal and must not be recomputed.
  //
  // The second call costs a full turn's latency, on the rare turn where somebody
  // states a goal below a safe range. That is the right place to spend it.
  let goalSafeReply = replyText;
  let goalResourceCard: typeof resourceCard = null;
  const goalAssessment = assessGoalWeight(result.statedGoalWeightKg, profile?.height_cm);

  if (goalAssessment.verdict === 'unsafe') {
    console.log('UNSAFE GOAL: stated goal sits below a safe range for their height');
    try {
      const reconsidered = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 2000,
        system: contextualSystemPrompt + goalSafetyPrompt(goalAssessment, null),
        messages,
        tools: [tool],
        tool_choice: { type: 'tool', name: CLASSIFY_TOOL_NAME },
      });
      const block = reconsidered.content.find((b) => b.type === 'tool_use');
      const redone = block && block.type === 'tool_use' ? (block.input as { reply?: string }) : null;
      if (reconsidered.stop_reason !== 'max_tokens' && redone?.reply?.trim()) {
        goalSafeReply = redone.reply.trim();
      }
    } catch (err) {
      // FAILS CLOSED, unlike the allergy gate's fourth layer. If the rewrite
      // cannot happen the original reply cannot go out, because the thing we
      // could not check is whether it coaches toward a dangerous number.
      console.log('UNSAFE GOAL: rewrite failed, using the plain refusal —', err);
      goalSafeReply =
        "That's not a number I'm able to help you aim for. I'm still here for " +
        'everything else though - log away as normal and ask me anything.';
    }

    if (shouldOfferResource(goalAssessment, profile?.unsafe_goal_flagged_at)) {
      goalResourceCard = {
        title: RESOURCES.Beat.name,
        description:
          'Support and information around food, weight and body image, for anyone who wants it.',
        org: RESOURCES.Beat.name,
        url: RESOURCES.Beat.url,
      };
    }

    // Stamped whether or not a card went out, because the stamp also governs the
    // standing instruction on later turns. Non-blocking: a failed write must not
    // cost the person their reply.
    if (!profile?.unsafe_goal_flagged_at) {
      const { error: stampError } = await supabase
        .from('user_profile')
        .upsert({ user_id: user.id, unsafe_goal_flagged_at: new Date().toISOString() });
      if (stampError) console.log('UNSAFE GOAL: stamp failed —', stampError.message);
    }
  }

  // THE ALLERGY FILTER GATE (item 42, part c). Runs on what the model actually
  // said, not on what it was told - the prompt block in allergies.ts is
  // awareness and says so itself, and a long session can truncate it away.
  //
  // Placed here, after every trailing note is decided but before any of it is
  // shown or stored, so a blocked reply is never written to chat_messages. If
  // it were stored, the next turn would read it back as context and the model
  // would believe it had suggested the thing it was stopped from suggesting.
  //
  // Costs nothing for anybody with no declared allergies, which is most people.
  timing.mark('sideEffectsDone');
  const gate = await runAllergyGate(
    anthropic,
    goalSafeReply,
    disclosedAllergies,
    result.suggestsFood === true
  );
  // The correction and honesty notes survive a block: they are statements about
  // what the app DID with their data, still true and still owed to them, and
  // dropping them would trade one honesty problem for another.
  const safeReplyText = gate.safe ? goalSafeReply : blockedSuggestionMessage(gate.allergen);

  // ── WHERE THE NEW CHAT PATH GOES IN (Ruth, 27 September 2026, points 1 and 4) ──
  //
  // These seven notes are statements about what the app DID with her data, and
  // until now every one of them was glued onto the end of a reply the model had
  // already written. That is two authors in one message, and it is the whole
  // mechanism behind the reply that told her an entry had both saved and not
  // saved: the model wrote "that's logged fine" and the app appended "it looks
  // like that entry didn't save".
  //
  // Point 4 is that they go IN INSTEAD, before anything is written, so one voice
  // says all of it once. See app/lib/chat-path.ts for the switch.
  // RED FLAGS (2026-09-28). SAFETY_ARCHITECTURE.md §10, layer 2.
  //
  // OFF UNTIL A CLINICIAN HAS READ THE LIST - RED_FLAGS_LIVE is false. Ruth
  // approved the list as provisional, pending advisor review before public
  // launch, so the code is on main and covered by its checks rather than
  // rotting on a branch, and turning it on is one line.
  //
  // ACUTE DISTRESS WINS, ALWAYS. If the turn carries an escalation step or a
  // distress classification, the safety machine owns it completely and this is
  // suppressed. Two safety mechanisms speaking in one message is the failure
  // that produced the "logged fine / did not save" reply, in a far worse place.
  //
  // IT READS WHAT SHE SAID, not what the model wrote. The allergy gate reads
  // output because it is stopping the app suggesting something; a red flag is
  // about what she has told us.
  let redFlagNote: string | null = null;
  if (
    RED_FLAGS_LIVE &&
    nextEscalationStep == null &&
    // The cast is because the constant is a one-element `as const` tuple, so
    // its `includes` only accepts 'neutral'. Widened rather than the array,
    // because narrowing NON_DISTRESS_CLASSIFICATIONS is what makes the
    // classify tool's own type safe.
    (NON_DISTRESS_CLASSIFICATIONS as readonly string[]).includes(nextClassification)
  ) {
    const hit = matchRedFlag(message ?? '');
    // ONCE, AND NOT AGAIN. Somebody who has been told and has not gone has made
    // a decision, and the app's job is not to keep asking.
    if (hit && !(await alreadyRaised(supabase, user.id, hit.flag.key))) {
      redFlagNote = hit.line;
      await recordRaised(supabase, user.id, hit.flag.key);
      console.log(`RED FLAG: ${hit.flag.key} (${hit.flag.urgency})`);
    }
  }

  // WHAT GENUINELY REACHED HER DATA THIS TURN. `landed` covers the log
  // writers; the notes below it are each written by a path that only speaks
  // after its own write succeeded, so their presence is evidence of one.
  // WHAT REACHED HER RECORD, read from the log rather than from a list.
  //
  // This WAS a hand-assembled array, and it was missing the allergy write, the
  // week write and the remembered detail - so every correct claim about any of
  // the three was answered with "that did not save". Sardines was in her
  // allergies the whole time it was being denied.
  //
  // The entries still here are the ones whose writers report success through a
  // note rather than through the log; each is a single source of truth for its
  // own write, which is the same property, reached a shorter way. Anything new
  // records itself at its own call site. See lib/write-log.ts.
  const wroteThisTurn = [
    ...attempt.landed,
    ...writes.all(),
    ...(planNote ? ['plan'] : []),
    ...(restoreNote ? ['restored entry'] : []),
    ...(focusNote ? ['focus'] : []),
    ...(saveNote ? ['saved note'] : []),
    ...(savedContext ? ['remembered detail'] : []),
  ];
  const alreadySpoke =
    correctionNote !== null || honestyNote !== null || deferredLog === true;
  const falseClaimedNote = alreadySpoke
    ? null
    : falseClaimNote({ reply: safeReplyText, wrote: wroteThisTurn });

  const appendedNotes = [
    // FIRST IN THE LIST, because if anything here is going to be read it is
    // this one, and a line about calling 999 does not belong under a note about
    // an Almanac save.
    redFlagNote,
    planNote,
    correctionNote,
    restoreNote,
    focusNote,
    saveNote,
    meNote,
    weekNote,
    // WHAT A RULE TOOK OUT IS SAID, NOT HIDDEN (2026-09-28). A session that
    // quietly comes back two movements shorter teaches her the app is
    // unreliable; one that names the rule teaches her the rule is working,
    // which is the only reason to have written it down.
    ruleRemovalNote,
    honestyNote,
    // THE REPLY MAY NOT CLAIM A WRITE THAT DID NOT HAPPEN (2026-09-30).
    //
    // save-honesty above speaks when a writer TRIED and failed. This speaks
    // when nothing tried at all and the reply said it had - which is the
    // peanut butter turn of 29 September, where "Two spoons of peanut butter
    // added to the yoghurt bowl, noted" met a database in which nothing was
    // written between 20:22 and 20:27. No writer ran, so no writer threw, so
    // that module correctly stayed silent.
    //
    // Last in the list and suppressed whenever anything above it already
    // spoke: two corrections in one reply is the coffee loop, and one honest
    // sentence is worth more than two competing ones.
    falseClaimedNote,
  ].filter((line): line is string => typeof line === 'string' && line.length > 0);

  let replyBody = safeReplyText;
  let notesStillToAppend = appendedNotes;

  // NEVER OVER A REPLY THE SAFETY ARCHITECTURE CHOSE (2026-09-28).
  //
  // The first version of this switch ran on every turn the ALLERGY gate passed,
  // and `gate.safe` is about allergens. It is not the only place the app takes
  // the words out of the model's hands on purpose, and the others matter more:
  //
  //   - When the C-SSRS screen fires, applySafetyStateMachine replaces the reply
  //     with DIRECT_ESCALATION_QUESTION, a FIXED question, and its own comment
  //     says the reply is overridden "so a probing question can never co-occur
  //     with a card". Rewriting that is not a tone change, it is removing a
  //     screening question from a screening turn.
  //   - Any distress tier carries an escalation step, a revisit count and
  //     possibly a resource card, and its reply is written under the full
  //     conduct block with all of that in front of it. The rebuilt prompt
  //     carries the safety block and one sentence about not being a clinician.
  //     That is right for an ordinary turn and it is not this architecture.
  //
  // So the condition is a WHITELIST of ordinary-ness, not a blacklist of harms:
  // a neutral classification, no escalation step, no resource card, no allergy
  // block. A tier added later is excluded until somebody decides otherwise,
  // which is the right way round here.
  const ordinary = turnIsOrdinary({
    allergyGateSafe: gate.safe,
    resourceCard,
    goalResourceCard,
    escalationStep: nextEscalationStep,
    classification: nextClassification,
    nonDistress: NON_DISTRESS_CLASSIFICATIONS,
  });

  // A SPECULATIVE REPLY FOR A TURN THAT TURNED OUT NOT TO BE ORDINARY is paid
  // for and thrown away, which is the deal. It cannot reject - the writer catches
  // everything and returns a reason - but it is consumed explicitly so nobody
  // later wonders whether a promise was left dangling on a distress turn.
  if (spokenReplyInFlight !== null && !ordinary) {
    void spokenReplyInFlight.then(() =>
      console.log('ASK-SELODIA: spoken reply written ahead was discarded - the turn was not ordinary')
    );
  }

  if (newPathWrites(isVoice) && ordinary) {
    // THE SPECULATIVE REPLY IS ONLY USABLE IF THE ASSUMPTION HELD. It was
    // written before the saves ran, with didLines empty, so it is right exactly
    // when the turn turned out to have nothing to report. If anything did - a
    // failed save, a correction, a deletion - it is discarded and the writer runs
    // again with the facts, which costs the sequential time on that turn and is
    // the correct trade: a reply missing the one thing she needed to know is the
    // failure this entire rebuild exists to prevent.
    const speculationHeld = spokenReplyInFlight !== null && appendedNotes.length === 0;
    if (spokenReplyInFlight !== null && !speculationHeld) {
      console.log(
        `ASK-SELODIA: spoken reply written ahead was discarded - ${appendedNotes.length} thing(s) to report`
      );
    }

    // COMMITTED. Everything that could have replaced these words has now had
    // its say: the turn is ordinary, the guess held so there is nothing to
    // report, and the allergy gate could not arm on this account. What is left
    // to happen to the reply is the offer line, which is APPENDED - so the words
    // already spoken are a prefix of the stored reply rather than a draft of it.
    if (mayStream && speculationHeld) {
      timing.mark('spokenAloudFrom');
      sink.open();
    }

    timing.mark(speculationHeld ? 'speculationHeld' : 'speculationDiscarded');
    const written = speculationHeld
      ? await spokenReplyInFlight
      : await writeReplyAfterSaves({
          anthropic,
          model: MODEL,
          // Already ends with her current message: turn_context reads the
          // history after her turn is inserted. See the note at that read.
          messages,
          data: {
            food: recentFood ?? [],
            activity: recentActivity ?? [],
            dailyBurn: recentDailyBurn ?? [],
            drinks: recentDrinks ?? [],
            sleep: recentSleep ?? [],
            measurements: recentMeasurements ?? [],
            lastPeriodStart: lastPeriodRow?.event_date ?? null,
            // Three days spoken, seven typed - the same window the reads used,
            // so the facts cannot describe a week the query never fetched.
            days: isVoice ? 3 : 7,
            // TODAY'S TARGETS, which this call had never been given. The block
            // was computed for the classify call and the writer - which writes
            // every reply on this path - never saw it, so "what should I eat for
            // the rest of today?" was answered by the half of the pipeline that
            // did not know what was left of the day.
            today: buildDayStatePrompt(dayState),
            usuallyEats,
          },
          voice: isVoice,
          didLines: appendedNotes,
          safetyBlock: SAFETY_PROMPT_BLOCK,
          // THE BLOCKS THE WRITER HAD NEVER BEEN GIVEN (2026-09-30).
          //
          // `extraBlocks` exists on this call for exactly this - its own
          // comment says "context blocks the old path built that the new
          // prompt still needs" - and nothing was ever passed to it. So the
          // model that writes every reply on this path had never seen her Me
          // tab, her saved plans or her insights.
          //
          // That is the whole of Ruth's "chat will not write to Me". She
          // pasted three skincare products and was told "none of this is in
          // your record", which was TRUE from where the model sat: the record
          // it was given has food, movement, water, sleep, measurements and
          // cycle, and nothing else. It was obeying the baseline instruction
          // to say only what the record shows.
          extraBlocks: [meFactsBlock, lifeStageBlock, weekBlock, skillBlock, feelBlock],
        });
    // WHAT THE WRITER COST, whether it worked or not. A fallback is the most
    // expensive turn on this route - this call's tokens, and then the old path's
    // reply on top of them - so leaving the failures out of the cost table would
    // hide exactly the turns worth finding.
    recordModelUsage({ userId, turnId, call: 'reply', model: MODEL, usage: written.usage });

    // A failure here is a fallback, not a lost turn: the old path's reply is
    // already sitting in safeReplyText with its notes ready to append.
    // DISCRIMINATED ON fellBack, not on the text being truthy: the success branch
    // types text as string, so an empty one would not narrow and both branches
    // would look possible to the compiler. The reason is the discriminant.
    if (written.fellBack === null) {
      // THE NEW REPLY GOES THROUGH THE ALLERGY GATE TOO (2026-09-28).
      //
      // This was a hole and it was mine. The gate above runs on the OLD path's
      // reply, and `turnIsOrdinary` only asks whether THAT one passed. Then this
      // branch replaces it with a sentence the gate has never seen. For anybody
      // with a declared food allergy, every reply the rebuilt path wrote was
      // ungated - the check was being done on a draft that was then thrown away.
      //
      // It short-circuits to safe for anybody with no edible exclusions, which is
      // most people, so this costs nothing on nearly every turn. When it does
      // run, the trade is plain: a second Haiku call against suggesting somebody
      // a dish that will hurt them.
      const reGate = await runAllergyGate(
        anthropic,
        written.text,
        disclosedAllergies,
        result.suggestsFood === true
      );
      if (reGate.safe) {
        // NOTHING MACHINE-SHAPED REACHES HER. See stripMachineOutput: on 30
        // September her reply opened with a proposedSave object because I had
        // handed the writer a block that told it to emit one.
        // MACHINE OUTPUT OUT, THEN THE MODEL'S SAVE CLAIMS OUT.
        //
        // The prompt has forbidden "that's saved" since 27 September and the
        // model keeps writing it. Removing the sentence is better than
        // appending a contradiction: on 30 September she got "That's saved to
        // your Me tab." and "nothing was saved" in one message, which is two
        // voices disagreeing about her own record.
        //
        // Whatever the app actually did is stated by the app, below.
        // stripDisavowal added 30 September, 2:27pm on her phone: "I don't
        // control that, only the app does... I'm not able to check what's
        // actually stored there." She is the app and the record was in front of
        // it. See DISAVOWALS in claimed-write.ts.
        replyBody = unescapeNewlines(
          stripDisavowal(stripSaveClaims(stripMachineOutput(written.text)))
        );

        // AND THE CLAIM GUARD BELONGS HERE, ON THE PATH THAT WRITES HER REPLY.
        //
        // It was computed further up against the OLD path's text, which on this
        // path does not exist - so it has been dead since the switch. That is
        // why "That's saved to your Me tab" went out at 11:32 with nothing
        // written: the guard built for exactly that sentence was looking at the
        // wrong reply.
        //
        // Recomputed here against what she will actually read.
        // THE APP'S OWN SENTENCE, and only the app's.
        //
        // A save that worked is announced by saveNote/meNote, which are built
        // from the write result. A claim the model made that did NOT happen has
        // already been removed above, so the honest note is only needed when
        // something was genuinely attempted and lost - which is what
        // falseClaimNote still covers for the cases the strip cannot see.
        const liveClaim = falseClaimNote({ reply: written.text, wrote: wroteThisTurn });
        notesStillToAppend = [
          ...(saveNote ? [saveNote] : []),
          ...(meNote ? [meNote] : []),
          // AND THE WEEK LINE, for the same reason the other two are here -
          // unless the reply has already said it, which on a turn that is
          // nothing but the instruction it usually has. See weekNoteNeeded.
          //
          // The writer is told a save that worked is not news BECAUSE the app
          // prints its own confirmation. Leaving weekNote out of this list broke
          // the other half of that bargain: the writer was told to stay quiet and
          // nothing then spoke. It only looked right in the probe because her
          // message was nothing but the instruction, so the model had nothing
          // else to answer and said it anyway. On "add french class on thursday
          // at 7pm, and how's my protein?" she would have got the protein and no
          // word about her week at all.
          ...(weekNote && (!weekOutcome || weekNoteNeeded(written.text, weekOutcome))
            ? [weekNote]
            : []),
          ...(liveClaim ? [liveClaim] : []),
        ];
      } else {
        // THE NOTES SURVIVE A BLOCK, same as above and for the same reason: they
        // are statements about what the app DID with her data, still true and
        // still owed to her. They were woven into the blocked reply, so they go
        // back to being appended rather than being lost with it.
        console.log(`ASK-SELODIA: the rebuilt reply was blocked by the allergy gate - ${reGate.allergen}`);
        replyBody = blockedSuggestionMessage(reGate.allergen);
        notesStillToAppend = appendedNotes;
      }
    } else {
      // RECORDED WHERE IT CAN BE COUNTED, not only logged. The console line goes
      // to Vercel, which is not somewhere the question "how often is this
      // happening?" can be answered from. Fire-and-forget: a failure to record a
      // fallback must never become a second failure on the same turn.
      console.log(`REPLY PATH FALLBACK: ${written.fellBack} - ${written.detail}`);
      void supabase
        .from('reply_path_fallbacks')
        .insert({
          user_id: user.id,
          reason: written.fellBack,
          detail: written.detail,
          voice: isVoice,
          turn_id: turnId,
        })
        .then(({ error }) => {
          if (error) console.log('REPLY PATH FALLBACK NOT RECORDED:', error.message);
        });
    }
  }

  // THE OFFER IS NOT JUST ANOTHER NOTE, so it is recomputed rather than passed
  // in. It is a question that must be asked exactly once: an offer stored and
  // never asked leaves her yes to something else able to answer it. Whichever
  // path wrote the reply, offerQuestion() returns null if that reply already
  // asks, and the app's own line otherwise.
  timing.mark('replyWritten');
  const offerLine = offered ? offerQuestion(replyBody, offeredType) : null;
  const trailingLines = [...notesStillToAppend, offerLine].filter(
    (line): line is string => typeof line === 'string' && line.length > 0
  );
  // AN EMPTY BODY CONTRIBUTES NO BLANK LINES (2026-10-01).
  //
  // Once "Kept in your Me tab, under Medications." was added to the save-claim
  // strip, a reply whose WHOLE content was that one sentence came back empty -
  // correctly, it was a claim the model had no business making - and the join
  // then produced "\n\nKept in your Almanac, under Me.", which arrives on her
  // phone as a message that starts with a gap.
  //
  // The app's own line is a complete and honest confirmation on its own, so the
  // answer is to let it stand as the whole reply rather than to put the claim
  // back.
  const body = replyBody.trim();
  const finalReply =
    trailingLines.length > 0
      ? [body, trailingLines.join('\n\n')].filter(Boolean).join('\n\n')
      : body;

  timing.mark('allergyGateDone');
  // ONE REPLY PER TURN, ENFORCED BY THE DATABASE (Ruth, 27 September 2026).
  //
  // A duplicate pair of ASSISTANT rows was written at 09:24 that morning, after
  // two earlier fixes had shipped - and it survived both because it is a
  // different shape. Saturday's work stopped the APP sending one turn twice,
  // and the server's twin check matches on USER rows. Neither sees two replies
  // to a single user turn.
  //
  // The path is the voice adapter's own documented fallback: when a turn
  // arrives twice and the first copy has not answered yet, the second copy runs
  // the turn itself rather than speaking an error. That trade is deliberate and
  // still right - losing what she said is worse than a repeat - but nobody
  // considered that both copies then write an answer.
  //
  // So the rule moves somewhere neither copy can be wrong about it. Each reply
  // carries the id of the turn it answers, and a partial unique index makes a
  // second one impossible.
  //
  // PARTIAL, so the rows that legitimately answer nothing still write - the
  // weekly roundup, a photo acknowledgment - because Postgres allows many NULLs
  // in a unique index. That is the whole reason this is a column rather than a
  // constraint on content.
  //
  // AND A PLAIN INSERT, NOT AN UPSERT (fixed 2026-09-28, and this is the second
  // half of the story).
  //
  // The first version used `.upsert(..., { onConflict: 'answers_id',
  // ignoreDuplicates: true })`, which becomes ON CONFLICT (answers_id) DO
  // NOTHING. Postgres cannot infer a PARTIAL index from that - the statement
  // carries no matching WHERE clause - so it raised 42P10, "there is no unique
  // or exclusion constraint matching the ON CONFLICT specification", on EVERY
  // call rather than only on a conflict.
  //
  // This block logs a write failure and carries on, deliberately, because a
  // failed write must never cost somebody their reply. The cost of that
  // deliberate choice was three of Ruth's replies: they reached her phone and
  // were never stored. The first was seven minutes after the commit deployed.
  //
  // The index was verified when it was applied. The CALL SITE was not, and one
  // statement run against the real index would have shown it in ten seconds.
  //
  // A unique violation (23505) here is the loser of the race, which is a no-op
  // and not a failure: the reply already exists and the person has it. Anything
  // else is real and still gets logged.
  const { error: insertError } = await supabase
    .from('chat_messages')
    .insert(
      {
        // NEVER NULL ON A CHAT REPLY. See where turnId is minted: this is what
        // makes the one-reply-per-turn index actually cover this route.
        answers_id: turnId,
        user_id: user.id,
        role: 'assistant',
    // What was actually shown, including any deletion line. Storing replyText
    // instead would leave the model unaware on the next turn that an entry it
    // can no longer see was removed at its own request.
        content: finalReply,
        source: 'chat',
        // Tagged alongside the user turn so pulling one entry's history back
        // out yields both halves of the exchange, not a column of unanswered
        // questions.
        discuss_entry_id: resolvedTag?.entryId ?? null,
        discuss_entry_type: resolvedTag?.entryType ?? null,
        classification: nextClassification,
        escalation_step: nextEscalationStep,
        distress_revisit_count: nextRevisitCount,
        food_log_id: breakdownFoodLogId,
        // ONLY WHEN THERE IS MORE THAN ONE. A single meal already travels in
        // food_log_id and draws the itemised table; writing meta as well would
        // give the client two sources for one answer.
        ...(breakdownFoodLogIds.length > 1
          ? { meta: { food_log_ids: breakdownFoodLogIds } }
          : {}),
      }
    );
  // 23505 is the partial unique index doing its job: another copy of this turn
  // already wrote the reply. Expected, and not a failure.
  if (insertError && insertError.code !== '23505') {
    console.log('ASK-SELODIA ASSISTANT TURN INSERT FAILED:', insertError.code, insertError.message);
  } else if (insertError) {
    console.log('ASK-SELODIA: reply already written for this turn, second copy did nothing');
  }

  // Only surface the disclaimer when the model flagged health-informed guidance
  // AND the person actually has stored health context - never a phantom.
  const healthGuidanceApplied =
    hasHealthContext(healthContext) && result.healthGuidanceApplied === true;

  // NEVER INVENT A CONTROL, enforced rather than asked for. An id that is not
  // exactly one the app knows becomes null here, and the reply goes out as plain
  // words - which it has to stand up as anyway, since the person may be on a
  // different screen entirely. A pointer to a control that is not there would
  // send someone hunting and leave them thinking they had missed it.
  const navigationTarget = isSpotlightTarget(result.navigationTarget)
    ? result.navigationTarget
    : null;
  if (result.navigationTarget && !navigationTarget) {
    console.log('ASK-SELODIA DROPPED UNKNOWN SPOTLIGHT TARGET:', result.navigationTarget);
  }

  // WHAT WAS ACTUALLY STORED, handed to the sink so it can say the rest - which
  // is the offer line when there is one, and nothing at all when there is not.
  // Called on every turn, including the ones that never opened it, because a
  // sink nobody closes is an adapter waiting forever.
  sink?.finish(finalReply);

  timing.report(isVoice ? 'voice' : 'typed');
  // AND KEPT. The console line goes to Vercel, which on this tier retains
  // nothing - it is a live stream and no history, so a question asked an hour
  // later cannot be answered. Twice on 28 September that stopped an
  // investigation. See app/lib/turn-diagnostics.ts.
  recordTurnTiming({ userId, turnId, voice: isVoice, marks: timing.taken() });

  return NextResponse.json({
    // Absent unless a caller asked, so nothing in the app ever sees this field.
    ...(request.headers.get('x-selodia-timing') ? { timings: timing.taken() } : {}),
    reply: finalReply,
    navigationTarget,
    savedContext,
    savedAlmanac,
    resourceCard: resourceCard ?? goalResourceCard,
    healthGuidanceApplied,
    saved,
    foodLogId: breakdownFoodLogId,
    foodLogIds: breakdownFoodLogIds.length > 1 ? breakdownFoodLogIds : undefined,
    // The days something happened beside how they felt afterwards, drawn as a
    // real table beneath the reply from these stored figures. Null on every
    // turn that did not ask for one.
    patternCheck,
    // The phone schedules it and says so. Null unless this turn asked for one.
    reminder: reminderResult,
    // What the conversation is anchored to AFTER this turn, or null when the
    // discussion has ended. The phone shows it above the message box with a
    // Close, and only while it is set, so it never offers to close a topic that
    // has already let go.
    discussEntry: resolvedTag
      ? { id: resolvedTag.entryId, name: await discussEntryName(supabase, resolvedTag) }
      : null,
    // Voice only: they asked to end the call. The adapter says the reply and
    // then hangs up. Always false for a typed message.
    endVoiceSession: isVoice && result.endVoiceSession === true,
  });
}
