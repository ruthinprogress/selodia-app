// WHERE THE HERO ARTWORK IS EMPTY ENOUGH TO PUT WORDS ON.
//
//   node scripts/hero-clear-zones.mjs
//
// Ruth, 8 October 2026: "Place headline text only on the empty cream areas,
// never over circles or lines."
//
// THE POINT OF MEASURING RATHER THAN LOOKING. A wash that reads as "pale
// enough" at a glance can still take charcoal text from 12:1 down past the AA
// floor, and the answer changes with every breakpoint because the artwork is
// cropped differently at each one. Eyeballing it gets a different answer on
// every screen and no answer at all for the one she is holding.
//
// WHAT IT DOES. Divides each artwork into a grid, and for every cell measures
// the WORST pixel rather than the average: the darkest, most saturated thing in
// that cell, since one copper line through an otherwise empty square is exactly
// the case that matters and an average hides it. Then it reports the contrast
// that charcoal #2D2B28 would have against that worst pixel.
//
// A cell is CLEAR if charcoal on its worst pixel still clears 7:1, which is AAA
// for body text and a deliberate margin over the 4.5:1 floor. The margin is
// there because the artwork is scaled and cropped differently per screen, so
// the measurement is never exactly what a given phone renders.

import sharp from 'sharp';

const CHARCOAL = [0x2d, 0x2b, 0x28];
const COLS = 6;
const ROWS = 6;
const SAFE = 7;

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

async function zones(file, label) {
  const img = sharp(file);
  const { width, height } = await img.metadata();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;

  console.log(`\n  ${label}  ${width}x${height}`);
  console.log(`  contrast of charcoal on the WORST pixel in each cell, ${COLS}x${ROWS} grid`);
  console.log(`  a cell is clear at ${SAFE}:1 or better\n`);

  const cw = Math.floor(width / COLS);
  const rh = Math.floor(height / ROWS);
  const grid = [];

  for (let row = 0; row < ROWS; row++) {
    const line = [];
    for (let col = 0; col < COLS; col++) {
      let worst = Infinity;
      // Every 3rd pixel: enough to catch a 2px copper line, 9x less work.
      for (let y = row * rh; y < (row + 1) * rh; y += 3) {
        for (let x = col * cw; x < (col + 1) * cw; x += 3) {
          const i = (y * info.width + x) * ch;
          const c = contrast(CHARCOAL, [data[i], data[i + 1], data[i + 2]]);
          if (c < worst) worst = c;
        }
      }
      line.push(worst);
    }
    grid.push(line);
  }

  for (let row = 0; row < ROWS; row++) {
    const cells = grid[row]
      .map((v) => `${v >= SAFE ? ' ' : '!'}${v.toFixed(1).padStart(5)}`)
      .join('');
    const top = Math.round((row / ROWS) * 100);
    console.log(`   ${String(top).padStart(3)}%  ${cells}`);
  }
  console.log(
    '         ' +
      Array.from({ length: COLS }, (_, c) => `${Math.round((c / COLS) * 100)}%`.padStart(6)).join('')
  );

  // The widest band of fully clear columns, read row by row, which is what a
  // block of text actually occupies.
  const clearRows = grid
    .map((line, row) => ({ row, cols: line.map((v, c) => (v >= SAFE ? c : -1)).filter((c) => c >= 0) }))
    .filter((r) => r.cols.length > 0);

  console.log('\n  clear cells by row:');
  for (const r of clearRows) {
    const from = Math.round((Math.min(...r.cols) / COLS) * 100);
    const to = Math.round(((Math.max(...r.cols) + 1) / COLS) * 100);
    console.log(
      `    ${String(Math.round((r.row / ROWS) * 100)).padStart(3)}% down: clear from ${from}% to ${to}% across` +
        (r.cols.length === COLS ? '  (the whole width)' : '')
    );
  }
  return grid;
}

await zones('public/brand/hero-wide-1774.webp', 'WIDE, used from 900px up');
await zones('public/brand/hero-tall-1072.webp', 'TALL, used below 900px');
console.log('');
