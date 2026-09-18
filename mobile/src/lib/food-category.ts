// Which of the four icons an entry gets (UI brief, 2026-09-17).
//
// FOUR CATEGORIES, NOT FOUR THOUSAND FOODS. The brief is explicit: "Turkish
// leftovers box with lamb and chicken and rice" gets a bowl, not a drawing of
// that dish. So this reads the entry as written and answers one question - is it
// a meal, a drink, a snack or a treat - and nothing finer.
//
// IT IS A DISPLAY DECISION, NOT A JUDGEMENT. "Treat" is a shape on a list, not a
// verdict on what somebody ate: nothing counts it, totals it or mentions it, and
// the word never appears on screen beside the food. If that ever changes, this
// file is where the argument starts.
//
// THE WORDS ARE HERS, THE LABEL IS THE MODEL'S. meal_label is inferred at parse
// time and is often vague ("snack or dessert", "unknown"), so raw_text is read
// first and the label only settles what the words leave open.

export type FoodCategory = 'meal' | 'drink' | 'snack' | 'treat';

// A drink is a drink even when it is a meal-sized one. Checked first, because
// "hot chocolate" is a drink and "chocolate" is a treat.
const DRINK = /\b(coffee|espresso|latte|cappuccino|flat white|americano|tea|chai|matcha|smoothie|juice|water|squash|cordial|milkshake|shake|hot chocolate|cocoa|kombucha|wine|beer|lager|cider|gin|vodka|whisky|whiskey|rum|cocktail|prosecco|champagne|soda|coke|lemonade|drink)\b/i;

// Sweet things and the small salty ones people mean when they say treat.
const TREAT = /\b(cake|cookie|biscuit|brownie|chocolate|sweets?|candy|dessert|pudding|ice cream|gelato|doughnut|donut|pastry|croissant|pain au chocolat|muffin|flapjack|crisps|chips \(crisps\)|popcorn|haribo|choc)\b/i;

// Said plainly, in the words people use for it.
const SNACK = /\b(snack|nibbles|handful|piece of fruit|apple|banana|satsuma|orange|pear|nuts|almonds|cashews|yog(h)?urt|protein bar|cereal bar|rice cake|oatcake|hummus|olives|toast)\b/i;

const LABEL_CATEGORY: Record<string, FoodCategory> = {
  beverage: 'drink',
  drink: 'drink',
  drinks: 'drink',
  snack: 'snack',
  snacks: 'snack',
  dessert: 'treat',
  treat: 'treat',
  breakfast: 'meal',
  brunch: 'meal',
  lunch: 'meal',
  dinner: 'meal',
  supper: 'meal',
  salad: 'meal',
};

export function foodCategory(entry: {
  raw_text?: string | null;
  meal_label?: string | null;
}): FoodCategory {
  const text = (entry.raw_text ?? '').trim();
  const label = (entry.meal_label ?? '').trim().toLowerCase();

  // ORDER MATTERS, AND IT WAS WRONG THE FIRST TIME. Checking drinks first made
  // "a banana and a coffee" a cup and a breakfast of cereal, banana and milk a
  // plate, because one drink word outvoted the meal around it. So: a named meal
  // is a meal, then the food in the words, then the drink.
  if (LABEL_CATEGORY[label] === 'meal') return 'meal';
  if (SNACK.test(text)) return 'snack';
  if (TREAT.test(text)) return 'treat';
  if (DRINK.test(text)) return 'drink';

  if (label) {
    const exact = LABEL_CATEGORY[label];
    if (exact) return exact;
    // A vague label still leans somewhere: "snack or dessert", "afternoon tea".
    if (/dessert|treat/.test(label)) return 'treat';
    if (/snack/.test(label)) return 'snack';
    if (/drink|beverage|tea|coffee/.test(label)) return 'drink';
  }

  // A bowl by default, which is the honest answer for free text that describes
  // food and nothing else about it.
  return 'meal';
}
