// Motifs.jsx: small drawn pieces that carry the grocery and garden feel.
// Needs <StickerDefs /> mounted once (for #sift-sticker-edge).
//
// <DirtPatch width={150} />  a soft patch of soil the buddy "stands" in, with two tiny sprouts.
//   Place it behind and below the buddy (buddy overlaps its top half). Flat, low opacity, no shadow.
//
// <MiniBag color={BAG_COLORS[i % 5]} width={156} height={176}>...content...</MiniBag>
//   A flat paper bag with a torn top in a light pop color, for saved bags.

import React from 'react';

export function DirtPatch({ width = 120, style }) {
  const h = width * 0.42;
  return (
    <svg
      aria-hidden="true"
      width={width}
      height={h}
      viewBox="0 0 150 63"
      style={{ filter: 'url(#sift-sticker-edge)', overflow: 'visible', ...style }}
    >
      <path d="M8 40 C16 22 44 14 75 15 C108 16 136 24 142 40 C146 52 120 60 76 60 C34 60 4 53 8 40Z" fill="#8A6A4C" opacity="0.22" />
      <path d="M10 38 C20 22 46 16 75 17 C106 18 132 25 140 38" stroke="#4A2E22" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.12" />
      {/* a few soil specks */}
      <circle cx="40" cy="38" r="1.6" fill="#4A2E22" opacity="0.28" />
      <circle cx="98" cy="44" r="1.3" fill="#4A2E22" opacity="0.28" />
      <circle cx="70" cy="50" r="1.1" fill="#4A2E22" opacity="0.28" />
      <circle cx="118" cy="34" r="1.4" fill="#4A2E22" opacity="0.28" />
      {/* two tiny sprouts at the edges */}
      <path d="M22 36 C22 31 22 28 22 25" stroke="#56603A" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
      <path d="M22 28 C24 25 27 24 29 24.5 C28 27 25 28.5 22 28Z" fill="#9DBE5A" opacity="0.6" />
      <path d="M130 38 C130 34 130 31 130 29" stroke="#56603A" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
      <path d="M130 31.5 C128 29 125 28.5 123 29 C124 31.5 127 32.5 130 31.5Z" fill="#9DBE5A" opacity="0.55" />
    </svg>
  );
}

export function MiniBag({ color = '#9DBE5A', width = 156, height = 176, children, style, ...rest }) {
  // Flat, printed paper bag: one solid fill and the same zigzag torn top as the main bag.
  // No lip, no creases, no shading: 2D like everything else.
  const teeth = [];
  const step = 10;
  for (let x = 0; x <= width; x += step) teeth.push(`L${x} ${(x / step) % 2 ? 7 : 0}`);
  const top = `M0 10 ${teeth.join(' ')} L${width} 10 Z`;
  return (
    <div {...rest} style={{ position: 'relative', width, height, ...style }}>
      <svg aria-hidden="true" width={width} height="10" viewBox={`0 0 ${width} 10`} style={{ display: 'block' }}>
        <path d={top} fill={color} />
      </svg>
      <div
        style={{
          position: 'relative',
          height: height - 10,
          boxSizing: 'border-box',
          background: color,
          padding: '14px 16px 14px 16px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// Pop colors for saved bags, pre-mixed light so ink text stays readable (flat, not transparent).
export const BAG_COLORS = ['#CFE0A8', '#F6E2A0', '#C9D8F0', '#F8D2D9', '#F7C9A1'];

export default DirtPatch;
