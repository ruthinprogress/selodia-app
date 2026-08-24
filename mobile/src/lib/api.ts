import { supabase } from '@/lib/supabase';

// One authenticated POST helper for every backend call.
//
// Extracted from the Chat screen, where it lived as a local function, once a
// second caller needed it (the workout completion tick). Every backend route
// requires a real session and 401s without one, so the token attach is the same
// everywhere and duplicating it would mean two places to get wrong.

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export async function authedPost<T = unknown>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  if (!API_BASE_URL) throw new Error('Backend URL not configured');

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${path} failed (${response.status}): ${text}`);
  }
  return response.json() as Promise<T>;
}
