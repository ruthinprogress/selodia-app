import type { SupabaseClient } from '@supabase/supabase-js';

// THE RED FLAGS. Narrow, deterministic, and never a model judgement.
//
// NOT APPROVED. Ruth asked for this to be BUILT on 28 September 2026 and
// corrected the record on the 29th: she has not seen the list. "Please don't
// record it as approved by me."
//
// The distinction matters more than it looks. An instruction to build is not a
// sign-off on eighteen clinical judgements, and writing "approved" into the
// file would have left a future reader - including me - treating her name as
// cover for a list she had never read. SAFETY_ARCHITECTURE.md §10 holds the
// full six-layer design; this is layer 2.
//
// TWO REVIEWS ARE OUTSTANDING, not one: hers, and a clinician's.
//
// THE RULE FOR BEING ON THIS LIST: missing it is severe, and a false alarm
// costs one unnecessary GP appointment. Anything that fails either half is not
// a red flag, it is a symptom, and symptoms belong to §11's "worth raising with
// a doctor" line.
//
// IT MATCHES WHAT SHE SAID, NOT WHAT THE APP WROTE, and that is the opposite of
// the allergy gate on purpose. The allergy gate reads output because it is
// stopping the app suggesting something. A red flag is about what she has told
// us. Getting this backwards would have the app flagging its own sentences,
// which is how the nickel failure happened one file over.
//
// IT NEVER REPLACES THE REPLY. She asked something and deserves an answer as
// well as a flag. The §2 safety machine substitutes its screening question
// because a screening question must not co-occur with anything else; a red flag
// is not a screening question.
//
// ACUTE DISTRESS WINS. If the turn is already at a distress tier, the safety
// machine owns it completely and this is suppressed. Two safety mechanisms
// speaking in one message is the failure that produced the "logged fine / did
// not save" reply, in a far worse place.
//
// SELF-HARM IS DELIBERATELY NOT ON THIS LIST. It is already handled, properly,
// by the five-tier machine with its C-SSRS-grounded escalation. A second,
// dumber path to the same place would eventually disagree with the first.
//
// AND THE THING THAT WILL BE TEMPTING AND IS WRONG: do not let the model decide
// whether a flag applies. The whole value is that it is deterministic. A model
// that can be talked out of mentioning chest pain is worse than no rule.

/**
 * ON SINCE 6 OCTOBER 2026, ON HER WRITTEN APPROVAL AND NOT A CLINICIAN'S.
 *
 * Her words, in full, which are the authority for this line being true:
 *
 *   "approved, six 999 flags, no clinician has reviewed them"
 *
 * And the decision that sets the terms, from the same day:
 *
 *   "Option 2, with a change. I'll approve the six 999 flags myself, in
 *   writing, once the fixes below are made. No clinician has reviewed them.
 *   Record that in the repo. A clinician reviews before any beta users."
 *
 * ──────────────────────────────────────────────────────────────────────────
 * THAT CONDITION CHANGED ON 8 OCTOBER 2026, and this block records the change
 * rather than overwriting it, because the sentence above was the authority for
 * weeks and a reader needs to see both.
 *
 * It used to say: a clinician reviews before any beta user, as a condition of
 * this switch being on. Her words today, in full:
 *
 *   "And tbh, I dont think it's needed. Its a nice to have and we should go to
 *   that NHS thing that was offered."
 *
 *   SO IT IS NO LONGER A GATE. A paid clinical review is a nice-to-have, and
 *   the route she wants instead is the free Health Innovation Network South
 *   London innovation clinic, offered unprompted by Jade Okparanta on 7 October
 *   2026 and not yet taken up.
 *
 *   WHAT THAT MEANS, STATED ONCE AND NOT ARGUED: eleven prompts that route a
 *   person toward 999 or 111 are live on the founder's written approval and no
 *   clinician's, and that is now the position at beta rather than a temporary
 *   one. It is her call and it is recorded here so nobody has to reconstruct it.
 *
 *   THE HIN CLINIC IS WORTH MORE THAN THE REVIEW ANYWAY, which is probably why
 *   she chose it. The question only an outside body can answer is whether any
 *   of this makes Selodía Software as a Medical Device. HIN South London and
 *   DigitalHealth.London have run a programme on exactly that route.
 *
 *   NEEDS_CLINICIAN_REVIEW still names the one flag written out of a
 *   conversation rather than carried in from the original set, and it should
 *   still be read first by whoever does look at these.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * WHAT THIS SWITCH ACTUALLY TURNS ON: eleven flags, not six. Six at 999, which
 * are what she approved in writing, and five at 111, which she read the same day
 * and called "very good" before adding two of them herself. The GP tier no
 * longer exists - she removed it, and those symptoms are handled by the prompt.
 *
 * WHAT IS UNAFFECTED: the five-tier safety machine, which owns distress and
 * self-harm and has always been on. This governs the physical flags only.
 *
 * WHY IT WAS OFF FOR WEEKS. Two gates, and the first one - "Ruth has read the
 * list" - stayed shut on a list nobody had put in front of her. It existed only
 * as code until she asked where it was. A gate nobody can reach is not a gate,
 * it is a stall.
 */
