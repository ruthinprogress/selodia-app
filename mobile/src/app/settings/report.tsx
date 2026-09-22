import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Checkbox } from '@/components/checkbox';
import { SettingsGroup, SettingsPage } from '@/components/settings-page';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, authedGet, authedPost } from '@/lib/api';
import { canPickFiles, pickFailureMessage, pickPageFiles, pickPageImages } from '@/lib/document-pages';

// BUILD A REPORT (2026-09-20), from Ruth's brief: "The PDF export should not
// feel like downloading data. It should feel like building a story for a
// specific purpose ... I'm seeing my vascular consultant. I'm visiting a
// physiotherapist."
//
// Rebuilt the same evening, because the first version offered whole sections
// and she named the fault at once: "I may want to send my allergy clinician
// only my allergy history, not my knee pain." A section is too big a unit.
//
// SO A REPORT IS A LIST OF BLOCKS, each one saying where it comes from and
// which of it. Symptoms, patterns, plans and summaries are picked ONE AT A
// TIME, because each has a title and there are few enough to read. Other
// measurements are picked by the measure's own name - waist, resting heart
// rate - which is a column the rows have always carried. Movement is picked by
// her own words for what she did. Food chooses a depth instead of rows,
// because a month of meals is not a list anybody ticks.
//
// NOTHING ON THIS SCREEN IS CHOSEN BY A MODEL. Her rule: "AI should analyse
// the selected data. AI should not decide what data is selected." Every list
// here is built from rows that exist, and every filter is a value those rows
// carry.
//
// THE SCREEN IS BUILT FROM HER DATA, NOT FROM A LIST OF FEATURES. It asks the
// server what exists before drawing anything, and only what exists appears: no
// saved plans, no Plans line. A checkbox for something somebody does not have
// is a promise the report cannot keep.
//
// WHY A BROWSER PAGE AND NOT A FILE. Making a PDF on the phone needs a native
// module, which cannot arrive in an over-the-air update. The report opens in
// the browser with a Save as PDF button, which prints the same typography to
// A4. When there is a new native build, expo-print can write the file directly
// from the same HTML.

type PickableRecord = { id: string; title: string; when: string; detail?: string | null };
type PickableValue = { value: string; count: number };

type Catalogue = {
  hasProfile: boolean;
  profileFields: PickableValue[];
  goals: number;
  bodyReadings: number;
  metrics: PickableValue[];
  symptoms: PickableRecord[];
  insights: PickableRecord[];
  plans: PickableRecord[];
  cards: PickableRecord[];
  foodDays: number;
  waterDays: number;
  sleepNights: number;
  activityTypes: PickableValue[];
};

/**
 * A DOCUMENT SHE ATTACHED, already read and named by the server.
 *
 * Ruth, 21 September 2026, deciding the photographs question outright: "No
 * photos in the app, please add a section to the report builder where
 * additional and supplementary documents can be added to the report. They will
 * need to be ai named and added to the contents as part of an appendix."
 *
 * So nothing is stored. A document is picked, read once, and held here only
 * until the report is built - and what is held is the small form, not the file.
 */
type Attachment = {
  name: string;
  kind: string;
  dated: string | null;
  lines: string[];
  image: { dataUri: string } | null;
  unreadable: string[];
};

/** Four is what fits in one request alongside a report. */
const MAX_ATTACHMENTS = 4;

type Block = {
  source: string;
  ids?: string[];
  names?: string[];
  types?: string[];
  detail?: FoodGrain;
};

// HOW MUCH FOOD TO SHOW (Ruth, 21 September 2026, from her first real use of
// the builder: "Food Logs needs to have option to have weekly and monthly
// totals"). Thirty rows of days is a log; four rows of weeks is something a
// clinician reads without turning pages.
type FoodGrain = 'entries' | 'daily' | 'weekly' | 'monthly';

const FOOD_GRAINS: { id: FoodGrain; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'entries', label: 'Every entry' },
];

// The sources whose blocks are the whole thing or nothing.
const WHOLE = ['goals', 'body', 'water', 'sleep'] as const;
// The sources picked one record at a time.
const BY_RECORD = ['symptoms', 'plans', 'insights', 'cards'] as const;
// Every name a screen may hand to `start`; anything else is ignored, so a
// stale link cannot tick something that no longer exists.
const ALL_SOURCES = [...WHOLE, ...BY_RECORD, 'food', 'metrics', 'activity'] as const;

