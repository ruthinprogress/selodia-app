// WHAT SELODÍA'S GUIDANCE IS BUILT FROM, as data rather than prose.
//
// Ruth, 8 October 2026: build the Sources page, do not name her anywhere on it,
// and describe the red-flag detectors as "approved by the founder and not
// clinically reviewed".
//
// EVERY ENTRY HERE ALREADY EXISTED IN THE REPOSITORY. Nothing was researched to
// make this page. The citations come from three reference lists that have been
// maintained alongside the code: Part Eight of `mobile/SELODIA_SPEC.md` for
// movement, its `[R1]`-`[R7]` list for the body and nutrition rules, and
// `mobile/SELODIA_LANGUAGE_RULES.md` `[L1]`-`[L3]` for how it talks about
// change. This file points at them; it does not restate them from memory.
//
// IN A DATA FILE SO THE CHECK CAN WALK IT. `check-sources-page.mjs` asserts
// that every entry carries a resolvable identifier, that none of them names a
// person, and that the page renders the unsourced half as well as the sourced
// one. A page of citations nobody can verify is worse than no page.
//
// THE RULE THAT GOVERNS EVERY WORD ON THAT PAGE: state nothing that cannot be
// verified from the code or the configuration. A source here supports a RULE
// the app applies. It does not mean the app has been trialled, and the page
// says so in its own words.

export type Source = {
  /** Full citation, as the reference list in the repository carries it. */
  cite: string;
  /** DOI, PMID or ISBN. Checked for presence, because a citation nobody can look up is decoration. */
  id: string;
  /** What this source actually supports. Written to be checkable against the code. */
  supports: string;
};

// ---------------------------------------------------------------------------
// Calories, protein and the body
// ---------------------------------------------------------------------------

export const BODY_SOURCES: Source[] = [
  {
    cite: 'Wang Z, Ying Z, Bosy-Westphal A, et al. Specific metabolic rates of major organs and tissues across adulthood: evaluation by mechanistic model of resting energy expenditure. Am J Clin Nutr. 2010;92(6):1369-1377.',
    id: 'doi:10.3945/ajcn.2010.29885',
    supports:
      'Why the daily energy figure is recalculated as muscle mass changes, rather than worked out once from height, weight and age and treated as fixed.',
  },
  {
    cite: 'Jäger R, Kerksick CM, Campbell BI, et al. International Society of Sports Nutrition Position Stand: protein and exercise. J Int Soc Sports Nutr. 2017;14:20.',
    id: 'doi:10.1186/s12970-017-0177-8',
    supports: 'The protein target, which is calculated from body weight and given as a range rather than a single number.',
  },
  {
    cite: 'Helms ER, Zinn C, Rowlands DS, Brown SR. A Systematic Review of Dietary Protein During Caloric Restriction in Resistance Trained Lean Athletes: A Case for Higher Intakes. Int J Sport Nutr Exerc Metab. 2014;24(2):127-138.',
    id: 'doi:10.1123/ijsnem.2013-0054',
    supports: 'Why the protein range goes up, not down, when someone is eating at a deficit.',
  },
  {
    cite: 'Achamrah N, Colange G, Delay J, et al. Comparison of body composition assessment by DXA and BIA according to the body mass index: A retrospective study on 3655 measures. PLoS One. 2018;13(7):e0200465.',
    id: 'doi:10.1371/journal.pone.0200465',
    supports:
      'How much weight to put on a home body composition reading, and why those readings are treated as a trend rather than a measurement.',
  },
  {
    cite: 'Karastergiou K, Smith SR, Greenberg AS, Fried SK. Sex differences in human adipose tissues: the biology of pear shape. Biol Sex Differ. 2012;3(1):13.',
    id: 'doi:10.1186/2042-6410-3-13',
    supports: 'Why fat distribution is described differently for women, and why it changes through midlife.',
  },
  {
    cite: 'White CP, Hitchcock CL, Vigna YM, Prior JC. Fluid Retention over the Menstrual Cycle: 1-Year Data from the Prospective Ovulation Cohort. Obstet Gynecol Int. 2011;2011:138451.',
    id: 'doi:10.1155/2011/138451',
    supports: 'Why a weight reading is read against where someone is in their cycle before anything is made of it.',
  },
  {
    cite: 'Cheung K, Hume PA, Maxwell L. Delayed Onset Muscle Soreness: Treatment Strategies and Performance Factors. Sports Med. 2003;33(2):145-164.',
    id: 'doi:10.2165/00007256-200333020-00005',
    supports: 'How soreness after unfamiliar exercise is explained, and when it is treated as ordinary.',
  },
];

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------

