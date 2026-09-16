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

let askedFor: string | null = null;

async function runWeeklyRoundup(): Promise<void> {
  const weekEnding = weekEndingFor();
  if (askedFor === weekEnding) return;

  const { data, error } = await supabase
    .from('almanac_entries')
    .select('kind, content')
    .eq('kind', 'roundup')
    .eq('status', 'active');
  // On a read failure, do nothing: asking the server to write a roundup because
  // we could not check for one is how a week gets two.
  if (error) return;
  askedFor = weekEnding;
  if (hasRoundupFor((data ?? []) as { kind: string; content: unknown }[], weekEnding)) return;

  const { authedPost } = await import('@/lib/api');
  await authedPost('/api/weekly-roundup', { weekEnding });
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
