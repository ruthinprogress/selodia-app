# Anything you make for Ruth goes in her Selodía folder

```
H:\My Drive\Selodia App Project Master Folder\
```

That is Google Drive for Desktop, so writing a file there puts it in her Drive.
It is also the only way to get an image into Drive, because the Drive connector
cannot carry pictures.

**Never invent a new folder for Selodía material, and never leave a deliverable
in the scratchpad.** Read `docs/where-things-go.md` before filing anything: it
has the folder map, the naming convention, and the reason `C:\Users\ruthi\Google
Drive` is a decoy. Say where you put it, with the path or the link, every time.

Ruth cannot comfortably read Markdown. Anything written for her gets converted
with `scripts/md2docx.py` first.

# NEVER run an interactive login

Not `vercel login`, not `eas login`, not `expo login`, on any machine, for any
reason. They make a browser session that EXPIRES, and Ruth runs a headless server
where a lapsed session is a locked door with no browser to reopen it.

A missing credential is always fixed with a TOKEN in `.env.local`, never a login.
`node scripts/headless-readiness.mjs` says which are missing and how to get them.

This is enforced: `scripts/check-no-interactive-login.mjs` fails if any file here
names one of those commands without a warning within three lines of it. The way
it goes wrong is never a decision - it is a check printing a fix and somebody
doing what the screen says.

# Before you touch pricing, tiers or turn limits

Read `docs/pricing-and-tiers.md`. It is a DRAFT and nothing in it is built, so
it is a record of decisions rather than a description of the app. It exists
because these numbers were being re-decided from scratch every time the subject
came up. Nothing in it gets implemented without asking Ruth first.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
