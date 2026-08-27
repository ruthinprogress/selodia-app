import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseForRequest } from '../../lib/supabase';
import { APP_STRUCTURE_PROMPT_BLOCK } from '../../lib/app-structure';
import { unsavedNote, type LogAttempt } from '../../lib/save-honesty';
import {
  CLASSIFY_TOOL_NAME,
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
import { foodSaveSummary, activitySaveSummary } from '../../lib/save-summary';
import { logMeasurementFromText, measurementSaveSummary } from '../../lib/measurement-logging';
import {
  correctionCutoff,
  deletionMessage,
  nothingToCorrectMessage,
  resolveCorrection,
  TABLE_FOR,
  TIME_COLUMN_FOR,
} from '../../lib/log-correction';
import { saveAlmanacEntry } from '../../lib/almanac';
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
// capability rather than the routine-task tier (see UNFLUMP_SPEC.md, Part
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

  const { message, cardImageBase64, cardMediaType, entryId, entryType } =
    await request.json();
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
    console.log('ASK-UNFLUMP USER TURN INSERT FAILED:', userInsertError.message);
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

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
    { data: recentMeasurements },
    { data: healthContextRow },
    { data: lastPeriodRow },
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
      .select('*')
      .gte('happened_at', sevenDaysAgo.toISOString())
      .order('happened_at', { ascending: false }),
    supabase
      .from('activity_logs')
      .select('*')
      .gte('happened_at', sevenDaysAgo.toISOString())
      .order('happened_at', { ascending: false }),
    supabase
      .from('body_measurements')
      .select('*')
      .gte('measured_at', sevenDaysAgo.toISOString())
      .order('measured_at', { ascending: false }),
    supabase.from('health_context').select('*').maybeSingle(),
    supabase
      .from('cycle_events')
      .select('event_date')
      .eq('event_type', 'period_start')
      .order('event_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
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

  const foodSummary = recentFood && recentFood.length > 0
    ? recentFood.map((f) => f.happened_at.slice(0, 10) + ': ' + f.raw_text + ' (' + f.kcal + 'kcal, ' + f.protein_g + 'g protein)').join('\n')
    : 'No food logged in the last 7 days.';

  const activitySummary = recentActivity && recentActivity.length > 0
    ? recentActivity.map((a) => a.happened_at.slice(0, 10) + ': ' + a.activity_type + ' (' + a.duration_min + ' min, ' + a.kcal_burned + ' kcal)').join('\n')
    : 'No activity logged in the last 7 days.';

  const measurementSummary = recentMeasurements && recentMeasurements.length > 0
    ? recentMeasurements.map((m) => m.measured_at.slice(0, 10) + ': weight ' + m.weight_kg + 'kg, body fat ' + m.body_fat_pct + '%').join('\n')
    : 'No body measurements in the last 7 days.';

  const SYSTEM_PROMPT = `You are Unflump, a calm, grounded companion inside a food/fitness tracking app. You are NOT a coach, a cheerleader, or a report generator. Your tone is steady and validating, not peppy or upbeat - closer to a thoughtful friend who listens carefully than someone hyping the person up. Avoid exclamation marks, emojis, and enthusiastic language ("Ouch!", "amazing!", "love that"). Speak plainly and warmly instead. Never use bullet points, headers, or long structured breakdowns unless specifically asked for a list. One or two short paragraphs is usually enough. When relevant, naturally reference their recent logged activity or data and ask if anything needs adjusting - that instinct is good, just deliver it calmly rather than energetically. Classify most ordinary conversation (food, activity, logistics, general chat) as neutral.

Here is what you know about this person (their stored context, facts, goals, diagnoses, preferences):
${contextText}

Here is their food log from the last 7 days:
${foodSummary}

Here is their activity log from the last 7 days:
${activitySummary}

Here are their body measurements from the last 7 days:
${measurementSummary}
${healthContextBlock ? `\n${healthContextBlock}\n` : ''}${cycleContextBlock ? `\n${cycleContextBlock}\n` : ''}
Use this information naturally in your replies, the way a friend who already knows your situation would - don't just recite it back. If in the course of the conversation the person shares something worth remembering long-term (a new goal, a diagnosis, a preference, a frustration), set rememberCategory and rememberContent - only for genuinely durable facts, not passing comments, and only once per new fact.

NUTRIENT DEPTH (passive, occasional): protein and calories miss things that can matter over time - dietary saturated fat and cholesterol, omega-3s, iron, fibre, refined carbs, overall micronutrient variety. From the food ALREADY LOGGED above, you may occasionally and gently notice a PATTERN worth a light mention - never from a single meal (one lower-density choice is noise, only a trend across the logs is worth raising), never as a running micronutrient tracker or checklist, and never by labelling any food "good" or "bad". Let the HEALTH CONTEXT above decide what is worth watching: the markers and protective foods it already lists ARE your priority lens - infer the relevant nutrient pattern from that block, don't restate or second-guess it, and don't run a generic scan. If there is NO health context, keep this very light and mostly stay quiet: a depth nudge is prioritised by what they have actually disclosed, not applied one-size-fits-all. Only raise it when it genuinely fits the moment and is worth saying - most replies will not touch it at all. When such a nudge draws on their health context, set healthGuidanceApplied to true (as above) so the disclaimer shows.

CLARIFYING A COMPOSITE: two kinds of composite dish are worth a light, single clarifying question when the person did NOT already specify the details. (1) A consistent-ratio dish (lasagne) where ONE variable materially changes the macros - the type of meat, the portion of a set dish: ask about that one variable. (2) A high-variability dish (shakshuka, a full English) whose make-up really varies: ask about the KEY items and quantities in ONE question ("A full English - roughly how many eggs and rashers of bacon? I'll assume a typical spread otherwise"), never item by item across turns. Either way, ask just once, gently, and always offer an easy way out ("...or I'll just go with a typical one, no worries either way"). It is logged immediately with a sensible default regardless, so this is a light confirmation, never a gate or a demand - and you never chase items they leave out: a typical portion fills anything unmentioned. Set clarificationAsked to a short name for what you asked about. Do this ONLY for those two cases: never for a simple or branded item, and never for a multi-component meal (those are just broken into their parts). Never nag, never re-ask. When a later message answers your clarification, set clarificationResolved to the full enriched food description combining the original dish with everything they said (e.g. "beef lasagne", or "full English with 2 fried eggs and 3 rashers of bacon"); the app re-reads it and quietly updates the stored entry, so don't restate macros.

SAVING TO THE ALMANAC: the Almanac is the person's living reference of saved plans, patterns, and insights - the things worth keeping within easy reach. A save is worth it only for (a) a real plan you've genuinely worked out together (a routine, a movement plan, a meal or drink plan) or (b) a genuine INSIGHT - a pattern that connects two different kinds of data across time in a way that changes how a future reading should be read (e.g. weight/waist tending higher in the days before a period). It is NOT worth saving a plain result (a number the data already shows, like a 5-day trend) or a one-off observation (a contextual note that connects to nothing) - those stay in the conversation. **Confirm first, always:** when something save-worthy emerges, ASK whether to keep it ("Want me to save this to your Almanac?"), and set almanacKind/almanacTitle/almanacContent ONLY after the person agrees - never save without a yes, never save a passing remark. Use an open, natural word for almanacKind (e.g. "insight", "routine", "movement plan", "pattern"), a short almanacTitle, and almanacCategory only when a natural grouping exists. For an INSIGHT, put its rule in almanacContent as a condition and an expectation, e.g. {"condition": "the days before your period", "expectation": "weight and waist read a little higher"}, so it can inform how future readings are interpreted.\nFOR A WORKOUT OR MOVEMENT PLAN specifically, almanacContent takes this shape: {"programType": string, "goal": string, "exercises": [{"name": string, "group": string, "sets": number, "reps": string, "safetyNote": string, "eccentricLoad": "none"|"low"|"moderate"|"high", "intensity": "light"|"moderate"|"intense"}]}. Notes on each: **programType** describes the kind of program in your own words (e.g. "general strength", "rehab", "skill practice") - it decides how the plan is grouped, so be accurate rather than inventive. **group** is the grouping key and its meaning follows programType: a body area for general strength, the skill being learned for skill practice, and it can be omitted for rehab, which shows as a flat list. **reps** is a STRING so you can write what is actually true - "8-10", "30s", "AMRAP", "12 per side" - never round it to a bare number if that loses meaning. **sets and reps are decided per person and per goal from what you have discussed** - a rep range for building muscle is not the range for rehab or endurance - never a fixed default per exercise. **safetyNote is required for every exercise and must name the real common failure modes of that specific movement** - what actually goes wrong and what it feels like when it does - never generic boilerplate like "use good form" or "warm up first". **eccentricLoad** is how much eccentric (lengthening-under-load) work the movement involves, which is what drives delayed-onset soreness; **intensity** is its typical effort level. Set both from the movement itself. Do NOT put working weights or completed sessions in the plan - those are logged separately, and writing them here would overwrite the history that progressive overload depends on.

CORRECTIONS: When the person is fixing or removing something they JUST logged rather than logging something new, set correctionKind and correctionAction instead of logIntent - see those fields. The app performs it and tells them itself, so do not claim in your reply that you have changed or deleted anything; acknowledge naturally and move on. If you cannot tell whether they mean to correct a value or remove the entry, set neither and simply ask.

LOGGING INTENT: Set logIntent to 'food' if the message describes something the person ate or drank, 'activity' if it describes physical activity or exercise they did, 'measurement' if it states a body measurement they have taken (a weight, a body fat percentage, a muscle mass), or 'none' otherwise - INDEPENDENT of the safety classification (a genuine distress disclosure can also be a food/activity log). The app saves the data and shows the person a brief save confirmation itself, separately from your reply, so NEVER write a "Logged: ..." line, a macro breakdown, or any "I've saved that" text yourself. For a plain food/activity log with nothing more to it, a short, warm, natural reply is right (a friend's easy acknowledgement), never a functional receipt. When a food log is itemised, the app renders the full breakdown as a real table beneath your reply, from the stored data - so do not restate the items, do not announce the table, and do not comment on what it shows; your reply is to what the person SAID, and the table speaks for itself. When you classify a genuine-distress tier (eating_related_distress, grief_related_distress, acute_crisis) for a message that also logs food or activity, give the complete care-first response to the emotional content only; you may, as genuine care, gently note there is no pressure to keep logging while they are feeling like this, but only woven in naturally as care, never as a saving confirmation.

${APP_STRUCTURE_PROMPT_BLOCK}

${SAFETY_PROMPT_BLOCK}`;

  const contextualSystemPrompt =
    SYSTEM_PROMPT + buildContextualAdditions(previousEscalationStep, previousRevisitCount);

  const tool = buildClassifyTool(NON_DISTRESS_CLASSIFICATIONS, previousEscalationStep === 'direct_asked', {
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
      enum: ['none', 'food', 'activity', 'measurement'],
      description:
        "'food' if the message describes something eaten or drunk, 'activity' if it describes exercise/physical activity done, 'measurement' if it states a body measurement they took (a weight, body fat percentage, or muscle mass - e.g. \"55.2 this morning\", \"8 stone 9 today\", \"scales said 55.4 and 29% fat\"), else 'none'. A weight they are AIMING for is a goal, not a measurement - use 'none'. INDEPENDENT of the safety classification - a distress disclosure can also be a log; set this to whatever is loggable regardless of emotional content.",
    },
    correctionKind: {
      type: 'string',
      enum: ['food', 'activity', 'measurement'],
      description:
        "Set ONLY when the person is fixing or removing something they just logged, rather than logging something new - e.g. \"no that was 55.2 not 52.5\", \"make that 300 calories\", \"delete that last one\", \"scrap the run, I didn't go\". Which kind of entry they mean. When set, leave logIntent as 'none' - a correction is not a new log.",
    },
    correctionAction: {
      type: 'string',
      enum: ['update', 'delete'],
      description:
        "Only alongside correctionKind. 'update' when they are giving a corrected value, 'delete' when they want the entry gone entirely. If you cannot tell which, leave BOTH fields unset and ask them in your reply instead - never guess, because both outcomes change their real data.",
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
    almanacKind: {
      type: 'string',
      description:
        'Only when saving a genuinely save-worthy Almanac item AND the person has AGREED to save it (confirm first): an open, natural word for the kind (e.g. "insight", "routine", "movement plan", "pattern"). Never without agreement; never for a plain result or one-off observation.',
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
      max_tokens: 500,
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
    logIntent?: 'none' | 'food' | 'activity' | 'measurement';
    correctionKind?: string;
    correctionAction?: string;
    clarificationAsked?: string;
    clarificationResolved?: string;
    discussTopicEnded?: boolean;
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
    if (tagFixError) console.log('ASK-UNFLUMP TAG CORRECTION FAILED:', tagFixError.message);
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
  let saved: { kind: 'food' | 'activity' | 'measurement'; summary: string } | null = null;
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
      const { data: target } = await supabase
        .from(table)
        .select('id')
        .eq('user_id', user.id)
        .gte(timeCol, correctionCutoff())
        .order(timeCol, { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!target) {
        correctionNote = nothingToCorrectMessage(correction.kind);
      } else if (correction.action === 'delete') {
        const { error } = await supabase.from(table).delete().eq('id', target.id).eq('user_id', user.id);
        correctionNote = error ? null : deletionMessage(correction.kind);
        if (error) console.log('ASK-UNFLUMP DELETE FAILED:', error.message);
      } else if (correction.kind === 'measurement') {
        const entry = await logMeasurementFromText(supabase, user.id, message, undefined, target.id);
        if (entry) saved = { kind: 'measurement', summary: measurementSaveSummary(entry) };
      } else if (correction.kind === 'food') {
        const entry = await logFoodFromText(supabase, user.id, message, undefined, target.id);
        saved = { kind: 'food', summary: foodSaveSummary(entry) };
      } else {
        // Activity has no in-place update path: logActivityFromText can split
        // one message into several rows, so "replace row X" is not well
        // defined. Removing and re-logging is the honest equivalent, and it is
        // what the person asked for in substance.
        await supabase.from(table).delete().eq('id', target.id).eq('user_id', user.id);
        const entries = await logActivityFromText(supabase, user.id, message);
        if (entries[0]) saved = { kind: 'activity', summary: activitySaveSummary(entries) };
      }
    } catch (err) {
      console.log('ASK-UNFLUMP CORRECTION FAILED:', err instanceof Error ? err.message : err);
    }
  }


  // A body measurement stated in text (build item 10c). Kept separate from the
  // food/activity branch below because it has no clarification loop and its own
  // failure mode: a message that reads like a weight but yields no usable
  // number saves nothing at all rather than writing an empty row.
  if (result.logIntent === 'measurement') {
    try {
      const entry = await logMeasurementFromText(supabase, user.id, message);
      if (entry) {
        saved = { kind: 'measurement', summary: measurementSaveSummary(entry) };
        attempt.landed.push('reading');
      }
    } catch (err) {
      console.log('ASK-UNFLUMP MEASUREMENT LOG FAILED:', err instanceof Error ? err.message : err);
    }
  }

  if (result.logIntent === 'food' || result.logIntent === 'activity') {
    try {
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
        const entries = await logActivityFromText(supabase, user.id, message);
        if (entries[0]) {
          saved = { kind: 'activity', summary: activitySaveSummary(entries) };
          attempt.landed.push('activity');
        }
      }
    } catch (err) {
      console.log('ASK-UNFLUMP SILENT LOG FAILED:', err instanceof Error ? err.message : err);
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
        console.log('ASK-UNFLUMP CLARIFICATION RESOLVE FAILED:', err instanceof Error ? err.message : err);
      }
    }
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
  if (result.almanacKind && result.almanacTitle) {
    const entry = await saveAlmanacEntry(supabase, user.id, {
      kind: result.almanacKind,
      title: result.almanacTitle,
      category: result.almanacCategory,
      content: result.almanacContent,
    });
    if (entry) savedAlmanac = { kind: entry.kind, title: entry.title };
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
  const honestyNote = unsavedNote(attempt);

  const trailingLines = [correctionNote, honestyNote].filter(
    (line): line is string => typeof line === 'string' && line.length > 0
  );
  const finalReply =
    trailingLines.length > 0 ? `${replyText}\n\n${trailingLines.join('\n\n')}` : replyText;

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
    console.log('ASK-UNFLUMP ASSISTANT TURN INSERT FAILED:', insertError.message);
  }

  // Only surface the disclaimer when the model flagged health-informed guidance
  // AND the person actually has stored health context - never a phantom.
  const healthGuidanceApplied =
    hasHealthContext(healthContext) && result.healthGuidanceApplied === true;

  return NextResponse.json({
    reply: finalReply,
    savedContext,
    savedAlmanac,
    resourceCard,
    healthGuidanceApplied,
    saved,
    foodLogId: breakdownFoodLogId,
  });
}
