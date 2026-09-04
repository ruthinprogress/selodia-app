import { supabase } from '@/lib/supabase';

// Opening a voice session: what has to be true, and in what order.
//
// TWO SEPARATE PROOFS OF IDENTITY, and they are not interchangeable.
//   1. To get a session at all: our own /api/voice/session, authenticated the
//      normal way with the person's Supabase bearer token. It answers with a
//      conversation token minted from the account's ElevenLabs API key, which
//      never leaves the server.
//   2. To be recognised once talking: the SAME Supabase access token, sent
//      again in `customLlmExtraBody`, because ElevenLabs authenticates at the
//      AGENT level and offers no per-conversation header. The adapter reads it
//      back out and the pipeline authenticates exactly as it does for a typed
//      message, so RLS stays in the enforcement path.
//
// The conversation token proves we may open a session on the account. It says
// nothing about WHO is speaking - that is what the second token is for.
//
// A CONVERSATION TOKEN, NOT A SIGNED URL. The React Native SDK is LiveKit
// WebRTC and throws outright on `signedUrl`, because the WebSocket path needs
// Web Audio APIs that React Native does not have.

export type VoiceSessionConfig = {
  conversationToken: string;
  customLlmExtraBody: { selodia_access_token: string };
};

// The one line said aloud when a session cannot be opened.
//
// It is written to be SPOKEN, not read: no status code, no "failed to fetch",
// no apology stack. It also never claims anything about what was or was not
// saved, because at this point nothing has been - and a person who has just
// spoken a meal into a phone needs to know to type it, not to hear an error.
export const VOICE_START_FAILED = "I couldn't start voice just now. You can still type to me.";

export class VoiceSessionError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'VoiceSessionError';
  }
}

// Everything needed to call startSession(), or a throw. Deliberately does NOT
// call the SDK itself: the hook that owns the conversation does that, and
// keeping the credential-handling in one small function makes it easy to see
// that neither token is logged anywhere.
export async function buildVoiceSessionConfig(): Promise<VoiceSessionConfig> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new VoiceSessionError('not signed in');

  const base = process.env.EXPO_PUBLIC_API_URL;
  if (!base) throw new VoiceSessionError('API base URL not configured');

  const res = await fetch(`${base}/api/voice/session`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (!res.ok) {
    // The status is carried for our own logs; it is never what the person
    // hears. 503 means the server has no ElevenLabs credentials configured,
    // which is a different problem from 401 and worth telling apart later.
    throw new VoiceSessionError(`session route returned ${res.status}`);
  }

  const data = (await res.json()) as { token?: unknown };
  if (typeof data.token !== 'string' || data.token.length === 0) {
    throw new VoiceSessionError('session route returned no token');
  }

  return {
    conversationToken: data.token,
    // The field name is ours, not theirs: the adapter looks for
    // `selodia_access_token` first among the keys it accepts.
    customLlmExtraBody: { selodia_access_token: session.access_token },
  };
}
