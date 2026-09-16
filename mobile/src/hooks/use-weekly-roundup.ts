import { useEffect } from 'react';

import { hasRoundupFor, weekEndingFor } from '@/lib/roundup';
import { supabase } from '@/lib/supabase';

// The Sunday roundup, asked for by the phone (Insights slice 3).
//
// WHY THE PHONE ASKS. There is no scheduler in this project and no code that
// sends a remote push, so "every Sunday evening" is not a server job today.
// Ruth's decision on 2026-09-16: a local Sunday reminder, and the roundup is
// generated when the app is next opened. So this runs at launch, decides
// locally which week is owed - "Sunday evening" is Sunday evening where she is,
// and a serverless function runs in UTC - and asks the server for it.
//
// ONCE PER LAUNCH, AND ONLY WHEN ONE IS MISSING. The check is a single indexed
// read before anything expensive; the route itself refuses to write a second
// roundup for a week that already has one, so a race between two devices costs a
// query rather than a duplicate.
//
// IT NEVER BLOCKS ANYTHING. A failure here is silence: the roundup appears the
// next time the app opens. The alternative - an error on launch about a weekly
// reflection - would be worse than the missing reflection.

// ONE ASK AT A TIME, AND ONE PER WEEK PER LAUNCH.
//
// FOUND ON DEVICE 2026-09-16: six roundups for the same week, and six copies in
// her chat, inside eight seconds. This hook fires from two places (the session
// read and the auth listener) and the root layout mounted more than once, so
// several asks ran at once - and each one checked "does this week have a
// roundup?" and got "no" before any of the others had written one.
//
// The marker is now set BEFORE the check rather than after it, and the run
// itself is single-flight: a second caller awaits the first rather than racing
// it. The database holds the real guarantee (one roundup per week per person);
// this just stops the app asking six times to find that out.
let askedFor: string | null = null;
let inFlight: Promise<void> | null = null;

async function askForRoundup(weekEnding: string): Promise<void> {
  const { data, error } = await supabase
    .from('almanac_entries')
    .select('kind, content')
    .eq('kind', 'roundup')
    .eq('status', 'active');
  // On a read failure, do nothing: asking the server to write a roundup because
  // we could not check for one is how a week gets two.
  if (error) return;
  if (hasRoundupFor((data ?? []) as { kind: string; content: unknown }[], weekEnding)) return;

  const { authedPost } = await import('@/lib/api');
  await authedPost('/api/weekly-roundup', { weekEnding });
}

async function runWeeklyRoundup(): Promise<void> {
  const weekEnding = weekEndingFor();
  if (askedFor === weekEnding) return inFlight ?? undefined;
  askedFor = weekEnding;
  inFlight = askForRoundup(weekEnding).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export function useWeeklyRoundup() {
  useEffect(() => {
    const run = () => {
      void runWeeklyRoundup().catch((err) => {
        console.log('weekly roundup skipped:', err instanceof Error ? err.message : err);
      });
    };

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) run();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) run();
    });
    return () => sub.subscription.unsubscribe();
  }, []);
}
