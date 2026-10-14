import Ionicons from '@expo/vector-icons/Ionicons';
import { openBrowserAsync } from 'expo-web-browser';
import { Linking, Pressable, Share, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  DETAILS_EMPTY,
  UNCHECKED_NOTE,
  tapActionFor,
  type StandingDetail,
} from '@/lib/care-constants';

// THE DETAILS SHE IS ASKED FOR, on one screen, in the order she touched them.
//
// Ruth, 14 October 2026: "It might be useful to populate a section where the
// pertinent details always live as they come in from the user, stuff that
// usually stays the same like NHS numbers, axa memebership numbers etc etc.
// easy to access for the user."
//
// WHAT THIS REPLACES, which is the measure of whether it works. Her NHS number
// existed in the app already - inside a referral letter, under a "To quote"
// heading, four screens into a care record. Reading it out meant opening the
// Me tab, finding How I Access Care, opening the right letter, scrolling past
// what was agreed and the review date, and reading a line out of a block of
// text while somebody waited. This is that, in one tap and no scrolling.
//
// THE VALUE IS THE BIGGEST THING ON THE ROW, and that is deliberate. The label
// is how she finds the row; the value is what she came for. Everywhere else in
// this app the name leads and the detail is quiet, and here that would be
// backwards.
//
// SPACING KEPT EXACTLY AS IT ARRIVED. "485 777 3456" is how it is printed on
// the card she is reading from, so it is how it is shown - grouped digits are
// how a person reads a long number aloud without losing their place, and
// tidying them into one run would make this harder to use while looking more
// consistent.

export function StandingDetails({ details }: { details: StandingDetail[] }) {
  const theme = useTheme();

  if (details.length === 0) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        {DETAILS_EMPTY}
      </ThemedText>
    );
  }

  return (
    <>
      {details.map((d) => (
        <DetailRow key={d.id} detail={d} divider={theme.backgroundSelected} />
      ))}
    </>
  );
}

function DetailRow({ detail, divider }: { detail: StandingDetail; divider: string }) {
  const theme = useTheme();
  // THE LABEL IS PART OF THE DECISION, not decoration. Ten digits is an NHS
  // number or a landline and nothing in the digits says which; only "Surgery
  // phone" does. See tapActionFor.
  const action = tapActionFor(detail.value, detail.label);

  // WHAT A TAP DOES IS WRITTEN ON THE ROW BEFORE IT IS TAPPED. A number copies,
  // a surgery's page opens, an address starts an email, a phone number dials.
  // A row that did one of four things with no way to tell which would be the
  // kind of guessing this section exists to end.
  async function act() {
    if (action.kind === 'copy') {
      // SHARE AND NOT A CLIPBOARD CALL. expo-clipboard is a native module and
      // is not a dependency here, so using it would hold this behind a store
      // build - and the share sheet offers Copy on both platforms as its first
      // option, alongside the messaging apps she would paste it into anyway.
      // The same reasoning as data-export.tsx, and as the chat bubble's own
      // copy control.
      try {
        await Share.share({ message: detail.value });
      } catch {
        // A dismissed sheet is not a failure and says nothing.
      }
      return;
    }
    // A WEB ADDRESS OPENS IN THE APP'S OWN BROWSER, so she comes back to where
    // she was with one swipe. tel: and mailto: hand off to the phone, which
    // openBrowserAsync cannot do, so those go through Linking.
    try {
      if (action.url.startsWith('http')) await openBrowserAsync(action.url);
      else await Linking.openURL(action.url);
    } catch {
      // Nothing to say: the row is still there and still readable.
    }
  }

  const hint = action.kind === 'copy' ? 'Copies or shares this' : action.verb;

  return (
    <Pressable
      onPress={() => void act()}
      accessibilityRole="button"
      accessibilityLabel={`${detail.label}: ${detail.value}`}
      accessibilityHint={hint}
      hitSlop={Spacing.one}
      style={({ pressed }) => [styles.row, { borderTopColor: divider }, pressed && styles.pressed]}
    >
      <View style={styles.text}>
        <ThemedText type="detail" themeColor="textSecondary">
          {detail.label}
        </ThemedText>
        {/* selectable, so a long press still works for anybody who would
            rather select the digits than use a share sheet. */}
        <ThemedText type="small" selectable style={styles.value}>
          {detail.value}
        </ThemedText>
        {detail.note ? (
          <ThemedText type="detail" themeColor="textSecondary">
            {detail.note}
          </ThemedText>
        ) : null}
        {/* A MARK MEANS THE TWO READS OF A PHOTOGRAPH DISAGREED ABOUT THE
            DIGITS, and nothing else - so it appears rarely and means something
            when it does. It is the one thing on this screen worth doubting,
            and reading a wrong number out is the failure that would cost her
            an afternoon. */}
        {detail.confirmed ? null : (
          <ThemedText type="detail" themeColor="textSecondary">
            {UNCHECKED_NOTE}
          </ThemedText>
        )}
      </View>
      <Ionicons
        name={
          action.kind === 'copy'
            ? 'copy-outline'
            : action.url.startsWith('tel:')
              ? 'call-outline'
              : action.url.startsWith('mailto:')
                ? 'mail-outline'
                : 'open-outline'
        }
        size={15}
        color={theme.textSecondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // A ROW ON A PAGE, NOT A TILE. No fill, no radius, one hairline above each
  // row after the first - the same move the rest of this tab made when its
  // cards became rows.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1, minWidth: 0, gap: 1 },
  // TABULAR, so a column of reference numbers lines up and a digit that
  // changed between two readings is visible rather than lost in the kerning.
  value: { fontVariant: ['tabular-nums'] },
  pressed: { opacity: 0.6 },
});
