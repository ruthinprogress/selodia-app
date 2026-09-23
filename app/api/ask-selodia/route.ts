import { after, NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseForRequest } from '../../lib/supabase';
// Describes the app's screens, tabs and controls so the model can point
// somebody at where a thing lives. About 2,100 tokens, and OMITTED ON A SPOKEN
// TURN: nobody in a voice conversation is looking at the screen, the
// fourth-wall rule already forbids narrating the interface, and it was the
// single largest block of prompt that a spoken exchange cannot use. Text turns
// keep it in full.
import { APP_STRUCTURE_PROMPT_BLOCK, VOICE_CONDUCT_BLOCK } from '../../lib/app-structure';
import { needDurationNote, unsavedNote, type LogAttempt } from '../../lib/save-honesty';
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
import {
  answerWrittenAfter,
  earlierTwin,
  settleVoiceSentence,
} from '../../lib/voice-supersede';
import { logActivityFromText } from '../../lib/activity-logging';
import {
  choosePlan,
  loadPlans,
  recordPlanSession,
  sessionSummary,
} from '../../lib/workout-session';
import { todayISODate } from '../../lib/workout-logs';
import { meUpdateNote, updateMeCard } from '../../lib/me-update';
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
import { buildAllergyPrompt, loadAllergies, recordAllergies } from '../../lib/allergies';
import { blockedSuggestionMessage, runAllergyGate } from '../../lib/allergy-gate';
import { assessGoalWeight, goalSafetyPrompt, shouldOfferResource } from '../../lib/goal-safety';
import { buildDayStatePrompt, loadDayState } from '../../lib/daily-targets';
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
  clearPendingSave,
  coerceProposal,
  commitSave,
  offerQuestion,
  type SaveType,
  pendingSavePrompt,
  prepareNote,
  readPendingSave,
  saveAppliedNote,
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
  loadPendingCardImage,
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

