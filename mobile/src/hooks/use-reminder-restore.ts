import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';

// Puts reminders back on a device where the person has already said yes
// (2026-09-12). The reasoning lives with restoreReminders in notifications.ts.
//
// Once per launch, for whoever is signed in. Push is reached through a dynamic
// import behind isPushAvailable, the same way the offer card reaches it, so the
// root layout never pulls expo-notifications into a binary that lacks it.
// notifications.ts imports nothing native at module scope that is not already
// loaded by supabase.ts.
export function useReminderRestore(): void {
  useEffect(() => {
    let ranFor: string | null = null;

    const run = async (userId: string) => {
      if (ranFor === userId) return;
      ranFor = userId;
      try {
        const push = await import('@/lib/notifications');
        if (push.isPushAvailable()) await push.restoreReminders(userId);
      } catch (err) {
        console.log('reminder restore skipped:', err instanceof Error ? err.message : err);
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void run(data.session.user.id);
    });
    // A sign-in after launch gets the same treatment as a session already present.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) void run(session.user.id);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
}
