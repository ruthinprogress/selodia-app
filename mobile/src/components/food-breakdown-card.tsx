import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { DeleteEntry } from '@/components/delete-entry';
import { SwipeToDelete } from '@/components/swipe-to-delete';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { pairCard, showsPair, type PairItem } from '@/lib/pair';
import { aminoProfile } from '@/lib/protein-quality';
import { removeFoodItem } from '@/lib/remove-food-item';
import { supabase } from '@/lib/supabase';
import { MACROS, macroFigure, macroLine, type MacroKey } from '@/lib/tracked-macros';
import { loadTrackedMacros } from '@/lib/tracked-macros-store';

// The "What's In Here" breakdown card (build item 13) — the READ-ONLY half of
// the discuss-card. Deliberately host-agnostic: it takes a `food_logs.id` and
// nothing else, so the same card serves today's-log rows now and any future
// host (a weekly table, a chat deep-link) without change.
//
// Follows the Detail Views template (SELODIA_SPEC.md) in order: the itemised
// content, then the macro breakdown. The template's
// other two parts are deliberately ABSENT, not forgotten:
//   - the sand-toned factual note card needs per-entry health flags, which are
//     point-in-time records (build item 29) — computing one live here would
//     contradict exactly what item 29 exists to guarantee;
//   - the sage insight card needs per-entry insight generation (items 29/30).
// The "Ask about this" button belongs to item 30 (repost-to-chat). Rendering it
// now would be a dead control — the thing principle 8 forbids — so it arrives
// with the behaviour behind it.

type FoodLog = {
  meal_label: string | null;
  raw_text: string | null;
  // Not shown on this card. Read so the chat card it hands off to can head
  // itself with the right date from the first frame.
  happened_at: string | null;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  saturated_fat_g: number | null;
  sugar_g: number | null;
  fibre_g: number | null;
  sodium_mg: number | null;
  breakdown_type: string | null;
  protein_source: string | null;
};

type FoodItem = {
  id: string;
  name: string;
  quantity: string | null;
  kcal: number | null;
  protein_g: number | null;
  protein_source: string | null;
  // Read since 30 September for Pair. protein_source cannot express
  // complementarity - only which acid is short can, and that is this column.
  amino_profile: string | null;
};

const g = (n: number | null): string => (n == null ? '—' : `${Math.round(n)}g`);
const kcal = (n: number | null): string => (n == null ? '—' : `${Math.round(n)} kcal`);

// The screen reader's actions menu for one item. `label` is what it reads out,
// so it says what goes rather than naming a gesture nobody using it can make.
const ITEM_ACTIONS = [{ name: 'delete', label: 'Delete item' }];

// macroValue() went with the grid on 4 October 2026: it returned the row's own
// wording, which repeats the macro's name, and the card now has a heading doing
// that job. See macroFigure in lib/tracked-macros.ts.

