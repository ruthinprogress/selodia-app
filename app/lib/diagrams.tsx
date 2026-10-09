import { DIAGRAMS } from './homepage-copy';
import { ICON_FOR, Icon } from './icons';

// THE DIAGRAMS, drawn as inline SVG in the brand's own language.
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
// body fat figures, the bar charts, the sample chat bubbles, the leaves. None
// of it is here.
//
// ──────────────────────────────────────────────────────────────────────────
// THE SIZING RULE THAT GOVERNS EVERY VIEWBOX BELOW, because it is the one that
// keeps being broken by accident.
//
// An SVG label's size on screen is its font-size TIMES THE VIEWBOX SCALE, not
// its font-size. A 630-unit diagram rendered 342px wide shows a 17px label at
// 9.2px. The stylesheet says 17 either way, so this is invisible unless it is
// measured in a browser, and it was: three of six were under her floor.
//
// So every diagram is built for the width it will actually be given, and capped
// in CSS at that width, so the scale is 1 and 17 means 17. The two that need
// real width have narrow twins instead of being allowed to shrink.
// ──────────────────────────────────────────────────────────────────────────
//
// ACCESSIBILITY. Every shape is aria-hidden, because "circle, circle, circle"
// read aloud is worse than silence. The text alternative in `homepage-copy.ts`
// is therefore the ONLY version a screen reader gets, so it says what the
// picture MEANS rather than describing it.
//
// MOTION LIVES IN CSS. Each thread carries `.thread-draw` and each circle
// `.fade-up`; `reveal.tsx` adds one class when the section scrolls into view,
// every rule that hides anything is behind a class that script adds, and
// `prefers-reduced-motion` turns the whole thing off.

const SAGE = 'var(--sage-soft)';
const SAND = 'var(--sand)';
const COPPER = 'var(--deep)';

