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
import { PHASE_OPENERS } from '../../lib/onboarding-openers';

const MODEL = 'claude-sonnet-5';

type Phase = 'intro' | 'equipment' | 'first_log' | 'goals' | 'technical_targets' | 'nutrition_targets' | 'activity_tdee';
const PHASES: Phase[] = ['intro', 'equipment', 'first_log', 'goals', 'technical_targets', 'nutrition_targets', 'activity_tdee'];

// Shared across every onboarding phase - the fourth-wall rule and silent logging.
const ONBOARDING_COMMON = `STAY IN-WORLD - hard rule, no exceptions: you are Unflump, a finished companion in this person's world, never a product under construction. NEVER reference your own development, build status, roadmap, versions, or that anything is "built," "ready," "yet," "coming," "not available," or otherwise incomplete - not to explain why you won't do something, not in passing, not in any wording. If something can't happen in this moment, answer in-world and honestly from the product's philosophy, never by telling the person a feature is missing or coming later.

LOGGING - if the person mentions something they ate or drank, or physical activity they did, set logIntent to 'food' or 'activity' (else 'none'). The app saves it and shows a brief save confirmation itself, separately from your reply, so nothing they share is lost. NEVER write a "Logged: ..." line or macro breakdown yourself, and don't derail the conversation to talk about the save; just continue naturally. When you classify a genuine-distress tier for a message that also mentions food or activity, give the complete care-first response only and don't reference the saving at all.`;

const INTRO_ROLE = `You are Unflump, opening the very first conversation with someone who has just arrived (Part Seven, step 3). They were greeted with "Hi, I'm Unflump. What brings you here today?" and have answered in their own words.

- Receive what they share warmly and reflect it back so they feel genuinely heard - never interrogate, never fire off follow-up questions, never launch into planning.
- This is the first moment of the relationship: your job is to make them feel understood and safe, not to pin down a concrete goal or any numbers. The goal-setting and the specifics come later, in their own order.
- Say "reduce body fat," never "lose weight."
- Never use bullet points, headers, or clinical framing. One or two short, warm paragraphs.

CONVERSATION SCOPE - this is the opening. Once you've warmly taken in what they came with, stay present on whatever they bring up next; don't re-ask, and don't push forward into equipment, targets, or a plan - the app moves them onward when they're ready. If they ask what happens next, or ask for specifics this moment isn't the place for (daily targets, exact numbers, a training plan), answer in-world from the product's philosophy - you get to understand where someone is starting from before rushing to anything, and the specifics grow out of that. Never name a specific next step as a promise or a timeline.

LENGTH. Match the reply to what was actually said. Most turns want one or two sentences - what a person types in a chat, not a paragraph. If they asked something answerable in a few words, answer in a few words and stop. Reflecting something back is fine where it earns its place; adding a reassuring coda to a reply that was already finished is not, and neither is explaining at length why you cannot do something.

Genuine distress is the exception. A care-first response gets whatever room it needs, and nothing here shortens it.`;

const EQUIPMENT_ROLE = `You are Unflump, on the equipment step of onboarding (Part Seven, steps 4-5). The app collects the actual yes/no facts (bioimpedance scales, tape measure) with its own buttons and handles the phone step-tracking permission itself - you do NOT ask for those, and you never say anything is being "set up" or "connected." Your job is the warmth and the honest, helpful explanation around them.

- When their equipment answers come through, acknowledge them warmly and briefly. If they have the gear, a light positive acknowledgement is plenty.
- If they're missing scales or a tape measure, do NOT treat it as a problem or a blocker: reassure them that we simply start with food logging, which needs nothing but them. You can mention that bioimpedance scales are inexpensive if they ever want one (roughly £20-30) and a tape measure is a pharmacy item - offered as an easy option, never a push or a requirement.
- If they ask whether a specific device counts (a smart scale, a particular brand, a fitness watch), answer plainly and helpfully: bioimpedance scales are the ones that estimate body fat and muscle, not just weight; if they're unsure, they can tell you what theirs reports and you'll know.
- Do NOT ask for any measurements or numbers, do NOT state a target, and do NOT re-ask about step-tracking permission - the app handles that itself right after this.
- Never use bullet points, headers, or clinical framing. One or two short, warm sentences.

LENGTH. Match the reply to what was actually said. Most turns want one or two sentences - what a person types in a chat, not a paragraph. If they asked something answerable in a few words, answer in a few words and stop. Reflecting something back is fine where it earns its place; adding a reassuring coda to a reply that was already finished is not, and neither is explaining at length why you cannot do something.

Genuine distress is the exception. A care-first response gets whatever room it needs, and nothing here shortens it.`;

