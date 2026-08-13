import type { Tool } from '@anthropic-ai/sdk/resources/messages';

// The five distress tiers are the shared core of the safety-boundary
// system, used by every emotionally-open touchpoint (onboarding-chat,
// ask-unflump, and any future one) - grounded in UNFLUMP_LANGUAGE_RULES.md.
// Each route adds its own non-distress classification(s) on top (e.g.
// onboarding-chat's clear_goal/ambiguous_goal, ask-unflump's neutral).
export const DISTRESS_TIERS = [
  'ordinary_discouragement',
  'ambiguous_distress',
  'eating_related_distress',
  'grief_related_distress',
  'acute_crisis',
] as const;
export type DistressTier = (typeof DISTRESS_TIERS)[number];

export type EscalationStep = 'gentle_asked' | 'direct_asked' | null;

// Verbatim from UNFLUMP_LANGUAGE_RULES.md's worked example - fixed, not
// AI-paraphrased, because its exact wording is what makes it grounded in
// the C-SSRS's validated first screening question.
export const DIRECT_ESCALATION_QUESTION =
  "Thank you for telling me that — that took something to say. Can I ask you directly: have you been wishing you weren't here, or wishing you could just not wake up?";

// Resource-org selection is deterministic, never an AI judgment call - see
// UNFLUMP_LANGUAGE_RULES.md. URLs verified live 2026-08-11 (Beat, Shout)
// and 2026-08-12 (Cruse), re-verify periodically per the doc's own
// accuracy note.
export const RESOURCES: Record<'Beat' | 'Shout' | 'Cruse', { name: string; url: string }> = {
  Beat: { name: 'Beat', url: 'https://www.beateatingdisorders.org.uk/' },
  Shout: { name: 'Shout', url: 'https://giveusashout.org/' },
  Cruse: { name: 'Cruse Bereavement Support', url: 'https://www.cruse.org.uk/' },
};

export const CLASSIFY_TOOL_NAME = 'classify_and_reply';

// nonDistressClassifications: the route-specific categories that sit
// alongside the four shared distress tiers (e.g. ['clear_goal',
// 'ambiguous_goal'] for onboarding, ['neutral'] for general chat).
// extraProperties/extraRequired let a route add its own tool-schema
// fields (e.g. onboarding's extractedGoal) without forking the shared
// safety fields.
export function buildClassifyTool<T extends string>(
  nonDistressClassifications: readonly T[],
  excludeAmbiguous: boolean,
  extraProperties: Record<string, unknown> = {},
  extraRequired: string[] = []
): Tool {
  const tiers = excludeAmbiguous
    ? DISTRESS_TIERS.filter((t) => t !== 'ambiguous_distress')
    : DISTRESS_TIERS;
  const classifications = [...nonDistressClassifications, ...tiers];

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
        resourceCardTitle: {
          type: 'string',
          description:
            'Only when classification is eating_related_distress, grief_related_distress, or acute_crisis',
        },
        resourceCardDescription: {
          type: 'string',
          description:
            'Only when classification is eating_related_distress, grief_related_distress, or acute_crisis',
        },
        revisitingPriorDisclosure: {
          type: 'boolean',
          description:
            'True only when this reply is actively choosing to gently return to an earlier distress disclosure the person just deflected from - see the deflection handling rule',
        },
        ...extraProperties,
      },
      required: ['classification', 'reply', ...extraRequired],
    },
  };
}

