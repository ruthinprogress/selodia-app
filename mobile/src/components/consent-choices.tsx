import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Checkbox } from '@/components/checkbox';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { latestConsent, recordConsent, type ConsentRecord } from '@/lib/consent';
import { supabase } from '@/lib/supabase';

// YOUR CHOICES, IN SETTINGS (2026-09-19). Ruth, on seeing the consent screen
// again and then finding nothing in Settings: "ppl may change their mind". UK
// GDPR Article 7(3) says the same: withdrawing consent must be as easy as
// giving it, and until now the only way to change an answer was to email.
//
// The two optional choices are the same tick boxes as the first screen, and a
// change is saved at once as a NEW consent record - never an edit - so the
// history of what was agreed, and when, stays whole.
//
// Core consent is shown but not offered as a tick box. Holding health data is
// what the app is; without it there is nothing to run. So withdrawing it is
// said plainly to mean deleting the account, which sits just below this card.

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function ConsentChoices() {
  const [record, setRecord] = useState<ConsentRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void latestConsent().then((r) => {
      if (cancelled) return;
      setRecord(r);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function change(field: 'marketingOptIn' | 'researchOptIn') {
    if (!record || saving) return;
    const before = record;
    const next: ConsentRecord = { ...record, [field]: !record[field], givenAt: new Date().toISOString() };
    setRecord(next);
    setSaving(true);
    setError(null);
    const { data } = await supabase.auth.getUser();
    const ok = data.user
      ? await recordConsent(
          data.user.id,
          {
            coreConsent: true,
            marketingOptIn: next.marketingOptIn,
            researchOptIn: next.researchOptIn,
            givenAt: next.givenAt,
          },
          'settings'
        )
      : false;
    setSaving(false);
    if (!ok) {
      // Put the box back: a tick that looks saved and is not is the one thing
      // this card must never show.
      setRecord(before);
      setError("That didn't save. Check your connection and try again.");
    }
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">Your choices</ThemedText>

      {!loaded ? null : !record ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
          Your choices could not be loaded just now. Please try again later.
        </ThemedText>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
            You agreed to Selodía holding your health data on {formatDate(record.givenAt)}. You can
            change the choices below at any time.
          </ThemedText>

          <ThemedView style={styles.boxes}>
            <Checkbox
              checked={record.marketingOptIn}
              onToggle={() => void change('marketingOptIn')}
              label="Keep me posted with occasional tips and updates from Selodía"
            />
            <Checkbox
              checked={record.researchOptIn}
              onToggle={() => void change('researchOptIn')}
              label="I'm happy for de-identified data from my use of Selodía to be used to help improve the product and understand patterns across users."
            />
          </ThemedView>

          <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
            Changed your mind about Selodía holding your health data at all? The app can&apos;t work
            without it, so withdrawing that means deleting your account, below.
          </ThemedText>
        </>
      )}

      <Pressable
        onPress={() => void WebBrowser.openBrowserAsync('https://selodia.app/privacy')}
        accessibilityRole="link"
        accessibilityLabel="Read the privacy policy"
        hitSlop={Spacing.two}
        style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
        <ThemedText type="small" themeColor="accentDeep">
          Read the privacy policy
        </ThemedText>
      </Pressable>

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
  boxes: { gap: Spacing.two, marginVertical: Spacing.two },
  link: { alignSelf: 'flex-start', marginTop: Spacing.one },
  pressed: { opacity: 0.6 },
});
