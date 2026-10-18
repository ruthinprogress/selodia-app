// THE COLOUR CORRECTIONS EVERY ILLUSTRATION GETS ON ITS WAY INTO THE APP.
//
// Pulled out of upload-illustrations.mjs on 18 October 2026 so they can be
// tested. That file reads .env.local and opens a Supabase client at import, so
// nothing could import it to check these, and "it looked right in the dry run"
// was the only assurance there was.
//
// BOTH CORRECTIONS EXIST FOR THE SAME REASON: the generator is painting, not
// filling, so it returns a different shade every time however precisely the hex
// is specified. One picture is fine. A hundred shown together are not.
//
//   PAPER. Across one afternoon: #FAF4E9, #FDF6E6, #FBEED5, #F7EFE2. All
//   "cream", none the same. Ruth spotted it before any measurement: "the
//   background looks yellow."
//
//   HAIR. Across the first twenty-seven illustrations the bun ran from #8E6D57
//   to #B17F64 - thirty-five points of red. Ruth, 18 October, looking at the
//   handstands as a grid: "the whole set needs to be coherent as a set, and the
//   hair colours change all over the place."
//
// BOTH ARE SELECTIVE SHIFTS, NOT GLOBAL ONES. Only the pixels belonging to the
// thing being corrected move, and each carries its own deviation from the mean
// across, so watercolour grain and the shading inside a bun both survive. A
// global transform would drag the sage and the terracotta with it.

/** The brand cream. Every background lands here exactly. */
export const TARGET_PAPER = { r: 0xf7, g: 0xf3, b: 0xea };

/** How far from the detected paper a pixel may be and still count as paper. */
export const PAPER_TOLERANCE = 14;

/**
 * The one hair colour.
 *
 * FIXED HERE, NOT COMPUTED PER BATCH. The prototype took the median of whatever
 * folder it was handed, which makes a set coherent with itself and incoherent
 * with the set uploaded last week - the exact fault it was written to fix.
 * #946951 is the median of the handstand set, which is the one Ruth approved.
 */
export const TARGET_HAIR = { r: 0x94, g: 0x69, b: 0x51 };

/**
 * How many of the eight neighbours must also be hair.
 *
 * THE CONTOUR LINE IS THE SAME COLOUR AS THE HAIR, which is the whole
 * difficulty: a plain colour match recolours the figure's entire outline along
 * with the bun. The bun is a FILLED blob and the line is a pixel or two wide,
 * so an erosion separates them.
 *
 * Seven of eight at distance two found no bun at all on two of eight images - a
 * small bun is only a few pixels across, so all of it is edge. Six of eight at
 * distance one keeps the small ones and still rejects a line.
 */
export const HAIR_NEIGHBOURS = 6;

/** Auburn, mid-dark, reasonably saturated: a bun rather than paper or sage. */
export function isHair(r, g, b) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  if (mx === 0) return false;
  return r > g && g > b && (mx - mn) / mx > 0.22 && mx > 90 && mx < 215;
}

/**
 * The pixels belonging to a bun: hair-coloured AND inside a blob.
 *
 * Returns byte offsets into the raw buffer, so the caller can measure and shift
 * exactly the same set.
 */
export function hairPixels(raw, width, height, channels) {
  const at = (x, y) => (y * width + x) * channels;
  const candidate = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = at(x, y);
      if (isHair(raw[i], raw[i + 1], raw[i + 2])) candidate[y * width + x] = 1;
    }
  }

  const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  const pts = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      if (!candidate[y * width + x]) continue;
      let n = 0;
      for (const [dx, dy] of NEIGHBOURS) {
        if (candidate[(y + dy) * width + (x + dx)]) n += 1;
      }
      if (n >= HAIR_NEIGHBOURS) pts.push(at(x, y));
    }
  }
  return pts;
}

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

/**
 * Pull every bun in the image onto TARGET_HAIR, in place.
 *
 * MEASURE FIRST, THEN SHIFT, AND ON THE SAME POPULATION. The first version
 * measured a whole-image sample that included the bun's dark OUTLINE and
 * applied it to a mask holding only the lighter INTERIOR. The shift came out at
 * minus fifty-five red - enough to turn every bun to mud. Measuring and
 * shifting the same set cannot drift apart from itself.
 */
export function normaliseHair(raw, width, height, channels) {
  const pts = hairPixels(raw, width, height, channels);
  if (pts.length < 150) return { found: false, pixels: pts.length };

  let sr = 0;
  let sg = 0;
  let sb = 0;
  for (const i of pts) {
    sr += raw[i];
    sg += raw[i + 1];
    sb += raw[i + 2];
  }
  const mean = {
    r: Math.round(sr / pts.length),
    g: Math.round(sg / pts.length),
    b: Math.round(sb / pts.length),
  };

  const shift = {
    r: TARGET_HAIR.r - mean.r,
    g: TARGET_HAIR.g - mean.g,
    b: TARGET_HAIR.b - mean.b,
  };
  for (const i of pts) {
    raw[i] = clamp(raw[i] + shift.r);
    raw[i + 1] = clamp(raw[i + 1] + shift.g);
    raw[i + 2] = clamp(raw[i + 2] + shift.b);
  }
  return { found: true, mean, shift, pixels: pts.length };
}

/**
 * Move the paper to exactly the brand cream, in place.
 *
 * THE FIGURE'S INTERIOR MOVES TOO, and that is correct. The body is unfilled -
 * the paper shows through it - so body and background must land on the same
 * colour or the figure acquires a faint outline it was never drawn with.
 */
export function normalisePaper(raw, width, height, channels, paper) {
  let moved = 0;
  for (let i = 0; i < raw.length; i += channels) {
    const dr = raw[i] - paper.r;
    const dg = raw[i + 1] - paper.g;
    const db = raw[i + 2] - paper.b;
    if (
      Math.abs(dr) <= PAPER_TOLERANCE &&
      Math.abs(dg) <= PAPER_TOLERANCE &&
      Math.abs(db) <= PAPER_TOLERANCE
    ) {
      raw[i] = clamp(TARGET_PAPER.r + dr);
      raw[i + 1] = clamp(TARGET_PAPER.g + dg);
      raw[i + 2] = clamp(TARGET_PAPER.b + db);
      moved += 1;
    }
  }
  return { movedShare: moved / (width * height) };
}
