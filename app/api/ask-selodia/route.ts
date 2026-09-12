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
import { logActivityFromText } from '../../lib/activity-logging';
import { hydrationSaveSummary, logHydrationFromText } from '../../lib/hydration-logging';
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
  loadPendingCardImage,
  markCardImageSent,
  resolveDiscussTag,
  uploadDiscussCard,
  type DiscussTag,
} from '../../lib/discuss-card';

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

export async function POST(request: NextRequest) {
  const supabase = getSupabaseForRequest(request);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { message, cardImageBase64, cardMediaType, entryId, entryType, voice, supersedes } =
    await request.json();
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
    .select('discuss_entry_id, discuss_entry_type')
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

  // Insert optimistically under continue-by-default. The model's verdict on
  // whether the topic has moved on arrives with the reply, so this is corrected
  // below rather than blocking the turn on a call that hasn't happened yet.
  const provisionalTag = resolveDiscussTag({
    posted: postedTag,
    previous: previousTag,
    topicEnded: false,
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
      .select('date, steps, kcal_burned, active_minutes, distance_km')
      .gte('date', contextSince.toISOString().slice(0, 10))
      .order('date', { ascending: false }),
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

  // The card image reaches the model exactly ONCE (decision, 2026-08-21):
  // re-sending it every turn would charge vision tokens for the rest of the
  // conversation to no benefit, since the reply it produces is already in the
  // text history. Attached to the newest user turn so "this" is unambiguous.
  const pendingCard = await loadPendingCardImage(supabase, user.id);
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
    ? recentFood.map((f) => f.happened_at.slice(0, 10) + ': ' + f.raw_text + ' (' + f.kcal + 'kcal, ' + f.protein_g + 'g protein)').join('\n')
    : 'No food logged in the last 7 days.';

  // Eccentric load is appended only when it was classified, so an older row with
  // nulls reads as it always did rather than as 'eccentric load: null'.
  const activitySummary = recentActivity && recentActivity.length > 0
    ? recentActivity.map((a) => {
        const extras = [
          a.intensity ? String(a.intensity) : null,
          a.eccentric_load ? `${a.eccentric_load} eccentric load` : null,
        ].filter(Boolean);
        return a.happened_at.slice(0, 10) + ': ' + a.activity_type + ' (' + a.duration_min +
          ' min, ' + a.kcal_burned + ' kcal' + (extras.length ? ', ' + extras.join(', ') : '') + ')';
      }).join('\n')
    : 'No activity logged in the last 7 days.';

  // Named as a whole day, every time, with the source of the figure attached.
  // The wording is doing real work: "burned across the day" cannot be misread as
  // a session the way a bare number beside a duration can.
  const dailyBurnSummary = recentDailyBurn && recentDailyBurn.length > 0
    ? recentDailyBurn
        .map((d) => {
          const bits = [
            d.kcal_burned != null ? Math.round(d.kcal_burned) + ' kcal burned across the whole day' : null,
            d.steps != null ? d.steps.toLocaleString('en-GB') + ' steps' : null,
            d.active_minutes != null ? Math.round(d.active_minutes) + ' min active' : null,
            d.distance_km != null ? d.distance_km + ' km' : null,
          ].filter(Boolean);
          return d.date + ': ' + bits.join(', ');
        })
        .join('\n')
    : 'No daily tracker totals in this period.';

  const measurementSummary = recentMeasurements && recentMeasurements.length > 0
    ? recentMeasurements.map((m) => m.measured_at.slice(0, 10) + ': weight ' + m.weight_kg + 'kg, body fat ' + m.body_fat_pct + '%').join('\n')
    : 'No body measurements in the last 7 days.';

  const SYSTEM_PROMPT = `You are Selodía, a calm, grounded companion inside a food/fitness tracking app. You are NOT a coach, a cheerleader, or a report generator. Never refer to yourself by name in conversation: you introduced yourself once on the welcome screen, and the person knows where they are. Your tone is steady and validating, not peppy or upbeat - closer to a thoughtful friend who listens carefully than someone hyping the person up. Avoid exclamation marks, emojis, and enthusiastic language ("Ouch!", "amazing!", "love that"). Speak plainly and warmly instead. Never use bullet points, headers, or long structured breakdowns unless specifically asked for a list. One or two short paragraphs is usually enough. When relevant, naturally reference their recent logged activity or data and ask if anything needs adjusting - that instinct is good, just deliver it calmly rather than energetically. Classify most ordinary conversation (food, activity, logistics, general chat) as neutral.

Here is what you know about this person (their stored context, facts, goals, diagnoses, preferences):
${contextText}

Here is their food log from the last 7 days:
${foodSummary}
${buildDayStatePrompt(dayState)}

Here is their activity log from the last 7 days - these are SESSIONS, things they set out and did:
${activitySummary}

Here are their whole-day tracker totals, from a fitness app's daily summary screen. These are NOT sessions and must never be described as one: the calorie figure is everything their body used across a whole day of ordinary movement, not a workout they did. Treat it as background on how active a day was, and never congratulate someone on it as though it were training:
${dailyBurnSummary}

Here are their body measurements from the last 7 days:
${measurementSummary}
${allergyBlock}${healthContextBlock ? `\n${healthContextBlock}\n` : ''}${cycleContextBlock ? `\n${cycleContextBlock}\n` : ''}${yesterdayBlock ? `\n${yesterdayBlock}\n` : ''}
Use this information naturally in your replies, the way a friend who already knows your situation would - don't just recite it back. If in the course of the conversation the person shares something worth remembering long-term (a new goal, a diagnosis, a preference, a frustration), set rememberCategory and rememberContent - only for genuinely durable facts, not passing comments, and only once per new fact. If they mention an ALLERGY or a medical dietary restriction - however casually, and including in the middle of logging a meal - set allergiesDisclosed as well; a dislike or a choice is not one, and belongs in rememberCategory instead. Never turn this into a questionnaire: never ask whether they have any allergies, never ask them to confirm a list, and do not remark on capturing it.

NUTRIENT DEPTH (passive, occasional): protein and calories miss things that can matter over time - dietary saturated fat and cholesterol, omega-3s, iron, fibre, refined carbs, overall micronutrient variety. From the food ALREADY LOGGED above, you may occasionally and gently notice a PATTERN worth a light mention - never from a single meal (one lower-density choice is noise, only a trend across the logs is worth raising), never as a running micronutrient tracker or checklist, and never by labelling any food "good" or "bad". Let the HEALTH CONTEXT above decide what is worth watching: the markers and protective foods it already lists ARE your priority lens - infer the relevant nutrient pattern from that block, don't restate or second-guess it, and don't run a generic scan. If there is NO health context, keep this very light and mostly stay quiet: a depth nudge is prioritised by what they have actually disclosed, not applied one-size-fits-all. Only raise it when it genuinely fits the moment and is worth saying - most replies will not touch it at all. When such a nudge draws on their health context, set healthGuidanceApplied to true (as above) so the disclaimer shows.

CLARIFYING A COMPOSITE: two kinds of composite dish are worth a light, single clarifying question when the person did NOT already specify the details. (1) A consistent-ratio dish (lasagne) where ONE variable materially changes the macros - the type of meat, the portion of a set dish: ask about that one variable. (2) A high-variability dish (shakshuka, a full English) whose make-up really varies: ask about the KEY items and quantities in ONE question ("A full English - roughly how many eggs and rashers of bacon? I'll assume a typical spread otherwise"), never item by item across turns. Either way, ask just once, gently, and always offer an easy way out ("...or I'll just go with a typical one, no worries either way"). It is logged immediately with a sensible default regardless, so this is a light confirmation, never a gate or a demand - and you never chase items they leave out: a typical portion fills anything unmentioned. Set clarificationAsked to a short name for what you asked about. Do this ONLY for those two cases: never for a simple or branded item, and never for a multi-component meal (those are just broken into their parts). Never nag, never re-ask. When a later message answers your clarification, set clarificationResolved to the full enriched food description combining the original dish with everything they said (e.g. "beef lasagne", or "full English with 2 fried eggs and 3 rashers of bacon"); the app re-reads it and quietly updates the stored entry, so don't restate macros.

SAVING TO THE ALMANAC: the Almanac keeps what the person agrees is worth keeping. There are two ways in, and they work differently.\n(1) INSIGHTS, SYMPTOMS AND NOTES go through an OFFER that the app stores. When one of these moments comes up, answer what they actually said first, then set proposedSave with its type, a short title and its content. Do not ask the question yourself: the app adds the offer to the end of your reply in its own words, so asking it too would ask twice. Never save it yourself and never say it is saved: the app keeps it only if they say yes, and tells them so itself. A SYMPTOM is a physical observation in their own words - pain, soreness, stiffness, fatigue, bloating, hay fever, poor sleep - worth offering when it is specific and physical, not every passing "I'm tired". Answer it first by the symptom rule below, then offer, with their words in content as {"summary": ...}. An INSIGHT is a genuine pattern that connects two different kinds of data across time in a way that changes how a future reading should be read (e.g. weight and waist tending higher in the days before a period); its rule goes in content as {"condition": ..., "expectation": ...}. A plain result (a number the data already shows, like a 5-day trend) or a one-off observation that connects to nothing is not an insight and is never offered. A NOTE is anything they explicitly ask you to note or log as a note ("log a note: I feel really good today"). There is no offer for a note, because asking is the yes: set noteText to their words exactly as they said them, never rewritten or embellished, and do not say it is saved. Offer one thing at a time, never the same thing twice, and never turn a passing remark into an offer. Whatever is kept is observed, not graded: a title or summary describes what they said and never praises, warns or scores it.\n(2) PLANS you have genuinely worked out together (a routine, a movement plan, a meal or drink plan) are still saved the older way. **Confirm first, always:** ASK whether to keep it ("Want me to save this to your Almanac?"), and set almanacKind/almanacTitle/almanacContent ONLY after they agree - never without a yes. Use an open, natural word for almanacKind (e.g. "routine", "movement plan"), a short almanacTitle, and almanacCategory only when a natural grouping exists. Never use almanacKind for an insight, a symptom or a note.\nFOR A WORKOUT OR MOVEMENT PLAN specifically, almanacContent takes this shape: {"programType": string, "goal": string, "exercises": [{"name": string, "group": string, "sets": number, "reps": string, "safetyNote": string, "eccentricLoad": "none"|"low"|"moderate"|"high", "intensity": "light"|"moderate"|"intense"}]}. Notes on each: **programType** describes the kind of program in your own words (e.g. "general strength", "rehab", "skill practice") - it decides how the plan is grouped, so be accurate rather than inventive. **group** is the grouping key and its meaning follows programType: a body area for general strength, the skill being learned for skill practice, and it can be omitted for rehab, which shows as a flat list. **reps** is a STRING so you can write what is actually true - "8-10", "30s", "AMRAP", "12 per side" - never round it to a bare number if that loses meaning. **sets and reps are decided per person and per goal from what you have discussed** - a rep range for building muscle is not the range for rehab or endurance - never a fixed default per exercise. **safetyNote is required for every exercise and must name the real common failure modes of that specific movement** - what actually goes wrong and what it feels like when it does - never generic boilerplate like "use good form" or "warm up first". **eccentricLoad** is how much eccentric (lengthening-under-load) work the movement involves, which is what drives delayed-onset soreness; **intensity** is its typical effort level. Set both from the movement itself. Do NOT put working weights or completed sessions in the plan - those are logged separately, and writing them here would overwrite the history that progressive overload depends on.

CORRECTIONS: When the person is fixing or removing something they JUST logged rather than logging something new, set correctionKind and correctionAction instead of logIntent - see those fields. The app performs it and tells them itself, so do not claim in your reply that you have changed or deleted anything; acknowledge naturally and move on. If you cannot tell whether they mean to correct a value or remove the entry, set neither and simply ask. When they say something went in more than once, set correctionScope to 'duplicates' so all the copies go together rather than one per turn.

ACTIVITY NEEDS A DURATION BEFORE IT IS LOGGED. An activity with no duration cannot be stored honestly: the length is what every calorie figure is computed from, so logging "a run" means inventing how long it lasted and then showing the person a number built on the invention. When someone mentions activity without saying how long, do not log it. Ask how long, warmly and in one short question, and log it on the turn they answer - setting logIntent to 'activity' then, and passing the full description in logText. Never re-ask something they have already told you, and never treat their answer as a second, separate activity.

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

LOGGING INTENT: Set logIntent to 'food' if the message describes something the person ate or drank, 'activity' if it describes physical activity or exercise they did, 'measurement' if it states a body measurement they have taken (a weight, a body fat percentage, a muscle mass), 'hydration' if it is only about drinking water or another zero-calorie drink (a glass of water, a mug of tea), or 'none' otherwise - INDEPENDENT of the safety classification (a genuine distress disclosure can also be a food/activity log). The app saves the data and shows the person a brief save confirmation itself, separately from your reply, so NEVER write a "Logged: ..." line, a macro breakdown, or any "I've saved that" text yourself. For a plain food/activity log with nothing more to it, a short, warm, natural reply is right (a friend's easy acknowledgement), never a functional receipt. When a food log is itemised, the app renders the full breakdown as a real table beneath your reply, from the stored data - so do not restate the items, do not announce the table, and do not comment on what it shows; your reply is to what the person SAID, and the table speaks for itself. When you classify a genuine-distress tier (eating_related_distress, grief_related_distress, acute_crisis) for a message that also logs food or activity, give the complete care-first response to the emotional content only; you may, as genuine care, gently note there is no pressure to keep logging while they are feeling like this, but only woven in naturally as care, never as a saving confirmation.

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

THIS MESSAGE REPLACES THE ONE BEFORE IT. They paused, you answered the first part of what they were saying, and they carried on talking before they heard that answer - so they never heard it. The message below is everything they said. Answer the whole of it as though your previous reply had not been given, without referring to it or repeating it. Anything your previous reply already logged, saved or corrected is already done: do not log, save or correct the same thing again.`;

  const contextualSystemPrompt =
    SYSTEM_PROMPT +
    buildContextualAdditions(previousEscalationStep, previousRevisitCount) +
    goalSafetyPrompt({ verdict: 'unknown', reason: 'no-goal' }, profile?.unsafe_goal_flagged_at) +
    pendingFocusPrompt(pendingFocus) +
    pendingSavePrompt(pendingSave) +
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
      enum: ['none', 'food', 'activity', 'measurement', 'hydration'],
      description:
        "'food' if the message describes something eaten or drunk, 'activity' if it describes exercise/physical activity done, 'measurement' if it states a body measurement they took (a weight, body fat percentage, or muscle mass - e.g. \"55.2 this morning\", \"8 stone 9 today\", \"scales said 55.4 and 29% fat\"), else 'none'. A weight they are AIMING for is a goal, not a measurement - use 'none'. INDEPENDENT of the safety classification - a distress disclosure can also be a log; set this to whatever is loggable regardless of emotional content. ACTIVITY HAS A CONDITION: only set 'activity' once you know HOW LONG it lasted. \"I went for a run\" on its own is not enough - leave logIntent 'none', ask how long in your reply, and set it to 'activity' on the turn where they tell you, passing the whole thing in logText.",
    },
    logText: {
      type: 'string',
      description:
        "Only alongside logIntent 'activity'. The COMPLETE description to store, assembled from the conversation - e.g. after \"I did a run\" then \"about 40 minutes\", send \"a 40 minute run\". Without this the app would store only the latest message, which on its own says \"about 40 minutes\" and describes no activity at all. Include the duration always, and anything else they said that belongs to the same session (intensity, terrain, how it felt). Omit it when the single message already contains everything.",
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
        "Set true ONLY when the conversation was about a specific logged entry (a card was shown earlier) and this message has genuinely moved on to an unrelated subject. A follow-up question about the same entry, or a natural tangent still rooted in it, is NOT a move. Leave unset when in doubt - the tag continues by default.",
    },
    proposedSave: {
      type: 'object',
      description:
        'Set ONLY when something in this turn is worth OFFERING to keep in their Almanac as an insight or a symptom. Do not ask the question yourself: the app adds the offer to the end of your reply. '
        + '{"type": "symptom" or "insight", "title": a short title in their terms, "content": for a symptom {"summary": their own words}, for an insight {"condition": ..., "expectation": ...}}. '
        + 'The app stores the offer and saves it only if they say yes. Never for a plan, a passing remark, a plain result or a one-off observation, and never while an earlier offer is still waiting.',
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
    logIntent?: 'none' | 'food' | 'activity' | 'measurement' | 'hydration';
    logText?: string;
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
    saveAnswer?: string;
    noteText?: string;
    almanacKind?: string;
    almanacTitle?: string;
    almanacCategory?: string;
    almanacContent?: unknown;
  };

  // Now the model has spoken, settle the tag properly. Posting a card always
  // wins; otherwise the previous tag carries forward unless the topic moved on.
  const resolvedTag = resolveDiscussTag({
    posted: postedTag,
    previous: previousTag,
    topicEnded: result.discussTopicEnded === true,
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
  let saved: { kind: 'food' | 'activity' | 'measurement' | 'hydration'; summary: string } | null = null;
  // What actually reached the database this turn, for the honesty note below.
  // Kept separate from `saved` because `saved` drives the toast and carries one
  // headline summary, while this has to survive a PARTIAL landing - a weight
  // stored while a waist was not.
  const attempt: LogAttempt = { intent: result.logIntent ?? 'none', landed: [], missed: [] };
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
        const entry = await logFoodFromText(supabase, user.id, message, undefined, target.id);
        saved = { kind: 'food', summary: foodSaveSummary(entry) };
        attempt.landed.push('food');
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

  if (result.logIntent === 'food' || result.logIntent === 'activity') {
    const runLog = async () => {
      if (result.logIntent === 'food') {
        const entry = await logFoodFromText(supabase, user.id, message);
        saved = { kind: 'food', summary: foodSaveSummary(entry) };
        attempt.landed.push('food');
        // The turn carries a REFERENCE to what it logged, so the client can
        // render the itemised table from food_items rather than from anything
        // the model wrote. See mobile/src/lib/food-breakdown-table.ts.
        breakdownFoodLogId = entry.id;
        // A new food log ends any prior clarification (that moment has passed);
        // then pin this log's own question, if the model asked one (slice 2a).
        await supabase
          .from('food_logs')
          .update({ clarification_pending: null })
          .eq('user_id', user.id)
          .not('clarification_pending', 'is', null);
        if (result.clarificationAsked) {
          await supabase
            .from('food_logs')
            .update({ clarification_pending: result.clarificationAsked })
            .eq('id', entry.id);
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
    const entry = await saveAlmanacEntry(supabase, user.id, {
      kind: result.almanacKind,
      title: result.almanacTitle,
      category: result.almanacCategory,
      content: result.almanacContent,
    });
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
  let offered = false;
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
      if (proposal) offered = await storePendingSave(supabase, user.id, proposal);
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
  const offerLine = offered ? offerQuestion(safeReplyText) : null;
  const trailingLines = [correctionNote, focusNote, saveNote, honestyNote, offerLine].filter(
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
    // Voice only: they asked to end the call. The adapter says the reply and
    // then hangs up. Always false for a typed message.
    endVoiceSession: isVoice && result.endVoiceSession === true,
  });
}
