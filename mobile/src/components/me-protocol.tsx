import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ReorderableRows } from '@/components/reorderable-rows';
import { SwipeToDelete } from '@/components/swipe-to-delete';
import { expandedLayout } from '@/lib/entry-layout';
import { itemsOf } from '@/lib/me-items';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authedPost } from '@/lib/api';
import type { AlmanacRow } from '@/lib/insights';
import { CARE_EMPTY, CARE_PARENT_SECTION, CARE_SECTION, CARE_SUBTITLE } from '@/lib/care-admin';
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
  onDeleted,
  onChanged,
}: {
  entries: AlmanacRow[];
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
    // HOW I ACCESS CARE IS A GROUP INSIDE HEALTH, NOT A SECTION BESIDE IT.
    //
    // Ruth, 6 October 2026: "Bit there's health already in Me, so how would this
    // go, just Care underneath it?" It goes underneath it. Care rows are held
    // back here and rendered below the Health rows, under their own quiet
    // heading, so her list gains a group rather than a heading.
    //
    // AND THE SECTION EXISTS AS SOON AS A CARE ROW DOES, even with no Health
    // card of its own, or the records would be filed somewhere she cannot open.
    const care: AlmanacRow[] = [];
    for (const entry of entries) {
      const name = sectionOf(entry.category);
      if (name === CARE_SECTION) {
        care.push(entry);
        if (!map.has(CARE_PARENT_SECTION)) map.set(CARE_PARENT_SECTION, []);
        continue;
      }
      const list = map.get(name) ?? [];
      list.push(entry);
      map.set(name, list);
    }
    return orderSections([...map.keys()]).map((name) => ({
      name,
      rows: map.get(name) ?? [],
      care: name === CARE_PARENT_SECTION ? care : [],
    }));
  }, [entries]);

  // The sections that exist, offered when moving a card. Sections are open
  // (principle 13), so the editor also lets one be typed - this is what is
  // already there, not what is allowed.
  const sectionNames = useMemo(
    () => orderSections([...new Set([...SECTION_ORDER, ...sections.map((s) => s.name)])]),
    [sections]
  );

  // HER ORDER, NOT THE APP'S (item 6: "Sections are reorderable like the rest
  // of the app"). Same store and same component as the Log, Cycle and Plans
  // lists - a fourth way of arranging a list would be a fourth place for the
  // next arranging bug to live. The ids here are section NAMES, which the
  // store's rules already cover: see log-layout.ts.
  const [layout, setLayout] = useState<LogLayout>({ order: [], hidden: [] });
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

  const keep = useCallback((next: { id: string }[]) => {
    const order = next.map((n) => n.id);
    setLayout({ order, hidden: [] });
    void saveLayout('me_layout', layoutOf(order, []));
  }, []);

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
      <Pressable
        onPress={() => void exportProtocol()}
        disabled={exporting}
        accessibilityRole="button"
        accessibilityLabel="Export your Me tab as a page you can print or share"
        hitSlop={Spacing.two}
        style={({ pressed }) => [styles.export, pressed && styles.pressed]}
      >
        <Ionicons name="share-outline" size={16} color={theme.accentDeep} />
        <ThemedText type="small" themeColor="accentDeep">
          {exporting ? 'Preparing\u2026' : 'Export to print or share'}
        </ThemedText>
      </Pressable>
      {exportFailed && (
        <ThemedText type="detail" themeColor="textSecondary">
          That didn&apos;t open. Try again in a moment.
        </ThemedText>
      )}

      <ReorderableRows
        items={ordered}
        onReorder={keep}
        renderRow={(section, i) => (
        <View key={section.name} style={styles.section}>
          {/* A THIN RULE BETWEEN SECTIONS, NOT AROUND EACH CARD (item 6:
              "Cormorant headings with thin dividers between sections, no cards
              or pills"). One line per boundary rather than a border per entry
              is the whole difference between a record and a list of widgets -
              and it is the same move Today made when its cards became rows. */}
          {i > 0 ? (
            <View style={[styles.rule, { backgroundColor: theme.backgroundSelected }]} />
          ) : null}
          <ThemedText type="display" style={styles.heading}>
            {section.name}
          </ThemedText>
          {/* SWIPE TO DELETE, AS EVERYWHERE ELSE (Ruth, 25 September 2026,
              item 6). A protocol card is a decision somebody made about how
              they live, and decisions get reversed: a supplement stopped for
              good, a routine that never became one. Pausing is already in the
              card's own history and says something different - still part of
              the record, no longer part of the routine - so this is for the
              entries that should not be in the record at all.
              It reveals a Delete rather than firing on the swipe; see
              swipe-to-delete.tsx. */}
          {section.rows.map((row) => (
            <SwipeToDelete
              key={row.id}
              table="almanac_entries"
              id={row.id}
              what={row.title}
              onDeleted={onDeleted}
            >
              <MeCardRow row={row} sections={sectionNames} onChanged={onChanged} />
            </SwipeToDelete>
          ))}
          {/* THE PAPERWORK, UNDER THE SAME SECTION AND BELOW A QUIET RULE.
              A smaller heading than the section's, because this is a group
              inside it rather than a rival to it, and the line underneath
              carries the boundary the heading stopped carrying when "Care
              Admin" became "How I Access Care": letters, numbers, references,
              emails. See lib/care-admin.ts for why both names were needed. */}
          {section.care.length > 0 || section.name === CARE_PARENT_SECTION ? (
            <View style={styles.careGroup}>
              <View style={[styles.careRule, { backgroundColor: theme.backgroundSelected }]} />
              <ThemedText type="subtitle">{CARE_SECTION}</ThemedText>
              <ThemedText type="detail" themeColor="textSecondary" style={styles.careSubtitle}>
                {CARE_SUBTITLE}
              </ThemedText>
              {section.care.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {CARE_EMPTY}
                </ThemedText>
              ) : (
                section.care.map((row) => (
                  <SwipeToDelete
                    key={row.id}
                    table="almanac_entries"
                    id={row.id}
                    what={row.title}
                    onDeleted={onDeleted}
                  >
                    <MeCardRow row={row} sections={sectionNames} onChanged={onChanged} />
                  </SwipeToDelete>
                ))
              )}
            </View>
          ) : null}
        </View>
        )}
      />
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
  const theme = useTheme();
  const [open, setOpen] = useState(false);
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
  const togglable = card.status === 'Active' || card.status === 'Paused';
  const toggle = async () => {
    if (busy || !togglable) return;
    setBusy(true);
    const next = card.status === 'Active' ? 'Paused' : 'Active';
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
        {card.status &&
          (togglable ? (
            <Pressable
              onPress={() => void toggle()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={
                card.status === 'Active' ? `Pause ${row.title}` : `Make ${row.title} active again`
              }
              hitSlop={Spacing.two}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <ThemedText type="detail" style={styles.status}>
                {busy ? '\u2026' : card.status}
              </ThemedText>
            </Pressable>
          ) : (
            <ThemedText
              type="detail"
              themeColor={card.status === 'Paused' ? 'textSecondary' : 'text'}
              style={styles.status}
            >
              {card.status}
            </ThemedText>
          ))}
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
          {/* THE BODY, ONCE. See lib/entry-layout.ts: the decision about
              whether `detail` is saying anything new is a judgement, so it
              lives in a function that can be tested rather than in this
              render. */}
          {layout.body ? <ThemedText type="detail">{layout.body}</ThemedText> : null}

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
          {layout.latest ? (
            <View style={styles.latest}>
              <ThemedText type="detail" themeColor="textSecondary" style={styles.latestLabel}>
                Latest
              </ThemedText>
              <ThemedText type="detail" themeColor="textSecondary">
                {layout.latest}
              </ThemedText>
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
  heading: { paddingBottom: 2 },
  // NO FILL AND NO RADIUS. An entry is a row on a page now, not a tile.
  card: { paddingVertical: Spacing.two, gap: Spacing.two },
  rule: { height: 1, marginBottom: Spacing.three },
  // Inside a section, so it is indented from the cards above it and the
  // rule is shorter and quieter than the one between sections.
  careGroup: { gap: 6, paddingTop: Spacing.two },
  careRule: { height: 1, width: 48, marginBottom: Spacing.two },
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
