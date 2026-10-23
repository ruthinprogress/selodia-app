import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { BodyScreen } from '@/components/body-screen';
import { HydrationCard } from '@/components/hydration-card';
import { ReportLink } from '@/components/report-link';
import { WaterHistoryView } from '@/components/water-history-view';
import { hydrationGoal } from '@/lib/hydration-goal';
import { supabase } from '@/lib/supabase';
import { startOfToday } from '@/lib/week';

// Water, week by week. A screen of its own rather than a fourth segment in the
// Log: three segments already sit at the width Ruth asked for, and a fourth
// would take "Measurements" below the size it can be read at. It is reached
// from today's drinks on the Today screen, the way the food history is reached
// from today's food.
//
// THE DROPLET, NOT FOUR PILLS (Ruth, 23 October 2026): "It need the water
// droplet like on the Now screen at the top instead of whats there to tap
// atm."
//
// What was here was HydrationQuickLog - a card headed "Add a drink" with Glass,
// Mug, Bottle and Pint as four grey buttons. That is the control the droplet
// REPLACED on Today back in September, at her instruction ("no card, no goal
// line, no separate + button"), and it survived here because this screen had
// its own copy of everything. The same control in two places, one of them two
// design generations behind, is the whole of what "fallen behind" meant.
//
// It is the same component Today uses, not a lookalike, so a mug is the same
// mug on both screens and there is one place left to change it.
//
// THE REQUIREMENT THE OLD CONTROL EXISTED FOR IS UNCHANGED, and is kept here
// because the file carrying it has gone. Ruth, 22 September 2026: "it doesn't
// make sense that hydration doesn't have a quick log function. It should have a
// quick log bar too, just like food ... otherwise why is it in the log list".
// She was right then and the argument still holds: every row on the Log page
// leads somewhere you can RECORD something, and a screen that only shows you
// history is a link to a read-only page pretending to be a logging screen. The
// droplet satisfies that better than four pills did - one tap, same as Today.
export default function WaterHistoryScreen() {
  const [ml, setMl] = useState(0);
  const [activityMinutes, setActivityMinutes] = useState(0);
  // A drink added here has to appear in the list underneath it straight away,
  // or the control reads as having done nothing. The nonce is what makes the
  // view re-read rather than sit on what it fetched when the screen opened.
  const [added, setAdded] = useState(0);

  const load = useCallback(async () => {
    const dayStart = startOfToday();
    const [water, activity] = await Promise.all([
      supabase
        .from('hydration_logs')
        .select('ml')
        .gte('happened_at', dayStart),
      supabase
        .from('activity_logs')
        .select('duration_min')
        .gte('happened_at', dayStart),
    ]);
    setMl(((water.data ?? []) as { ml: number }[]).reduce((n, r) => n + (r.ml ?? 0), 0));
    setActivityMinutes(
      ((activity.data ?? []) as { duration_min: number | null }[]).reduce(
        (n, r) => n + (r.duration_min ?? 0),
        0
      )
    );
  }, []);

  // ON FOCUS, NOT ON MOUNT. A tab mounts once and then stays mounted, so a
  // read that runs in useEffect shows whatever was true the first time this
  // screen was opened - and water is logged from Today and from chat as well
  // as from here. Coming back to find the droplet at this morning's figure is
  // the app looking broken while being merely out of date.
  //
  // check-tabs-refetch.mjs caught this on the first run after the rewrite,
  // which is the second time today an existing check has found a fault in new
  // code before anybody saw it on a phone.
  //
  // ADDING A DRINK HERE NEEDS NO SECOND EFFECT: onLogged moves the figure
  // immediately from the amount just tapped, and bumps the key that makes the
  // list below re-read. The focus pass is for everything logged somewhere else.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <BodyScreen title="Hydration">
      {/* THE GOAL ONLY SETS HOW FULL THE DROP LOOKS. There is no number on this
          control for anybody to justify - her decision of 25 September, and the
          reason it is passed the same way Today passes it. */}
      <HydrationCard
        ml={ml}
        goal={hydrationGoal({ activityMinutesToday: activityMinutes })}
        onLogged={(deltaMl) => {
          setMl((n) => Math.max(0, n + deltaMl));
          setAdded((n) => n + 1);
        }}
        // THE FLOATING UNDO NOTE IS TODAY'S, and it stays there. On this screen
        // every drink already has the shared row delete with its own undo and
        // its seven-day keep, so a second way to take the last one back would
        // be two controls for one job.
        onAdded={() => setAdded((n) => n + 1)}
        onRemoved={() => setAdded((n) => n + 1)}
      />
      <WaterHistoryView key={added} />
      <ReportLink start={['water']} label="Build a report from this" />
    </BodyScreen>
  );
}
