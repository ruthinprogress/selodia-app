// Health Context (SELODIA_SPEC.md, Part Twelve). Turns a user's STATUS-based
// health context into a deterministic system-prompt block that shapes food
// guidance. The food-protection rules are fixed here, not invented by the
// model - the model only phrases them. The app never interprets a raw lab
// value or makes a clinical determination; it acts only on the status the
// person reported.

export type MarkerStatus = 'normal' | 'elevated' | 'low' | 'borderline' | 'unsure';

export type HealthContext = {
  ldl_status: MarkerStatus | null;
  hdl_status: MarkerStatus | null;
  cholesterol_status: MarkerStatus | null;
  glucose_status: MarkerStatus | null;
  ferritin_status: MarkerStatus | null;
  thyroid_status: MarkerStatus | null;
  condition_pcos: boolean;
  condition_ibs: boolean;
  condition_hypothyroid: boolean;
  condition_t2d: boolean;
  conditions_other: string | null;
};

// Verbatim from the spec - shown inline wherever AI guidance touches a health
// marker. Single source of truth so backend and app never drift.
export const HEALTH_DISCLAIMER =
  "This takes into account the health context you've shared. Dietary changes that affect medical markers should always be confirmed with your GP or dietitian.";

const MARKER_LABELS: Record<string, string> = {
  ldl_status: 'LDL',
  hdl_status: 'HDL',
  cholesterol_status: 'total cholesterol',
  glucose_status: 'blood glucose / HbA1c',
  ferritin_status: 'ferritin / iron',
  thyroid_status: 'thyroid (TSH)',
};

// True if the person has provided any marker status or any condition at all.
export function hasHealthContext(hc: HealthContext | null | undefined): hc is HealthContext {
  if (!hc) return false;
  const anyMarker = [
    hc.ldl_status,
    hc.hdl_status,
    hc.cholesterol_status,
    hc.glucose_status,
    hc.ferritin_status,
    hc.thyroid_status,
  ].some((s) => s != null && s !== 'unsure');
  const anyCondition =
    hc.condition_pcos ||
    hc.condition_ibs ||
    hc.condition_hypothyroid ||
    hc.condition_t2d ||
    !!(hc.conditions_other && hc.conditions_other.trim());
  return anyMarker || anyCondition;
}

// Deterministic system-prompt block. Returns '' when there is nothing to say,
// so callers can concatenate unconditionally. Only the spec's explicit
// protective mappings are emitted as rules; anything reported without a
// spec-defined mapping is surfaced as context only, never as an invented
// dietary rule.
export function buildHealthContextPrompt(hc: HealthContext | null | undefined): string {
  if (!hasHealthContext(hc)) return '';

  const reported: string[] = [];
  for (const key of Object.keys(MARKER_LABELS)) {
    const status = hc[key as keyof HealthContext] as MarkerStatus | null;
    if (status && status !== 'unsure') reported.push(`${MARKER_LABELS[key]}: ${status}`);
  }
  if (hc.condition_pcos) reported.push('diagnosed PCOS');
  if (hc.condition_ibs) reported.push('diagnosed IBS');
  if (hc.condition_hypothyroid) reported.push('diagnosed hypothyroidism');
  if (hc.condition_t2d) reported.push('diagnosed type 2 diabetes');
  if (hc.conditions_other && hc.conditions_other.trim()) {
    reported.push(`other: ${hc.conditions_other.trim()}`);
  }

  const rules: string[] = [];
  if (hc.ldl_status === 'elevated' || hc.ldl_status === 'borderline') {
    rules.push(
      'Elevated LDL: protect oats, lentils, beans, and apples as priority foods; gently flag saturated fat rather than treating it as expendable. Never frame this as a food being "bad".'
    );
  }
  if (hc.ferritin_status === 'low') {
    rules.push(
      'Low ferritin/iron: protect red meat and leafy greens - never suggest sacrificing them to hit a macro ratio.'
    );
  }
  if (hc.glucose_status === 'elevated' || hc.glucose_status === 'borderline' || hc.condition_t2d) {
    // Spec maps borderline HbA1c to contextual sugar/refined-carb flags;
    // extended to diagnosed T2D as the established form of the same concern.
    rules.push(
      'Raised blood sugar / T2D: add gentle, contextual flags around added sugar and refined carbohydrates - as context, not prohibition.'
    );
  }
  if (hc.condition_pcos) {
    rules.push(
      'PCOS: prioritise lower-GI carbohydrates, but do NOT assume cutting total carbs is the right lever - it usually is not.'
    );
  }
  if (hc.condition_ibs) {
    rules.push(
      'IBS: note high-FODMAP foods rather than freely recommending them as protein or fibre sources.'
    );
  }

  let block = `HEALTH CONTEXT - the person has shared health context you should let shape your food guidance. These are their own REPORTED statuses (what a clinician or their results told them), never lab values for you to reinterpret, and never something to diagnose from.

Reported: ${reported.join('; ')}.`;

  if (rules.length > 0) {
    block += `

Apply these protective adjustments to any food guidance - additive protection, never a restriction plan, and never overriding the no-moralizing-food rule (protect and gently flag, never label a food "good" or "bad"):
- ${rules.join('\n- ')}`;
  }

  block += `

You are not a clinician: keep guidance protective and gentle, never prescriptive, never contradict a GP or dietitian, and never advise on medication. Whenever a reply's food guidance actually draws on this health context, set healthGuidanceApplied to true so the app can show the required GP/dietitian disclaimer alongside that reply. If a reply does not touch a health marker, leave it false.`;

  return block;
}