const PERIODS: { id: string; label: string; days: number | null }[] = [
  { id: '7', label: 'Last 7 days', days: 7 },
  { id: '30', label: 'Last 30 days', days: 30 },
  { id: '90', label: 'Last 3 months', days: 90 },
  { id: '365', label: 'Last year', days: 365 },
  { id: 'all', label: 'All time', days: null },
];

function toggled(set: Set<string>, id: string) {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

// One stable empty set, so a source nobody has picked from yet does not hand
// Picker a new object on every keystroke in the note field.
const EMPTY: ReadonlySet<string> = new Set<string>();

// A picker is closed until she opens it, so nine symptoms and four plans do
// not turn the screen into a wall of boxes before she has chosen a period.
// It lives out here rather than inside the screen: a component declared during
// render is a new type each time, which unmounts and remounts every checkbox
// underneath it, and the ticks animate themselves back in from nothing.
function Picker({
  source,
  title,
  hint,
  records,
  values,
  chosen,
  showing,
  onOpen,
  onPick,
  onSetAll,
}: {
  source: string;
  title: string;
  hint: string;
  records?: PickableRecord[];
  values?: PickableValue[];
  chosen: ReadonlySet<string>;
  showing: boolean;
  onOpen: () => void;
  onPick: (source: string, id: string) => void;
  /** Every id, or null for none. One call, so the two controls share a path. */
  onSetAll: (source: string, ids: string[] | null) => void;
}) {
  const theme = useTheme();
  const everyId = records ? records.map((r) => r.id) : (values ?? []).map((v) => v.value);
  const total = everyId.length;
  if (total === 0) return null;
  return (
    <SettingsGroup title={title}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={showing ? `Hide ${title}` : `Choose from ${title}`}
        style={({ pressed }) => [styles.expander, pressed && styles.pressed]}
      >
        {/* IT SAYS WHAT WILL HAPPEN, NOT WHAT STATE IT IS IN (Ruth, 21
            September 2026: "the activity tick box is ambiguous until you know").
            It read "14 kept, none chosen", which sounds like fourteen things
            are going in - and none of them were. A builder has one job, which
            is to tell you what the document will contain before you make it. */}
        <ThemedText type="small" themeColor={chosen.size === 0 ? 'textSecondary' : 'text'}>
          {chosen.size === 0
            ? `Not included · ${total} to choose from`
            : `${chosen.size} of ${total} included`}
        </ThemedText>
        <Ionicons
          name={showing ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={theme.textSecondary}
        />
      </Pressable>

      {showing && (
        <View style={styles.boxes}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            {hint}
          </ThemedText>

          {/* ALL OR NONE, WITHOUT TAPPING EACH ONE (Ruth, 21 September 2026,
              after her first real use: "Movement needs a way to select
              all/unselect all"). It is on every picker rather than only
              Movement, because ticking fourteen symptoms one at a time is the
              same chore wearing a different label - and the picker with most
              in it is the one that actually bites. */}
          <View style={styles.allOrNone}>
            <Pressable
              onPress={() => onSetAll(source, everyId)}
              disabled={chosen.size === total}
              accessibilityRole="button"
              accessibilityLabel={`Select all in ${title}`}
              hitSlop={Spacing.two}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <ThemedText type="small" themeColor={chosen.size === total ? 'textSecondary' : 'link'}>
                Select all
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => onSetAll(source, null)}
              disabled={chosen.size === 0}
              accessibilityRole="button"
              accessibilityLabel={`Clear all in ${title}`}
              hitSlop={Spacing.two}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <ThemedText type="small" themeColor={chosen.size === 0 ? 'textSecondary' : 'link'}>
                Clear
              </ThemedText>
            </Pressable>
          </View>
          {records?.map((r) => (
            <Checkbox
              key={r.id}
              checked={chosen.has(r.id)}
              onToggle={() => onPick(source, r.id)}
              label={r.detail?.trim() ? `${r.title} — ${r.detail.trim()}` : r.title}
            />
          ))}
          {values?.map((v) => (
            <Checkbox
              key={v.value}
              checked={chosen.has(v.value)}
              onToggle={() => onPick(source, v.value)}
              // A count of zero means there is nothing to count: "Height" is a
              // fact, not a tally, and "Height - 1 entry" would be the app
              // counting something uncountable.
              label={v.count > 0 ? `${v.value} — ${v.count} ${v.count === 1 ? 'entry' : 'entries'}` : v.value}
            />
          ))}
        </View>
      )}
    </SettingsGroup>
  );
}

export default function ReportScreen() {
  const theme = useTheme();
  // ARRIVING FROM A SCREEN (see components/report-link.tsx). `start` names the
  // sources that screen was showing, so the builder opens with those chosen
  // and nothing else - a report about the thing she was just looking at. It is
  // a starting point, not a decision: every tick is hers to clear.
  const params = useLocalSearchParams<{ start?: string }>();
  const startedFrom = useMemo(
    () =>
      (params.start ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter((s) => (ALL_SOURCES as readonly string[]).includes(s)),
    [params.start]
  );

  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [period, setPeriod] = useState('90');
  const [recipient, setRecipient] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  // Whole-source choices.
  const [whole, setWhole] = useState<Set<string>>(new Set());
  const [foodDetail, setFoodDetail] = useState<FoodGrain>('daily');
  const [movementGrain, setMovementGrain] = useState<'weekly' | 'monthly'>('weekly');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [reading, setReading] = useState(false);
  // Record-by-record and value-by-value choices, keyed by source.
  const [picked, setPicked] = useState<Record<string, Set<string>>>({});
  const [open, setOpen] = useState<Set<string>>(new Set());

  // The summary step.
  const [wantSummary, setWantSummary] = useState(true);
  const [stage, setStage] = useState<'choose' | 'summary'>('choose');
  const [summary, setSummary] = useState('');
  const [dropped, setDropped] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await authedGet<Catalogue>('/api/report');
        if (cancelled) return;
        setCatalogue(data);

        if (startedFrom.length > 0) {
          // She came from a screen, so that screen is the report: its records
          // all ticked and its picker open, plus her profile so the pages have
          // a name on them. Nothing else, because she asked for this and not
          // for everything.
          const only = new Set<string>(startedFrom.filter((s) => (WHOLE as readonly string[]).includes(s) || s === 'food'));
          if (data.hasProfile) only.add('profile');
          setWhole(only);

          const start: Record<string, Set<string>> = {};
          for (const source of startedFrom) {
            if ((BY_RECORD as readonly string[]).includes(source)) {
              const rows = data[source as (typeof BY_RECORD)[number]];
              if (rows.length > 0) start[source] = new Set(rows.map((r) => r.id));
            } else if (source === 'metrics') {
              if (data.metrics.length > 0) start.metrics = new Set(data.metrics.map((m) => m.value));
            } else if (source === 'activity') {
              if (data.activityTypes.length > 0)
                start.activity = new Set(data.activityTypes.map((a) => a.value));
            }
          }
          setPicked(start);
          setOpen(new Set(Object.keys(start)));
          return;
        }

        // A SENSIBLE START, NOT A FULL ONE. The whole-source pieces begin
        // ticked because nearly every report wants them; the picked-one-by-one
        // ones begin empty, because choosing between them is the whole point.
        const start = new Set<string>();
        if (data.hasProfile) start.add('profile');
        if (data.goals > 0) start.add('goals');
        if (data.bodyReadings > 0) start.add('body');
        if (data.foodDays > 0) start.add('food');
        if (data.sleepNights > 0) start.add('sleep');
        setWhole(start);
      } catch (err) {
        if (!cancelled) {
          setFailed(
            (err instanceof ApiError && err.userMessage) ||
              'Could not see what you have stored. Check your connection.'
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [startedFrom]);

  const togglePicked = useCallback(
    (source: string, id: string) =>
      setPicked((p) => ({ ...p, [source]: toggled(p[source] ?? new Set<string>(), id) })),
    []
  );

  const setAllPicked = useCallback(
    (source: string, ids: string[] | null) =>
      setPicked((p) => ({ ...p, [source]: new Set(ids ?? []) })),
    []
  );

  const blocks = useMemo<Block[]>(() => {
    if (!catalogue) return [];
    const out: Block[] = [];
    for (const source of WHOLE) {
      if (whole.has(source)) out.push({ source });
    }
    if (whole.has('food')) out.push({ source: 'food', detail: foodDetail });
    for (const source of BY_RECORD) {
      const ids = [...(picked[source] ?? [])];
      if (ids.length > 0) out.push({ source, ids });
    }
    const names = [...(picked.metrics ?? [])];
    if (names.length > 0) out.push({ source: 'metrics', names });
    // PROFILE IS FIVE FACTS, PICKED SEPARATELY (Ruth, 21 September 2026): a
    // report to an insurer needs the name and date of birth, one to a
    // physiotherapist needs the height and has no business carrying either.
    const fields = [...(picked.profile ?? [])];
    if (fields.length > 0) out.push({ source: 'profile', names: fields });
    const types = [...(picked.activity ?? [])];
    if (types.length > 0) out.push({ source: 'activity', types, detail: movementGrain });
    return out;
  }, [catalogue, whole, foodDetail, movementGrain, picked]);

  // What the button counts: a whole section is one thing, a picked list is as
  // many things as she picked, so the number matches what she just ticked.
  const chosenCount = blocks.reduce(
    (n, b) =>
      n + Math.max(1, (b.ids?.length ?? 0) + (b.names?.length ?? 0) + (b.types?.length ?? 0)),
    0
  );

  // The same selection, sent by both steps.
  function selection() {
    const chosenPeriod = PERIODS.find((p) => p.id === period) ?? PERIODS[2];
    const to = new Date();
    // SEVEN DAYS IS SEVEN DAYS, today included. The server's range is
    // inclusive at both ends, so going a whole 7 days back made "Last 7 days"
    // cover eight - and the cover page prints the label, so the document said
    // one thing and held another.
    const from = chosenPeriod.days
      ? new Date(to.getTime() - (chosenPeriod.days - 1) * 86_400_000)
      : null;
    return {
      from: from ? from.toISOString().slice(0, 10) : null,
      to: to.toISOString().slice(0, 10),
      periodLabel: chosenPeriod.label,
      blocks,
      note: note.trim() || null,
      recipient: recipient.trim() || null,
      attachments,
    };
  }

  // ADDING A SUPPLEMENTARY DOCUMENT. Read on the server one at a time, because
  // the build request already carries a report's worth of choices and the
  // platform refuses a body much over four megabytes - the failure that lost
  // her a two-page letter this morning.
  async function addAttachment(from: 'camera' | 'library' | 'file') {
    if (reading || attachments.length >= MAX_ATTACHMENTS) return;
    setReading(true);
    setFailed(null);
    try {
      const picked = from === 'file' ? await pickPageFiles() : await pickPageImages(from);
      if (!picked.ok) {
        const msg = pickFailureMessage(picked.reason);
        if (msg) setFailed(msg);
        return;
      }

      const room = MAX_ATTACHMENTS - attachments.length;
      for (const page of picked.pages.slice(0, room)) {
        const res = await authedPost<{ attachment?: Attachment }>('/api/report/attachment', {
          base64: page.base64,
          mediaType: page.mediaType,
        });
        if (res.attachment) setAttachments((list) => [...list, res.attachment as Attachment]);
      }

      if (picked.pages.length > room) {
        setFailed(`A report can carry ${MAX_ATTACHMENTS} documents, so I have taken the first ${room}.`);
      }
    } catch (err) {
      setFailed(
        (err instanceof ApiError && err.userMessage) || 'Could not read that document. Please try again.'
      );
    } finally {
      setReading(false);
    }
  }

  // SHE READS IT BEFORE IT GOES IN (her requirement, in her words: the summary
  // is "editable or removable before sharing"). So a summary is drafted, shown,
  // and only then built into the document - or thrown away. Nothing writes a
  // paragraph under her name that she has not seen.
  async function draft() {
    if (busy || blocks.length === 0) return;
    setBusy(true);
    setFailed(null);
    try {
      const { summary: written, dropped: removed, reason } = await authedPost<{
        summary?: string | null;
        dropped?: number;
        reason?: string;
      }>('/api/report', { ...selection(), draft: true });

      if (!written) {
        // NOT ALL SILENCE IS THE SAME SILENCE. She ticked the box and waited,
        // so she is owed the reason - the first version built the report
        // without a summary and said nothing, which reads as the feature
        // simply not working.
        setFailed(
          reason === 'unreachable'
            ? 'Could not write a summary just now. The report below is ready without one.'
            : reason === 'all-figures'
              ? 'The summary came back as figures rather than description, so none of it could be used. The report is ready without one.'
              : 'There is too little here to describe in words. The report is ready without a summary.'
        );
        await build(null);
        return;
      }

      setSummary(written);
      setDropped(removed ?? 0);
      setStage('summary');
    } catch (err) {
      setFailed(
        (err instanceof ApiError && err.userMessage) ||
          'Could not write a summary just now. You can build the report without one.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function build(withSummary: string | null) {
    if (busy || blocks.length === 0) return;
    setBusy(true);
    setFailed(null);
    try {
      const { url } = await authedPost<{ url?: string }>('/api/report', {
        ...selection(),
        summary: withSummary?.trim() || null,
      });
      if (!url) throw new Error('no url');
      // The session goes nowhere near the link: the page was rendered with it
      // and stored, and this opens a plain address that expires in 15 minutes.
      await WebBrowser.openBrowserAsync(url);
      setStage('choose');
    } catch (err) {
      // The server's own sentence when it sent one - it knows which step
      // failed, and "please try again" is wrong when trying again cannot help.
      setFailed(
        (err instanceof ApiError && err.userMessage) ||
          'Could not build the report just now. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  const picker = (args: {
    source: string;
    title: string;
    hint: string;
    records?: PickableRecord[];
    values?: PickableValue[];
  }) => (
    <Picker
      {...args}
      key={args.source}
      chosen={picked[args.source] ?? EMPTY}
      showing={open.has(args.source)}
      onOpen={() => setOpen((o) => toggled(o, args.source))}
      onPick={togglePicked}
      onSetAll={setAllPicked}
    />
  );

  const nothingStored =
    catalogue !== null &&
    !catalogue.hasProfile &&
    catalogue.goals === 0 &&
    catalogue.bodyReadings === 0 &&
    catalogue.foodDays === 0 &&
    catalogue.waterDays === 0 &&
    catalogue.sleepNights === 0 &&
    catalogue.metrics.length === 0 &&
    catalogue.activityTypes.length === 0 &&
    catalogue.symptoms.length === 0 &&
    catalogue.plans.length === 0 &&
    catalogue.insights.length === 0 &&
    catalogue.cards.length === 0;

  return (
    <SettingsPage
      title="Build a report"
      subtitle="Choose exactly what goes in. What comes out is your own record, as you entered it."
      footer="Your knowledge. Your choice."
    >
      {catalogue === null ? (
        <ThemedText type="small" themeColor="textSecondary">
          {failed ?? 'Looking at what you have stored…'}
        </ThemedText>
      ) : nothingStored ? (
        <ThemedText type="small" themeColor="textSecondary">
          There is nothing logged yet to put in a report.
        </ThemedText>
      ) : stage === 'summary' ? (
        // THE DRAFT, BEFORE IT IS ANYTHING. Editable, because it is going out
        // under her name; removable, because she may want the records alone.
        <>
          <SettingsGroup title="The summary">
            <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
              Written from the pages you chose and nothing else. Read it, change anything you want,
              or leave it out. It goes at the top of the report, labelled as a summary.
            </ThemedText>
            <TextInput
              value={summary}
              onChangeText={setSummary}
              multiline
              maxLength={4000}
              style={[styles.summary, { color: theme.text, backgroundColor: theme.background }]}
              accessibilityLabel="The summary, which you can edit"
            />
            {dropped > 0 && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                {dropped === 1 ? 'One sentence was' : `${dropped} sentences were`} removed for
                stating a figure. The figures are printed above the summary, counted by the app.
              </ThemedText>
            )}
          </SettingsGroup>

          <Pressable
            onPress={() => void build(summary)}
            disabled={busy || !summary.trim()}
            accessibilityRole="button"
            accessibilityLabel="Create the PDF with this summary"
            style={({ pressed }) => pressed && styles.pressed}
          >
            <ThemedView style={[styles.build, { backgroundColor: theme.accentDeep }]}>
              <ThemedText type="smallBold" themeColor="background">
                {busy ? 'Building…' : 'Create PDF with this summary'}
              </ThemedText>
            </ThemedView>
          </Pressable>

          <Pressable
            onPress={() => void build(null)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Create the PDF without a summary"
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <ThemedText type="small" themeColor="link">
              Leave the summary out
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => setStage('choose')}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Go back and change what is included"
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <ThemedText type="small" themeColor="textSecondary">
              Change what is included
            </ThemedText>
          </Pressable>

          {failed && (
            <ThemedText type="small" themeColor="danger">
              {failed}
            </ThemedText>
          )}
        </>
      ) : (
        <>
          <SettingsGroup title="Time period">
            <View style={styles.chips}>
              {PERIODS.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => setPeriod(p.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: period === p.id }}
                  accessibilityLabel={p.label}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <ThemedView
                    type={period === p.id ? 'backgroundSelected' : 'background'}
                    style={styles.chip}
                  >
                    <ThemedText type="small">{p.label}</ThemedText>
                  </ThemedView>
                </Pressable>
              ))}
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
              This filters anything with a date. Your profile, goals and summaries are what they are
              today, so they ignore it.
            </ThemedText>
          </SettingsGroup>

          {picker({
            source: 'profile',
            title: 'About you',
            hint: 'Your name and date of birth are printed on the cover, and nowhere else. Anything you leave unticked does not appear at all.',
            values: catalogue.profileFields,
          })}

          {catalogue.goals > 0 && (
            <SettingsGroup title="What you are working towards">
              <View style={styles.boxes}>
                <Checkbox
                  checked={whole.has('goals')}
                  onToggle={() => setWhole((s) => toggled(s, 'goals'))}
                  label="Your goals, under their own heading"
                />
              </View>
            </SettingsGroup>
          )}

          {/* HER EXAMPLE, EXACTLY: the allergy history and not the knee pain,
              though both are symptoms. */}
          {picker({
            source: 'symptoms',
            title: 'Symptoms and observations',
            hint: 'Each one you choose appears in full, as you wrote it at the time.',
            records: catalogue.symptoms,
          })}

          {catalogue.bodyReadings > 0 && (
            <SettingsGroup title="Body">
              <View style={styles.boxes}>
                <Checkbox
                  checked={whole.has('body')}
                  onToggle={() => setWhole((s) => toggled(s, 'body'))}
                  label="Weight, body fat and muscle"
                />
              </View>
            </SettingsGroup>
          )}

          {/* Waist but not thigh: the measure's own name, stored on the row. */}
          {picker({
            source: 'metrics',
            title: 'Other measurements',
            hint: 'Only the measures you choose, each with every reading in the period.',
            values: catalogue.metrics,
          })}

          {(catalogue.foodDays > 0 || catalogue.waterDays > 0) && (
            <SettingsGroup title="Food and drink">
              <View style={styles.boxes}>
                {catalogue.foodDays > 0 && (
                  <Checkbox
                    checked={whole.has('food')}
                    onToggle={() => setWhole((s) => toggled(s, 'food'))}
                    label={`Food — ${catalogue.foodDays} ${catalogue.foodDays === 1 ? 'day' : 'days'} logged`}
                  />
                )}
                {/* DEPTH, NOT ROWS. A clinician asking about a reaction wants
                    every entry; one looking at a pattern wants the day's
                    totals. Neither wants to tick three hundred meals. */}
                {catalogue.foodDays > 0 && whole.has('food') && (
                  <>
                    <View style={styles.chips}>
                      {FOOD_GRAINS.map((g) => (
                        <Pressable
                          key={g.id}
                          onPress={() => setFoodDetail(g.id)}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: foodDetail === g.id }}
                          accessibilityLabel={g.label}
                          style={({ pressed }) => pressed && styles.pressed}
                        >
                          <ThemedView
                            type={foodDetail === g.id ? 'backgroundSelected' : 'background'}
                            style={styles.chip}
                          >
                            <ThemedText type="small">{g.label}</ThemedText>
                          </ThemedView>
                        </Pressable>
                      ))}
                    </View>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                      {foodDetail === 'entries'
                        ? 'Every meal as it was logged. Thorough, and long.'
                        : foodDetail === 'daily'
                          ? 'One row per day that has entries.'
                          : `One row per ${foodDetail === 'weekly' ? 'week' : 'month'}, with how many days of it were logged and the average per day logged.`}
                    </ThemedText>
                  </>
                )}
                {catalogue.waterDays > 0 && (
                  <Checkbox
                    checked={whole.has('water')}
                    onToggle={() => setWhole((s) => toggled(s, 'water'))}
                    label="Hydration — every drink and its volume, day by day"
                  />
                )}
              </View>
            </SettingsGroup>
          )}

          {/* SLEEP IS NOT FOOD OR DRINK (Ruth, 21 September 2026): "Take Sleep
              out of Food and Drink - that wierd." It was grouped there because
              all three are daily logs, which is a fact about the code and not
              about the body. */}
          {catalogue.sleepNights > 0 && (
            <SettingsGroup title="Sleep">
              <View style={styles.boxes}>
                <Checkbox
                  checked={whole.has('sleep')}
                  onToggle={() => setWhole((s) => toggled(s, 'sleep'))}
                  label="Sleep — the nights you described"
                />
              </View>
            </SettingsGroup>
          )}

          {/* Her own words for what she did, counted from her own log. */}
          {picker({
            source: 'activity',
            title: 'Movement',
            hint: 'Tick a kind of movement to put it in the report. Anything left unticked is left out, and if you tick nothing there is no movement section at all.',
            values: catalogue.activityTypes,
          })}

          {/* A LIST IS NOT A PROFILE (Ruth, 21 September 2026): "a long list is
              not helpful, needs to give a sense of the activity profile at a
              glance". Under the sessions the report draws a column per week or
              month, as tall as the minutes in it and divided by what those
              minutes were made of. This chooses how wide a column is. */}
          {(picked.activity?.size ?? 0) > 0 && (
            <SettingsGroup title="How to picture it">
              <View style={styles.chips}>
                {(['weekly', 'monthly'] as const).map((g) => (
                  <Pressable
                    key={g}
                    onPress={() => setMovementGrain(g)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: movementGrain === g }}
                    accessibilityLabel={g === 'weekly' ? 'A column per week' : 'A column per month'}
                    style={({ pressed }) => pressed && styles.pressed}
                  >
                    <ThemedView
                      type={movementGrain === g ? 'backgroundSelected' : 'background'}
                      style={styles.chip}
                    >
                      <ThemedText type="small">{g === 'weekly' ? 'By week' : 'By month'}</ThemedText>
                    </ThemedView>
                  </Pressable>
                ))}
              </View>
              <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                Under the list of sessions, a column per {movementGrain === 'weekly' ? 'week' : 'month'} showing how
                much movement it held and what kind. An empty column means nothing was recorded then.
              </ThemedText>
            </SettingsGroup>
          )}

          {picker({
            source: 'plans',
            title: 'Plans',
            hint: 'The programmes you are following, with their movements.',
            records: catalogue.plans,
          })}

          {picker({
            source: 'insights',
            title: 'Patterns noticed',
            hint: 'What has been observed holding true, in full.',
            records: catalogue.insights,
          })}

          {picker({
            source: 'cards',
            title: 'Summaries',
            hint: 'Built from your conversations and notes. Selodía holds no medical documents, scans or test results.',
            records: catalogue.cards,
          })}

          {/* WHO IT IS FOR, on the cover: "Prepared for / Dr Greenstein". Left
              empty it simply says "Health Summary", because a report kept for
              herself has no recipient and a cover that insisted on one would
              make her invent a name. */}
          <SettingsGroup title="Who is it for">
            <TextInput
              value={recipient}
              onChangeText={setRecipient}
              placeholder="A name for the cover, if it is going to someone"
              placeholderTextColor={theme.textSecondary}
              maxLength={80}
              style={[styles.oneLine, { color: theme.text, backgroundColor: theme.background }]}
              accessibilityLabel="Who the report is prepared for"
            />
          </SettingsGroup>

          {/* SUPPLEMENTARY DOCUMENTS (Ruth, 21 September 2026). Each is read
              and named when it is added, and printed into an appendix with its
              own number in the Contents. Nothing is stored: a document lives
              here until the report is built, and then only inside the report. */}
          <SettingsGroup title="Anything else to include">
            <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
              A scan report, a letter, test results. Selodía reads each one, names it, and prints it as an appendix
              with its own entry in the contents. The documents themselves are never kept.
            </ThemedText>

            {attachments.length > 0 && (
              <View style={styles.boxes}>
                {attachments.map((a, i) => (
                  <View key={`${a.name}-${i}`} style={styles.attachment}>
                    <View style={styles.attachmentText}>
                      <ThemedText type="small">{a.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {a.image ? 'Photograph' : 'PDF'}
                        {a.unreadable.length > 0 ? ' · some of it could not be read' : ''}
                      </ThemedText>
                    </View>
                    <Pressable
                      onPress={() => setAttachments((list) => list.filter((_, n) => n !== i))}
                      disabled={reading}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${a.name}`}
                      hitSlop={Spacing.two}
                      style={({ pressed }) => pressed && styles.pressed}
                    >
                      <Ionicons name="close" size={16} color={theme.textSecondary} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {attachments.length < MAX_ATTACHMENTS && (
              <View style={styles.attachActions}>
                {(
                  [
                    { from: 'camera' as const, label: 'Photograph one' },
                    { from: 'library' as const, label: 'From gallery' },
                    ...(canPickFiles() ? [{ from: 'file' as const, label: 'Choose a file' }] : []),
                  ]
                ).map((o) => (
                  <Pressable
                    key={o.from}
                    onPress={() => void addAttachment(o.from)}
                    disabled={reading}
                    accessibilityRole="button"
                    accessibilityLabel={o.label}
                    hitSlop={Spacing.two}
                    style={({ pressed }) => pressed && styles.pressed}
                  >
                    <ThemedText type="small" themeColor={reading ? 'textSecondary' : 'link'}>
                      {o.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            )}

            {reading && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                Reading it, and working out what to call it…
              </ThemedText>
            )}
          </SettingsGroup>

          <SettingsGroup title="A note, if you want one">
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Anything the reader should know first"
              placeholderTextColor={theme.textSecondary}
              multiline
              maxLength={400}
              style={[styles.note, { color: theme.text, backgroundColor: theme.background }]}
              accessibilityLabel="A note for whoever reads the report"
            />
          </SettingsGroup>

          <SettingsGroup title="A summary at the top">
            <View style={styles.boxes}>
              <Checkbox
                checked={wantSummary}
                onToggle={() => setWantSummary((v) => !v)}
                label="Write a short summary of what I chose"
              />
              <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                Read from the pages you chose and nothing else, and shown to you to change or throw
                away before anything is built. The figures in it are counted by the app, not written
                by the summary.
              </ThemedText>
            </View>
          </SettingsGroup>

          <Pressable
            onPress={() => void (wantSummary ? draft() : build(null))}
            disabled={busy || blocks.length === 0}
            accessibilityRole="button"
            accessibilityLabel="Create the PDF"
            style={({ pressed }) => pressed && styles.pressed}
          >
            <ThemedView
              type={blocks.length === 0 ? 'backgroundElement' : 'backgroundSelected'}
              style={[styles.build, blocks.length > 0 && { backgroundColor: theme.accentDeep }]}
            >
              <ThemedText
                type="smallBold"
                themeColor={blocks.length === 0 ? 'textSecondary' : 'background'}
              >
                {/* Say which of the two things is happening. Reading her pages
                    and writing a paragraph takes longer than rendering a
                    document, and "Building…" for fifteen seconds is how a
                    working app comes to look broken. */}
                {busy
                  ? wantSummary
                    ? 'Reading your pages…'
                    : 'Building…'
                  : blocks.length === 0
                    ? 'Choose something to include'
                    : `Create PDF (${chosenCount} ${chosenCount === 1 ? 'item' : 'items'})`}
              </ThemedText>
            </ThemedView>
          </Pressable>

          {failed && (
            <ThemedText type="small" themeColor="danger">
              {failed}
            </ThemedText>
          )}

          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            The report opens in your browser, where Save as PDF gives you the file. The link expires
            after fifteen minutes.
          </ThemedText>
        </>
      )}
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one, paddingVertical: Spacing.three },
  chip: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: Spacing.three },
  boxes: { gap: Spacing.two, paddingVertical: Spacing.three },
  allOrNone: { flexDirection: 'row', gap: Spacing.four, paddingBottom: Spacing.one },
  attachment: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  attachmentText: { flex: 1 },
  attachActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.four, paddingTop: Spacing.two },
  expander: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
  },
  note: {
    borderRadius: Spacing.two,
    padding: Spacing.two,
    minHeight: 72,
    marginVertical: Spacing.three,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  summary: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    minHeight: 260,
    marginVertical: Spacing.three,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  secondary: { alignItems: 'center', paddingVertical: Spacing.three },
  oneLine: {
    borderRadius: Spacing.two,
    padding: Spacing.two,
    marginVertical: Spacing.three,
    fontSize: 15,
  },
  hint: { lineHeight: 18, paddingBottom: Spacing.two },
  build: { borderRadius: Spacing.three, paddingVertical: Spacing.three, alignItems: 'center' },
  pressed: { opacity: 0.6 },
});
