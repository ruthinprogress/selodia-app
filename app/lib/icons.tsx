// THE ICON SET, REDRAWN AS CLEAN SVG.
//
// Ruth, 8 October 2026: redraw each icon from her sheet in deep terracotta with
// one even stroke weight, round ends and joins. "Do not auto-trace the
// hand-drawn wobble." Use only the inner drawing and drop the outer ring,
// because each icon sits inside the soft sand or sage circle already.
//
// DRAWN, NOT TRACED. Every path here is written by hand in a 24x24 box from
// looking at her sheet: the bowl, the footprints, the ring with a dot, the
// drop, the four-line spark, the moon, the sun, the laptop, the overlapping
// circles, the page, the tape. Auto-tracing would have carried the scan's
// ragged edges and the red speckle in the artwork straight into the markup, and
// a traced outline is a filled shape pretending to be a stroke, which cannot
// then be given an even weight at all.
//
// ONE EVEN STROKE, AND IT SURVIVES SCALING. The same icon appears inside
// circles of different sizes, so each is placed with a transform and its
// stroke-width is divided by that scale. The weight therefore renders the same
// everywhere, in the parent diagram's own units, which is what "one even stroke
// weight, the same as the logo's outer ring" has to mean once the icons are
// different sizes.
//
// HALF THE CIRCLE'S WIDTH, CENTRED, which is her instruction: an icon drawn for
// a circle of radius r is placed at size r, so it occupies half the diameter and
// leaves an even ring of colour around it.
//
// NO LABELS INSIDE. Labels stay beside or under the circles, as they already
// were, and these drawings never carry text.

// The ink, the stroke and the mapping live in `icon-map.ts`, because the
// checks' resolver cannot load a .tsx and a guard that cannot be run is not a
// guard. The drawings stay here, because they are JSX.
import { ICON_INK as INK, ICON_STROKE as STROKE, type IconName } from './icon-map';

export { ICON_FOR, type IconName } from './icon-map';

/**
 * Each icon as markup in a 24x24 box, centred on 12,12.
 *
 * Strokes only, no fills, except the two places her sheet has a solid dot: the
 * mark on the cycle ring and the centre of the sun is open, so only the ring's
 * dot is filled.
 */
