# The Expo bundler, and why it got slow

**Fixed 27 September 2026.** Written down because it cost most of a week of
verification: from Friday to Sunday nothing shipped was ever seen running, and
"restart it" kept half-working, which is the worst kind of answer.

## What was happening

Bundles went from about 15 seconds to 150, then 450, then timing out at 300.
Restarting the dev server helped for a while and then it degraded again.

## The cause, in order

1. **Two Expo dev servers were running on the same project.** `.claude/launch.json`
   had two configurations for the same app - `expo-mobile-web` on port 8081 and
   `expo-web-preview` on 8082. A session started the 8082 one on **21 September**
   and left it; every session afterwards started 8081 beside it. The orphan had
   burned **125 hours of CPU** by the time it was found, with zero connections
   ever made to it.

2. **Both wrote to the same Metro cache**, `%TEMP%\metro-cache`. Two independent
   servers transforming the same modules, writing the same cache keys.

3. **The cache became unwritable.** Metro logged
   `Cache write failed for store(s): BinaryFileStore` **54,817 times** - about
   4,177 per bundle, every bundle.

4. **So nothing was ever cached**, and every bundle re-transformed every module
   from scratch. That is the whole of the slowness.

## What was ruled out, and how

Worth recording so nobody re-checks them:

- **Disk space** - 39 GB free.
- **Directory permissions** - 400 write-and-rename cycles into the cache root,
  400 succeeded, no retries needed.
- **Windows file-lock collisions** - six processes renaming onto twelve shared
  targets, 360 cycles, zero failures. This was the best hypothesis and it was
  wrong.
- **Controlled Folder Access** - disabled.
- **Path length** - longest cache path 122 characters.
- **A self-feeding watcher loop** - the log inside the watched tree was not
  growing while idle.

## The fix

- The orphaned server was stopped.
- `%TEMP%\metro-cache` was deleted (2,637 files). Write errors went to **zero**
  immediately and have stayed there.
- **The duplicate launch configuration was removed.** One Expo app, one port,
  one cache. Two configurations for one app is what made this possible, and it
  would have happened again.

Measured after: warm bundle **27 seconds**, cold **254**, cache errors **0**.

## If it comes back

Check for more than one `expo` process first:

```
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Select ProcessId, CommandLine
```

Then check whether the cache is refusing writes:

```
Select-String -Path mobile/.expo/dev/logs/start.log -Pattern cache_write_error | Measure-Object
```

A non-zero count there means the cache is doing nothing, whatever its size.
Clearing `%TEMP%\metro-cache` is safe - it is a cache - and is the first thing
to try. **Do not just restart the server:** that buys one session and hides the
cause, which is how this ran for a week.
