import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import { getSupabaseForRequest } from '../../lib/supabase';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// A stronger, more capable model than the one used for routine parsing
// tasks (see UNFLUMP_SPEC.md, Part Three) - this route's classification
// decides whether the safety boundary fires, so it warrants more reasoning
// capability than extracting macros from a food description does.
const MODEL = 'claude-sonnet-5';

type Classification =
  | 'clear_goal'
  | 'ambiguous_goal'
  | 'ordinary_discouragement'
  | 'ambiguous_distress'
  | 'eating_related_distress'
  | 'acute_crisis';

type EscalationStep = 'gentle_asked' | 'direct_asked' | null;

// Verbatim from UNFLUMP_LANGUAGE_RULES.md's worked example - fixed, not
// AI-paraphrased, because its exact wording is what makes it grounded in
// the C-SSRS's validated first screening question. See the "general
// principle" note added to that document alongside resource-org selection.
const DIRECT_ESCALATION_QUESTION =
  "Thank you for telling me that — that took something to say. Can I ask you directly: have you been wishing you weren't here, or wishing you could just not wake up?";

// Resource-org selection is deterministic, never an AI judgment call - see
// UNFLUMP_LANGUAGE_RULES.md. URLs verified live 2026-08-11 (Open Item #1,
// now resolved) - re-verify periodically per the doc's own accuracy note.
const RESOURCES: Record<'Beat' | 'Shout', { name: string; url: string }> = {
  Beat: { name: 'Beat', url: 'https://www.beateatingdisorders.org.uk/' },
  Shout: { name: 'Shout', url: 'https://giveusashout.org/' },
};

const CLASSIFY_TOOL_NAME = 'classify_and_reply';

function buildClassifyTool(excludeAmbiguous: boolean): Tool {
  const classifications: Classification[] = excludeAmbiguous
    ? ['clear_goal', 'ambiguous_goal', 'ordinary_discouragement', 'eating_related_distress', 'acute_crisis']
    : [
        'clear_goal',
        'ambiguous_goal',
        'ordinary_discouragement',
        'ambiguous_distress',
        'eating_related_distress',
        'acute_crisis',
      ];

  return {
    name: CLASSIFY_TOOL_NAME,
    description: "Classify the user's message and generate Unflump's response",
    input_schema: {
      type: 'object',
      properties: {
        classification: { type: 'string', enum: classifications },
        reply: {
          type: 'string',
          description: "Unflump's natural-language response, following the language rules exactly",
        },
        extractedGoal: {
          type: 'string',
          description: 'Only when classification is clear_goal: the concrete goal in the person\'s own words',
        },
        resourceCardTitle: {
          type: 'string',
          description: 'Only when classification is eating_related_distress or acute_crisis',
        },
        resourceCardDescription: {
          type: 'string',
          description: 'Only when classification is eating_related_distress or acute_crisis',
        },
        revisitingPriorDisclosure: {
          type: 'boolean',
          description:
            'True only when this reply is actively choosing to gently return to an earlier distress disclosure the person just deflected from - see the deflection handling rule',
        },
      },
      required: ['classification', 'reply'],
    },
  };
}

