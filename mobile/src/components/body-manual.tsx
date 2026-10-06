import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ButtonRadius, CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  BODY_MANUAL_HEADING,
  BODY_MANUAL_NOTE,
  BODY_MANUAL_SECTIONS,
  type ManualLine,
  type Removal,
  type SectionContents,
} from '@/lib/body-manual';
import { lookbackLabel } from '@/lib/feel-goals';
import {
  ACTIVITY_CHOICES,
  activitySetLine,
  modeExplanation,
  modeFromRecord,
  modeLabel,
  type BodyMode,
} from '@/lib/body-mode';
import { OPEN_ROW_PARAM } from '@/lib/one-question';
import { Image } from 'expo-image';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

import { bodyLines } from '@/lib/body-manual-words';
import { markChatOpened } from '@/lib/finish-setup';
import { WELCOME_SEED } from '@/lib/welcome';
import { removeMeCardItem } from '@/lib/me-card-write';
import { supabase } from '@/lib/supabase';

// EVERY ANSWER SHE HAS GIVEN, ON ONE PAGE, LIVE.
//
// Ruth's design, 2 October 2026. The reasoning for why this replaces "redo my
// setup" rather than sitting beside it is in lib/body-manual.ts.
//
// COLLAPSED BY DEFAULT, HEADINGS ONLY. Her words: "all collapsible so the headings
// of each row are all that's seen so it's not a huge profile page." Twelve rows
// open at once is a page nobody scrolls.
//
// A SHUT ROW SAYS WHETHER THERE IS ANYTHING IN IT, which is the lesson from this
// afternoon: her Plans goals section was folded, showed a heading and nothing
// else, and she read it as empty. A fold that gives no sign of its contents is
// indistinguishable from an empty list. So a shut row carries a quiet count, and a
// row she has never answered says so on its face rather than waiting to be opened.
//
// ONE READ, NOT TWELVE ROUND TRIPS. Everything comes back in one Promise.all so a
// half-loaded page cannot show some rows as empty while others are still arriving -
// which would be the fold bug again, in a new costume.
//
// EDITING IS THE SETUP SCREEN, OPENED AT THAT QUESTION. The screens already exist,
// already write the right tables, and already show her current answers since this
// morning's pre-fill work. What changes is that she arrives at the one she chose
// rather than being walked through all seven.

type Loaded = Record<string, SectionContents>;

