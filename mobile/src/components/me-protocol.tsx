import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { FormattedText } from '@/components/formatted-text';
import { RecordBody } from '@/components/record-body';
import { ReorderableRows } from '@/components/reorderable-rows';
import { SwipeToDelete } from '@/components/swipe-to-delete';
import { expandedLayout } from '@/lib/entry-layout';
import { itemsOf } from '@/lib/me-items';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { byStatusThenRecent, lifecycleOf, setClosed } from '@/lib/me-archive';
import { authedPost } from '@/lib/api';
import type { AlmanacRow } from '@/lib/insights';
import {
  CARE_EMPTY,
  CARE_SECTION,
  CARE_SECTION_LABEL,
  CARE_SUBTITLE,
  MERGED_INTO_CARE,
} from '@/lib/care-admin';
import { StandingDetails } from '@/components/standing-details';
import {
  DETAILS_SECTION,
  DETAILS_SECTION_LABEL,
  DETAILS_SUBTITLE,
  type StandingDetail,
} from '@/lib/care-constants';
import { arrange, layoutOf, loadLayout, saveLayout, type LogLayout } from '@/lib/log-layout';
import { ME_STATUSES, readMeCard, sectionOf, type MeCard, type MeStatus } from '@/lib/me-card';
import { updateMeCard } from '@/lib/me-card-write';
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

