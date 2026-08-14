import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseForRequest } from '../../lib/supabase';
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

  const { message } = await request.json();
  console.log('CHAT REQUEST RECEIVED:', message);

  const { error: userInsertError } = await supabase
    .from('chat_messages')
    .insert({ user_id: user.id, role: 'user', content: message, source: 'chat' });
  if (userInsertError) {
    console.log('ASK-UNFLUMP USER TURN INSERT FAILED:', userInsertError.message);
  }

  const { data: lastAssistantTurn } = await supabase
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
    .maybeSingle();

  const previousEscalationStep: EscalationStep =
    (lastAssistantTurn?.escalation_step as EscalationStep) ?? null;
  const previousClassification: Classification | null =
    (lastAssistantTurn?.classification as Classification) ?? null;
  const previousRevisitCount: number = lastAssistantTurn?.distress_revisit_count ?? 0;

  // Descending + limit to get the most recent 40, then reverse to
  // chronological order - ascending + limit would take the OLDEST 40
  // instead, silently dropping the just-inserted current turn once the
  // conversation passes 40 messages and leaving the array ending on an
  // assistant turn, which the model rejects outright. (Confirmed as the
  // real cause of onboarding-chat's 500s, via live Vercel logs - this
  // route shares the identical bug, just hadn't hit 40 messages yet.)
  const { data: recentHistory } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('user_id', user.id)
    .eq('source', 'chat')
    .order('created_at', { ascending: false })
    .limit(40);

  const messages = (recentHistory ?? [])
    .slice()
    .reverse()
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content as string,
    }));

  const { data: contextRows } = await supabase
    .from('user_context')
    .select('*')
    .order('category', { ascending: true });

  const contextText = contextRows && contextRows.length > 0
    ? contextRows.map((c) => c.category + ': ' + c.content).join('\n')
    : 'No stored context yet.';

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: recentFood } = await supabase
    .from('food_logs')
    .select('*')
    .gte('happened_at', sevenDaysAgo.toISOString())
    .order('happened_at', { ascending: false });

  const { data: recentActivity } = await supabase
    .from('activity_logs')
    .select('*')
    .gte('happened_at', sevenDaysAgo.toISOString())
    .order('happened_at', { ascending: false });

  const { data: recentMeasurements } = await supabase
    .from('body_measurements')
    .select('*')
    .gte('measured_at', sevenDaysAgo.toISOString())
    .order('measured_at', { ascending: false });

  // Health Context (Part Twelve): RLS scopes this to the current user, so no
  // explicit user_id filter is needed. Injected alongside macro/context below.
  const { data: healthContextRow } = await supabase.from('health_context').select('*').maybeSingle();
  const healthContext = (healthContextRow as HealthContext | null) ?? null;
  const healthContextBlock = buildHealthContextPrompt(healthContext);

  // Cycle phase (Part Thirteen): once a period has been logged, every
  // conversation loads the current cycle phase so weight/measurement talk is read
  // in context. Empty when cycle tracking isn't enabled. RLS scopes the read.
  const { data: lastPeriodRow } = await supabase
    .from('cycle_events')
    .select('event_date')
    .eq('event_type', 'period_start')
    .order('event_date', { ascending: false })
    .limit(1)
    .maybeSingle();
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

LOGGING INTENT: Set logIntent to 'food' if the message describes something the person ate or drank, 'activity' if it describes physical activity or exercise they did, or 'none' otherwise - INDEPENDENT of the safety classification (a genuine distress disclosure can also be a food/activity log). The app saves the data and shows the person a brief save confirmation itself, separately from your reply, so NEVER write a "Logged: ..." line, a macro breakdown, or any "I've saved that" text yourself. For a plain food/activity log with nothing more to it, a short, warm, natural reply is right (a friend's easy acknowledgement), never a functional receipt. When you classify a genuine-distress tier (eating_related_distress, grief_related_distress, acute_crisis) for a message that also logs food or activity, give the complete care-first response to the emotional content only; you may, as genuine care, gently note there is no pressure to keep logging while they are feeling like this, but only woven in naturally as care, never as a saving confirmation.

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
      enum: ['none', 'food', 'activity'],
      description:
        "'food' if the message describes something eaten or drunk, 'activity' if it describes exercise/physical activity done, else 'none'. INDEPENDENT of the safety classification - a distress disclosure can also be a food/activity log; set this to whatever is loggable regardless of emotional content.",
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
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
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
    logIntent?: 'none' | 'food' | 'activity';
    clarificationAsked?: string;
    clarificationResolved?: string;
  };

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
  let saved: { kind: 'food' | 'activity'; summary: string } | null = null;
  if (result.logIntent === 'food' || result.logIntent === 'activity') {
    try {
      if (result.logIntent === 'food') {
        const entry = await logFoodFromText(supabase, user.id, message);
        saved = { kind: 'food', summary: foodSaveSummary(entry) };
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
        if (entries[0]) saved = { kind: 'activity', summary: activitySaveSummary(entries) };
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

  const { error: insertError } = await supabase.from('chat_messages').insert({
    user_id: user.id,
    role: 'assistant',
    content: replyText,
    source: 'chat',
    classification: nextClassification,
    escalation_step: nextEscalationStep,
    distress_revisit_count: nextRevisitCount,
  });
  if (insertError) {
    console.log('ASK-UNFLUMP ASSISTANT TURN INSERT FAILED:', insertError.message);
  }

  // Only surface the disclaimer when the model flagged health-informed guidance
  // AND the person actually has stored health context - never a phantom.
  const healthGuidanceApplied =
    hasHealthContext(healthContext) && result.healthGuidanceApplied === true;

  return NextResponse.json({
    reply: replyText,
    savedContext,
    resourceCard,
    healthGuidanceApplied,
    saved,
  });
}
