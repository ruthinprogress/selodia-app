import { supabase } from '@/lib/supabase';

// REMOVING ONE ITEM FROM A MEAL (Ruth, 30 September 2026, item 2d).
//
// NOT A DELETE. Every figure she is ever shown - the food row, the day's line,
// the week's average, what is left of her targets - is read from food_logs, and
// the items are a child table nothing sums. So `delete from food_items` removes
// the chia from the list and leaves the meal still claiming its calories, which
// is a worse state than not offering the delete at all.
//
// The subtraction happens in the database, in the same transaction as the
// delete, so there is no way to do half of this. See the migration
// 20260930160000_remove_one_food_item.sql for why it subtracts the item's own
// figures rather than recomputing the meal from what is left - the short
// version is that a quarter of her meals do not agree with their items today,
// in both directions, and a delete is not the moment to silently pick a side.
export async function removeFoodItem(itemId: string): Promise<void> {
  const { error } = await supabase.rpc('food_item_remove', { p_item_id: itemId });
  if (error) throw new Error(error.message);
}