export function MeProtocol({
  entries,
  details,
  onRemoveDetail,
  onDeleted,
  onChanged,
}: {
  entries: AlmanacRow[];
  /** Her standing details, for the section above How I Access Care. */
  details: StandingDetail[];
  /** A row she swiped away. The tab owns the delete so it can put it back. */
  onRemoveDetail?: (detail: StandingDetail) => void;
  /** Fired once a card is gone, so the screen above can re-read itself.
      (Ruth, 25 September 2026, item 6.) */
  onDeleted?: () => void;
  /** Fired once a card is edited, for the same reason (item 15). */
  onChanged?: () => void;
}) {
  const theme = useTheme();
  const [exporting, setExporting] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);

  // ONE TAP, AS THE BRIEF ASKS. The page opens in the phone's browser, where
  // printing, saving as a PDF and sharing are the browser's own - so none of it
  // needs a native module, and it ships over an update rather than a rebuild.
  async function exportProtocol() {
    if (exporting) return;
    setExporting(true);
    setExportFailed(false);
    try {
      const { url } = await authedPost<{ url: string }>('/api/me-export', {});
      await openBrowserAsync(url);
    } catch {
      // Said plainly, and nothing else happens: a half-opened page is worse
      // than a sentence that says it did not work.
      setExportFailed(true);
    } finally {
      setExporting(false);
    }
  }

  const sections = useMemo(() => {
    const map = new Map<string, AlmanacRow[]>();
    for (const entry of entries) {
      const name = sectionOf(entry.category);
      const list = map.get(name) ?? [];
      list.push(entry);
      map.set(name, list);
    }
    // HEALTH IS NOT A TOP-LEVEL SECTION ANY MORE (Ruth, 20 October 2026: "We
    // have Health competing with How I Access Care, which is confusing").
    // Its cards are shown under Health Care Records below, so it is filtered
    // out here rather than appearing twice.
    return orderSections(
      [...map.keys()].filter((n) => n !== CARE_SECTION && n !== MERGED_INTO_CARE)
    ).map((name) => ({
      name,
      rows: map.get(name) ?? [],
    }));
  }, [entries]);

  // HOW I ACCESS CARE IS ITS OWN SECTION, LAST, AND ALWAYS THERE (Ruth, 12
  // October 2026: "How I Access Care needs to be its own section at the bottom
  // of the list. It's not working hidden").
  //
  // It was a group inside Health, because on 6 October she asked for it there:
  // "I don't want it prominent. I like that it sits with the rest of my life."
  // Hidden inside another section it could not be found, which is worse than
  // prominent. LAST keeps what she wanted from that - it never leads the page -
  // and it is outside her reordering so it cannot drift up by accident.
  //
  // SHOWN EVEN WHEN EMPTY, with a line saying how something gets there, because
  // a section she cannot see is a feature she does not know she has.
  //
  // AND IT NOW HOLDS HEALTH TOO (Ruth, 20 October 2026). Two headings for one
  // subject is the confusion she named: nobody can tell from the outside which
  // of their health notes is a "Health" card and which is a care record. The
  // rows keep their stored sections - that string is an identity and the server
  // matches on it - and are shown under one heading.
  //
  // CARE RECORDS FIRST, then the health cards. The paperwork is what somebody
  // opens this for in a hurry, at a desk, with a receptionist waiting.
  const care = useMemo(
    () => ({
      name: CARE_SECTION,
      rows: [
        ...entries.filter((e) => sectionOf(e.category) === CARE_SECTION),
        ...entries.filter((e) => sectionOf(e.category) === MERGED_INTO_CARE),
      ],
    }),
    [entries]
  );

  // The sections that exist, offered when moving a card. Sections are open
  // (principle 13), so the editor also lets one be typed - this is what is
  // already there, not what is allowed.
  const sectionNames = useMemo(
    () => [...orderSections([...new Set([...SECTION_ORDER, ...sections.map((s) => s.name)])]), CARE_SECTION],
    [sections]
  );

  // HER ORDER, NOT THE APP'S (item 6: "Sections are reorderable like the rest
  // of the app"). Same store and same component as the Log, Cycle and Plans
  // lists - a fourth way of arranging a list would be a fourth place for the
  // next arranging bug to live. The ids here are section NAMES, which the
  // store's rules already cover: see log-layout.ts.
  const [layout, setLayout] = useState<LogLayout>({ order: [], hidden: [], closed: [] });
  useEffect(() => {
    let cancelled = false;
    void loadLayout('me_layout').then((l) => {
      if (!cancelled) setLayout(l);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const ordered = useMemo(
    () => arrange(sections.map((sec) => ({ ...sec, id: sec.name })), layout).shown,
    [sections, layout]
  );

  const keep = useCallback(
    (next: { id: string }[]) => {
      const order = next.map((n) => n.id);
      // HER FOLDS SURVIVE THE REORDER. Dropping `closed` here would quietly
      // reopen every section she had shut, the moment she dragged one.
      setLayout((prev) => ({ ...prev, order, hidden: [] }));
      void saveLayout('me_layout', layoutOf(order, [], layout.closed));
    },
    [layout.closed]
  );

  /**
   * SHUT IS WHAT SHE DID, OPEN IS THE DEFAULT (Ruth, 7 October 2026: "yes,
   * remember if sections were open").
   *
   * A section nobody has touched is open, which is how this tab has always
   * looked, so nothing folds under anybody on the deploy. Only a section she
   * actually shut is remembered as shut. See log-layout-rules.ts for why the
   * stored list is the closed ones rather than the open ones.
   */
  const isShut = useCallback((name: string) => layout.closed.includes(name), [layout.closed]);

  const toggleSection = useCallback((name: string) => {
    setLayout((prev) => {
      const closed = prev.closed.includes(name)
        ? prev.closed.filter((n) => n !== name)
        : [...prev.closed, name];
      const next = { ...prev, closed };
      // Saved on the tap rather than on leaving the screen: a fold she loses
      // because she closed the app is worse than no memory at all, because it
      // looks like the app forgot rather than like it never offered.
      void saveLayout('me_layout', layoutOf(next.order, next.hidden, closed));
      return next;
    });
  }, []);

  // ONE SECTION RENDERER, AND THAT IS THE POINT (14 October 2026).
  //
  // Her standing details are a section of this tab and not a list that happens
  // to sit near one: same heading size, same chevron sense, same count, same
  // fold remembered in the same store. `instead` lets a section draw something
  // other than Me cards without a second copy of the heading - which is how
  // the card arrow and the section arrow came to disagree in the first place
  // (see check-one-chevron-rule.mjs), and how every other duplicated string in
  // this repository has drifted.
  const renderSection = (
    section: { name: string; rows: AlmanacRow[] },
    i: number,
    instead?: { count: number; subtitle: string; body: React.ReactNode }
  ) => {
    // THE HEADING IS A LABEL, THE NAME IS AN IDENTITY (Ruth, 20 October 2026).
    // Two sections were renamed that day and neither stored string moved: the
    // section name is written into every row's content and matched on by the
    // server, so renaming it would mean rewriting rows she has already filed.
    // Same reasoning as goal-display.ts, which capitalises at render and never
    // in the database.
    // OPEN AND CLOSED, AND THE OPEN ONES IN HER ORDER (Ruth: "Active get moved
    // to the top of the list, paused next, inactive get stored chronologically
    // below"). The arithmetic lives in lib/me-archive.ts so it can be tested
    // without a screen.
    const openRows = byStatusThenRecent(
      section.rows
        .filter((r) => lifecycleOf(r.status) === 'active')
        .map((r) => ({ row: r, status: readMeCard(r.content).status, when: r.updated_at }))
    ).map((x) => x.row);
    const closedRows = section.rows
      .filter((r) => lifecycleOf(r.status) === 'closed')
      // Chronologically, as she asked, and newest first like everything else.
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

    const heading =
      section.name === CARE_SECTION
        ? CARE_SECTION_LABEL
        : section.name === DETAILS_SECTION
          ? DETAILS_SECTION_LABEL
          : section.name;
    return (
      <View key={section.name} style={styles.section}>
        {/* A THIN RULE BETWEEN SECTIONS, NOT AROUND EACH CARD (item 6:
            "Cormorant headings with thin dividers between sections, no cards
            or pills"). One line per boundary rather than a border per entry
            is the whole difference between a record and a list of widgets -
            and it is the same move Today made when its cards became rows. */}
        {i > 0 ? (
          <View style={[styles.rule, { backgroundColor: theme.backgroundSelected }]} />
        ) : null}
        {/* THE HEADING IS THE CONTROL, AND THE COUNT IS WHAT MAKES THAT SAFE.
            Ruth, 7 October 2026: "I do like the idea of just a number to mark
            quietly how many items in each section, like you did in Body
            Manual."

            It is not decoration. The Body Manual learned it the hard way: a
            folded section showing a heading and nothing was
            "indistinguishable from an empty list", which cost an afternoon
            when her Plans goals section was shut and read as empty. The
            moment a section here can fold, it inherits that exactly.

            THE CHEVRON IS ITS OWN TARGET, because this row is also the drag
            handle for reordering and the two gestures would otherwise fight.
            See the note on `closed` in log-layout-rules.ts for why a section
            nobody has touched stays open. */}
        <Pressable
          onPress={() => toggleSection(section.name)}
          accessibilityRole="button"
          accessibilityState={{ expanded: !isShut(section.name) }}
          accessibilityLabel={heading}
          accessibilityHint={isShut(section.name) ? 'Shows this section' : 'Folds this section away'}
          hitSlop={Spacing.two}
          style={({ pressed }) => [styles.headingRow, pressed && styles.pressed]}
        >
          <Ionicons
            name={isShut(section.name) ? 'chevron-forward' : 'chevron-down'}
            size={16}
            color={theme.textSecondary}
          />
          {/* THE SIZE THE REST OF THE APP USES FOR A SECTION (Ruth, 12
              October 2026: "All the headers are way too big"). These were
              drawn at the page title's own size, so every section on the
              tab shouted as loudly as the word Me above them. */}
          <ThemedText type="sectionTitle" style={styles.heading}>
            {heading}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {instead ? instead.count : section.rows.length}
          </ThemedText>
        </Pressable>
        {/* SWIPE TO DELETE, AS EVERYWHERE ELSE (Ruth, 25 September 2026,
            item 6). A protocol card is a decision somebody made about how
            they live, and decisions get reversed: a supplement stopped for
            good, a routine that never became one. Pausing is already in the
            card's own history and says something different - still part of
            the record, no longer part of the routine - so this is for the
            entries that should not be in the record at all.
            It reveals a Delete rather than firing on the swipe; see
            swipe-to-delete.tsx. */}
        {instead || section.name === CARE_SECTION ? (
          <ThemedText type="detail" themeColor="textSecondary" style={styles.careSubtitle}>
            {instead ? instead.subtitle : CARE_SUBTITLE}
          </ThemedText>
        ) : null}
        {!isShut(section.name) && (
          <>
        {instead ? instead.body : null}
        {!instead && section.name === CARE_SECTION && section.rows.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {CARE_EMPTY}
          </ThemedText>
        ) : null}
        {openRows.map((row) => (
          <SwipeToDelete
            key={row.id}
            table="almanac_entries"
            id={row.id}
            onSecond={async () => {
              await setClosed(row.id, true);
              onChanged?.();
            }}
            secondLabel="Close"
            secondIcon="book-outline"
            what={row.title}
            onDeleted={onDeleted}
          >
            <MeCardRow row={row} sections={sectionNames} onChanged={onChanged} />
          </SwipeToDelete>
        ))}

        {/* CLOSED, UNDER A BAR, STILL HERE (Ruth, 20 October 2026): "Add to
            Archive list - still accessible but under the collapsible bar to
            keep this space calm... they can just be tidied into a collapsible
            bar at the bottom and unarchived if they before active again."

            IN THE SAME SECTION, not a separate screen, which was her own
            instruction and is the better shape: a record does not move house
            when it finishes, it just stops taking up room. It also means the
            report builder needs no special case to find them, and she said
            that was the point of the whole restructure.

            SHUT BY DEFAULT. The section exists to be calm, and a bar that
            opens itself is a list of old ailments with an extra step. */}
        {closedRows.length > 0 ? (
          <>
            <Pressable
              onPress={() => toggleSection(`${section.name}::closed`)}
              accessibilityRole="button"
              accessibilityState={{ expanded: !isShut(`${section.name}::closed`) }}
              accessibilityLabel={`Closed in ${heading}`}
              accessibilityHint={
                isShut(`${section.name}::closed`) ? 'Shows the closed ones' : 'Folds them away'
              }
              hitSlop={Spacing.two}
              style={({ pressed }) => [styles.closedBar, pressed && styles.pressed]}
            >
              <Ionicons
                name={isShut(`${section.name}::closed`) ? 'chevron-forward' : 'chevron-down'}
                size={14}
                color={theme.textSecondary}
              />
              <ThemedText type="small" themeColor="textSecondary">
                {`Closed · ${closedRows.length}`}
              </ThemedText>
            </Pressable>
            {!isShut(`${section.name}::closed`) &&
              closedRows.map((row) => (
                <SwipeToDelete
                  key={row.id}
                  table="almanac_entries"
                  id={row.id}
                  onSecond={async () => {
                    await setClosed(row.id, false);
                    onChanged?.();
                  }}
                  secondLabel="Open again"
                  secondIcon="arrow-undo-outline"
                  what={row.title}
                  onDeleted={onDeleted}
                >
                  <MeCardRow row={row} sections={sectionNames} onChanged={onChanged} />
                </SwipeToDelete>
              ))}
          </>
        ) : null}
          </>
        )}
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      {/* THE INTRODUCTION MOVED UP TO THE PAGE HEADER (Ruth, 26 September 2026,
          item 6): "Header: 'Almanac' title, with the subtitle 'Your own
          record.' directly beneath it, replacing the separate bold 'Your own
          record' block." It is in almanac.tsx now, under the masthead and above
          the switch, which is where her mockup puts it - a deck belongs to the
          page, not to the list below the control. */}
      {/* Quiet, and above the sections rather than after them: it is how the
          whole document leaves the app, so it belongs to the document, not to
          whichever section happens to be last. */}
      {/* THE PAGE HAD NO DECK OF ITS OWN. Her line, 7 October 2026, and it says
          what this tab is for better than the module's own header does. */}
      <ThemedText type="small" themeColor="textSecondary" style={styles.deck}>
        A living record of your health and the ways you choose to look after yourself.
      </ThemedText>
      {/* THE TWO WAYS THIS RECORD LEAVES THE APP, SIDE BY SIDE (Ruth, 7 October
          2026: "Me is missing 'build a report link', put it next to Export or
          share link").

          They are not the same errand, and the pair makes that readable. Export
          is the whole tab as it stands, for her. A report is a chosen subset,
          shaped for somebody else to read. Together she can tell which one she
          wants without opening either. */}
      <View style={styles.leaving}>
        <Pressable
          onPress={() => void exportProtocol()}
          disabled={exporting}
          accessibilityRole="button"
          accessibilityLabel="Export your Me tab as a page you can print or share"
          hitSlop={Spacing.two}
          style={({ pressed }) => [styles.export, pressed && styles.pressed]}
        >
          <Ionicons name="share-outline" size={16} color={theme.accentDeep} />
          <ThemedText type="small" themeColor="accentDeep" numberOfLines={1} style={styles.linkLabel}>
            {exporting ? 'Preparing\u2026' : 'Export to print or share'}
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={() => router.push({ pathname: '/settings/report', params: { start: 'cards' } })}
          accessibilityRole="button"
          accessibilityLabel="Build a report from your Me tab"
          hitSlop={Spacing.two}
          style={({ pressed }) => [styles.export, pressed && styles.pressed]}
        >
          <Ionicons name="document-text-outline" size={16} color={theme.accentDeep} />
          <ThemedText type="small" themeColor="accentDeep" numberOfLines={1} style={styles.linkLabel}>
            Build a report
          </ThemedText>
        </Pressable>
      </View>
      {exportFailed && (
        <ThemedText type="detail" themeColor="textSecondary">
          That didn&apos;t open. Try again in a moment.
        </ThemedText>
      )}

      <ReorderableRows
        items={ordered}
        onReorder={keep}
        renderRow={(section, i) => renderSection(section, i)}
      />
      {/* THE CONSTANTS, THEN THE THREADS (Ruth, 14 October 2026: "So each
          thread of accessing care stays in the current format with everything
          needed for it, and then the constants are in their own section").

          Above the records rather than below them, because of what each one is
          for. A record is read when she wants the story of something - what was
          agreed, when she is next seen. A standing detail is read when somebody
          is waiting on the phone. The thing wanted in a hurry goes where it is
          reached without scrolling.

          Both outside her reordering, like How I Access Care has been since 12
          October, so neither can drift up the page by accident. */}
      {renderSection({ name: DETAILS_SECTION, rows: [] }, ordered.length, {
        count: details.length,
        subtitle: DETAILS_SUBTITLE,
        body: <StandingDetails details={details} onRemove={onRemoveDetail} />,
      })}
      {renderSection(care, ordered.length + 1)}
    </View>
  );
}

/** About two lines at this size, cut on a word so it never ends mid-syllable. */
const PREVIEW_CHARS = 96;

/**
 * The first line or two of what an entry actually says.
 *
 * TRUNCATED, NEVER SUMMARISED (Ruth, item 6: "taken from its actual content,
 * ideally the user's own words... never invent text"). A generated summary
 * would be the app putting words in her mouth on a page whose entire claim is
 * that it holds HER decisions in HER language - and she would have no way of
 * telling which sentences were hers.
 *
 * So this only ever cuts. If it cannot fit, the ellipsis says so.
 */
function previewOf(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= PREVIEW_CHARS) return flat;
  const cut = flat.slice(0, PREVIEW_CHARS);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > PREVIEW_CHARS * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
}

function MeCardRow({
  row,
  sections,
  onChanged,
}: {
  row: AlmanacRow;
  sections: string[];
  onChanged?: () => void;
}) {
  // READ FROM THE ROW, not passed in, so a card cannot be drawn as open while
  // sitting under the Closed bar. One source for the fact.
  const closed = lifecycleOf(row.status) === 'closed';
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [showingLetter, setShowingLetter] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const card = readMeCard(row.content);

  // Two lines at most, and cut on a word so it does not end mid-syllable.
  const preview = previewOf(card.why || card.detail || '');

  // What the expanded card shows, decided in a testable place.
  const layout = expandedLayout(card);
  const items = itemsOf(row.content);

  // ACTIVE AND PAUSED TOGGLE FROM THE COLLAPSED CARD (Ruth, item 15). Only
  // those two: the others - Taking, Ordered, Dietary source, As needed - are
  // not a pair, so there is nothing for a tap to mean. A control whose effect
  // somebody cannot predict is worse than one that is absent.
  // EVERY RECORD HAS ONE NOW (Ruth, 20 October 2026): "I'd like for all records
  // to have the active/paused."
  //
  // me-card.ts says status is "where relevant - a weekly call has no status; a
  // supplement does", and that was right when this tab held routines and
  // protocols. It is not right for what the tab holds today: a referral letter,
  // an insurance claim, a practice's contact details are each either in play or
  // not, and a card with no word beside it was simply unsorted - which is the
  // list she is trying to get out of.
  //
  // DEFAULTED AT RENDER, NEVER WRITTEN. Nothing backfills a status onto rows
  // she already has; an untouched record reads as Active and only stores a
  // status once she taps it. Same reasoning as the headings next door.
  const status = card.status ?? 'Active';
  const togglable = status === 'Active' || status === 'Paused';
  const toggle = async () => {
    if (busy || !togglable) return;
    setBusy(true);
    const next = status === 'Active' ? 'Paused' : 'Active';
    await updateMeCard(row.id, { status: next });
    onChanged?.();
    setBusy(false);
  };

  // Nothing to open is not a card that pretends it can be opened: the chevron
  // and the press both go, rather than leaving a control that does nothing.
  const expandable = !!(card.why || card.detail);

  const body = (
    <View style={styles.card}>
      <View style={styles.surface}>
        <View style={styles.naming}>
          <ThemedText type="small" style={styles.name}>
            {row.title}
          </ThemedText>
          {/* HER OWN WORDS, TRUNCATED, NEVER INVENTED (item 6: "a one- or
              two-line preview of what the entry says (taken from its actual
              content, ideally the user's own words; truncate with an ellipsis,
              never invent text)").
              The `why` is the right field: it is the reason the decision was
              made, in her language, and it is the thing the title alone cannot
              tell her months later. `detail` is the fallback, and when there is
              neither there is no preview rather than a summary of nothing. */}
          {/* IT STANDS DOWN WHEN THE BODY APPEARS (Ruth, 29 September 2026).
              The preview is a STAND-IN for the body, not a companion to it. It
              was never told to stop, so expanding a card showed the truncated
              first line, then the same line in full underneath, then the
              detail restating it a third time. */}
          {preview && !open ? (
            <ThemedText type="detail" themeColor="textSecondary" style={styles.preview}>
              {preview}
            </ThemedText>
          ) : null}
          <ThemedText type="detail" themeColor="textSecondary">
            Updated {humanDate(new Date(row.updated_at ?? row.created_at))}
          </ThemedText>
        </View>
        {/* THE STATUS IS A WORD, NEVER A TICK (Ruth's answer 5). Paused reads
            quieter than the rest, because it is still part of the record and
            not still part of the routine. */}
        {/* CLOSED OVERRIDES IT, because a closed record is not Active-or-Paused
            any more and saying "Active" on something she has tidied away would
            be the card arguing with the bar it is sitting under. */}
        {closed ? (
          <ThemedText type="detail" themeColor="textSecondary" style={styles.status}>
            Closed
          </ThemedText>
        ) : (
          togglable ? (
            <Pressable
              onPress={() => void toggle()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={
                status === 'Active' ? `Pause ${row.title}` : `Make ${row.title} active again`
              }
              hitSlop={Spacing.two}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <ThemedText type="detail" style={styles.status}>
                {busy ? '\u2026' : status}
              </ThemedText>
            </Pressable>
          ) : (
            <ThemedText
              type="detail"
              // Not Active or Paused in this branch - those are the togglable
              // pair above - so it is Taking, Ordered, Dietary source or As
              // needed, all of which read at full strength.
              themeColor="text"
              style={styles.status}
            >
              {status}
            </ThemedText>
          )
        )}
        {expandable && (
          <Ionicons
            name={open ? 'chevron-down' : 'chevron-forward'}
            size={16}
            color={theme.textSecondary}
          />
        )}
      </View>

      {open && (
        <View style={styles.expanded}>
          {/* THE BODY, ONCE. See lib/entry-layout.ts: the decision about
              whether `detail` is saying anything new is a judgement, so it
              lives in a function that can be tested rather than in this
              render. */}
          {/* DRAWN, NOT PRINTED (12 October 2026). The body went out as one
              plain string, so a care record showed its own stars and
              underscores. And at the caption size: a letter is reading, not a
              footnote, so it is at the size the chat reads at.

              AND CUT IN TWO (14 October 2026). What she needs - what was
              agreed, what to quote, who to ring - is drawn. The letter copied
              out underneath it waits behind a tap. See splitAtHeading: a record
              without that heading is drawn whole, so nothing written before
              this loses anything. */}
          {layout.body ? <RecordBody text={layout.body} showing={showingLetter} onToggle={() => setShowingLetter((v) => !v)} /> : null}

          {/* A COMPACT LIST, NOT A BLOB. A protocol made of parts - three
              skincare products, four supplements - reads as a list with its
              own timings, which is what she asked for and what a paragraph
              cannot do. */}
          {items.length > 0 ? (
            <View style={styles.items}>
              {items.map((item) => (
                <View key={item.name} style={styles.item}>
                  <ThemedText type="detail" style={styles.itemName}>
                    {item.name}
                  </ThemedText>
                  <ThemedText type="detail" themeColor="textSecondary">
                    {[item.when, item.purpose].filter(Boolean).join('  ·  ')}
                  </ThemedText>
                </View>
              ))}
            </View>
          ) : null}

          {/* LABELLED, so it reads as an addition rather than as the body
              said again. Absent entirely when it says nothing new. */}
          {/* A CARE RECORD IS NOT AN UPDATE. Its detail is the record itself,
              and labelling the whole letter "Latest" read as if it were a note
              added to the summary line above it. */}
          {layout.latest ? (
            <View style={styles.latest}>
              {row.kind === 'care' ? null : (
                <ThemedText type="detail" themeColor="textSecondary" style={styles.latestLabel}>
                  Latest
                </ThemedText>
              )}
              <FormattedText
                text={layout.latest}
                type={row.kind === 'care' ? 'small' : 'detail'}
                themeColor={row.kind === 'care' ? undefined : 'textSecondary'}
              />
            </View>
          ) : null}
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

          {/* TWO QUIET LINKS (Ruth, item 15), in the style of "Export to print
              or share" above. One changes the record, the other changes the
              decision - see lib/me-card-write.ts for why the app has both. */}
          <View style={styles.links}>
            <Pressable
              onPress={() => setEditing(true)}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${row.title}`}
              hitSlop={Spacing.two}
              style={({ pressed }) => [styles.link, pressed && styles.pressed]}
            >
              <Ionicons name="create-outline" size={15} color={theme.accentDeep} />
              <ThemedText type="small" themeColor="accentDeep">
                Edit
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/',
                  params: {
                    prefill: `I would like to talk through "${row.title}".`,
                    discussId: row.id,
                    // NAMED, NOT "this entry". Since 7 October chat draws the
                    // anchor card the moment it arrives, and without a title it
                    // read "Talking about this entry" over a card that has one.
                    //
                    // 'me' WAS NOT ONE OF THE FOUR TYPES, and from 9 October to
                    // 14 October this tag was dropped on arrival: the union was
                    // food | activity | measurement | plan in three places that
                    // must agree - the server's DiscussEntryType, this app, and
                    // the chat_messages check constraint - so a Me card could
                    // be talked through but never anchored to.
                    //
                    // It was left unused on the reasoning that what was missing
                    // was a card to draw, and that is a new card rather than a
                    // repair. Ruth settled that on 14 October: "this is what
                    // replaces Claude, actually being able to pick up anywhere
                    // in chat and it knows what you're talking about." The
                    // anchor is the product; the card can follow it.
                    //
                    // A CARE RECORD SAYS SO, because the chat answers it
                    // differently: she opened it to ring somebody or fill
                    // something in, so a reference is given rather than
                    // pointed at. See loadDiscussEntryFacts.
                    discussType: row.kind === 'care' ? 'care' : 'me',
                    seedTitle: row.title,
                    // AND IT NOW SENDS. Without askNow this opened Chat and
                    // left the sentence in the composer; without the nonce the
                    // second tap did nothing at all. The prefill is already a
                    // complete sentence naming the row, so there is nothing for
                    // her to finish first.
                    askNow: '1',
                    askNonce: String(Date.now()),
                  },
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`Talk through ${row.title}`}
              hitSlop={Spacing.two}
              style={({ pressed }) => [styles.link, pressed && styles.pressed]}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={15} color={theme.accentDeep} />
              <ThemedText type="small" themeColor="accentDeep">
                Talk this through
              </ThemedText>
            </Pressable>
          </View>
        </View>
      )}

      {editing ? (
        <MeCardForm
          row={row}
          card={card}
          sections={sections}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onChanged?.();
          }}
        />
      ) : null}
    </View>
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

// EDITING THE RECORD, not the decision. Title, why, detail, status and which
// section it sits under - see lib/me-card-write.ts for why this exists beside
// "Talk this through" rather than instead of it.
//
// Rendered only while open, so its fields are plain initial state and there is
// no effect seeding them. A form whose values are filled in by a useEffect is
// how you end up looking at the last card you edited.
function MeCardForm({
  row,
  card,
  sections,
  onClose,
  onSaved,
}: {
  row: AlmanacRow;
  card: MeCard;
  sections: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const theme = useTheme();
  const [title, setTitle] = useState(row.title);
  const [why, setWhy] = useState(card.why ?? '');
  const [detail, setDetail] = useState(card.detail ?? '');
  const [status, setStatus] = useState<MeStatus | null>(card.status);
  const [section, setSection] = useState(sectionOf(row.category));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const valid = title.trim().length > 0;

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setFailed(false);
    const ok = await updateMeCard(row.id, {
      title: title.trim(),
      category: section.trim() || null,
      why: why.trim() || null,
      detail: detail.trim() || null,
      status,
    });
    setBusy(false);
    if (ok) onSaved();
    else setFailed(true);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        {/* The sheet swallows taps, so pressing inside it does not close it. */}
        <Pressable style={styles.sheetWrap} onPress={() => {}}>
          <ThemedView type="background" style={styles.sheet}>
            <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
              <ThemedText type="sectionTitle">Edit</ThemedText>

              <Field label="What it is">
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                />
              </Field>

              <Field label="Why">
                <TextInput
                  value={why}
                  onChangeText={setWhy}
                  multiline
                  style={[
                    styles.input,
                    styles.multiline,
                    { color: theme.text, backgroundColor: theme.backgroundElement },
                  ]}
                />
              </Field>

              <Field label="Anything else">
                <TextInput
                  value={detail}
                  onChangeText={setDetail}
                  multiline
                  style={[
                    styles.input,
                    styles.multiline,
                    { color: theme.text, backgroundColor: theme.backgroundElement },
                  ]}
                />
              </Field>

              <Field label="Where it stands">
                <View style={styles.chips}>
                  {ME_STATUSES.map((s) => (
                    <Chip key={s} label={s} selected={status === s} onPress={() => setStatus(s)} />
                  ))}
                  <Chip label="Not set" selected={status == null} onPress={() => setStatus(null)} />
                </View>
              </Field>

              {/* WHAT IS ALREADY THERE, not what is allowed. Sections are open
                  (principle 13), so a card can end up in one nobody listed -
                  these are the ones that exist, offered rather than enforced. */}
              <Field label="Section">
                <View style={styles.chips}>
                  {sections.map((s) => (
                    <Chip key={s} label={s} selected={section === s} onPress={() => setSection(s)} />
                  ))}
                </View>
              </Field>

              {failed ? (
                <ThemedText type="small" themeColor="danger">
                  That did not save. Nothing has changed.
                </ThemedText>
              ) : null}

              <View style={styles.sheetFoot}>
                <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cancel">
                  <ThemedText type="small" themeColor="textSecondary">
                    Cancel
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => void save()}
                  disabled={!valid || busy}
                  accessibilityRole="button"
                  accessibilityLabel="Save"
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <ThemedText type="smallBold" themeColor={valid && !busy ? 'link' : 'textSecondary'}>
                    {busy ? 'Saving...' : 'Save'}
                  </ThemedText>
                </Pressable>
              </View>
            </ScrollView>
          </ThemedView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <View
        style={[
          styles.chip,
          selected
            ? { backgroundColor: theme.accentDeep, borderColor: theme.accentDeep }
            : { borderColor: theme.backgroundSelected },
        ]}
      >
        <ThemedText type="small" style={{ color: selected ? theme.background : theme.textSecondary }}>
          {label}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Quiet, and a full-height target: it is the least important control in the
  // section and still has to be hittable with a thumb.
  closedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
    marginTop: Spacing.two,
  },
  links: { flexDirection: 'row', gap: Spacing.four, paddingTop: Spacing.two },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.three },
  sheetWrap: { width: '100%', maxWidth: 420 },
  sheet: { borderRadius: CardRadius, maxHeight: '86%', overflow: 'hidden' },
  sheetBody: { padding: Spacing.four, gap: Spacing.two },
  field: { gap: Spacing.one },
  input: {
    fontSize: 15,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: Spacing.two,
  },
  sheetFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.two,
  },
  wrap: { gap: Spacing.two },
  export: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  section: { gap: 6, paddingTop: Spacing.three },
  heading: { paddingBottom: 2, flex: 1, minWidth: 0 },
  // The heading, its chevron and its count travel together and are one target.
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  deck: { marginBottom: Spacing.two },
  // SIDE BY SIDE, WRAPPING RATHER THAN CLIPPING. Two links in one row is exactly
  // the shape that produced "Build a" and "Wee" on her phone this morning, so
  // they wrap to a second line before either one loses a letter.
  leaving: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, alignItems: 'center' },
  linkLabel: { flexShrink: 1 },
  // NO FILL AND NO RADIUS. An entry is a row on a page now, not a tile.
  card: { paddingVertical: Spacing.two, gap: Spacing.two },
  rule: { height: 1, marginBottom: Spacing.three },
  // Tucked under the section's own name: it is the fence for what goes in.
  careSubtitle: { marginTop: -4, marginBottom: Spacing.one },
  surface: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  // The title, its preview and its date travel together and take the width;
  // status and chevron sit against the right edge whatever the title does.
  naming: { flex: 1, minWidth: 0, gap: 2 },
  name: {},
  items: { gap: Spacing.two, marginTop: Spacing.one },
  item: { gap: 2 },
  itemName: { fontWeight: '600' },
  latest: { gap: 2, marginTop: Spacing.one },
  latestLabel: { textTransform: 'uppercase', letterSpacing: 0.6 },
  preview: {},
  // Right-aligned against the chevron, so a column of statuses reads down the
  // page as its own line of information.
  status: { textAlign: 'right' },
  expanded: { gap: Spacing.one },
  pressed: { opacity: 0.75 },
});
