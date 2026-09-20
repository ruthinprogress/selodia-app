import Ionicons from '@expo/vector-icons/Ionicons';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Checkbox } from '@/components/checkbox';
import { SettingsGroup, SettingsPage } from '@/components/settings-page';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authedGet, authedPost } from '@/lib/api';

// BUILD A REPORT (2026-09-20), from Ruth's brief: "The PDF export should not
// feel like downloading data. It should feel like building a story for a
// specific purpose ... I'm seeing my vascular consultant. I'm visiting a
// physiotherapist."
//
// THE SCREEN IS BUILT FROM HER DATA, NOT FROM A LIST OF FEATURES. It asks the
// server what exists before drawing anything, and only what exists appears:
// no saved plans, no Plans line; no summaries, no Summaries line. "Don't
// invent one" is her instruction and it is also the app's rule - a checkbox
// for something somebody does not have is a promise the report cannot keep.
//
// Summaries are chosen ONE BY ONE, because that is the point: a physio does
// not need the cholesterol card, and a consultant does not need the skincare
// routine.
//
// WHY A BROWSER PAGE AND NOT A FILE. Making a PDF on the phone needs a native
// module, which cannot arrive in an over-the-air update. The report opens in
// the browser with a Save as PDF button, which prints the same typography to
// A4. When there is a new native build, expo-print can write the file directly
// from the same HTML.

type Availability = {
  sections: { section: string; count: number }[];
  cards: { id: string; title: string; kind: string; category: string | null; updated: string }[];
};

const LABELS: Record<string, { label: string; detail: string }> = {
  profile: { label: 'Profile', detail: 'Your current details' },
  goals: { label: 'Goals', detail: 'What you are working towards' },
  body: { label: 'Body measurements', detail: 'Weight, body fat, muscle' },
  measurements: { label: 'Other measurements', detail: 'Waist, resting heart rate and the rest' },
  symptoms: { label: 'Symptoms and observations', detail: 'Noted at the time' },
  food: { label: 'Nutrition', detail: 'Daily totals from your food log' },
  water: { label: 'Drinks', detail: 'What you logged, day by day' },
  activity: { label: 'Movement', detail: 'Sessions, duration and intensity' },
  plans: { label: 'Current plans', detail: 'The programmes you are following' },
  insights: { label: 'Patterns noticed', detail: 'What Selodía has observed holding true' },
};

const PERIODS: { id: string; label: string; days: number | null }[] = [
  { id: '7', label: 'Last 7 days', days: 7 },
  { id: '30', label: 'Last 30 days', days: 30 },
  { id: '90', label: 'Last 3 months', days: 90 },
  { id: '365', label: 'Last year', days: 365 },
  { id: 'all', label: 'All time', days: null },
];