export function BodyManual({
  /**
   * Whether to draw its own section heading and note.
   *
   * False on its own page, where SettingsPage draws the display title and the
   * same note as the subtitle - see app/settings/body-manual.tsx. Two headings
   * saying the same thing in two sizes is what the move produced before this.
   */
  heading = true,
}: { heading?: boolean } = {}) {
  const theme = useTheme();
  // THE ROW SHE CAME BACK FROM, OPEN. See OPEN_ROW_PARAM: landing at the top of
  // a closed list of fourteen is not returning somebody to where they were, and
  // the open row is the only confirmation the save happened.
  const params = useLocalSearchParams<{ openRow?: string }>();
  const returningTo = Array.isArray(params.openRow) ? params.openRow[0] : params.openRow;
  const [open, setOpen] = useState<Record<string, boolean>>(
    returningTo ? { [returningTo]: true } : {}
  );
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [deficit, setDeficit] = useState<'on' | 'paused' | null>(null);
  const [deficitSetAt, setDeficitSetAt] = useState<string | null>(null);
  const [hasDeficit, setHasDeficit] = useState(false);
  const [mode, setMode] = useState<BodyMode | null>(null);
  const [activityLevel, setActivityLevel] = useState<string | null>(null);
  const [activitySetAt, setActivitySetAt] = useState<string | null>(null);
  const [wantsFatLoss, setWantsFatLoss] = useState(false);
  const [savingTraining, setSavingTraining] = useState(false);

  /**
   * TWO JOBS, SPLIT, because doing both in one hook did not work on her phone.
   *
   * On 5 October a live figure would not refresh after a toggle. The first
   * attempt put the dependency on the useCallback inside useFocusEffect, which
   * is the obvious shape and did nothing on her device. What worked is this:
   * FOCUS BUMPS A KEY, and a plain useEffect watching that key does the read.
   *
   * It is also what makes a removal visible. Taking a line off has to re-read -
   * splicing it out of state would show a removal that may not have happened,
   * and on a list of allergies that is the worst failure available - and
   * useFocusEffect cannot be asked to run again without leaving the screen.
   */
  /**
   * THE SEED THAT LEADS INTO CHAT, after the welcome and until she has used it.
   *
   * HER CORRECTION, 5 October 2026. I proposed a pulsing seed inside the Chat
   * tab; the bottom bar is a real native tab bar, which is what fixed the "Wee"
   * label, and a native tab item cannot hold an animation. Hers was better:
   *
   *   "I meant that the seed would be a button on top of the Body Manual to
   *   avoid pressing back twice to enter the app."
   *
   * AND SHE HAD DIAGNOSED THE REASON EXACTLY. This screen lives inside Settings,
   * which is presented over the tabs, so the tabs are not underneath it when
   * setup hands her here: leaving takes one press out of the Manual and another
   * out of Settings. The seed is the way in, in one tap.
   *
   * IT DISAPPEARS THE MOMENT IT IS USED. chat_first_opened_at is stamped on the
   * tap, and a pointer to somewhere she has already been is clutter.
   */
  const [showSeed, setShowSeed] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [pulse] = useState(() => new Animated.Value(0));

  const [reloadKey, setReloadKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setReloadKey((n) => n + 1);
    }, [])
  );

  useEffect(() => {
    {
      let cancelled = false;
      void (async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const [
          feel,
          lookback,
          goals,
          weight,
          skills,
          week,
          allergies,
          rules,
          profile,
          meCards,
        ] = await Promise.all([
          // `id` NOW, because a line she can take off needs one. The row was
          // read for its label alone, which is why nothing on this row could
          // ever be removed.
          supabase.from('feel_goals').select('id, label, source, started_at').is('archived_at', null).order('sort_order'),
          supabase.from('feel_lookbacks').select('answer, created_at').order('created_at', { ascending: false }).limit(1),
          supabase.from('user_goals').select('label, detail, set_on').is('archived_at', null).order('set_on', { ascending: false }),
          supabase.from('current_weight').select('weight_kg, weight_source, as_of').maybeSingle(),
          supabase.from('user_skills').select('id, name, ladder_key').order('sort_order'),
          supabase.from('user_week').select('id, activity, cadence, days, time_of_day').order('sort_order'),
          supabase.from('allergies').select('id, name, kind').order('disclosed_at'),
          supabase.from('user_rules').select('id, phrase, kind').eq('kind', 'never'),
          supabase.from('user_profile').select('life_stage, life_stage_detail, hormone_use, deficit_state, deficit_state_set_at, fat_focus_state, muscle_focus_state, body_mode, activity_level, activity_level_set_at, welcome_seen_at, chat_first_opened_at, height_cm').maybeSingle(),
          // `id` NOW, for the same reason: removing one item out of a card
          // means reading that card by id and writing it back.
          supabase.from('almanac_entries').select('id, title, content').eq('kind', 'me').in('title', ['Avoid', 'Medications']),
        ]);
        if (cancelled) return;

        // ANY READ FAILING IS SAID OUT LOUD. A blank page with no message is what
        // made two days of work look broken.
        const anyError = [feel, goals, skills, week, allergies, rules].some((r) => r.error);
        if (anyError) {
          setFailed(true);
          return;
        }

        /**
         * THE ITEMS ON A ME CARD, each as a line that knows how to come off.
         *
         * This returned bare strings, which is why "what you'd rather avoid" and
         * "what you take regularly" could be read and never changed: there was
         * nothing on the line to act on. Now each carries the card's id and its
         * own name, which is what removeMeCardItem needs.
         */
        const itemLines = (title: string): ManualLine[] => {
          const card = (meCards.data ?? []).find((c) => c.title === title);
          if (!card) return [];
          const items = (card.content as { items?: { name?: string }[] } | null)?.items;
          if (!Array.isArray(items)) return [];
          return items
            .map((i) => String(i?.name ?? ''))
            .filter(Boolean)
            .map((name) => ({
              text: name,
              removal: { kind: 'me-item', cardId: String(card.id), name } as Removal,
            }));
        };
        const byKind = (kinds: string[]) =>
          (allergies.data ?? []).filter((a) => kinds.includes(String(a.kind)));
        /**
         * ROWS AS LINES, each with the delete that belongs to it.
         *
         * THE LABEL AND THE REMOVAL ARE ONE THING NOW. This built a second list
         * beside `lines`, and nothing compared the two - so a line could be shown
         * with no way out, or an item could carry a delete and never be drawn.
         * Both happened: the component rendered `lines` and never looked at
         * `removable` at all.
         */
        const rowLines = (
          rows: { id: unknown; name?: unknown; phrase?: unknown; activity?: unknown }[],
          table: 'allergies' | 'user_rules' | 'user_week' | 'user_skills',
          text?: (r: Record<string, unknown>) => string
        ): ManualLine[] =>
          rows.map((r) => ({
            text: text
              ? text(r as Record<string, unknown>)
              : String(r.name ?? r.phrase ?? r.activity ?? ''),
            removal: { kind: 'row', table, id: String(r.id) } as Removal,
          }));

        const last = (lookback.data ?? [])[0];
        const w = weight.data as { weight_kg?: unknown; weight_source?: unknown; as_of?: unknown } | null;
        const p = profile.data as {
          life_stage?: string | null;
          life_stage_detail?: string | null;
          hormone_use?: unknown;
          deficit_state?: string | null;
          deficit_state_set_at?: string | null;
          activity_level?: string | null;
          activity_level_set_at?: string | null;
          fat_focus_state?: string | null;
          muscle_focus_state?: string | null;
        } | null;
        // HAS SHE OPENED CHAT YET? The seed is for somebody who has just
        // finished setup and has a message waiting that she does not know about.
        setShowSeed(
          Boolean((p as { welcome_seen_at?: string | null } | null)?.welcome_seen_at) &&
            !(p as { chat_first_opened_at?: string | null } | null)?.chat_first_opened_at
        );
        setDeficit((p?.deficit_state as 'on' | 'paused') ?? null);
        setMode(modeFromRecord((p as { body_mode?: unknown } | null)?.body_mode));
        setActivityLevel((p?.activity_level as string) ?? null);
        setActivitySetAt((p?.activity_level_set_at as string) ?? null);
        // WHETHER THERE IS A DEFICIT TO PAUSE AT ALL. Fat down without muscle up
        // is the only combination that produces one - recomposition eats around
        // maintenance, and the other two are maintenance or a surplus.
        // TWO DIFFERENT QUESTIONS, and conflating them is what hid the row.
        //   wantsFatLoss - she has asked to lose fat at all
        //   hasDeficit   - the arithmetic actually produces one
        // Fat down WITH muscle up is the case where those two differ: it is a
        // fat-loss goal that eats at maintenance.
        setWantsFatLoss(p?.fat_focus_state === 'reduce');
        setHasDeficit(
          p?.fat_focus_state === 'reduce' && p?.muscle_focus_state !== 'increase'
        );
        setDeficitSetAt((p?.deficit_state_set_at as string) ?? null);

        setData({
          days: {
            lines: [
              // ARCHIVED, NOT DELETED. A feel goal carries started_at and its
              // look-backs are a record of what she was working towards; this row
              // and Plans both read "not archived", so archiving takes it out of
              // every current view and keeps the history. Deleting it would throw
              // away the only thing the look-backs are about.
              ...(feel.data ?? [])
                .filter((r) => r.source === 'chip')
                .map((r) => ({
                  text: String(r.label),
                  removal: { kind: 'archive', table: 'feel_goals', id: String(r.id) } as Removal,
                })),
              ...(feel.data ?? [])
                .filter((r) => r.source === 'her words')
                .map((r) => ({
                  text: `"${String(r.label)}"`,
                  removal: { kind: 'archive', table: 'feel_goals', id: String(r.id) } as Removal,
                })),
              // NOT REMOVABLE, because it is not a thing she said she wanted - it
              // is what she answered when the app asked how it was going.
              ...(last
                ? [{ text: `Last look back: ${lookbackLabel(String(last.answer))?.toLowerCase() ?? ''}` }]
                : []),
            ],
          },
          goal: {
            // SET ON TODAY, so no line carries a removal. One control, one record.
            lines: (goals.data ?? []).map((g) => ({
              text: [String(g.label), g.detail ? String(g.detail) : null].filter(Boolean).join(' · '),
            })),
          },
          height: {
            // ONE LINE, AND NO REMOVAL. The way to change a height is to answer
            // it again on the screen that asks it, which is what "Change this"
            // opens.
            lines:
              typeof (p as { height_cm?: unknown } | null)?.height_cm === 'number'
                ? [{ text: `${(p as { height_cm: number }).height_cm} cm` }]
                : [],
          },
          weight: {
            // IT MAINTAINS ITSELF. The latest real weigh-in beats any estimate,
            // so there is nothing here to take off.
            lines:
              w?.weight_kg != null
                ? [
                    {
                      text: `${w.weight_kg} kg, ${
                        w.weight_source === 'estimate' ? 'as you said' : 'from your last weigh-in'
                      }${w.as_of ? ` on ${new Date(String(w.as_of)).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}`,
                    },
                  ]
                : [],
          },
          skills: { lines: rowLines(skills.data ?? [], 'user_skills') },
          week: {
            lines: rowLines(week.data ?? [], 'user_week', (r) =>
              [
                String(r.activity),
                r.cadence ? String(r.cadence) : null,
                Array.isArray(r.days) && (r.days as string[]).length > 0
                  ? (r.days as string[]).join(', ')
                  : null,
                r.time_of_day ? String(r.time_of_day) : null,
              ]
                .filter(Boolean)
                .join(' · ')
            ),
          },
          plate: { lines: rowLines(byKind(['food', 'other']), 'allergies') },
          skin_air: { lines: rowLines(byKind(['contact', 'environmental']), 'allergies') },
          medicines: { lines: rowLines(byKind(['medicine']), 'allergies') },
          movements: { lines: rowLines(rules.data ?? [], 'user_rules') },
          avoid: { lines: itemLines('Avoid') },
          body: {
            // HER WORDS FOR HER OWN ANSWERS. This rendered the stored value with
            // its underscores swapped for spaces, so the Manual read "Periods: no
            // periods other" - a column name with a haircut, on the row most
            // likely to be read a year later. lib/body-manual-words.ts takes the
            // labels off the chips she tapped.
            //
            // NO REMOVAL PER LINE: these are three columns on her profile, and the
            // way to change an answer is to answer it again. "Change this" opens
            // the question.
            lines: bodyLines(p ?? {}).map((l) => ({ text: `${l.label}: ${l.value}` })),
          },
          takes: { lines: itemLines('Medications') },
        });
      })();
      return () => {
        cancelled = true;
      };
    }
  }, [reloadKey]);



  /**
   * WHICH LINE IS ASKING, and nothing is removed until it asks twice.
   *
   * Ruth's own exception, 2 October: allergies, medicines and movement rules come
   * out only by an explicit "Remove this?" tap. It applies to every row here, not
   * only those three - a line disappearing because somebody's thumb landed on it
   * is the same loss whichever table it was in.
   */
  const [confirming, setConfirming] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  /**
   * A LINE WITH NO WAY OFF IT.
   *
   * The three rows computed here rather than read - her approach, how active she
   * is, and the deficit - are all set somewhere else, so none of their lines
   * carries a removal. This says that in one place instead of three.
   */
  const plain = (texts: string[]): ManualLine[] => texts.map((text) => ({ text }));

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (alive) setReduceMotion(on);
      })
      // No answer is not a reason to animate at somebody.
      .catch(() => {
        if (alive) setReduceMotion(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!showSeed || reduceMotion) {
      pulse.setValue(0);
      return;
    }
    // A FEW TIMES, THEN STOP. Her words: "It pulses a few times, then stops."
    // Something that breathes for ever on a settings screen stops being a
    // pointer and becomes a thing to put up with.
    const breath = Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]);
    const run = Animated.loop(breath, { iterations: 3 });
    run.start();
    return () => run.stop();
  }, [showSeed, reduceMotion, pulse]);

  /** One tap into Chat, and the seed has done its job. */
  async function openChat() {
    setShowSeed(false);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) await markChatOpened(user.id);
    // '/' IS THE CHAT TAB. Written out because this project has got it wrong in
    // the other direction twice: '/' is Chat, '/today' is Today.
    router.replace('/' as never);
  }

  /** A stable name for a line, so the confirm state knows which one it is on. */
  const lineKey = (sectionKey: string, n: number) => `${sectionKey}:${n}`;

  /**
   * TAKE ONE LINE OFF, BY THE MECHANISM THAT LINE CARRIES.
   *
   * THREE MECHANISMS AND THE TYPE NAMES THEM. A delete for a row that is only
   * itself; an archive for a feel goal, whose look-backs are a record of what she
   * was working towards and would be orphaned by a delete; and a read-then-filter
   * for one item inside a Me card's JSON.
   *
   * THE READ IS REDONE AFTERWARDS rather than the line being spliced out of
   * state. A list that updates itself optimistically shows a removal that may not
   * have happened, which on a list of allergies is the worst available failure.
   */
  async function removeLine(removal: Removal) {
    if (removing) return;
    setRemoving(true);
    let ok = false;
    if (removal.kind === 'row') {
      const { error } = await supabase.from(removal.table).delete().eq('id', removal.id);
      ok = !error;
      if (error) console.log('BODY MANUAL REMOVE FAILED:', error.message);
    } else if (removal.kind === 'archive') {
      const { error } = await supabase
        .from(removal.table)
        .update({ archived_at: new Date().toISOString() })
        .eq('id', removal.id);
      ok = !error;
      if (error) console.log('BODY MANUAL ARCHIVE FAILED:', error.message);
    } else {
      ok = await removeMeCardItem(removal.cardId, removal.name);
    }
    setRemoving(false);
    setConfirming(null);
    // A FAILED REMOVAL LEAVES THE LINE THERE, which is the honest outcome: the
    // row is still in the database and the screen still shows it.
    if (ok) setReloadKey((n) => n + 1);
  }

  /** The same one-tap write as the training row, for the deficit. */
  async function sayDeficit(next: 'on' | 'paused') {
    if (savingTraining) return;
    const previous = deficit;
    const previousAt = deficitSetAt;
    const value = previous === next ? null : next;
    const stamp = value == null ? null : new Date().toISOString();
    setDeficit(value);
    setDeficitSetAt(stamp);
    setSavingTraining(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setDeficit(previous);
      setDeficitSetAt(previousAt);
      setSavingTraining(false);
      return;
    }
    const { error } = await supabase
      .from('user_profile')
      .update({ deficit_state: value, deficit_state_set_at: stamp })
      .eq('user_id', user.id);
    setSavingTraining(false);
    if (error) {
      setDeficit(previous);
      setDeficitSetAt(previousAt);
    }
  }

  function deficitLines(): string[] {
    // A FAT-LOSS GOAL THAT EATS AT MAINTENANCE SAYS SO. This is the "Lose fat"
    // plus "Less fat, more muscle" case: both are fat-loss answers, together
    // they mean recomposition, and recomposition has no deficit in it. Saying
    // that here is the whole repair - she went looking for a pause and found an
    // absence.
    if (!hasDeficit) {
      return [
        'You are on less fat with more muscle, so there is no deficit to pause.',
        'That eats around what you use rather than under it. The change comes from protein and training, not from eating less.',
        'Change your approach on Today if you would rather lose fat with a deficit.',
      ];
    }
    // NULL READS AS RUNNING, because a deficit is what choosing to lose fat
    // already asked for. Only an explicit pause is news.
    if (deficit !== 'paused') return ['Running, as your approach asks.'];
    return [
      'Paused, so your calories are held at what you use.',
      'Your approach has not changed and nothing was lost.',
      ...(deficitSetAt
        ? [`Paused on ${new Date(deficitSetAt).toLocaleDateString('en-GB')}.`]
        : []),
    ];
  }

  /**
   * What she has said about her usual week, and when she said it.
   *
   * EMPTY WHEN IT HAS NEVER BEEN STATED, which is not the same as sedentary.
   * Until 4 October the level was derived from the cadence chips on every visit to
   * the activities screen, and the derivation returns 'sedentary' for no input -
   * so a row carrying 'sedentary' with no date is not an answer, it is what the
   * overwrite left behind. Those read as "not set yet", which is the honest one.
   */
  function activityLines(): string[] {
    if (!activityLevel || !activitySetAt) return [];
    const choice = ACTIVITY_CHOICES.find((c) => c.key === activityLevel);
    return [choice?.description ?? activityLevel, activitySetLine(activitySetAt)];
  }

  /** Where a row is edited. The setup screen that owns that question. */
  function editRoute(key: string): string | null {
    switch (key) {
      // NOT AN ONBOARDING SCREEN. Every other row maps to the setup screen that
      // owns its question; the activity level is asked on its own settings screen,
      // because it is a stated answer with a date rather than a step of setup.
      case 'activity':
        return '/settings/activity-level';
      case 'days':
        return '/onboarding/days';
      // ASKED ON STEP 2, beside weight, because the panel there uses both and
      // shows what they come to.
      case 'height':
        return '/onboarding/goals';
      // The goal is set on Today now - see the `toToday` flag on the section.
      case 'goal':
        return null;
      case 'skills':
        return '/onboarding/skill';
      case 'week':
        return '/onboarding/activities';
      case 'plate':
      case 'skin_air':
      case 'medicines':
      case 'movements':
      case 'avoid':
        return '/onboarding/allergies';
      case 'body':
      case 'takes':
        return '/onboarding/life-stage';
      default:
        return null;
    }
  }

  if (failed) {
    return (
      <View style={styles.group}>
        {heading && (
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.groupTitle}>
            {BODY_MANUAL_HEADING}
          </ThemedText>
        )}
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="small" themeColor="danger">
            Your answers could not be loaded just now. Nothing has changed, and they are still
            there. Open this page again in a moment.
          </ThemedText>
        </ThemedView>
      </View>
    );
  }

  if (!data) return null;

  const seedScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <View style={styles.group}>
      {/* THE SEED, AND IT IS A BUTTON RATHER THAN AN ORNAMENT. Her design, and her
          diagnosis: this screen sits inside Settings, which is presented over the
          tabs, so arriving here from setup means two back presses to reach the
          app. This is one tap, and it goes the moment it is used.

          IT IS NEVER THE ONLY CUE. The label and the line underneath say where it
          goes in words, so reduce motion loses the breathing and nothing else. */}
      {showSeed && (
        <Pressable
          onPress={() => void openChat()}
          accessibilityRole="button"
          accessibilityLabel={`${WELCOME_SEED.label}. ${WELCOME_SEED.hint}`}
          style={({ pressed }) => [styles.seedRow, pressed && styles.pressed]}>
          <Animated.View style={{ transform: [{ scale: reduceMotion ? 1 : seedScale }] }}>
            <Image
              source={require('../../assets/images/mark.png')}
              style={styles.seedMark}
              contentFit="contain"
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          </Animated.View>
          <View style={styles.seedWords}>
            <ThemedText type="smallBold" themeColor="accentDeep">
              {WELCOME_SEED.label}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {WELCOME_SEED.hint}
            </ThemedText>
          </View>
        </Pressable>
      )}

      {/* THE HEADING IS THE PAGE'S NOW, NOT THE SECTION'S (Ruth, 5 October 2026:
          "Needs title font in the agreed large format and font as Plans etc.").

          This was written as a SECTION at the bottom of the profile screen, so it
          wore a section's heading - small, bold, uppercase, in the secondary
          colour. Moving it to its own page left that heading at the top of a
          screen, where every other page in the app carries the serif display
          title. It read as a fragment of something rather than a place. */}
      {heading && (
        <>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.groupTitle}>
            {BODY_MANUAL_HEADING}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            {BODY_MANUAL_NOTE}
          </ThemedText>
        </>
      )}

      <ThemedView type="backgroundElement" style={styles.card}>
        {BODY_MANUAL_SECTIONS.filter((s) => !s.onlyWhenFatLoss || wantsFatLoss).map((section, i) => {
          const contents =
            section.key === 'goal'
                ? { lines: plain(mode ? [modeLabel(mode), modeExplanation(mode)] : []) }
                : section.key === 'activity'
                  ? { lines: plain(activityLines()) }
                : section.key === 'deficit'
                  ? { lines: plain(deficitLines()) }
                : (data[section.key] ?? { lines: [] });
          const has = contents.lines.length > 0;
          const isOpen = open[section.key] === true;
          const route = editRoute(section.key);

          return (
            <View
              key={section.key}
              style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: theme.background }]}>
              <Pressable
                onPress={() => setOpen((o) => ({ ...o, [section.key]: !o[section.key] }))}
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                accessibilityLabel={section.heading}
                accessibilityHint={isOpen ? 'Hides this' : 'Shows what you have said'}
                hitSlop={Spacing.two}
                style={({ pressed }) => [styles.headingRow, pressed && styles.pressed]}>
                <Ionicons
                  name={isOpen ? 'chevron-down' : 'chevron-forward'}
                  size={14}
                  color={theme.textSecondary}
                />
                <ThemedText type="small" style={styles.heading}>
                  {section.heading}
                </ThemedText>
                {/* A SHUT ROW SAYS WHETHER THERE IS ANYTHING IN IT. Her Plans goals
                    section was folded this afternoon and read as empty, because a
                    fold with no sign of its contents is indistinguishable from an
                    empty list. */}
                <ThemedText type="small" themeColor="textSecondary">
                  {has ? String(contents.lines.length) : 'none yet'}
                </ThemedText>
              </Pressable>

              {isOpen && (
                <View style={styles.body}>
                  {has ? (
                    contents.lines.map((line: ManualLine, n: number) => {
                      const key = lineKey(section.key, n);
                      const asking = confirming === key;
                      return (
                        <View key={key} style={styles.line}>
                          <ThemedText type="small" style={styles.lineText}>
                            {line.text}
                          </ThemedText>
                          {/* A LINE THAT CAN COME OFF SAYS SO, and asks first.
                              Lines with no removal - her approach, her weight,
                              what she answered about periods - simply have no
                              control, because the way to change those is to
                              answer them again. */}
                          {line.removal && !asking && (
                            <Pressable
                              onPress={() => setConfirming(key)}
                              accessibilityRole="button"
                              accessibilityLabel={`Remove ${line.text}`}
                              hitSlop={Spacing.two}
                              style={({ pressed }) => pressed && styles.pressed}>
                              <ThemedText type="small" themeColor="textSecondary">
                                Remove
                              </ThemedText>
                            </Pressable>
                          )}
                          {line.removal && asking && (
                            <View style={styles.confirmRow}>
                              <Pressable
                                onPress={() => void removeLine(line.removal as Removal)}
                                disabled={removing}
                                accessibilityRole="button"
                                accessibilityLabel={`Yes, remove ${line.text}`}
                                hitSlop={Spacing.two}
                                style={({ pressed }) => pressed && styles.pressed}>
                                <ThemedText type="smallBold" themeColor="danger">
                                  {removing ? 'Removing...' : 'Yes, remove it'}
                                </ThemedText>
                              </Pressable>
                              <Pressable
                                onPress={() => setConfirming(null)}
                                accessibilityRole="button"
                                accessibilityLabel="Keep it"
                                hitSlop={Spacing.two}
                                style={({ pressed }) => pressed && styles.pressed}>
                                <ThemedText type="small" themeColor="textSecondary">
                                  Keep it
                                </ThemedText>
                              </Pressable>
                            </View>
                          )}
                        </View>
                      );
                    })
                  ) : (
                    <ThemedText type="small" themeColor="textSecondary">
                      {section.empty}
                    </ThemedText>
                  )}

                  <ThemedText type="small" themeColor="textSecondary">
                    {section.note}
                  </ThemedText>

                  {/* ANSWERED ON THE ROW. One field, two states, no screen to
                      open - which is the shape the Manual replaced the redo
                      wizard with. */}
                  {section.inline && section.key === 'deficit' && hasDeficit && (
                    <View style={styles.chips}>
                      {(
                        [
                          ['on', 'Keep it running'],
                          ['paused', 'Pause it for now'],
                        ] as const
                      ).map(([value, label]) => {
                        const on = deficit === value;
                        return (
                          <Pressable
                            key={value}
                            onPress={() => void sayDeficit(value)}
                            disabled={savingTraining}
                            accessibilityRole="button"
                            accessibilityState={{ selected: on, disabled: savingTraining }}
                            accessibilityLabel={label}
                            style={({ pressed }) => [
                              styles.chip,
                              {
                                backgroundColor: on ? theme.accentDeep : theme.background,
                                borderColor: on ? theme.accentDeep : theme.textSecondary,
                              },
                              pressed && styles.pressed,
                            ]}>
                            <ThemedText
                              type="small"
                              style={{ color: on ? theme.background : theme.text }}>
                              {label}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}


                  {/* WEIGHT HAS NO EDIT, because it maintains itself: the latest
                      real weigh-in beats any estimate, whatever the dates say. A
                      button here would imply otherwise. */}
                  {/* SET ON TODAY. A link rather than an editor, so there is
                      one control for one value. */}
                  {section.toToday && (
                    <Pressable
                      // '/today', NOT '/'. The root route is the CHAT tab -
                      // goals.tsx says so in its own comment, and I wrote this
                      // link anyway, so "Set this on Today" would have landed her
                      // in Chat with no switches in sight and nothing explaining
                      // why. The tab lives at (tabs)/today.
                      onPress={() => router.replace('/today' as never)}
                      accessibilityRole="link"
                      accessibilityLabel="Set this on Today"
                      hitSlop={Spacing.two}
                      style={({ pressed }) => pressed && styles.pressed}>
                      <ThemedText type="smallBold" themeColor="accentDeep">
                        Set this on Today
                      </ThemedText>
                    </Pressable>
                  )}

                  {!section.readOnly && !section.inline && !section.toToday && route && (
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: route as never,
                          params: { redo: '1', [OPEN_ROW_PARAM]: section.key },
                        })
                      }
                      accessibilityRole="link"
                      accessibilityLabel={`${has ? 'Change' : 'Add'} ${section.heading.toLowerCase()}`}
                      hitSlop={Spacing.two}
                      style={({ pressed }) => pressed && styles.pressed}>
                      <ThemedText type="smallBold" themeColor="accentDeep">
                        {has ? 'Change this' : 'Add this'}
                      </ThemedText>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
  groupTitle: { textTransform: 'uppercase', letterSpacing: 0.8 },
  note: { paddingBottom: Spacing.one },
  card: { borderRadius: CardRadius, overflow: 'hidden' },
  row: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  heading: { flexGrow: 1 },
  body: { gap: Spacing.two, paddingTop: Spacing.three, paddingLeft: Spacing.four },
  chips: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap', paddingTop: Spacing.one },
  // A LINE AND ITS CONTROL ON ONE ROW. The text takes what is left, so a long
  // activity name wraps instead of pushing Remove off the screen.
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  lineText: { flexGrow: 1, flexShrink: 1 },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  seedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  seedMark: { width: 36, height: 36 },
  seedWords: { flexShrink: 1 },
  // ButtonRadius (999) ON A SHORT CHIP IS A PILL AND THAT IS CORRECT HERE. It was
  // 999 on a TALL card that gave Ruth "some strange blobs" this afternoon; the
  // radius was never the fault, the height of what it was on was.
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: ButtonRadius,
    borderWidth: 1,
  },
  pressed: { opacity: 0.6 },
});
