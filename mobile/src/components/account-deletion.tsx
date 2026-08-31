import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { deleteAllUserData, deletionCoverageGap, type DeletionOutcome } from '@/lib/account-deletion';
import { supabase } from '@/lib/supabase';

// Deleting your data (build item 41 — Part Seventeen).
//
// THE WORD "DELETE MY ACCOUNT" DOES NOT APPEAR, and that is the whole point of
// this file's copy. Removing the auth.users row needs a service-role key this
// project does not yet have, so the login credential survives. Calling this
// account deletion would be a lie someone acts on: they would believe they were
// gone. It is called deleting your data, because that is what it does, and the
// panel says outright what stays.
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
        <ThemedText type="smallBold">Your data has been deleted</ThemedText>
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

        {outcome.authAccountRemains && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
            Your sign-in still exists — the email and password themselves. Removing that needs a
            step we cannot do from the app yet, so it has not happened. Everything you recorded is
            gone.
          </ThemedText>
        )}

        <Pressable
          onPress={() => void supabase.auth.signOut()}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedView type="backgroundSelected" style={styles.action}>
            <ThemedText type="smallBold">Sign out</ThemedText>
          </ThemedView>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">Deleting your data</ThemedText>

      {!open ? (
        <>
          <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
            You can have everything Unflump holds about you removed, whenever you want.
          </ThemedText>
          <Pressable
            onPress={() => setOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="See what deleting your data would do"
            style={({ pressed }) => pressed && styles.pressed}
          >
            <ThemedText type="small" themeColor="link" style={styles.link}>
              Delete my data…
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
          <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
            Your sign-in itself will remain for now — the email and password. Removing that needs a
            step we cannot do from inside the app yet, so we are not going to claim otherwise.
            Everything else goes.
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
            If you want a copy first, close this and use “Prepare my data” above.
          </ThemedText>

          <ThemedView style={styles.row}>
            <Pressable
              onPress={confirmDelete}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Permanently delete all of my data"
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
