# Dropbox: parked 8 October 2026, with everything already established

**Nothing is at risk.** The animatics are backed up. What is not running is the
weekly CHECK that the library and the Dropbox folder still match. Picking this up
later costs nothing but the gap in that check.

Parked because it consumed most of a working session and it is not blocking the
product. Ruth's time is the scarce thing, and this is a backup verification
script.

## What is known, so none of it has to be worked out again

**The refresh token design is correct and is not the problem.** The scripts hold
a refresh token, not an access token, and exchange it for a fresh one every run.
A Dropbox refresh token does not expire. There is no weekly chore here to design
away, which was the original question.

**What the current key can and cannot do**, probed directly:

| Call | Result |
| --- | --- |
| Exchange the refresh token | 200, healthy |
| `team/members/list_v2` | 200 |
| `team/namespaces/list` | 200 |
| `team/get_info` | 401, `missing_scope` |
| Anything as the member (`Dropbox-API-Select-User`) | 401 |
| Anything as an admin (`Dropbox-API-Select-Admin`) | 401 |

So the key carries `members.read` and `team_data.member` and lacks the
individual file scopes. The boxes have since been ticked in the app console and
submitted; what is missing is a NEW key carrying them, because scopes added after
a key is minted are not in that key.

**Where it stops.** The authorise page returns:

> You must be a team administrator to authorize this app.

**And that should not happen**, which is the open question. The browser is signed
in as `unflumpapp@gmail.com`, confirmed by Ruth from the account menu, and
`team/members/list_v2` reports that exact account as the team's only member, with
role `"Team"` described as "Manage everything and access all permissions". A full
admin being told it is not an admin is the thing nobody has explained.

The error is documented as specific to TEAM scopes, which only a team admin can
grant. That matches the symptom and not the account.

## What was built on the way, and still works

- `scripts/dropbox-auth-doctor.mjs` names which of the three steps failed and
  what that specific failure means, rather than printing a 401.
- `Reauthorise Dropbox.cmd` in the project root: double-click, approve, done. It
  clears its own stuck port, copies the address to the clipboard, and says which
  account is required before she gets there.

Three separate faults were found and fixed getting that far: a URL chopped by
`cmd` at the first ampersand, an abandoned copy holding the port so every later
run died silently, and no error handling to make either visible.

## The recommendation when this is picked up

**Rebuild it as an individual app rather than repairing the team one.**

The app is team-scoped, which is why every call needs team permissions and an
admin to approve them. The scripts do not need any of that: they read one folder.
A new Dropbox app created as a plain "Full Dropbox" individual app, authorised by
`unflumpapp@gmail.com` with NO team scopes, removes the admin question entirely
and simplifies the scripts, which could then drop `team/members/list_v2`, the
`Dropbox-API-Select-User` header and the path-root handling.

Roughly 20 minutes, and it removes the class of problem instead of getting past
it once. An app's type is fixed when it is created, so this is a new app rather
than a setting.

## Also worth doing then

Ruth ticked some WRITE permissions while trying to make it work. Nothing in
Selodia's Dropbox tooling ever writes, moves or deletes: `check-to-process.mjs`
says so in its own header, "READ ONLY, both ends." Those boxes should come off,
and a rebuild is the natural moment.
