import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef } from 'react';
import { openBrowserAsync } from 'expo-web-browser';
import { Linking, Pressable, Share, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

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

// AND SHE CAN TAKE ONE OUT (Ruth, 15 October 2026).
//
// She asked the app to pull the numbers she needs regularly out of her care
// records. It pulled nine, including her date of birth, her address and an
// authorisation code tied to one claim. Her correction: "the rest are linked
// to active enquiries and will expire, or already exist here in the app in my
// profile." The app's own reply admitted the gap - "I can add to that list
// from here, but I don't have a way to take the other entries out of it" -
// and nor did this screen.
//
// Her instruction: "The quick copy, call etc icons and fu action is wonderful
// but it also needs swipe to delete."
//
// A LIST SHE CANNOT PRUNE IS WORSE THAN NO LIST. The point of this section is
// reading a number out to somebody who is waiting. An authorisation code that
// expired three weeks ago sitting in it is what makes her stop trusting the
// rows around it.
//
// THE SWIPE IS THE CONFIRMATION. No dialog: a deliberate sideways drag and
// then a tap on the word Remove is already two intentional actions, and a
// detail removed by mistake can be said again in chat. Deleted straight
// through the ordinary client, which row-level security already limits to her
// own rows, so there is no endpoint to go wrong.
export function StandingDetails({
  details,
  onRemove,
}: {
  details: StandingDetail[];
  /** Handed the row to take out. The tab owns the delete, so it can put it back. */
  onRemove?: (detail: StandingDetail) => void;
}) {
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
        <DetailRow key={d.id} detail={d} divider={theme.backgroundSelected} onRemove={onRemove} />
      ))}
    </>
  );
}

function DetailRow({
  detail,
  divider,
  onRemove,
}: {
  detail: StandingDetail;
  divider: string;
  onRemove?: (detail: StandingDetail) => void;
}) {
  const theme = useTheme();
  const swipe = useRef<SwipeableMethods | null>(null);

  // THE ROW GOES AT ONCE, AND THE WRITE CATCHES UP (15 October 2026).
  //
  // The first version awaited the delete before touching the screen, and Ruth
  // got the worst of both: "The delete is saying 'removing' for ages then
  // closing without deleting." The row HAD been deleted - it was gone from the
  // database - but the client was still waiting, then took the error path and
  // closed the swipe, so the screen showed the opposite of what had happened.
  //
  // Taking one line out of a list of her own reference numbers is not an
  // operation that should make her wait on a network at all. It disappears on
  // the tap; if the write genuinely fails it comes back, and that is the only
  // case where anything is slow. See removeDetail in app/(tabs)/me.tsx.
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
    <ReanimatedSwipeable
      ref={swipe}
      friction={2}
      rightThreshold={40}
      // THE ROW ITSELF STILL DOES WHAT IT DID. A swipe that also stole the tap
      // would trade the thing she called wonderful for the thing she asked for.
      renderRightActions={() => (
        <Pressable
          onPress={() => onRemove?.(detail)}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${detail.label}`}
          accessibilityHint="Takes this detail out of the list"
          style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
        >
          <Ionicons name="trash-outline" size={15} color={theme.textSecondary} />
          <ThemedText type="detail" themeColor="textSecondary">
            {'Remove'}
          </ThemedText>
        </Pressable>
      )}
    >
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
    </ReanimatedSwipeable>
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
  // SITS BESIDE THE ROW RATHER THAN FILLING THE SCREEN RED. This is a list
  // of her own reference numbers, not a mailbox, and a destructive-red panel
  // sliding out would read as an alarm every time she brushed the screen.
  remove: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  pressed: { opacity: 0.6 },
});
