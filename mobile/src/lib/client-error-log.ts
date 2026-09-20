import { currentUserId } from '@/lib/current-user';
import { supabase } from '@/lib/supabase';

// A failure the phone cannot explain on its own screen, written where it can be
// read. Added 2026-09-17, when a voice note failed on device and the only
// evidence was a line of text somebody had to photograph and send.
//
// BEST EFFORT, ALWAYS. Every call is fire-and-forget and swallows its own
// errors: a diagnostic that can fail the thing it is diagnosing is worse than no
// diagnostic. RLS scopes the row to the signed-in person.
export async function logClientError(area: string, err: unknown): Promise<void> {
  try {
    const userId = await currentUserId();
    if (!userId) return;
    const detail =
      err instanceof Error
        ? `${err.name}: ${err.message}`.slice(0, 500)
        : String(err).slice(0, 500);
    await supabase.from('client_error_log').insert({ user_id: userId, area, detail });
  } catch {
    // Deliberately silent.
  }
}
