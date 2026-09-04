import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseForRequest } from '../../../lib/supabase';

// What the app calls to open a voice session.
//
// ITS WHOLE PURPOSE IS TO KEEP THE API KEY SERVER-SIDE. ElevenLabs mints a
// short-lived signed WebSocket URL in exchange for the account's API key, and
// that key must never reach a phone: an EXPO_PUBLIC_ variable is inlined into
// the bundle and readable by anyone with the APK, and this key bills the
// account. So the app asks us, we ask ElevenLabs, and the app gets a URL that
// expires instead of a credential that does not.
//
// THE AGENT NOW REQUIRES THIS. enable_auth was turned on when the agent was
// configured (4 September), so a bare agent ID no longer opens a conversation.
// Before that, anyone holding the ID could have started one on the account.
//
// WHAT THIS ROUTE DOES NOT DO, and cannot: it does not attach the person's
// identity to the session. get-signed-url takes an agent_id and nothing else.
// Per-conversation data travels in `extra_body`, which is part of
// ConversationInitiationData and is set by the CLIENT when it opens the
// WebSocket - not by whoever minted the URL. So the app puts its own Supabase
// access token there, and the custom-LLM adapter reads it back out. The chain
// is: this route proves who is asking and hands over a URL; the app proves who
// it is again, to the adapter, when it speaks.
//
// THE SIGNED URL IS A CREDENTIAL. It is short-lived, but until it expires it
// grants a conversation on the account. It is never logged, never cached, and
// never returned to an unauthenticated caller.

export const dynamic = 'force-dynamic';

const SIGNED_URL_ENDPOINT = 'https://api.elevenlabs.io/v1/convai/conversation/get-signed-url';

export async function POST(request: NextRequest) {
  // Same auth as every other route here: the request's own bearer token,
  // checked against Supabase. No session, no signed URL.
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
    const res = await fetch(`${SIGNED_URL_ENDPOINT}?agent_id=${encodeURIComponent(agentId)}`, {
      method: 'GET',
      headers: { 'xi-api-key': apiKey },
    });

    if (!res.ok) {
      // The body can carry a permissions message worth seeing (this is how the
      // missing convai_write scope was found), but it is read as text and
      // truncated so a surprise payload cannot dump anything large into a log.
      const detail = await res.text().catch(() => '');
      console.log('VOICE SESSION: ElevenLabs returned', res.status, detail.slice(0, 200));
      return NextResponse.json({ error: 'Voice is not available' }, { status: 502 });
    }

    const data = (await res.json()) as { signed_url?: string };
    const signedUrl = data.signed_url;
    if (typeof signedUrl !== 'string' || signedUrl.length === 0) {
      // A 200 with the wrong shape means their contract moved. Say so plainly
      // rather than handing the app an undefined to connect to.
      console.log('VOICE SESSION: 200 but no signed_url field');
      return NextResponse.json({ error: 'Voice is not available' }, { status: 502 });
    }

    // Deliberately no console.log of a success. There is nothing useful to say
    // that does not risk saying the URL.
    return NextResponse.json(
      { signed_url: signedUrl, agent_id: agentId },
      // Belt and braces: a short-lived credential must not sit in any cache
      // between here and the phone.
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.log('VOICE SESSION: request threw -', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Voice is not available' }, { status: 502 });
  }
}
