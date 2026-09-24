import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// The sessionless client, for the one thing that genuinely has no session: the
// public waitlist signup on the landing page, where the person filling the form
// has no account yet. That is the correct use of an anon client rather than a
// tolerated one.
//
// It used to also back edit-food/delete-food/edit-activity/delete-activity, and
// this comment used to argue they were harmless because RLS fails them closed.
// True, and beside the point - those routes were deleted on 2026-09-09 because
// their SCHEMA was wrong, not their auth (see log-correction.ts). Anything that
// acts on a person's own data belongs on getSupabaseForRequest below, so
// auth.uid() resolves to them.
export const supabase = createClient(supabaseUrl, supabaseKey);

// RLS is enabled on every table now - each request must forward its own
// user's session so auth.uid() resolves correctly, rather than sharing one
// sessionless client across all requests.
export function getSupabaseForRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  return createClient(supabaseUrl, supabaseKey, {
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
  });
}

// WHO IS ASKING, WITHOUT A ROUND TRIP TO THE AUTH SERVER.
//
// WHY. supabase.auth.getUser() posts the token to Supabase Auth and waits for
// an answer. Measured on this project on 2026-09-24 it cost 500ms to 760ms at
// the very front of every spoken turn, before a single line of the actual work
// had started - about a fifth of the whole turn, spent asking a question the
// token already answers.
//
// The project signs its tokens with ES256 and publishes the public half at
// /auth/v1/.well-known/jwks.json, so the signature can be checked here. No
// hand-rolled crypto: getClaims() is the supported call for exactly this, and
// it validates the signature and the expiry.
//
// IT VERIFIES ON THE SHARED CLIENT ON PURPOSE. auth-js caches the JWKS on the
// client instance, and getSupabaseForRequest builds a fresh client per request
// - so verifying on that one would refetch the keys every time and save
// nothing. The module-level client lives as long as the warm instance does, so
// the keys are fetched once and every turn after is local arithmetic.
//
// WHAT THIS DOES NOT CHANGE. RLS is still the enforcement. Every query goes
// out on a client carrying the person's own Authorization header, and PostgREST
// validates that token itself on every single statement - so a forged token
// cannot read or write a row here whatever this function decides.
//
// WHAT IT DOES COST, STATED PLAINLY. A signed-out session's token stays
// acceptable to this check until it expires, where getUser() would have
// rejected it at once. Supabase access tokens last an hour. That is the
// standard trade for local verification and it is the reason this function
// exists rather than a comment saying it was free.
export async function userIdForRequest(request: NextRequest): Promise<string | null> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;

  try {
    const { data, error } = await supabase.auth.getClaims(token);
    const claims = data?.claims;
    // BOTH CHECKS MATTER. The project's own anon key is itself a JWT signed by
    // this project, and it would pass a signature check - it simply carries
    // role "anon" and no subject. Requiring an authenticated role AND a subject
    // is what keeps a publishable key from being mistaken for a person.
    if (!error && claims && claims.role === 'authenticated' && typeof claims.sub === 'string' && claims.sub) {
      return claims.sub;
    }
  } catch {
    // Falls through to the network check below rather than rejecting: a JWKS
    // fetch that failed is our problem, not evidence about this token.
  }

  // THE FALLBACK IS THE OLD PATH, AND IT IS NOT A WAY IN. A token that failed
  // above because it is invalid fails here too, because this asks the Auth
  // server. The fallback exists for the case where the check could not RUN -
  // keys unavailable, an algorithm we do not know, a shape that changed - where
  // being slow is the right answer and being wrong is not.
  const { data, error } = await getSupabaseForRequest(request).auth.getUser();
  if (error || !data?.user) return null;
  return data.user.id;
}

// The service role bypasses RLS, so it is used for exactly one thing: minting
// signed URLs for the private movement-demos bucket. That bucket has no storage
// policy for end users at all - deliberately, because Exercise Animatic's licence
// (ToS 8.4) forbids allowing end users to download or extract the files, and a
// bucket the client cannot address is the strongest form of that. The key never
// leaves the server and never reaches the mobile app.
export function getSupabaseServiceRole() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}