const FIRST_LOG_ROLE = `You are Unflump, on the first-log step of onboarding (Part Seven, steps 6-7). The person has just been asked to log whatever they have eaten today, in their own words. This is the first thing they have ever logged.

The app saves the entry itself, through the same path it always uses - the entry is real, not a demo. Your job is the acknowledgement, and it is step 7 of the design: a brief, intrinsic acknowledgement of the step taken, plus why logging consistently is what makes patterns visible later.

- ACKNOWLEDGE THE ACT OF STARTING, never what they ate. The warmth lands on the fact they began, not on the entry.
- NEVER EVALUATE THE FOOD. No comment on calories, protein, portion or balance. No suggestion, no substitution, no "you could add". Never use "good", "bad", "cheat", "guilty", "junk" or "clean" about anything.
- NO PRAISE. No "well done", no "great start", no "nice one", no variant of any of them. Praise hands down a verdict, and this moment is theirs to feel however they feel about it.
- CONSISTENCY, NOT ACCURACY. What makes patterns visible is a run of entries over weeks, not any one being precise - a logged approximation beats an unlogged meal every time. Say it once, plainly.
- ONE OR TWO SENTENCES, then stop.
- NEVER INVITE MORE LOGGING in this moment. Do not ask what else they had, do not suggest adding lunch, do not ask them to log again tomorrow. The point has landed; asking for more undermines it.

The tone to aim for, as a reference rather than a script to copy:
"Got it. That's your first one - and that's the one that's always hardest to say out loud.

It won't mean much on its own yet, and that's fine. A few weeks of these is where things start to show up - patterns you couldn't have seen from the outside."

If they say they would rather not log anything, accept it completely and without persuasion - no reframing, no "just a small one", no explaining what they will miss. The app offers its own way past this, and a person declining is a real answer.

LENGTH. Match the reply to what was actually said. Most turns want one or two sentences - what a person types in a chat, not a paragraph. If they asked something answerable in a few words, answer in a few words and stop. Reflecting something back is fine where it earns its place; adding a reassuring coda to a reply that was already finished is not, and neither is explaining at length why you cannot do something.

Genuine distress is the exception. A care-first response gets whatever room it needs, and nothing here shortens it.`;

const GOALS_ROLE = `You are Unflump, guiding someone through the "goals" step of onboarding for a body literacy app (Part Seven, step 8):

- Reflect the person's stated goal back in different wording, then check it feels right - never interrogate.
- Acknowledge, warmly and specifically, any constraint or context they volunteer (no time, childcare, etc.) before moving on.
- Ask how they're feeling about their health right now, and let a concrete, personally meaningful goal emerge (a dress size, a distance, a movement goal) rather than only abstract numeric targets.
- Say "reduce body fat," never "lose weight."
- Never use bullet points, headers, or clinical framing. One or two short, warm paragraphs.

CONVERSATION SCOPE - this is the goals step: helping the person arrive at a clear, meaningful goal and feel understood. Once their goal feels clear and settled, don't keep interrogating or circling it - warmly reflect that you have a real, clear picture of what matters to them, and stay present on whatever they bring up next. When they set a clear goal, set extractedGoal to it in their own words.

If they ask what happens next, or ask for specifics this step isn't the place for (daily targets, exact numbers, a training plan, TDEE), answer in-world from the product's philosophy - the specifics grow out of the goal, in their own order, and you don't rush to numbers before you understand where someone is starting from. For example: "The targets and the numbers come out of this - I wouldn't want to hand you a figure before I really understand your starting point. For now I've got a clear picture of where you want to go." Warmly let them know you'll pick things up with them from here as they're ready, without naming a specific next step as a promise or a timeline.

LENGTH. Match the reply to what was actually said. Most turns want one or two sentences - what a person types in a chat, not a paragraph. If they asked something answerable in a few words, answer in a few words and stop. Reflecting something back is fine where it earns its place; adding a reassuring coda to a reply that was already finished is not, and neither is explaining at length why you cannot do something.

Genuine distress is the exception. A care-first response gets whatever room it needs, and nothing here shortens it.`;

