import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SwipeToDelete } from '@/components/swipe-to-delete';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Undo } from '@/lib/remove-entry';
import { addWeeks, toLocalDateKey, weekLabel } from '@/lib/week';

// ONE DAY LIST, USED BY FOOD, MOVEMENT AND MEASUREMENTS.
//
// Ruth, 27 September 2026, item 2: "Measurements is now the reference for how a
// log looks. Food and Movement should use the same components and structure, so
// all three Log tabs feel like one design. Build it as one shared day-list
// pattern used by all three, not three copies."
//
// THE LAST CLAUSE IS THE INSTRUCTION. Three screens that merely LOOK alike drift
// apart on the first change that only one of them gets, and this codebase has
// the receipts: the segmented control was rebuilt six times before it became one
// component, the seed mark sat at four different offsets, and the Food log was
// two screens with two copies of a row and two sets of totals until last week.
// Matching them by hand would be agreeing to do this again.
//
// WHAT EACH SCREEN STILL OWNS. Its own reads, its own summary line, and how an
// entry is worded - because those are the things that genuinely differ. A day
// of food is totals and a day of movement is steps then sessions, and no
// abstraction should try to have an opinion about that. What is shared is the
// SHAPE: the week bar, the rule between days, which day is open, the time it
// was logged, the one chat link, the swipe, the toast.
//
// DAYS WITH NOTHING IN THEM ARE NOT SHOWN, which is her rule and a better one
// than it first looks. A week of seven rows where four say nothing teaches the
// reader to skim; four rows that each hold something teaches them to read.

/** How long a removed entry can be put back from the toast. Her figure. */
const UNDO_WINDOW_MS = 10_000;

export type DayEntry = {
  id: string;
  /** The entry as it reads. Capitalised by the caller - "Pushups", not "pushups". */
  label: string;
  /** The figures beside it, already labelled: "2 min · moderate · 41 kcal". */
  detail?: string | null;
  /** The heading this sits under, when the source groups them. Meals, mostly. */
  group?: string | null;
  /**
   * The drawing that leads the line, where the screen has one.
   *
   * Optional because the three screens genuinely differ: food has a category
   * icon, measurements have the tape and scale marks, movement has neither yet.
   * Taking it as a node rather than a name keeps this component ignorant of
   * every icon family in the app, which is the only way it stays shared.
   */
  mark?: React.ReactNode;
  /**
   * OPENS THE ENTRY. Optional, and per entry rather than per screen, because
   * the three screens sharing this list genuinely differ: a food entry has an
   * itemised breakdown to show, and a weight reading has nothing behind it.
   *
   * RESTORED 29 September 2026. Tapping a food row used to open the "What's in
   * here" card - the itemised list, with a way to delete a single item that
   * was wrong. The consolidation of Food, Movement and Measurements into this
   * one list on 27 September kept the swipe and dropped the tap, and the card
   * itself was deleted in the same commit. Nothing said so: the row still
   * looked identical and still responded to a swipe, so the only way to notice
   * was to tap one and wait for something that was never coming.
   */
  onOpen?: () => void;
  /** Removes it and hands back the means to undo. Null when nothing went. */
  remove: () => Promise<Undo | null>;
};

export type LogDay = {
  key: string;
  date: Date;
  /** One line, every value labelled. A node so a foot icon can lead it. */
  summary: React.ReactNode;
  /**
   * The summary to show when the day is OPEN, where that differs.
   *
   * Ruth, 27 September 2026, item 8: Movement's collapsed summary lists what
   * she did, and repeating that above the entries meant reading the same
   * sessions twice on one screen. Open, it shows the steps alone - the one
   * figure the entries below do not contain. Food has no such split, because
   * its summary is totals and its entries are the things totalled.
   */
  openSummary?: React.ReactNode;
  /** When the first of the day's entries was recorded. */
  at?: string | null;
  entries: DayEntry[];
};

function shortDay(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
}

