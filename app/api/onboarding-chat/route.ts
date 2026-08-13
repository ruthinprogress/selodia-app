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
import { logFoodFromText } from '../../lib/food-logging';
import { logActivityFromText } from '../../lib/activity-logging';
import { buildLoggedReply } from '../../lib/chat-reply';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// A stronger, more capable model than the one used for routine parsing
// tasks (see UNFLUMP_SPEC.md, Part Three) - this route's classification
// decides whether the safety boundary fires, so it warrants more reasoning
// capability than extracting macros from a food description does.
const MODEL = 'claude-sonnet-5';

const NON_DISTRESS_CLASSIFICATIONS = ['clear_goal', 'ambiguous_goal'] as const;
type Classification = (typeof NON_DISTRESS_CLASSIFICATIONS)[number] | import('../../lib/safety-classification').DistressTier;

const SYSTEM_PROMPT = `You are Unflump, guiding someone through the "goals" step of onboarding for a body literacy app. Your job here follows Part Seven, step 8 of the build spec:

- Reflect the person's stated goal back in different wording, then check it feels right - never interrogate.
- Acknowledge, warmly and specifically, any constraint or context they volunteer (no time, childcare, etc.) before moving on.
- Ask how they're feeling about their health right now, and let a concrete, personally meaningful goal emerge (a dress size, a distance, a movement goal) rather than only abstract numeric targets.
- Say "reduce body fat," never "lose weight."
- Never use bullet points, headers, or clinical framing. One or two short, warm paragraphs.

CONVERSATION SCOPE - this conversation is the goals step: helping the person arrive at a clear, meaningful goal and feel understood. Once their goal feels clear and settled to them, don't keep interrogating or circling it - warmly reflect that you have a real, clear picture of what matters to them, and stay present on whatever they bring up next. Don't announce or name a specific next topic ("next we'll talk about your routine," "let's move to the next step") as a promise - just be present.

STAY IN-WORLD - hard rule, no exceptions: you are Unflump, a finished companion in this person's world, never a product under construction. NEVER reference your own development, build status, roadmap, versions, or that anything is "built," "ready," "yet," "coming," "not available," or otherwise incomplete - not to explain why you won't do something, not in passing, not in any wording. When someone asks what happens next, or asks for specifics this conversation isn't the place for (daily targets, exact numbers, a training plan, TDEE), never say or imply that anything isn't built or available yet. Answer in-world and honestly, from the product's real philosophy: the specifics grow out of the goal, in their own order, and you don't rush to numbers before you understand where someone is starting from. For example: "The targets and the numbers come out of this - I wouldn't want to hand you a figure before I really understand your starting point. For now I've got a clear picture of where you want to go." Warmly let them know you'll pick things up with them from here as they're ready, as part of their journey - without naming a specific next step as a promise or a timeline.

LOGGING - if the person mentions something they ate or drank, or physical activity they did, set logIntent to 'food' or 'activity' (else 'none'). The app quietly saves it, separately from your reply, so nothing they share is lost - even mid goal-setting. Do not produce a "Logged: ..." line yourself and do not derail the goals conversation to talk about the log; just continue naturally. When you classify a genuine-distress tier for a message that also mentions food or activity, give the complete care-first response only and do not reference the logging at all.

${SAFETY_PROMPT_BLOCK}`;

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

  const { error: userInsertError } = await supabase
    .from('chat_messages')
    .insert({ user_id: user.id, role: 'user', content: message, source: 'onboarding' });
  if (userInsertError) {
    console.log('ONBOARDING-CHAT USER TURN INSERT FAILED:', userInsertError.message);
  }

  const { data: lastAssistantTurn } = await supabase
    .from('chat_messages')
    .select('classification, escalation_step, distress_revisit_count')
    .eq('user_id', user.id)
    .eq('source', 'onboarding')
    .eq('role', 'assistant')
    // Read-hardening: only safety-classified turns carry escalation state, so an
    // unclassified logging turn can never null out an active C-SSRS ladder by
    // being the most recent assistant row. See ask-unflump for the rationale.
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
  // assistant turn, which the model rejects outright.
  const { data: recentHistory } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('user_id', user.id)
    .eq('source', 'onboarding')
    .order('created_at', { ascending: false })
    .limit(40);

  const messages = (recentHistory ?? [])
    .slice()
    .reverse()
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content as string,
    }));

  const contextualSystemPrompt =
    SYSTEM_PROMPT + buildContextualAdditions(previousEscalationStep, previousRevisitCount);

  const tool = buildClassifyTool(NON_DISTRESS_CLASSIFICATIONS, previousEscalationStep === 'direct_asked', {
    extractedGoal: {
      type: 'string',
      description: 'Only when classification is clear_goal: the concrete goal in the person\'s own words',
    },
    logIntent: {
      type: 'string',
      enum: ['none', 'food', 'activity'],
      description:
        "'food' if the message mentions something eaten or drunk, 'activity' if it mentions exercise/physical activity done, else 'none'. INDEPENDENT of the goal and safety classification - set it whenever something loggable is mentioned, so it can be saved even during goal-setting.",
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
    extractedGoal?: string;
    resourceCardTitle?: string;
    resourceCardDescription?: string;
    revisitingPriorDisclosure?: boolean;
    logIntent?: 'none' | 'food' | 'activity';
  };

  const { replyText, nextEscalationStep, resourceCard, nextRevisitCount, nextClassification } =
    applySafetyStateMachine(result, {
      previousEscalationStep,
      previousClassification,
      previousRevisitCount,
    });

  if (result.classification === 'clear_goal' && result.extractedGoal) {
    const { data: existingGoal } = await supabase
      .from('user_context')
      .select('id')
      .eq('user_id', user.id)
      .eq('category', 'goal')
      .limit(1)
      .maybeSingle();

    if (existingGoal) {
      await supabase
        .from('user_context')
        .update({ content: result.extractedGoal })
        .eq('id', existingGoal.id);
    } else {
      await supabase
        .from('user_context')
        .insert({ user_id: user.id, category: 'goal', content: result.extractedGoal });
    }
  }

  // Silent food/activity logging during onboarding, mirroring ask-unflump. A
  // user can mention food (often a distress disclosure) mid goal-setting; we
  // capture it as data and let the safety classification govern the reply via
  // buildLoggedReply. For the goal classifications (clear_goal/ambiguous_goal,
  // never 'neutral') the matrix logs silently with no "Logged:" bubble, keeping
  // the goals conversation on track; distress+food still gets care-first + ack.
  let finalReply = replyText;
  if (result.logIntent === 'food' || result.logIntent === 'activity') {
    try {
      let loggedLabel: string | null = null;
      let loggedLine: string | null = null;
      if (result.logIntent === 'food') {
        const entry = await logFoodFromText(supabase, user.id, message);
        loggedLabel = entry.meal_label;
        loggedLine = `Logged: ${entry.meal_label} — ${entry.kcal} kcal, ${entry.protein_g}g protein, ${entry.carbs_g}g carbs, ${entry.fat_g}g fat.`;
      } else {
        const entries = await logActivityFromText(supabase, user.id, message);
        if (entries[0]) {
          loggedLabel = entries[0].activity_type;
          loggedLine = `Logged: ${entries
            .map((e) => `${e.activity_type} — ${e.duration_min} min, ${e.kcal_burned} kcal burned`)
            .join('; ')}.`;
        }
      }
      finalReply = buildLoggedReply({
        replyText,
        nextClassification,
        nextEscalationStep,
        loggedLabel,
        loggedLine,
      });
    } catch (err) {
      console.log('ONBOARDING-CHAT SILENT LOG FAILED:', err instanceof Error ? err.message : err);
    }
  }

  const { error: insertError } = await supabase.from('chat_messages').insert({
    user_id: user.id,
    role: 'assistant',
    content: finalReply,
    source: 'onboarding',
    classification: nextClassification,
    escalation_step: nextEscalationStep,
    distress_revisit_count: nextRevisitCount,
  });
  if (insertError) {
    console.log('ONBOARDING-CHAT ASSISTANT TURN INSERT FAILED:', insertError.message);
  }

  return NextResponse.json({
    reply: finalReply,
    classification: nextClassification,
    resourceCard,
  });
}
