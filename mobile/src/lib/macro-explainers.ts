import type { MacroKey } from '@/lib/tracked-macros';

// WHAT A NUTRIENT IS FOR, IN ONE SHORT PARAGRAPH.
//
// Ruth, 21 October 2026, on two artworks: "it does need some improvement to
// increase user literacy of what they are eating and how it's affecting them...
// But keeping in mind we need to maintain it, keep costs realistic for MVP, and
// start moving towards shipping, not constant rebuilding."
//
// Both artworks reached for the same idea - a short explanation of a nutrient,
// reached from the figure. It is the best idea in either of them, and the one
// she can afford: written once, here, read forever, costing nothing to run.
//
// WHAT THIS IS INSTEAD OF. Artwork 1 generates "One thing to know today" from
// the day's food, which is a model call per person per day for as long as the
// app exists. That is the half she called a fantasy, and the cost is not the
// only reason: a generated sentence about somebody's eating is a sentence
// nobody has read before it is shown to them, on a subject where a careless
// one does harm.
//
// SO THESE ARE FIXED, AND THEY SAY WHAT THE NUTRIENT DOES - never what her
// figure means, never whether she had enough, never what to eat instead. The
// app knows what fibre is for; it does not know what her fibre means, and the
// published guidance for that lives on the server beside the chat, which can
// put it against her actual days.
//
// THE RULE FOR EVERY WORD HERE: true for everybody who reads it, or it does not
// go in. No "you should", no "aim for", no number she could read as a target.

export type MacroExplainer = {
  /**
   * ONE LINE, READ WITH THE ROW SHUT (Ruth's artwork, 22 October 2026).
   *
   * The screen was ten open cards of three paragraphs each, which she called
   * "a long list of unreadable pills". Shut, a row has to answer the question
   * by itself - somebody scanning for what fibre is should not have to open
   * anything to find out.
   *
   * Eight of these are her artwork's own words. Saturated fat and salt it did
   * not draw, and they are written to match: a verb, a plain object, a stop.
   */
  line: string;
  /** What it does in the body. Two or three plain sentences. */
  what: string;
  /** Where it comes from, as foods rather than categories. */
  where: string;
};

export const MACRO_EXPLAINERS: Record<MacroKey, MacroExplainer> = {
  kcal: {
    line: 'A unit of energy from food.',
    what: 'A calorie is a unit of energy, and the figure is an estimate of how much energy a food gives you. It is one number about a whole meal, so it says nothing about what that meal was made of - two meals with the same calories can do very different things in your body.',
    where: 'Every food carries some. Fat carries the most per gram, then alcohol, then protein and carbohydrate roughly equally.',
  },
  protein: {
    line: 'Repairs and builds your body.',
    what: 'Protein is what your body repairs itself with - muscle, skin, hair, the lining of your gut, and the enzymes and hormones that run almost everything else. Unlike fat, your body has no store of it set aside, so it draws on whatever is coming in, which is why it is worth having some through the day rather than all at once.',
    where: 'Meat, fish, eggs and dairy carry the most. Beans, lentils, tofu, nuts, seeds and grains all carry some, and eating a mix of them through a day covers the same ground.',
  },
  fat: {
    line: 'Energy, hormones and helps you absorb vitamins.',
    what: 'Fat carries energy, and it is also how your body absorbs vitamins A, D, E and K - a meal of vegetables with no fat in it gives up some of its own vitamins. It is part of the structure of every cell you have, and of the hormones made from cholesterol, oestrogen among them.',
    where: 'Oils, butter, nuts, seeds, oily fish, avocado, cheese and meat.',
  },
  saturated: {
    line: 'One kind of fat among several.',
    what: 'Saturated fat is one kind of fat among several. It is the one most often looked at alongside cholesterol, which is why it is usually listed separately on a label rather than folded into the total.',
    where: 'Butter, cheese, cream, fatty cuts of meat, coconut and palm oil, and most pastry, biscuits and cakes.',
  },
  carbs: {
    line: 'Your main source of energy.',
    what: 'Carbohydrate is the body\'s most immediate source of energy, and the one the brain prefers - it uses a steady share of it all day without being asked. Whole forms arrive with fibre attached and are digested more slowly than refined ones.',
    where: 'Bread, rice, pasta, potatoes, oats, fruit, milk and anything sweetened.',
  },
  sugar: {
    line: 'A simple form of carbohydrate.',
    what: 'Sugar is the simplest form of carbohydrate, so it reaches the blood fastest. The figure here counts all of it together - the sugar in a biscuit and the sugar in an apple or a glass of milk are the same chemistry, even though they arrive with very different things alongside them.',
    where: 'Anything sweetened, plus fruit, fruit juice, milk and yoghurt.',
  },
  freeSugar: {
    line: 'Sugar added to food, rather than built into it.',
    what: 'Free sugars are the ones added to food, plus the sugar in honey, syrups and fruit juice. The distinction is not about chemistry - it is the same sugar - but about what it arrives with and how fast. Sugar built into a whole apple comes wrapped in fibre and water, so it is released slowly; the same sugar in juice or a biscuit is not. This is the figure dietary guidance is written about, which is why it is counted separately from the sugar total.',
    where: 'Biscuits, cakes, chocolate, sweetened drinks, fruit juice, honey and syrups, and sugar added in cooking.',
  },
  fibre: {
    line: 'Feeds the good bacteria in your gut.',
    what: 'Fibre is the part of a plant you do not digest yourself. It feeds the bacteria living in your large intestine, and as they break it down they make substances that help maintain the gut lining and support the immune system. Different plants carry different fibres and feed different bacteria, which is why variety does more than quantity alone.',
    where: 'Wholegrains, beans, lentils, vegetables, fruit eaten with its skin, nuts and seeds.',
  },
  salt: {
    line: 'Balances the water in your body.',
    what: 'Salt is mostly sodium, which your body uses to hold the right amount of water in and around its cells and to carry the electrical signals that make nerves and muscles work. The figure here is worked back from the sodium in your food.',
    where: 'Most of it arrives already in food rather than from the pot - bread, cheese, bacon and ham, sauces, stock, crisps and most ready meals.',
  },
  calcium: {
    line: 'Builds and maintains bones.',
    what: 'Calcium is what bone is built and rebuilt from, and bone is living tissue that is replaced throughout life. It is also used by muscles to contract, including the heart, and the body keeps the amount in the blood steady by drawing on the skeleton when intake is low - which is why bone is where a long shortfall eventually shows.',
    where: 'Milk, cheese and yoghurt, fortified plant drinks and cereals, tofu set with calcium, tinned sardines and salmon eaten with the bones, sesame seeds and tahini, kale and broccoli. Spinach carries calcium that is bound up and barely absorbed, despite its reputation.',
  },
  iron: {
    line: 'Carries oxygen around your body.',
    what: 'Iron is what carries oxygen around your body, inside the red blood cells. When it runs low the usual signs are tiredness, breathlessness and feeling cold, because less oxygen is reaching where it is needed. Iron is lost in blood, so anyone still having periods loses some every month.',
    where: 'Red meat and liver carry the form your body absorbs best, then shellfish and darker poultry meat. Lentils, beans, chickpeas, tofu, pumpkin and sesame seeds, dried apricots, fortified cereals and dark leafy greens carry a form that is absorbed less easily - vitamin C eaten alongside helps, and tea or coffee with the meal hinders it.',
  },
};

/** The explainer for a macro, or null for one nobody has written yet. */
export function explainerFor(key: MacroKey): MacroExplainer | null {
  return MACRO_EXPLAINERS[key] ?? null;
}
