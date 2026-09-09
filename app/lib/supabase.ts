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