function loggedAt(at: string | null | undefined): string | null {
  if (!at) return null;
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return null;
  return `Logged ${d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' }).toLowerCase()}`;
}

export function DayLog({
  days,
  weekStart,
  onWeekStart,
  isPresent,
  onJump,
  onChanged,
  subject,
  empty,
}: {
  days: LogDay[];
  weekStart: Date;
  onWeekStart: (d: Date) => void;
  /** True when the week shown is the current one, so forward is disabled. */
  isPresent: boolean;
  /** The far-jump control on the label, where a screen has one. */
  onJump?: () => void;
  /** Fired once something has been removed or put back. */
  onChanged: () => void;
  /** Opens the conversation about one day: "About my food from Thu 24: ". */
  subject: (date: Date) => string;
  /** Said when the week holds nothing. */
  empty: string;
}) {
  const theme = useTheme();
  const todayKey = toLocalDateKey(new Date());

  // TODAY IS FIRST AND TODAY IS OPEN (item 7), and this is the list's job
  // rather than each caller's. Food had today collapsed with Saturday open and
  // Movement had no row for today at all - two screens, two different wrong
  // answers, which is what happens when three callers each sort their own days.
  const ordered = useMemo(() => {
    const today = days.filter((d) => d.key === todayKey);
    const rest = days
      .filter((d) => d.key !== todayKey)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    return [...today, ...rest];
  }, [days, todayKey]);

  // WHICH DAY IS OPEN, DERIVED RATHER THAN STORED (Ruth, 27 September 2026,
  // item 8: "Today (Sun 27) is still collapsed").
  //
  // It used to be a Set seeded with today's key at mount, and that is the bug:
  // seeding cannot open a row that does not exist yet. The list is built from a
  // read, so on a slow load or a week snap today's row appears AFTER the
  // seeding has happened, and a row that arrives late arrives shut.
  //
  // The fix is to stop storing which days are open and store only which ones
  // she has TOUCHED. Today is open by default whenever it is present - no
  // timing involved, because nothing has to happen in the right order - and a
  // day she has tapped is the opposite of its default. Her taps still stick,
  // including closing today.
  const [toggled, setToggled] = useState<Set<string>>(() => new Set());
  const [undo, setUndo] = useState<Undo | null>(null);

  const isOpen = useCallback(
    (key: string) => (key === todayKey) !== toggled.has(key),
    [todayKey, toggled]
  );

  // The toast clears itself. Ten seconds is her figure, and it is the window
  // the whole soft-delete design hangs off - see lib/recoverable.ts for the
  // seven days behind it.
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), UNDO_WINDOW_MS);
    return () => clearTimeout(t);
  }, [undo]);

  const toggle = useCallback((key: string) => {
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const undoNow = useCallback(async () => {
    if (!undo) return;
    const ok = await undo.restore();
    setUndo(null);
    if (ok) onChanged();
  }, [undo, onChanged]);

  return (
    <View style={styles.wrap}>
      <View style={styles.weekBar}>
        <Step label="‹" hint="Previous week" onPress={() => onWeekStart(addWeeks(weekStart, -1))} />
        {onJump ? (
          <Pressable
            onPress={onJump}
            accessibilityRole="button"
            accessibilityLabel="Jump to another month"
            hitSlop={Spacing.two}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <ThemedText type="small" themeColor="textSecondary">
              {weekLabel(weekStart)}
            </ThemedText>
          </Pressable>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {weekLabel(weekStart)}
          </ThemedText>
        )}
        <Step
          label="›"
          hint="Next week"
          disabled={isPresent}
          onPress={() => onWeekStart(addWeeks(weekStart, 1))}
        />
      </View>

      {ordered.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {empty}
        </ThemedText>
      ) : (
        <View>
          {ordered.map((day, i) => (
            <DayRow
              key={day.key}
              day={day}
              rule={i > 0}
              expanded={isOpen(day.key)}
              onToggle={() => toggle(day.key)}
              onChanged={onChanged}
              onRemoved={setUndo}
              subject={subject}
            />
          ))}
        </View>
      )}

      {undo ? (
        <View style={[styles.undo, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="detail" themeColor="textSecondary" style={styles.undoText}>
            {undo.label} removed.
          </ThemedText>
          <Pressable
            onPress={() => void undoNow()}
            accessibilityRole="button"
            accessibilityLabel={`Undo removing ${undo.label}`}
            hitSlop={Spacing.three}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <ThemedText type="smallBold" themeColor="accentDeep">
              Undo
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function DayRow({
  day,
  rule,
  expanded,
  onToggle,
  onChanged,
  onRemoved,
  subject,
}: {
  day: LogDay;
  rule: boolean;
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void;
  onRemoved: (undo: Undo) => void;
  subject: (date: Date) => string;
}) {
  const theme = useTheme();

  // NOT ONE BUTTON WRAPPING EVERYTHING. React refuses a button inside a button
  // on the web and a screen reader cannot offer the inner one. The opener holds
  // nothing interactive; every pressable thing is its sibling. This took three
  // attempts on Measurements and is inherited here rather than rediscovered.
  const remove = async (entry: DayEntry) => {
    const undo = await entry.remove();
    if (undo) {
      onRemoved(undo);
      onChanged();
    }
  };

  // Entries keep the source's own grouping when it has one - meals - and fall
  // back to time order, which is what the rows already are.
  const groups: { name: string | null; entries: DayEntry[] }[] = [];
  for (const entry of day.entries) {
    const name = entry.group ?? null;
    const last = groups[groups.length - 1];
    if (last && last.name === name) last.entries.push(entry);
    else groups.push({ name, entries: [entry] });
  }

  return (
    <View style={[styles.row, rule && { borderTopWidth: 1, borderTopColor: theme.backgroundSelected }]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${shortDay(day.date)}, ${day.entries.length} ${day.entries.length === 1 ? 'entry' : 'entries'}`}
        style={({ pressed }) => [expanded ? styles.dayLabelOnly : styles.dayOpener, pressed && styles.pressed]}
      >
        <ThemedText type="small" themeColor="textSecondary" style={styles.dayLabel}>
          {shortDay(day.date)}
        </ThemedText>
        {!expanded ? <View style={styles.figures}>{day.summary}</View> : null}
      </Pressable>

      {expanded ? (
        <View style={styles.figures}>
          {/* STILL THE SUMMARY, ABOVE THE ENTRIES (item 7). Opening a day used
              to replace its totals with its parts, so the one figure she came
              for vanished at the moment she asked for more. */}
          <View style={styles.openSummary}>{day.openSummary ?? day.summary}</View>
          {groups.map((group, gi) => (
            <View key={`${group.name ?? 'all'}-${gi}`} style={styles.group}>
              {group.name ? (
                <ThemedText type="detail" themeColor="textSecondary">
                  {group.name}
                </ThemedText>
              ) : null}
              {group.entries.map((entry) => (
                /* THE DATE COLUMN DOES NOT MOVE (item 7). Without this the
                   sliding entry travelled straight over the day and date on
                   its left, because nothing was stopping it - and the bin
                   appeared as a block of its own beside the row rather than
                   behind it. Clipping the swipe to its own box keeps the
                   movement inside the entry's area and puts the bin exactly
                   where the entry was.
                   `overflow: hidden` has bitten this app before, on the tab
                   strip, where it chopped a WORD. Here it is the right tool for
                   the opposite reason: the thing being clipped is a shape that
                   is supposed to leave, not a word that is supposed to fit. */
                <View key={entry.id} style={styles.swipeBox}>
                <SwipeToDelete what={entry.label} onDelete={() => remove(entry)}>
                  {/* TAP OPENS, SWIPE DELETES, and the two do not fight: the
                      swipe only activates past 12 points sideways
                      (swipe-to-delete.tsx), so a tap never reaches it. */}
                  <Pressable
                    onPress={entry.onOpen}
                    disabled={!entry.onOpen}
                    accessibilityRole={entry.onOpen ? 'button' : undefined}
                    accessibilityLabel={
                      entry.onOpen ? `${entry.label}. Open to check the items or delete one.` : undefined
                    }
                    style={({ pressed }) => pressed && entry.onOpen && styles.pressed}>
                  <View style={styles.entry}>
                    {/* TWO LINES, NOT TWO COLUMNS (Ruth, 27 September 2026,
                        item 7). The details used to take a fixed column on the
                        right, which left the name a narrow one - and a narrow
                        column breaks words rather than lines: "Pushup/s",
                        "cheesebu/rger", "Raffaell/o-sty...".
                        The name now has the full width and the figures sit
                        under it. Two lines then an ellipsis, her rule, because
                        a five-line entry is a paragraph. */}
                    <View style={styles.entryName}>
                      {entry.mark ? <View style={styles.entryMark}>{entry.mark}</View> : null}
                      <ThemedText
                        type="small"
                        style={styles.entryLabel}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {entry.label}
                      </ThemedText>
                    </View>
                    {entry.detail ? (
                      <ThemedText type="detail" themeColor="textSecondary">
                        {entry.detail}
                      </ThemedText>
                    ) : null}
                  </View>
                  </Pressable>
                </SwipeToDelete>
                </View>
              ))}
            </View>
          ))}

          {loggedAt(day.at) ? (
            <ThemedText type="detail" themeColor="textSecondary">
              {loggedAt(day.at)}
            </ThemedText>
          ) : null}

          {/* ONE PER DAY, as on Measurements. Both things a person wants to do
              with an entry open the same conversation, because there is no form
              anywhere in this app for a logged thing - so two links would be
              two doors into one room, and "Edit" would promise a form that does
              not exist. Her wording, 26 September. */}
          <Pressable
            onPress={() => router.push({ pathname: '/', params: { prefill: subject(day.date) } })}
            accessibilityRole="button"
            accessibilityLabel={`Ask about or change ${shortDay(day.date)}`}
            hitSlop={Spacing.two}
            style={({ pressed }) => [styles.chatLink, pressed && styles.pressed]}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={14} color={theme.accentDeep} />
            <ThemedText type="detail" themeColor="accentDeep">
              Ask about or change this
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={expanded ? `Close ${shortDay(day.date)}` : `Open ${shortDay(day.date)}`}
        hitSlop={Spacing.two}
        style={({ pressed }) => [styles.chevron, pressed && styles.pressed]}
      >
        <Ionicons
          name={expanded ? 'chevron-down' : 'chevron-forward'}
          size={16}
          color={theme.textSecondary}
        />
      </Pressable>
    </View>
  );
}

function Step({
  label,
  hint,
  onPress,
  disabled,
}: {
  label: string;
  hint: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={hint}
      hitSlop={Spacing.three}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <ThemedText type="small" style={{ color: disabled ? theme.backgroundSelected : theme.accentDeep }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  weekBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.three,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two, paddingVertical: Spacing.two },
  dayOpener: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  dayLabelOnly: { flexDirection: 'row' },
  dayLabel: { minWidth: 58 },
  figures: { flex: 1, minWidth: 0, gap: Spacing.one },
  group: { gap: 2 },
  entry: { gap: 1, paddingVertical: Spacing.one },
  swipeBox: { overflow: 'hidden' },
  entryName: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.one },
  // WITHOUT minWidth THE NAME WILL NOT WRAP AT ALL beside a mark - a flex child
  // refuses to go below its own content width unless told it may, which is the
  // trap already written up twice in this codebase.
  entryLabel: { flex: 1, minWidth: 0 },
  entryMark: { width: 22, alignItems: 'center', paddingTop: 1 },
  openSummary: { paddingBottom: Spacing.one },
  chevron: { paddingTop: 2 },
  chatLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: Spacing.one },
  undo: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -Spacing.two,
    zIndex: 20,
    elevation: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
  },
  undoText: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.6 },
});
