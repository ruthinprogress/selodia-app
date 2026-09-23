# Where things go

Ruth has one folder for everything Selodía. Anything produced for her belongs in
it. **Never create a new folder for Selodía material anywhere else**, and never
leave a deliverable in the session scratchpad, which is a temp directory that
gets cleared.

## The one true location

```
H:\My Drive\Selodia App Project Master Folder\
```

`H:` is Google Drive for Desktop. Writing a file there puts it in her Drive, and
it syncs on its own. **This is how images get into Drive** — the Drive connector
can upload text documents but not pictures, because a base64 image is too large
to pass through a tool call.

**If `H:` is not there**, Drive for Desktop has been given a different letter or
is not running. Find it before guessing:

```bash
ls -d /*/"My Drive"/"Selodia App Project Master Folder" 2>/dev/null
```

Do not fall back to `C:\Users\ruthi\Google Drive`. That is a stale legacy sync
folder holding her old personal files, and it does not contain the project. It
looked convincing once and cost an afternoon.

## The map

Under `Selodia App Project Master Folder\`:

| Put this | Here |
| --- | --- |
| Build documents, specs, reports | `Build Specs\` |
| Approved visuals, mockups, screenshots | `Build Specs\Branding & Assets\Visual Assets\` |
| Brand files, logo kits, manifesto | `Build Specs\Branding & Assets\` |
| Articles and marketing copy | `Build Specs\Branding & Assets\Marketing Articles and Copy\` |
| ElevenLabs correspondence and notes | `Build Specs\Elevenlabs\` |
| Exercise animatic material | `Build Specs\Excersise Animatics\` |
| Bug screenshots from her phone | `Build Specs\Debugging screenshots\` |
| Milestone images for the build log | `Build Log images\` |
| Costs, invoices, subscriptions | `Build Specs\Selodia Costs and Subscriptions.xlsx` |
| Session close-outs | `Build Specs\Selodia-Session-Closeouts.xlsx` |

## Conventions that already exist there

- **Date-prefix the filename**: `2026-09-23 Selodia flow map - every screen.png`.
  Most files in Visual Assets and Build Specs already do this.
- **Word, not Markdown.** She cannot comfortably read `.md`. Convert with
  `scripts/md2docx.py` before filing anything written.
- **Superseded files get renamed, not deleted.** Prefix with `SUPERSEDED - ` and
  say what replaced it. There are already several. Deleting any of her files
  needs her say-so first.

## Two ways in, and when to use each

- **Write to `H:` directly** for images, and for anything large. This is the only
  route for pictures.
- **The Google Drive connector** for text documents, when a link back is wanted
  immediately. It returns a `viewUrl` to paste into the reply.

Either way, **the reply must carry the link or the path.** She works across a
phone and a laptop, and "it's saved" without saying where is not an answer.