const PATHS: Record<IconName, React.ReactNode> = {
  // A bowl seen from slightly above: the rim, the body, and the little foot.
  bowl: (
    <>
      <path d="M3.4 9.2 C3.4 9.2 7 10.6 12 10.6 C17 10.6 20.6 9.2 20.6 9.2" />
      <path d="M3.4 9.2 C3.4 14.8 7.3 18.6 12 18.6 C16.7 18.6 20.6 14.8 20.6 9.2" />
      <path d="M3.4 9.2 C3.4 7.9 7.3 7 12 7 C16.7 7 20.6 7.9 20.6 9.2" />
      <path d="M9.4 18.4 L9.4 20 C9.4 20.6 10.5 21 12 21 C13.5 21 14.6 20.6 14.6 20 L14.6 18.4" />
    </>
  ),

  // Two prints, one ahead of the other, as on the sheet.
  footprints: (
    <>
      <path d="M8.1 4.6 C9.7 4.6 10.6 6 10.4 7.9 C10.2 9.7 9.4 11 8 11 C6.6 11 5.8 9.8 5.9 8 C6 6.1 6.6 4.6 8.1 4.6 Z" />
      <path d="M6.3 12.6 C7.4 12.3 8.7 12.5 9.1 13.3 C9.5 14.2 9 15.1 7.8 15.4 C6.7 15.7 5.7 15.3 5.5 14.5 C5.3 13.7 5.5 12.9 6.3 12.6 Z" />
      <path d="M16.2 9.2 C17.8 9.2 18.6 10.6 18.4 12.5 C18.2 14.3 17.4 15.6 16 15.6 C14.6 15.6 13.8 14.4 13.9 12.6 C14 10.7 14.7 9.2 16.2 9.2 Z" />
      <path d="M14.4 17.2 C15.5 16.9 16.8 17.1 17.2 17.9 C17.6 18.8 17.1 19.7 15.9 20 C14.8 20.3 13.8 19.9 13.6 19.1 C13.4 18.3 13.6 17.5 14.4 17.2 Z" />
    </>
  ),

  // The ring with a mark on it. The one solid dot in the set.
  ring: (
    <>
      <circle cx="11.2" cy="12.4" r="7.4" />
      <circle cx="18.4" cy="7" r="1.9" fill={INK} stroke="none" />
    </>
  ),

  drop: <path d="M12 3.2 C12 3.2 18.4 10.4 18.4 14.6 C18.4 18.1 15.5 20.8 12 20.8 C8.5 20.8 5.6 18.1 5.6 14.6 C5.6 10.4 12 3.2 12 3.2 Z" />,

  // Four lines reaching toward a centre they never meet.
  spark: (
    <>
      <path d="M12 3.4 L12 9.2" />
      <path d="M12 14.8 L12 20.6" />
      <path d="M3.4 12 L9.2 12" />
      <path d="M14.8 12 L20.6 12" />
    </>
  ),

  moon: <path d="M19.4 15.1 C18.2 15.7 16.9 16 15.5 16 C10.9 16 7.2 12.3 7.2 7.7 C7.2 6.6 7.4 5.6 7.8 4.7 C5.2 6.2 3.6 9 3.6 12.2 C3.6 17.1 7.6 21 12.4 21 C15.5 21 18.2 19.4 19.4 15.1 Z" />,

  sun: (
    <>
      <circle cx="12" cy="12" r="4.4" />
      <path d="M12 2.6 L12 5" />
      <path d="M12 19 L12 21.4" />
      <path d="M2.6 12 L5 12" />
      <path d="M19 12 L21.4 12" />
      <path d="M5.4 5.4 L7.1 7.1" />
      <path d="M16.9 16.9 L18.6 18.6" />
      <path d="M18.6 5.4 L16.9 7.1" />
      <path d="M7.1 16.9 L5.4 18.6" />
    </>
  ),

  laptop: (
    <>
      <path d="M5.2 6.6 C5.2 6.1 5.6 5.7 6.1 5.7 L17.9 5.7 C18.4 5.7 18.8 6.1 18.8 6.6 L18.8 15.2 L5.2 15.2 Z" />
      <path d="M3.2 17.6 L20.8 17.6 L20.8 18.2 C20.8 18.6 20.5 18.9 20.1 18.9 L3.9 18.9 C3.5 18.9 3.2 18.6 3.2 18.2 Z" />
      <path d="M5.2 15.2 L18.8 15.2 L20.8 17.6 L3.2 17.6 Z" />
    </>
  ),

  circles: (
    <>
      <circle cx="9.1" cy="12" r="5.8" />
      <circle cx="14.9" cy="12" r="5.8" />
    </>
  ),

  page: (
    <>
      <path d="M6.4 3.8 L14.4 3.8 L17.6 7 L17.6 20.2 L6.4 20.2 Z" />
      <path d="M14.4 3.8 L14.4 7 L17.6 7" />
      <path d="M9 11.4 L15 11.4" />
      <path d="M9 14.2 L15 14.2" />
      <path d="M9 17 L12.6 17" />
    </>
  ),

  // The roll, and the strip coming off it with its marks.
  tape: (
    <>
      <path d="M3.6 9.6 C3.6 8.3 4.6 7.3 5.9 7.3 L9.2 7.3 C10.5 7.3 11.5 8.3 11.5 9.6 L11.5 11 L3.6 11 Z" />
      <circle cx="7.5" cy="9.6" r="1.6" />
      <path d="M3.6 11 L20.4 11 L20.4 16.4 L3.6 16.4 Z" />
      <path d="M7.2 11 L7.2 13.4" />
      <path d="M10.8 11 L10.8 14.4" />
      <path d="M14.4 11 L14.4 13.4" />
      <path d="M18 11 L18 14.4" />
    </>
  ),
};

/**
 * One icon, centred on (cx, cy) and drawn at `size` across.
 *
 * The stroke is divided by the scale so it lands at the same weight whatever
 * circle it is sitting in. Decorative: the circle it sits inside already carries
 * the label, and the diagram's own text alternative carries the meaning.
 */
export function Icon({
  name,
  cx,
  cy,
  size,
}: {
  name: IconName;
  cx: number;
  cy: number;
  size: number;
}) {
  const scale = size / 24;
  return (
    <g
      transform={`translate(${cx - size / 2} ${cy - size / 2}) scale(${scale})`}
      fill="none"
      stroke={INK}
      strokeWidth={STROKE / scale}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </g>
  );
}
