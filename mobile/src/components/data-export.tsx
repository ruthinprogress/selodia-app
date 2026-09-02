import { useState } from 'react';
import { Pressable, Share, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { buildJson, buildSummary, collectExport, type ExportResult } from '@/lib/data-export';
import { supabase } from '@/lib/supabase';

// The data export surface (build item 41 — Part Five).
//
// DELIVERED THROUGH THE OS SHARE SHEET, using React Native's own `Share`. The
// obvious tools for this — expo-file-system, expo-sharing, expo-clipboard — are
// none of them dependencies of this project, and each is a NATIVE module, so
// each would need a fresh EAS build before a single person could export
// anything. Core `Share` needs nothing new and reaches the same destinations
// people actually want: mail to yourself, save to Files, send to Drive.
//
// TWO ARTEFACTS, NOT ONE. The summary is what a person reads; the JSON is what a
// tool reads. Concatenating them would produce a file that is neither — not
// parseable as JSON, and unpleasant to read. So they are offered separately and
// the summary is shown on screen immediately, because the commonest reason for
// asking "what do you have on me" is answered by reading it, not by filing it.
//
// A NOTE ON SIZE. The share sheet passes text through an OS intent, and Android
// caps intent payloads. A long history could exceed it, and the failure is the
// platform's, not something this code can prevent. Hence: the summary is always
// on screen even if sharing fails, and a failure says so rather than appearing
// to have worked.

export function DataExport({ compact = false }: { compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function prepare() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await collectExport(supabase));
    } catch {
      setError('Could not gather your data just now. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function share(what: 'summary' | 'json') {
    if (!result) return;
    try {
      await Share.share({
        message: what === 'summary' ? buildSummary(result) : buildJson(result),
        title: what === 'summary' ? 'Your Selodía data — summary' : 'Your Selodía data — full export',
      });
    } catch {
      setError(
        'Your device would not accept a file that size to share. The summary above is still yours to read, and copying it works.'
      );
    }
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">Your data</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
        {compact
          ? 'Take a copy of everything Selodía holds about you.'
          : 'You can take a copy of everything Selodía holds about you, at any time. This is yours by right, and it does not depend on whether you agreed to research use.'}
      </ThemedText>

      {!result ? (
        <Pressable
          onPress={prepare}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Prepare a copy of your data"
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedView type="backgroundSelected" style={styles.action}>
            <ThemedText type="smallBold">{busy ? 'Gathering…' : 'Prepare my data'}</ThemedText>
          </ThemedView>
        </Pressable>
      ) : (
        <>
          {/* Selectable so it can be copied by hand even if the share sheet
              refuses the payload — the last resort still works. */}
          <ThemedText type="small" style={styles.summary} selectable>
            {buildSummary(result)}
          </ThemedText>

          <ThemedView style={styles.row}>
            <Pressable
              onPress={() => share('summary')}
              accessibilityRole="button"
              accessibilityLabel="Share the readable summary"
              style={({ pressed }) => pressed && styles.pressed}
            >
              <ThemedView type="backgroundSelected" style={styles.action}>
                <ThemedText type="smallBold">Share summary</ThemedText>
              </ThemedView>
            </Pressable>

            <Pressable
              onPress={() => share('json')}
              accessibilityRole="button"
              accessibilityLabel="Share the full data export as JSON"
              style={({ pressed }) => pressed && styles.pressed}
            >
              <ThemedView type="backgroundSelected" style={styles.action}>
                <ThemedText type="smallBold">Share full data (JSON)</ThemedText>
              </ThemedView>
            </Pressable>
          </ThemedView>
        </>
      )}

      {error && (
        <ThemedText type="small" themeColor="danger" style={styles.body}>
          {error}
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.one },
  body: { lineHeight: 20 },
  summary: {
    marginTop: Spacing.two,
    lineHeight: 19,
    fontVariant: ['tabular-nums'],
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.two },
  action: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  pressed: { opacity: 0.6 },
});
