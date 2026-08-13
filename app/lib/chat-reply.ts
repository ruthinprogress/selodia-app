// Deterministic reply construction for a chat turn that also logged food or
// activity (Part Twelve, build step 2). The SAFETY classification alone governs
// what the reply says; logging is never allowed to change the reply's substance,
// only to add these deterministic confirmations - which are built here (never by
// the model), so they are accurate (only when something was actually stored) and
// never vague. Pure and unit-traceable.

const CARE_FIRST_TIERS = ['eating_related_distress', 'grief_related_distress', 'acute_crisis'];

export function buildLoggedReply(params: {
  replyText: string;
  nextClassification: string;
  nextEscalationStep: string | null;
  loggedLabel: string | null; // meal_label / activity_type; null if nothing stored
  loggedLine: string | null; // the full "Logged: …" confirmation line
}): string {
  const { replyText, nextClassification, nextEscalationStep, loggedLabel, loggedLine } = params;

  // Nothing stored (no log intent, or storage failed): never append anything.
  if (!loggedLabel || !loggedLine) return replyText;

  const lower = loggedLabel.toLowerCase();

  // Clean log with no active escalation: the deterministic confirmation IS the
  // reply (preserves the existing clean-log UX).
  if (nextClassification === 'neutral' && nextEscalationStep === null) {
    return loggedLine;
  }

  // Genuine distress: the care-first reply stands complete on its own; append
  // the deterministic sensitive acknowledgment. No "Logged:" bubble.
  if (CARE_FIRST_TIERS.includes(nextClassification)) {
    return `${replyText}\n\nI've logged your ${lower}, no need to do anything else with it. No pressure to keep logging while you're feeling like this, though — that can wait.`;
  }

  // Everyday struggle: the reframe stands; a brief factual confirmation that
  // keeps things moving forward, not the heavier no-pressure ack.
  if (nextClassification === 'ordinary_discouragement') {
    return `${replyText}\n\nI've logged your ${lower} — that's taken care of.`;
  }

  // ambiguous_distress / any escalation-question turn / neutral mid-escalation:
  // no confirmation appended - the screening question must stand alone and
  // complete. The data is still stored, silently.
  return replyText;
}
