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

// The GET counterpart, added for /api/movement-demo (item 36). Same token
// attach, same failure shape - it exists because a signed URL is a READ and
// posting to fetch one would have been a lie about what the call does.
export async function authedGet<T = unknown>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  if (!API_BASE_URL) throw new Error('Backend URL not configured');

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');

  const qs = new URLSearchParams(params).toString();
  const response = await fetch(`${API_BASE_URL}${path}${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${path} failed (${response.status}): ${text}`);
  }
  return response.json() as Promise<T>;
}
