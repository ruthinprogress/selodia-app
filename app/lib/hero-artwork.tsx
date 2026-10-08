// THE HERO ARTWORK: soft overlapping watercolour circles and one thin copper
// line, drawn as inline SVG.
//
// WHY IT IS DRAWN RATHER THAN PLACED, and this is the one part of the brief I
// could not do as written. Ruth's instruction was "build the hero artwork from
// my attached file (circles and copper line only, logo and tagline removed)".
// The design arrived as an image in the conversation and `artwork-hero.png`
// never reached the repository or the Drive folder, so there was no file to cut
// the logo and tagline out of. The copy master's own rule covers this case and
// is what I followed: "Do not redraw, recreate, recolour or trace the seed mark
// or wordmark. Everywhere else, recreate the visual language yourself in CSS or
// inline SVG." The mark and wordmark are the real asset from Logo Asset Pack
// v2.0 and are untouched; only the wash and the thread are drawn here.
//
// If she drops the real artwork into Visual Assets, this component is the one
// place to swap, and nothing else on the page changes.
//
// IT IS THE WHOLE REASON THERE IS NO IMAGE REQUEST IN THE HERO. Inline SVG is
// about 4KB in the document, scales to any screen with no second network round
// trip, and has no raster to compress or serve at three sizes. "Responsive and
// compressed" is satisfied by there being nothing to download.
//
// CONTRAST IS HANDLED OUTSIDE THIS FILE. The artwork is painted behind the hero
// and the page draws a cream fade over the side the text sits on, so no word
// ever lands on a wash or on the copper line. See `.hero__art` in page.tsx: the
// rule is enforced by a gradient that cannot be forgotten, not by placing the
// circles carefully and hoping.

const TERRACOTTA = '#C97458';
const SAND = '#E9D6C2';
const SAGE = '#95A987';
/** The thread. A deeper terracotta so it reads as a drawn line, not a wash edge. */
const COPPER = '#B06A4E';

type Blob = { cx: number; cy: number; r: number; fill: string; o: number };

// Large terracotta circles are HERO ONLY, which the brief states twice. Nothing
// below the fold reuses this component, and the sage and sand circles elsewhere
// on the page are small and drawn in CSS.
const WASH: Blob[] = [
  { cx: 905, cy: 300, r: 250, fill: TERRACOTTA, o: 0.5 },
  { cx: 1075, cy: 215, r: 190, fill: TERRACOTTA, o: 0.42 },
  { cx: 760, cy: 150, r: 165, fill: SAND, o: 0.78 },
  { cx: 1010, cy: 470, r: 180, fill: TERRACOTTA, o: 0.3 },
  { cx: 640, cy: 95, r: 120, fill: SAND, o: 0.6 },
  { cx: 845, cy: 505, r: 110, fill: SAND, o: 0.55 },
  { cx: 1160, cy: 395, r: 135, fill: TERRACOTTA, o: 0.26 },
];

/** The few small ones. Sage is a fill colour and never type, which the palette note is explicit about. */
const SEEDS: Blob[] = [
  { cx: 812, cy: 372, r: 26, fill: SAGE, o: 0.62 },
  { cx: 1148, cy: 505, r: 17, fill: SAGE, o: 0.5 },
  { cx: 690, cy: 452, r: 13, fill: TERRACOTTA, o: 0.72 },
  { cx: 560, cy: 60, r: 15, fill: TERRACOTTA, o: 0.6 },
];

function blobs(list: Blob[]) {
  return list.map((b, i) => (
    <circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill={b.fill} opacity={b.o} />
  ));
}

export function HeroArtwork() {
  return (
    <svg
      className="hero__svg"
      viewBox="0 0 1200 700"
      preserveAspectRatio="xMaxYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* The watercolour edge. Turbulence displaces the circle outline so it
            bleeds like pigment, then a blur softens what is left. Two seeds so
            neighbouring blobs do not share an edge shape, which is what makes a
            filtered circle look like a filtered circle. */}
        <filter id="wash-a" x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves={4} seed={9} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={46} xChannelSelector="R" yChannelSelector="G" />
          <feGaussianBlur stdDeviation={9} />
        </filter>
        <filter id="wash-b" x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency="0.019" numOctaves={3} seed={23} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={22} xChannelSelector="R" yChannelSelector="G" />
          <feGaussianBlur stdDeviation={4} />
        </filter>
      </defs>

      <g filter="url(#wash-a)">{blobs(WASH)}</g>
      <g filter="url(#wash-b)">{blobs(SEEDS)}</g>

      {/* THE THREAD. One continuous line entering top left, passing between the
          washes and leaving bottom right, so the page below can pick it up and
          carry it on. Drawn over the wash because a thread sits on top of what
          it connects. */}
      <path
        d="M -40 108 C 170 60, 318 196, 487 182 C 676 166, 742 24, 921 46 C 1070 64, 1126 168, 1240 150"
        fill="none"
        stroke={COPPER}
        strokeWidth={1.6}
        opacity={0.5}
        strokeLinecap="round"
      />
      <path
        d="M -40 612 C 150 648, 262 520, 430 540 C 612 562, 700 694, 880 650 C 1020 616, 1096 500, 1240 520"
        fill="none"
        stroke={COPPER}
        strokeWidth={1.4}
        opacity={0.38}
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * The quiet thread between sections, below the hero.
 *
 * Same copper, much fainter, and it deliberately does not join up: the brief
 * asks for a line that travels down the page "disappearing and reappearing".
 * Each instance is one short curve on its own side of the page, never behind a
 * column of text.
 */
export function ThreadDivider({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      className={`thread${flip ? ' thread--flip' : ''}`}
      viewBox="0 0 400 120"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M 10 4 C 120 40, 60 76, 180 96 C 268 110, 330 92, 392 112"
        fill="none"
        stroke={COPPER}
        strokeWidth={1.2}
        opacity={0.4}
        strokeLinecap="round"
      />
    </svg>
  );
}
