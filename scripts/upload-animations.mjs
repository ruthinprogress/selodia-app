// ATTACH AN ANIMATION TO AN ILLUSTRATION THAT ALREADY EXISTS.
//
//   node scripts/upload-animations.mjs <folder>
//   node scripts/upload-animations.mjs <folder> --dry-run
//
// THE FILENAME IS THE JOIN KEY, exactly as it is for the stills: "full middle
// splits.mp4" attaches to the illustration "full middle splits".
//
// AN ANIMATION IS AN UPGRADE, NOT A REPLACEMENT, and this script enforces that:
// it REFUSES to attach a clip to a movement with no illustration. The still is
// the poster frame a video needs before it plays and the fallback when a clip
// has not been made, so a row with an animation and no still would be a card
// that flashes black and then shows nothing.
//
// WHERE THE CLIPS COME FROM. The two frames of the still are cut apart and fed
// to an image-to-video model as the start frame and the end frame, so the motion
// is interpolated between two drawings that have already been approved rather
// than invented from one. That matters: a still that is slightly off is a
// disappointment, but a clip showing a knee travelling somewhere knees do not go
// is a form fault - the same line movement-demos.ts draws when it refuses a
// near-miss match.
//
// AND MOST MOVEMENTS WILL NEVER HAVE ONE. Motion earns its place where the
// TRANSITION is the teaching - the cossack weight shift, getting into the
// splits. Two pictures say everything a clip would for a butterfly stretch, and
// the credits are a one-year budget. Null here is the expected state.

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'movement-illustrations';

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) {
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const folder = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
if (!folder) {
  console.log('\n  usage: node scripts/upload-animations.mjs <folder> [--dry-run]\n');
  process.exit(1);
}

const files = fs
  .readdirSync(folder)
  .filter((f) => f.toLowerCase().endsWith('.mp4'))
  .sort();

if (files.length === 0) {
  console.log(`\n  no .mp4 files in ${folder}\n`);
  process.exit(1);
}

console.log(`\n  ${files.length} animations from ${folder}${dryRun ? '   (DRY RUN)' : ''}\n`);

let done = 0;
let refused = 0;

for (const file of files) {
  const joinKey = path.basename(file, path.extname(file)).trim().toLowerCase().replace(/\s+/g, ' ');
  const full = path.join(folder, file);
  const sizeMb = fs.statSync(full).size / (1024 * 1024);

  // THE GUARD, and it belongs here rather than in a reviewer's head: an
  // animation with no still is a broken card, so the row has to exist first.
  const { data: existing, error: lookupError } = await supabase
    .from('movement_illustrations')
    .select('join_key, title, animation_path')
    .eq('join_key', joinKey)
    .maybeSingle();

  if (lookupError) {
    console.log(`  ${joinKey}\n      LOOKUP FAILED  ${lookupError.message}`);
    continue;
  }
  if (!existing) {
    console.log(`  ${joinKey}`);
    console.log('      REFUSED  no illustration for this movement. Upload the still first —');
    console.log('               an animation needs it as its poster frame and its fallback.');
    refused += 1;
    continue;
  }

  const storagePath = `${joinKey.replace(/[^a-z0-9]+/g, '-')}.mp4`;
  console.log(`  ${existing.title}`);
  console.log(
    `      ${sizeMb.toFixed(1)} MB -> ${storagePath}` +
      (existing.animation_path ? '   (replacing an existing clip)' : '')
  );

  if (dryRun) {
    done += 1;
    continue;
  }

  const upload = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fs.readFileSync(full), { contentType: 'video/mp4', upsert: true });
  if (upload.error) {
    console.log(`      UPLOAD FAILED  ${upload.error.message}`);
    continue;
  }

  const { error: rowError } = await supabase
    .from('movement_illustrations')
    .update({ animation_path: storagePath })
    .eq('join_key', joinKey);
  if (rowError) {
    console.log(`      ROW FAILED  ${rowError.message}`);
    continue;
  }
  done += 1;
}

console.log(
  `\n  ${done} of ${files.length} ${dryRun ? 'would be attached' : 'attached'}` +
    (refused > 0 ? `, ${refused} refused for having no illustration` : '') +
    '\n'
);