export const RED_FLAGS_LIVE = true;

/**
 * HER APPROVAL, VERBATIM, so the claim above has something behind it.
 *
 * A date and a sentence, kept in the code rather than in a commit message,
 * because this is the record somebody will want if they ever ask on what
 * authority an app told a woman to call an ambulance.
 */
export const RUTH_APPROVAL = {
  date: '2026-10-06',
  said: 'approved, six 999 flags, no clinician has reviewed them',
  tiers: ['999'] as const,
  clinicianReviewed: false,
  // WAS 'any beta user' UNTIL 8 OCTOBER 2026. Null because it is no longer a
  // condition of anything: "I dont think it's needed. Its a nice to have and we
  // should go to that NHS thing that was offered." Nothing in the code ever read
  // this field, so the change is to the record and not to behaviour.
  clinicianRequiredBefore: null,
  clinicianReviewChanged: {
    date: '2026-10-08',
    said: "I dont think it's needed. Its a nice to have and we should go to that NHS thing that was offered.",
    insteadOf: 'a paid clinical review',
    route: 'Health Innovation Network South London innovation clinic, offered 7 October 2026',
  },
} as const;

/**
 * WHAT RUTH HAS REVIEWED, AND WHEN. The first gate, in writing.
 *
 * 6 OCTOBER 2026, THE SIX 999 FLAGS. She read them for the first time - they had
 * only ever existed as code, which is why the gate had stayed shut for weeks
 * without anybody noticing it was shut on nothing.
 *
 *   Chest pain or pressure            approved as written
 *   Sudden severe headache            APPROVED WITH A CHANGE, hers: the bare
 *                                     phrase "worst headache" was removed
 *                                     because it fires on a hangover or a
 *                                     migraine, and the urgency was kept because
 *                                     the flag is about a SUDDEN headache
 *   Stroke signs                      approved as written
 *   Severe difficulty breathing       approved as written
 *   Bleeding that will not stop       approved as written
 *   Sudden loss of vision             approved as written
 *
 * Her words: "all the rest of the 999 are correct."
 *
 * STILL UNREVIEWED: the three 111 flags and the nine GP flags.
 *
 * AND THE SECOND GATE IS STILL SHUT. Her approval is not a clinician's, and this
 * switch stays false until that is settled one way or the other - either a
 * clinician reads them, or she decides in writing to ship without one. Turning it
 * on is a clinical decision and it is not mine.
 */
export const REVIEWED_BY_RUTH = ['999', '111'] as const;

/**
 * FLAGS THAT NEED A CLINICIAN'S EYE FIRST, named rather than left to be noticed.
 *
 * Ruth asked for heavy bleeding with faintness and said in the same breath:
 * "mark it for clinician review". It is the only flag on the list written out of
 * a conversation rather than carried in from the original clinical set, and the
 * judgement in it - that the COMBINATION is 111 while either half alone is not -
 * is exactly the kind a clinician should check.
 *
 * Everything else here is awaiting the same review. This names the one that
 * should be read first.
 */
