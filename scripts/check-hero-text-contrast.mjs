// IS THE HERO TEXT ACTUALLY ON CLEAN GROUND?
//
//   node scripts/check-hero-text-contrast.mjs
//
// Ruth, 8 October 2026: "Place headline text only on the empty cream areas,
// never over circles or lines." and "Everything at WCAG AA contrast."
//
// WHY THIS IS NOT THE SAME AS LOOKING AT THE ARTWORK. The hero fades its lower
// edge into the page cream with a mask, so what the tagline actually sits on is
// a COMPOSITE: part artwork, part cream, in a proportion that changes down the
// page. The raw artwork under the tagline measures as low as 1.0:1 against
// charcoal. The composite is nowhere near that, because by the time the text
// gets there the artwork is mostly gone. Measuring the file would condemn a
// layout that is fine; measuring the screen would depend on a screenshot.
// So this computes the composite exactly, the way the browser does.
//
// THE NUMBERS BELOW ARE THE RENDERED LAYOUT, measured in the browser on
// 8 October 2026 at 1280px and 390px. If the hero CSS changes, re-measure and
// update them, because this check cannot see the page: it is arithmetic about
// what the page was observed to be. It is still worth having, because the thing
// most likely to change underneath it is the ARTWORK, and a new artwork with a
// dark corner where the tagline sits is exactly what this catches.

import assert from 'node:assert';
import sharp from 'sharp';

const CREAM = [0xf7, 0xf3, 0xea];
const CHARCOAL = [0x2d, 0x2b, 0x28];
const DEEP = [0x87, 0x4c, 0x3a];

/** AA for the tagline, which is large text at every breakpoint. 3:1 is the floor; 4.5 is the margin. */
const FLOOR = 4.5;

// Measured in the browser. Percentages of the artwork box, which is the element
// the background is painted into.
const LAYOUTS = [
  {
    name: 'desktop 1280px',
    file: 'public/brand/hero-wide-1774.webp',
    // mask-image: linear-gradient(to bottom, #000 0 42%, transparent 74%)
    maskSolidTo: 0.42,
    maskClearFrom: 0.74,
    text: { top: 0.8, bottom: 1.0, left: 0.08, right: 0.55 },
  },
  {
    name: 'phone 390px',
    file: 'public/brand/hero-tall-1072.webp',
    // mask-image: linear-gradient(to bottom, #000 0 52%, transparent 86%)
    maskSolidTo: 0.52,
    maskClearFrom: 0.86,
    text: { top: 0.62, bottom: 1.0, left: 0.05, right: 0.95 },
  },
];

function luminance([r, g, b]) {
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** The browser's own sum: artwork at `alpha` over the page cream. */
function composite(pixel, alpha) {
  return pixel.map((v, i) => Math.round(v * alpha + CREAM[i] * (1 - alpha)));
}

function maskAlpha(yFraction, solidTo, clearFrom) {
  if (yFraction <= solidTo) return 1;
  if (yFraction >= clearFrom) return 0;
  return 1 - (yFraction - solidTo) / (clearFrom - solidTo);
}

let pass = 0;
const failures = [];
function check(name, fn) {
  try {
    const note = fn();
    console.log(`  PASS  ${name}${note ? `   ${note}` : ''}`);
    pass += 1;
  } catch (e) {
    console.log(`  FAIL  ${name}\n          ${e.message}`);
    failures.push(name);
  }
}

console.log('\n  HERO TEXT ON THE ARTWORK\n');

for (const layout of LAYOUTS) {
  const img = sharp(layout.file);
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;

  // Only the part of the text box that overlaps the artwork at all. Anything
  // below the artwork is on page cream and measures 12.6:1 by definition.
  const top = Math.max(0, Math.min(1, layout.text.top));
  const bottom = Math.max(0, Math.min(1, layout.text.bottom));

  let worstCharcoal = Infinity;
  let worstDeep = Infinity;
  let worstAt = null;

  for (let yf = top; yf < bottom; yf += 0.004) {
    const alpha = maskAlpha(yf, layout.maskSolidTo, layout.maskClearFrom);
    const y = Math.min(info.height - 1, Math.floor(yf * info.height));
    for (let xf = layout.text.left; xf < layout.text.right; xf += 0.004) {
      const x = Math.min(info.width - 1, Math.floor(xf * info.width));
      const i = (y * info.width + x) * ch;
      const under = composite([data[i], data[i + 1], data[i + 2]], alpha);
      const c = contrast(CHARCOAL, under);
      const d = contrast(DEEP, under);
      if (c < worstCharcoal) {
        worstCharcoal = c;
        worstAt = { y: Math.round(yf * 100), x: Math.round(xf * 100), alpha: alpha.toFixed(2) };
      }
      if (d < worstDeep) worstDeep = d;
    }
  }

  check(`${layout.name}: charcoal on the worst pixel under the tagline`, () => {
    assert.ok(
      worstCharcoal >= FLOOR,
      `${worstCharcoal.toFixed(2)}:1 at ${worstAt.x}% across, ${worstAt.y}% down ` +
        `(artwork at ${worstAt.alpha} opacity there), below the ${FLOOR}:1 floor`
    );
    return `${worstCharcoal.toFixed(1)}:1 worst, at ${worstAt.x}% across and ${worstAt.y}% down`;
  });

  check(`${layout.name}: deep terracotta on the worst pixel under the tagline`, () => {
    // The second tagline line is deep terracotta, which starts at 6.07:1 on
    // plain cream and has less room to give away than charcoal.
    assert.ok(worstDeep >= 3, `${worstDeep.toFixed(2)}:1, below the 3:1 floor for large text`);
    return `${worstDeep.toFixed(1)}:1 worst`;
  });
}

check('and this check can fail', () => {
  // A black square under the text would be caught, and plain cream would not.
  assert.ok(contrast(CHARCOAL, composite([0, 0, 0], 1)) < FLOOR, 'charcoal on black is not detected');
  assert.ok(contrast(CHARCOAL, CREAM) > 12, 'charcoal on cream is not recognised as clean');
  // And the mask arithmetic itself.
  assert.strictEqual(maskAlpha(0.3, 0.62, 0.94), 1, 'the solid part of the mask is not solid');
  assert.strictEqual(maskAlpha(0.99, 0.62, 0.94), 0, 'the clear part of the mask is not clear');
  assert.ok(Math.abs(maskAlpha(0.78, 0.62, 0.94) - 0.5) < 0.01, 'the midpoint is not half');
  return 'black ground, clean cream, and the mask arithmetic';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
