import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ButtonRadius, CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  BODY_MANUAL_HEADING,
  BODY_MANUAL_NOTE,
  BODY_MANUAL_SECTIONS,
  type SectionContents,
} from '@/lib/body-manual';
import { lookbackLabel } from '@/lib/feel-goals';
import { modeExplanation, modeFromRecord, modeLabel, type BodyMode } from '@/lib/body-mode';
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

export function BodyManual() {
  const theme = useTheme();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [training, setTraining] = useState<'training' | 'paused' | null>(null);
  const [trainingSetAt, setTrainingSetAt] = useState<string | null>(null);
  const [deficit, setDeficit] = useState<'on' | 'paused' | null>(null);
  const [deficitSetAt, setDeficitSetAt] = useState<string | null>(null);
  const [hasDeficit, setHasDeficit] = useState(false);
  const [mode, setMode] = useState<BodyMode | null>(null);
  const [wantsFatLoss, setWantsFatLoss] = useState(false);
  const [savingTraining, setSavingTraining] = useState(false);

  useFocusEffect(
    useCallback(() => {
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
          supabase.from('feel_goals').select('label, source, started_at').is('archived_at', null).order('sort_order'),
          supabase.from('feel_lookbacks').select('answer, created_at').order('created_at', { ascending: false }).limit(1),
          supabase.from('user_goals').select('label, detail, set_on').is('archived_at', null).order('set_on', { ascending: false }),
          supabase.from('current_weight').select('weight_kg, weight_source, as_of').maybeSingle(),
          supabase.from('user_skills').select('id, name, ladder_key').order('sort_order'),
          supabase.from('user_week').select('id, activity, cadence, days, time_of_day').order('sort_order'),
          supabase.from('allergies').select('id, name, kind').order('disclosed_at'),
          supabase.from('user_rules').select('id, phrase, kind').eq('kind', 'never'),
          supabase.from('user_profile').select('life_stage, life_stage_detail, hormone_use, training_state, training_state_set_at, deficit_state, deficit_state_set_at, fat_focus_state, muscle_focus_state, body_mode').maybeSingle(),
          supabase.from('almanac_entries').select('title, content').eq('kind', 'me').in('title', ['Avoid', 'Medications']),
        ]);
        if (cancelled) return;

        // ANY READ FAILING IS SAID OUT LOUD. A blank page with no message is what
        // made two days of work look broken.
        const anyError = [feel, goals, skills, week, allergies, rules].some((r) => r.error);
        if (anyError) {
          setFailed(true);
          return;
        }

        const itemsOf = (title: string): string[] => {
          const card = (meCards.data ?? []).find((c) => c.title === title);
          const items = (card?.content as { items?: { name?: string }[] })?.items;
          return Array.isArray(items) ? items.map((i) => String(i?.name ?? '')).filter(Boolean) : [];
        };
        const byKind = (kinds: string[]) =>
          (allergies.data ?? []).filter((a) => kinds.includes(String(a.kind)));
        const asRemovable = (
          rows: { id: unknown; name?: unknown; phrase?: unknown; activity?: unknown }[],
          table: 'allergies' | 'user_rules' | 'user_week' | 'user_skills'
        ) =>
          rows.map((r) => ({
            label: String(r.name ?? r.phrase ?? r.activity ?? ''),
            table,
            id: String(r.id),
          }));

        const last = (lookback.data ?? [])[0];
        const w = weight.data as { weight_kg?: unknown; weight_source?: unknown; as_of?: unknown } | null;
        const p = profile.data as {
          life_stage?: string | null;
          life_stage_detail?: string | null;
          hormone_use?: unknown;
          training_state?: string | null;
          training_state_set_at?: string | null;
          deficit_state?: string | null;
          deficit_state_set_at?: string | null;
          fat_focus_state?: string | null;
          muscle_focus_state?: string | null;
        } | null;
        setTraining((p?.training_state as 'training' | 'paused') ?? null);
        setDeficit((p?.deficit_state as 'on' | 'paused') ?? null);
        setMode(modeFromRecord((p as { body_mode?: unknown } | null)?.body_mode));
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
        setTrainingSetAt((p?.training_state_set_at as string) ?? null);
        setDeficitSetAt((p?.deficit_state_set_at as string) ?? null);

        setData({
          days: {
            lines: [
              ...(feel.data ?? []).filter((r) => r.source === 'chip').map((r) => String(r.label)),
              ...(feel.data ?? []).filter((r) => r.source === 'her words').map((r) => `"${String(r.label)}"`),
              ...(last ? [`Last look back: ${lookbackLabel(String(last.answer))?.toLowerCase() ?? ''}`] : []),
            ],
          },
          goal: {
            lines: (goals.data ?? []).map((g) =>
              [String(g.label), g.detail ? String(g.detail) : null].filter(Boolean).join(' · ')
            ),
          },
          weight: {
            lines:
              w?.weight_kg != null
                ? [
                    `${w.weight_kg} kg, ${
                      w.weight_source === 'estimate' ? 'as you said' : 'from your last weigh-in'
                    }${w.as_of ? ` on ${new Date(String(w.as_of)).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}`,
                  ]
                : [],
          },
          skills: {
            lines: (skills.data ?? []).map((s) => String(s.name)),
            removable: asRemovable(skills.data ?? [], 'user_skills'),
          },
          week: {
            lines: (week.data ?? []).map((r) =>
              [
                String(r.activity),
                r.cadence ? String(r.cadence) : null,
                Array.isArray(r.days) && r.days.length > 0 ? (r.days as string[]).join(', ') : null,
                r.time_of_day ? String(r.time_of_day) : null,
              ]
                .filter(Boolean)
                .join(' · ')
            ),
            removable: asRemovable(week.data ?? [], 'user_week'),
          },
          plate: {
            lines: byKind(['food', 'other']).map((a) => String(a.name)),
            removable: asRemovable(byKind(['food', 'other']), 'allergies'),
          },
          skin_air: {
            lines: byKind(['contact', 'environmental']).map((a) => String(a.name)),
            removable: asRemovable(byKind(['contact', 'environmental']), 'allergies'),
          },
          medicines: {
            lines: byKind(['medicine']).map((a) => String(a.name)),
            removable: asRemovable(byKind(['medicine']), 'allergies'),
          },
          movements: {
            lines: (rules.data ?? []).map((r) => String(r.phrase)),
            removable: asRemovable(rules.data ?? [], 'user_rules'),
          },
          avoid: { lines: itemsOf('Avoid') },
          body: {
            lines: [
              p?.life_stage ? `Periods: ${String(p.life_stage).replace(/_/g, ' ')}` : null,
              p?.life_stage_detail ? String(p.life_stage_detail).replace(/_/g, ' ') : null,
              Array.isArray(p?.hormone_use) && p.hormone_use.length > 0
                ? `Hormones: ${(p.hormone_use as string[]).map((h) => h.replace(/_/g, ' ')).join(', ')}`
                : null,
            ].filter((l): l is string => Boolean(l)),
          },
          takes: { lines: itemsOf('Medications') },
        });
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  /**
   * SAYING IT IS ONE TAP AND ONE WRITE.
   *
   * The optimistic set comes first so the chips answer immediately, and a failed
   * write puts it back rather than leaving her looking at a state the database
   * does not hold. No confirm step: the two-press gate on the goals screen is
   * what lost her 45 kg goal this afternoon, and a wrong tap here is corrected by
   * the other chip.
   */
  async function sayTraining(next: 'training' | 'paused') {
    if (savingTraining) return;
    const previous = training;
    const previousAt = trainingSetAt;
    // TAPPING THE ONE THAT IS ALREADY SET UNSETS IT, which is how she gets back
    // to "not said" without a third chip for it.
    const value = previous === next ? null : next;
    const stamp = value == null ? null : new Date().toISOString();
    setTraining(value);
    setTrainingSetAt(stamp);
    setSavingTraining(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setTraining(previous);
      setTrainingSetAt(previousAt);
      setSavingTraining(false);
      return;
    }
    const { error } = await supabase
      .from('user_profile')
      .update({
        training_state: value,
        training_state_set_at: stamp,
      })
      .eq('user_id', user.id);
    setSavingTraining(false);
    if (error) {
      setTraining(previous);
      setTrainingSetAt(previousAt);
      return;
    }
  }

  /**
   * THE DATE IS PART OF THE ANSWER. "Paused" with no date is a state that
   * outlives the pause, and nothing expires it on her behalf - an app deciding
   * she must be training again by now would be inventing the very fact this row
   * exists to stop it inventing. Showing when she said it is what lets her see
   * it has gone stale.
   */
  function trainingLines(): string[] {
    if (training == null) return [];
    return [
      training === 'paused' ? 'Paused at the moment.' : 'Training at the moment.',
      ...(trainingSetAt
        ? [`Said on ${new Date(trainingSetAt).toLocaleDateString('en-GB')}.`]
        : []),
    ];
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
        'Change your body goal above if you would rather lose fat with a deficit.',
      ];
    }
    // NULL READS AS RUNNING, because a deficit is what choosing to lose fat
    // already asked for. Only an explicit pause is news.
    if (deficit !== 'paused') return ['Running, as your goal asks.'];
    return [
      'Paused, so your calories are held at what you use.',
      'Your goal has not changed and nothing was lost.',
      ...(deficitSetAt
        ? [`Paused on ${new Date(deficitSetAt).toLocaleDateString('en-GB')}.`]
        : []),
    ];
  }

  /** Where a row is edited. The setup screen that owns that question. */
  function editRoute(key: string): string | null {
    switch (key) {
      case 'days':
        return '/onboarding/days';
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
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.groupTitle}>
          {BODY_MANUAL_HEADING}
        </ThemedText>
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

  return (
    <View style={styles.group}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.groupTitle}>
        {BODY_MANUAL_HEADING}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
        {BODY_MANUAL_NOTE}
      </ThemedText>

      <ThemedView type="backgroundElement" style={styles.card}>
        {BODY_MANUAL_SECTIONS.filter((s) => !s.onlyWhenFatLoss || wantsFatLoss).map((section, i) => {
          const contents =
            section.key === 'training'
              ? { lines: trainingLines() }
              : section.key === 'goal'
                ? { lines: mode ? [modeLabel(mode), modeExplanation(mode)] : [] }
                : section.key === 'deficit'
                  ? { lines: deficitLines() }
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
                    contents.lines.map((line, n) => (
                      <ThemedText key={n} type="small">
                        {line}
                      </ThemedText>
                    ))
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

                  {section.inline && section.key === 'training' && (
                    <View style={styles.chips}>
                      {(
                        [
                          ['training', 'I am training'],
                          ['paused', 'Paused for now'],
                        ] as const
                      ).map(([value, label]) => {
                        const on = training === value;
                        return (
                          <Pressable
                            key={value}
                            onPress={() => void sayTraining(value)}
                            disabled={savingTraining}
                            accessibilityRole="button"
                            accessibilityState={{ selected: on, disabled: savingTraining }}
                            accessibilityLabel={label}
                            accessibilityHint={
                              on ? 'Tap again to go back to not saying' : undefined
                            }
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
                      onPress={() => router.push({ pathname: route as never, params: { redo: '1' } })}
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