// Shared across every route that uses the classifier - the safety tiers,
// deflection handling, the hard resource-content constraint, and the
// universal distress-adjacent rules. Each route prepends its own
// role-specific framing (what this conversation is for) before this
// block, rather than duplicating any of the following.
export const SAFETY_PROMPT_BLOCK = `SAFETY BOUNDARY - this is the most important part of your job, grounded in UNFLUMP_LANGUAGE_RULES.md (Motivational Interviewing, plus the C-SSRS for the ambiguous/acute tiers):
- Ordinary discouragement (tiredness, a hard day, mild self-criticism) gets a warm, physiologically-grounded reframe that keeps things moving forward.
- Genuinely ambiguous statements (could be burnout with the process, could be something more serious - not enough to tell from the words alone) get ONE gentle, open clarifying question. Never guess either way, never jump to a resource.
- Eating-related distress (disordered relationship with food, restriction, guilt-driven patterns, going extended periods without eating out of fear rather than choice) gets a care-first response. Do not pivot back to goals or ordinary tasks. Stay warmly present for as long as they want to keep talking.
- Grief-related distress (bereavement, the loss of a person or relationship, grief that's surfacing through how someone talks about their body, eating, or activity) gets the same care-first response as eating-related distress - presence over problem-solving, no pivot back to ordinary tasks.
- Acute crisis (explicit self-harm/suicidal ideation, acute risk) gets an immediate care-first response.

DEFLECTION HANDLING - if the person deflects or redirects away from a genuine eating-related-distress, grief-related-distress, or acute-crisis disclosure, it is correct to gently return to it ONCE rather than accepting the first redirect at face value. But if they then explicitly decline a second time (a clear "I'm fine," another redirect), respect that: follow their new topic, leave the door open with a single light touch ("I'm here if that changes"), and do not raise the original disclosure again in the same way. Set revisitingPriorDisclosure to true only on the turn where you are actively choosing to return to an earlier disclosure the person just deflected from - not on an ordinary continuation of a topic they're already engaged with.

RESOURCE CONTENT CONSTRAINT - hard rule, no exceptions: the reply field must NEVER include any specific resource name, phone number, text code, website, or other contact method - not a well-known one, not even if it feels helpful or urgent in the moment. All resource information is delivered exclusively through the resourceCard field, resolved deterministically outside of what you generate - you never choose or name the organization. If your reply references that support exists, stay at the vaguest possible level ("there's support available," "there are people who can help with exactly this") with zero specifics. Naming anything specific - an organization, a number, a text code, a website - is the card's job only, never the reply's, under any circumstance.

RESOURCE REFERENCE CONSTRAINT - a second, related hard rule: your reply must NEVER reference sharing, giving, offering, or leaving a resource ("that's there for you," "the resource I gave you," "don't forget that's available") unless a resourceCard is genuinely being included in this exact same response (i.e. classification is eating_related_distress, grief_related_distress, or acute_crisis AND this is the turn it was newly triggered). On any other turn - including a continuing conversation about the same distress, a deflection, or a revisit - say nothing at all about a resource existing, having been offered, or remaining available. Referencing something not actually present in this response is confusing and reads as broken, not caring. Staying warmly present needs no resource-reference at all; only mention one on the turn it is actually attached.

Rules that apply to every distress-adjacent reply, no exceptions:
- Never diagnose or label - reflect what they said, don't interpret it clinically.
- Never argue, correct, or talk someone out of ambivalence or doubt.
- Never minimize ("it's not that bad", "everyone feels that sometimes").
- Never give advice or try to fix anything in the acute crisis tier - only care and presence.
- Never imply a handoff or that you're stepping back ("you need someone else", "that's more than I can help with"). A resource is additive support alongside you, never a replacement. Stay present after it appears.
- Never instruct toward a resource, even gently ("please reach out to them" is still a directive). State that it's there, remove pressure ("no pressure, whenever it feels right"), never a verb telling them to use it.
- Never persuade or lecture toward seeking help. If the person is willing to talk about how they're feeling but not about seeking help, follow that - stay present, let them keep talking about what they're actually feeling, offer the card once without lecturing, and do not repeatedly circle back to convincing them to get help. Persuasion is not the job here; presence is.
- No external-verdict praise ("well done", "good job") and no comparison to other people, ever.

When classification is eating_related_distress, grief_related_distress, or acute_crisis, also generate resourceCardTitle and resourceCardDescription - genuinely responsive to the moment, calm in tone. Do not name a specific organization yourself; that mapping is handled deterministically outside your response.`;

export function buildContextualAdditions(
  previousEscalationStep: EscalationStep,
  previousRevisitCount: number
): string {
  let additions = '';
  if (previousEscalationStep === 'direct_asked') {
    additions +=
      '\n\nYou just asked the person directly whether they have been wishing they weren\'t here or wanting to not wake up. Classify their answer as acute_crisis if it indicates yes or genuine concern, or resolve to whichever other tier actually fits if it clearly does not. Do not classify as ambiguous_distress again - this must resolve now.';
  } else if (previousEscalationStep === 'gentle_asked') {
    additions +=
      "\n\nYou just gently asked whether their last ambiguous statement was about the tracking/effort specifically, or something bigger. If their answer resolves that clearly, classify accordingly. If it's still unclear or points to something bigger, classify as ambiguous_distress again.";
  }

  if (previousRevisitCount >= 1) {
    additions +=
      '\n\nYou have already gently returned to an earlier distress disclosure once, and the person redirected away from it again. Per the deflection handling rule, do not raise it again this turn - follow their new topic instead, and do not set revisitingPriorDisclosure. Per the resource reference constraint, do not mention the earlier resource card at all this turn - no resourceCard is included in this response, so nothing about it belongs in your reply either.';
  }

  return additions;
}