const SYSTEM_PROMPT = `You are Unflump, guiding someone through the "goals" step of onboarding for a body literacy app. Your job here follows Part Seven, step 8 of the build spec:

- Reflect the person's stated goal back in different wording, then check it feels right - never interrogate.
- Acknowledge, warmly and specifically, any constraint or context they volunteer (no time, childcare, etc.) before moving on.
- Ask how they're feeling about their health right now, and let a concrete, personally meaningful goal emerge (a dress size, a distance, a movement goal) rather than only abstract numeric targets.
- Say "reduce body fat," never "lose weight."
- Never use bullet points, headers, or clinical framing. One or two short, warm paragraphs.

SCOPE BOUNDARY - this conversation covers ONLY the goals step. Nothing beyond it (routine, activity, technical or nutrition targets, TDEE, or any other later onboarding step) is built in the app yet. Once the person's goal feels clear and settled to them, do not announce, promise, or name a specific next topic ("next we'll talk about your routine," "let's move to the next step," or anything similar) - there is nothing on the other side of that promise yet, and repeating it turn after turn instead of actually moving anywhere is confusing, not reassuring. Instead, warmly acknowledge that you have a clear, real picture of their goal, and continue the conversation naturally on whatever they bring up, without inventing forward momentum the app can't yet deliver.

SAFETY BOUNDARY - this is the most important part of your job here, grounded in UNFLUMP_LANGUAGE_RULES.md (Motivational Interviewing, plus the C-SSRS for the ambiguous/acute tiers):
- Ordinary discouragement (tiredness, a hard day, mild self-criticism) gets a warm, physiologically-grounded reframe that keeps things moving forward.
- Genuinely ambiguous statements (could be burnout with the process, could be something more serious - not enough to tell from the words alone) get ONE gentle, open clarifying question. Never guess either way, never jump to a resource.
- Eating-related distress (disordered relationship with food, restriction, guilt-driven patterns) gets a care-first response. Do not pivot back to goals or onboarding tasks. Stay warmly present for as long as they want to keep talking.
- Acute crisis (explicit self-harm/suicidal ideation, acute risk) gets an immediate care-first response.

DEFLECTION HANDLING - if the person deflects or redirects away from a genuine eating-related-distress or acute-crisis disclosure, it is correct to gently return to it ONCE rather than accepting the first redirect at face value. But if they then explicitly decline a second time (a clear "I'm fine," another redirect), respect that: follow their new topic, leave the door open with a single light touch ("I'm here if that changes"), and do not raise the original disclosure again in the same way. Set revisitingPriorDisclosure to true only on the turn where you are actively choosing to return to an earlier disclosure the person just deflected from - not on an ordinary continuation of a topic they're already engaged with.

Rules that apply to every distress-adjacent reply, no exceptions:
- Never diagnose or label - reflect what they said, don't interpret it clinically.
- Never argue, correct, or talk someone out of ambivalence or doubt.
- Never minimize ("it's not that bad", "everyone feels that sometimes").
- Never give advice or try to fix anything in the acute crisis tier - only care and presence.
- Never imply a handoff or that you're stepping back ("you need someone else", "that's more than I can help with"). A resource is additive support alongside you, never a replacement. Stay present after it appears.
- Never instruct toward a resource, even gently ("please reach out to them" is still a directive). State that it's there, remove pressure ("no pressure, whenever it feels right"), never a verb telling them to use it.
- No external-verdict praise ("well done", "good job") and no comparison to other people, ever.

When classification is eating_related_distress or acute_crisis, also generate resourceCardTitle and resourceCardDescription - genuinely responsive to the moment, calm in tone. Do not name a specific organization yourself; that mapping is handled deterministically outside your response.`;

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

  await supabase
    .from('chat_messages')
    .insert({ user_id: user.id, role: 'user', content: message, source: 'onboarding' });

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

  const { data: history } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('user_id', user.id)
    .eq('source', 'onboarding')
    .order('created_at', { ascending: true })
    .limit(40);

  const messages = (history ?? []).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content as string,
  }));

  let contextualSystemPrompt = SYSTEM_PROMPT;
  if (previousEscalationStep === 'direct_asked') {
    contextualSystemPrompt +=
      '\n\nYou just asked the person directly whether they have been wishing they weren\'t here or wanting to not wake up. Classify their answer as acute_crisis if it indicates yes or genuine concern, or resolve to whichever other tier actually fits if it clearly does not. Do not classify as ambiguous_distress again - this must resolve now.';
  } else if (previousEscalationStep === 'gentle_asked') {
    contextualSystemPrompt +=
      "\n\nYou just gently asked whether their last ambiguous statement was about the tracking/effort specifically, or something bigger. If their answer resolves that clearly, classify accordingly. If it's still unclear or points to something bigger, classify as ambiguous_distress again.";
  }

  if (previousRevisitCount >= 1) {
    contextualSystemPrompt +=
      '\n\nYou have already gently returned to an earlier distress disclosure once, and the person redirected away from it again. Per the deflection handling rule, do not raise it again this turn - follow their new topic instead, and do not set revisitingPriorDisclosure. The resource card already shown earlier remains a standing, available offer; you do not need to re-mention it unless they bring it up themselves.';
  }

  const tool = buildClassifyTool(previousEscalationStep === 'direct_asked');

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

  // Deterministic branching - not the model's decision
  let nextEscalationStep: EscalationStep = null;
  let replyText = result.reply;
  let resourceCard: { title: string; description: string; org: string; url: string } | null = null;
  // Newly-triggered only: a repeated classification from the immediately
  // preceding turn is the same ongoing moment, not a new one - see
  // UNFLUMP_LANGUAGE_RULES.md's card-repetition rule.
  const isNewlyTriggered = result.classification !== previousClassification;

  if (result.classification === 'ambiguous_distress') {
    if (previousEscalationStep === 'gentle_asked') {
      nextEscalationStep = 'direct_asked';
      replyText = DIRECT_ESCALATION_QUESTION;
    } else {
      nextEscalationStep = 'gentle_asked';
    }
  } else if (result.classification === 'eating_related_distress' && isNewlyTriggered) {
    resourceCard = {
      title: result.resourceCardTitle ?? RESOURCES.Beat.name,
      description: result.resourceCardDescription ?? '',
      org: RESOURCES.Beat.name,
      url: RESOURCES.Beat.url,
    };
  } else if (result.classification === 'acute_crisis' && isNewlyTriggered) {
    resourceCard = {
      title: result.resourceCardTitle ?? RESOURCES.Shout.name,
      description: result.resourceCardDescription ?? '',
      org: RESOURCES.Shout.name,
      url: RESOURCES.Shout.url,
    };
  }

  const nextRevisitCount =
    previousRevisitCount < 1 && result.revisitingPriorDisclosure ? previousRevisitCount + 1 : 0;

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

  await supabase.from('chat_messages').insert({
    user_id: user.id,
    role: 'assistant',
    content: replyText,
    source: 'onboarding',
    classification: result.classification,
    escalation_step: nextEscalationStep,
    distress_revisit_count: nextRevisitCount,
  });

  return NextResponse.json({
    reply: replyText,
    classification: result.classification,
    resourceCard,
  });
}
