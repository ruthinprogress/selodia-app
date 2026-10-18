// ONE HAIR COLOUR AND ONE PAPER COLOUR ACROSS THE WHOLE LIBRARY.
//
//   node scripts/check-illustration-colour.mjs
//
// Ruth, 18 October 2026, looking at the handstands laid out as a grid: "the
// whole set needs to be coherent as a set, and the hair colours change all over
// the place."
//
// She was right, and by more than it looked. Measured across the twenty-seven
// illustrations drawn by then, the bun ran from #8E6D57 to #B17F64 - thirty-five
// points of red between the palest and the darkest. Nobody sees that in one
// picture; in a grid of eight it is the first thing you see.
//
// These functions could not be tested before today, because they lived in
// upload-illustrations.mjs, which reads .env.local and opens a Supabase client
// at import. "It looked right in the dry run" was the only assurance there was,
// and the first two versions of the hair shift both looked right in a dry run
// while being wrong.

import assert from 'node:assert';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const mod = pathToFileURL(path.join(process.cwd(), 'scripts', 'illustration-colour.mjs')).href;
const {
  TARGET_PAPER,
  TARGET_HAIR,
  isHair,
  hairPixels,
  normaliseHair,
  normalisePaper,
} = await import(mod);

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

const W = 60;
const H = 60;
const C = 3;

/** A blank sheet of paper, in one of the creams the generator actually returned. */
function sheet(paper = { r: 0xfa, g: 0xf4, b: 0xe9 }) {
  const raw = new Uint8Array(W * H * C);
  for (let i = 0; i < raw.length; i += C) {
    raw[i] = paper.r;
    raw[i + 1] = paper.g;
    raw[i + 2] = paper.b;
  }
  return raw;
}
const at = (x, y) => (y * W + x) * C;
function paint(raw, x, y, c) {
  const i = at(x, y);
  raw[i] = c.r;
  raw[i + 1] = c.g;
  raw[i + 2] = c.b;
}
/** A filled bun. */
function blob(raw, cx, cy, r, c) {
  for (let y = cy - r; y <= cy + r; y += 1) {
    for (let x = cx - r; x <= cx + r; x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) paint(raw, x, y, c);
    }
  }
}
/** The figure's contour: one pixel wide, the same colour family as the bun. */
function line(raw, x0, y0, len, c) {
  for (let k = 0; k < len; k += 1) paint(raw, x0, y0 + k, c);
}

const BUN = { r: 0xa5, g: 0x83, b: 0x6b };
const INK = { r: 0xa5, g: 0x83, b: 0x6b };

console.log('\n  ONE HAIR COLOUR ACROSS THE LIBRARY\n');

check('a bun is found and a contour line is not', () => {
  // THE WHOLE DIFFICULTY IN ONE CHECK. The line and the bun are the SAME
  // COLOUR, so nothing about the colour can separate them - only the fact that
  // a bun is solid and a line is one pixel wide.
  assert.ok(isHair(BUN.r, BUN.g, BUN.b), 'the bun colour is no longer recognised');
  assert.ok(isHair(INK.r, INK.g, INK.b), 'the test is not exercising the hard case');

  const linesOnly = sheet();
  line(linesOnly, 10, 5, 40, INK);
  line(linesOnly, 30, 5, 40, INK);
  assert.strictEqual(
    hairPixels(linesOnly, W, H, C).length,
    0,
    'the figure outline would be recoloured as hair'
  );

  const withBun = sheet();
  blob(withBun, 30, 30, 8, BUN);
  assert.ok(hairPixels(withBun, W, H, C).length > 100, 'a bun is no longer found');
  return 'solid blob yes, one-pixel line no';
});

check('a SMALL bun is still found', () => {
  // The first erosion wanted seven of eight neighbours at distance two and
  // found no bun at all on two of eight real images: a small bun is only a few
  // pixels across, so all of it is edge.
  const small = sheet();
  blob(small, 30, 30, 5, BUN);
  assert.ok(hairPixels(small, W, H, C).length >= 20, 'a small bun is missed again');
  return 'radius 5 found';
});

