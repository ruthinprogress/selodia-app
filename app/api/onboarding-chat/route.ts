import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseForRequest } from '../../lib/supabase';
import {
  CLASSIFY_TOOL_NAME,
  DISTRESS_TIERS,
  SAFETY_PROMPT_BLOCK,
  applySafetyStateMachine,
  buildClassifyTool,
  buildContextualAdditions,
  type EscalationStep,
} from '../../lib/safety-classification';
import { logFoodFromText } from '../../lib/food-logging';
import { logActivityFromText } from '../../lib/activity-logging';
import { foodSaveSummary, activitySaveSummary } from '../../lib/save-summary';
import {
  calculateBMR,
  calculateTDEE,
  normalizeHeight,
  normalizeWeight,
  proteinTargetGrams,
} from '../../lib/body-metrics';
import {
  formatActivityEcho,
  formatMeasurementEcho,
  formatProteinStatement,
  formatTDEEStatement,
} from '../../lib/onboarding-targets';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// A stronger model than the routine parsing tasks (see UNFLUMP_SPEC.md, Part
// Three): this route's classification decides whether the safety boundary fires.
const MODEL = 'claude-sonnet-5';

type Phase = 'goals' | 'technical_targets' | 'nutrition_targets' | 'activity_tdee';
const PHASES: Phase[] = ['goals', 'technical_targets', 'nutrition_targets', 'activity_tdee'];

// Shared across every onboarding phase - the fourth-wall rule and silent logging.
const ONBOARDING_COMMON = `STAY IN-WORLD - hard rule, no exceptions: you are Unflump, a finished companion in this person's world, never a product under construction. NEVER reference your own development, build status, roadmap, versions, or that anything is "built," "ready," "yet," "coming," "not available," or otherwise incomplete - not to explain why you won't do something, not in passing, not in any wording. When someone asks what happens next, or asks for specifics this conversation isn't the place for, never say or imply that anything isn't built or available yet. Answer in-world and honestly, from the product's real philosophy: the specifics grow out of understanding where someone is starting from, in their own order. Warmly let them know you'll pick things up with them from here as they're ready, without naming a specific next step as a promise or a timeline.

LOGGING - if the person mentions something they ate or drank, or physical activity they did, set logIntent to 'food' or 'activity' (else 'none'). The app saves it and shows a brief save confirmation itself, separately from your reply, so nothing they share is lost. NEVER write a "Logged: ..." line or macro breakdown yourself, and don't derail the conversation to talk about the save; just continue naturally. When you classify a genuine-distress tier for a message that also mentions food or activity, give the complete care-first response only and don't reference the saving at all.`;

const GOALS_ROLE = `You are Unflump, guiding someone through the "goals" step of onboarding for a body literacy app (Part Seven, step 8):

- Reflect the person's stated goal back in different wording, then check it feels right - never interrogate.
- Acknowledge, warmly and specifically, any constraint or context they volunteer (no time, childcare, etc.) before moving on.
- Ask how they're feeling about their health right now, and let a concrete, personally meaningful goal emerge (a dress size, a distance, a movement goal) rather than only abstract numeric targets.
- Say "reduce body fat," never "lose weight."
- Never use bullet points, headers, or clinical framing. One or two short, warm paragraphs.

CONVERSATION SCOPE - this is the goals step: helping the person arrive at a clear, meaningful goal and feel understood. Once their goal feels clear and settled, don't keep interrogating or circling it - warmly reflect that you have a real, clear picture of what matters to them, and stay present on whatever they bring up next. When they set a clear goal, set extractedGoal to it in their own words.`;

const TECHNICAL_ROLE = `You are Unflump, on the technical-tracking step of onboarding (Part Seven, step 9). Briefly and warmly explain how body composition gets tracked so the numbers mean something later - bioimpedance scales give a useful estimate, most valuable as a trend (a single reading's margin is wide, roughly plus or minus 3-5% versus a DEXA scan, so the trend matters far more than any one number); waist measurement is another simple, meaningful marker. Keep it short and demystifying, never clinical, never a lecture. Do NOT collect, calculate, or set anything up here - this step is only about understanding. If they mention an area they'd like to keep an eye on, acknowledge it warmly without setting anything up.`;

const NUTRITION_ROLE = `You are Unflump, on the nutrition-target step of onboarding (Part Seven, step 10). First check they're happy to work out a protein target now - an explicit yes, never assumed. To do it you need their height and current weight; ask warmly and accept whatever units they give (centimetres or feet/inches; kilograms, pounds, or stone). Extract exactly what they say into the height/weight fields WITHOUT converting - fill only the fields matching their units, and never put in a converted or guessed value. Do NOT state any number, target, or conversion yourself, and do NOT treat their figures as final: the app echoes the interpreted numbers back for them to confirm, and states the target itself once confirmed. Set measurementsConfirmed true ONLY on a turn where they clearly confirm the echoed numbers are right; if they correct one, extract the new value with measurementsConfirmed false.`;

