// OPENED FROM THE BODY MANUAL, THIS IS ONE QUESTION - NOT STEP 4 OF 7.
//
// Ruth, 2 October 2026, 21:02: "The Profile is not working properly. I tried to
// add to Week via profile and it dragged me through onboarding again but saved
// nothing. Twice. And ended up in Chat at the end. Twice."
//
// WHAT HAPPENED. Every row of the Body Manual links to the setup screen that owns
// its question, with `redo=1` on the route to say "she came from her profile, this
// is one question, send her back when she is done". Exactly ONE screen read that
// parameter: goals.tsx, which I fixed last night because she reported it on the
// goals row. The other eleven rows ignored it completely, so tapping "Change this"
// on her week opened question 4 of 7 and walked her through 5, 6 and 7 into chat.
//
// I FIXED THE INSTANCE AND NOT THE CLASS. The goals fix was a `fromManual` const
// and three `if`s copied into one file. Nothing made the next screen behave the
// same way, nothing failed when it did not, and the Manual had eleven other rows
// pointing at screens I never opened. This is the same shape as the hand-kept list
// that went stale in check-all, and as the week-merge logic that lived in one
// screen while its test exercised a copy.
//
// SO IT IS ONE FUNCTION AND A CHECK THAT READS THE MANUAL'S OWN ROUTE TABLE.
// A new row added to the Body Manual tomorrow, pointing at a screen that does not
// call this, fails check-one-question.mjs by name. The list cannot go stale
// because there is no list: it is derived from `editRoute` itself.

import { router, useLocalSearchParams } from 'expo-router';

/**
 * Where a row of the Body Manual lives, and where one question returns to.
 *
 * IT POINTED AT THE PROFILE UNTIL 5 OCTOBER, which is where the Manual used to
 * live. The Manual moved to More that morning and this constant did not follow
 * it, so every one-question trip ended on a screen the question had nothing to do
 * with. Ruth: "it then takes you back to Profile. It should take you back to the
 * open drop down where it came from."
 */
export const BODY_MANUAL_ROUTE = '/settings/body-manual';

export type OneQuestion = {
  /**
   * True when she arrived from her Body Manual rather than from setup.
   *
   * Three things follow, and all three were wrong on eleven screens:
   *   - the stored setup position must NOT advance, or tapping a row on her
   *     profile moves where the app thinks she is in a flow she finished weeks
   *     ago (this is what pinned her to the goals screen on 1 October);
   *   - the header must not say "4 of 7", because she is not on a step;
   *   - Continue returns to the Manual instead of opening the next question.
   */
  fromManual: boolean;
  /**
   * Where Continue goes. `next` is the following setup screen, used only when
   * she is actually walking the chain.
   */
  leave: (next: string) => void;
};

/**
 * The row she opened, carried out and back.
 *
 * ARRIVING AT THE TOP OF A LIST OF FOURTEEN ROWS is not returning somebody to
 * where they were. She opened "What you want to be able to do", typed splits,
 * and came back to a closed list with no sign of what she had just done. The key
 * travels with her and the row is open when she lands - which is also the only
 * confirmation the save happened, and the one no sentence can replace.
 */
export const OPEN_ROW_PARAM = 'openRow';

/** The parameter shape, so the header and the screens read it the same way. */
export function isOneQuestion(params: { redo?: string | string[] }): boolean {
  const redo = Array.isArray(params.redo) ? params.redo[0] : params.redo;
  return redo === '1';
}

export function useOneQuestion(): OneQuestion {
  const params = useLocalSearchParams<{ redo?: string; openRow?: string }>();
  const fromManual = isOneQuestion(params);
  const openRow = Array.isArray(params.openRow) ? params.openRow[0] : params.openRow;

  return {
    fromManual,
    leave: (next: string) => {
      // REPLACE, NOT PUSH, so Back from her profile does not walk her into the
      // question again. Her own words after the goals screen did this: "it took
      // me to the chat page after, which is not correct."
      if (fromManual) {
        router.replace({
          pathname: BODY_MANUAL_ROUTE,
          params: openRow ? { [OPEN_ROW_PARAM]: openRow } : {},
        } as never);
        return;
      }
      router.push(next as never);
    },
  };
}
