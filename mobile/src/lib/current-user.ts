import { supabase } from '@/lib/supabase';

// WHO IS SIGNED IN, WITHOUT ASKING THE SERVER (2026-09-20).
//
// Ruth: "It feels slow ... data population are very slow and feel like they're
// broken until something happens."
//
// MEASURED FIRST. The database is not the problem: over four hours of her own
// use, the median REST call took 16-150ms. One call stood out - /auth/v1/user
// at 227ms average and 531ms at the 95th - and the app made it 34 times, once
// before nearly every read and write. Tapping a glass of water cost a round
// trip to the auth server before the row could even be built; the Today screen
// paid it several times before it could draw.
//
// `getUser()` asks the auth server to validate the token. `getSession()` reads
// the session the client already holds on the phone, and the client refreshes
// it in the background on its own. For "which rows are mine" the difference is
// nil - RLS checks the token at the database, so a stale id here cannot read
// anybody else's data; the worst case is a write attributed to nobody, which
// the insert then refuses.
//
// So the id is cached in memory, kept current by the auth listener, and only
// ever fetched from local storage on the first ask.

let cachedId: string | null = null;
let inFlight: Promise<string | null> | null = null;

// Sign-in, sign-out, and the silent refresh all land here.
supabase.auth.onAuthStateChange((_event, session) => {
  cachedId = session?.user?.id ?? null;
});

/** The signed-in person's id, from memory when possible. Null when signed out. */
export async function currentUserId(): Promise<string | null> {
  if (cachedId) return cachedId;
  if (!inFlight) {
    inFlight = supabase.auth
      .getSession()
      .then(({ data }) => {
        cachedId = data.session?.user?.id ?? null;
        return cachedId;
      })
      .catch(() => null)
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/**
 * For the few places that genuinely need the server's word on the account -
 * the email address, or proof the token is still good before deleting
 * everything. Everything else wants currentUserId.
 */
export async function verifiedUser() {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}
