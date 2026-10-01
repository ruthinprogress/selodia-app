# How Selodía gets to production

Written 1 October 2026, after I told Ruth something confidently wrong about this
and wasted a slice of her morning on it. The last section is that story, because
the shape of the mistake is more useful than the correction.

## The short version

**One Vercel project. Push to `main` and it is live in about a minute.**

| | |
|---|---|
| Vercel project | `selodia-app` |
| Project id | `prj_XmdCSQK6WwMtZPNh6yCCVxKeQOat` |
| Team | `ruthinprogress-projects` / `team_l9Ts8pCYpUMxLMxHKgZjmjhX` |
| GitHub | `ruthinprogress/selodia-app`, production branch `main` |
| Domains | `selodia.app`, `api.selodia.app`, `www.selodia.app`, `unflump-app.vercel.app` |
| Function region | `lhr1` (London), set in `vercel.json` |

There is no staging project and no second production project. Every one of those
domains is an alias on the same deployment, which is what keeps the app and its
API running the same code.

### Why `unflump-app.vercel.app` is still there

The project was **renamed** from `unflump-app` to `selodia-app` on 4 September
2026. A rename does not revoke an explicitly assigned alias, so that host is
still live and still serving — **deliberately**, because any phone build from
before the host change still calls it. `mobile/WORKFLOW.md` is the record, and
says the thing worth repeating: removing it with `vercel alias rm` is the step
that actually breaks those installs, and it is harder to undo than the rename
was, because the name goes back into Vercel's pool.

So leave it. It is not a leftover and it is not a second project.

## The two halves, and they ship separately

This is the thing most likely to catch somebody out, and it has caught me:

- **The server** is this Next.js app on Vercel: `/api/ask-selodia`, the voice
  adapter at `/v1/chat/completions`, the report routes, the public pages. It goes
  live on a push to `main`.
- **The phone app** is `mobile/`, shipped as an Expo OTA update, and a push does
  NOT ship it. It needs `npx eas-cli update` from `mobile/` (see the EAS note in
  memory — `npx eas` fails on this machine).

So a change touching both needs a push AND an update, and a prompt or route
change needs only the push. `fallbackToCacheTimeout: 0` means an OTA applies on
the NEXT launch, so Ruth has to fully close the app and reopen it.

## Deploying

Nothing to do. Push to `main`:

```bash
git push
```

Vercel builds and, when it finishes, moves `selodia.app`, `api.selodia.app` and
`www.selodia.app` onto the new deployment. The build takes roughly 30–40 seconds
and the alias swap is near-instant after that. **An absence a minute after a push
is not evidence of anything** — see the failure story below.

Confirm it arrived:

```bash
node scripts/check-live-deployment.mjs
```

That answers the only question worth asking — *what sha is serving selodia.app,
and is it `main`?* It fails if production is behind, fails if production is
ahead, and fails if the domains have come apart onto different deployments. It
skips, rather than failing, on a machine with no Vercel credentials.

Then confirm it *works*, which is not the same question:

```bash
node scripts/smoke-production.mjs
```

Four calls on the demo account — a static page, chat, a voice session token, and
the voice adapter. The voice session call is the only thing anywhere that proves
`ELEVENLABS_API_KEY` is present and valid on this project; a build log never
will. Costs a fraction of a penny in model tokens and writes two chat messages to
the demo account.

### A manual deploy, and why to avoid it

```bash
npx vercel deploy --prod --yes
```

This builds the **working tree**, not a commit, so it can put code into
production that is not on `main` and leaves nothing in git explaining what is
running. `check-live-deployment.mjs` reports that as *ahead of origin/main*, and
that is a failure on purpose. Use it only when a push genuinely cannot be used,
and push the same code immediately afterwards.

Note that `npx vercel --prod` (without `deploy`) prints help and does nothing.
That is easy to mistake for a successful deploy, because it exits 0.

## Environment variables

26 of them, all on the `selodia-app` project, read through the Vercel dashboard
or `npx vercel env ls`. Values are not in this repo and not in this file.

Groups, so a missing one can be recognised:

- `ANTHROPIC_API_KEY` — every model call.
- `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_VOICE_ID` — voice.
  These three exist for production, preview AND development.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — the browser-visible Supabase pair.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` —
  the server side.
- `POSTGRES_*` (8) — from the Supabase integration.

Everything except the ElevenLabs trio is production-only, so a preview
deployment cannot reach the database or the model. That is a reasonable default
and worth knowing before wondering why a preview URL does nothing.

Local work reads `.env.local`, which is gitignored and is what the `scripts/`
probes use.

## Region

`vercel.json` sets `{"regions": ["lhr1"]}`. This matters and was wrong for six
days: `preferredRegion` in a route file is **Edge runtime only** and is silently
inert on Node functions, so the setting sat in the code doing nothing from 24
September until 1 October. The proof it is working is a doubled region in the
response header:

```bash
curl -s -I https://selodia.app/support | grep -i x-vercel-id
# x-vercel-id: lhr1::...
```

## How I got this wrong, and what fixed it

On 1 October I told Ruth there were two Vercel projects, that pushing to GitHub
deployed an unaliased one, and that a server change which was only pushed would
never reach her phone. All of it was false. Two causes, and they are the same
cause twice — **a name read instead of an identity**:

1. `.vercel/project.json` on this machine still said
   `"projectName": "unflump-app"` after the project was renamed to
   `selodia-app`. It holds the correct `projectId`, so every deploy had always
   gone to the right place — but the CLI prints the stale *name*. `vercel ls`
   then labelled CLI deploys `unflump-app` and git deploys `selodia-app`, in one
   listing, which reads exactly like two projects. `vercel inspect selodia.app`
   agreed, for the same reason.
2. I ran `vercel ls` about a minute after pushing, saw nothing newer than my last
   manual deploy, and concluded pushes do not auto-deploy. The build was in
   flight at that moment.

The local file is corrected. If the CLI ever names a project you do not
recognise, trust `projectId` and re-link with `npx vercel link`.

The real fix is that none of this is a question of care any more. "Which project
serves selodia.app, what sha is on it, and is that `main`?" is now one command
with a pass or a fail, and it would have refused the wrong answer the moment I
asked it. See `scripts/check-live-deployment.mjs`.