export const NEEDS_CLINICIAN_REVIEW = ['heavy_bleeding_with_faintness'] as const;

export type Urgency = '999' | '111' | 'gp';

export type RedFlag = {
  key: string;
  urgency: Urgency;
  /** What it is, for the log and for Ruth's review. */
  name: string;
  /**
   * Phrases in HER words. Matched case-insensitively at word boundaries.
   * Written as things a person actually types, not as clinical terms.
   */
  phrases: string[];
  /**
   * Words that, if present, mean this is not about her. Someone asking "is
   * chest pain a sign of anything?" or talking about her mother is not
   * reporting chest pain, and a line about calling 999 would be absurd.
   */
  notAbout?: string[];
  /**
   * A SECOND CONDITION, BOTH OF WHICH MUST BE PRESENT (Ruth, 6 October 2026).
   *
   * Her addition: "bumped my head and feel dizzy". That is not one phrase, it is
   * two facts - an injury and a symptom - and neither one alone is the thing.
   * A bump on the head with nothing else is an ordinary day. Feeling dizzy with
   * no bump is a GP matter, and she asked for that separately.
   *
   * WITHOUT THIS THE FLAG WOULD HAVE TO BE WRITTEN AS WHOLE SENTENCES, and
   * "bumped my head and feel dizzy" would miss "banged my head, feeling really
   * dizzy now". Matching two groups is what she actually meant.
   */
  alsoNeeds?: string[];
};

