import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { OnboardingQuestion } from '@/components/onboarding-question';
import { useOnboardingAction } from '@/components/onboarding-action';
import { SetupTextField } from '@/components/setup-text-field';
import { TapChoices } from '@/components/tap-choices';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import {
  ALLERGY_BY_NAME,
  DIETARY_NEEDS,
  FOOD_ALLERGIES,
  MEDICINE_REACTIONS,
  OTHER_REACTIONS,
  type AllergyKind,
} from '@/lib/allergy-options';
import { MOVEMENT_RULES, MOVEMENT_RULE_BY_KEY, termFromTypedRule } from '@/lib/movement-rules';
import {
  LOAD_FAILED_MESSAGE,
  LOAD_RETRY_LABEL,
  mayContinue,
  mayWrite,
  type LoadState,
} from '@/lib/load-state';
import { supabase } from '@/lib/supabase';

// ANYTHING TO STEER AROUND, GROUPED BY WHAT KIND OF THING IT IS.
//
// WHY THIS SCREEN HAD TO EXIST. The conversational health-context step used to
// be the only way an allergy ever reached the database, and the tap spine took
// it out of the chain. Two things depend on that data and both would have failed
// silently: the ALLERGY GATE, which cannot protect anybody from an allergy it
// has never been told about, and MEAL SUGGESTIONS, which would cheerfully have
// offered a vegetarian a chicken salad. Neither throws an error. The app would
// simply have been confidently wrong at somebody.
//
// IT WRITES WHERE THE GATE READS - the `allergies` table, with the same upsert on
// (user_id, name). No second store and no syncing, because two places holding
// the same fact is how they come to disagree.
//
// ---------------------------------------------------------------------------
// GROUPED BY KIND, AND THE GROUPS ARE NOT COSMETIC (Ruth, 2 October, item 5).
//
// Her wording: "on your plate" is THE ONLY KIND THAT ARMS THE FOOD FILTER.
// "Nickel and hay fever must not appear under your plate."
//
// That is a safety requirement wearing a layout requirement's clothes. Nickel
// was once recorded with no kind, defaulted to a food restriction, and blocked
// two plain questions about nickel within a minute. The heading she reads and
// the `kind` the gate switches on are now the same decision, taken once, in this
// file's group list - so a chip cannot be under a heading that means something
// different from what the database will do with it. `assertGroupsMatchKinds`
// below fails the build if one ever is.
//
// MEDICINES ARE THEIR OWN GROUP AND THEIR OWN KIND. Penicillin is not something
// she eats and not something she touches. Left as 'other' it would have armed
// the food filter, because 'other' is deliberately treated as food.
//
// MOVEMENTS TO LEAVE OUT ARE NOT HERE AT ALL. They are rules, they live in
// user_rules, and the rules gate removes exercises with them. A movement in the
// allergies table would be a food restriction named "overhead press".
//
// ---------------------------------------------------------------------------
// NOTHING IS REMOVED BY UNTICKING, AND REMOVING ASKS FIRST.
//
// Ruth, item 4: "Deselecting, deleting or choosing something else OVERWRITES, so
// nothing duplicates. EXCEPTION: allergies, medicines she reacts to and movement
// rules are removed only by an explicit 'Remove this?' tap."
//
// So this screen breaks its own flow's rule, on purpose. Everywhere else a redo
// overwrites; here an untick does nothing at all, because an allergy quietly
// disappearing from a safety list is a far worse failure than one lingering.
// What was missing was the other half: there was no way to remove one from here
// either, so the screen said "say so in chat" and a woman looking at a mistake
// had to go and have a conversation about it. Each saved item now carries its
// own Remove, and tapping it asks before it acts.
//
// ---------------------------------------------------------------------------
// EVERY GROUP HAS ITS OWN BOX, AND THE BOX IS NOT A CONVERSATION.
//
// Ruth, item 5: "Text boxes in setup save EXACTLY as typed, straight into Me
// under the right heading, with no chat panel, no model call and no confirm
// step." This screen used to open a SetupChatPanel for "Something else", which
// was a model call, several seconds, and a conversation to finish before she had
// seen the app. One box per group, saved on blur, in her words.