export function FoodBreakdownCard({
  foodLogId,
  onClose,
  onDeleted,
  onChanged,
}: {
  foodLogId: string | null;
  onClose: () => void;
  // Called instead of onClose when the meal was removed, so the log behind this
  // card re-reads rather than keeping a row that is no longer in the database.
  onDeleted?: () => void;
  // Called when the meal still exists but its figures have moved - removing one
  // item (2026-09-30). The card stays open; the log BEHIND it is stale from the
  // moment the item goes, because the day's line and the week's average are
  // read from food_logs.
  onChanged?: () => void;
}) {
  const theme = useTheme();
  const [log, setLog] = useState<FoodLog | null>(null);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [tracked, setTracked] = useState<MacroKey[]>([]);
  // Bumped when this card changes the meal, so the read below runs again and
  // the macro grid shows the figures the database now holds rather than the
  // ones it held when the card opened.
  const [reloadKey, setReloadKey] = useState(0);
  // Pair (Ruth's brief, 30 September). `avoid` is what she has told the app she
  // cannot or will not eat: a suggestion she cannot act on is worse than none,
  // because this feature works by repetition.
  const [avoid, setAvoid] = useState<string[]>([]);
  const [pairFor, setPairFor] = useState<FoodItem | null>(null);

  useEffect(() => {
    if (!foodLogId) return;
    let cancelled = false;
    (async () => {
      // RLS scopes both reads to the signed-in user.
      const [{ data: logRow }, { data: itemRows }] = await Promise.all([
        supabase
          .from('food_logs')
          .select(
            // happened_at is not displayed on this card - it is read so the
            // chat card it hands off to can head itself with the right date
            // immediately rather than waiting for its own lookup.
            'meal_label, raw_text, happened_at, kcal, protein_g, carbs_g, fat_g, saturated_fat_g, sugar_g, fibre_g, sodium_mg, breakdown_type, protein_source'
          )
          .eq('id', foodLogId)
          .maybeSingle(),
        supabase
          .from('food_items')
          .select('id, name, quantity, kcal, protein_g, protein_source, amino_profile')
          .eq('food_log_id', foodLogId)
          .order('created_at', { ascending: true }),
      ]);
      if (cancelled) return;
      setLog((logRow ?? null) as FoodLog | null);
      setItems((itemRows ?? []) as FoodItem[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [foodLogId, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.from('allergies').select('name');
      if (!cancelled) setAvoid(((data ?? []) as { name: string }[]).map((a) => a.name));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const keys = await loadTrackedMacros();
      if (!cancelled) setTracked(keys);
    })();
    return () => {
      cancelled = true;
    };
  }, [foodLogId]);

  // ONE REMOVAL, TWO WAYS IN. The swipe and the screen reader's own delete
  // action both come through here, so there is a single place where an item
  // leaves - not two that can drift apart about whether the card reloads.
  async function removeItem(id: string) {
    await removeFoodItem(id);
    // The meal's own totals have changed, so the card re-reads rather than
    // splicing the row out of state: the header figures above are the whole
    // point of doing the removal in the database.
    setItems((rows) => rows.filter((r) => r.id !== id));
    setReloadKey((k) => k + 1);
    onChanged?.();
  }

  // Two real cases produce no rows in food_items, and neither is an error:
  //   - a 'simple' log (an apple, a branded yoghurt) is never itemised by design;
  //   - a log predating item 11 was written before food_items existed.
  // Both fall back to the log's own description and macros, so the card always
  // says something true rather than showing an empty ingredient list.
  const hasItems = items.length > 0;

  // The macros she has switched on, in the order they appear everywhere else.
  const shownMacros = MACROS.filter((m) => tracked.includes(m.key));

  // ONE ROUTE INTO THE CONVERSATION, TWO OPENING LINES.
  //
  // "Ask about this" and tapping the entry both end up in Chat with this log
  // tagged, because in this app changing an entry IS a conversation: say what
  // it really was and the parse rewrites the row (see app/lib/food-logging.ts).
  // What differs is the sentence already in the box - a question, or a
  // correction - so a person who tapped to fix a mistake does not have to work
  // out how to phrase it.
  // `item` names ONE thing inside the meal (2026-09-30). Tapping the meal's
  // header opens "My <meal> log should say "; tapping one item opens "In my
  // <meal> log, the <item> should say ", so a correction to one line does not
  // arrive as a correction to the whole entry.
  function openInChat(mode: 'ask' | 'correct', item?: string) {
    if (!log) return;
    const label = log.raw_text ?? log.meal_label ?? 'this entry';
    onClose();
    router.push({
      pathname: '/',
      params: {
        prefill:
          mode === 'ask'
            ? `About my "${label}" log: `
            : item
              ? `In my "${label}" log, the "${item}" should say `
              : `My "${label}" log should say `,
        discussId: foodLogId ?? '',
        discussType: 'food',
        // The entry's own words, date and totals, already loaded into this
        // sheet and now handed across so the chat card draws immediately
        // instead of after two reads. The live read still overwrites all of it.
        seedTitle: label,
        seedWhen: log.happened_at ?? '',
        seedKcal: log.kcal != null ? String(log.kcal) : '',
        seedProtein: log.protein_g != null ? String(log.protein_g) : '',
        // WITHOUT THIS THE BUTTON ONLY FILLS THE BOX (2026-09-16). Chat
        // auto-sends only on askNow === '1', and not one of the three cards was
        // sending it - so "Ask about this" opened Chat, dropped a half-sentence
        // into the composer and stopped. Ruth, three times: "nothing happens at
        // all". The flag is what makes the name true.
        //
        // A CORRECTION MUST NOT AUTO-SEND. "My ... log should say " is half a
        // sentence SHE has to finish; sending it would ask the model to guess
        // what she meant to change.
        askNow: mode === 'ask' ? '1' : '',
        // One navigation, one nonce. Without it a second "Ask about this" on the
        // same entry did nothing, because the guard was keyed on the text.
        askNonce: String(Date.now()),
      },
    });
  }

  return (
    <Modal
      visible={foodLogId != null}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      {/* A MODAL IS A SECOND WINDOW, AND GESTURES DO NOT REACH IT (2026-09-30).
          Ruth, on the per-item swipe built an hour earlier: "the swipe left to
          delete is not working. No swipe at all there."

          react-native-gesture-handler needs a GestureHandlerRootView above any
          gesture, and the app has exactly one, in app/_layout.tsx. On Android a
          <Modal> is rendered into its OWN native window, outside that root, so
          every gesture inside this card was being handled by nobody. Nothing
          throws and nothing logs; the swipe simply does not move.

          WHICH MEANS THE MEAL-HEADER SWIPE NEVER WORKED EITHER. It was built on
          24 September, documented in this file as working, and has been inside
          this modal the whole time. It is not that the new item rows broke it -
          it is that this card has never had a working gesture and nobody swiped
          the header to find out.

          One root per modal window, and the check that enforces it is
          scripts/check-gestures-in-modals.mjs. */}
      <GestureHandlerRootView style={styles.gestureRoot}>
      {/* Tapping the dimmed backdrop dismisses; the card itself swallows the tap. */}
      <Pressable
        style={[styles.backdrop, { backgroundColor: theme.scrim }]}
        onPress={onClose}
        accessibilityLabel="Close"
      >
        <Pressable style={styles.cardWrap} onPress={() => {}}>
          <ThemedView style={styles.card}>
            {/* `!log` RATHER THAN A LOADING FLAG (2026-09-30). The card now
                re-reads itself after an item is removed, and a flag that is
                true for that round trip blanks the whole card to an ellipsis,
                which makes a delete look like a crash. There is no first-load
                case this loses: until the first read lands there is no log
                either, so the ellipsis still shows. */}
            {!log ? (
              <ThemedText type="small" themeColor="textSecondary">
                …
              </ThemedText>
            ) : (
              <ScrollView contentContainerStyle={styles.scroll}>
                {/* THE ENTRY ITSELF, AND EVERY ACTION ON IT (Ruth, 24 September
                    2026): "Tap a food row -> opens detail view for that entry.
                    Inside detail view -> swipe left on the row to delete the
                    whole entry. Tap to edit or discuss."

                    Swipe uncovers a Delete rather than firing on the gesture -
                    see swipe-to-delete.tsx. Tap opens the conversation with
                    this entry named, which is where correcting a log has always
                    happened: say what it really was and the parse rewrites the
                    row. No editor was built, because there is already a way to
                    change an entry and a second one would be a second set of
                    rules about the same data. */}
                <SwipeToDelete
                  table="food_logs"
                  id={foodLogId ?? ''}
                  what={log.raw_text ?? log.meal_label ?? 'this entry'}
                  onDeleted={onDeleted ?? onClose}
                >
                  <Pressable
                    onPress={() => openInChat('correct')}
                    accessibilityRole="button"
                    accessibilityLabel={`${log.raw_text ?? log.meal_label ?? 'This entry'}. Tap to change it or ask about it.`}
                    style={({ pressed }) => pressed && styles.pressed}
                  >
                    <View style={styles.headerRow}>
                      <ThemedText type="smallBold" style={styles.title}>
                        {/* Her words first, the inferred category only if there
                            are none - see entryLabel for why (2026-09-16). */}
                        {log.raw_text ?? log.meal_label ?? 'This entry'}
                      </ThemedText>
                    </View>
                  </Pressable>
                </SwipeToDelete>

                {hasItems ? (
                  <View style={styles.section}>
                    {/* EVERY ITEM IS NOW A CONTROL (Ruth, 30 September 2026,
                        item 2d): "per-item swipe delete and edit on the food
                        item view; keep Delete this meal."

                        SWIPE removes that one item and takes its figures off
                        the meal in the same transaction - see
                        lib/remove-food-item.ts, and the migration for why it
                        subtracts rather than re-adding up what is left.

                        TAP is the edit, and it is the same edit the whole
                        entry has always had: the conversation, with this item
                        named in the box. No second editor, because a second way
                        to change a figure is a second set of rules about the
                        same data - the card has carried that decision since it
                        was built and one item does not overturn it.

                        NO VISIBLE BUTTON PER ITEM, which breaks this app's own
                        rule that a gesture always has a button beside it
                        (swipe-to-delete.tsx: "a hidden gesture is a control
                        that only some people ever find"). Five bins down the
                        side of a five-item meal is a different screen, and the
                        thing the rule protects - a way through for somebody who
                        never swipes - is the tap, which reaches the same
                        change by conversation. "Delete this meal" is still at
                        the bottom, visible, where it has always been. */}
                    {items.map((it) => {
                      // PAIR (Ruth's brief, 30 September 2026). Shown only when
                      // nothing else on the plate has already closed the gap -
                      // see lib/pair.ts for why that suppression is the whole
                      // feature rather than a refinement of it.
                      const flag = showsPair(asPair(it), items.map(asPair), avoid) ? 'Pair' : null;
                      const named = `${it.name}${it.quantity ? ` ${it.quantity}` : ''}`;
                      return (
                        <SwipeToDelete
                          key={it.id}
                          what={named}
                          onDelete={() => removeItem(it.id)}
                        >
                          <Pressable
                            onPress={() => openInChat('correct', named)}
                            accessibilityRole="button"
                            accessibilityLabel={`${named}. Tap to change it, swipe left to remove it.`}
                            // A SWIPE IS NOT REACHABLE BY A SCREEN READER, and
                            // her decision (30 September) was to keep the
                            // gesture and no visible bins, so this is the only
                            // route left for anybody using TalkBack or
                            // VoiceOver. An accessibilityAction shows up in the
                            // reader's own actions menu, which is where someone
                            // using one looks for exactly this.
                            accessibilityActions={ITEM_ACTIONS}
                            onAccessibilityAction={(e) => {
                              if (e.nativeEvent.actionName === 'delete') {
                                void removeItem(it.id);
                              }
                            }}
                            style={({ pressed }) => [styles.itemRow, pressed && styles.pressed]}
                          >
                            <View style={styles.itemName}>
                              {/* ONE LINE, ELLIPSISED (1 October 2026). Ruth's
                                  card showed "e 1 cup" where "Black coffee 1
                                  cup" should be: the row slides 64px left to
                                  uncover the bin, the name goes under the
                                  card's edge, and what is left is the tail of a
                                  word broken mid-way.

                                  swipe-to-delete.tsx carries this same fault
                                  from 25 September, when she saw "care
                                  Routine" - and its fix was to stop the WRAPPER
                                  clipping. Here the clipping is the card's own
                                  edge, which is correct behaviour for a sliding
                                  row, so the fix is the other end: a name that
                                  cannot wrap cannot be cut mid-word, and an
                                  ellipsis says plainly that there is more. */}
                              <ThemedText
                                type="small"
                                numberOfLines={1}
                                ellipsizeMode="tail"
                                style={styles.itemLabel}
                              >
                                {named}
                              </ThemedText>
                              {/* Per-item protein flag (item 12's other half): collagen
                                  reads "incomplete", plant reads "pair it", animal and
                                  unclassified read nothing at all. */}
                              {flag && (
                                <Pressable
                                  onPress={() => setPairFor(it)}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Pair ${it.name} with something`}
                                  hitSlop={Spacing.two}
                                >
                                  <ThemedText
                                    type="small"
                                    themeColor="textSecondary"
                                    style={styles.flag}
                                  >
                                    {flag}
                                  </ThemedText>
                                </Pressable>
                              )}
                            </View>
                            <ThemedText type="small" themeColor="textSecondary">
                              {kcal(it.kcal)}
                              {it.protein_g != null ? ` · ${g(it.protein_g)}` : ''}
                            </ThemedText>
                          </Pressable>
                        </SwipeToDelete>
                      );
                    })}
                  </View>
                ) : (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.section}>
                    {log.raw_text
                      ? `Logged as “${log.raw_text}”.`
                      : 'Logged as a single item.'}
                  </ThemedText>
                )}

                {/* THE SAME FIGURES THE ROW SHOWS (24 September 2026). This
                    grid was a fixed four - calories, protein, carbs, fat -
                    which meant the detail view disagreed with the list above it
                    for anybody who had switched carbs off or fibre on. */}
                {/* ONE ROW OF NAMES, ONE ROW OF FIGURES (Ruth, 4 October 2026).
                    "The addition of the other nutrients has garbled the close up
                    views. Please change the format for this so all nutrients go in
                    one row and the readings in a second row. Please make sure it
                    is clear but calm."

                    It was eight columns at flex: 1, so on a phone each was about
                    forty pixels and "Saturated fat" wrapped one letter at a time -
                    and every figure repeated its own name underneath, because `say`
                    is written for a row where nothing else names it. Two faults
                    compounding in the same small box.

                    CALM MEANS THE FIGURES CARRY THE WEIGHT. The names are small and
                    quiet above them; nothing is boxed, ruled or coloured. It scrolls
                    sideways rather than shrinking, so eight macros at a large system
                    font size stay readable instead of becoming a puzzle. */}
                <ThemedView type="backgroundElement" style={styles.macros}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.macroScroll}>
                    <View>
                      <View style={styles.macroRow}>
                        {shownMacros.map((m) => (
                          <ThemedText
                            key={m.key}
                            type="small"
                            themeColor="textSecondary"
                            numberOfLines={1}
                            style={styles.macroHead}>
                            {m.short}
                          </ThemedText>
                        ))}
                      </View>
                      <View style={styles.macroRow}>
                        {shownMacros.map((m) => (
                          <ThemedText
                            key={m.key}
                            type="smallBold"
                            numberOfLines={1}
                            style={styles.macroHead}>
                            {macroFigure(m.key, log as unknown as Record<string, unknown>) ?? '—'}
                          </ThemedText>
                        ))}
                      </View>
                    </View>
                  </ScrollView>
                </ThemedView>

                {/* ASK ABOUT THIS (build item 30's interactive half), built
                    2026-09-16 on Ruth's ask: "select them to discuss further in
                    chat". It was held back on this card, the reading card and
                    the Almanac's exercise detail because a control with nothing
                    behind it is what principle 8 forbids. There is something
                    behind it now: the entry's id and type ride to Chat, and
                    ask-selodia tags the turn with them, which is what makes a
                    single entry's Q&A findable in a scrolled thread later.

                    NOT the card image. Item 30 also describes posting a picture
                    of this card into the thread; that needs a view capture
                    library nobody has installed, so it stays unbuilt rather than
                    half-built. The hand-off carries the entry's name in the
                    composer, which is what makes the question answerable. */}
                <Pressable
                  onPress={() => openInChat('ask')}
                  accessibilityLabel="Ask about this"
                  hitSlop={Spacing.two}
                  style={({ pressed }) => [styles.ask, pressed && styles.pressed]}
                >
                  <ThemedText type="smallBold" themeColor="accentDeep">
                    Ask about this
                  </ThemedText>
                </Pressable>

                {/* Removing an entry lives with the entry (2026-09-18). Last,
                    and quiet: it is the one thing here that cannot be undone. */}
                {foodLogId && (
                  <DeleteEntry
                    table="food_logs"
                    id={foodLogId}
                    what="this meal"
                    onDeleted={onDeleted ?? onClose}
                  />
                )}
              </ScrollView>
            )}
          </ThemedView>

          {/* PAIR THIS WITH... - an inline sheet, NOT a second <Modal>.
              Nesting modals on Android is exactly the class of thing that cost
              today: this card's own gestures were dead for six days because a
              Modal is its own window. An absolutely positioned panel inside the
              card cannot have that problem, and looks the same. */}
          {pairFor ? <PairSheet item={pairFor} avoid={avoid} onClose={() => setPairFor(null)} /> : null}
        </Pressable>
      </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
}

// food_items rows as pair.ts wants them. amino_profile is validated rather than
// cast: a stray value degrades to "we don't know", which shows no label, which
// is the safe direction.
function asPair(it: FoodItem): PairItem {
  return {
    name: `${it.name}${it.quantity ? ` ${it.quantity}` : ''}`,
    proteinG: it.protein_g,
    aminoProfile: aminoProfile(it.amino_profile),
  };
}

/**
 * The card behind the word. Her brief: "No scrolling. No articles. No long
 * explanations. Users should be able to dismiss it in seconds."
 *
 * It does NOT open chat, which she said twice. This is a footnote somebody
 * read, not a conversation they started.
 */
function PairSheet({
  item,
  avoid,
  onClose,
}: {
  item: FoodItem;
  avoid: string[];
  onClose: () => void;
}) {
  const card = pairCard(asPair(item), avoid);
  if (!card) return null;
  return (
    <Pressable style={styles.pairBackdrop} onPress={onClose} accessibilityLabel="Close">
      <ThemedView type="background" style={styles.pairSheet}>
        <ThemedText type="smallBold">Pair this with…</ThemedText>
        <View style={styles.pairList}>
          {card.suggestions.map((s) => (
            <ThemedText key={s} type="small">
              {s}
            </ThemedText>
          ))}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {card.explanation}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {card.sameMealNote}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

// The one-column-per-macro Macro() that used to live here is gone with the grid
// it was written for (4 October 2026). It stacked a full label over a value that
// repeated the label, in a column sized by flex: 1 - fine at four macros, and
// unreadable at eight. The card now draws two rows directly.

const styles = StyleSheet.create({
  // The gesture root must fill the modal window, or the backdrop inside it has
  // no height and the card lands at the top of the screen.
  gestureRoot: { flex: 1 },
  backdrop: {
    flex: 1,
    // Colour comes from theme.scrim at render; only the geometry lives here.
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.three,
  },
  cardWrap: {
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    maxHeight: '100%',
  },
  scroll: {
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
  },
  section: {
    gap: Spacing.two,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  itemName: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    // NO LONGER WRAPS. A wrapped name is what produced "e 1 cup" once the row
    // slid left; the label below shrinks and ellipsises instead.
  },
  itemLabel: {
    flexShrink: 1,
  },
  flag: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  macros: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
  },
  macroScroll: {
    paddingHorizontal: Spacing.one,
  },
  macroRow: {
    flexDirection: 'row',
  },
  // A FIXED COLUMN, NOT flex: 1. Equal shares of a phone's width is what put
  // forty pixels under "Saturated fat"; a column wide enough for its own
  // heading, with the row scrolling when there are too many, keeps every one of
  // them readable at any font size.
  macroHead: {
    minWidth: 62,
    paddingRight: Spacing.two,
    paddingVertical: 2,
    fontVariant: ['tabular-nums'],
  },
  macroLabel: {
    fontSize: 11,
  },
  // Aligned with the card's content rather than centred: it is an offer, not a
  // call to action, and a full-width button here would read as the point of the
  // card rather than a way on from it.
  ask: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  pressed: {
    opacity: 0.6,
  },
  // Covers the card so a tap anywhere dismisses, which is what "dismiss it in
  // seconds" needs. Not a scrim: the card underneath stays readable, because
  // the whole point is the ingredient it is about.
  pairBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  pairSheet: {
    borderTopLeftRadius: Spacing.three,
    borderTopRightRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  pairList: {
    gap: Spacing.half,
  },
});
