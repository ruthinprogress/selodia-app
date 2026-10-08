import { DIAGRAMS } from './homepage-copy';

// THE SIX DIAGRAMS, drawn as inline SVG in the brand's own language.
//
// Ruth, 8 October 2026: "show, don't tell". Soft sage and sand circles, the
// copper thread in deep terracotta, words in Manrope or Cormorant Infant. No
// icons of people or bodies, no charts, no numbers, no fake app screens, no
// raster images.
//
// THE LONG MOCKUP IS A REFERENCE FOR ONE IDEA AND NOTHING ELSE, which her brief
// is explicit about: things connecting to a centre. Everything else in that
// image is ruled out by name, and all of it would have been easier to copy than
// to leave out: the illustrated woman, the waist measurements, the weight and
// body fat figures, the bar charts, the sample chat bubbles, the leaves, the
// little icons in every circle. None of it is here.
//
// WHY INLINE AND NOT A FILE. Each of these is about 1 to 2KB of markup, so they
// cost less than a single HTTP request would, they take the page's own colours
// through CSS variables, and the labels are real text: selectable, searchable,
// and scaling with the reader's font size. A PNG of a diagram is an image of
// words, which is the one thing this audience cannot afford.
//
// ACCESSIBILITY, AND IT IS NOT DECORATION HERE. Every shape is aria-hidden,
// because "circle, circle, circle" read aloud is worse than silence. The text
// alternative in `homepage-copy.ts` is therefore the ONLY version a screen
// reader gets, so it says what the picture MEANS rather than describing it.
// Every visible label is at least 17px, which is why the viewBoxes are sized in
// the hundreds rather than scaled down to fit.
//
// MOTION LIVES IN CSS, not here. Each thread carries `.thread-draw` and each
// circle `.fade-up`; `app/lib/reveal.tsx` adds one class when the section
// scrolls into view and `prefers-reduced-motion` turns the whole thing off. No
// library, and nothing animates more than once.

const SAGE = 'var(--sage-soft)';
const SAND = 'var(--sand)';
const COPPER = 'var(--deep)';

