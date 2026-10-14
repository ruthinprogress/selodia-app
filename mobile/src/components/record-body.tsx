import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { FormattedText } from '@/components/formatted-text';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { splitAtHeading } from '@/lib/rich-text';

// A CARE RECORD LEADS WITH WHAT YOU NEED. THE LETTER WAITS BEHIND A TAP.
//
// "Seen by" is where the useful half ends and the archive begins - see
// app/lib/clinical-card.ts, which writes the sections in that order for exactly
// this reason. Above it: what the document comes to, what to watch, what it
// costs, what was agreed, the numbers, the contact. Below it: who wrote it and
// the letter itself.
//
// ONE COPY, USED IN BOTH PLACES (14 October 2026). It lived inside
// me-protocol.tsx and the chat had no fold at all, so the Me tab showed a care
// record folded and the chat dumped the whole thing - the same record, twice as
// long, at the moment she was deciding whether to keep it. Ruth, on reading
// one: "Selodia is not working well, I don't feel supported, I feel irritated
// by it's waffle."
//
// IT FOLDS RATHER THAN HIDES, and that distinction is the reason this is not
// simply trimmed in chat. handleReadDocument's own note says she sees the whole
// card "so she can read every line of what she is agreeing to before she agrees
// to it", which is right. A fold keeps that true and still puts the verdict
// first.

export function RecordBody({
  text,
  showing,
  onToggle,
}: {
  text: string;
  /** Left out to let the control hold its own state, as the chat does. */
  showing?: boolean;
  onToggle?: () => void;
}) {
  const theme = useTheme();
  const [own, setOwn] = useState(false);
  const open = showing ?? own;
  const toggle = onToggle ?? (() => setOwn((o) => !o));

  const { front, rest } = splitAtHeading(text, 'Seen by');
  if (!rest) return <FormattedText text={text} />;
  return (
    <>
      <FormattedText text={front} />
      {open ? <FormattedText text={rest} /> : null}
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? 'Hide the letter' : 'Show the letter in full'}
        hitSlop={Spacing.two}
        style={({ pressed }) => [styles.link, pressed && styles.pressed]}
      >
        {/* One arrow rule: it points at the header when shut and down when
            open. See check-one-chevron-rule.mjs. */}
        <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={15} color={theme.accentDeep} />
        <ThemedText type="small" themeColor="accentDeep">
          {open ? 'Hide the letter' : 'Show the letter in full'}
        </ThemedText>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: Spacing.one },
  pressed: { opacity: 0.6 },
});
