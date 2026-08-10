import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Kept for edit-food/delete-food/edit-activity/delete-activity, which only
// existed to support the now-retired web frontend and are unreachable dead
// code as of its retirement. RLS means this client fails closed (empty
// results/denied writes) rather than bypassing anything, so it's harmless -
// not deleting those routes without discussing it first.
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