export const MOVEMENT_SOURCES: Source[] = [
  {
    cite: 'WHO Guidelines on Physical Activity and Sedentary Behaviour. World Health Organization; 2020.',
    id: 'isbn:978-92-4-001512-8',
    supports: 'The baseline for how much movement a week is enough, and what counts.',
  },
  {
    cite: 'Dam TV, Dalgaard LB, Ringgaard S, et al. Transdermal Estrogen Therapy Improves Gains in Skeletal Muscle Mass After 12 Weeks of Resistance Training in Early Postmenopausal Women. Front Physiol. 2021;11:596130.',
    id: 'doi:10.3389/fphys.2020.596130',
    supports: 'Why resistance training is treated as the centre of the movement guidance after menopause, not an optional extra.',
  },
  {
    cite: 'Ng CA, et al. Effects of Moderate- to High-Impact Exercise Training on Bone Structure Across the Lifespan: A Systematic Review and Meta-Analysis of Randomized Controlled Trials. J Bone Miner Res. 2023;38(11):1612-1634.',
    id: 'doi:10.1002/jbmr.4899',
    supports: 'Which kinds of movement are described as doing something for bone, and which are not.',
  },
  {
    cite: 'Abrahin O, et al. Swimming and cycling do not cause positive effects on bone mineral density: a systematic review. Rev Bras Reumatol. 2016;56(4):345-351.',
    id: 'doi:10.1016/j.rbre.2016.02.013',
    supports:
      'A negative finding, and it is here deliberately: swimming and cycling are good for plenty and not for bone density, and the app does not claim otherwise.',
  },
  {
    cite: 'Marques ACF, Rossi FE, Neves LM, et al. Combined Aerobic and Strength Training Improves Dynamic Stability and can Prevent against Static Stability Decline in Postmenopausal Women: A Randomized Clinical Trial. Rev Bras Ginecol Obstet. 2023;45(8):e465-e473.',
    id: 'doi:10.1055/s-0043-1772178',
    supports: 'Why the guidance pairs strength work with something aerobic rather than treating them as alternatives.',
  },
  {
    cite: 'Wei F, Hu Z, He R, Wang Y. Effects of balance training on balance and fall efficacy in patients with osteoporosis: A systematic review and meta-analysis with trial sequential analysis. J Rehabil Med. 2023;55:jrm00390.',
    id: 'doi:10.2340/jrm.v55.4529',
    supports: 'Why balance is treated as its own thing to train rather than something that comes along with everything else.',
  },
  {
    cite: 'Letton ME, et al. Classical Ballet for Women Aged Over 50 Years: Investigating Balance, Strength, and Range of Motion. Res Q Exerc Sport. 2024;95(1):171-182.',
    id: 'doi:10.1080/02701367.2023.2169236',
    supports: 'How dance is counted, for women who do it and would rather not be told to go to a gym.',
  },
  {
    cite: 'Csala B, Szemerszky R, Kormendi J, Koteles F, Boros S. Is Weekly Frequency of Yoga Practice Sufficient? Physiological Effects of Hatha Yoga Among Healthy Novice Women. Front Public Health. 2021;9:702793.',
    id: 'doi:10.3389/fpubh.2021.702793',
    supports: 'How yoga is counted, and at what frequency it is described as doing something.',
  },
];

// ---------------------------------------------------------------------------
// How it talks about change
// ---------------------------------------------------------------------------

export const LANGUAGE_SOURCES: Source[] = [
  {
    cite: 'Rubak S, Sandbæk A, Lauritzen T, Christensen B. Motivational interviewing: a systematic review and meta-analysis. Br J Gen Pract. 2005;55(513):305-312.',
    id: 'pmid:15826439',
    supports:
      'A meta-analysis of 72 randomised controlled trials, and what grounds the approach behind how Selodía talks about changing a habit: asking rather than advising, and never arguing somebody into something.',
  },
  {
    cite: 'Miller WR, Rollnick S. Motivational Interviewing: Helping People Change. 3rd ed. New York: Guilford Press; 2013.',
    // NO ISBN, DELIBERATELY. The reference list in the repository carries none
    // for this one, and I am not going to put a number on a public page that I
    // got from memory rather than from the record. Publisher and edition are
    // enough to find a book, and they are what the repository actually holds.
    id: 'book:Guilford Press, 3rd edition, 2013',
    supports: 'The text that defines that approach. The 3rd edition specifically, which is the one the rules were written against.',
  },
  {
    cite: 'Posner K, Brown GK, Stanley B, et al. The Columbia-Suicide Severity Rating Scale: Initial Validity and Internal Consistency Findings From Three Multisite Studies With Adolescents and Adults. Am J Psychiatry. 2011;168(12):1266-1277.',
    id: 'doi:10.1176/appi.ajp.2011.10111704',
    supports:
      'The validated wording used, verbatim, in the one place Selodía asks directly about self-harm. Changing the words would lose the property that was validated, so they are not changed.',
  },
];

// ---------------------------------------------------------------------------
// Published figures quoted directly in conversation
// ---------------------------------------------------------------------------
//
// These are the only numbers Selodía quotes from an outside body by name. They
// live in `app/lib/tracked-macro-summary.ts` as fixed strings, which is why
// they can be listed here exactly as a reader will see them.

export const PUBLISHED_FIGURES: { figure: string; body: string }[] = [
  { figure: 'No more than 20g of saturated fat a day for women, and 30g for men.', body: 'NHS' },
  { figure: '30g of fibre a day for adults, which most people fall short of.', body: 'NHS' },
  { figure: 'No more than 6g of salt a day for adults, which is about 2,400mg of sodium.', body: 'NHS' },
  { figure: '70g of total fat a day for an average adult.', body: 'UK reference intake' },
];
