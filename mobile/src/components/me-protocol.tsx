import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SectionIntro } from '@/components/section-intro';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AlmanacRow } from '@/lib/insights';
import { readMeCard, sectionOf } from '@/lib/me-card';
import { humanDate } from '@/lib/week';

// ME: the personal protocol (Me brief, confirmed 2026-09-12; built 2026-09-19).
//
// Ruth's words for what this is: "the stable reference for how she is supposed
// to be living. Not a log of what happened, not live data." She returns to it
// when she has drifted and needs to re-anchor.
//
// A SCROLLABLE REFERENCE DOCUMENT, ORGANISED BY SECTION - which is the brief's
// own description and the reason this is not the Insights list with different
// rows. Insights is a feed, newest first, because an observation belongs to when
// it was made. A protocol is a document: Supplements together, Skincare
// together, in sections that came into being by their first card arriving.
//
// TWO LAYERS, and the second is the point. The surface is the name, the status
// and nothing else. Tapping opens WHY it was decided, because "these are the
// boring-but-important things. Easy to deprioritise without the why. The card
// holds the reasoning so the user doesn't have to remember it."
//
// WHAT IT REFUSES TO BE, from the brief: not a checklist (nothing is ticked, and
// there is no tick anywhere in this file), not a tracker (no streaks, no
// counts), not a settings page. A paused supplement stays visible with its
// reason, because "a paused supplement with a reason is more informative than a
// blank space".

// The five the brief names, in its order. Anything that emerges from a
// conversation follows them alphabetically: sections are open (principle 13),
// so this is a preference, not a permitted list.
const SECTION_ORDER = ['Nutrition', 'Supplements', 'Skincare', 'Wellbeing', 'Relationships'];

function orderSections(names: string[]): string[] {
  const known = SECTION_ORDER.filter((s) => names.includes(s));
  const rest = names.filter((s) => !SECTION_ORDER.includes(s)).sort((a, b) => a.localeCompare(b));
  return [...known, ...rest];
}

export function MeProtocol({ entries }: { entries: AlmanacRow[] }) {
  const sections = useMemo(() => {
    const map = new Map<string, AlmanacRow[]>();
    for (const entry of entries) {
      const name = sectionOf(entry.category);
      const list = map.get(name) ?? [];
      list.push(entry);
      map.set(name, list);
    }
    return orderSections([...map.keys()]).map((name) => ({ name, rows: map.get(name) ?? [] }));
  }, [entries]);

  return (
    <View style={styles.wrap}>
      <SectionIntro title="Your own record">
        How you have decided to look after yourself, and why.
      </SectionIntro>

      {sections.map((section) => (
        <View key={section.name} style={styles.section}>
          <ThemedText type="sectionTitle" style={styles.heading}>
            {section.name}
          </ThemedText>
          {section.rows.map((row) => (
            <MeCardRow key={row.id} row={row} />
          ))}
        </View>
      ))}
    </View>
  );
}

function MeCardRow({ row }: { row: AlmanacRow }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const card = readMeCard(row.content);

  // Nothing to open is not a card that pretends it can be opened: the chevron
  // and the press both go, rather than leaving a control that does nothing.
  const expandable = !!(card.why || card.detail);

  const body = (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.surface}>
        <ThemedText type="small" style={styles.name}>
          {row.title}
        </ThemedText>
        {/* THE STATUS IS A WORD, NEVER A TICK (Ruth's answer 5). Paused reads
            quieter than the rest, because it is still part of the record and
            not still part of the routine. */}
        {card.status && (
          <ThemedText
            type="detail"
            themeColor={card.status === 'Paused' ? 'textSecondary' : 'text'}
            style={styles.status}
          >
            {card.status}
          </ThemedText>
        )}
        {expandable && (
          <Ionicons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={theme.textSecondary}
          />
        )}
      </View>

      {open && (
        <View style={styles.expanded}>
          {card.why && <ThemedText type="detail">{card.why}</ThemedText>}
          {card.detail && (
            <ThemedText type="detail" themeColor="textSecondary">
              {card.detail}
            </ThemedText>
          )}
          <ThemedText type="detail" themeColor="textSecondary">
            Added {humanDate(new Date(row.created_at))}
          </ThemedText>
          {/* HOW IT HAS CHANGED, in the order it happened. The brief: "a
              paused supplement with a reason is more informative than a blank
              space" - and a card that says it was paused in March because it
              was not helping is the thing that stops the same experiment being
              run twice. The undated first entry is the state it was saved in,
              which the Added line above already says, so it is not repeated. */}
          {card.history
            .filter((h) => h.date)
            .map((h, i) => (
              <ThemedText key={`${h.date}-${i}`} type="detail" themeColor="textSecondary">
                {[
                  h.status ? `${h.status} ${humanDate(new Date(h.date))}` : humanDate(new Date(h.date)),
                  h.reason,
                ]
                  .filter(Boolean)
                  .join('  -  ')}
              </ThemedText>
            ))}
        </View>
      )}
    </ThemedView>
  );

  if (!expandable) return body;

  return (
    <Pressable
      onPress={() => setOpen((v) => !v)}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${row.title}${card.status ? `, ${card.status}` : ''}`}
      accessibilityHint="Shows why this was added"
      style={({ pressed }) => pressed && styles.pressed}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  section: { gap: 6, paddingTop: Spacing.three },
  heading: { paddingBottom: 2 },
  card: {
    borderRadius: CardRadius,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: Spacing.two,
  },
  surface: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  name: { flex: 1 },
  // Right-aligned against the chevron, so a column of statuses reads down the
  // page as its own line of information.
  status: { textAlign: 'right' },
  expanded: { gap: Spacing.one },
  pressed: { opacity: 0.75 },
});
