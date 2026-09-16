import Svg, { Rect } from 'react-native-svg';

// The sound-bars mark for the live voice conversation.
//
// WHY IT IS DRAWN AND NOT A GLYPH. Ruth chose a waveform over every telephone
// and headset option ("A gave me anxiety that the app might call someone"), and
// Ionicons has no waveform - the nearest relatives are a pulse line, signal bars
// and a speaker, none of which is the thing. It is drawn here rather than added
// as a PNG because the app already renders SVG for the Health Flower, so this
// needs no new library, no native build, and no asset that has to be exported
// again at every density.
//
// DRAWN, NOT COPIED. The reference was Claude's own composer. The form - a row
// of rounded vertical bars - is generic and everywhere; the asset is somebody
// else's, so this is built from the brand's own geometry instead.
//
// A STILL WAVEFORM, DELIBERATELY. It would be easy to animate the bars while a
// session is live, and it is the wrong instinct: the session already has a whole
// screen of its own to say so (voice-session-screen.tsx), and a moving icon in
// the composer would compete with the conversation for attention. Live is said
// in colour, the same as the mic it replaces.

// Heights as a fraction of the box, tallest in the middle. Five bars: four reads
// as a pattern cut short, six starts to look like an equaliser.
const BARS = [0.34, 0.62, 1, 0.72, 0.42];
const BAR_W = 2;
const GAP = 2;

export function VoiceWaveIcon({ size = 18, color }: { size?: number; color: string }) {
  const span = BARS.length * BAR_W + (BARS.length - 1) * GAP;
  // The drawing is laid out in its own units and scaled by the viewBox, so the
  // caller only ever passes a pixel size.
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${span} ${span}`}>
      {BARS.map((h, i) => {
        const height = h * span;
        return (
          <Rect
            key={i}
            x={i * (BAR_W + GAP)}
            // Centred vertically, so the bars grow from the middle outward
            // rather than standing on a baseline.
            y={(span - height) / 2}
            width={BAR_W}
            height={height}
            // Half the width: a fully rounded cap, which is what keeps this
            // soft enough to sit beside a rounded display face.
            rx={BAR_W / 2}
            fill={color}
          />
        );
      })}
    </Svg>
  );
}