export const RED_FLAGS: RedFlag[] = [
  // ---------------------------------------------------------------- 999
  {
    key: 'chest_pain',
    urgency: '999',
    name: 'Chest pain or pressure',
    phrases: [
      'chest pain',
      'pain in my chest',
      'chest hurts',
      'tightness in my chest',
      'chest feels tight',
      'crushing feeling in my chest',
      'pressure in my chest',
    ],
  },
  {
    key: 'thunderclap_headache',
    urgency: '999',
    name: 'Sudden severe headache',
    // NARROWED BY RUTH, 6 October 2026, reviewing the list for the first time:
    // "this seems a bit ott for a headache."
    //
    // She was half right and the half she was right about mattered. The flag is
    // not about a headache, it is about a SUDDEN one - the pattern that arrives
    // in seconds, which is why it carries an ambulance. But the first phrase was
    // a bare "worst headache", and that fires on a hangover, a migraine, or the
    // worst headache somebody has had this week. None of those are sudden.
    //
    // A 999 LINE IN REPLY TO AN ORDINARY BAD HEADACHE IS THE THING THAT WOULD
    // DESTROY THIS WHOLE MECHANISM, and this file says so about itself two
    // hundred lines up, and then shipped the phrase anyway.
    //
    // The four that remain all carry the suddenness or the of-my-life, which is
    // what the urgency is actually for. Her decision: narrow the phrases, keep
    // the urgency.
    phrases: [
      'worst headache of my life',
      'thunderclap headache',
      'sudden severe headache',
      'headache came on like a thunderclap',
    ],
  },
  {
    key: 'stroke_signs',
    urgency: '999',
    name: 'Stroke signs',
    phrases: [
      'face has dropped',
      'face is drooping',
      'my speech is slurred',
      'slurring my words',
      'one arm has gone weak',
      'cannot lift one arm',
      "can't lift one arm",
    ],
  },
  {
    key: 'breathing',
    urgency: '999',
    name: 'Severe difficulty breathing',
    phrases: [
      'cannot breathe',
      "can't breathe",
      'struggling to breathe',
      'fighting for breath',
      'gasping for air',
    ],
    // FIGURATIVE USES, WHICH ARE THE COMMONEST USES (Ruth, 6 October 2026):
    // "stop figurative phrases firing 999 (can't breathe through my nose, can't
    // breathe in this heat)."
    //
    // "I can't breathe" is one of the most ordinary sentences in English and
    // almost never means what this flag means. A blocked nose, a hot room, a
    // tight waistband, a stuffy train. An ambulance line in reply to any of
    // those is the thing that would make somebody stop believing the whole
    // mechanism - and unlike the headache, this is not a loose phrase that can
    // simply be deleted, because the literal use is the one that matters most.
    //
    // SO IT IS A LIST OF WHAT FOLLOWS IT. Everything here is a reason somebody
    // cannot breathe that is not an emergency.
    notAbout: [
      'through my nose',
      'out of my nose',
      'in this heat',
      'in the heat',
      'in here',
      'with this cold',
      'with my cold',
      'with hay fever',
      'because of my nose',
      'blocked nose',
      'stuffy nose',
      'congested',
      'in these jeans',
      'in this dress',
      'in this top',
      'laughing',
      'the smell',
    ],
  },
  {
    key: 'bleeding_wont_stop',
    urgency: '999',
    name: 'Bleeding that will not stop',
    phrases: ['bleeding and it will not stop', "bleeding and it won't stop", 'cannot stop the bleeding'],
  },
  {
    key: 'vision_loss',
    urgency: '999',
    name: 'Sudden loss of vision',
    phrases: ['lost my vision', 'lost the sight in', 'gone blind', 'cannot see out of one eye'],
  },

  // ---------------------------------------------------------------- 111
  {
    key: 'calf_clot',
    urgency: '111',
    name: 'One-sided calf pain and swelling',
    // THE CLOT PICTURE, and on this list for this audience in particular: HRT
    // raises the background risk, so a swollen warm calf in a woman on HRT is
    // the case where a false alarm is cheapest and a miss is worst.
    phrases: [
      'calf is swollen',
      'one leg is swollen',
      'calf is hot and swollen',
      'swollen calf',
      'my leg is swollen and red',
      'one calf is bigger than the other',
    ],
  },
  {
    key: 'fainting',
    urgency: '111',
    name: 'Fainting or blackouts',
    phrases: ['i fainted', 'i blacked out', 'i passed out', 'keep fainting'],
  },
  {
    key: 'abdominal_pain',
    urgency: '111',
    name: 'New severe abdominal pain',
    phrases: ['severe stomach pain', 'severe abdominal pain', 'agonising stomach pain'],
  },

  // ---------------------------------------------------------------- GP
  {
    // HERS, 6 October 2026: "I would add more - bumped my head and feel dizzy."
    //
    // TWO FACTS, NOT ONE. A bump on the head alone is an ordinary day and this
    // must not fire on it; dizziness alone is the GP flag she added in the same
    // breath. It is the combination that wants looking at today, and the matcher
    // learned `alsoNeeds` for it.
    //
    // ORDER DOES THE REST. The matcher works 999, then 111, then GP, so somebody
    // who says they banged their head and feel dizzy gets this and not the
    // gentler dizziness flag below.
    // HERS, 6 October 2026, and it is the compromise we reached rather than
    // either of the two positions we started from.
    //
    // Her first prompt promised "heavy or unexpected bleeding" at the emergency
    // tier. The list only had bleeding that will not stop. I argued against
    // adding heavy bleeding to 999 on its own, because heavy periods are common
    // and are not an emergency, and an ambulance line at somebody with a heavy
    // period is the false alarm that costs the whole mechanism. She agreed, and
    // asked for the combination instead: "Add heavy bleeding plus faint/dizzy at
    // the 111 tier, and mark it for clinician review."
    //
    // THE COMBINATION IS THE SIGNAL. Heavy bleeding on its own is a symptom;
    // heavy bleeding with the room going is blood loss doing something, and it
    // is the pairing a clinician would ask about first.
    //
    // NEEDS_CLINICIAN_REVIEW: this is the one flag on the list that was written
    // from a conversation rather than carried over, so it is named separately
    // below for whoever reviews these.
    key: 'heavy_bleeding_with_faintness',
    urgency: '111',
    name: 'Heavy bleeding, with feeling faint',
    phrases: [
      'bleeding heavily',
      'heavy bleeding',
      'bleeding a lot',
      'soaking through',
      'flooding',
      'losing a lot of blood',
    ],
    alsoNeeds: [
      'faint',
      'fainted',
      'dizzy',
      'dizziness',
      'light headed',
      'light-headed',
      'lightheaded',
      'going to pass out',
    ],
  },
  {
    key: 'head_injury_with_symptoms',
    urgency: '111',
    name: 'A bump to the head, with dizziness',
    phrases: [
      'bumped my head',
      'banged my head',
      'hit my head',
      'knocked my head',
      'fell and hit my head',
      'had a bang on the head',
    ],
    alsoNeeds: ['dizzy', 'dizziness', 'light headed', 'light-headed', 'lightheaded'],
  },
  // ---------------------------------------------------------------- gp
  //
  // THERE IS NO GP TIER ANY MORE (Ruth, 6 October 2026):
  //
  //   "GP tier (10 flags): remove the detector and the approved-text structure
  //   entirely. Prompt only."
  //
  // TEN FLAGS CAME OUT OF HERE. Bleeding after the menopause, a new breast lump,
  // any new lump, bleeding between periods, bloating for three weeks, blood in
  // urine or stool, unexplained weight loss, a changing mole, dizziness or
  // vertigo, and a cough lasting three weeks.
  //
  // NOTHING IS LOST. Her "When something sounds physical" section carries them:
  // five are named there as things not to wait on, and the rest get the ordinary
  // treatment - explain, record, keep talking, go if it persists. A probe on 6
  // October showed the prompt alone answering a lump with "worth getting checked
  // soon rather than waiting to see what happens", which is the behaviour the
  // detector existed to force.
  //
  // WHY SHE WAS RIGHT TO CUT IT. "It's one more fixed body of text for the model
  // to read and get clogged on, which is the same problem as the deflection
  // rule." Ten detectors each with their own approved paragraph is answering a
  // prompt problem with more prompt, which is the mistake that caused all of
  // this in the first place.
  //
  // THE DETECTOR NOW HOLDS ONLY WHAT INTERRUPTS: six at 999, five at 111.
];

