import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Removing the auth user itself — the last step of account deletion (build item
// 41, Part Seventeen).
//
// WHY THIS EXISTS AS A ROUTE AT ALL. `auth.admin.deleteUser` requires the
// service-role key, which bypasses RLS completely. That key can never go near
// the mobile bundle: anything reachable from the app is reachable by anyone who
// unpacks it, and this one key would hand them every row of every user's data.
// So the privileged call lives on the server, and the only thing the client can
// ask for is "delete ME".
//
// THE USER ID COMES FROM THE TOKEN, NEVER FROM THE REQUEST BODY. This is the
// whole security design of the route and the one thing that must not be
// "simplified" later. The caller's own JWT is verified with the ANON client
// first; only the id that verification returns is passed to the admin client. A
// body-supplied id would turn this into an endpoint that deletes any account by
// number, which is the single worst bug this codebase could ship.
//
// BELT AND BRACES ON THE DATA. Deleting the auth.users row cascades all 17
// tables by itself, so in principle the client-side wipe is redundant. It runs
// first anyway, and that ordering is deliberate: the client-side pass VERIFIES
// by re-counting rows and reports honestly what it could not clear, which a
// single cascading delete cannot do. Data first with proof, then the shell.

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // CONFIGURATION IS CHECKED BEFORE AUTHENTICATION, on purpose, and the
  // trade-off is worth stating. It means an unauthenticated caller can tell a
  // configured deployment (401) from an unconfigured one (503) — the only thing
  // disclosed is whether an environment variable is set, never its value. In
  // exchange, a deployment missing the key is discoverable by whoever runs it
  // instead of failing for the first real person who asks to be deleted, halfway
  // through the one operation where a surprise is least acceptable.
  if (!url || !anonKey || !serviceRoleKey) {
    console.log('DELETE-ACCOUNT NOT CONFIGURED: SUPABASE_SERVICE_ROLE_KEY missing');
    return NextResponse.json(
      {
        deleted: false,
        reason: 'not_configured',
        // Written for a person, because this string can reach one.
        message:
          'Your data has been removed, but your sign-in could not be deleted from here. Nothing else is left.',
      },
      { status: 503 }
    );
  }

  // Verify the caller with the ordinary anon client, exactly as every other
  // route does. This proves the bearer token is real and current, and yields the
  // only user id this route will act on.
  const authHeader = request.headers.get('authorization');
  const asUser = createClient(url, anonKey, {
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
  });
  const {
    data: { user },
    error: userError,
  } = await asUser.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ deleted: false, reason: 'unauthorized' }, { status: 401 });
  }

  // The privileged client. Constructed per request rather than at module scope
  // so the key is never held in a long-lived shared object, and with session
  // persistence off because it has no session to persist.
  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.log('DELETE-ACCOUNT ADMIN DELETE FAILED:', error.message);
    return NextResponse.json(
      {
        deleted: false,
        reason: 'delete_failed',
        message:
          'Your data has been removed, but your sign-in could not be deleted. Nothing else is left.',
      },
      { status: 500 }
    );
  }

  // From here the caller's token refers to a user that no longer exists. Any
  // further request with it will fail, which is correct and is why this is the
  // last call the app makes on someone's behalf.
  console.log('DELETE-ACCOUNT COMPLETE');
  return NextResponse.json({ deleted: true });
}
