import { useEffect, useState } from 'react';

// IS THIS A REDO, OR SOMEBODY'S FIRST TIME?
//
// Ruth, 30 September 2026: "Every entry into onboarding from More has a visible
// 'Not now' or back that returns to where she came from. An existing user is
// NEVER forced through onboarding."
//
// The two cases look identical to every screen in the flow - same questions,
// same order - and differ in exactly one way: somebody who already finished can
// stop whenever she likes and nothing is lost, because her account was never
// marked unfinished (see settings/profile.tsx). She needs a door, and a first-
// time user does not, because for her the flow IS the way in.
//
// A MODULE FLAG RATHER THAN A ROUTE PARAM, because the header that draws the
// door sits above the Stack and outlives every push in the chain: a param set
// on the first screen is gone by the second. The same reasoning as
// open-swipe.ts, and the same three lines.
//
// IT DOES NOT NEED TO SURVIVE A FORCE-CLOSE. A redo leaves the account
// finished, so the next launch opens the app rather than the flow, and there is
// nothing left to escape from.

let redoing = false;
const listeners = new Set<(v: boolean) => void>();

export function setRedoing(value: boolean) {
  if (redoing === value) return;
  redoing = value;
  for (const l of listeners) l(value);
}

export function useRedoing(): boolean {
  const [value, setValue] = useState(redoing);
  useEffect(() => {
    listeners.add(setValue);
    setValue(redoing);
    return () => {
      listeners.delete(setValue);
    };
  }, []);
  return value;
}
