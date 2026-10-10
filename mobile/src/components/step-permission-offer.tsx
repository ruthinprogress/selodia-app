import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { requestStepPermission, type StepPermissionResult } from '@/lib/step-permission';
import { supabase } from '@/lib/supabase';

// ASKING THE PHONE FOR HER STEPS, SOMEWHERE SHE WILL ACTUALLY BE ASKED.
//
// Ruth, 10 October 2026, on a brand new account on a brand new iPhone: "it never
// asked me". And when told the permission screen had gone: "The health
// permissions are the three ticks at the start, that was there and I ticked
// them."
//
// SHE HAD TICKED A CONSENT, NOT GRANTED A PERMISSION, AND THAT IS THE BUG. The
// first tick on the consent screen reads "I understand and agree to Selodía
// collecting and using my health data as described". A reasonable person reads
// that as the health data on their phone. It is a GDPR consent to PROCESS data
// and it grants this app nothing technically: only Apple's or Android's own
// dialog can do that, and no app can fake or imply one.
//
// That request existed in exactly one place - onboarding/equipment.tsx - and
// equipment was removed from the flow on 2 October at Ruth's own instruction,
// when nine screens became seven. A reasonable product decision took the
// operating-system request out with it and nothing said so.
//
// SO THE FAILURE IS THE WORST SHAPE THERE IS: she agreed to something called
// health data, believed step tracking was on, and the phone was never asked. A
// tester does not report that as broken. She believes it works and quietly
// wonders why her movement never appears - which is exactly what happened here,
// and it took a new account on a new phone to surface, because every existing
// account was granted HealthKit months ago.
//
// IT LIVES HERE RATHER THAN ON A SCREEN OF ITS OWN, because the seven questions
// are Ruth's and adding an eighth would undo a decision she made deliberately.
// "How active you are" is the question steps belong to.
//
// IT REPORTS, IT DOES NOT NAG. One tap, one dialog, and what came back is shown
// rather than assumed - the same rule as the Settings control this mirrors.

const MESSAGE: Record<StepPermissionResult, string> = {
  granted: 'Connected. Your steps will appear on their own.',
  declined:
    "That's fine. Maybe you have a tracker that doesn't sync to your phone's health app. You can tell me your step count directly, or send a screenshot.",
  unsupported:
    "Your phone doesn't have a health app I can read steps from, so I'll leave that. Just tell me your step count whenever you want it counted.",
  // UNKNOWN IS iOS AND IT IS THE HONEST SHAPE. Apple will not tell an app
  // whether read access was allowed, so claiming it is connected might be a lie
  // and claiming it failed might also be one.
  unknown:
    "Asked. If your phone shares your steps they'll start appearing on their own. If they haven't in a day or two, tell me and we'll sort it.",
};

export function StepPermissionOffer() {
  const theme = useTheme();
  const [asking, setAsking] = useState(false);
  const [outcome, setOutcome] = useState<StepPermissionResult | null>(null);

  async function ask() {
    if (asking || outcome) return;
    setAsking(true);
    const result = await requestStepPermission();
    setAsking(false);
    setOutcome(result);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    // ONLY A REAL DECLINE COUNTS AS ONE. This column stops the app re-prompting
    // somebody who already said no, so writing true for anything that merely is
    // not a yes would silence a retry she never refused. 'unknown' is the case
    // that matters: iOS cannot tell us, and a guess would permanently suppress
    // step tracking for somebody who had in fact allowed it.
    await supabase
      .from('user_profile')
      .update({ steps_permission_declined: result === 'declined' || result === 'unsupported' })
      .eq('user_id', user.id);
  }

  return (
    <View style={styles.block}>
      <ThemedText type="smallBold">Your step count</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.line}>
        Selodía can read the steps your phone already counts, so movement is one less thing to log.
        It only ever reads them and never writes anything to your health data.
      </ThemedText>

      {outcome ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.line}>
          {MESSAGE[outcome]}
        </ThemedText>
      ) : (
        <Pressable
          onPress={() => void ask()}
          disabled={asking}
          accessibilityRole="button"
          accessibilityLabel="Let Selodía read your step count"
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedView type="backgroundElement" style={styles.button}>
            <ThemedText type="smallBold" themeColor={asking ? 'textSecondary' : 'accentDeep'}>
              {asking ? 'Asking…' : 'Use my phone’s step count'}
            </ThemedText>
          </ThemedView>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: Spacing.two, marginTop: Spacing.four },
  line: { lineHeight: 18 },
  button: { paddingVertical: Spacing.three, paddingHorizontal: Spacing.four, borderRadius: Spacing.four, alignItems: 'center' },
  pressed: { opacity: 0.6 },
});
