// THE ALL-TERRACOTTA COLOURWAY, MADE BY RECOLOURING RATHER THAN REDRAWING.
//
//   node scripts/logo-terracotta-colourway.mjs
//
// Ruth, 8 October 2026: a new colourway, mark and wordmark both #C97458, for
// large display use on cream and sand. Generated from the existing outlined
// paths in Logo Asset Pack v2.0. The wordmark is not re-set and nothing is
// redrawn.
//
// WHY THAT IS LITERALLY TRUE HERE and not just an intention. The existing
// terracotta-charcoal transparent lockups contain exactly two colours: #C97458
// on the group holding the mark, and #2D2B28 on the wordmark paths. The whole
// change is one substitution. The path data is byte-identical to the file it
// came from, which a check below asserts rather than assumes.
//
// IT WRITES NEW FILES ONLY. Nothing existing is overwritten, and the script
// refuses rather than replacing anything already there.
//
// THE PDFs IN THIS PACK ARE RASTER, which was a surprise worth recording. The
// v2.0 PDFs were made with ReportLab and embed an image; there is no vector
// path data in them. These match that, by the same method and the same tool, so
// the new colourway is consistent with its siblings rather than quietly better
// than them. See the report for what that means for print.

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';

const run = promisify(execFile);

const PACK =
  'H:/My Drive/Selodia App Project Master Folder/Build Specs/Branding & Assets/Logo Asset Pack v2.0';

const CHARCOAL = '#2D2B28';
const TERRACOTTA = '#C97458';

/** px to pt at 96dpi, which is the ratio the v2.0 PDFs were built at. */
const PT_PER_PX = 0.75;

const JOBS = [
  {
    dir: 'stacked-lockups',
    from: 'selodia-lockup-stacked-terracotta-charcoal-transparent.svg',
    to: 'selodia-lockup-stacked-terracotta-transparent',
  },
  {
    dir: 'horizontal-lockups',
    from: 'selodia-lockup-horizontal-terracotta-charcoal-transparent.svg',
    to: 'selodia-lockup-horizontal-terracotta-transparent',
  },
];

const SIZES = [512, 1024, 2048];

function viewBoxOf(svg) {
  const m = svg.match(/viewBox="([\d.\s-]+)"/);
  if (!m) throw new Error('no viewBox');
  const [, , w, h] = m[1].trim().split(/\s+/).map(Number);
  return { w, h };
}

/** The path data only, so a recolour can be proved to have changed nothing else. */
function pathsOf(svg) {
  return (svg.match(/ d="[^"]+"/g) ?? []).join('');
}

async function main() {
  const written = [];

  for (const job of JOBS) {
    const srcPath = path.join(PACK, job.dir, job.from);
    const src = fs.readFileSync(srcPath, 'utf8');

    const colours = [...new Set(src.match(/#[0-9A-Fa-f]{6}/g) ?? [])];
    if (colours.length !== 2 || !colours.includes(CHARCOAL) || !colours.includes(TERRACOTTA)) {
      throw new Error(`${job.from} is not the two-colour file this expects: ${colours.join(', ')}`);
    }

    const out = src.split(CHARCOAL).join(TERRACOTTA);

    // THE PATHS MUST BE UNTOUCHED. This is the "do not redraw" instruction,
    // enforced rather than promised.
    if (pathsOf(out) !== pathsOf(src)) {
      throw new Error(`${job.to}: the path data changed, which means something was redrawn`);
    }
    const after = [...new Set(out.match(/#[0-9A-Fa-f]{6}/g) ?? [])];
    if (after.length !== 1 || after[0] !== TERRACOTTA) {
      throw new Error(`${job.to}: expected one colour, got ${after.join(', ')}`);
    }

    const svgOut = path.join(PACK, job.dir, `${job.to}.svg`);
    if (fs.existsSync(svgOut)) throw new Error(`${svgOut} already exists. Refusing to overwrite.`);
    fs.writeFileSync(svgOut, out, 'utf8');
    written.push(svgOut);

    const { w, h } = viewBoxOf(out);
    const buffer = Buffer.from(out, 'utf8');

    for (const size of SIZES) {
      // LONGEST EDGE, which is the pack's own rule: no asset exceeds the number
      // in its folder name.
      const opts = w >= h ? { width: size } : { height: size };
      const pngDir = path.join(PACK, job.dir, `png-${size}`);
      const pngOut = path.join(pngDir, `${job.to}-${size}.png`);
      if (fs.existsSync(pngOut)) throw new Error(`${pngOut} already exists. Refusing to overwrite.`);
      await sharp(buffer, { density: 600 })
        .resize({ ...opts, fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(pngOut);
      written.push(pngOut);
    }

    // The PDF is built from the 2048, at the SVG's own size in points, which is
    // how the originals relate to their SVGs (331.5075pt for a 442.01px width).
    const pdfOut = path.join(PACK, job.dir, 'pdf', `${job.to}.pdf`);
    if (fs.existsSync(pdfOut)) throw new Error(`${pdfOut} already exists. Refusing to overwrite.`);
    const biggest = path.join(PACK, job.dir, 'png-2048', `${job.to}-2048.png`);
    await run('python', [
      path.join(process.cwd(), 'scripts', 'logo-png-to-pdf.py'),
      biggest,
      pdfOut,
      String(w * PT_PER_PX),
      String(h * PT_PER_PX),
    ]);
    written.push(pdfOut);
  }

  console.log(`\n  ${written.length} files written, none overwritten:\n`);
  for (const f of written) {
    const { size } = fs.statSync(f);
    console.log(`   ${path.relative(PACK, f).replace(/\\/g, '/')}  (${size.toLocaleString()} bytes)`);
  }
  console.log('');
}

main().catch((e) => {
  console.log(`\n  STOPPED: ${e.message}\n  Nothing further was written.\n`);
  process.exit(1);
});
