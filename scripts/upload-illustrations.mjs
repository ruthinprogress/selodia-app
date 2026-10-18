// PUT A FOLDER OF ILLUSTRATIONS INTO THE APP.
//
//   node scripts/upload-illustrations.mjs <folder>
//   node scripts/upload-illustrations.mjs <folder> --dry-run
//
// THE FILENAME IS THE JOIN KEY. "frog stretch.png" becomes the movement "frog
// stretch", which is what resolve_illustration_refs matches a plan's exercise name
// against - an exact name or an exact word set, never anything weaker. So the file is
// named for the movement and nothing else: no numbers, no "v2", no "final".
//
// WHY THE BACKGROUND IS REWRITTEN HERE RATHER THAN ASKED FOR IN THE PROMPT.
//
// The brand cream is #F7F3EA. Across one afternoon the generator returned #FAF4E9,
// #FDF6E6, #FBEED5 and #F7EFE2 - all of them "cream", none of them the same, and the
// worst nearly three times as yellow as the target. Ruth spotted it by eye before any
// measurement: "the background looks yellow."
//
// No amount of saying the hex works, because the model is painting, not filling. But
// it is trivially fixable afterwards, and fixing it here means every file in the
// library is identical by construction rather than by luck - which matters far more
// for a set of a hundred shown together than for any one picture.
//
// IT IS A SELECTIVE SHIFT, NOT A GLOBAL ONE. Only pixels close to the detected paper
// colour are moved, and each keeps its own small deviation from that paper, so the
// watercolour grain survives. A global transform would drag the sage and the terracotta
// with it and change the artwork.
//
// THE FIGURE'S INTERIOR MOVES TOO, and that is correct. The body is unfilled - the
// paper shows through it - so body and background must land on the same colour or the
// figure acquires a faint outline it was never drawn with.

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

import { PROGRESSIONS } from './illustration-progressions.mjs';
import {
  TARGET_PAPER as TARGET,
  TARGET_HAIR,
  PAPER_TOLERANCE,
  normaliseHair,
  normalisePaper as shiftPaper,
} from './illustration-colour.mjs';

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
  console.log('\n  usage: node scripts/upload-illustrations.mjs <folder> [--dry-run]\n');
  process.exit(1);
}

/** Which progression a movement belongs to, and where in it. Null for a loose movement. */
function placeInProgression(joinKey) {
  for (const [progression, stages] of Object.entries(PROGRESSIONS)) {
    const index = stages.findIndex((s) => s.name.toLowerCase() === joinKey);
    if (index >= 0) return { progression, stage: index + 1 };
  }
  return { progression: null, stage: null };
}

/**
 * Move the paper to exactly the brand cream, carrying each pixel's own deviation with
 * it so the grain is preserved. Returns the png bytes and what it found, so the caller
 * can report how far off the generator was.
 */
async function normalisePaper(file) {
  const image = sharp(file);
  const { width, height } = await image.metadata();
  const raw = await image.raw().toBuffer();
  const channels = raw.length / (width * height);

  // The paper is whatever the corners are. Nothing is ever drawn in the corners: the
  // brief puts the figure small in the middle with generous empty space around it.
  const at = (x, y) => {
    const i = (y * width + x) * channels;
    return { r: raw[i], g: raw[i + 1], b: raw[i + 2] };
  };
  const corners = [at(4, 4), at(width - 5, 4), at(4, height - 5), at(width - 5, height - 5)];
  const paper = {
    r: Math.round(corners.reduce((n, c) => n + c.r, 0) / corners.length),
    g: Math.round(corners.reduce((n, c) => n + c.g, 0) / corners.length),
    b: Math.round(corners.reduce((n, c) => n + c.b, 0) / corners.length),
  };

  const { movedShare } = shiftPaper(raw, width, height, channels, paper);

  const hairReport = normaliseHair(raw, width, height, channels);

  const png = await sharp(raw, { raw: { width, height, channels } }).png().toBuffer();
  return { png, paper, movedShare, hair: hairReport };
}


const hex = (c) => `#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0').toUpperCase()).join('')}`;

const files = fs
  .readdirSync(folder)
  .filter((f) => f.toLowerCase().endsWith('.png'))
  .sort();

if (files.length === 0) {
  console.log(`\n  no .png files in ${folder}\n`);
  process.exit(1);
}

console.log(`\n  ${files.length} illustrations from ${folder}${dryRun ? '   (DRY RUN)' : ''}\n`);

let done = 0;
for (const file of files) {
  const joinKey = path.basename(file, path.extname(file)).trim().toLowerCase().replace(/\s+/g, ' ');
  const title = joinKey.charAt(0).toUpperCase() + joinKey.slice(1);
  const { progression, stage } = placeInProgression(joinKey);
  const storagePath = `${joinKey.replace(/[^a-z0-9]+/g, '-')}.png`;

  const { png, paper, movedShare, hair } = await normalisePaper(path.join(folder, file));
  const drift = Math.max(
    Math.abs(paper.r - TARGET.r),
    Math.abs(paper.g - TARGET.g),
    Math.abs(paper.b - TARGET.b)
  );

  console.log(`  ${title}`);
  console.log(
    `      paper ${hex(paper)} -> ${hex(TARGET)}   drift ${drift}   ${(movedShare * 100).toFixed(0)}% of pixels` +
      (progression ? `   ${progression} ${stage}` : '')
  );
  console.log(
    hair.found
      ? `      hair  ${hex(hair.mean)} -> ${hex(TARGET_HAIR)}   ` +
          `shift ${hair.shift.r >= 0 ? '+' : ''}${hair.shift.r},` +
          `${hair.shift.g >= 0 ? '+' : ''}${hair.shift.g},` +
          `${hair.shift.b >= 0 ? '+' : ''}${hair.shift.b}   ${hair.pixels} px`
      : `      hair  NO BUN FOUND (${hair.pixels} px) - left alone`
  );

  if (dryRun) {
    done += 1;
    continue;
  }

  const upload = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, png, { contentType: 'image/png', upsert: true });
  if (upload.error) {
    console.log(`      UPLOAD FAILED  ${upload.error.message}`);
    continue;
  }

  // Upsert, not insert. Re-running this after regenerating one movement is the normal
  // case - the library is built in small batches and corrected in place.
  const row = await supabase
    .from('movement_illustrations')
    .upsert({ join_key: joinKey, title, storage_path: storagePath, progression, stage }, { onConflict: 'join_key' });
  if (row.error) {
    console.log(`      ROW FAILED  ${row.error.message}`);
    continue;
  }
  done += 1;
}

console.log(`\n  ${done} of ${files.length} ${dryRun ? 'would be uploaded' : 'uploaded and recorded'}\n`);
