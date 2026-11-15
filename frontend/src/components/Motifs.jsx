// Motifs.jsx: small drawn pieces that carry the grocery and garden feel.
// Needs <StickerDefs /> mounted once (for #sift-sticker-edge).
//
// <DirtPatch width={150} />  a soft patch of soil the buddy "stands" in, with two tiny sprouts.
//   Place it behind and below the buddy (buddy overlaps its top half). Flat, low opacity, no shadow.
//
// <MiniBag color="#9DBE5A" width={156} height={176}>...content...</MiniBag>
//   A little paper grocery bag shape (folded top) in a pop color, for saved bags.

import React from 'react';

export function DirtPatch({ width = 150, style }) {
  const h = width * 0.42;
  return (
    <svg
      aria-hidden="true"
      width={width}
      height={h}
      viewBox="0 0 150 63"
      style={{ filter: 'url(#sift-sticker-edge)', overflow: 'visible', ...style }}
    >
      <path d="M8 40 C16 22 44 14 75 15 C108 16 136 24 142 40 C146 52 120 60 76 60 C34 60 4 53 8 40Z" fill="#4A2E22" opacity="0.13" />
      {/* a few soil specks */}
      <circle cx="40" cy="38" r="1.6" fill="#4A2E22" opacity="0.22" />
      <circle cx="98" cy="44" r="1.3" fill="#4A2E22" opacity="0.2" />
      <circle cx="70" cy="50" r="1.1" fill="#4A2E22" opacity="0.2" />
      <circle cx="118" cy="34" r="1.4" fill="#4A2E22" opacity="0.2" />
      {/* two tiny sprouts at the edges */}
      <path d="M22 36 C22 31 22 28 22 25" stroke="#56603A" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
      <path d="M22 28 C24 25 27 24 29 24.5 C28 27 25 28.5 22 28Z" fill="#9DBE5A" opacity="0.6" />
      <path d="M130 38 C130 34 130 31 130 29" stroke="#56603A" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
      <path d="M130 31.5 C128 29 125 28.5 123 29 C124 31.5 127 32.5 130 31.5Z" fill="#9DBE5A" opacity="0.55" />
    </svg>
  );
}

export function MiniBag({ color = '#9DBE5A', width = 156, height = 176, children, style, ...rest }) {
  // Paper bag silhouette: folded lip at the top, slightly tapered body.
  return (
    <div {...rest} style={{ position: 'relative', width, height, ...style }}>
      <svg
        aria-hidden="true"
        width={width}
        height={height}
        viewBox="0 0 156 176"
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, filter: 'url(#sift-sticker-edge)' }}
      >
        {/* body */}
        <path d="M10 30 L146 30 L150 172 L6 172 Z" fill={color} opacity="0.32" />
        {/* folded lip, a touch darker */}
        <path d="M14 14 L142 14 L146 34 L10 34 Z" fill={color} opacity="0.5" />
        {/* side creases */}
        <path d="M30 40 L28 168 M126 40 L128 168" stroke="#2B1D18" strokeWidth="1" opacity="0.08" />
      </svg>
      <div style={{ position: 'relative', height: '100%', boxSizing: 'border-box', padding: '46px 16px 14px 16px', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}

export default DirtPatch;