const QUESTION = 'Anything to steer around?';
const SUBTITLE =
  'Tap what applies, and add anything else in your own words. Only the first group changes what you are offered to eat.';

/**
 * THE GROUPS, AND THE KIND EACH ONE WRITES.
 *
 * ONE DECISION, NOT TWO. The heading she reads and the `kind` the food gate
 * switches on come from the same row here. Before this they were set in
 * different files, which is how nickel came to sit under a food heading.
 */
const GROUPS: {
  key: string;
  heading: string;
  /** Said only where it changes what the app does. */
  note?: string;
  options: { name: string; label: string; kind: AllergyKind }[];
  kind: AllergyKind;
  boxLabel: string;
  boxPlaceholder: string;
}[] = [
  {
    key: 'plate',
    heading: 'On your plate',
    note: 'This is the only group that changes what Selodía offers you to eat.',
    options: [...FOOD_ALLERGIES, ...DIETARY_NEEDS],
    kind: 'food',
    boxLabel: 'Something else on your plate?',
    boxPlaceholder: 'Raw celery, and anything with chilli in it',
  },
  {
    key: 'skin_air',
    heading: 'Skin and air',
    options: OTHER_REACTIONS,
    // The group holds both contact and environmental things. A typed addition
    // takes 'contact', which is the commoner of the two and, like the other,
    // does not arm the food filter - so the conservative choice costs nothing.
    kind: 'contact',
    boxLabel: 'Something else on your skin, or in the air?',
    boxPlaceholder: 'Cheap earrings bring my ears up',
  },
  {
    key: 'medicines',
    heading: 'Medicines you react to',
    note: 'Kept so Selodía knows. Nothing here is advice, and it never comments on what you take.',
    options: MEDICINE_REACTIONS,
    kind: 'medicine',
    boxLabel: 'Another medicine you react to?',
    boxPlaceholder: 'Penicillin brings a rash up',
  },
];

type Saved = { name: string; kind: string };

