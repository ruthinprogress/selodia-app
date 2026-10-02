import type { SupabaseClient } from '@supabase/supabase-js';

// Allergies and dietary restrictions (Part Twelve, build item 42).
//
// WHAT THIS IS: capture, storage and awareness — parts (a), (b) and (d) of the
// item.
//
// WHAT THIS IS NOT, AND THE DISTINCTION IS STILL THE POINT: part (c), the filter
// check itself, lives in `allergy-gate.ts` and was built 2026-09-09. NOTHING IN
// THIS FILE IS A SAFETY GUARANTEE and that has not changed. The prompt block
// below makes the model AWARE of a person's allergies inside a session, which is
// useful and is not the same thing — a long session can truncate it away and a
// determined conversation can talk around it. It is layer 1 of four; the gate
// runs afterwards, on what the model actually said.
//
// This paragraph used to say the gate was blocked on the Meal/Order Advisor
// (item 22) because "today the app has no food-suggestion path at all". That was
// wrong, and the prompt block a few lines below is the proof: it says never
// suggest an allergen "in anything you propose", an instruction that only exists
// because proposing happens. There is no food-suggestion FEATURE, but Selodía
// will answer "what should I have for dinner?" today. The risk was live while the
// gate was deferred, so the gate shipped first and item 22 inherits it working.
//
// PERMANENCE IS STRUCTURAL. There is no delete, no update and no expiry in this
// module, and there should never be one. Part Twelve: "once disclosed, an
// allergy becomes a hard, permanent exclusion — never suggested again", with no
// softening over time. A function to remove one would be the first step toward
// softening it by accident.

/**
 * HOW THE ALLERGEN REACHES THEM, which decides what gets filtered.
 *
 * Added 2026-09-28 after a contact allergy to nickel was treated as a food
 * restriction and blocked two plain questions about nickel. Only what can be
 * EATEN has any business gating a food suggestion.
 *
 * A CLOSED LIST, unlike the allergen name. This file is emphatic that the name
 * must never be a fixed vocabulary, because nobody can finish writing the list of
 * things a person can react to. The kind is not the person's word for their own
 * body - it is a routing decision with four answers that code has to switch on.
 *
 * 'other' is the honest unknown and is treated AS food, because in a food app an
 * allergy mentioned with no other context is most often one, and that is the
 * conservative way round for a filter.
 */
// 'medicine' ADDED 2 OCTOBER 2026 (Ruth, item 5: "medicines you react to").
// It does NOT arm the food filter - see filtersFood below. Penicillin left as
// 'other' would have armed it, because 'other' is deliberately treated as food.
export type AllergyKind = 'food' | 'contact' | 'environmental' | 'medicine' | 'other';

export type Allergy = { name: string; disclosed_at: string; kind: AllergyKind };

/**
 * The ones that can be eaten, and so the only ones a food filter may act on.
 *
 * 'medicine' IS EXCLUDED DELIBERATELY. A reaction to penicillin is real and is
 * worth the app knowing, and it says nothing about what she may eat. Leaving it
 * to fall through to 'other' would have armed the food filter against it, which
 * is the nickel mistake of September in a new costume.
 */
export function filtersFood(a: Allergy): boolean {
  return a.kind === 'food' || a.kind === 'other';
}

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
  disclosed: { name: string; kind?: string }[],
  rawInput: string
): Promise<string[]> {
  const byName = new Map<string, AllergyKind>();
  for (const d of disclosed) {
    const name = normaliseAllergen(d.name ?? '');
    if (!name || name.length > 80) continue;
    // ANYTHING UNRECOGNISED BECOMES 'other', WHICH FILTERS FOOD. A kind the model
    // invented must not quietly switch the food filter off - 'other' is the
    // honest unknown and is treated as food downstream.
    const kind: AllergyKind =
      d.kind === 'contact' ||
      d.kind === 'environmental' ||
      d.kind === 'food' ||
      d.kind === 'medicine'
        ? d.kind
        : 'other';
    if (!byName.has(name)) byName.set(name, kind);
  }
  const cleaned = [...byName.keys()];
  if (cleaned.length === 0) return [];

  const { error } = await supabase.from('allergies').upsert(
    cleaned.map((name) => ({ user_id: userId, name, kind: byName.get(name), raw_input: rawInput })),
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
    .select('name, disclosed_at, kind')
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

  const edible = allergies.filter(filtersFood);
  const other = allergies.filter((a) => !filtersFood(a));

  const blocks: string[] = [];

  if (edible.length > 0) {
    blocks.push(`ALLERGIES AND DIETARY RESTRICTIONS THEY HAVE TOLD YOU ABOUT: ${edible
      .map((a) => a.name)
      .join(', ')}.
These are not preferences and are not negotiable. Never suggest, recommend or include any of them in anything you propose, in any quantity, however it is prepared, and never as an ingredient in something else. Do not ask whether it still applies, do not offer a version "just this once", and do not soften over time. If they mention eating one themselves, that is their business and you simply do not comment on it - this constrains what YOU offer, never what they report.`);
  }

  // SAID SEPARATELY, AND SAID AT ALL. A contact or environmental allergy is not
  // a food restriction and must not read as one - but it is still something they
  // have told the app about their body, and a reply that had never heard of it
  // would be its own failure. What it constrains is different, so it is written
  // as a different instruction rather than folded into the list above.
  if (other.length > 0) {
    blocks.push(`REACTIONS THAT ARE NOT ABOUT FOOD, which they have also told you about: ${other
      .map((a) => `${a.name} (${a.kind})`)
      .join(', ')}.
These do not restrict anything they eat, so never treat them as a dietary exclusion. They DO constrain what you suggest they put on their skin, wear or use, where that is relevant. And they are ordinary subjects of conversation: if they ask about one, answer the question plainly, the way you would any other question about their own body.`);
  }

  return `\n\n${blocks.join('\n\n')}`;
}