// THE LINES. Fixed, and the same every time, which is the point of a
// deterministic rule. No hedging, no "it's probably nothing", and no alarm
// beyond what the urgency actually warrants.
const LINES: Record<Urgency, (name: string) => string> = {
  '999': () =>
    'Please call 999 now. What you have described needs an ambulance, and it is better to call and be told it is nothing.',
  // HER WORDING, 6 October 2026, and the change is not only the words.
  //
  //   "111 (4 flags): stays a detector, but the fixed text is one line: 'This is
  //   worth checking today, so call 111, especially if it's severe or getting
  //   worse.' After that, the conversation continues normally."
  //
  // THE OLD LINE ENDED THE TURN. "Should be looked at by someone today rather
  // than left" is a verdict with nowhere to go after it, and the reply stopped
  // there. Hers names the threshold - severe, or getting worse - which is the
  // thing somebody actually needs to judge their own situation against, and then
  // gets out of the way so the conversation carries on.
  '111': () =>
    "This is worth checking today, so call 111, especially if it's severe or getting worse.",
  gp: () =>
    'Please book an appointment with your GP about this. It is worth getting checked, even if it turns out to be nothing.',
};

/**
 * THE TALKING-TO-SOMEBODY-ELSE TEST, applied to every flag.
 *
 * "Is chest pain a sign of anything?" and "my mum had chest pain" are not
 * somebody reporting chest pain, and a line about calling 999 in reply to
 * either is absurd enough to destroy trust in the whole mechanism. This is the
 * same distinction the allergy gate got wrong - a MATCH is not a REPORT - and
 * the lesson is cheap to apply here because it only has to read her message.
 */
const THIRD_PARTY = [
  'my mum',
  'my mother',
  'my sister',
  'my friend',
  'my husband',
  'my partner',
  'my daughter',
  // HERS, 6 October 2026. The original list had no children and no men in it,
  // which is a strange gap in an app used by mothers: "my son bumped his head
  // and feels dizzy" would have told HER to call 111.
  //
  // FELIX BY NAME, because she types his name rather than "my son", and the list
  // only works on what somebody actually writes.
  'my son',
  'felix',
  'my baby',
  'my toddler',
  'my boy',
  'my girl',
  'my child',
  'my kid',
  'my dad',
  'my father',
  'my brother',
  'my husband',
  'someone',
  'a friend of mine',
];

