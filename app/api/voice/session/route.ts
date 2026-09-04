import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseForRequest } from '../../../lib/supabase';

// What the app calls to open a voice session.
//
// ITS WHOLE PURPOSE IS TO KEEP THE API KEY SERVER-SIDE. ElevenLabs mints a
// short-lived credential in exchange for the account's API key, and that key
// must never reach a phone: an EXPO_PUBLIC_ variable is inlined into the bundle
// and readable by anyone with the APK, and this key bills the account. So the
// app asks us, we ask ElevenLabs, and the app gets something that expires
// instead of a credential that does not.
//
// A CONVERSATION TOKEN, NOT A SIGNED URL (changed 2026-09-04). This route used
// to call get-signed-url, which is correct for a WebSocket client and useless
// to the phone. The React Native SDK is LiveKit WebRTC - the WebSocket path
// needs AudioContext and AudioWorkletNode, which React Native does not have -
// and it does not degrade quietly:
//
//   if (options.connectionType === "websocket" || options.signedUrl) throw ...
//
// WebRTC sessions authenticate with a conversation token from a different
// endpoint. The signed-URL version was not wrong, it was right for the harness
// that measured latency over WebSocket; it simply does not carry to a phone.
//
// THE AGENT REQUIRES THIS EITHER WAY. enable_auth was turned on when the agent
// was configured (4 September), so a bare agent ID no longer opens a
// conversation. Before that, anyone holding the ID could have started one on
// the account.
//
// WHAT THIS ROUTE DOES NOT DO, and cannot: it does not attach the person's
// identity to the session. The token endpoint takes an agent_id and nothing
// else. Per-conversation data travels in `custom_llm_extra_body`, which the
// CLIENT sets when it opens the session - not whoever minted the token. So the
// app puts its own Supabase access token there, and the custom-LLM adapter
// reads it back out. The chain is: this route proves who is asking and hands
// over a token; the app proves who it is again, to the adapter, when it speaks.
//
// THE TOKEN IS A CREDENTIAL. It is short-lived, but until it expires it grants
// a conversation on the account. It is never logged, never cached, and never
// returned to an unauthenticated caller.

export const dynamic = 'force-dynamic';

const TOKEN_ENDPOINT = 'https://api.elevenlabs.io/v1/convai/conversation/token';

export async function POST(request: NextRequest) {
  // Same auth as every other route here: the request's own bearer token,
  // checked against Supabase. No session, no conversation token.
  const supabase = getSupabaseForRequest(request);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  if (!apiKey || !agentId) {
    // Names which one is missing, because the two are configured separately and
    // a generic "not configured" would mean checking both. Never prints either.
    console.log(
      'VOICE SESSION: not configured -',
      !apiKey ? 'ELEVENLABS_API_KEY missing' : 'ELEVENLABS_AGENT_ID missing'
    );
    return NextResponse.json({ error: 'Voice is not available' }, { status: 503 });
  }

  try {
    const res = await fetch(`${TOKEN_ENDPOINT}?agent_id=${encodeURIComponent(agentId)}`, {
      method: 'GET',
      headers: { 'xi-api-key': apiKey },
    });

    if (!res.ok) {
      // The body can carry a permissions message worth seeing (this is how the
      // missing convai scope was found), but it is read as text and truncated
      // so a surprise payload cannot dump anything large into a log.
      const detail = await res.text().catch(() => '');
      console.log('VOICE SESSION: ElevenLabs returned', res.status, detail.slice(0, 200));
      return NextResponse.json({ error: 'Voice is not available' }, { status: 502 });
    }

    const data = (await res.json()) as { token?: string; conversation_id?: string };
    const token = data.token;
    if (typeof token !== 'string' || token.length === 0) {
      // A 200 with the wrong shape means their contract moved. Say so plainly
      // rather than handing the app an undefined to connect with.
      console.log('VOICE SESSION: 200 but no token field');
      return NextResponse.json({ error: 'Voice is not available' }, { status: 502 });
    }

    // Deliberately no console.log of a success. There is nothing useful to say
    // that does not risk saying the token. conversation_id is not secret, but
    // it is not logged either - it would only ever be noise here.
    return NextResponse.json(
      { token, conversation_id: data.conversation_id ?? null, agent_id: agentId },
      // Belt and braces: a short-lived credential must not sit in any cache
      // between here and the phone.
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.log('VOICE SESSION: request threw -', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Voice is not available' }, { status: 502 });
  }
}
