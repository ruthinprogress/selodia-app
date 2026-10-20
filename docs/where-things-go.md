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
| What still needs illustrating | `Build Specs\Selodia - Movements To Illustrate.xlsx` |
| Finished movement illustrations | `Build Specs\Branding & Assets\Visual Assets\` |

## The movement illustrations, start to finish

Ruth, 18 October 2026, after an afternoon of me re-deriving things that were
already decided: *"make sure the link and whereabouts of the excel sheet are
documented somewhere logical in the build spec, so we dont have a repeat of this
morning's ilustration build confusion."*

So the whole loop, in one place:

| Question | Answer |
| --- | --- |
| What should we draw next? | `Build Specs\Selodia - Movements To Illustrate.xlsx`, ordered by how many times it has been asked for |
| Where does that list come from? | It writes itself. Saving a plan records any movement with no film and no drawing, counted across **every** account. `app/lib/movement-gaps.ts` |
| How do I rebuild the spreadsheet? | `python scripts/movements_to_illustrate_xlsx.py` |
| The same list without Excel | `node scripts/what-to-make-next.mjs` |
| How is a drawing made? | `scripts/illustration-brief.mjs` holds the art direction and every rule learned the expensive way. Prompts are built by `movementPrompt()`, never by hand |
| What are the movements and their start/finish? | `scripts/illustration-progressions.mjs` (the four ladders) and `scripts/illustration-movements.mjs` (everything else) |
| What settings does the generator need? | **`aspect_ratio: "4:5"` and `resolution: "2K"`, set explicitly every time.** The model's own default is **16:9**, so a run that does not set it comes back landscape and unusable. The generate call does not expose the parameter at all - set it with `creative_update_node` first, then `creative_run_flow_nodes` |
| Which model, and with what reference? | `gemini-3-pro-image`, with the style reference asset `obACoUvNT0BEYmJA7kjN` added to the flow as a node and wired in. About 36p a drawing |
| How does a finished drawing get into the app? | `node scripts/upload-illustrations.mjs <folder>` - normalises paper and hair, uploads, records the row, and closes the request |
| Where do the masters live? | `Build Specs\Branding & Assets\Visual Assets\` |
| How does the person who asked find out? | `node scripts/thank-the-requesters.mjs "<movement>"` sends them a thank you |

**The 16:9 default has cost money twice.** It was written down in a memory note
and not in this table, so the second time it was rediscovered by spending 36p on
a landscape picture of a handstand. It is in the table now, which is the only
version of knowing it that survives a new session.

**The spreadsheet is a view, not the record.** `movement_gaps` in Supabase is the
record. The file is rewritten from it each time and can be deleted without
losing anything, which is why it is overwritten in place rather than dated.

## Conventions that already exist there

- **Date-prefix the filename**: `2026-09-23 Selodia flow map - every screen.png`.
  Most files in Visual Assets and Build Specs already do this.
- **Word, not Markdown.** She cannot comfortably read `.md`. Convert with
  `scripts/md2docx.py` before filing anything written.
- **Superseded files get renamed, not deleted.** Prefix with `SUPERSEDED - ` and
  say what replaced it. There are already several. Deleting any of her files
  needs her say-so first.
- **Never write a backup copy next to a file you are editing.** `H:\My Drive` is
  Google Drive, and Drive keeps version history on every file in it. A
  `(backup before append)` copy duplicates protection that is already there, and
  the copy then becomes a thing to reason about.

  Ruth, 4 October 2026: *"Why are there multiple copies of the session close out
  and build log in the folder?"* and *"there's tons of backups across multiple
  files and it's very cluttered."* There were **29** — Build Log, Session
  Closeouts, Open Actionables, Costs and Subscriptions, the FemTech email, the
  Women in Innovation note, the competitor watch — going back to 23 September,
  every one written automatically by a script before an edit that then worked.
  This folder is one of the few places she can see what the project has produced,
  and it had four near-identical documents for every real one.

  If an edit is risky, **guard the write instead**: `build_log_append.py` parses
  the XML and writes nothing unless it is well-formed, which stops the damage
  rather than leaving a copy to recover from. If a restore point is genuinely
  needed, use Drive's own version history (right-click the file → Version
  history). Do not add another copy.

## Two ways in, and when to use each

- **Write to `H:` directly** for images, and for anything large. This is the only
  route for pictures.
- **The Google Drive connector** for text documents, when a link back is wanted
  immediately. It returns a `viewUrl` to paste into the reply.

Either way, **the reply must carry the link or the path.** She works across a
phone and a laptop, and "it's saved" without saying where is not an answer.