/**
 * IF SHE IS NOT IN THE SENTENCE, IT IS NOT A REPORT ABOUT HER.
 *
 * The first version of this kept a list of question openings - "is it", "what
 * causes", "can you get" - and it failed on the very first case tried: "is
 * chest pain always serious?" begins with none of them, so the app answered a
 * general question by telling her to call an ambulance.
 *
 * A prefix list is the wrong shape for this, because the ways to ask a question
 * are unbounded and the ways to report something about yourself are not. Every
 * real report contains a first-person reference - I, I've, my, me - and a
 * question in the abstract contains none. That is one rule instead of twenty,
 * and it does not need extending every time somebody phrases a question a new
 * way.
 */
const FIRST_PERSON = /\b(i|i'm|im|i've|ive|my|me|myself|mine)\b/i;

/**
 * IS SHE SAYING IT IS HAPPENING NOW? (Ruth, 6 October 2026.)
 *
 *   "Handle negation ('I don't have chest pain') and past events ('I had chest
 *   pain last year'), or tell me honestly that it can't."
 *
 * IT CAN FOR THE ORDINARY CASES AND NOT FOR ALL OF THEM, and this is the honest
 * version of that answer - the dishonest version is a longer word list that
 * looks complete.
 *
 * WHAT IT CATCHES: a negation or a past-tense marker in the sixty characters
 * before the phrase. "I don't have chest pain", "no chest pain today", "I had
 * chest pain last year", "my chest pain cleared up in March". That is the shape
 * nearly every real one takes, because English puts the negation and the tense
 * in front of the thing.
 *
 * WHAT IT WILL MISS, and she should hear it from here rather than find it:
 *
 *   "Chest pain, but that was years ago."        the marker comes after
 *   "I wouldn't say I have chest pain exactly."  hedged rather than negated
 *   "The chest pain I used to get is back."      past marker, present fact
 *
 * The third is the one that matters and it fails SAFE: it stays silent when it
 * should have spoken. Every miss here is a silence and never a false alarm,
 * which is the right direction for a rule that interrupts.
 *
 * AND IT IS DELIBERATELY NOT A MODEL. The whole value of this file is that it
 * cannot be talked out of anything, and a model asked "is she reporting this
 * now?" can be. A dumber rule that fails quietly beats a cleverer one that can
 * be argued with.
 */
/**
 * FOR 999, SUPPRESS ALMOST NOTHING (Ruth, 6 October 2026).
 *
 *   "Your note says every miss is a silence, never a false alarm. Check that
 *   against 'The chest pain I used to get is back': it's a present report, and
 *   'used to' suppresses it... For 999, suppress only on clear negation or an
 *   explicit date. If it's ambiguous, fire."
 *
 * SHE IS RIGHT AND MY REASONING WAS BACK TO FRONT. I wrote that every miss fails
 * safe, which is true of the mechanism and false of the consequence: at this
 * tier a false alarm costs somebody an awkward phone call, and a silence costs
 * what a silence costs. "Fails safe" was doing a lot of work in that sentence
 * and none of it was examined.
 *
 * SO THE LIST SPLITS. These are the only things that stop a 999 flag: a plain
 * denial, or a date that puts it somewhere else. "Used to", "cleared up", "went
 * away" and "got better" are NOT here, because "the chest pain I used to get is
 * back" is a report and so is "it went away and now it's back".
 */
const NOT_NOW_999 = [
  "don't have",
  'do not have',
  "haven't had",
  'have not had',
  "didn't have",
  "don't get",
  'never had',
  'no sign of',
  'not having',
  'no chest',
  'no bleeding',
  'no headache',
];

/**
 * THE WIDER LIST, for 111 and below, where an unnecessary nudge is a real cost
 * and a day's delay is not the same kind of harm.
 */
