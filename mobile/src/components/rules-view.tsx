import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

// THE RULES SEGMENT OF PLANS. What she never does, and what is always fine.
//
// THIS IS NOT A PREFERENCES SCREEN AND IT MUST NOT LOOK LIKE ONE. Ruth's own
// prototype gets this right and the wording is hers: "These are not
// preferences - they are clinical constraints." The context box sits above both
// lists, bordered, so the reason is read before the rules are.
//
// I ARGUED AGAINST PUTTING THIS BEHIND A SEGMENT, on the grounds that a
// segmented control hides three of its four panels and clinical constraints are
// the wrong thing to hide. Her prototype answers it: the context box is the
// loudest thing on the screen, not the quietest. Recorded because the concern
// was real and the answer was better than the concern.
//
// NOTHING IS EDITED HERE YET. A rule arrives through chat, which offers and
// waits for a yes, or through an uploaded letter. Editing in place would want a
// confirmation flow of its own, and a half-built one on a screen about clinical
// constraints is worse than none.

type Rule = {
  id: string;
  kind: 'never' | 'always' | 'technique';
  phrase: string;
  advised_by: string | null;
  confirmed_at: string | null;
};

export const RULES_EMPTY = 'No rules yet';
export const RULES_EMPTY_BODY =
  'If something is off-limits for you, tell Selodía in chat. It will ask you to confirm before it keeps it, and then it stays out of anything built for you.';

export function RulesView() {
  const theme = useTheme();
  const [rules, setRules] = useState<Rule[]>([]);
  const [context, setContext] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [rulesRes, profileRes] = await Promise.all([
          supabase
            .from('user_rules')
            .select('id, kind, phrase, advised_by, confirmed_at')
            .order('created_at', { ascending: true }),
          supabase.from('user_profile').select('rules_context').maybeSingle(),
        ]);
        if (cancelled) return;
        setRules(rulesRes.error ? [] : ((rulesRes.data ?? []) as Rule[]));
        setContext(
          (profileRes.data as { rules_context?: string | null } | null)?.rules_context ?? null
        );
        setLoaded(true);
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  if (!loaded) return null;

  const never = rules.filter((r) => r.kind === 'never');
  const always = rules.filter((r) => r.kind === 'always');
  const advisors = [...new Set(rules.map((r) => r.advised_by).filter(Boolean))];

  if (rules.length === 0) {
    return (
      <Pressable
        onPress={() => router.push('/')}
        accessibilityRole="link"
        accessibilityLabel={`${RULES_EMPTY}. ${RULES_EMPTY_BODY}`}
        style={({ pressed }) => pressed && styles.pressed}>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">{RULES_EMPTY}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {RULES_EMPTY_BODY}
          </ThemedText>
        </ThemedView>
      </Pressable>
    );
  }

  return (
    <ThemedView style={styles.block}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.eyebrow}>
        Movement constraints
      </ThemedText>
      {advisors.length > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          {advisors.join(', ')}
        </ThemedText>
      )}

      {/* THE REASON, BEFORE THE RULES. A list of forbidden movements with no
          explanation reads as fussiness; the same list under the reason reads
          as medicine. Bordered rather than filled, so it is emphatic without
          being an alarm - this is a standing fact about her body, not a
          warning she needs to act on. */}
      {context ? (
        <ThemedView style={[styles.context, { borderColor: theme.danger }]}>
          <ThemedText type="small">{context}</ThemedText>
        </ThemedView>
      ) : null}

      {never.length > 0 && (
        <ThemedView style={styles.group}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.eyebrow}>
            Never
          </ThemedText>
          {never.map((rule) => (
            <RuleRow key={rule.id} rule={rule} />
          ))}
        </ThemedView>
      )}

      {always.length > 0 && (
        <ThemedView style={styles.group}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.eyebrow}>
            Always OK
          </ThemedText>
          {always.map((rule) => (
            <RuleRow key={rule.id} rule={rule} />
          ))}
        </ThemedView>
      )}

      <ThemedText type="small" themeColor="textSecondary">
        These are applied to everything Selodía builds for you, not just remembered. To change one,
        say so in chat.
      </ThemedText>
    </ThemedView>
  );
}

function RuleRow({ rule }: { rule: Rule }) {
  return (
    <ThemedView type="backgroundElement" style={styles.row}>
      <ThemedText type="small">{rule.phrase}</ThemedText>
      {/* AN UNCONFIRMED RULE IS SHOWN AS UNCONFIRMED and is still being
          applied. Saying so is the honest version: hiding it would mean a
          movement disappearing from her sessions for a reason she never
          agreed to, and hiding the rule while keeping the effect is the worse
          half of both options. */}
      {rule.confirmed_at ? null : (
        <ThemedText type="small" themeColor="textSecondary">
          Waiting for you to confirm. Being applied in the meantime.
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  block: { gap: Spacing.three },
  group: { gap: Spacing.two },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 0.8 },
  context: {
    borderWidth: 1,
    borderRadius: CardRadius,
    padding: Spacing.three,
  },
  row: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: CardRadius,
    gap: Spacing.one,
  },
  card: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: CardRadius,
    gap: Spacing.one,
  },
  pressed: { opacity: 0.7 },
});
