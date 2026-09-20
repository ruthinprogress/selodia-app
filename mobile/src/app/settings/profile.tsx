import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { DateOfBirthField } from '@/components/date-of-birth-field';
import { SettingsGroup, SettingsPage, SettingsRow } from '@/components/settings-page';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ActivityLevel } from '@/lib/body-metrics';
import { currentUserId, verifiedUser } from '@/lib/current-user';
import { supabase } from '@/lib/supabase';

// PROFILE (2026-09-20). Ruth's brief: "This page does not currently exist. I'd
// like it added. Its purpose is: tell Selodía about me. Not medical history.
// Not protocols. Just information about me."
//
// Everything here was already being asked for in onboarding and then never
// shown again, so a wrong answer - or a change, like a new height - could only
// be fixed by telling Selodía in conversation and hoping. Now each detail is
// where somebody would look for it, and editable in place.
//
// WHAT IS NOT HERE, and why. Region, language and units are in her brief but
// nothing stores them and nothing reads them: the app is metric and English
// today, and a picker that changed neither would be a control that does
// nothing. Goals are shown but not edited here: they are set in conversation,
// where the reasoning behind them is, and a dropdown would quietly become the
// place people pick a goal without a conversation about whether it is a good
// one - which Part Two rules out.

type Profile = {
  first_name: string | null;
  date_of_birth: string | null;
  biological_sex: string | null;
  height_cm: number | null;
  activity_level: string | null;
};

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Mostly sitting',
  light: 'Lightly active',
  moderate: 'Moderately active',
  active: 'Active',
  very_active: 'Very active',
};

type Editing = 'name' | 'dob' | 'sex' | 'height' | 'activity' | null;

