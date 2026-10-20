// COPY THE FLOWER ONTO THE SERVER, rather than typing it there.
//
//   node scripts/generate-report-flower.mjs
//
// Ruth, 20 October 2026: "Perhaps the Report builder could retain the
// weekly/monthly picker... Then report builder flower, yes."
//
// WHY A COPY EXISTS AT ALL. The report is built and rendered on the server,
// as HTML that becomes a PDF. The flower lives on the phone, in TypeScript the
// server's tsconfig cannot see and in a component that imports
// react-native-svg. So drawing the same flower in the report needs the
// dimensions, the colours, the target and the petal geometry on the server.
//
// AND A SECOND SET OF PETAL MEASUREMENTS IS A SECOND FLOWER. The report is the
// document somebody hands to a doctor; a drawing in it that disagrees by a few
// points with the one on her screen is the worst possible place for this
// project's oldest fault. The precedent is one week old:
// generate-mobile-weights.mjs exists because the weighting table was about to
// be maintained in two places, and check-week-flower.mjs fails if the two ever
// differ.
//
// SO THIS CARVES RATHER THAN REWRITES. Two contiguous regions are copied
// verbatim - the dimensions and coverage maths from health-flower.ts, and the
// petal geometry from flower-geometry.ts - and check-report-flower.mjs
// compares them byte for byte. Edit the phone's files; run this; never edit
// the generated one.

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const DIMENSIONS_SRC = 'mobile/src/lib/health-flower.ts';
const GEOMETRY_SRC = 'mobile/src/lib/flower-geometry.ts';
const TARGET = 'app/lib/health-flower-dimensions.ts';

/** From `from` up to (not including) `to`, failing loudly if either moved. */
export function carve(text, from, to, where) {
  const a = text.indexOf(from);
  const b = to === null ? text.length : text.indexOf(to);
  if (a === -1 || (to !== null && b === -1)) {
    throw new Error(`${where} no longer has the shape this generator expects`);
  }
  return text.slice(a, to === null ? undefined : b).trimEnd();
}

/** Where each carve starts and stops, so the check cuts exactly as this does. */
export const REGIONS = {
  dimensions: {
    file: DIMENSIONS_SRC,
    from: 'export type Dimension =',
    to: '/**\n * Recovery earned outside the activity table',
  },
  geometry: {
    file: GEOMETRY_SRC,
    from: '// THE GEOMETRY IS THE APPROVED',
    to: null,
  },
};

// NOTHING RUNS ON IMPORT. check-report-flower.mjs imports the two helpers above
// so that it cuts the files exactly where this generator cuts them - and the
// first version of that check imported this module while it still wrote on
// load, so it regenerated the target and then compared the file against itself.
// It could not fail. The rule this project keeps relearning: a test must be
// able to fail.
export function generate() {
  const body = {};
  for (const [name, r] of Object.entries(REGIONS)) {
    body[name] = carve(fs.readFileSync(r.file, 'utf8'), r.from, r.to, r.file);
  }

  const header = `// GENERATED FILE. DO NOT EDIT.
//
//   node scripts/generate-report-flower.mjs
//
// The Health Flower, for the report. Copied verbatim from
// ${DIMENSIONS_SRC} and
// ${GEOMETRY_SRC}.
//
// The report is built on the server and rendered as HTML; the flower is a
// React Native component on the phone. Both now draw from these numbers, so
// the flower in a PDF somebody hands to a doctor is the same object as the one
// on her screen rather than a second drawing of it.
//
// check-report-flower.mjs fails if this file and the phone's stop matching.
// Change the phone's files, then run the command above.

`;

  fs.writeFileSync(TARGET, `${header}${body.dimensions}\n\n${body.geometry}\n`, 'utf8');
  console.log(`\n  wrote ${TARGET} (${body.dimensions.length + body.geometry.length} chars)\n`);
}

// Run only when run. See above.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) generate();