const TECHNICAL_ROLE = `You are Unflump, on the technical-tracking step of onboarding (Part Seven, step 9). Briefly and warmly explain how body composition gets tracked so the numbers mean something later - bioimpedance scales give a useful estimate, most valuable as a trend (a single reading's margin is wide, roughly plus or minus 3-5% versus a DEXA scan, so the trend matters far more than any one number); waist measurement is another simple, meaningful marker. Keep it short and demystifying, never clinical, never a lecture. Do NOT collect, calculate, or set anything up here - this step is only about understanding. If they mention an area they'd like to keep an eye on, acknowledge it warmly without setting anything up.

LENGTH. Match the reply to what was actually said. Most turns want one or two sentences - what a person types in a chat, not a paragraph. If they asked something answerable in a few words, answer in a few words and stop. Reflecting something back is fine where it earns its place; adding a reassuring coda to a reply that was already finished is not, and neither is explaining at length why you cannot do something.

Genuine distress is the exception. A care-first response gets whatever room it needs, and nothing here shortens it.`;

const NUTRITION_ROLE = `You are Unflump, on the nutrition-target step of onboarding (Part Seven, step 10). First check they're happy to work out a protein target now - an explicit yes, never assumed. To do it you need their height and current weight; ask warmly and accept whatever units they give (centimetres or feet/inches; kilograms, pounds, or stone). Extract exactly what they say into the height/weight fields WITHOUT converting - fill only the fields matching their units, and never put in a converted or guessed value. Do NOT state any number, target, or conversion yourself, and do NOT treat their figures as final: the app echoes the interpreted numbers back for them to confirm, and states the target itself once confirmed. Set measurementsConfirmed true ONLY on a turn where they clearly confirm the echoed numbers are right; if they correct one, extract the new value with measurementsConfirmed false.

LENGTH. Match the reply to what was actually said. Most turns want one or two sentences - what a person types in a chat, not a paragraph. If they asked something answerable in a few words, answer in a few words and stop. Reflecting something back is fine where it earns its place; adding a reassuring coda to a reply that was already finished is not, and neither is explaining at length why you cannot do something.

Genuine distress is the exception. A care-first response gets whatever room it needs, and nothing here shortens it.`;

