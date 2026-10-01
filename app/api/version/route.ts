import { NextResponse } from 'next/server';

// WHICH COMMIT IS PRODUCTION ACTUALLY RUNNING?
//
// Ruth, 1 October 2026: "Do NOT report any of these done on a passing test alone.
// Prove which commit production is running. Your Vercel token has expired, so add
// a /api/version endpoint that returns the deployed commit hash."
//
// She is right that the question was unanswerable. Twice today I ran
// `npx vercel deploy --prod --yes >/dev/null 2>&1` with an EXPIRED token, piped
// the output to nothing, and then "confirmed" the deploy by curling /support and
// getting a 200 - which proves the site is up and says nothing whatsoever about
// whose code is on it. A 200 from a server that has been running since yesterday
// looks exactly like a 200 from one deployed a minute ago.
//
// The deploy check that should have caught it reads the Vercel API with the same
// dead token and skips. So the only honest instrument is the running server
// stating its own identity, which costs nothing and cannot be inferred wrongly.
//
// VERCEL_GIT_COMMIT_SHA is set by Vercel at build time for a git deployment, so
// this is the commit the build came from rather than anything this code worked
// out. On a CLI deploy from a working tree there is no commit and it says so -
// "deployed from a working tree" is a real and important answer, because it means
// production is running code that is on no commit at all.
//
// NOTHING PERSONAL, NO AUTH. It returns a commit hash and a timestamp, which is
// the same class of fact as the version string at the foot of a settings screen.
// It must stay that way: this is a public endpoint and the temptation to add "and
// here is what else I know" is how a diagnostic becomes a leak.

export const dynamic = 'force-dynamic';

export function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? null;
  return NextResponse.json({
    commit: sha,
    short: sha ? sha.slice(0, 7) : null,
    // Absent on a CLI deploy, which is exactly when it matters most.
    builtFrom: sha ? 'git' : 'working tree (no commit)',
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    message: process.env.VERCEL_GIT_COMMIT_MESSAGE ?? null,
    environment: process.env.VERCEL_ENV ?? 'unknown',
    region: process.env.VERCEL_REGION ?? null,
    now: new Date().toISOString(),
  });
}