export async function POST(request: NextRequest) {
  const supabase = getSupabaseForRequest(request);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const {
    message,
    cardImageBase64,
    cardMediaType,
    entryId,
    entryType,
    voice,
    supersedes,
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

  const { data: userRow, error: userInsertError } = await supabase
    .from('chat_messages')
    .insert({
      user_id: user.id,
      role: 'user',
      content: message,
      source: 'chat',
      image_path: cardImagePath,
      discuss_entry_id: provisionalTag?.entryId ?? null,
      discuss_entry_type: provisionalTag?.entryType ?? null,
    })
    .select('id')
    .maybeSingle();
  if (userInsertError) {
    console.log('ASK-SELODIA USER TURN INSERT FAILED:', userInsertError.message);
  }

  // THE SAME TURN, TWICE AT ONCE - voice only. See earlierTwin in
  // lib/voice-supersede.ts. The later copy writes nothing - no model call, no
  // log - and answers with what the first copy says, so the voice hears one
  // reply, and its own row is removed so the thread shows the turn once. If the
  // first copy never answers (it failed), this copy runs the turn itself rather
  // than speaking an error: a failure must not take its retry down with it.
  const twin = isVoice ? await earlierTwin(supabase, userRow?.id ?? null, message) : null;
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

  // Every read below is independent of the others, so they go out together
  // rather than as eight sequential round trips. Each one previously cost its
  // own latency before the model call had even started.
  //
  // ORDER STILL MATTERS in one direction: this batch must run AFTER the user
  // turn is inserted, because recentHistory has to include the message just
  // sent. The previous-tag read above must run BEFORE it, or it would read the
  // row being written. Only the mutual independence within this batch is new.
  const [
    { data: lastAssistantTurn },
    { data: recentHistory },
    { data: contextRows },
    { data: recentFood },
    { data: recentActivity },
    { data: recentDailyBurn },
    { data: recentDrinks },
    { data: recentSleep },
    { data: recentMeasurements },
    { data: healthContextRow },
    { data: lastPeriodRow },
    { data: yesterdaySummary },
    { data: profileRow },
    disclosedAllergies,
  ] = await Promise.all([
    supabase
      .from('chat_messages')
      .select('classification, escalation_step, distress_revisit_count')
      .eq('user_id', user.id)
      .eq('source', 'chat')
      .eq('role', 'assistant')
      // Read-hardening: only safety-classified turns carry escalation state. Skip
      // pure logging turns (classification null, e.g. the photo/direct food-log
      // path) so a food log dropped mid-escalation cannot null out an active
      // C-SSRS ladder by simply being the most recent assistant row.
      .not('classification', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Descending + limit to get the most recent 40, then reverse to
    // chronological order - ascending + limit would take the OLDEST 40
    // instead, silently dropping the just-inserted current turn once the
    // conversation passes 40 messages and leaving the array ending on an
    // assistant turn, which the model rejects outright. (Confirmed as the
    // real cause of onboarding-chat's 500s, via live Vercel logs - this
    // route shares the identical bug, just hadn't hit 40 messages yet.)
    supabase
      .from('chat_messages')
      .select('role, content')
      .eq('user_id', user.id)
      .eq('source', 'chat')
      .order('created_at', { ascending: false })
      .limit(40),
    supabase.from('user_context').select('*').order('category', { ascending: true }),
    supabase
      .from('food_logs')
      // Only the four fields the summary below reads. select('*') pulled every
      // column of every row for a week and then used four of them.
      .select('happened_at, raw_text, kcal, protein_g')
      .gte('happened_at', contextSince.toISOString())
      .order('happened_at', { ascending: false }),
    supabase
      .from('activity_logs')
      // eccentric_load and intensity joined the select on 2026-09-09. They were
      // classified at log time (item 27) and then never read here, so the prompt
      // could see THAT somebody trained but not whether it was the kind of
      // training that makes legs hurt two days later - which is the whole
      // question a symptom query is asking.
      .select('happened_at, activity_type, duration_min, kcal_burned, eccentric_load, intensity')
      .gte('happened_at', contextSince.toISOString())
      .order('happened_at', { ascending: false }),
    // Whole-day tracker totals, kept in their own table and their own context
    // line because they are not sessions. These used to arrive inside
    // activity_logs as an activity called "Daily Summary", which read to the
    // model as a single 1063 kcal workout and was narrated back to the person
    // as one.
    supabase
      .from('daily_activity_summaries')
      .select('date, steps, kcal_burned, active_kcal, active_minutes, distance_km')
      .gte('date', contextSince.toISOString().slice(0, 10))
      .order('date', { ascending: false }),
    // WATER (2026-09-19). Logged since the hydration card was built and read
    // nowhere, so "how much have I drunk this week?" had nothing behind it and
    // a day's drinking could not be connected to anything else. Every drink
    // with its time, totalled per day below.
    supabase
      .from('hydration_logs')
      .select('ml, happened_at')
      .gte('happened_at', contextSince.toISOString())
      .order('happened_at', { ascending: false }),
    // SLEEP (2026-09-20). A symptom is a result, and the night before it is
    // one of the few things that explains fatigue, low mood or a heavy session
    // going badly - so it belongs beside the food and the training, not in a
    // table nobody reads.
    supabase
      .from('sleep_logs')
      .select('night_of, duration_min, quality, awakenings')
      .gte('night_of', contextSince.toISOString().slice(0, 10))
      .order('night_of', { ascending: false }),
    supabase
      .from('body_measurements')
      .select('measured_at, weight_kg, body_fat_pct')
      .gte('measured_at', contextSince.toISOString())
      .order('measured_at', { ascending: false }),
    supabase.from('health_context').select('*').maybeSingle(),
    supabase
      .from('cycle_events')
      .select('event_date')
      .eq('event_type', 'period_start')
      .order('event_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Yesterday's stored summary (Part Nine, next-morning mechanism). Read on
    // every turn rather than only on a measurement, because the spiral this
    // exists to pre-empt can start with "I feel huge today" just as easily as
    // with a number.
    supabase
      .from('daily_summaries')
      .select('summary_date, mediating_factor')
      .not('mediating_factor', 'is', null)
      .order('summary_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Item 43. Height to assess a stated goal against, and whether an unsafe one
    // has already been raised - which decides both the one-time resource and the
    // standing instruction below.
    supabase
      .from('user_profile')
      .select(
        'height_cm, unsafe_goal_flagged_at, date_of_birth, biological_sex, ' +
          'activity_level, fat_focus_state, muscle_focus_state, protein_target_g, ' +
          'pending_fat_focus, pending_muscle_focus, pending_focus_asked_at, ' +
          'fat_focus_since, muscle_focus_since, consolidation_offered_at, lite_mode_since, ' +
          'pending_save, pending_save_asked_at'
      )
      .maybeSingle(),
    // Not a { data } shape - loadAllergies returns the rows directly. Positional
    // destructuring above, so it stays last.
    loadAllergies(supabase),
  ]);

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
      content: m.content as string,
    }));

  // FOUR READS, ONE WAIT (2026-09-23). These were four separate awaits in a row
  // immediately after the Promise.all above, and none of them needs anything
  // from the others: saved plans, insight titles, Me cards, pending card. Timed
  // against the real database they cost 275ms one after another and 149ms
  // together, so more than a third of this stretch was the route waiting on
  // itself. Anything added here belongs in this batch, not after it.
  //
  // What each one is for:
  //  - THEIR OWN SAVED ROUTINES, by name, so "I did the gym workout today" can
  //    find the plan it means (2026-09-18).
  //  - WHAT IS ALREADY IN HER INSIGHTS (2026-09-19). Without this the model
  //    could not know a knee flare had been recorded the day before, so it
  //    offered it again as a second symptom - and could never notice that
  //    something keeps coming back, which is exactly when a symptom becomes
  //    worth an insight. Titles, kinds and dates only; the newest few, because
  //    a long list of old entries is a prompt about things the conversation is
  //    not about.
  //  - HER ME CARDS, by name and current status, so "I've stopped the
  //    magnesium" can name the card it means. Titles only: the why stays in the
  //    card, and quoting every reason on every turn would be a long prompt
  //    about decisions the conversation is not about.
  //  - The card image reaches the model exactly ONCE (decision, 2026-08-21):
  //    re-sending it every turn would charge vision tokens for the rest of the
  //    conversation to no benefit, since the reply it produces is already in
  //    the text history. Attached to the newest user turn so "this" is
  //    unambiguous.
  const [savedPlans, { data: insightRows }, { data: meRows }, pendingCard] = await Promise.all([
    loadPlans(supabase, user.id),
    supabase
      .from('almanac_entries')
      .select('kind, title, created_at')
      .eq('user_id', user.id)
      .in('kind', ['symptom', 'insight'])
      .order('created_at', { ascending: false })
      .limit(15),
    supabase
      .from('almanac_entries')
      .select('title, category, content')
      .eq('user_id', user.id)
      .eq('kind', 'me'),
    loadPendingCardImage(supabase, user.id),
  ]);

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
          "Here is what is in their Me tab - their personal protocol - by name, with where each one currently stands. When they tell you one of these has CHANGED, set meUpdate (see that field):",
          ...(meRows ?? []).map((r) => {
            const c = (r.content ?? {}) as Record<string, unknown>;
            const status = typeof c.status === 'string' ? c.status : null;
            return `- ${r.title}${r.category ? ` (${r.category})` : ''}${status ? `: ${status}` : ''}`;
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

  const contextText = contextRows && contextRows.length > 0
    ? contextRows.map((c) => c.category + ': ' + c.content).join('\n')
    : 'No stored context yet.';

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
  } | null;

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
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayState = await loadDayState(supabase, profile, dayStart.toISOString());

  const foodSummary = recentFood && recentFood.length > 0
    ? recentFood.map((f) => humanDate(f.happened_at) + ': ' + f.raw_text + ' (' + f.kcal + 'kcal, ' + f.protein_g + 'g protein)').join('\n')
    : 'No food logged in the last 7 days.';

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

  const measurementSummary = recentMeasurements && recentMeasurements.length > 0
    ? recentMeasurements.map((m) => humanDate(m.measured_at) + ': weight ' + m.weight_kg + 'kg, body fat ' + m.body_fat_pct + '%').join('\n')
    : 'No body measurements in the last 7 days.';

  const SYSTEM_PROMPT = `You are Selodía, a calm, grounded companion inside a food/fitness tracking app. You are NOT a coach, a cheerleader, or a report generator. Never refer to yourself by name in conversation: you introduced yourself once on the welcome screen, and the person knows where they are. Your tone is steady and validating, not peppy or upbeat - closer to a thoughtful friend who listens carefully than someone hyping the person up. Avoid exclamation marks, emojis, and enthusiastic language ("Ouch!", "amazing!", "love that"). Speak plainly and warmly instead. Never use bullet points, headers, or long structured breakdowns unless specifically asked for a list. One or two short paragraphs is usually enough. When relevant, naturally reference their recent logged activity or data and ask if anything needs adjusting - that instinct is good, just deliver it calmly rather than energetically. Classify most ordinary conversation (food, activity, logistics, general chat) as neutral.

${EVIDENCE_PRINCIPLE}

Here is what you know about this person (their stored context, facts, goals, diagnoses, preferences):
${contextText}

Here is their food log from the last 7 days:
${foodSummary}
${buildDayStatePrompt(dayState)}

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
${plansBlock}${meCardsBlock}${insightsBlock}
${allergyBlock}${healthContextBlock ? `\n${healthContextBlock}\n` : ''}${cycleContextBlock ? `\n${cycleContextBlock}\n` : ''}${yesterdayBlock ? `\n${yesterdayBlock}\n` : ''}
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
A plain result (a number the data already shows, like a 5-day trend) or a one-off observation that connects to nothing is neither, and is never offered. A NOTE is anything they explicitly ask you to note or log as a note ("log a note: I feel really good today"). There is no offer for a note, because asking is the yes: set noteText to their words exactly as they said them, never rewritten or embellished, and do not say it is saved. Offer one thing at a time, never the same thing twice, and never turn a passing remark into an offer. Whatever is kept is observed, not graded: a title or summary describes what they said and never praises, warns or scores it.\nA ME CARD is the fourth type, and it goes to a different tab. Me is their personal protocol - the stable reference for how they are trying to live: supplements, skincare morning and night, a dietary decision, a meditation habit, a standing weekly call with a friend. THE TRIGGER IS A DECISION MOMENT, when a conversation moves from working something out to having settled it: "my mood dips in winter, what could I do?" turning into vitamin D3 being decided on; a supplement ordered; a routine adopted; a commitment made. Not an idea they are still turning over, and not something they merely mentioned doing. Set proposedSave with type 'me', a short title that is the thing itself ("Vitamin D3", "Evening skincare", "Weekly call with a friend"), and content as {"section": ..., "why": ..., "status": ..., "detail": ...}. **section** is where it belongs, in one or two words - Nutrition, Supplements, Skincare, Wellbeing, Relationships, or a new one if none of those fits; sections come into being by the first card arriving in them. **why** is the reason it was decided, drawn from the conversation you have just had, in plain language and without praise - this is the whole point of the card, because these are the boring-but-important things that are easy to drop when the reason has been forgotten. **status** only where it means something, and ONLY one of: Taking, Ordered, Dietary source, As needed, Active, Paused. A supplement has a status; a skincare routine or a weekly call is Active or has none. **detail** is optional, for their own words or a value they quoted - quote a number, never interpret it. Never invent a why; if nothing in the conversation settled a reason, there was no decision moment and there is nothing to save.\nWHEN SOMEBODY STATES A DECISION WITHOUT ITS REASON - "I've started taking D3", "I'm doing magnesium at night now", "I've swapped to a new evening routine" - DO NOT set proposedSave yet and do not let it pass either. ASK, once, warmly and in one short question, for what is missing: what it is for, and how they are taking it if that is not obvious. "Oh, is that for the winter dips, or something else? And is it daily?" Then, on the turn where they answer, set proposedSave with the why in their own terms. A protocol card is worth one question, because the reason IS the card: months later the name alone tells them nothing about whether to keep going. Ask about one thing at a time, never interrogate, and if they brush the question off, let it go rather than asking again.\nWHEN SOMETHING ALREADY IN THEIR ME TAB CHANGES - "I've stopped taking magnesium, it wasn't helping", "I've paused the retinol while my skin settles", "I'm back on the D3" - set meUpdate with the card's title as it appears in their Me tab, the new status (only one of: Taking, Ordered, Dietary source, As needed, Active, Paused), and the reason in their own words. Do NOT offer first: telling you they have stopped something IS the instruction. Do not claim in your reply that the card is updated - the app changes it and tells them itself. Nothing is ever deleted from Me; stopping something pauses it, and the reason is kept.\n(2) PLANS you have genuinely worked out together (a routine, a movement plan, a meal or drink plan) are still saved the older way. **Confirm first, always:** ASK whether to keep it ("Want me to save this to your Almanac?"), and set almanacKind/almanacTitle/almanacContent ONLY after they agree - never without a yes. Use an open, natural word for almanacKind (e.g. "routine", "movement plan"), a short almanacTitle, and almanacCategory only when a natural grouping exists. Never use almanacKind for an insight, a symptom or a note.\nFOR A WORKOUT OR MOVEMENT PLAN specifically, almanacContent takes this shape: {"programType": string, "goal": string, "exercises": [{"name": string, "group": string, "sets": number, "reps": string, "safetyNote": string, "eccentricLoad": "none"|"low"|"moderate"|"high", "intensity": "light"|"moderate"|"intense"}]}. Notes on each: **programType** describes the kind of program in your own words (e.g. "general strength", "rehab", "skill practice") - it decides how the plan is grouped, so be accurate rather than inventive. **group** is the grouping key and its meaning follows programType: a body area for general strength, the skill being learned for skill practice, and it can be omitted for rehab, which shows as a flat list. **reps** is a STRING so you can write what is actually true - "8-10", "30s", "AMRAP", "12 per side" - never round it to a bare number if that loses meaning. **sets and reps are decided per person and per goal from what you have discussed** - a rep range for building muscle is not the range for rehab or endurance - never a fixed default per exercise. **safetyNote is required for every exercise and must name the real common failure modes of that specific movement** - what actually goes wrong and what it feels like when it does - never generic boilerplate like "use good form" or "warm up first". **eccentricLoad** is how much eccentric (lengthening-under-load) work the movement involves, which is what drives delayed-onset soreness; **intensity** is its typical effort level. Set both from the movement itself. Do NOT put working weights or completed sessions in the plan - those are logged separately, and writing them here would overwrite the history that progressive overload depends on.

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

CORRECTIONS: When the person is fixing or removing something they JUST logged rather than logging something new, set correctionKind and correctionAction instead of logIntent - see those fields. The app performs it and tells them itself, so do not claim in your reply that you have changed or deleted anything; acknowledge naturally and move on. If you cannot tell whether they mean to correct a value or remove the entry, set neither and simply ask. When they say something went in more than once, set correctionScope to 'duplicates' so all the copies go together rather than one per turn.

ACTIVITY NEEDS A DURATION BEFORE IT IS LOGGED. An activity with no duration cannot be stored honestly: the length is what every calorie figure is computed from, so logging "a run" means inventing how long it lasted and then showing the person a number built on the invention. When someone mentions activity without saying how long, do not log it. Ask how long, warmly and in one short question, and log it on the turn they answer - setting logIntent to 'activity' then, and passing the full description in logText. Never re-ask something they have already told you, and never treat their answer as a second, separate activity.

CATCHING UP ON PAST DAYS. Somebody can hand you several days at once - "catch up my food log: Mon 7th pizza and chips, Tuesday 8th burger and beer, Weds 9th Turkish feast". Set logIntent 'food' and put all of it in logText, with the days as they said them; the app splits it into one entry per day and dates each one. Do not ask them to repeat it a day at a time, and do not say it is logged in a way that lists what you think went in - the app tells them what actually landed. The same holds for activity. If a day is genuinely ambiguous, log the rest and ask about that one.

SUGGESTING SOMETHING TO EAT (build item 22). When somebody asks what to have - at home, out, ordering in, staring at a fridge - answer it properly, using TODAY SO FAR above so the suggestion actually fits their day rather than being generic advice.

Say the number only when it earns its place. "You've got about 700 left, so something substantial is fine" is useful. Reciting a macro budget at somebody deciding on dinner is the tracker-app register this app exists to avoid, and most of the time the number should shape WHAT YOU SUGGEST without being said out loud at all.

Suggest, never prescribe. Two or three real options in a sentence or two, the way a friend answers - not a numbered meal plan, not a macro table, and never a single correct answer handed down. If they have said what they fancy or where they are, work from that; if they have not, ask one light question rather than guessing at a cuisine.

NO FOOD IS GOOD OR BAD and nothing is a treat, a cheat, a reward or something to earn or make up for. If what they want does not fit the numbers especially well, that is fine and usually not worth mentioning - a day is not a budget to balance to zero, and somebody who wanted chips and got a lecture will simply stop asking.

If there is no calorie target above, suggest from what they have logged, the time of day and what they have told you, and do not mention targets at all. Never invent a number, and never say what a target "would be".

A SYMPTOM IS A RESULT, SO READ WHAT CAUSED IT BEFORE ANSWERING. When the person mentions a physical symptom - an ache, soreness, stiffness, fatigue, low energy, bloating, poor sleep, feeling heavy or off - go and read the LOGGED ACTIVITY AND FOOD ABOVE FOR THE PREVIOUS ONE TO TWO DAYS before you say anything about it, and answer from what is actually there.

Delayed soreness peaks 24-48 hours after the session that caused it, so yesterday matters more than today - and the entries carry intensity and eccentric load precisely because eccentric work is what produces it. If the log explains the symptom, say so specifically and name the session: "the 40kg deadlifts and 90 minutes of ballet yesterday" is an answer; "a heavier session in the last day or two" is the same sentence with the answer removed.

If the log genuinely does not explain it, say that plainly and ask - never reach for a generic cause to fill the gap. Being told "nothing in your log obviously accounts for that" is useful; being told something vague that could be true of anybody is not, and the person cannot tell the difference between not being able to look and not bothering to.

ONLY WHAT IS ACTUALLY THERE. Every specific in your reply has to come from what the person said in this conversation or from the logged data above. Do not supply details they did not give: not a distance, a pace, a route, a location, a weight, or how hard something felt. Someone who said "60mins" has not told you they went further than usual, so asking how the longer distance felt is a question about a run that does not exist - and what it teaches them is that the app is not really reading what they wrote. If a detail would be useful, ask for it; never assume it and never imply they mentioned it.

Their logged history above is still yours to draw on, with two conditions. Place it in time rather than folding it into now: yesterday's ballet is yesterday's, and "all this running plus ballet" hands someone a week as though it were a day they just had. And bring it in only when it genuinely bears on what they have just said - a log is not an invitation to summarise their week back at them.

ACKNOWLEDGE, DO NOT EVALUATE. A logged session is a fact, not a result. Never praise a number for being bigger, never call something a step up, progress, a good week, a solid effort or an improvement, and do not compare it favourably or unfavourably against what they did before unless they have asked you to. "A 60 minute run logged - that's a good step up in time" makes the longer run the better run, which is exactly the scoring this app exists without: it turns a shorter run tomorrow into a failure nobody named. Acknowledge what they told you, respond to what they said about it, and leave the number itself alone. If they pass their own judgement on it, you can meet them there - that verdict is theirs to make, never yours to award.

WHAT CAN BE LOGGED HERE. If somebody asks what they can log, what this is for, or how any of it works, answer completely rather than naming the one or two things that come to mind. Everything goes through this conversation: food and drink, activity and exercise, body measurements including weight, body fat and muscle, anything else they measure such as a waist or a resting heart rate, water, how they are feeling, and photographs - a plate, a scale readout, a treadmill display, a nutrition label. Free text is the point: there is no format to learn, no fields to fill, and nothing has to be phrased a particular way. Say it warmly and in a sentence or two, the way you would tell a friend what you can help with, never as a bulleted feature list or a tour of the app.

LOGGING INTENT: Set logIntent to 'food' if the message describes something the person ate or drank, 'activity' if it describes physical activity or exercise they did, 'measurement' if it states a body measurement they have taken (a weight, a body fat percentage, a muscle mass), 'hydration' ONLY when the drink has NO CALORIES IN IT - plain or sparkling water, black coffee, black tea, herbal or fruit tea, sugar-free squash. ANY DRINK CARRYING CALORIES IS FOOD, not hydration: tea or coffee with milk, anything with sugar, honey or syrup in it, a latte, a hot chocolate, juice, a smoothie, milk, a fizzy drink, alcohol. Beware of "a mug of tea" and "a cuppa", which in British usage mean tea WITH MILK unless they say otherwise - that is food. "Green tea", "peppermint tea" and "black tea" are not. When you genuinely cannot tell whether there was milk in it, ask rather than guess; the calories are small but they are wrong every cup, all day. Nothing is lost by choosing food: the app records the volume of any drink as water in the same pass.  'sleep' if it describes how they slept - how long, what time they went to bed or woke, how it felt, how often they woke - or 'none' otherwise - INDEPENDENT of the safety classification (a genuine distress disclosure can also be a food/activity log). The app saves the data and shows the person a brief save confirmation itself, separately from your reply, so NEVER write a "Logged: ..." line, a macro breakdown, or any "I've saved that" text yourself. AND NEVER LIST BACK WHAT WENT IN. Not "the almonds and the coffee are logged as food and the litre of water is in too" - you do not know what landed, the app does, and a sentence like that one told somebody her water was recorded on a day it was lost. Water and other drinks mentioned alongside food are handled by the app in the same pass; say nothing about them either way. For a plain food/activity log with nothing more to it, a short, warm, natural reply is right (a friend's easy acknowledgement), never a functional receipt. When a food log is itemised, the app renders the full breakdown as a real table beneath your reply, from the stored data - so do not restate the items, do not announce the table, and do not comment on what it shows; your reply is to what the person SAID, and the table speaks for itself. When you classify a genuine-distress tier (eating_related_distress, grief_related_distress, acute_crisis) for a message that also logs food or activity, give the complete care-first response to the emotional content only; you may, as genuine care, gently note there is no pressure to keep logging while they are feeling like this, but only woven in naturally as care, never as a saving confirmation.

${isVoice ? VOICE_CONDUCT_BLOCK : APP_STRUCTURE_PROMPT_BLOCK}

${SAFETY_PROMPT_BLOCK}`;

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
  const CAPABILITIES = `
WHAT THIS APP CAN DO TODAY. Be accurate about this: claiming a feature that does not exist is as damaging as denying one that does.
- Logging by typing, by voice note, by live conversation, and by photo: food, drinks, activity, weight and body measurements, tape measurements, water.
- Showing it back: Today (the day's figures, water, the week's Health Flower, what you burn), the Log tab (Food, Activity, Measurements, with week-by-week history), and the Almanac (Insights, Movement plans, Me).
- The Almanac keeps things worth remembering, saved deliberately from a conversation.
- Movement plans with demonstration clips for most exercises.
- Reminders of two kinds. The app's own daily prompt to log, at times chosen in Settings. And any reminder the person asks for in their own words, at a time they name - "remind me to drink water at 9am", "nudge me to take my magnesium at half eight on Sundays" - which arrives saying their own words back. Ask for the time if they have not given one. They can stop one by saying so, or in Settings. Reminders are scheduled on the phone, so one asked for during a voice call is set when the call ends.
- Weekly roundups, written on a Sunday evening into the Almanac.
- A Cycle page on the Log tab: period start and end, spotting, flow, symptoms and ovulation signs, any day of which can be filled in after the fact. Phases and the next period expected are worked out from their own logged cycles once there are enough of them, and said as an estimate until then.
- A Feeling page on the Log tab: mood and energy, five words each, for any day. Both can also be said in chat - "my period started Tuesday", "flat and shattered today" - and land on the day they name rather than the day they said it.

WHEN SOMETHING IS NOT POSSIBLE YET. Never refuse flatly and never suggest a workaround instead of answering. Say what the app does do that is nearest, say plainly that the exact thing is not built yet, and offer to note it as something they want. For example, asked for a 9am water reminder: the daily log reminders exist and can be set to any time, but they prompt logging rather than drinking, and a water-specific reminder is not built - so say that, and offer to note it down. The same holds for anything else somebody asks for: a new measurement, a different kind of report. MICRONUTRIENTS ARE DIFFERENT, because there is something real you can do - see ASKED ABOUT A VITAMIN OR MINERAL.`;

  const contextualSystemPrompt =
    SYSTEM_PROMPT +
    CAPABILITIES +
    buildContextualAdditions(previousEscalationStep, previousRevisitCount) +
    todayBlock +
    goalSafetyPrompt({ verdict: 'unknown', reason: 'no-goal' }, profile?.unsafe_goal_flagged_at) +
    pendingFocusPrompt(pendingFocus) +
    pendingSavePrompt(pendingSave) +
    (discussedEntry ? `\n\n${discussedEntry}` : '') +
    (isVoice ? VOICE_SESSION_BLOCK : '') +
    (supersededSince ? SUPERSEDED_TURN_BLOCK : '') +
    (consolidation.eligible ? CONSOLIDATION_OFFER_BLOCK : '') +
    (isInLiteMode(profile) ? LITE_MODE_STANDING_BLOCK : '');

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
      items: { type: 'string' },
      description:
        'Only when the person states an ALLERGY or a medical dietary restriction (coeliac, an intolerance that makes them ill), in any context including in passing. The allergen itself in their words, e.g. ["peanuts"]. NOT dislikes, NOT preferences, NOT things they are avoiding by choice or for a diet - those go to rememberCategory. When in doubt it is a preference, not an allergy.',
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
    logIntent: {
      type: 'string',
      enum: ['none', 'food', 'activity', 'measurement', 'hydration', 'sleep'],
      description:
        "'food' ONLY when the message actually describes food or drink they consumed - a message ABOUT the log is not a meal (\"it's not gone into the log\", \"did that save?\", \"my log is empty\"), and gets an answer rather than an entry. 'activity' if it describes exercise/physical activity done, 'measurement' if it states a body measurement they took (a weight, body fat percentage, or muscle mass - e.g. \"55.2 this morning\", \"8 stone 9 today\", \"scales said 55.4 and 29% fat\"), else 'none'. A weight they are AIMING for is a goal, not a measurement - use 'none'. INDEPENDENT of the safety classification - a distress disclosure can also be a log; set this to whatever is loggable regardless of emotional content. ACTIVITY HAS A CONDITION: only set 'activity' once you know HOW LONG it lasted. \"I went for a run\" on its own is not enough - leave logIntent 'none', ask how long in your reply, and set it to 'activity' on the turn where they tell you, passing the whole thing in logText. A REST DAY IS THE ONE EXCEPTION: \"rest day today\", \"taking it easy today\", \"no training today\" is an activity log with no duration to ask for, so set 'activity' straight away and put \"rest day\" in logText. The duration rule exists because a calorie figure cannot be invented from a guess, and a rest day burns nothing to guess at.",
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
        'Set ONLY when something in this turn is worth OFFERING to keep in their Almanac - as a symptom, an insight, or a ME CARD. Do not ask the question yourself: the app adds the offer to the end of your reply. '
        + '{"type": "symptom" | "insight" | "me", "title": a short title in their terms, "content": for a symptom {"summary": their own words}, for an insight {"condition": ..., "expectation": ...}, for a me card {"section": ..., "why": ..., "status": ..., "detail": ...}}. '
        + 'A ME CARD is for a settled decision about how they live - a supplement, a routine, a dietary decision, a standing commitment - and its status, where it has one, must be exactly one of: Taking, Ordered, Dietary source, As needed, Active, Paused. See the Almanac section of your instructions for when each type applies. '
        + 'The app stores the offer and saves it only if they say yes. Never for a plan, a passing remark, a plain result or a one-off observation, and never while an earlier offer is still waiting.',
    },
    meUpdate: {
      type: 'object',
      description:
        'ONLY when they tell you something ALREADY in their Me tab has changed - stopped, paused, restarted, ordered. '
        + '{"title": the card\'s name as listed in their Me tab, "status": one of Taking, Ordered, Dietary source, As needed, Active, Paused, "reason": why, in their own words, or omit if they gave none}. '
        + 'Not for adding something new - that is proposedSave with type "me". The app finds the card, changes it, keeps the history, and tells them.',
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
  });

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
      system: contextualSystemPrompt,
      messages,
      tools: [tool],
      tool_choice: { type: 'tool', name: CLASSIFY_TOOL_NAME },
    });
  } catch (err) {
    console.log('ANTHROPIC API ERROR:', err instanceof Error ? err.message : err);
    // Deliberately NOT marking the card sent here: a failed call must not
    // consume the one chance the image had to be seen.
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }

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
    return NextResponse.json({ error: 'Response was cut short' }, { status: 500 });
  }

  const toolUse = response.content.find((block) => block.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
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
    correctionKind?: string;
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
    allergiesDisclosed?: string[];
    proposedSave?: unknown;
    meUpdate?: { title?: unknown; status?: unknown; reason?: unknown };
    saveAnswer?: string;
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
  let saved: { kind: 'food' | 'activity' | 'measurement' | 'hydration' | 'sleep' | 'cycle' | 'feeling'; summary: string } | null = null;
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
  const attempt: LogAttempt = { intent: result.logIntent ?? 'none', landed: [], missed: [] };
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
  // A correction or deletion of something just logged (build item 10d). Runs
  // BEFORE the logging branches so a corrected value can never also be stored
  // as a second, new entry.
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
      const { data: target } = await supabase
        .from(table)
        .select('*')
        .eq('user_id', user.id)
        .gte(timeCol, correctionCutoff())
        .order(timeCol, { ascending: false })
        .limit(1)
        .maybeSingle();

      // A personal-metric UPDATE finds its own row, per metric name, inside the
      // branch below - so `target` is not its precondition and must not gate it.
      // It did, until 2026-08-28: `!target` short-circuited first, so the very
      // first waist or thigh anyone stated was answered with "I can't find a
      // measurement recent enough to change" and never written, while the branch
      // built to handle exactly that case sat unreachable underneath. Every other
      // kind genuinely does need a target, because each one edits that row by id.
      const findsItsOwnTarget = correction.kind === 'personal_metric' && correction.action === 'update';

      if (!target && !findsItsOwnTarget) {
        correctionNote = nothingToCorrectMessage(correction.kind);
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

        let ids = [target.id];
        if (scope === 'duplicates' && supportsDuplicateRemoval(correction.kind) && matchOn) {
          let q = supabase
            .from(table)
            .select('id')
            .eq('user_id', user.id)
            .gte(timeCol, correctionCutoff());
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
          saved = { kind: 'measurement', summary: personalSaveSummary(personal) };
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
          .eq('id', target.id)
          .eq('user_id', user.id)
          .maybeSingle();

        const { reading, ambiguous } = await logMeasurementFromText(
          supabase,
          user.id,
          message,
          undefined,
          target.id,
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
          .eq('id', target.id)
          .eq('user_id', user.id)
          .maybeSingle();
        const updated = await logFoodFromText(
          supabase,
          user.id,
          message,
          undefined,
          target.id,
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
          await supabase.from(table).delete().eq('id', target.id).eq('user_id', user.id);
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
  if (result.logIntent === 'measurement') {
    try {
      const { reading, personal } = await logMeasurementFromText(supabase, user.id, message);
      if (reading) {
        saved = { kind: 'measurement', summary: measurementSaveSummary(reading) };
        attempt.landed.push('reading');
      }
      // Personal metrics land independently of the scale half - "waist 70" with
      // no weight in it is a complete log. They are named individually in
      // `landed` so a partial miss can say which ones made it, rather than the
      // whole turn reading as one undifferentiated "reading".
      for (const m of personal) attempt.landed.push(m.metric_name);
      // The toast says something either way. Its summary is the scale reading
      // when there is one, since that is the headline number; otherwise it names
      // what was actually kept.
      if (!saved && personal.length > 0) {
        saved = { kind: 'measurement', summary: personalSaveSummary(personal) };
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
      const entry = await logHydrationFromText(supabase, user.id, message);
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

  if (result.logIntent === 'food' || result.logIntent === 'activity' || saysDidPlan) {
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
        const entries = await logFoodFromText(
          supabase,
          user.id,
          result.logText?.trim() || message,
          undefined,
          undefined,
          undefined,
          voiceTurnId
        );
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
          breakdownFoodLogId = entries.length === 1 ? entries[0].id : null;
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
      } else if (saysDidPlan) {
        // A SAVED ROUTINE, RECORDED BY SAYING SO (Ruth, 2026-09-18). This runs
        // ahead of ordinary activity logging and instead of it: the session is
        // written from the plan's own movements, which carries the plan's
        // history and the movements themselves into the week - neither of which
        // an activity row built from a sentence can do.
        const plan = choosePlan(result.workoutPlan ?? '', savedPlans);
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
        const entries = await logActivityFromText(
          supabase,
          user.id,
          result.logText?.trim() || message
        );
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

  // Allergy capture (item 42 part (b)). Fire-and-persist with no confirmation
  // turn and no toast: Part Twelve requires this to be captured conversationally
  // wherever it surfaces, and a "shall I remember that?" prompt would make
  // disclosure a small ceremony rather than something said in passing. Idempotent
  // on (user_id, name), so a repeat mention is silently the same row.
  if (Array.isArray(result.allergiesDisclosed) && result.allergiesDisclosed.length > 0) {
    await recordAllergies(supabase, user.id, result.allergiesDisclosed, message);
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
  }

  let offered = false;
  // Which tab the outstanding offer is for, so the question names it. Defaults
  // to 'note', which asks about the Almanac, because that is what every offer
  // did before Me existed.
  let offeredType: SaveType = 'note';
  if (pendingSave.proposal && (result.saveAnswer === 'yes' || result.saveAnswer === 'no')) {
    if (result.saveAnswer === 'yes') {
      const kept = await commitSave(supabase, user.id, pendingSave.proposal);
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
    } else if (!pendingSave.proposal) {
      // A new offer is stored only when none is waiting: one question at a time.
      const proposal = coerceProposal(result.proposedSave);
      if (proposal) {
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

  // The offer goes last, so the reply ends on the question it is waiting on.
  const offerLine = offered ? offerQuestion(safeReplyText, offeredType) : null;
  const trailingLines = [correctionNote, focusNote, saveNote, meNote, honestyNote, offerLine].filter(
    (line): line is string => typeof line === 'string' && line.length > 0
  );
  const finalReply =
    trailingLines.length > 0
      ? `${safeReplyText}\n\n${trailingLines.join('\n\n')}`
      : safeReplyText;

  const { error: insertError } = await supabase.from('chat_messages').insert({
    user_id: user.id,
    role: 'assistant',
    // What was actually shown, including any deletion line. Storing replyText
    // instead would leave the model unaware on the next turn that an entry it
    // can no longer see was removed at its own request.
    content: finalReply,
    source: 'chat',
    // Tagged alongside the user turn so pulling one entry's history back out
    // yields both halves of the exchange, not a column of unanswered questions.
    discuss_entry_id: resolvedTag?.entryId ?? null,
    discuss_entry_type: resolvedTag?.entryType ?? null,
    classification: nextClassification,
    escalation_step: nextEscalationStep,
    distress_revisit_count: nextRevisitCount,
    food_log_id: breakdownFoodLogId,
  });
  if (insertError) {
    console.log('ASK-SELODIA ASSISTANT TURN INSERT FAILED:', insertError.message);
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

  return NextResponse.json({
    reply: finalReply,
    navigationTarget,
    savedContext,
    savedAlmanac,
    resourceCard: resourceCard ?? goalResourceCard,
    healthGuidanceApplied,
    saved,
    foodLogId: breakdownFoodLogId,
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
