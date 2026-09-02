import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

// The cycle-tracking discovery invitation (SELODIA_SPEC.md, Part Thirteen),
// surfaced as a dismissible card at the top of the Chat tab — invitation, never
// a nag. `discover` is the never-logged copy (spec-verbatim); `relog` is the
// gentle re-offer once a previously-logged cycle has lapsed 35+ days. Accepting
// logs a single period_start into cycle_events (default today, with a days-ago
// backdate); dismissing stamps user_profile.cycle_prompt_dismissed_at so it goes
// quiet for the cooldown. onDone hides the card either way.

type Props = {
  mode: 'discover' | 'relog';
  onDone: () => void;
};

const INVITE_COPY: Record<Props['mode'], string> = {
  discover:
    'Want to add cycle tracking? Some people find it explains patterns in energy, cravings, and weigh-ins they hadn’t connected before.',
  relog:
    'It’s been a while since you logged a period. Want to add your latest one? It helps me read your energy and weigh-ins in context.',
};

function isoDateDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function CycleDiscoveryCard({ mode, onDone }: Props) {
  const theme = useTheme();
  const [stage, setStage] = useState<'invite' | 'enable'>('invite');
  const [daysAgo, setDaysAgo] = useState('0');
  const [busy, setBusy] = useState(false);

  async function handleDismiss() {
    if (busy) return;
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('user_profile')
        .upsert({ user_id: user.id, cycle_prompt_dismissed_at: new Date().toISOString() });
    }
    onDone();
  }

  async function handleLogPeriod() {
    if (busy) return;
    setBusy(true);
    const n = Math.max(0, parseInt(daysAgo, 10) || 0);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('cycle_events')
        .insert({ user_id: user.id, event_type: 'period_start', event_date: isoDateDaysAgo(n) });
    }
    onDone();
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      {stage === 'invite' ? (
        <>
          <ThemedText type="small">{INVITE_COPY[mode]}</ThemedText>
          <ThemedView style={styles.actionRow}>
            <CardButton label="Not now" muted disabled={busy} onPress={handleDismiss} />
            <CardButton
              label={mode === 'discover' ? 'Add cycle tracking' : 'Log latest period'}
              disabled={busy}
              onPress={() => setStage('enable')}
            />
          </ThemedView>
        </>
      ) : (
        <>
          <ThemedText type="small">
            When did your last period start? If it was today, just log it — or say how many days ago.
          </ThemedText>
          <ThemedView style={styles.enableRow}>
            <TextInput
              value={daysAgo}
              onChangeText={(t) => setDaysAgo(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={theme.textSecondary}
              style={[styles.daysInput, { color: theme.text, backgroundColor: theme.background }]}
            />
            <ThemedText type="small" themeColor="textSecondary">
              days ago
            </ThemedText>
          </ThemedView>
          <ThemedView style={styles.actionRow}>
            <CardButton label="Back" muted disabled={busy} onPress={() => setStage('invite')} />
            <CardButton
              label={busy ? 'Saving…' : 'Log period start'}
              disabled={busy}
              onPress={handleLogPeriod}
            />
          </ThemedView>
        </>
      )}
    </ThemedView>
  );
}

function CardButton({
  label,
  onPress,
  disabled,
  muted,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  muted?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type={muted ? 'background' : 'backgroundSelected'} style={styles.button}>
        <ThemedText type="smallBold">{label}</ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'flex-end',
  },
  enableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  daysInput: {
    minWidth: 56,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    textAlign: 'center',
  },
  button: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
