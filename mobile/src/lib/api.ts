import { supabase } from '@/lib/supabase';

// One authenticated POST helper for every backend call.
//
// Extracted from the Chat screen, where it lived as a local function, once a
// second caller needed it (the workout completion tick). Every backend route
// requires a real session and 401s without one, so the token attach is the same
// everywhere and duplicating it would mean two places to get wrong.

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

// A failed call carries its status, so callers can tell the difference between
// "the server said no" and "there was no server".
//
// Added 2026-09-09 after item 36 shipped without it. The movement demo renders
// nothing when a movement has no clip, which is correct - but the route had not
// been deployed, so every call 404ed and every exercise looked like a coverage
// gap. A silent feature and an unreachable one were indistinguishable, on the
// phone and in the logs. They are different problems and now they read as
// different problems.
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static async from(path: string, response: Response): Promise<ApiError> {
    let detail = '';
    try {
      detail = (await response.text()).slice(0, 200);
    } catch {
      // A body that cannot be read must not replace the status, which is the
      // part that actually says what went wrong.
    }
    return new ApiError(`${path} failed (${response.status}): ${detail}`, response.status, path);
  }

  // 404 on one of our own routes never means "not found" in the domain sense -
  // every route answers with a 200 and a null when it has nothing. It means the
  // route is not there: an undeployed build, or a path that no longer exists.
  get isNotDeployed(): boolean {
    return this.status === 404;
  }
}

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
    throw await ApiError.from(path, response);
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
    throw await ApiError.from(path, response);
  }
  return response.json() as Promise<T>;
}
