import Svg, { Ellipse, Path, Rect } from 'react-native-svg';

// THE FOUR DRINKS (2026-09-19), drawn to match the water droplet: a warm ink
// line with a soft wash of what is inside. Vectors rather than pictures, per
// Ruth's rule against AI illustration, and small enough to read at a glance.
// A 40 x 52 box each, so the four sit in a row at one height.

const INK = '#6B6255';
const WATER = '#B7CFC7';
const TEA = '#D8B99A';
const GLASS = '#FBF8F2';

export type DrinkKind = 'Glass' | 'Mug' | 'Bottle' | 'Pint';

export function DrinkIcon({ kind, size = 34 }: { kind: DrinkKind; size?: number }) {
  return (
    <Svg width={size} height={size * 1.3} viewBox="0 0 40 52" accessible={false}>
      {kind === 'Glass' && <GlassIcon />}
      {kind === 'Mug' && <MugIcon />}
      {kind === 'Bottle' && <BottleIcon />}
      {kind === 'Pint' && <PintIcon />}
    </Svg>
  );
}

function GlassIcon() {
  return (
    <>
      <Path d="M9 10 L12 46 L28 46 L31 10 Z" fill={GLASS} />
      <Path d="M10.6 26 L12 46 L28 46 L29.4 26 Z" fill={WATER} />
      <Path d="M9 10 L12 46 L28 46 L31 10" fill="none" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
      <Ellipse cx="20" cy="10" rx="11" ry="2" fill="none" stroke={INK} strokeWidth={1.4} />
    </>
  );
}

function MugIcon() {
  return (
    <>
      <Rect x="6" y="14" width="22" height="30" rx="4" fill={GLASS} />
      <Rect x="7" y="20" width="20" height="23" rx="3" fill={TEA} opacity={0.75} />
      <Rect x="6" y="14" width="22" height="30" rx="4" fill="none" stroke={INK} strokeWidth={1.6} />
      <Path d="M28 20 C36 20 36 34 28 34" fill="none" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
    </>
  );
}

function BottleIcon() {
  return (
    <>
      <Path d="M16 4 L24 4 L24 12 C24 15 29 17 29 22 L29 46 C29 48 27.5 49 26 49 L14 49 C12.5 49 11 48 11 46 L11 22 C11 17 16 15 16 12 Z" fill={GLASS} />
      <Path d="M11.5 24 L28.5 24 L28.5 46 C28.5 47.8 27.3 48.5 26 48.5 L14 48.5 C12.7 48.5 11.5 47.8 11.5 46 Z" fill={WATER} />
      <Path d="M16 4 L24 4 L24 12 C24 15 29 17 29 22 L29 46 C29 48 27.5 49 26 49 L14 49 C12.5 49 11 48 11 46 L11 22 C11 17 16 15 16 12 Z" fill="none" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
      <Rect x="15.5" y="2" width="9" height="4" rx="1.2" fill={INK} opacity={0.75} />
    </>
  );
}

function PintIcon() {
  return (
    <>
      <Path d="M8 6 L11 47 L29 47 L32 6 Z" fill={GLASS} />
      <Path d="M8.9 16 L11 47 L29 47 L31.1 16 Z" fill={TEA} opacity={0.7} />
      <Path d="M8 6 L11 47 L29 47 L32 6" fill="none" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
      <Ellipse cx="20" cy="6" rx="12" ry="2" fill="none" stroke={INK} strokeWidth={1.4} />
    </>
  );
}
