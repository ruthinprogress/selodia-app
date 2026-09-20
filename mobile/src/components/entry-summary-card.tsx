import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { formatLogDate } from '@/lib/week';

// The entry a question is about, shown in the thread (Ruth, 2026-09-16: "no card
// appeared to let the user and chat know what is being discussed").
//
// FOOD IS NOT HERE, on purpose: a food entry already has a richer thing to show,
// the live itemised table in food-breakdown-table.tsx, and two components
// drawing the same entry differently is how they drift. This covers the other
// two kinds, which have no table because they have no items.
//
// READ LIVE, NEVER POSTED AS A PICTURE. The card shows what the database holds
// now. A screenshot would be a second copy of the same facts, and it is the copy
// that goes stale - the same reasoning that keeps the chat's food table reading
// from food_items rather than from anything the model wrote.
//
// It renders nothing at all if the row has gone. An entry deleted after the
// question was asked leaves the question standing on its own, which is honest;
// inventing a placeholder for it would not be.

// 'plan' joined on 2026-09-20, when "Update this" on a plan started sending:
// the turn needs a card in the thread like any other, or the conversation
// reads later as though it began about nothing.
export type SummaryEntryType = 'activity' | 'measurement' | 'plan';

type Summary = { title: string; detail: string | null; when: string | null };

const round = (v: number | null | undefined, unit: string): string | null =>
  v == null ? null : `${Math.round(v * 10) / 10}${unit}`;

export function EntrySummaryCard({
  entryType,
  entryId,
  // WHAT THE DETAIL CARD ALREADY HAD (Ruth, 2026-09-16: "It comes in after a
  // long time but the text comes in first for a good while"). This drew nothing
  // until its read returned, so the reply - a separate request entirely - won
  // the race and the card arrived afterwards. The sheet she tapped was showing
  // these very values, so they travel with the tap and the card draws in the
  // same frame as her message. The read still runs and still overwrites them.
  seed,
}: {
  entryType: SummaryEntryType;
  entryId: string;
  seed?: { title?: string | null; detail?: string | null; when?: string | null } | null;
}) {
  const theme = useTheme();
  const [summary, setSummary] = useState<Summary | null>(
    seed?.title
      ? {
          title: seed.title,
          detail: seed.detail && seed.detail.length > 0 ? seed.detail : null,
          when: seed.when ? formatLogDate(new Date(seed.when)) : null,
        }
      : null
  );
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // RLS scopes both reads to the signed-in user.
      if (entryType === 'plan') {
        const { data } = await supabase
          .from('almanac_entries')
          .select('title, category, content')
          .eq('id', entryId)
          .maybeSingle();
        if (cancelled) return;
        if (data) {
          const content = (data.content ?? {}) as {
            goal?: unknown;
            duration_minutes?: unknown;
            exercises?: unknown[];
          };
          const moves = Array.isArray(content.exercises) ? content.exercises.length : 0;
          const parts = [
            typeof data.category === 'string' && data.category.trim() ? data.category.trim() : null,
            typeof content.duration_minutes === 'number' ? `~${content.duration_minutes} min` : null,
            moves > 0 ? `${moves} ${moves === 1 ? 'movement' : 'movements'}` : null,
          ].filter((p): p is string => p !== null);
          setSummary({
            title: (data.title as string | null)?.trim() || 'A plan',
            detail: parts.length > 0 ? parts.join('  ·  ') : null,
            // A plan is not an event, so it carries no date into the thread.
            when: null,
          });
        } else {
          setSummary(null);
        }
      } else if (entryType === 'activity') {
        const { data } = await supabase
          .from('activity_logs')
          .select('activity_type, duration_min, kcal_burned, happened_at')
          .eq('id', entryId)
          .maybeSingle();
        if (cancelled) return;
        if (data) {
          const parts = [
            data.duration_min != null ? `${Math.round(data.duration_min)} min` : null,
            data.kcal_burned != null ? `${Math.round(data.kcal_burned)} kcal` : null,
          ].filter((p): p is string => p !== null);
          setSummary({
            title: data.activity_type ?? 'Activity',
            detail: parts.length > 0 ? parts.join(' · ') : null,
            when: data.happened_at ? formatLogDate(new Date(data.happened_at)) : null,
          });
        } else {
          // The row has gone. Cleared rather than left standing on the seed:
          // an entry deleted after it was asked about should take its card with
          // it, which is the silence this component has always kept when it had
          // nothing of its own to draw.
          setSummary(null);
        }
      } else {
        const { data } = await supabase
          .from('body_measurements')
          .select('weight_kg, body_fat_pct, muscle_kg, measured_at')
          .eq('id', entryId)
          .maybeSingle();
        if (cancelled) return;
        if (data) {
          const parts = [
            round(data.weight_kg, ' kg'),
            data.body_fat_pct != null ? `${Math.round(data.body_fat_pct * 10) / 10}% fat` : null,
            data.muscle_kg != null ? `${Math.round(data.muscle_kg * 10) / 10} kg muscle` : null,
          ].filter((p): p is string => p !== null);
          setSummary({
            title: 'Reading',
            detail: parts.length > 0 ? parts.join(' · ') : null,
            when: data.measured_at ? formatLogDate(new Date(data.measured_at)) : null,
          });
        } else {
          setSummary(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entryType, entryId]);

  // A seed is enough to draw. Without one this still waits for the read, and a
  // row that has genuinely gone clears the seed above rather than leaving a card
  // standing for an entry that no longer exists.
  if (!summary) return null;

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, { borderColor: theme.backgroundSelected }]}
      accessibilityRole="summary"
      accessibilityLabel={`About ${summary.title}${summary.when ? `, ${summary.when}` : ''}${
        summary.detail ? `, ${summary.detail}` : ''
      }`}
    >
      <ThemedText type="smallBold">
        {summary.title}
        {summary.when ? ` · ${summary.when}` : ''}
      </ThemedText>
      {summary.detail && (
        <ThemedText type="small" themeColor="textSecondary">
          {summary.detail}
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    gap: Spacing.half,
    // Sits with the turn it belongs to rather than spanning the thread.
    alignSelf: 'flex-start',
    maxWidth: '95%',
  },
});
