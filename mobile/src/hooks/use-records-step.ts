import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

import { advanceOnboardingStep, ONBOARDING_STEPS } from '@/lib/onboarding-step';
import { supabase } from '@/lib/supabase';

// EVERY SETUP SCREEN RECORDS THAT SHE REACHED IT, in one place.
//
// Ruth, 1 October 2026: "nobody is ever bounced to an old or wrong screen."
// Fixing the resume MAP was half of it. The other half is that four screens -
// steer-around, medication, allergies and guidance - recorded no step at all, so
// however far through she got, the account still said she was wherever the last
// screen that bothered to write one had left her.
//
// WHY HERE AND NOT IN EACH SCREEN. Two of those four do not import supabase and
// have no user id to hand; adding the plumbing to each would be four more places
// to forget. The layout already knows the route, the route already maps to a
// step, and onboarding-progress.ts has the note about what happens when the same
// list is maintained in several places: it drifts, and last time the flow lost
// its Continue button. This is the same list again, used once more.
//
// ON ARRIVAL, NOT ON LEAVING, which is deliberate and is the opposite of what
// the screens that did record a step do. Somebody who opens the medication
// screen and force-closes the app should come back to the medication screen -
// she got there, and sending her to the one before it asks her to do a screen
// twice. The screens' own calls stay where they are: a step written twice is
// free, because the write is forward-only.
//
// IT CANNOT MOVE A FINISHED ACCOUNT BACKWARDS. advanceOnboardingStep compares
// indexes and 'complete' is the highest, so a person who finished in August and
// walks the whole flow again through "redo setup" stays complete the entire
// time. That is the property the lockout fix of 30 September depends on, and
// this hook is safe for exactly the same reason - but it is worth saying out
// loud, because a hook that writes a step on every setup screen is precisely the
// shape of the thing that caused that trap.
export function useRecordsStep() {
  const pathname = usePathname();
  // One write per screen per visit. The effect re-runs on any re-render that
  // changes the path, and a round trip to the database per keystroke-induced
  // render would be absurd.
  const written = useRef<string | null>(null);

  useEffect(() => {
    const last = (pathname ?? '').split('?')[0].replace(/\/+$/, '').split('/').filter(Boolean).pop();
    if (!last) return;
    const step = last.replace(/-/g, '_');
    if (!(ONBOARDING_STEPS as readonly string[]).includes(step)) return;
    if (written.current === step) return;
    written.current = step;

    // FIRE AND FORGET, AND SILENT ON FAILURE. This records where she got to; it
    // is not what saves her answers, and a screen that refused to move because a
    // bookkeeping write failed would be worse than a resume that is one screen
    // out.
    void (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) await advanceOnboardingStep(supabase, user.id, step);
      } catch {
        // Deliberately silent. See above.
      }
    })();
  }, [pathname]);
}
