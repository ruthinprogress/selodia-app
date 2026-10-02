import { router } from 'expo-router';
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
import { setRedoing } from '@/lib/redo-setup';
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

  // IT NO LONGER TOUCHES THE STEP AT ALL (30 September 2026), and that single
  // deletion is the whole fix for the trap.
  //
  // WHAT IT USED TO DO. It wrote `onboarding_step: 'goals'` the instant she
  // tapped it - before she had answered one question. From that moment the
  // account read as unfinished, and use-auth-guard sends an unfinished account
  // sitting in the app back to RESUME_ROUTE[step]. So there was no way out of
  // onboarding except to reach 'complete', and force-closing made it worse: the
  // step is in the database, so the next launch read 'goals' and bounced her
  // straight back in. Ruth, today: "LOCKED IN. Force-closing twice does not
  // help."
  //
  // WHY NOTHING NEEDS TO REPLACE IT. Every screen in the flow saves its own
  // answers as it goes; not one of them reads onboarding_step to decide what to
  // do. The column's only job is resuming somebody who has not finished, and a
  // person who finished in August is not that. And advanceOnboardingStep is
  // forward-only, so walking the whole flow again cannot move a 'complete'
  // account backwards either - the redo is safe from both ends.
  //
  // So a redo is now exactly what the words say: the same screens, revisited,
  // with her account still finished the entire time. Leaving halfway leaves
  // nothing behind.
  // IT STARTED AT STEP 6 OF 11 (Ruth, 1 October 2026, finding 1).
  //
  // "'Redo my setup' opens at step 6 of 11. Steps 1 to 5 cannot be reached, so
  // Ruth cannot review the whole flow."
  //
  // WHAT STEPS 1-5 ARE, since that was her question. In order: consent (Your
  // data), account (Your account), intro (Hello), equipment (What you have),
  // first-log (Your first log). It was NOT resuming at her first unanswered
  // step - it has always pushed to `goals` unconditionally, because when the
  // redo was written goals was where the interesting questions began.
  //
  // IT NOW STARTS AT `intro`, STEP 3, AND THAT IS NOT ALL ELEVEN. The two it
  // still cannot show are the two that cannot be re-run from inside a signed-in
  // app rather than ones I chose to skip:
  //
  //   consent happens before a session exists. It has its own re-ask, driven by
  //   the policy version, and it fired today when the 1 October policy went
  //   live - so it is reviewable, just not from here.
  //   account is sign-in. Walking her through account creation while she is
  //   signed in would be a way to break a login, not a way to review wording.
  //
  // So this covers steps 3 to 11, and the first-log screen is the one to watch
  // in testing: it asks her to log something, and a redo must not leave a
  // phantom meal behind. It has a skip, which is now labelled "Skip this
  // question" rather than reading like the header's "Leave setup".
  function redoSetup() {
    // The flag is what puts "Leave setup" in the header for the whole chain; the
    // param is left on so the first screen can tell in its own right.
    setRedoing(true);
    // AT QUESTION 1, WITH HER ANSWERS SHOWING. Item 4: a redo is an edit mode.
    // It used to open on `intro`, which has gone, and before that on step 6 -
    // which is how she could not review the first half of her own setup.
    router.push({ pathname: '/onboarding/days', params: { redo: '1' } });
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

      {/* GOALS MOVED TO PLANS, 2026-09-28 (Ruth's session brief). They sat at
          the bottom of a page about height and date of birth, read-only, while
          Plans - the screen whose whole job is "what am I intentionally
          following?" - did not mention them at all. Nothing is lost: the same
          goals, from the same user_context rows, now render above everything
          else in Plans, beside the tapped ones that set the targets. */}

      {/* REDO MY SETUP (Ruth, 29 September 2026), so somebody who onboarded
          before the tap spine existed can walk it.

          IT NEVER DELETES A LOG. Her words, and the distinction the whole
          feature turns on: setup is what she has DECIDED - goals, week, rules,
          life stage, allergies - and a log is what HAPPENED. Redoing a decision
          is ordinary; losing a month of meals because you wanted to change a
          goal is not, and an app that could do the second by accident is one
          nobody would risk tapping.

          It only moves the onboarding step back. Every screen in the spine
          replaces its own answers when it saves, and the ones that must not be
          replaced - allergies, and anything said in chat - upsert instead. So
          walking it again updates, and nothing here has to know which is
          which. */}
      <SettingsGroup title="Setup">
        <SettingsRow
          first
          icon="refresh-outline"
          label="Redo my setup"
          detail="Walk through the questions again. Your logs are never touched"
          onPress={() => void redoSetup()}
        />
      </SettingsGroup>


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
