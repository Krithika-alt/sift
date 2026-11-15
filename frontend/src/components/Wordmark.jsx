// Wordmark.jsx: the locked "sift" logo, exactly as on the brand board.
// Darumadrop One letters; the i is a short hand-drawn stem with the leaf as its dot.
// Never redraw the leaf, never filter the letters.
//
// In-app header: <Wordmark size={34} />                       (ink letters, olive leaf)
// On soil (splash, sifting): <Wordmark size={120} onSoil />   (eggshell letters, green leaf)

import React from 'react';

const XH = 44; // stem height as % of the em: matches the x-height so the i is short
const SW = 15; // stem weight in viewBox units

export default function Wordmark({ size = 34, onSoil = false, color, leafColor, style }) {
  const fg = color || (onSoil ? '#F7F1E3' : '#2B1D18');
  const leaf = leafColor || (onSoil ? '#A6C566' : '#56603A');
  const top = 100 - XH;
  const s = SW / 10;
  const stem = `M15 98 C15.6 ${100 - XH * 0.5} 14.4 ${top + 7} 15 ${top + 2}`;
  const leafT = `translate(${(15 - 5 * s).toFixed(1)} ${(top - SW * 0.55 - 3).toFixed(1)}) scale(${(s * 0.78).toFixed(2)}) rotate(-10)`;

  return (
    <span
      role="img"
      aria-label="sift"
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        fontFamily: "'Darumadrop One', cursive",
        fontSize: size,
        lineHeight: 1,
        color: fg,
        ...style,
      }}
    >
      <span aria-hidden="true">s</span>
      <svg aria-hidden="true" viewBox="0 0 30 100" style={{ width: '0.3em', height: '1em', overflow: 'visible', margin: '0 0.015em' }}>
        <path d={stem} stroke={fg} strokeWidth={SW} fill="none" strokeLinecap="round" />
        <g transform={leafT}>
          <path d="M0 0 C2 -12 12 -20 26 -21 C24 -8 13 0 0 0Z" fill={leaf} />
        </g>
      </svg>
      <span aria-hidden="true">ft</span>
    </span>
  );
}