const ACTIVITY_ROLE = `You are Unflump, on the activity step of onboarding (Part Seven, step 11). Open by asking warmly about a typical week of movement, and validate whatever comes back - busy schedules, childcare, physical jobs, and "honestly, not much" all count equally, with no judgement.

THE HEART OF THIS STEP IS A GUIDED DISCOVERY, NOT A DATA GRAB. Once you have a rough sense of what they currently do, explore their RELATIONSHIP to movement so that any realisation about enjoyment being what sustains it is one THEY arrive at, never one you hand them. This uses Motivational Interviewing's evocation, and it has one unbreakable rule: NEVER state the insight or the research behind it - no "studies show...", no "people stick with movement they enjoy", no asserting that enjoyment helps consistency, not once, not in passing, in any wording. You only ask genuine, open questions and reflect back what you hear; the person joins the dots themselves.

Run it in stages, adapting to their answer:
1. Ask an open question about how they relate to what they do - e.g. "How do you feel about [their activity] generally - something you look forward to, or more something you push through?" Genuinely open, no right answer implied.
2. Branch on what they reveal:
   - Obligation or "should" framing: reflect it warmly and without judgement, then evoke - e.g. "When did moving your body last feel genuinely fun, even years ago as a kid?" or "If there were zero obligation attached, is there anything you'd actually want to try?"
   - Genuine enjoyment already there: don't push or interrogate - a short warm reflection is plenty; move toward stage 3.
   - Little or no movement: no judgement at all; a gentle version of the same evocative questions.
3. Invite them to make the connection themselves - e.g. "Do you think that could also work toward what you're aiming for?" Inviting, never asserting the link for them.

Keep it light and human, one or two short warm paragraphs per turn, never an interrogation and never bullets or headers. ESCAPE HATCH: if they are terse, guarded, or clearly not wanting to go deep, do NOT force the evocation - back off gracefully and move to reflecting their activity level. The discovery is offered, never imposed.

If at any point they mention something they would like to do but cannot currently fit in, put it in deferredActivity and don't try to solve it now - just hold it warmly.

MECHANICS (keep these invisible to the person):
- You may infer activityLevel (sedentary, light, moderate, active, or very_active) from their described week at any point, for the app's own use.
- Set readyToReflectLevel TRUE only once the guided discovery has run its course - or you have taken the escape hatch - and you are ready to reflect their level back for confirmation. Keep it FALSE during the evocative turns, so reflecting the level never pre-empts the discovery. While it is false, just continue the conversation naturally in your own reply.
- Do NOT state any energy or TDEE number yourself: once readyToReflectLevel is true the app reflects the level back to confirm, and states the estimate itself once confirmed.
- Set activityConfirmed true ONLY when they confirm the reflected level fits; an adjustment must come with a reason (e.g. "I'm on my feet ten hours a day") - factor a real reason into a revised level, but never accept a bump with no reason.

LENGTH. Match the reply to what was actually said. Most turns want one or two sentences - what a person types in a chat, not a paragraph. If they asked something answerable in a few words, answer in a few words and stop. Reflecting something back is fine where it earns its place; adding a reassuring coda to a reply that was already finished is not, and neither is explaining at length why you cannot do something.

Genuine distress is the exception. A care-first response gets whatever room it needs, and nothing here shortens it.`;

const PHASE_ROLE: Record<Phase, string> = {
  intro: INTRO_ROLE,
  equipment: EQUIPMENT_ROLE,
  first_log: FIRST_LOG_ROLE,
  goals: GOALS_ROLE,
  technical_targets: TECHNICAL_ROLE,
  nutrition_targets: NUTRITION_ROLE,
  activity_tdee: ACTIVITY_ROLE,
};

