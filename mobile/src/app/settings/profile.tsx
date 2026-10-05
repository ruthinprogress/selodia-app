import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { DateOfBirthField } from '@/components/date-of-birth-field';
import { SettingsGroup, SettingsPage, SettingsRow } from '@/components/settings-page';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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
// nothing.
//
// GOALS LEFT THIS PAGE ON 2026-09-28 and are now at the top of Plans. They were
// read-only here, at the bottom of a page about height and date of birth, while
// the screen whose entire job is "what am I intentionally following?" did not
// mention them. The old reasoning for keeping them read-only still holds and has
// moved with them: a goal is set in conversation, where the thinking behind it
// is, and a dropdown would quietly become the place people pick a goal without a
// conversation about whether it is a good one - which Part Two rules out. The
// seven onboarding taps are not that dropdown; they set a focus state and every
// one of them can be changed by saying so.

type Profile = {
  first_name: string | null;
  date_of_birth: string | null;
  biological_sex: string | null;
  height_cm: number | null;
  activity_level: string | null;
};


type Editing = 'name' | 'dob' | 'sex' | 'height' | 'activity' | null;

export default function ProfileScreen() {
  const theme = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [draft, setDraft] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [account, { data: row }] = await Promise.all([
        // The EMAIL is the account's, so this one asks the auth server - the
        // only place left in the app that does. See lib/current-user.ts.
        verifiedUser(),
        supabase
          .from('user_profile')
          .select('first_name, date_of_birth, biological_sex, height_cm, activity_level')
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setEmail(account?.email ?? null);
      setProfile((row ?? null) as Profile | null);
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

  // "REDO MY SETUP" IS GONE, AND THIS IS THE WHOLE OF WHY (Ruth, 2 October 2026).
  //
  //   "Onboarding is only once. What's the benefit of sending them back? If they
  //   have completed the whole thing once, all the details can just go into their
  //   profile like the rest of the details... That way we wouldn't need 'Redo my
  //   setup' at all. Users could see their answers and choose what to update."
  //
  // WHAT THE REDO COST OVER TWO DAYS, kept here because the history explains the
  // removal better than any argument for it would:
  //
  //   Her week deleted, 1 October, by the activities screen replaying itself.
  //   The entire pre-fill machinery, which existed only to make a redo safe.
  //   The overwrite semantics, and an exception list for allergies and rules.
  //   A load flag that left five screens blank with a dead button and no message.
  //   A confirm step that silently lost the goal she had just typed.
  //
  // Every one of those is a cost of REPLAYING a wizard over answers that already
  // exist. None of them is a cost of the answers, or of onboarding itself.
  //
  // Three earlier attempts to mend it are in the git history of this file: it
  // stopped writing onboarding_step on 30 September (it had been locking her into
  // the flow), it moved from step 6 to step 3 on 1 October (steps 1-5 were
  // unreachable, so she could not review her own setup), and it moved to question 1
  // this morning. The fourth attempt is to delete it.
  //
  // ONBOARDING IS UNTOUCHED. Seven questions, taps only, then chat, exactly as she
  // approved it. It still runs for a new account and still resumes a half-finished
  // one. The only change is that nothing sends a finished account back into it.

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

        {/* "EVERYDAY ACTIVITY" IS GONE FROM HERE (Ruth, 5 October 2026): "The
            Everyday Activity is in Profile when it should be in Body Manual."

            IT WAS THE THIRD CONTROL FOR ONE ANSWER, and the most dangerous of
            them. It asked "how much you move outside exercise" and wrote
            activity_level - the whole-day multiplier that is meant to INCLUDE
            exercise - so answering it honestly took her ballet and her training
            out of her own estimate. That wording is half of why her maintenance
            read 1,350 instead of about 1,550.

            It is asked once now, on its own screen, as "How active are you?",
            from the Body Manual row that owns the question. One place, one
            wording, and a date on the answer. */}
      </SettingsGroup>

      {failed && (
        <ThemedText type="small" themeColor="danger">
          That didn&apos;t save. Check your connection and try again.
        </ThemedText>
      )}

      {/* GOALS MOVED TO PLANS, 2026-09-28 (Ruth's session brief). They sat at
          the bottom of a page about height and date of birth, read-only, while
          Plans - the screen whose whole job is "what am I intentionally
          following?" - did not mention them at all. Nothing is lost: the same
          goals, from the same user_context rows, now render above everything
          else in Plans, beside the tapped ones that set the targets. */}

      {/* THE BODY MANUAL MOVED TO MORE (Ruth, 4 October 2026, item 6: "Body
          Manual lives in More, not Profile").

          It is not profile information. Profile is name, date of birth, height -
          the few facts the app needs about her. The Manual is everything she has
          told it about her body, which is a different and much larger thing, and
          burying it under a heading about personal details is why she described
          the training switch as "useless hidden away in profile settings". */}

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
