import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  BODY_MANUAL_HEADING,
  BODY_MANUAL_NOTE,
  BODY_MANUAL_SECTIONS,
  type SectionContents,
} from '@/lib/body-manual';
import { lookbackLabel } from '@/lib/feel-goals';
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
          supabase.from('user_profile').select('life_stage, life_stage_detail, hormone_use').maybeSingle(),
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
        } | null;

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

  /** Where a row is edited. The setup screen that owns that question. */
  function editRoute(key: string): string | null {
    switch (key) {
      case 'days':
        return '/onboarding/days';
      case 'goal':
        return '/onboarding/goals';
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
        {BODY_MANUAL_SECTIONS.map((section, i) => {
          const contents = data[section.key] ?? { lines: [] };
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

                  {/* WEIGHT HAS NO EDIT, because it maintains itself: the latest
                      real weigh-in beats any estimate, whatever the dates say. A
                      button here would imply otherwise. */}
                  {!section.readOnly && route && (
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
  pressed: { opacity: 0.6 },
});