const NOT_NOW = [
  // Negation.
  "don't have",
  'do not have',
  "haven't had",
  'have not had',
  "didn't have",
  "don't get",
  'never had',
  'no sign of',
  'not having',
  'no chest',
  'no bleeding',
  'no headache',
  // The past.
  'used to',
  'last year',
  'last month',
  'last week',
  'years ago',
  'months ago',
  'when i was',
  'back in',
  'cleared up',
  'went away',
  'got better',
  // "I HAD" AND "I'VE HAD" ARE NOT ON THIS LIST, and the check is why.
  //
  // I put them here and it immediately failed on "I've had some bleeding after
  // my menopause" - which is a present report in the present perfect, and one of
  // the five things her prompt says not to wait on. "I had chest pain this
  // morning" is the same shape.
  //
  // A BARE TENSE IS NOT A TIME. Only the markers that unambiguously place
  // something in the finished past belong here, and every one of those above
  // does. "I had chest pain last year" is caught by "last year", which is the
  // part that actually carries the meaning.
];

/**
 * WHEN IT HAPPENED, SAID AFTER THE THING. "I had chest pain last year."
 *
 * English puts a negation in front and a date behind, which the first version of
 * this missed entirely: it looked only backwards, and the case it failed on was
 * the one I had written into my own documentation as handled.
 *
 * DATES ONLY, AND NOT NEGATIONS. A negation after the phrase ("chest pain, well,
 * not really") is rare and ambiguous. A date after it is neither.
 *
 * AND A SHORT WINDOW, because "I have chest pain. Last year I had a scare" must
 * still raise. Forty characters reaches the end of the clause and not into the
 * next sentence.
 */
const DATED_TO_THE_PAST = [
  'last year',
  'last month',
  'last week',
  'years ago',
  'months ago',
  'weeks ago',
  'when i was',
  'back in',
  'cleared up',
  'went away',
  'got better',
  'as a teenager',
  'as a child',
];

/** The run of text before the phrase, where a negation or a tense marker sits. */
const LOOKBACK = 60;
/** And the run after it, where a date sits. Short, to stay inside the clause. */
const LOOKAHEAD = 40;

/**
 * ONLY A DATE, AND ONLY A SPECIFIC ONE, DATES A 999 REPORT.
 *
 * "Cleared up", "went away" and "got better" are not here. They describe an
 * episode that ended, and the sentence they most often appear in at this tier is
 * "it went away and now it's back".
 */
const DATED_AWAY_FROM_NOW = [
  'last year',
  'last month',
  'years ago',
  'months ago',
  'when i was',
  'back in',
  'as a teenager',
  'as a child',
];

function saidAsHappeningNow(text: string, at: number, urgency: Urgency): boolean {
  const before = text.slice(Math.max(0, at - LOOKBACK), at);
  // The clause after it, stopping at a full stop so the next sentence cannot
  // date this one.
  const rest = text.slice(at, at + LOOKAHEAD).split(/[.!?]/)[0];

  // AT 999, AMBIGUITY FIRES. Her rule, and the right way round: an awkward phone
  // call against a silence about chest pain is not a close decision.
  if (urgency === '999') {
    if (NOT_NOW_999.some((marker) => before.includes(marker))) return false;
    return !DATED_AWAY_FROM_NOW.some((marker) => rest.includes(marker) || before.includes(marker));
  }

  if (NOT_NOW.some((marker) => before.includes(marker))) return false;
  return !DATED_TO_THE_PAST.some((marker) => rest.includes(marker));
}

function mentions(text: string, phrase: string): boolean {
  return mentionedAt(text, phrase) >= 0;
}

/** Where the phrase appears, or -1. Needed so a negation can be looked for. */
function mentionedAt(text: string, phrase: string): number {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = escaped.split(/\s+/).join('\\s+');
  const found = new RegExp(`\\b${pattern}`, 'i').exec(text);
  return found ? found.index : -1;
}

export type FlagHit = { flag: RedFlag; line: string };

/**
 * Which flag, if any, this message raises.
 *
 * ONE AT MOST, and the most urgent wins. Two safety lines in one reply is the
 * shape of message that reads as a system malfunction rather than as care.
 */
