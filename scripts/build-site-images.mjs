// THE FAVICON AND THE 1200x630 SHARE IMAGE, built from the real brand assets.
//
//   node scripts/build-site-images.mjs
//
// Ruth, 8 October 2026: "Share image 1200x630, favicon from the seed mark."
//
// BUILT RATHER THAN DRAWN. Both images embed the outlined paths from Logo Asset
// Pack v2.0 exactly as they ship. Nothing is re-set, re-traced or recoloured:
// the lockup's own markup is lifted whole and placed inside a larger canvas, so
// the wordmark on a shared link is the same wordmark as everywhere else.
//
// NO TEXT IS RENDERED. A share image that set the category line as live type
// would need Comfortaa installed on whatever machine ran this script, and a
// missing font substitutes silently rather than failing. The wordmark is in the
// lockup as paths, and the sentence a scraper reads is the `alt` text in
// `homepage-copy.ts`, which is a better home for words anyway.
//
// WRITTEN INTO app/ ON PURPOSE. `app/icon.png` and `app/opengraph-image.png`
// are file conventions: Next finds them by name, emits the <link> and <meta>
// tags itself, and appends a cache-busting hash. There is nothing to wire up,
// and nothing to forget to wire up.

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const CREAM = '#F7F3EA';
const TERRACOTTA = '#C97458';
const SAND = '#E9D6C2';
const SAGE = '#95A987';

const ROOT = process.cwd();
const LOCKUP = path.join(ROOT, 'public', 'brand', 'lockup-stacked-terracotta.svg');
const MARK = path.join(ROOT, 'public', 'brand', 'mark-terracotta.svg');

/**
 * The inside of an SVG and the box it was drawn in.
 *
 * The asset's own markup, untouched. Only the wrapper is discarded, because the
 * wrapper is the thing being replaced.
 */
function inner(file) {
  const svg = fs.readFileSync(file, 'utf8');
  const box = svg.match(/viewBox="([\d.\s-]+)"/);
  if (!box) throw new Error(`${path.basename(file)} has no viewBox`);
  const [, , w, h] = box[1].trim().split(/\s+/).map(Number);
  const open = svg.indexOf('>');
  const close = svg.lastIndexOf('</svg>');
  if (open < 0 || close < 0) throw new Error(`${path.basename(file)} is not one svg element`);
  return { markup: svg.slice(open + 1, close), w, h };
}

/** A soft wash, the same visual language as the hero and drawn the same way. */
function wash() {
  return `
    <defs>
      <filter id="w" x="-25%" y="-25%" width="150%" height="150%">
        <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="4" seed="9" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="44" xChannelSelector="R" yChannelSelector="G"/>
        <feGaussianBlur stdDeviation="9"/>
      </filter>
    </defs>
    <g filter="url(#w)">
      <circle cx="1010" cy="250" r="215" fill="${TERRACOTTA}" opacity="0.46"/>
      <circle cx="1150" cy="440" r="170" fill="${TERRACOTTA}" opacity="0.3"/>
      <circle cx="880" cy="110" r="140" fill="${SAND}" opacity="0.7"/>
      <circle cx="960" cy="470" r="105" fill="${SAND}" opacity="0.5"/>
      <circle cx="905" cy="330" r="22" fill="${SAGE}" opacity="0.6"/>
    </g>`;
}

async function shareImage() {
  const { markup, w, h } = inner(LOCKUP);

  // 330px tall lockup, left-aligned, well clear of the wash on the right. At
  // that height the wordmark is about 261px wide, which is above the
  // all-terracotta colourway's 160px floor.
  const target = 330;
  const scale = target / h;
  const x = 96;
  const y = (630 - target) / 2;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="${CREAM}"/>
    ${wash()}
    <g transform="translate(${x} ${y}) scale(${scale})">${markup}</g>
  </svg>`;

  const out = path.join(ROOT, 'app', 'opengraph-image.png');
  await sharp(Buffer.from(svg), { density: 200 }).resize(1200, 630).png({ quality: 90 }).toFile(out);

  // Twitter reads og:image when there is no twitter:image, but a named file
  // costs 40KB and removes a dependency on that fallback staying true.
  fs.copyFileSync(out, path.join(ROOT, 'app', 'twitter-image.png'));
  return out;
}

async function favicon() {
  const { markup, w, h } = inner(MARK);

  // ON CREAM, NOT TRANSPARENT. A browser tab, a bookmark bar and a phone home
  // screen each paint their own ground, and a transparent terracotta mark
  // disappears on the dark ones.
  const size = 512;
  const pad = 54;
  const scale = (size - pad * 2) / Math.max(w, h);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="96" fill="${CREAM}"/>
    <g transform="translate(${(size - w * scale) / 2} ${(size - h * scale) / 2}) scale(${scale})">${markup}</g>
  </svg>`;

  const out = path.join(ROOT, 'app', 'icon.png');
  await sharp(Buffer.from(svg), { density: 300 }).resize(size, size).png().toFile(out);
  return out;
}

const written = [await shareImage(), await favicon()];

// VERIFIED AFTER WRITING, not assumed. A share image that is the wrong size is
// silently cropped by every platform that reads it.
for (const f of written) {
  const meta = await sharp(f).metadata();
  const bytes = fs.statSync(f).size;
  console.log(
    `  ${path.relative(ROOT, f).replace(/\\/g, '/')}  ${meta.width}x${meta.height}  ${bytes.toLocaleString()} bytes`
  );
}

const og = await sharp(path.join(ROOT, 'app', 'opengraph-image.png')).metadata();
if (og.width !== 1200 || og.height !== 630) throw new Error('share image is not 1200x630');
console.log('\n  share image is 1200x630, favicon is square, both on cream.\n');
