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
 * OFF UNTIL RUTH HAS READ THE LIST **AND** A CLINICIAN HAS REVIEWED IT.
 *
 * Two gates, not one, and the first is the one I nearly skipped: she asked for
 * this to be built, which is not the same as having seen eighteen clinical
 * judgements and agreed to them.
 *
 * A SWITCH RATHER THAN AN UNMERGED BRANCH, so the code travels with everything
 * else, is covered by the checks, and cannot rot - and so turning it on is one
 * line rather than a rebase. Turning it on is a clinical decision, not an
 * engineering one.
 *
 * WHAT IS UNAFFECTED BY THIS FLAG: the five-tier safety machine, which owns
 * distress and self-harm and has always been on. This switch governs the new
 * physical red flags only.
 */
export const RED_FLAGS_LIVE = false;

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
    key: 'postmenopausal_bleeding',
    urgency: 'gp',
    name: 'Bleeding after the menopause',
    // THE MOST IMPORTANT ITEM ON THIS LIST FOR THIS AUDIENCE. NHS: see a GP if
    // you have noticed bleeding after your menopause, "even if it's only a
    // small amount or it's only happened once". A referral is then seen within
    // two weeks.
    phrases: [
      'bleeding after my menopause',
      'bleeding since my menopause',
      'bled after the menopause',
      'spotting after my menopause',
      'bleeding and i went through the menopause',
      'bleeding and my periods stopped',
    ],
  },
  {
    key: 'breast_change',
    urgency: 'gp',
    name: 'A new breast lump or nipple change',
    phrases: ['lump in my breast', 'breast lump', 'my nipple has changed', 'nipple has inverted'],
  },
  {
    key: 'new_lump',
    urgency: 'gp',
    name: 'Any new lump',
    phrases: ['found a lump', 'new lump', 'theres a lump', "there's a lump"],
  },
  {
    key: 'irregular_bleeding',
    urgency: 'gp',
    name: 'Bleeding between periods or after sex',
    phrases: ['bleeding between periods', 'bleeding after sex', 'spotting between periods'],
  },
  {
    key: 'persistent_bloating',
    urgency: 'gp',
    name: 'Bloating for three weeks or more',
    // The ovarian cancer picture, and routinely dismissed as "just
    // perimenopause" - which is precisely why an app for this audience should
    // be the thing that does not dismiss it.
    phrases: [
      'bloated for weeks',
      'bloated for a month',
      'bloated for about a month',
      'bloating for weeks',
      'been bloated for three weeks',
    ],
  },
  {
    key: 'blood_in_urine_or_stool',
    urgency: 'gp',
    name: 'Blood in urine or stool',
    phrases: ['blood in my urine', 'blood in my wee', 'blood in my stool', 'blood in my poo'],
  },
  {
    key: 'unexplained_weight_loss',
    urgency: 'gp',
    name: 'Unexplained weight loss',
    phrases: [
      'losing weight without trying',
      'lost weight without trying',
      'weight is falling off me',
    ],
  },
  {
    key: 'changed_mole',
    urgency: 'gp',
    name: 'A mole that has changed',
    phrases: ['mole has changed', 'mole is changing', 'mole has got bigger'],
  },
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
  {
    // HERS, in the same message: "add to GP list: dizzyness and vertigo set."
    //
    // THE GENTLEST TIER ON PURPOSE. Dizziness has a long list of ordinary causes
    // and a few that matter, and in this audience low iron and perimenopause are
    // near the top of the ordinary ones. "Worth getting checked" is the honest
    // weight for it.
    key: 'dizziness_vertigo',
    urgency: 'gp',
    name: 'Dizziness or vertigo',
    phrases: [
      'dizzy',
      'dizziness',
      'vertigo',
      'light headed',
      'light-headed',
      'lightheaded',
      'room is spinning',
      'everything is spinning',
      'the room spins',
    ],
  },
  {
    key: 'persistent_cough',
    urgency: 'gp',
    name: 'A cough lasting three weeks or more',
    phrases: ['cough for weeks', 'coughing for weeks', 'cough for over three weeks'],
  },
];

// THE LINES. Fixed, and the same every time, which is the point of a
// deterministic rule. No hedging, no "it's probably nothing", and no alarm
// beyond what the urgency actually warrants.
const LINES: Record<Urgency, (name: string) => string> = {
  '999': () =>
    'Please call 999 now. What you have described needs an ambulance, and it is better to call and be told it is nothing.',
  '111': () =>
    'Please call 111 today. What you have described should be looked at by someone today rather than left.',
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

function mentions(text: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = escaped.split(/\s+/).join('\\s+');
  return new RegExp(`\\b${pattern}`, 'i').test(text);
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
      if (flag.phrases.some((p) => mentions(text, p))) {
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
export async function alreadyRaised(
  supabase: SupabaseClient,
  userId: string,
  key: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('red_flags_raised')
    .select('flag_key')
    .eq('user_id', userId)
    .eq('flag_key', key)
    .maybeSingle();
  // FAILS CLOSED-ISH, AND DELIBERATELY THE OTHER WAY FROM THE ALLERGY GATE. If
  // the lookup fails we do not know whether she has been told, and telling
  // somebody twice about a lump is far better than never telling her at all.
  if (error) return false;
  return data != null;
}

export async function recordRaised(
  supabase: SupabaseClient,
  userId: string,
  key: string
): Promise<void> {
  await supabase.from('red_flags_raised').insert({ user_id: userId, flag_key: key });
}