export default function ProfileScreen() {
  const theme = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [goals, setGoals] = useState<string[]>([]);
  const [editing, setEditing] = useState<Editing>(null);
  const [draft, setDraft] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [account, { data: row }, { data: context }] = await Promise.all([
        // The EMAIL is the account's, so this one asks the auth server - the
        // only place left in the app that does. See lib/current-user.ts.
        verifiedUser(),
        supabase
          .from('user_profile')
          .select('first_name, date_of_birth, biological_sex, height_cm, activity_level')
          .maybeSingle(),
        supabase.from('user_context').select('category, content'),
      ]);
      if (cancelled) return;
      setEmail(account?.email ?? null);
      setProfile((row ?? null) as Profile | null);
      setGoals(
        ((context ?? []) as { category: string; content: string }[])
          .filter((c) => (c.category ?? '').toLowerCase().includes('goal'))
          .map((c) => c.content)
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Only the field being changed is written, so an empty answer elsewhere is
  // never written over what is already stored - the fault the account screen
  // had until 19 September.
  async function save(patch: Partial<Profile>) {
    setFailed(false);
    const userId = await currentUserId();
    if (!userId) return;
    const { error } = await supabase.from('user_profile').upsert({ user_id: userId, ...patch });
    if (error) {
      setFailed(true);
      return;
    }
    setProfile((p) => ({ ...(p ?? ({} as Profile)), ...patch }) as Profile);
    setEditing(null);
  }

  const dob = profile?.date_of_birth ? new Date(profile.date_of_birth) : null;
  const sexLabel = profile?.biological_sex
    ? profile.biological_sex.charAt(0).toUpperCase() + profile.biological_sex.slice(1)
    : 'Not given';

  return (
    <SettingsPage
      title="Profile"
      subtitle="A few details help Selodía understand you and give more personal insights."
      footer="The better you know yourself, the better Selodía can support you."
    >
      <SettingsGroup title="Personal details">
        <SettingsRow
          first
          icon="person-outline"
          label="Name"
          value={profile?.first_name ?? 'Not given'}
          onPress={() => {
            setDraft(profile?.first_name ?? '');
            setEditing(editing === 'name' ? null : 'name');
          }}
        />
        {editing === 'name' && (
          <Editor
            value={draft}
            onChange={setDraft}
            placeholder="What shall Selodía call you?"
            onSave={() => void save({ first_name: draft.trim() || null })}
          />
        )}

        <SettingsRow icon="mail-outline" label="Email" value={email ?? '—'} />

        <SettingsRow
          icon="calendar-outline"
          label="Date of birth"
          value={dob ? dob.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Not given'}
          onPress={() => setEditing(editing === 'dob' ? null : 'dob')}
        />
        {editing === 'dob' && (
          // The field the onboarding step uses, rather than the picker itself:
          // it closes its own dialog on Android, and it has a web fallback
          // where the native picker renders nothing at all.
          <View style={styles.editor}>
            <DateOfBirthField
              value={dob}
              onChange={(picked) => void save({ date_of_birth: picked.toISOString().slice(0, 10) })}
            />
          </View>
        )}

        <SettingsRow
          icon="body-outline"
          label="Biological sex"
          detail="Used for metabolic estimates, nothing else"
          value={sexLabel}
          onPress={() => setEditing(editing === 'sex' ? null : 'sex')}
        />
        {editing === 'sex' && (
          <Choices
            options={[
              { id: 'female', label: 'Female' },
              { id: 'male', label: 'Male' },
            ]}
            selected={profile?.biological_sex ?? null}
            onSelect={(id) => void save({ biological_sex: id })}
          />
        )}

        <SettingsRow
          icon="resize-outline"
          label="Height"
          value={profile?.height_cm ? `${profile.height_cm} cm` : 'Not given'}
          onPress={() => {
            setDraft(profile?.height_cm ? String(profile.height_cm) : '');
            setEditing(editing === 'height' ? null : 'height');
          }}
        />
        {editing === 'height' && (
          <Editor
            value={draft}
            onChange={setDraft}
            placeholder="Height in cm"
            numeric
            onSave={() => {
              const cm = Number(draft.replace(/[^0-9.]/g, ''));
              if (cm >= 100 && cm <= 230) void save({ height_cm: Math.round(cm) });
            }}
          />
        )}

        <SettingsRow
          icon="walk-outline"
          label="Everyday activity"
          detail="How much you move outside exercise"
          value={
            profile?.activity_level && profile.activity_level in ACTIVITY_LABELS
              ? ACTIVITY_LABELS[profile.activity_level as ActivityLevel]
              : 'Not given'
          }
          onPress={() => setEditing(editing === 'activity' ? null : 'activity')}
        />
        {editing === 'activity' && (
          <Choices
            options={(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((id) => ({
              id,
              label: ACTIVITY_LABELS[id],
            }))}
            selected={profile?.activity_level ?? null}
            onSelect={(id) => void save({ activity_level: id })}
          />
        )}
      </SettingsGroup>

      {failed && (
        <ThemedText type="small" themeColor="danger">
          That didn&apos;t save. Check your connection and try again.
        </ThemedText>
      )}

      <SettingsGroup title="Goals">
        {goals.length === 0 ? (
          <SettingsRow
            first
            icon="leaf-outline"
            label="Nothing set yet"
            detail="Goals are agreed in conversation, so they arrive with their reasons"
          />
        ) : (
          goals.map((g, i) => (
            <SettingsRow key={g} first={i === 0} icon="leaf-outline" label={g} />
          ))
        )}
      </SettingsGroup>

      <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
        To change a goal, say so in a conversation. Selodía keeps the thinking behind it, which a
        list here could not.
      </ThemedText>

      <ThemedView type="backgroundElement" style={[styles.signOutNote, { borderColor: theme.backgroundSelected }]}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          Signing out leaves everything where it is. Your data stays on your account, and signing
          back in picks up exactly where you left off.
        </ThemedText>
      </ThemedView>
    </SettingsPage>
  );
}

function Editor({
  value,
  onChange,
  placeholder,
  numeric,
  onSave,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  numeric?: boolean;
  onSave: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.editor}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        keyboardType={numeric ? 'number-pad' : 'default'}
        autoFocus
        onSubmitEditing={onSave}
        style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
        accessibilityLabel={placeholder}
      />
      <Pressable onPress={onSave} accessibilityRole="button" accessibilityLabel="Save">
        <ThemedText type="smallBold" themeColor="link">
          Save
        </ThemedText>
      </Pressable>
    </View>
  );
}

function Choices({
  options,
  selected,
  onSelect,
}: {
  options: { id: string; label: string }[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={styles.choices}>
      {options.map((o) => (
        <Pressable
          key={o.id}
          onPress={() => onSelect(o.id)}
          accessibilityRole="button"
          accessibilityState={{ selected: selected === o.id }}
          accessibilityLabel={o.label}
        >
          <ThemedView
            type={selected === o.id ? 'backgroundSelected' : 'background'}
            style={styles.choice}
          >
            <ThemedText type="small">{o.label}</ThemedText>
          </ThemedView>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  editor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingBottom: Spacing.three,
  },
  input: {
    flex: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    fontSize: 15,
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one, paddingBottom: Spacing.three },
  choice: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: Spacing.three },
  note: { lineHeight: 20 },
  signOutNote: { borderRadius: Spacing.three, padding: Spacing.three, borderWidth: 0 },
});