const ACTIVITY_ROLE = `You are Unflump, on the activity step of onboarding (Part Seven, step 11). Ask warmly about a typical week of movement and validate whatever comes back - busy schedules, childcare, and physical jobs all count. From their description, set activityLevel to the best-fitting category: sedentary, light, moderate, active, or very_active. Do NOT state any energy or TDEE number yourself - the app echoes the level back to confirm, and states the estimate itself once confirmed. Set activityConfirmed true ONLY when they confirm the level fits; an adjustment must come with a reason (e.g. "I'm on my feet ten hours a day") - factor a real reason into a revised level, but never accept a bump with no reason. If they mention something they'd like to do but can't currently fit in, put it in deferredActivity and don't try to solve it now.`;

const PHASE_ROLE: Record<Phase, string> = {
  goals: GOALS_ROLE,
  technical_targets: TECHNICAL_ROLE,
  nutrition_targets: NUTRITION_ROLE,
  activity_tdee: ACTIVITY_ROLE,
};

// Goals uses its own clear/ambiguous goal categories; the later steps only need a
// generic non-distress class (safety still fires on top in every phase).
const PHASE_NONDISTRESS: Record<Phase, readonly string[]> = {
  goals: ['clear_goal', 'ambiguous_goal'],
  technical_targets: ['neutral'],
  nutrition_targets: ['neutral'],
  activity_tdee: ['neutral'],
};

const LOG_INTENT_PROP = {
  logIntent: {
    type: 'string',
    enum: ['none', 'food', 'activity'],
    description:
      "'food' if the message mentions something eaten or drunk, 'activity' if it mentions exercise/physical activity done, else 'none'. INDEPENDENT of the other classifications - set it whenever something loggable is mentioned.",
  },
};