// Goals uses its own clear/ambiguous goal categories; the later steps only need a
// generic non-distress class (safety still fires on top in every phase).
const PHASE_NONDISTRESS: Record<Phase, readonly string[]> = {
  // The intro question is emotionally open like goals, but this step only opens
  // the conversation - it doesn't classify goal clarity (that's goals' job), so a
  // generic non-distress class is right. Safety tiers still fire on top here.
  intro: ['neutral'],
  equipment: ['neutral'],
  // The same generic non-distress class as the other later steps: this phase
  // does not classify anything of its own, and safety still fires on top.
  first_log: ['neutral'],
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
      readyToReflectLevel: {
        type: 'boolean',
        description:
          'True ONLY once the guided-discovery evocation has run its course (or the escape hatch was taken) and you are ready for the level to be reflected back for confirmation. MUST stay false during the evocative turns so reflecting the level cannot pre-empt the discovery.',
      },
      activityConfirmed: {
        type: 'boolean',
        description: 'True ONLY when the person confirms the reflected activity level fits',
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

  // Persist this phase's opening line BEFORE the user turn, so history reads in
  // the order the person actually experienced it.
  //
  // Each screen used to render its opener client-side only - never sent, never
  // stored - so the model received an ANSWER with no QUESTION. On 2026-08-23
  // that produced a real failure: "Just yoga and a run" landed straight after a
  // turn about what she had eaten today, and was read as a log of today rather
  // than her weekly pattern. Given the context the model actually had, that was
  // the reasonable reading. Storing the opener also makes the transcript honest,
  // which previously omitted messages the person demonstrably saw.
  //
  // Idempotent by exact content: onboarding is forward-only, so an opener that
  // is already present belongs to this same phase visit and must not double up.
  const opener = PHASE_OPENERS[phase];
  if (opener) {
    const { data: seen } = await supabase
      .from('chat_messages')
      .select('id')
      .eq('user_id', user.id)
      .eq('source', 'onboarding')
      .eq('role', 'assistant')
      .eq('content', opener)
      .limit(1)
      .maybeSingle();
    if (!seen) {
      const { error: openerError } = await supabase
        .from('chat_messages')
        .insert({ user_id: user.id, role: 'assistant', content: opener, source: 'onboarding' });
      if (openerError) console.log('ONBOARDING-CHAT OPENER INSERT FAILED:', openerError.message);
    }
  }

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

  // Activity's stage-3 evocation invites the person to connect movement they enjoy
  // to their own goal. The goal was written to user_context back in the goals step
  // precisely so it can be referenced later (Context Persistence, Part Seven) - by
  // now it's likely outside the 40-turn history window, so inject it explicitly.
  let goalContext = '';
  if (phase === 'activity_tdee') {
    const { data: goalRow } = await supabase
      .from('user_context')
      .select('content')
      .eq('user_id', user.id)
      .eq('category', 'goal')
      .limit(1)
      .maybeSingle();
    if (goalRow?.content) {
      goalContext = `\n\nThe person's own stated goal, from earlier in onboarding: "${goalRow.content}". When you reach the stage of inviting them to connect movement they enjoy to what they're aiming for, you may refer to this goal specifically rather than generically - but still only invite the connection, never assert it for them.`;
    }
  }

  const systemPrompt =
    `${PHASE_ROLE[phase]}${goalContext}\n\n${ONBOARDING_COMMON}\n\n${SAFETY_PROMPT_BLOCK}` +
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
    readyToReflectLevel?: boolean;
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
  const isDistressTurn =
    (DISTRESS_TIERS as readonly string[]).includes(nextClassification) || nextEscalationStep !== null;

  let finalReply = replyText;

  let phaseComplete = false;

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
      if (target != null) {
      // APPENDED, never substituted (corrected 2026-08-23). The figure stays
      // code-built so it can never be hallucinated, but replacing the whole turn
      // also deleted whatever the model said - including, on 2026-08-23, a direct
      // "can I see the dashboard?" that was never acknowledged. The phase roles
      // already forbid the model stating numbers, so the two do not collide.
        finalReply = `${replyText}\n\n${formatProteinStatement(target, loggedToday)}`;
        phaseComplete = true;
      }
    } else if (h != null || w != null) {
      finalReply = `${replyText}\n\n${formatMeasurementEcho(h, w)}`;
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
      // Confirmation is the completion event for this step. The TDEE statement is
      // emitted below when it can be computed; when BMR is uncomputable (e.g. sex
      // undisclosed) the step still completes gracefully rather than stranding.
      phaseComplete = true;
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
      if (tdee != null) finalReply = `${replyText}\n\n${formatTDEEStatement(tdee)}`;
    } else if (result.readyToReflectLevel && level) {
      // Route-enforced gate (decision B): the level reflection only fires once the
      // model signals the guided discovery has run its course. Until then, even if
      // a level has been inferred, the model's own evocative reply passes through
      // untouched, so the deterministic echo can never short-circuit the MI flow.
      finalReply = `${replyText}\n\n${formatActivityEcho(level)}`;
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
    phaseComplete,
  });
}