/** The thread. One stroke, same weight everywhere, so it reads as one thing across six pictures. */
function Thread({ d, delay = 0, width = 1.6 }: { d: string; delay?: number; width?: number }) {
  return (
    <path
      className="thread-draw"
      d={d}
      fill="none"
      stroke={COPPER}
      strokeWidth={width}
      strokeLinecap="round"
      opacity={0.55}
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

/** A circle with its icon inside, and its label outside. Labels never sit inside a circle. */
function Node({
  cx,
  cy,
  r,
  label,
  fill,
  dy = 0,
  dx = 0,
  anchor = 'middle',
  delay = 0,
  size = 17,
  icon = true,
}: {
  cx: number;
  cy: number;
  r: number;
  label?: string;
  fill: string;
  dy?: number;
  dx?: number;
  anchor?: 'middle' | 'start' | 'end';
  delay?: number;
  size?: number;
  icon?: boolean;
}) {
  const name = label && icon ? ICON_FOR[label] : undefined;
  return (
    <g className="fade-up" style={{ animationDelay: `${delay}ms` }}>
      <circle cx={cx} cy={cy} r={r} fill={fill} />
      {/* HALF THE CIRCLE'S WIDTH, CENTRED, which is her instruction. */}
      {name && <Icon name={name} cx={cx} cy={cy} size={r} />}
      {label && (
        <text
          x={cx + dx}
          y={cy + (dy || r + 20)}
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
      <figcaption className="dg-alt">{alt}</figcaption>
    </figure>
  );
}

/**
 * A soft curve from one circle's edge to another's, never from centre to centre.
 *
 * Ruth, 8 October: "end the lines at the circle edges as soft curves in the
 * copper thread style, with every label clear of any line." Straight centre to
 * centre lines ran underneath both circles and crossed the labels, which is
 * what she was looking at.
 *
 * The curve bows gently to one side so six of them leaving the same middle
 * circle fan out instead of becoming a star.
 */
function edgeCurve(
  from: { x: number; y: number; r: number },
  to: { x: number; y: number; r: number },
  bow = 0.12
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  // Start and end ON THE EDGES, with a hair of clearance so the stroke does not
  // sit against the fill.
  const sx = from.x + ux * (from.r + 1.5);
  const sy = from.y + uy * (from.r + 1.5);
  const ex = to.x - ux * (to.r + 1.5);
  const ey = to.y - uy * (to.r + 1.5);

  // Control point pushed perpendicular to the line, which is what makes it a
  // curve rather than a line with a kink.
  const mx = (sx + ex) / 2 + -uy * len * bow;
  const my = (sy + ey) / 2 + ux * len * bow;

  return `M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
}

// ---------------------------------------------------------------------------
// See the connections
// ---------------------------------------------------------------------------
//
// SIX THINGS JOINED TO HER, NOT TO EACH OTHER. That is the argument of the
// product in one picture, and it is why every thread ends at the middle.
// Joining the outer circles to one another would say the opposite: that the app
// finds links between measurements. It finds them in a person.

export function ConnectionsDiagram() {
  const { centre, nodes, alt } = DIAGRAMS.connections;
  const fills = [SAND, SAGE, SAND, SAGE, SAND, SAGE];

  // WIDE: the radial.
  // 480 UNITS, NOT 600. It sits in the narrower half of a two-column grid,
  // which measures about 488px on a 1100px page. At 600 it was rendering at
  // 0.81 and showing its 17px labels at 13.8px.
  const cx = 240;
  const cy = 215;
  const CR = 46;
  const R = 142;
  const nr = 28;
  const points = nodes.map((label, i) => {
    const a = (-90 + i * 60) * (Math.PI / 180);
    return { label, x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), r: nr, fill: fills[i] };
  });

  // NARROW: the same claim in a column, so all six still show on a phone.
  const nx = 160;
  const ny = 62;
  const ncr = 44;
  const nnr = 27;
  const cols = [58, 262];
  const rows = [190, 300, 410];
  const stacked = nodes.map((label, i) => ({
    label,
    x: cols[i % 2],
    y: rows[Math.floor(i / 2)],
    r: nnr,
    fill: fills[i],
  }));

  return (
    <>
      <Figure alt={alt} viewBox="0 0 480 430" className="dg--connections dg--wide">
        {points.map((p, i) => (
          <Thread
            key={`t${i}`}
            d={edgeCurve(p, { x: cx, y: cy, r: CR }, i % 2 ? 0.1 : -0.1)}
            delay={i * 90}
          />
        ))}
        {points.map((p, i) => (
          <Node
            key={p.label}
            cx={p.x}
            cy={p.y}
            r={p.r}
            fill={p.fill}
            label={p.label}
            delay={200 + i * 90}
          />
        ))}
        <g className="fade-up" style={{ animationDelay: '120ms' }}>
          <circle cx={cx} cy={cy} r={CR} fill="var(--terracotta-soft)" />
          <text x={cx} y={cy + 8} textAnchor="middle" className="dg-centre" fontSize={23}>
            {centre}
          </text>
        </g>
      </Figure>

      <Figure alt={alt} viewBox="0 0 320 500" className="dg--connections dg--narrow">
        {stacked.map((p, i) => (
          <Thread
            key={`s${i}`}
            d={edgeCurve(p, { x: nx, y: ny, r: ncr }, i % 2 ? 0.08 : -0.08)}
            delay={i * 90}
          />
        ))}
        {stacked.map((p, i) => (
          <Node
            key={p.label}
            cx={p.x}
            cy={p.y}
            r={p.r}
            fill={p.fill}
            label={p.label}
            delay={200 + i * 90}
          />
        ))}
        <g className="fade-up" style={{ animationDelay: '120ms' }}>
          <circle cx={nx} cy={ny} r={ncr} fill="var(--terracotta-soft)" />
          <text x={nx} y={ny + 8} textAnchor="middle" className="dg-centre" fontSize={23}>
            {centre}
          </text>
        </g>
      </Figure>
    </>
  );
}

// ---------------------------------------------------------------------------
// Keep your own record
// ---------------------------------------------------------------------------
//
// ONE THREAD, NOT SIX ROWS. A list would say these are six separate things
// stored in one app. A single continuous line says they are one record.
//
// BUILT FOR 200 UNITS because it now lives inside one of four columns, which is
// about 245px on a 1100px page. At that width the scale is 1 and the labels are
// the 17px they say they are.

export function RecordDiagram() {
  const { nodes, alt } = DIAGRAMS.record;
  const x = 26;
  const top = 26;
  const gap = 46;
  const r = 19;
  const bottom = top + gap * (nodes.length - 1);

  return (
    <Figure alt={alt} viewBox="0 0 200 290" className="dg--record">
      <Thread d={`M ${x} ${top} L ${x} ${bottom}`} />
      {nodes.map((label, i) => (
        <Node
          key={label}
          cx={x}
          cy={top + i * gap}
          r={r}
          fill={i % 2 ? SAGE : SAND}
          label={label}
          anchor="start"
          dx={r + 12}
          dy={6}
          delay={160 + i * 90}
        />
      ))}
    </Figure>
  );
}

// ---------------------------------------------------------------------------
// Talk, don't fill in forms
// ---------------------------------------------------------------------------
//
// A TYPOGRAPHIC QUOTE, NOT AN APP SCREEN, which her brief says twice. A chat
// bubble would be a picture of software. Setting the sentence in Cormorant on
// sand makes it a thing somebody said, which is the point.
//
// Also built for 200 units, because it now sits under its own statement in the
// four-column block.

export function TalkDiagram() {
  const { quote, alt } = DIAGRAMS.talk;
  return (
    <Figure alt={alt} viewBox="0 0 200 200" className="dg--talk">
      <g className="fade-up">
        <circle cx={100} cy={100} r={94} fill={SAND} />
      </g>
      <g className="fade-up" style={{ animationDelay: '180ms' }}>
        {/* Wrapped by hand: SVG has no text flow, and a foreignObject would not
            render in some of the places this page gets screenshotted. */}
        <text x={100} y={88} textAnchor="middle" className="dg-quote" fontSize={19}>
          Why am I so tired
        </text>
        <text x={100} y={114} textAnchor="middle" className="dg-quote" fontSize={19}>
          by mid-afternoon?
        </text>
      </g>
      <title>{quote}</title>
    </Figure>
  );
}

// ---------------------------------------------------------------------------
// Make your own changes
// ---------------------------------------------------------------------------
//
// UNLABELLED ON PURPOSE. Naming them would turn gradual change into three steps
// with an end, and the copy it sits under says "small, gradual, tried over
// weeks". Growth with no finish line is the idea.

export function ChangesDiagram() {
  const { alt } = DIAGRAMS.changes;
  return (
    <Figure alt={alt} viewBox="0 0 200 110" className="dg--changes">
      <Thread d="M 26 70 C 70 54, 120 82, 176 50" />
      <Node cx={26} cy={70} r={11} fill={SAND} delay={160} icon={false} />
      <Node cx={100} cy={68} r={16} fill={SAGE} delay={280} icon={false} />
      <Node cx={176} cy={50} r={23} fill="var(--terracotta-soft)" delay={400} icon={false} />
    </Figure>
  );
}

// ---------------------------------------------------------------------------
// How it works
// ---------------------------------------------------------------------------
//
// HORIZONTAL ON DESKTOP, VERTICAL ON PHONES, which is her instruction and also
// the only honest way to fit six labels at 17px into 390px.
//
// NO ICONS. Her mapping covers nouns like Food and Sleep; these six are stages,
// and a drawing for "You understand" would be invention rather than a redraw.

export function HowItWorksDiagram() {
  const { nodes, alt } = DIAGRAMS.howItWorks;
  // 1030 units, inside the 1052px the wrap actually offers.
  const gap = 182;
  const wideW = 120 + gap * (nodes.length - 1);

  return (
    <>
      <Figure alt={alt} viewBox={`0 0 ${wideW} 140`} className="dg--how dg--wide">
        <Thread d={`M 60 62 L ${60 + gap * (nodes.length - 1)} 62`} />
        {nodes.map((label, i) => (
          <Node
            key={label}
            cx={60 + i * gap}
            cy={62}
            r={16}
            fill={i % 2 ? SAGE : SAND}
            label={label}
            dy={44}
            delay={160 + i * 110}
            icon={false}
          />
        ))}
      </Figure>

      <Figure alt={alt} viewBox="0 0 320 400" className="dg--how dg--narrow">
        <Thread d="M 34 30 L 34 370" />
        {nodes.map((label, i) => (
          <Node
            key={label}
            cx={34}
            cy={30 + i * 68}
            r={14}
            fill={i % 2 ? SAGE : SAND}
            label={label}
            anchor="start"
            dx={32}
            dy={6}
            delay={160 + i * 110}
            icon={false}
          />
        ))}
      </Figure>
    </>
  );
}

// ---------------------------------------------------------------------------
// Built around real life
// ---------------------------------------------------------------------------
//
// AN ORDINARY DAY, DRAWN AS A WANDER rather than a timeline. A straight line
// with six stops would be a schedule, which is the opposite of what the section
// says: the app fits around the day, the day does not fit around the app.

export function RealLifeDiagram() {
  const { nodes, alt } = DIAGRAMS.realLife;
  const fills = [SAND, SAGE, SAND, SAGE, SAND, SAGE];

  const pts = [
    { x: 66, y: 74 },
    { x: 178, y: 44 },
    { x: 290, y: 80 },
    { x: 402, y: 44 },
    { x: 514, y: 82 },
    { x: 620, y: 48 },
  ];
  const r = 26;

  const narrow = [
    { x: 60, y: 42 },
    { x: 110, y: 130 },
    { x: 60, y: 218 },
    { x: 110, y: 306 },
    { x: 60, y: 394 },
    { x: 110, y: 482 },
  ];
  const nr = 24;

  return (
    <>
      <Figure alt={alt} viewBox="0 0 700 170" className="dg--real dg--wide">
        {pts.slice(0, -1).map((p, i) => (
          <Thread
            key={`r${i}`}
            d={edgeCurve({ ...p, r }, { ...pts[i + 1], r }, i % 2 ? 0.16 : -0.16)}
            delay={i * 90}
          />
        ))}
        {pts.map((p, i) => (
          <Node
            key={nodes[i]}
            cx={p.x}
            cy={p.y}
            r={r}
            fill={fills[i]}
            label={nodes[i]}
            delay={160 + i * 100}
          />
        ))}
      </Figure>

      <Figure alt={alt} viewBox="0 0 320 540" className="dg--real dg--narrow">
        {narrow.slice(0, -1).map((p, i) => (
          <Thread
            key={`n${i}`}
            d={edgeCurve({ ...p, r: nr }, { ...narrow[i + 1], r: nr }, i % 2 ? 0.2 : -0.2)}
            delay={i * 90}
          />
        ))}
        {narrow.map((p, i) => (
          <Node
            key={nodes[i]}
            cx={p.x}
            cy={p.y}
            r={nr}
            fill={fills[i]}
            label={nodes[i]}
            anchor="start"
            dx={nr + 14}
            dy={6}
            delay={160 + i * 100}
          />
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
// block between sections rather than being positioned over one. A decorative
// line that cannot reach the text cannot reduce its contrast, which is a
// stronger guarantee than placing it carefully.
//
// NO DIVIDER ARTWORK WAS ATTACHED to her 8 October brief, and it says to leave
// these as they are if none arrives and not to generate any. So this is
// unchanged.

export function SectionThread({ flip = false }: { flip?: boolean }) {
  return (
    <div className={`seam${flip ? ' seam--flip' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 900 90" className="seam-svg" focusable="false">
        <Thread d="M 40 14 C 260 12, 300 78, 520 72 C 700 67, 760 22, 880 33" />
        <circle className="fade-up" cx={300} cy={50} r={9} fill={SAGE} />
        <circle className="fade-up" cx={612} cy={59} r={6} fill={SAND} style={{ animationDelay: '140ms' }} />
        <circle
          className="fade-up"
          cx={786}
          cy={33}
          r={7}
          fill="var(--terracotta-soft)"
          style={{ animationDelay: '260ms' }}
        />
      </svg>
    </div>
  );
}