export default function ReportScreen() {
  const theme = useTheme();
  const [available, setAvailable] = useState<Availability | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [cards, setCards] = useState<Set<string>>(new Set());
  const [period, setPeriod] = useState('90');
  const [note, setNote] = useState('');
  const [showCards, setShowCards] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await authedGet<Availability>('/api/report');
        if (cancelled) return;
        setAvailable(data);
        // Everything that exists starts ticked EXCEPT the summaries, which are
        // the ones worth a deliberate choice.
        setChosen(new Set(data.sections.map((s) => s.section).filter((s) => s !== 'cards')));
      } catch {
        if (!cancelled) setFailed('Could not see what you have stored. Check your connection.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(id: string, set: Set<string>, apply: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    apply(next);
  }

  const chosenCount = chosen.size - (chosen.has('cards') ? 1 : 0) + cards.size;

  async function build() {
    if (busy || chosenCount === 0) return;
    setBusy(true);
    setFailed(null);
    try {
      const chosenPeriod = PERIODS.find((p) => p.id === period) ?? PERIODS[2];
      const to = new Date();
      const from = chosenPeriod.days
        ? new Date(to.getTime() - chosenPeriod.days * 86_400_000)
        : null;
      const sections = [...chosen];
      if (cards.size > 0 && !sections.includes('cards')) sections.push('cards');

      const { url } = await authedPost<{ url?: string }>('/api/report', {
        from: from ? from.toISOString().slice(0, 10) : null,
        to: to.toISOString().slice(0, 10),
        periodLabel: chosenPeriod.label,
        sections,
        cardIds: [...cards],
        note: note.trim() || null,
      });
      if (!url) throw new Error('no url');
      // The session goes nowhere near the link: the page was rendered with it
      // and stored, and this opens a plain address that expires in 15 minutes.
      await WebBrowser.openBrowserAsync(url);
    } catch {
      setFailed('Could not build the report just now. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const sectionsToShow = (available?.sections ?? []).filter((s) => s.section !== 'cards');
  const cardSection = (available?.sections ?? []).find((s) => s.section === 'cards');

  return (
    <SettingsPage
      title="Build a report"
      subtitle="Choose what to include. A clear summary to share with a clinician or coach, or to keep."
      footer="Your knowledge. Your choice."
    >
      {available === null ? (
        <ThemedText type="small" themeColor="textSecondary">
          {failed ?? 'Looking at what you have stored…'}
        </ThemedText>
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

          <SettingsGroup title="What to include">
            <View style={styles.boxes}>
              {sectionsToShow.map((s) => (
                <Checkbox
                  key={s.section}
                  checked={chosen.has(s.section)}
                  onToggle={() => toggle(s.section, chosen, setChosen)}
                  label={`${LABELS[s.section]?.label ?? s.section} — ${LABELS[s.section]?.detail ?? ''}`}
                />
              ))}
              {sectionsToShow.length === 0 && (
                <ThemedText type="small" themeColor="textSecondary">
                  There is nothing logged yet to put in a report.
                </ThemedText>
              )}
            </View>
          </SettingsGroup>

          {cardSection && available.cards.length > 0 && (
            <SettingsGroup title="Summaries">
              <Pressable
                onPress={() => setShowCards((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={showCards ? 'Hide summaries' : 'Choose summaries'}
                style={({ pressed }) => [styles.expander, pressed && styles.pressed]}
              >
                <ThemedText type="small">
                  {cards.size === 0
                    ? `${available.cards.length} kept, none chosen`
                    : `${cards.size} of ${available.cards.length} chosen`}
                </ThemedText>
                <Ionicons
                  name={showCards ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={theme.textSecondary}
                />
              </Pressable>

              {showCards && (
                <View style={styles.boxes}>
                  {available.cards.map((c) => (
                    <Checkbox
                      key={c.id}
                      checked={cards.has(c.id)}
                      onToggle={() => toggle(c.id, cards, setCards)}
                      label={`${c.title} — ${c.category?.trim() || c.kind}`}
                    />
                  ))}
                  <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                    These are summaries built from your conversations and notes. Selodía does not
                    hold medical documents, scans or test results.
                  </ThemedText>
                </View>
              )}
            </SettingsGroup>
          )}

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

          <Pressable
            onPress={() => void build()}
            disabled={busy || chosenCount === 0}
            accessibilityRole="button"
            accessibilityLabel="Create the PDF"
            style={({ pressed }) => pressed && styles.pressed}
          >
            <ThemedView
              type={chosenCount === 0 ? 'backgroundElement' : 'backgroundSelected'}
              style={[styles.build, chosenCount > 0 && { backgroundColor: theme.accentDeep }]}
            >
              <ThemedText
                type="smallBold"
                themeColor={chosenCount === 0 ? 'textSecondary' : 'background'}
              >
                {busy
                  ? 'Building…'
                  : chosenCount === 0
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
  hint: { lineHeight: 18, paddingBottom: Spacing.two },
  build: { borderRadius: Spacing.three, paddingVertical: Spacing.three, alignItems: 'center' },
  pressed: { opacity: 0.6 },
});
