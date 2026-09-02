import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { deleteAllUserData, deletionCoverageGap, type DeletionOutcome } from '@/lib/account-deletion';
import { supabase } from '@/lib/supabase';

// Deleting your data (build item 41 — Part Seventeen).
//
// IT IS ACCOUNT DELETION NOW, and the copy says so — changed 2026-09-01, when
// the service-role key reached the deployed environment and the auth shell
// finally went with the data. Until then this file avoided the word "account"
// entirely, because the login credential survived and calling it account
// deletion would have been a lie someone acts on: they would believe they were
// gone.
//
// THE CAUTION MOVED, IT DID NOT GO. The completeness claim on the results screen
// is made from `authAccountRemains`, which the server sets from what actually
// happened. If the key is missing from a deployment, or the admin call fails, the
// person is told their sign-in survived — in almost the words this panel used to
// carry permanently. The pre-confirm warning states the finished behaviour,
// because that is what the code does when it works; the results screen states
// the observed one, because that is the screen a failure would land on.
//
// ONE CONFIRMATION, AND IT IS A REAL ONE. The first tap opens a panel that
// states the consequences in full; only the button inside it deletes anything.
// No typed confirmation phrase: making someone transcribe "DELETE" is theatre
// that reads as distrust, and the app's whole voice is written against treating
// people as needing to be managed. Clear consequences and a deliberate second
// tap is the honest version of the same safeguard.
//
// NO WARNING COLOUR ON THE OPENER. The danger token is used on the confirm
// button, where the danger actually is - not on a link someone might tap to
// find out what their options are.

export function AccountDeletion() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<DeletionOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // A drift between the export list and the delete list would leave data
      // behind while reporting success. Checked at the moment it matters.
      const gap = deletionCoverageGap();
      if (gap.length > 0) {
        setError(`Cannot safely delete: ${gap.join(', ')} would be left behind. Nothing has been deleted.`);
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError('Could not confirm who you are signed in as. Nothing has been deleted.');
        return;
      }
      setOutcome(await deleteAllUserData(supabase, user.id));
    } catch {
      setError('Something went wrong partway through. Some data may have been deleted. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (outcome) {
    const leftovers = outcome.remaining.filter((r) => r.rows !== 0);
    return (
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">
          {outcome.authAccountRemains ? 'Your data has been deleted' : 'Your account has been deleted'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
          {outcome.cleared.length} of {outcome.cleared.length + leftovers.length} categories are now
          empty
          {outcome.storageRemoved > 0
            ? `, and ${outcome.storageRemoved} saved ${outcome.storageRemoved === 1 ? 'image was' : 'images were'} removed`
            : ''}
          . This cannot be undone.
        </ThemedText>

        {leftovers.length > 0 && (
          // Never silently. If something survived, the person is told which,
          // because they cannot ask for it to be removed if they do not know.
          <ThemedText type="small" themeColor="danger" style={styles.body}>
            Some data could not be removed: {leftovers.map((r) => r.table).join(', ')}. Please tell us
            so it can be dealt with.
          </ThemedText>
        )}
        {outcome.storageFailed && (
          <ThemedText type="small" themeColor="danger" style={styles.body}>
            Saved images could not be removed. Please tell us so they can be dealt with.
          </ThemedText>
        )}

        {outcome.authAccountRemains ? (
          // Only reachable when the last step genuinely did not happen. Kept, and
          // kept honest, precisely because it should now be rare: a rare wrong
          // answer that nobody is warned about is worse than a common one.
          <ThemedText type="small" themeColor="danger" style={styles.body}>
            Your sign-in still exists: the email and password themselves. Everything you recorded
            is gone, but that last step did not go through. Please tell us so it can be finished.
          </ThemedText>
        ) : (
          <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
            Your sign-in is gone as well. There is nothing left here belonging to you.
          </ThemedText>
        )}

        {/* Still needed even when the account is gone. The token is dead the
            moment the auth user is deleted, but this device is holding a stored
            session that nothing has cleared — signing out is what drops it and
            lets the auth guard return the person to the start. */}
        <Pressable
          onPress={() => void supabase.auth.signOut()}
          accessibilityRole="button"
          accessibilityLabel={outcome.authAccountRemains ? 'Sign out' : 'Close'}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedView type="backgroundSelected" style={styles.action}>
            <ThemedText type="smallBold">{outcome.authAccountRemains ? 'Sign out' : 'Close'}</ThemedText>
          </ThemedView>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">Deleting your account</ThemedText>

      {!open ? (
        <>
          <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
            You can have everything Selodía holds about you removed, and your account with it,
            whenever you want.
          </ThemedText>
          <Pressable
            onPress={() => setOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="See what deleting your account would do"
            style={({ pressed }) => pressed && styles.pressed}
          >
            <ThemedText type="small" themeColor="link" style={styles.link}>
              Delete my account…
            </ThemedText>
          </Pressable>
        </>
      ) : (
        <>
          <ThemedText type="small" style={styles.body}>
            This removes everything you have recorded: your conversations, food and activity logs,
            measurements, drinks, cycle events, Almanac entries, workout history, reminder settings
            and any images you saved.
          </ThemedText>
          <ThemedText type="small" style={styles.body}>
            It cannot be undone. There is no copy kept, and nothing to restore from afterwards.
          </ThemedText>
          <ThemedText type="small" style={styles.body}>
            Your sign-in goes too: the email and password themselves. Afterwards there is no
            account here at all, and signing up again would start from nothing.
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
            If you want a copy first, close this and use “Prepare my data” above.
          </ThemedText>

          <ThemedView style={styles.row}>
            <Pressable
              onPress={confirmDelete}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Permanently delete my account and all of my data"
              style={({ pressed }) => pressed && styles.pressed}
            >
              <ThemedView type="backgroundSelected" style={styles.action}>
                <ThemedText type="smallBold" themeColor="danger">
                  {busy ? 'Deleting…' : 'Delete everything'}
                </ThemedText>
              </ThemedView>
            </Pressable>

            <Pressable
              onPress={() => setOpen(false)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={({ pressed }) => pressed && styles.pressed}
            >
              <ThemedView style={styles.action}>
                <ThemedText type="small" themeColor="textSecondary">
                  Cancel
                </ThemedText>
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
  link: { marginTop: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two, alignItems: 'center' },
  action: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  pressed: { opacity: 0.6 },
});