check('TWO DIFFERENT BATCHES LAND ON THE SAME COLOUR', () => {
  // THE POINT OF THE WHOLE EXERCISE. The prototype took the median of whatever
  // folder it was handed, which makes a set coherent with itself and
  // incoherent with the set uploaded last week - the exact fault it was
  // written to fix. So the target is a constant.
  const pale = sheet();
  blob(pale, 30, 30, 9, { r: 0xb1, g: 0x7f, b: 0x64 });
  const dark = sheet();
  blob(dark, 30, 30, 9, { r: 0x8e, g: 0x6d, b: 0x57 });

  const a = normaliseHair(pale, W, H, C);
  const b = normaliseHair(dark, W, H, C);
  assert.ok(a.found && b.found, 'a bun was missed');

  const meanOf = (raw) => {
    const pts = hairPixels(raw, W, H, C);
    const s = [0, 0, 0];
    for (const i of pts) for (let k = 0; k < 3; k += 1) s[k] += raw[i + k];
    return s.map((v) => Math.round(v / pts.length));
  };
  const [ar, ag, ab] = meanOf(pale);
  const [br, bg, bb] = meanOf(dark);
  for (const [x, y] of [[ar, br], [ag, bg], [ab, bb]]) {
    assert.ok(Math.abs(x - y) <= 1, `two batches ended ${Math.abs(x - y)} apart`);
  }
  assert.ok(Math.abs(ar - TARGET_HAIR.r) <= 1, 'the pale batch did not reach the target');
  assert.ok(Math.abs(br - TARGET_HAIR.r) <= 1, 'the dark batch did not reach the target');
  return `#B17F64 and #8E6D57 both to #${TARGET_HAIR.r.toString(16).toUpperCase()}...`;
});

check('the shading inside a bun survives', () => {
  // A flat fill would be the easy implementation and the wrong one: the bun is
  // drawn with a highlight and a darker underside, and flattening it would make
  // every head look like a sticker.
  const raw = sheet();
  blob(raw, 30, 30, 9, BUN);
  paint(raw, 30, 27, { r: 0xc4, g: 0xa2, b: 0x8a }); // highlight
  paint(raw, 30, 33, { r: 0x7a, g: 0x5a, b: 0x46 }); // underside
  const before = [raw[at(30, 27)] - raw[at(30, 33)]];
  normaliseHair(raw, W, H, C);
  const after = [raw[at(30, 27)] - raw[at(30, 33)]];
  assert.strictEqual(after[0], before[0], 'the bun was flattened to one colour');
  return `the ${before[0]}-point highlight is intact`;
});

check('AND IT LEAVES EVERYTHING ELSE ALONE', () => {
  // The expensive failure mode. Sage leggings and the cream ground must not
  // move when the hair does.
  const SAGE = { r: 0x8a, g: 0x96, b: 0x82 };
  const raw = sheet();
  blob(raw, 30, 30, 9, BUN);
  blob(raw, 12, 12, 6, SAGE);
  const sageBefore = [raw[at(12, 12)], raw[at(12, 12) + 1], raw[at(12, 12) + 2]];
  const paperBefore = [raw[at(55, 55)], raw[at(55, 55) + 1], raw[at(55, 55) + 2]];
  normaliseHair(raw, W, H, C);
  assert.deepStrictEqual(
    [raw[at(12, 12)], raw[at(12, 12) + 1], raw[at(12, 12) + 2]],
    sageBefore,
    'the leggings were recoloured'
  );
  assert.deepStrictEqual(
    [raw[at(55, 55)], raw[at(55, 55) + 1], raw[at(55, 55) + 2]],
    paperBefore,
    'the paper was recoloured'
  );
  return 'sage and paper untouched';
});

check('the paper lands on the brand cream and carries its grain', () => {
  const paper = { r: 0xfa, g: 0xf4, b: 0xe9 };
  const raw = sheet(paper);
  paint(raw, 20, 20, { r: paper.r - 6, g: paper.g - 6, b: paper.b - 6 }); // a grain speck
  blob(raw, 40, 40, 7, BUN);
  const bunBefore = raw[at(40, 40)];

  normalisePaper(raw, W, H, C, paper);
  assert.strictEqual(raw[at(55, 55)], TARGET_PAPER.r, 'the paper did not reach the target');
  assert.strictEqual(
    raw[at(20, 20)],
    TARGET_PAPER.r - 6,
    'the grain was flattened out of the paper'
  );
  assert.strictEqual(raw[at(40, 40)], bunBefore, 'the paper shift moved the hair');
  return 'cream exact, grain kept, hair untouched';
});

check('AND THESE CHECKS CAN FAIL', () => {
  // Every assertion above would pass on a do-nothing implementation if it only
  // asked "did anything change". So: an image with NO bun must come back
  // untouched and report not-found, and a wrong-coloured blob must be ignored.
  const none = sheet();
  const copy = Uint8Array.from(none);
  const r = normaliseHair(none, W, H, C);
  assert.strictEqual(r.found, false, 'a bun was found on a blank sheet');
  assert.deepStrictEqual(Array.from(none), Array.from(copy), 'a blank sheet was altered');

  // A sage blob is solid, so the erosion accepts its shape - only the colour
  // test rejects it. If isHair ever widened, this is what would catch it.
  const sageOnly = sheet();
  blob(sageOnly, 30, 30, 9, { r: 0x8a, g: 0x96, b: 0x82 });
  assert.strictEqual(
    hairPixels(sageOnly, W, H, C).length,
    0,
    'a sage blob is being treated as hair'
  );
  return 'no bun found where there is none';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
