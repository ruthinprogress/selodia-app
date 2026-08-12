import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// The backend was originally same-origin with its (now-retired) web
// frontend, so no CORS handling ever existed. The mobile app calls this
// API cross-origin (a separate Vercel domain), which browsers block via
// preflight without these headers - native app requests aren't subject to
// CORS at all, so this only matters for the web preview/browser clients.
// No credentials (cookies) are used - auth is a Bearer token - so a
// wildcard origin doesn't introduce CSRF exposure.
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export function middleware(request: NextRequest) {
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: corsHeaders() });
  }

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(corsHeaders())) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