export type ClassifyResult = {
  classification: string;
  reply: string;
  resourceCardTitle?: string;
  resourceCardDescription?: string;
  revisitingPriorDisclosure?: boolean;
};

export type SafetyState = {
  previousEscalationStep: EscalationStep;
  previousClassification: string | null;
  previousRevisitCount: number;
};

export type SafetyOutcome = {
  replyText: string;
  nextEscalationStep: EscalationStep;
  resourceCard: { title: string; description: string; org: string; url: string } | null;
  nextRevisitCount: number;
  // The classification to PERSIST for this turn, which is not always the
  // model's raw classification: when we force the direct question mid-
  // escalation (see applySafetyStateMachine), we record the turn as
  // still-clarifying so the genuine resolution on the next turn is seen as
  // newly-triggered rather than a repeat.
  nextClassification: string;
};

// Deterministic branching - not the model's decision. Identical logic for
// every route that uses the classifier, so escalation/deflection/card
// behavior can never quietly drift between them.
export function applySafetyStateMachine(result: ClassifyResult, state: SafetyState): SafetyOutcome {
  const { previousEscalationStep, previousClassification, previousRevisitCount } = state;

  let nextEscalationStep: EscalationStep = null;
  let replyText = result.reply;
  let resourceCard: SafetyOutcome['resourceCard'] = null;
  let nextClassification: string = result.classification;
  // Newly-triggered only: a repeated classification from the immediately
  // preceding turn is the same ongoing moment, not a new one.
  const isNewlyTriggered = result.classification !== previousClassification;

  // The deterministic direct question (C-SSRS Q1) is the single gate before
  // any acute_crisis card. On the turn immediately after the gentle
  // clarifying question, we are still in the clarifying stage - not at
  // genuine resolution - so no card may attach yet. If the model tries to
  // jump straight to acute_crisis here (often while phrasing its own reply
  // as a probing question), that is premature: force the deterministic
  // direct question with no card, and override the reply so the prose (a
  // question) and the classification can never contradict each other.
  // Resolution and any card happen on the FOLLOWING turn, once the direct
  // question is actually answered. This routes ONLY through the suicide
  // screen: eating- and grief-related distress are deliberately excluded,
  // since a clear disclosure of either after the gentle question is a
  // genuine resolution that keeps its own (Beat/Cruse) card.
  const forceDirectQuestion =
    previousEscalationStep === 'gentle_asked' &&
    (result.classification === 'ambiguous_distress' || result.classification === 'acute_crisis');

  if (forceDirectQuestion) {
    nextEscalationStep = 'direct_asked';
    replyText = DIRECT_ESCALATION_QUESTION;
    // Persist as still-clarifying, not resolved. Recording the model's
    // acute_crisis here would make the genuine resolution on the next turn
    // look like a repeat (isNewlyTriggered false) and suppress its card.
    // Treating it as ambiguous_distress mirrors the normal gentle->direct
    // rung and keeps the ladder consistent.
    nextClassification = 'ambiguous_distress';
  } else if (result.classification === 'ambiguous_distress') {
    nextEscalationStep = 'gentle_asked';
  } else if (result.classification === 'eating_related_distress' && isNewlyTriggered) {
    resourceCard = {
      title: result.resourceCardTitle ?? RESOURCES.Beat.name,
      description: result.resourceCardDescription ?? '',
      org: RESOURCES.Beat.name,
      url: RESOURCES.Beat.url,
    };
  } else if (result.classification === 'grief_related_distress' && isNewlyTriggered) {
    resourceCard = {
      title: result.resourceCardTitle ?? RESOURCES.Cruse.name,
      description: result.resourceCardDescription ?? '',
      org: RESOURCES.Cruse.name,
      url: RESOURCES.Cruse.url,
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

  return { replyText, nextEscalationStep, resourceCard, nextRevisitCount, nextClassification };
}
