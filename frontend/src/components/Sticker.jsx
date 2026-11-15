// Sticker.jsx: the one sticker component for Sift.
// Rough edge on the SHAPE only. Text is never filtered, so it stays crisp and readable.
// Mount <StickerDefs /> once near the app root, then use <Sticker> anywhere.

import React from 'react';

export const STICKER_COLORS = {
  tomato: { bg: '#C8402A', fg: '#F7F1E3' },
  clementine: { bg: '#F08A3C', fg: '#2B1D18' },
  butter: { bg: '#F0CB5C', fg: '#2B1D18' },
  pea: { bg: '#9DBE5A', fg: '#2B1D18' },
  sardine: { bg: '#7DA3E0', fg: '#2B1D18' },
  radish: { bg: '#F2A7B5', fg: '#2B1D18' },
  olive: { bg: '#56603A', fg: '#F7F1E3' },
  beet: { bg: '#7A2A40', fg: '#F7F1E3' },
};

// A gentle edge: low frequency, small displacement. Enough to feel cut by hand, never smeared.
export function StickerDefs() {
  return (
    <svg aria-hidden="true" width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        <filter id="sift-sticker-edge" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.5" />
        </filter>
      </defs>
    </svg>
  );
}

const SIZES = {
  sm: { font: 10, padY: 5, padX: 10, round: 26 },
  md: { font: 12, padY: 7, padX: 13, round: 34 },
  lg: { font: 14, padY: 9, padX: 16, round: 44 },
};

/**
 * <Sticker color="pea">BEST PICK</Sticker>
 * <Sticker color="tomato" shape="round" size="md">2</Sticker>   // map pins, rank numbers
 * <Sticker dashed>SIMULATED</Sticker>                           // quiet honesty labels
 *
 * Keep labels short (about 14 characters max). Store names never go in stickers;
 * use a round numbered sticker in the store's color next to the name instead.
 */
export default function Sticker({
  children,
  color = 'pea',
  shape = 'oval',
  size = 'md',
  tilt = -4,
  dashed = false,
  style,
  ...rest
}) {
  const s = SIZES[size] || SIZES.md;
  const c = dashed ? { bg: '#FFFCF5', fg: '#2B1D18' } : STICKER_COLORS[color] || STICKER_COLORS.pea;
  const isRound = shape === 'round';

  return (
    <span
      {...rest}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `rotate(${tilt}deg)`,
        width: isRound ? s.round : undefined,
        height: isRound ? s.round : undefined,
        padding: isRound ? 0 : `${s.padY}px ${s.padX}px`,
        flexShrink: 0,
        ...style,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: c.bg,
          border: dashed ? '1.5px dashed #6E5A4E' : 'none',
          filter: dashed ? 'none' : 'url(#sift-sticker-edge)',
        }}
      />
      <span
        style={{
          position: 'relative',
          color: c.fg,
          fontFamily: "'Courier Prime', monospace",
          fontWeight: 700,
          fontSize: s.font,
          letterSpacing: isRound ? 0 : '0.08em',
          lineHeight: 1.1,
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </span>
    </span>
  );
}