/** The thread. One stroke, same weight everywhere, so it reads as one thing across six pictures. */
function Thread({ d, delay = 0 }: { d: string; delay?: number }) {
  return (
    <path
      className="thread-draw"
      d={d}
      fill="none"
      stroke={COPPER}
      strokeWidth={1.6}
      strokeLinecap="round"
      opacity={0.55}
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

/** A labelled node. The circle is the brand; the label is real, selectable text. */
function Node({
  cx,
  cy,
  r,
  label,
  fill,
  dy = 0,
  anchor = 'middle',
  delay = 0,
  size = 17,
}: {
  cx: number;
  cy: number;
  r: number;
  label?: string;
  fill: string;
  dy?: number;
  anchor?: 'middle' | 'start' | 'end';
  delay?: number;
  size?: number;
}) {
  return (
    <g className="fade-up" style={{ animationDelay: `${delay}ms` }}>
      <circle cx={cx} cy={cy} r={r} fill={fill} />
      {label && (
        <text
          x={cx}
          y={cy + r + dy}
          textAnchor={anchor}
          className="dg-label"
          fontSize={size}
        >
          {label}
        </text>
      )}
    </g>
  );
}

/** Everything a diagram shares: the figure, the hidden caption, the aria wiring. */
function Figure({
  alt,
  viewBox,
  className,
  children,
}: {
  alt: string;
  viewBox: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <figure className={`dg ${className ?? ''}`}>
      <svg viewBox={viewBox} className="dg-svg" aria-hidden="true" focusable="false">
        {children}
      </svg>
      {/* The only version a screen reader gets, and the one a search engine reads. */}
      <figcaption className="dg-alt">{alt}</figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// a. See the connections
// ---------------------------------------------------------------------------
//
// SIX THINGS JOINED TO HER, NOT TO EACH OTHER. That is the whole argument of
// the product in one picture, and it is why every thread ends at the middle.
// Drawing the outer circles joined to one another would say the opposite: that
// the app finds links between measurements. It finds them in a person.

// TWO SHAPES, AND THE REASON IS A MEASUREMENT RATHER THAN A PREFERENCE.
//
// An SVG label's size on screen is its font-size times the viewBox scale, not
// its font-size. The wide version has a 520-unit viewBox, so on a 390px phone
// it renders at 0.66 and a 17px label arrives as 11.2px. Measured in the
// browser, which is the only place that number exists: the stylesheet says 17
// either way and looks correct.
//
// Her floor is "every visual label at least 17px". So the radial shape, which
// genuinely needs width, is desktop only, and the phone gets a shape built for
// 320 units where 17 means 17.

export function ConnectionsDiagram() {
  const { centre, nodes, alt } = DIAGRAMS.connections;
  const fills = [SAND, SAGE, SAND, SAGE, SAND, SAGE];

  // WIDE: the radial. Everything joined to her, not to each other.
  const cx = 260;
  const cy = 215;
  const R = 150;
  const points = nodes.map((label, i) => {
    const angle = (-90 + i * 60) * (Math.PI / 180);
    return { label, x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle), fill: fills[i] };
  });

  // NARROW: the same claim in a column. "You" at the top, the six below it,
  // every thread still ending at the centre.
  const nx = 160;
  const ny = 56;
  const cols = [62, 258];
  const rows = [168, 268, 368];
  const stacked = nodes.map((label, i) => ({
    label,
    x: cols[i % 2],
    y: rows[Math.floor(i / 2)],
    fill: fills[i],
  }));

  return (
    <>
      <Figure alt={alt} viewBox="0 0 520 430" className="dg--connections dg--wide">
        {points.map((p, i) => (
          <Thread key={`t${i}`} d={`M ${p.x} ${p.y} L ${cx} ${cy}`} delay={i * 90} />
        ))}
        {points.map((p, i) => (
          <Node
            key={p.label}
            cx={p.x}
            cy={p.y}
            r={26}
            fill={p.fill}
            label={p.label}
            dy={22}
            delay={200 + i * 90}
          />
        ))}
        <g className="fade-up" style={{ animationDelay: '120ms' }}>
          <circle cx={cx} cy={cy} r={52} fill="var(--terracotta-soft)" />
          <text x={cx} y={cy + 7} textAnchor="middle" className="dg-centre" fontSize={21}>
            {centre}
          </text>
        </g>
      </Figure>

      <Figure alt={alt} viewBox="0 0 320 430" className="dg--connections dg--narrow">
        {stacked.map((p, i) => (
          <Thread key={`s${i}`} d={`M ${p.x} ${p.y} L ${nx} ${ny}`} delay={i * 90} />
        ))}
        {stacked.map((p, i) => (
          <Node
            key={p.label}
            cx={p.x}
            cy={p.y}
            r={22}
            fill={p.fill}
            label={p.label}
            dy={22}
            delay={200 + i * 90}
          />
        ))}
        <g className="fade-up" style={{ animationDelay: '120ms' }}>
          <circle cx={nx} cy={ny} r={42} fill="var(--terracotta-soft)" />
          <text x={nx} y={ny + 7} textAnchor="middle" className="dg-centre" fontSize={21}>
            {centre}
          </text>
        </g>
      </Figure>
    </>
  );
}

// ---------------------------------------------------------------------------
// b. Keep your own record
// ---------------------------------------------------------------------------
//
// ONE THREAD, NOT SIX ROWS. A list would say these are six separate things
// stored in one app. A single continuous line says they are one record, which
// is the claim.

export function RecordDiagram() {
  const { nodes, alt } = DIAGRAMS.record;
  const x = 46;
  const top = 34;
  const gap = 58;
  const bottom = top + gap * (nodes.length - 1);

  return (
    <Figure alt={alt} viewBox="0 0 320 400" className="dg--record">
      <Thread d={`M ${x} ${top} L ${x} ${bottom}`} />
      {nodes.map((label, i) => (
        <g key={label} className="fade-up" style={{ animationDelay: `${160 + i * 90}ms` }}>
          <circle cx={x} cy={top + i * gap} r={9} fill={i % 2 ? SAGE : SAND} />
          <text x={x + 26} y={top + i * gap + 6} className="dg-label" fontSize={17}>
            {label}
          </text>
        </g>
      ))}
    </Figure>
  );
}

// ---------------------------------------------------------------------------
// c. Talk, don't fill in forms
// ---------------------------------------------------------------------------
//
// A TYPOGRAPHIC QUOTE, NOT AN APP SCREEN, which her brief says twice. A chat
// bubble would be a picture of software. Setting the sentence in Cormorant on
// sand makes it a thing somebody said, which is the point: the things that do
// not fit a dropdown are the things that matter.

export function TalkDiagram() {
  const { quote, alt } = DIAGRAMS.talk;
  return (
    <Figure alt={alt} viewBox="0 0 420 300" className="dg--talk">
      <g className="fade-up">
        <circle cx={210} cy={150} r={132} fill={SAND} />
      </g>
      <g className="fade-up" style={{ animationDelay: '180ms' }}>
        {/* Wrapped by hand: SVG has no text flow, and a <foreignObject> would
            not render in some of the places this page gets screenshotted. */}
        <text x={210} y={132} textAnchor="middle" className="dg-quote" fontSize={25}>
          Why am I so tired
        </text>
        <text x={210} y={168} textAnchor="middle" className="dg-quote" fontSize={25}>
          by mid-afternoon?
        </text>
      </g>
      {/* The sentence as one string, for anything reading the markup rather than looking. */}
      <title>{quote}</title>
    </Figure>
  );
}

// ---------------------------------------------------------------------------
// d. Make your own changes
// ---------------------------------------------------------------------------
//
// UNLABELLED ON PURPOSE. Naming them would turn gradual change into three
// steps with an end, and the copy it sits under says "small, gradual, tried
// over weeks". Growth with no finish line is the whole idea.

export function ChangesDiagram() {
  const { alt } = DIAGRAMS.changes;
  return (
    <Figure alt={alt} viewBox="0 0 360 160" className="dg--changes">
      <Thread d="M 30 96 C 110 76, 190 112, 330 72" />
      <Node cx={48} cy={92} r={13} fill={SAND} delay={160} />
      <Node cx={172} cy={94} r={20} fill={SAGE} delay={280} />
      <Node cx={306} cy={76} r={29} fill="var(--terracotta-soft)" delay={400} />
    </Figure>
  );
}

// ---------------------------------------------------------------------------
// e. How it works
// ---------------------------------------------------------------------------
//
// HORIZONTAL ON DESKTOP, VERTICAL ON PHONES, which is her instruction and also
// the only honest way to fit six labels at 17px into 390px. Two viewBoxes
// rather than one squeezed: a six-node row scaled down to phone width would put
// every label at about 9px, which fails the floor the rest of the page keeps.

export function HowItWorksDiagram() {
  const { nodes, alt } = DIAGRAMS.howItWorks;

  const wideGap = 196;
  const wideW = 120 + wideGap * (nodes.length - 1);

  return (
    <>
      <Figure alt={alt} viewBox={`0 0 ${wideW} 150`} className="dg--how dg--wide">
        <Thread d={`M 60 70 L ${60 + wideGap * (nodes.length - 1)} 70`} />
        {nodes.map((label, i) => (
          <Node
            key={label}
            cx={60 + i * wideGap}
            cy={70}
            r={16}
            fill={i % 2 ? SAGE : SAND}
            label={label}
            dy={32}
            delay={160 + i * 110}
          />
        ))}
      </Figure>

      <Figure alt={alt} viewBox="0 0 320 420" className="dg--how dg--narrow">
        <Thread d="M 40 30 L 40 390" />
        {nodes.map((label, i) => (
          <g key={label} className="fade-up" style={{ animationDelay: `${160 + i * 110}ms` }}>
            <circle cx={40} cy={30 + i * 72} r={13} fill={i % 2 ? SAGE : SAND} />
            <text x={40 + 30} y={30 + i * 72 + 6} className="dg-label" fontSize={17}>
              {label}
            </text>
          </g>
        ))}
      </Figure>
    </>
  );
}

// ---------------------------------------------------------------------------
// f. Built around real life
// ---------------------------------------------------------------------------
//
// AN ORDINARY DAY, DRAWN AS A WANDER rather than a timeline. A straight line
// with six stops would be a schedule, which is the opposite of what the section
// says: the app fits around the day, the day does not fit around the app.

export function RealLifeDiagram() {
  const { nodes, alt } = DIAGRAMS.realLife;
  const pts = [
    { x: 56, y: 104 },
    { x: 158, y: 62 },
    { x: 262, y: 110 },
    { x: 366, y: 64 },
    { x: 470, y: 112 },
    { x: 572, y: 70 },
  ];
  const fills = [SAND, SAGE, SAND, SAGE, SAND, SAGE];

  const d = pts
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `S ${pts[i - 1].x + 52} ${p.y} ${p.x} ${p.y}`))
    .join(' ');

  // NARROW, for the same reason as the connections diagram: a 630-unit viewBox
  // on a 390px phone renders a 17px label at 9.2px, which is the worst of the
  // six and well under her floor. The day still wanders, it just wanders down.
  const narrow = [
    { x: 54, y: 40 },
    { x: 96, y: 118 },
    { x: 54, y: 196 },
    { x: 96, y: 274 },
    { x: 54, y: 352 },
    { x: 96, y: 430 },
  ];
  const nd = narrow
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `S ${narrow[i - 1].x} ${p.y - 38} ${p.x} ${p.y}`))
    .join(' ');

  return (
    <>
      <Figure alt={alt} viewBox="0 0 630 190" className="dg--real dg--wide">
        <Thread d={d} />
        {pts.map((p, i) => (
          <Node
            key={nodes[i]}
            cx={p.x}
            cy={p.y}
            r={19}
            fill={fills[i]}
            label={nodes[i]}
            dy={30}
            delay={160 + i * 100}
          />
        ))}
      </Figure>

      <Figure alt={alt} viewBox="0 0 320 480" className="dg--real dg--narrow">
        <Thread d={nd} />
        {narrow.map((p, i) => (
          <g key={nodes[i]} className="fade-up" style={{ animationDelay: `${160 + i * 100}ms` }}>
            <circle cx={p.x} cy={p.y} r={17} fill={fills[i]} />
            <text x={p.x + 34} y={p.y + 6} className="dg-label" fontSize={17}>
              {nodes[i]}
            </text>
          </g>
        ))}
      </Figure>
    </>
  );
}

// ---------------------------------------------------------------------------
// The thread between sections
// ---------------------------------------------------------------------------
//
// NEVER BEHIND TEXT, which is her rule and the reason this sits in its own
// block between sections rather than being positioned absolutely over one. A
// decorative line that cannot reach the text cannot reduce its contrast, which
// is a stronger guarantee than placing it carefully.

export function SectionThread({ flip = false }: { flip?: boolean }) {
  return (
    <div className={`seam${flip ? ' seam--flip' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 900 120" className="seam-svg" focusable="false">
        <Thread d="M 40 18 C 260 16, 300 104, 520 96 C 700 90, 760 30, 880 44" />
        <circle className="fade-up" cx={300} cy={66} r={9} fill={SAGE} />
        <circle className="fade-up" cx={612} cy={78} r={6} fill={SAND} style={{ animationDelay: '140ms' }} />
        <circle
          className="fade-up"
          cx={786}
          cy={44}
          r={7}
          fill="var(--terracotta-soft)"
          style={{ animationDelay: '260ms' }}
        />
      </svg>
    </div>
  );
}
