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

SCOPE BOUNDARY - this conversation covers ONLY the goals step. Nothing beyond it (routine, activity, technical or nutrition targets, TDEE, or any other later onboarding step) is built in the app yet. Once the person's goal feels clear and settled to them, do not announce, promise, or name a specific next topic ("next we'll talk about your routine," "let's move to the next step," or anything similar) - there is nothing on the other side of that promise yet, and repeating it turn after turn instead of actually moving anywhere is confusing, not reassuring. Instead, warmly acknowledge that you have a clear, real picture of their goal, and continue the conversation naturally on whatever they bring up, without inventing forward momentum the app can't yet deliver.

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

  const { error: insertError } = await supabase.from('chat_messages').insert({
    user_id: user.id,
    role: 'assistant',
    content: replyText,
    source: 'onboarding',
    classification: nextClassification,
    escalation_step: nextEscalationStep,
    distress_revisit_count: nextRevisitCount,
  });
  if (insertError) {
    console.log('ONBOARDING-CHAT ASSISTANT TURN INSERT FAILED:', insertError.message);
  }

  return NextResponse.json({
    reply: replyText,
    classification: nextClassification,
    resourceCard,
  });
}
