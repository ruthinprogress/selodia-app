// THE HERO ARTWORK, COMPRESSED FOR THE WEB.
//
//   node scripts/build-hero-artwork.mjs <wide.png> <tall.png>
//
// Ruth, 8 October 2026: two artwork files, wide for desktop and tall for
// phones, used as the hero background. The previous homepage drew its own
// watercolour in SVG because these files had not reached the repository. They
// have now, so the drawn version is deleted and these are the artwork.
//
// WHY THIS SCRIPT EXISTS RATHER THAN A DRAG AND DROP. They arrive as PNGs at
// about 2MB each. A hero that costs 2MB on a phone is a hero most of the
// audience never sees, and this audience is not on fast connections by
// definition. WebP at quality 80 takes a watercolour wash down by roughly 95%
// with no visible difference, because there is no hard edge in the image for
// the codec to ruin.
//
// NOT SCALED UP, which is her instruction. Each is written at its own natural
// width and the CSS never asks for more. A second, smaller copy is written for
// phones so a 390px screen does not download a 1774px image.
//
// VERIFIED AFTER WRITING. Dimensions and file sizes are measured from the files
// on disk and printed, and the script fails if anything came out larger than
// the source.

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const OUT = path.join(process.cwd(), 'public', 'brand');

const JOBS = [
  { name: 'hero-wide', src: process.argv[2], widths: [1774, 1100] },
  { name: 'hero-tall', src: process.argv[3], widths: [1072, 720] },
];

if (!JOBS.every((j) => j.src && fs.existsSync(j.src))) {
  console.log('\n  Usage: node scripts/build-hero-artwork.mjs <wide.png> <tall.png>\n');
  process.exit(2);
}

fs.mkdirSync(OUT, { recursive: true });

for (const job of JOBS) {
  const meta = await sharp(job.src).metadata();
  const srcBytes = fs.statSync(job.src).size;
  console.log(`\n  ${job.name}  source ${meta.width}x${meta.height}  ${(srcBytes / 1024).toFixed(0)}KB`);

  for (const w of job.widths) {
    // NEVER WIDER THAN THE SOURCE. Enlarging a watercolour makes it soft and
    // heavier at the same time, and she asked for it not to be scaled up.
    if (w > meta.width) {
      console.log(`    skip ${w}: wider than the source`);
      continue;
    }
    const file = path.join(OUT, `${job.name}-${w}.webp`);
    await sharp(job.src).resize({ width: w }).webp({ quality: 80, effort: 6 }).toFile(file);
    const out = await sharp(file).metadata();
    const bytes = fs.statSync(file).size;
    if (bytes >= srcBytes) throw new Error(`${file} is no smaller than the source`);
    console.log(
      `    ${path.basename(file)}  ${out.width}x${out.height}  ${(bytes / 1024).toFixed(0)}KB  ` +
        `(${(100 - (bytes / srcBytes) * 100).toFixed(1)}% smaller)`
    );
  }
}

console.log('');