export function matchRedFlag(message: string): FlagHit | null {
  const text = (message ?? '').toLowerCase();
  if (!text.trim()) return null;

  // About somebody else, or asked in the abstract: not a report.
  if (THIRD_PARTY.some((p) => text.includes(p))) return null;
  if (!FIRST_PERSON.test(text)) return null;

  const order: Urgency[] = ['999', '111', 'gp'];
  for (const urgency of order) {
    for (const flag of RED_FLAGS.filter((f) => f.urgency === urgency)) {
      if (flag.notAbout?.some((n) => mentions(text, n))) continue;
      // BOTH HALVES, where a flag names two. See alsoNeeds: an injury without a
      // symptom, or a symptom without the injury, is not this flag.
      if (flag.alsoNeeds && !flag.alsoNeeds.some((a) => mentions(text, a))) continue;
      // SAID AS HAPPENING NOW, not denied and not remembered. See NOT_NOW: a
      // negation or a tense marker in the run of text just before the phrase
      // means this is not a report. "I don't have chest pain" and "I had chest
      // pain last year" both used to call an ambulance.
      const at = flag.phrases.map((p) => mentionedAt(text, p)).find((i) => i >= 0);
      if (at !== undefined && saidAsHappeningNow(text, at, urgency)) {
        return { flag, line: LINES[urgency](flag.name) };
      }
    }
  }
  return null;
}

/**
 * Has this flag already been raised with her?
 *
 * ONCE, AND NOT AGAIN. §11's rule, and the reason is the same: somebody who has
 * been told and not gone has made a decision, and the app's job is not to keep
 * asking. Saying it twice makes the app a nag about her own body.
 */
/**
 * HOW LONG A 999 FLAG STAYS QUIET AFTER IT HAS SPOKEN (Ruth, 6 October 2026).
 *
 *   "Once per flag, ever, is too blunt for 999. Let it repeat after a gap
 *   (suggest 24 hours) and keep once-per-episode for 111."
 *
 * ONCE-EVER WAS THE WRONG SHAPE AT THIS TIER, and the reasoning behind it -
 * "somebody who has been told and has not gone has made a decision" - is sound
 * for a lump and wrong for chest pain. Chest pain on Tuesday and chest pain again
 * on Friday are two events, and the second one deserves to be met rather than
 * met with silence because of the first.
 *
 * 111 AND BELOW KEEP ONCE-EVER. A nudge about a cough that returns every day for
 * a fortnight is nagging, and nagging is how somebody stops reading them.
 */
const REPEAT_AFTER_MS = 24 * 60 * 60 * 1000;

export async function alreadyRaised(
  supabase: SupabaseClient,
  userId: string,
  key: string,
  urgency: Urgency = 'gp'
): Promise<boolean> {
  const { data, error } = await supabase
    .from('red_flags_raised')
    .select('flag_key, raised_at')
    .eq('user_id', userId)
    .eq('flag_key', key)
    .maybeSingle();
  // FAILS CLOSED-ISH, AND DELIBERATELY THE OTHER WAY FROM THE ALLERGY GATE. If
  // the lookup fails we do not know whether she has been told, and telling
  // somebody twice about a lump is far better than never telling her at all.
  if (error) return false;
  if (data == null) return false;

  // AT 999 IT GOES QUIET FOR A DAY AND THEN SPEAKS AGAIN. Anywhere else, once is
  // once. A missing or unreadable timestamp is treated as "long ago", which errs
  // towards speaking - the right direction at this tier.
  if (urgency === '999') {
    const raisedAt = Date.parse(String((data as { raised_at?: unknown }).raised_at ?? ''));
    if (!Number.isFinite(raisedAt)) return false;
    return Date.now() - raisedAt < REPEAT_AFTER_MS;
  }

  return true;
}

export async function recordRaised(
  supabase: SupabaseClient,
  userId: string,
  key: string
): Promise<void> {
  // UPSERT, BECAUSE A 999 FLAG CAN SPEAK AGAIN. The primary key is
  // (user_id, flag_key), so a second event moves the timestamp rather than
  // adding a row - and an insert would simply fail on the conflict, leaving the
  // flag thinking it had never spoken.
  await supabase
    .from('red_flags_raised')
    .upsert(
      { user_id: userId, flag_key: key, raised_at: new Date().toISOString() },
      { onConflict: 'user_id,flag_key' }
    );
}
