import type { SupabaseClient } from '@supabase/supabase-js';

// Allergies and dietary restrictions (Part Twelve, build item 42).
//
// WHAT THIS IS: capture, storage and awareness — parts (a), (b) and (d) of the
// item.
//
// WHAT THIS IS NOT, AND THE DISTINCTION IS THE POINT: part (c), "a genuine
// filter check on every food suggestion path — an actual gate in the suggestion
// path, not an instruction in a prompt asking the model to remember". That does
// not exist, here or anywhere. Nothing in this file is a safety guarantee. The
// prompt block below makes the model AWARE of a person's allergies inside a
// session, which is useful and is not the same thing — the spec is explicit that
// "prompt-level care is not a safety guarantee", precisely because a long
// session can truncate context and a model can be talked around.
//
// The gate is blocked on there being something structured to gate: the
// Meal/Order Advisor is build item 22 and unbuilt, and today the app has no
// food-suggestion path at all. Item 22 now carries a hard dependency in the spec
// saying it cannot ship without this gate wired in.
//
// PERMANENCE IS STRUCTURAL. There is no delete, no update and no expiry in this
// module, and there should never be one. Part Twelve: "once disclosed, an
// allergy becomes a hard, permanent exclusion — never suggested again", with no
// softening over time. A function to remove one would be the first step toward
// softening it by accident.

export type Allergy = { name: string; disclosed_at: string };

// Case and whitespace only. Deliberately NOT a closed list of allergens or a
// spelling correction: principle 13 rules out a fixed vocabulary for open-ended
// human input, and an allergen list is exactly the list nobody can finish
// writing. Someone's word for their own allergy is the right word for it.
export function normaliseAllergen(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

// Idempotent by the table's unique (user_id, name): a second mention of the same
// allergy is not a second allergy. Deliberately does NOT update disclosed_at on
// a repeat — that column records when the app first learned this, and refreshing
// it on every mention would lose the only thing it was there to say.
export async function recordAllergies(
  supabase: SupabaseClient,
  userId: string,
  names: string[],
  rawInput: string
): Promise<string[]> {
  const cleaned = Array.from(
    new Set(names.map(normaliseAllergen).filter((n) => n.length > 0 && n.length <= 80))
  );
  if (cleaned.length === 0) return [];

  const { error } = await supabase.from('allergies').upsert(
    cleaned.map((name) => ({ user_id: userId, name, raw_input: rawInput })),
    { onConflict: 'user_id,name', ignoreDuplicates: true }
  );
  if (error) {
    console.log('ALLERGY SAVE FAILED:', error.message);
    return [];
  }
  return cleaned;
}

export async function loadAllergies(supabase: SupabaseClient): Promise<Allergy[]> {
  // RLS scopes this to the signed-in person, as everywhere else.
  const { data, error } = await supabase
    .from('allergies')
    .select('name, disclosed_at')
    .order('disclosed_at', { ascending: true });
  if (error) return [];
  return (data ?? []) as Allergy[];
}

// AWARENESS, NOT A GATE. Read the header of this file before treating what this
// returns as a safety mechanism. It exists so the model does not blunder into
// suggesting something obviously wrong within a session it can see; it cannot
// prevent one, and nothing downstream should behave as though it can.
//
// Worded as an absolute rather than a preference because the model's own
// judgement is the thing being constrained here — "avoid where possible" invites
// exactly the negotiation this must not have.
export function buildAllergyPrompt(allergies: Allergy[]): string {
  if (allergies.length === 0) return '';
  const list = allergies.map((a) => a.name).join(', ');
  return `\n\nALLERGIES AND DIETARY RESTRICTIONS THEY HAVE TOLD YOU ABOUT: ${list}.
These are not preferences and are not negotiable. Never suggest, recommend or include any of them in anything you propose, in any quantity, however it is prepared, and never as an ingredient in something else. Do not ask whether it still applies, do not offer a version "just this once", and do not soften over time. If they mention eating one themselves, that is their business and you simply do not comment on it - this constrains what YOU offer, never what they report.`;
}
