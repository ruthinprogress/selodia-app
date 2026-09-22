# The library's new home

**Why this exists.** The Dropbox team trial ended on 22 September 2026 and the
renewal was £172.80 a year. A survey of what was actually in there found the
library being held twice in one account:

| | Size |
|---|---|
| The vendor's bundle, a shared folder added to Dropbox | 127.9 GB |
| `Selodia Team Folder`, a backup copy of that same bundle | 137.9 GB |
| **Total** | **265.8 GB** |

**The two facts that solved it.** A shared folder only counts against your
storage once you *add* it — read by its namespace instead, the same folder is
fully readable and costs nothing. And Backblaze B2 keeps the whole 138 GB for
about 66p a month.

So Dropbox becomes an inbox for new vendor releases, B2 becomes the library, and
Supabase carries on serving the 919 processed clips the app actually shows.

## What lives where

- **B2, `library/`** — the vendor bundle, folder structure exactly as it is in
  Dropbox.
- **B2, `backup/`** — her own additions, most importantly
  `Superseded by vendor re-release`: 265 files the vendor has already replaced
  and no longer offers. This is the only part that exists nowhere else.
- **Supabase `movement-demos`** — the 919 recoloured, labelled clips the app
  serves. 286 MB, unchanged by any of this.

## Running it

Actions → **Mirror the library to B2** → Run workflow, and pick one of:

- **the irreplaceable bit first** — the 265 superseded files, 3.58 GB.
- **everything the app needs** — adds Vertical Videos and Illustrations, ~21 GB.
  Enough to rebuild everything the app serves without Dropbox.
- **the whole bundle** — all 138 GB, one folder per job.

Safe to run again at any time: a file already in the bucket at the same size is
skipped, so an interrupted mirror is finished by pressing the button again.
**Nothing is ever deleted**, in Dropbox or in B2.

`--dry-run` lists what would copy and uploads nothing.

## The order that keeps it safe

1. Mirror to B2 and check the file counts.
2. Remove the vendor's shared folder from Dropbox. This frees 127.9 GB and does
   not delete anything — the folder is theirs, and it can be added back.
3. Confirm the mirror still reads the bundle by namespace with the folder
   unmounted. If it does not, add the folder back; nothing has been lost.
4. Only then delete the duplicate backup folder, with Ruth confirming.
5. Let the Dropbox team lapse to the free tier.

Every step before the last is reversible.

## Secrets

`B2_KEY_ID`, `B2_APP_KEY`, `B2_BUCKET`, alongside the three `DROPBOX_*` ones the
weekly job already uses. Double-click **`backblaze-setup.cmd`** to make the
Backblaze account, save the values to `.env.local`, test the connection, and get
copy buttons for GitHub. No terminal.

## The one thing still unproven

The namespace read has been proved on live data while the vendor folder is still
mounted. Whether it keeps working once the folder is unmounted is step 3 above —
documented Dropbox behaviour says yes, because membership of the share is what
matters rather than whether it sits in your file tree. It is checked before
anything is deleted precisely because it is the one unknown.