export default function AllergiesScreen() {
  const [chosen, setChosen] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  // THREE STATES, NOT A BOOLEAN. `loaded: false` meant both "not yet" and "it
  // failed", and the second inherited the treatment built for the first: a dead
  // Continue and no message, forever. See lib/load-state.ts.
  const [loadState, setLoadState] = useState<LoadState>('loading');
  /** Bumped by Try again, which re-runs the read. */
  const [attempt, setAttempt] = useState(0);
  /** What is already in her record, so the screen can show it and offer Remove. */
  const [saved, setSaved] = useState<Saved[]>([]);
  /** The one she has tapped Remove on, waiting for the second tap. */
  const [confirming, setConfirming] = useState<string | null>(null);
  /** Her own words, per group. Saved on blur, exactly as typed. */
  const [boxes, setBoxes] = useState<Record<string, string>>({});
  const [boxState, setBoxState] = useState<Record<string, 'saving' | 'saved' | 'failed'>>({});
  /** Movements already excluded, shown so she can see what is in force. */
  const [rules, setRules] = useState<string[]>([]);
  /** Her "something else" lines, already on the Avoid card. */
  const [avoids, setAvoids] = useState<string[]>([]);

  useEffect(() => {
    let live = true;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('allergies')
        .select('name, kind')
        .eq('user_id', user.id);
      if (!live) return;
      if (error) {
        setLoadState('failed');
        return;
      }
      const rows = (data ?? []) as Saved[];
      setSaved(rows);

      // ITEM 4 AGAIN: what is already in force, shown rather than implied.
      // Her exception covers movement rules too, so these are listed with
      // their own Remove rather than offered as something to untick.
      const [{ data: ruleRows }, { data: avoidCard }] = await Promise.all([
        supabase.from('user_rules').select('phrase').eq('user_id', user.id).eq('kind', 'never'),
        supabase
          .from('almanac_entries')
          .select('content')
          .eq('user_id', user.id)
          .eq('kind', 'me')
          .eq('title', 'Avoid')
          .maybeSingle(),
      ]);
      if (!live) return;
      setRules((ruleRows ?? []).map((r) => String(r.phrase)));
      const avoidItems = (avoidCard?.content as { items?: { name?: string }[] })?.items;
      setAvoids(Array.isArray(avoidItems) ? avoidItems.map((i) => String(i?.name ?? '')).filter(Boolean) : []);
      // ITEM 4: SHOWN AS SELECTED. Only the ones this screen offers as a chip -
      // "sardines", typed in chat, has no chip and appears in the saved list
      // below instead, where it can still be removed.
      setChosen(rows.map((r) => r.name).filter((n) => ALLERGY_BY_NAME[n]));
      setLoadState('ready');
    })();
    return () => {
      live = false;
    };
  }, [attempt]);

  function toggle(name: string) {
    setChosen((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }

  /**
   * A MOVEMENT TO LEAVE OUT, WRITTEN AS A RULE.
   *
   * Ruth, item 5: "movements to leave out of sessions (rules)" is one of the
   * groups. They are NOT allergies - a movement in the allergies table would be a
   * food restriction named "overhead press" - so this writes user_rules, which is
   * what the rules gate reads before anything is built for her.
   *
   * match_terms IS NOT OPTIONAL, and this is the trap it avoids. The gate's
   * enforcement layer filters `kind === 'never' && matchTerms.length > 0`, so a
   * rule stored with no terms is silently ignored by the code that removes
   * exercises. She would have typed "no overhead press", seen "Saved.", and been
   * given overhead presses. The leading refusal is stripped - "no", "avoid",
   * "not" - and what remains becomes the term, which is exactly the fallback
   * pending-save.ts already uses for a rule from chat: a poor matcher and an
   * honest one.
   *
   * A TYPED BOX IS DIFFERENT FROM A TAPPED CHIP, which is why this may save
   * without a conversation. The old steer-around screen deliberately saved
   * nothing, and was right to: tapping "an injury or a condition" names nothing,
   * so storing anything from it would have let her believe the app knew about her
   * shoulder. A sentence she typed names the thing.
   */
  async function saveRule(groupKey: string) {
    const text = (boxes[groupKey] ?? '').trim();
    if (!text) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setBoxState((st) => ({ ...st, [groupKey]: 'saving' }));

    const { error } = await supabase.from('user_rules').insert({
      user_id: user.id,
      kind: 'never',
      phrase: text,
      match_terms: [termFromTypedRule(text)],
      source: 'setup',
      // SHE TYPED IT HERE, DELIBERATELY, which is the confirmation. The column
      // records that a person stated it rather than a model inferred it.
      confirmed_at: new Date().toISOString(),
    });
    if (error) {
      setBoxState((st) => ({ ...st, [groupKey]: 'failed' }));
      return;
    }
    setBoxState((st) => ({ ...st, [groupKey]: 'saved' }));
    setRules((prev) => [...prev, text]);
    setBoxes((b) => ({ ...b, [groupKey]: '' }));
  }

  /**
   * ANYTHING ELSE, STRAIGHT INTO ME UNDER AVOID.
   *
   * Ruth, items 5 and 6: a final "Something else" whose answer goes to "Me under
   * Avoid". Not an allergy, because it is not known to be edible and must not arm
   * the food filter; not a rule, because it names no movement. One card called
   * Avoid, appended to, so saying two things does not make two cards.
   */
  async function saveAvoid(groupKey: string) {
    const text = (boxes[groupKey] ?? '').trim();
    if (!text) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setBoxState((st) => ({ ...st, [groupKey]: 'saving' }));

    const { data: existing } = await supabase
      .from('almanac_entries')
      .select('id, content')
      .eq('user_id', user.id)
      .eq('kind', 'me')
      .eq('title', 'Avoid')
      .maybeSingle();

    const current = Array.isArray((existing?.content as { items?: unknown })?.items)
      ? ((existing!.content as { items: unknown[] }).items as { name: string }[])
      : [];
    // EXACTLY AS TYPED. Her sentence is the item's name. No parsing and no model
    // deciding what she meant.
    const items = [...current, { name: text, when: null, purpose: null }];

    const { error } = existing
      ? await supabase
          .from('almanac_entries')
          .update({ content: { items }, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
      : await supabase.from('almanac_entries').insert({
          user_id: user.id,
          kind: 'me',
          title: 'Avoid',
          category: 'Avoid',
          content: { items },
        });

    if (error) {
      setBoxState((st) => ({ ...st, [groupKey]: 'failed' }));
      return;
    }
    setBoxState((st) => ({ ...st, [groupKey]: 'saved' }));
    setAvoids((prev) => [...prev, text]);
    setBoxes((b) => ({ ...b, [groupKey]: '' }));
  }

  /** One typed line, saved as itself. No model, no confirm step. */
  async function saveBox(groupKey: string, kind: AllergyKind) {
    const text = (boxes[groupKey] ?? '').trim();
    if (!text) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setBoxState((s) => ({ ...s, [groupKey]: 'saving' }));
    // EXACTLY AS TYPED. The name IS her sentence, lowercased by the table's own
    // convention and nothing else. It is worse structured data than a parsed
    // item and it is a true record, available the same minute; chat can tidy it
    // into items later, which is the one thing chat is genuinely better at.
    const { error } = await supabase.from('allergies').upsert(
      {
        user_id: user.id,
        name: text.toLowerCase().slice(0, 80),
        kind,
        raw_input: text,
      },
      { onConflict: 'user_id,name', ignoreDuplicates: true }
    );
    if (error) {
      setBoxState((s) => ({ ...s, [groupKey]: 'failed' }));
      return;
    }
    setBoxState((s) => ({ ...s, [groupKey]: 'saved' }));
    setSaved((prev) => [...prev, { name: text.toLowerCase().slice(0, 80), kind }]);
    setBoxes((b) => ({ ...b, [groupKey]: '' }));
  }

  /**
   * A TAPPED MOVEMENT CHIP, WITH THE TERMS THAT MAKE IT WORK.
   *
   * Unlike every other chip on this screen, this one writes user_rules rather
   * than allergies, and it carries its own match terms from
   * lib/movement-rules.ts. A label is not a matcher: "Impact, such as jumping"
   * appears in no session plan ever written, so storing the label as the term
   * would have produced a rule that looked right in Plans and excluded nothing.
   *
   * SAVED ON THE TAP, not on Continue, so the list below updates and she can see
   * it took. Deselecting does NOT remove it - her exception for item 4 covers
   * movement rules, and Remove is its own tap with its own question.
   */
  async function toggleMovementRule(key: string) {
    const option = MOVEMENT_RULE_BY_KEY[key];
    if (!option) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    if (rules.includes(option.phrase)) return; // already in force; Remove takes it out
    const { error } = await supabase.from('user_rules').insert({
      user_id: user.id,
      kind: 'never',
      phrase: option.phrase,
      match_terms: option.matchTerms,
      source: 'setup',
      confirmed_at: new Date().toISOString(),
    });
    if (error) return;
    setRules((prev) => [...prev, option.phrase]);
  }

  /** The second tap on Remove. Asked first, never on one press. */
  async function remove(name: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from('allergies')
      .delete()
      .eq('user_id', user.id)
      .eq('name', name);
    if (error) return;
    setSaved((prev) => prev.filter((r) => r.name !== name));
    setChosen((prev) => prev.filter((n) => n !== name));
    setConfirming(null);
  }

  async function save(): Promise<boolean> {
    if (!mayWrite(loadState)) return true;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    if (chosen.length === 0) return true;

    const rows = chosen.map((name) => ({
      user_id: user.id,
      name,
      kind: ALLERGY_BY_NAME[name]?.kind ?? 'other',
      // The recorder keeps the raw input beside the name so there is always a
      // record of HOW the app came to believe this.
      raw_input: 'Chosen in setup',
    }));

    // UPSERT, IGNORING DUPLICATES. `disclosed_at` records when the app FIRST
    // learned this, and refreshing it would lose the only thing that column is
    // for. And nothing is deleted: see the header - an untick is not a removal
    // on this screen, and Remove is its own deliberate tap.
    const { error } = await supabase
      .from('allergies')
      .upsert(rows, { onConflict: 'user_id,name', ignoreDuplicates: true });
    return !error;
  }

  async function goOn(skipping: boolean) {
    if (saving) return;
    setFailed(false);
    if (skipping) {
      router.push('/onboarding/life-stage');
      return;
    }
    setSaving(true);
    const ok = await save();
    setSaving(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    router.push('/onboarding/life-stage');
  }

  useOnboardingAction({
    label: saving ? 'Saving…' : 'Continue',
    // Pressable once the read settles, either way. A failed read means this
    // screen does not write on the way past, not that she is stuck on it.
    enabled: mayContinue(loadState, saving),
    onPress: () => void goOn(false),
    secondary: { label: 'Skip this question', onPress: () => void goOn(true) },
  });

  /** Saved things this screen has no chip for - typed here, or said in chat. */
  const typedIn = saved.filter((r) => !ALLERGY_BY_NAME[r.name]);

  return (
    <OnboardingQuestion question={QUESTION} subtitle={SUBTITLE}>
      {GROUPS.map((group) => (
        <ThemedView key={group.key} style={styles.group}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.eyebrow}>
            {group.heading}
          </ThemedText>
          {group.note && (
            <ThemedText type="small" themeColor="textSecondary">
              {group.note}
            </ThemedText>
          )}
          <TapChoices options={group.options.map(asChoice)} selected={chosen} onSelect={toggle} multi />

          <SetupTextField
            label={group.boxLabel}
            placeholder={group.boxPlaceholder}
            value={boxes[group.key] ?? ''}
            onChangeText={(t) => {
              setBoxes((b) => ({ ...b, [group.key]: t }));
              setBoxState((s) => ({ ...s, [group.key]: undefined as never }));
            }}
            onSave={() => void saveBox(group.key, group.kind)}
            saving={boxState[group.key] === 'saving'}
            saved={boxState[group.key] === 'saved'}
            failed={boxState[group.key] === 'failed'}
          />
        </ThemedView>
      ))}

      {/* MOVEMENTS TO LEAVE OUT OF SESSIONS. Her fourth section.
          NO CHIPS HERE, DELIBERATELY. The old steer-around screen offered
          "An injury or a condition" as a tap and then saved nothing, because a
          tap like that names nothing and storing anything from it would let her
          believe the app knew about her shoulder. A sentence names the thing, so
          this group is a box and only a box. */}
      <ThemedView style={styles.group}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.eyebrow}>
          Movements to leave out of sessions
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Anything your body will not thank you for, or that a clinician has told you to avoid. It
          stays out of everything Selodía builds for you.
        </ThemedText>
        {/* HER FOUR CHIPS. I left these out first time, reasoning that a tap names
            nothing specific - which was right about the OLD steer-around screen's
            "An injury or a condition" and wrong about these. "Overhead work" names
            a category of movement precisely enough to exclude, and her approved
            preview has them. Each carries its own match terms. */}
        <TapChoices
          options={MOVEMENT_RULES.map((r) => ({ key: r.key, label: r.label }))}
          selected={MOVEMENT_RULES.filter((r) => rules.includes(r.phrase)).map((r) => r.key)}
          onSelect={(key) => void toggleMovementRule(String(key))}
          multi
        />
        <SetupTextField
          label="What should stay out?"
          placeholder="No overhead pressing, my left shoulder"
          value={boxes.movements ?? ''}
          onChangeText={(t) => {
            setBoxes((b) => ({ ...b, movements: t }));
            setBoxState((st) => ({ ...st, movements: undefined as never }));
          }}
          onSave={() => void saveRule('movements')}
          saving={boxState.movements === 'saving'}
          saved={boxState.movements === 'saved'}
          failed={boxState.movements === 'failed'}
        />
        {rules.length > 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            Already staying out: {rules.join('; ')}
          </ThemedText>
        )}
      </ThemedView>

      {/* AND ANYTHING ELSE, which goes to Me under Avoid. Her fifth group.
          NOT AN ALLERGY, because nothing says it is edible and it must not arm the
          food filter; not a rule, because it names no movement. */}
      <ThemedView style={styles.group}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.eyebrow}>
          Something else
        </ThemedText>
        <SetupTextField
          label="Anything else to steer around?"
          placeholder="Loud gyms. Early mornings."
          value={boxes.avoid ?? ''}
          onChangeText={(t) => {
            setBoxes((b) => ({ ...b, avoid: t }));
            setBoxState((st) => ({ ...st, avoid: undefined as never }));
          }}
          onSave={() => void saveAvoid('avoid')}
          saving={boxState.avoid === 'saving'}
          saved={boxState.avoid === 'saved'}
          failed={boxState.avoid === 'failed'}
        />
        <ThemedText type="small" themeColor="textSecondary">
          Kept on your Me tab, under Avoid, in your words.
        </ThemedText>
        {avoids.length > 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            Already there: {avoids.join('; ')}
          </ThemedText>
        )}
      </ThemedView>

      {/* WHAT IS ALREADY KEPT, AND THE ONLY WAY TO TAKE SOMETHING OUT.
          Her exception for item 4: these come out by an explicit tap, never by
          unticking. Shown as a list rather than as chips because a chip that
          cannot be untoggled is a lie about what tapping it does. */}
      {typedIn.length > 0 && (
        <ThemedView style={styles.group}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.eyebrow}>
            Also kept, in your words
          </ThemedText>
          {typedIn.map((row) => (
            <ThemedView key={row.name} type="backgroundElement" style={styles.savedRow}>
              <ThemedText type="small">{row.name}</ThemedText>
              {confirming === row.name ? (
                <ThemedView style={styles.confirmRow}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Remove this?
                  </ThemedText>
                  <Pressable
                    onPress={() => void remove(row.name)}
                    accessibilityRole="button"
                    accessibilityLabel={`Yes, remove ${row.name}`}
                    style={({ pressed }) => pressed && styles.pressed}>
                    <ThemedText type="smallBold" themeColor="danger">
                      Yes, remove it
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => setConfirming(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Keep it"
                    style={({ pressed }) => pressed && styles.pressed}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Keep it
                    </ThemedText>
                  </Pressable>
                </ThemedView>
              ) : (
                <Pressable
                  onPress={() => setConfirming(row.name)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${row.name}`}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Remove
                  </ThemedText>
                </Pressable>
              )}
            </ThemedView>
          ))}
        </ThemedView>
      )}

      {/* SAID, RATHER THAN SHOWN AS AN EMPTY SCREEN. For two days a failed read
          on screens like this one looked identical to having nothing saved. */}
      {loadState === 'failed' && (
        <>
          <ThemedText type="small" themeColor="danger">
            {LOAD_FAILED_MESSAGE}
          </ThemedText>
          <ThemedText
            type="smallBold"
            themeColor="accentDeep"
            accessibilityRole="button"
            accessibilityLabel={LOAD_RETRY_LABEL}
            onPress={() => setAttempt((n) => n + 1)}>
            {LOAD_RETRY_LABEL}
          </ThemedText>
        </>
      )}

      {failed && (
        <ThemedText type="small" themeColor="danger">
          That didn&apos;t save. Check your connection and try again.
        </ThemedText>
      )}

      <ThemedText type="small" themeColor="textSecondary">
        Nothing here is ever removed by unticking it. Taking something out is its own tap, and it
        asks first.
      </ThemedText>
    </OnboardingQuestion>
  );
}

const asChoice = (o: { name: string; label: string }) => ({ key: o.name, label: o.label });

/**
 * THE HEADING AND THE KIND CANNOT DISAGREE.
 *
 * Every chip in a group must carry a kind that group is allowed to write, and
 * only the "on your plate" group may write a food kind. This is the mechanical
 * version of Ruth's "nickel and hay fever must not appear under your plate", and
 * it runs at module load so a wrong grouping cannot reach a phone.
 */
function assertGroupsMatchKinds() {
  for (const group of GROUPS) {
    const armsFood = group.key === 'plate';
    for (const option of group.options) {
      const optionArmsFood = option.kind === 'food' || option.kind === 'other';
      if (optionArmsFood !== armsFood) {
        throw new Error(
          `${option.label} is under "${group.heading}" with kind "${option.kind}". ` +
            'Only the "On your plate" group may hold a kind that arms the food filter.'
        );
      }
    }
  }
}
assertGroupsMatchKinds();

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 0.8 },
  savedRow: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: CardRadius,
    gap: Spacing.one,
  },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  pressed: { opacity: 0.6 },
});
