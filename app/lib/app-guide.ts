// WHAT THE APP CAN DO, SO THE CHAT CAN SAY SO (13 October 2026).
//
// Ruth, signing off the plan for a chat that leads: it should "be aware of the
// report builder and all features of the app so it can explain how to use the
// app to its full potential". A companion that cannot point to the thing that
// would help is a companion that leaves her to find it.
//
// HELD TO THE APP'S OWN SCREEN LIST, so it cannot drift. Each entry names the
// route it describes, and scripts/check-app-guide.mjs fails when a route named
// here no longer exists, or when a screen exists that is neither described here
// nor deliberately left out. That is the promise she was given: it can never
// describe something that is not there.
//
// Written plainly, in the words on the screens, because the chat repeats them
// to her and she will look for exactly those words.

export type GuideEntry = {
  /** The route under mobile/src/app, as Expo Router names it. */
  route: string;
  /** What the screen is called on screen. */
  name: string;
  /** How you get there, in taps. */
  reach: string;
  /** What it is for, and when it would help. */
  use: string;
};

export const APP_GUIDE: GuideEntry[] = [
  {
    route: '(tabs)/index',
    name: 'Chat',
    reach: 'the first tab',
    use: 'Talk, log food, drink, activity, sleep, symptoms and how you feel in your own words or by voice, send a photo or a letter, ask anything about your record. The plus button attaches a photo or document.',
  },
  {
    route: '(tabs)/log/index',
    name: 'Log',
    reach: 'the second tab',
    use: 'Every kind of record in one list, each opening its own history: Food & Drink, Water, Sleep, Feeling, Cycle, Measurements and Activity. Tap a section to see past days and change or delete an entry.',
  },
  { route: '(tabs)/log/food-history', name: 'Food & Drink', reach: 'Log, then Food & Drink', use: 'Each day of the week with its meals and totals; arrows move between weeks. Tap a meal to see its items, ask about it or delete it.' },
  { route: '(tabs)/log/nutrients', name: 'What these mean', reach: 'Log, Food & Drink, then "What these mean"', use: 'What each nutrient does in the body and the foods it comes from, for the ones you watch and the ones you do not. Nothing about your own figures - ask in chat for that.' },
  { route: '(tabs)/log/water-history', name: 'Water', reach: 'Log, then Water', use: 'Drinks by day.' },
  { route: '(tabs)/log/sleep', name: 'Sleep', reach: 'Log, then Sleep', use: 'Nights logged and how they felt.' },
  { route: '(tabs)/log/feeling', name: 'Feeling', reach: 'Log, then Feeling', use: 'Mood and energy over time, and the notes you gave with them.' },
  { route: '(tabs)/log/cycle', name: 'Cycle', reach: 'Log, then Cycle', use: 'Your cycle pattern, then every cycle you have recorded newest first - each one opening onto its own summary. The period start and end action, and "Anything to note today?" for symptoms.' },
  { route: '(tabs)/log/cycle-month', name: 'One cycle', reach: 'Log, Cycle, then a month', use: 'What that cycle was: its length, its bleed, the days you logged on and your most common symptoms, with the daily log folded underneath.' },
  { route: '(tabs)/log/cycle-day', name: 'Cycle day', reach: 'Log, Cycle, then a day or "Anything to note today?"', use: 'Bleeding and grouped symptom chips for one day.' },
  { route: '(tabs)/log/measurements', name: 'Measurements', reach: 'Log, then Measurements', use: 'Weight, body fat, muscle and tape measurements over time.' },
  { route: '(tabs)/log/activity-history', name: 'Activity', reach: 'Log, then Activity', use: 'Sessions and steps by day.' },
  {
    route: '(tabs)/now/index',
    name: 'Now',
    reach: 'the third tab',
    use: 'Today at a glance, the Health Flower, Insights including the weekly roundup, and a button that opens the report builder.',
  },
  { route: '(tabs)/now/[dimension]', name: 'A Health Flower petal', reach: 'Now, then tap a petal', use: 'One part of the day in detail, such as food, movement or sleep.' },
  {
    route: '(tabs)/plans',
    name: 'Plans',
    reach: 'the fourth tab',
    use: 'What you are intentionally following: your week, saved movement plans, skills you are learning, rules about what to leave out, and goals.',
  },
  { route: 'goal', name: 'Goal', reach: 'Plans, then your goal', use: 'Your goal, the targets it sets and why, and earlier goals.' },
  { route: 'look-back', name: 'Look back', reach: 'Plans, then Your days', use: 'How your days feel against what you said you wanted at the start, one honest answer at a time.' },
  {
    route: '(tabs)/me',
    name: 'Me',
    reach: 'the fifth tab',
    use: 'Your own record of how you look after yourself, by section: supplements, skincare, wellbeing and the rest, each card holding why it was decided. How I Access Care is the last section: letters, numbers, references and emails for getting seen. "Export to print or share" and "Build a report" sit at the top.',
  },
  {
    route: 'settings/report',
    name: 'Build a report',
    reach: 'the Now tab, the More menu, or "Build a report" at the top of Me',
    use: 'Pick a period (last 7 days to all time) and the parts you want: about you, symptoms and observations, weight and other measurements, food and drink (daily, weekly, monthly or every entry), sleep, movement, plans, patterns noticed and summaries. You can add a photographed letter or a file. It builds a page you can print, save as a PDF or send, for a GP, a physio, a consultant or yourself. Nothing on it is chosen by AI.',
  },
  { route: 'settings/index', name: 'More', reach: 'the three dots at the top right of any tab', use: 'Profile, Body Manual, Almanac, Build a report, What I track, Connected devices, Notifications, Privacy, Your data, feedback, help and support.' },
  { route: 'settings/profile', name: 'Profile', reach: 'More, then Profile', use: 'Your personal details.' },
  { route: 'settings/body-manual', name: 'Body Manual', reach: 'More, then Body Manual', use: 'What your body needs avoided or handled with care: allergies, intolerances, foods you react to, medication, health context.' },
  { route: 'settings/almanac', name: 'Almanac', reach: 'More, then Almanac', use: 'The longer view of you, in short statements drawn from your record over weeks.' },
  { route: 'settings/tracking', name: 'What I track', reach: 'More, then What I track', use: 'Which nutrients and body measurements the app follows for you.' },
  { route: 'settings/devices', name: 'Connected devices', reach: 'More, then Connected devices', use: 'Step counting from the phone\'s health app, and which other devices are and are not supported yet.' },
  { route: 'settings/notifications', name: 'Notifications', reach: 'More, then Notifications', use: 'Daily prompts and reminders.' },
  { route: 'settings/privacy', name: 'Privacy', reach: 'More, then Privacy', use: 'How your data is handled.' },
  { route: 'settings/data', name: 'Your data', reach: 'More, then Your data', use: 'Download a copy of everything, what your data may be used for, and deleting your account.' },
  { route: 'settings/support', name: 'Help and support', reach: 'More, then Help and support', use: 'Getting help with the app.' },
  // DURING THE BETA THERE IS A BEETLE BESIDE THE THREE SEEDS on every screen,
  // which opens the same form where they already are. Named first because that
  // is the one somebody can reach without leaving the thing that went wrong -
  // and because the app spent the evening sending Ruth to More for faults it
  // should simply have fixed.
  { route: 'settings/feedback', name: 'Something not right?', reach: 'the small beetle at the top right, beside the three seeds, on any screen while the app is in beta; also More, then Something not right?', use: 'Reporting a problem. It attaches the screen they were on, and they can add a picture.' },
  { route: 'health-data', name: 'Why Selodía asks for your steps', reach: 'from the phone\'s health permission screen', use: 'What step access is for, and turning it on.' },
];

/**
 * Screens deliberately NOT in the guide, with the reason. The check requires
 * every screen to be in one list or the other.
 */
export const NOT_IN_GUIDE: Record<string, string> = {
  'settings/about': 'version and company details, nothing to explain',
  'settings/beta-feedback': 'for invited testers only',
  'settings/activity-level': 'reached from Profile, described there',
};

/** Onboarding screens are setup, not features, and are left out as a group. */
export const NOT_IN_GUIDE_PREFIXES = ['onboarding/'];

/** The guide as the chat reads it. */
export function appGuideBlock(): string {
  return [
    'WHAT THE APP CAN DO, so you can point them to it when it would genuinely help, in these exact names. Never describe a feature that is not in this list, and never send them looking for something to do what you can do for them in chat.',
    ...APP_GUIDE.map((e) => `- ${e.name} (${e.reach}): ${e.use}`),
  ].join('\n');
}