function phaseExtraProps(phase: Phase): Record<string, unknown> {
  if (phase === 'goals') {
    return {
      extractedGoal: {
        type: 'string',
        description: "Only when classification is clear_goal: the concrete goal in the person's own words",
      },
      ...LOG_INTENT_PROP,
    };
  }
  if (phase === 'nutrition_targets') {
    return {
      heightCm: { type: 'number', description: 'Height in centimetres, only if given in metric' },
      heightFeet: { type: 'number', description: 'Feet part of height, only if given in feet/inches' },
      heightInches: { type: 'number', description: 'Inches part of height, only if given in feet/inches' },
      weightKg: { type: 'number', description: 'Weight in kilograms, only if given in kg' },
      weightLb: { type: 'number', description: 'Weight in pounds, only if given in pounds' },
      weightStone: { type: 'number', description: 'Stone part of weight, only if given in stone' },
      weightStoneLb: { type: 'number', description: 'Pounds part of a stone-and-pounds weight' },
      measurementsConfirmed: {
        type: 'boolean',
        description: 'True ONLY when the person confirms the echoed height/weight are right',
      },
      ...LOG_INTENT_PROP,
    };
  }
  if (phase === 'activity_tdee') {
    return {
      activityLevel: {
        type: 'string',
        enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'],
        description: 'Best-fitting activity category from their described typical week',
      },
      activityConfirmed: {
        type: 'boolean',
        description: 'True ONLY when the person confirms the echoed activity level fits',
      },
      deferredActivity: {
        type: 'string',
        description: "Something they'd like to do but can't currently fit in, to revisit later",
      },
      ...LOG_INTENT_PROP,
    };
  }
  return { ...LOG_INTENT_PROP };
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

  const { message, phase: rawPhase } = await request.json();
  const phase: Phase = PHASES.includes(rawPhase) ? rawPhase : 'goals';

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
    // unclassified logging turn can never null out an active C-SSRS ladder.
    .not('classification', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const previousEscalationStep: EscalationStep =
    (lastAssistantTurn?.escalation_step as EscalationStep) ?? null;
  const previousClassification: string | null =
    (lastAssistantTurn?.classification as string) ?? null;
  const previousRevisitCount: number = lastAssistantTurn?.distress_revisit_count ?? 0;

  // Descending + limit for the most recent 40, then reversed to chronological.
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
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content as string }));

  const systemPrompt =
    `${PHASE_ROLE[phase]}\n\n${ONBOARDING_COMMON}\n\n${SAFETY_PROMPT_BLOCK}` +
    buildContextualAdditions(previousEscalationStep, previousRevisitCount);

  const tool = buildClassifyTool(
    PHASE_NONDISTRESS[phase],
    previousEscalationStep === 'direct_asked',
    phaseExtraProps(phase)
  );

  let response;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: systemPrompt,
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
    classification: string;
    reply: string;
    extractedGoal?: string;
    resourceCardTitle?: string;
    resourceCardDescription?: string;
    revisitingPriorDisclosure?: boolean;
    logIntent?: 'none' | 'food' | 'activity';
    heightCm?: number;
    heightFeet?: number;
    heightInches?: number;
    weightKg?: number;
    weightLb?: number;
    weightStone?: number;
    weightStoneLb?: number;
    measurementsConfirmed?: boolean;
    activityLevel?: string;
    activityConfirmed?: boolean;
    deferredActivity?: string;
  };

  const { replyText, nextEscalationStep, resourceCard, nextRevisitCount, nextClassification } =
    applySafetyStateMachine(result, {
      previousEscalationStep,
      previousClassification,
      previousRevisitCount,
    });

  if (phase === 'goals' && result.classification === 'clear_goal' && result.extractedGoal) {
    const { data: existingGoal } = await supabase
      .from('user_context')
      .select('id')
      .eq('user_id', user.id)
      .eq('category', 'goal')
      .limit(1)
      .maybeSingle();
    if (existingGoal) {
      await supabase.from('user_context').update({ content: result.extractedGoal }).eq('id', existingGoal.id);
    } else {
      await supabase.from('user_context').insert({ user_id: user.id, category: 'goal', content: result.extractedGoal });
    }
  }

  // Silent food/activity logging (all phases); confirmed via the ephemeral client
  // toast (`saved`), never the reply. On failure `saved` stays null.
  let saved: { kind: 'food' | 'activity'; summary: string } | null = null;
  if (result.logIntent === 'food' || result.logIntent === 'activity') {
    try {
      if (result.logIntent === 'food') {
        const entry = await logFoodFromText(supabase, user.id, message);
        saved = { kind: 'food', summary: foodSaveSummary(entry) };
      } else {
        const entries = await logActivityFromText(supabase, user.id, message);
        if (entries[0]) saved = { kind: 'activity', summary: activitySaveSummary(entries) };
      }
    } catch (err) {
      console.log('ONBOARDING-CHAT SILENT LOG FAILED:', err instanceof Error ? err.message : err);
    }
  }

  // Deterministic numeric turns (decision A): every stated figure is built in code
  // here via reply-override, never by the model. Safety always wins - a distress
  // turn keeps the care-first reply and skips the target logic entirely.
  let finalReply = replyText;
  const isDistressTurn =
    (DISTRESS_TIERS as readonly string[]).includes(nextClassification) || nextEscalationStep !== null;

  if (!isDistressTurn && phase === 'nutrition_targets') {
    const h = normalizeHeight({ cm: result.heightCm, feet: result.heightFeet, inches: result.heightInches });
    const w = normalizeWeight({
      kg: result.weightKg,
      lb: result.weightLb,
      stone: result.weightStone,
      stoneLb: result.weightStoneLb,
    });
    if (result.measurementsConfirmed && h != null && w != null) {
      await supabase.from('user_profile').upsert({ user_id: user.id, height_cm: h });
      await supabase
        .from('body_measurements')
        .insert({ user_id: user.id, weight_kg: w, measured_at: new Date().toISOString() });
      const { data: mm } = await supabase
        .from('body_measurements')
        .select('muscle_kg')
        .not('muscle_kg', 'is', null)
        .order('measured_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const target = proteinTargetGrams(mm?.muscle_kg ?? null, w);
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { data: todayFood } = await supabase
        .from('food_logs')
        .select('protein_g')
        .gte('happened_at', startOfDay.toISOString());
      const loggedToday = Math.round(
        (todayFood ?? []).reduce((s: number, f: { protein_g: number | null }) => s + (f.protein_g ?? 0), 0)
      );
      if (target != null) finalReply = formatProteinStatement(target, loggedToday);
    } else if (h != null || w != null) {
      finalReply = formatMeasurementEcho(h, w);
    }
  } else if (!isDistressTurn && phase === 'activity_tdee') {
    if (result.deferredActivity) {
      const { data: prof } = await supabase.from('user_profile').select('deferred_topics').maybeSingle();
      const topics = Array.isArray(prof?.deferred_topics) ? prof.deferred_topics : [];
      await supabase
        .from('user_profile')
        .upsert({ user_id: user.id, deferred_topics: [...topics, { topic: result.deferredActivity, at: new Date().toISOString() }] });
    }
    const level = result.activityLevel;
    if (result.activityConfirmed && level) {
      await supabase.from('user_profile').upsert({ user_id: user.id, activity_level: level });
      const { data: prof } = await supabase
        .from('user_profile')
        .select('height_cm, date_of_birth, biological_sex')
        .maybeSingle();
      const { data: lw } = await supabase
        .from('body_measurements')
        .select('weight_kg')
        .not('weight_kg', 'is', null)
        .order('measured_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const bmr = calculateBMR({
        weightKg: lw?.weight_kg,
        heightCm: prof?.height_cm,
        dateOfBirth: prof?.date_of_birth,
        biologicalSex: prof?.biological_sex,
      });
      const tdee = calculateTDEE(bmr, level);
      if (tdee != null) finalReply = formatTDEEStatement(tdee);
    } else if (level) {
      finalReply = formatActivityEcho(level);
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
    saved,
  });
}
