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
// A RULE CAN BE REMOVED HERE (Ruth, 20 October 2026, from daily use):
//
//   "There is no way to remove anything from the Rules page. That needs
//    changing. An app that decided what a user can and cannot do is not
//    helpful, it's inflexible."
//
// This file used to say: "NOTHING IS EDITED HERE YET... Editing in place would
// want a confirmation flow of its own, and a half-built one on a screen about
// clinical constraints is worse than none." The caution was right and the
// conclusion was wrong, and what proved it was her using the app: a
// quad-dominant rule she had set months earlier was pulling movements out of a
// ballet plan, chat could not remove the rule, and this screen could not
// either. The rule outlived the knee and there was no door.
//
// IT STILL SAYS "TELL SELODIA IN CHAT" FOR CHANGING ONE, and that is not a
// contradiction. Changing a rule is a judgement with a reason behind it, which
// belongs in a conversation. Removing one is a single decision about her own
// body, and it only needs a second tap.
//
// EDITING IN PLACE IS STILL NOT HERE, for the original reason. Delete is the
// whole of what she asked for and the whole of what this does.

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

  // Bumped after a delete so the list re-reads. The load already runs on focus;
  // this gives it a second reason to run without duplicating the query.
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

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
    }, [reloadKey])
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
            <RuleRow key={rule.id} rule={rule} onRemoved={reload} />
          ))}
        </ThemedView>
      )}

      {always.length > 0 && (
        <ThemedView style={styles.group}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.eyebrow}>
            Always OK
          </ThemedText>
          {always.map((rule) => (
            <RuleRow key={rule.id} rule={rule} onRemoved={reload} />
          ))}
        </ThemedView>
      )}

      {/* WHAT THEY NOW DO, which changed on 20 October 2026. They used to be
          applied by taking the movement out; now a plan keeps everything and
          names what falls under a rule. See app/lib/rules-gate.ts. Saying
          "applied to everything" would be the old behaviour described in the
          present tense. */}
      <ThemedText type="small" themeColor="textSecondary">
        Selodía checks everything it builds against these and tells you when something falls under
        one, rather than leaving it out. To change a rule, say so in chat. To remove one, tap Remove
        above.
      </ThemedText>
    </ThemedView>
  );
}

function RuleRow({ rule, onRemoved }: { rule: Rule; onRemoved: () => void }) {
  const theme = useTheme();
  // TWO TAPS, the same shape as removing a food entry or a week card. A rule is
  // not precious - it can be said again in chat in a sentence - but a screen
  // about constraints on a body should not lose one to a misplaced thumb.
  const [confirm, setConfirm] = useState(false);
  const [failed, setFailed] = useState(false);

  async function remove() {
    setFailed(false);
    const { error } = await supabase.from('user_rules').delete().eq('id', rule.id);
    // SAID, NEVER SWALLOWED. A delete that silently fails leaves the rule still
    // shaping her plans while she believes it is gone, which is the same fault
    // as the gate removing movements she could not see.
    if (error) setFailed(true);
    else onRemoved();
  }

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

      {failed ? (
        <ThemedText type="small" themeColor="danger">
          That did not remove. Check your connection and try again.
        </ThemedText>
      ) : null}

      <Pressable
        onPress={() => (confirm ? void remove() : setConfirm(true))}
        accessibilityRole="button"
        accessibilityLabel={confirm ? `Confirm, remove ${rule.phrase}` : `Remove ${rule.phrase}`}
        accessibilityHint="Takes this rule off your list. Selodía will stop checking against it"
        hitSlop={Spacing.two}
        style={({ pressed }) => [styles.remove, pressed && styles.pressed]}>
        <ThemedText type="small" themeColor={confirm ? 'danger' : 'textSecondary'}>
          {confirm ? 'Tap again to remove it' : 'Remove'}
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  // 44 is the smallest a control should be, and this one is quiet on purpose.
  remove: { minHeight: 44, justifyContent: 'center' },
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
