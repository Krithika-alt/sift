// Buddies.jsx: the 8 produce buddies, exactly as on the brand board.
// <Buddy id="tom" size={64} />  Never redraw them; recolor nothing.
// The rough edge uses the filter from <StickerDefs /> (mount once at the app root).

import React from 'react';

export const BUDDIES = [
  { id: 'tom', name: 'Tom', kind: 'tomato', sticker: 'tomato' },
  { id: 'cal', name: 'Cal', kind: 'carrot', sticker: 'clementine' },
  { id: 'bea', name: 'Bea', kind: 'beet', sticker: 'beet' },
  { id: 'pip', name: 'Pip', kind: 'pea pod', sticker: 'pea' },
  { id: 'penny', name: 'Penny', kind: 'potato', sticker: 'sardine' },
  { id: 'brock', name: 'Brock', kind: 'broccoli', sticker: 'olive' },
  { id: 'moe', name: 'Moe', kind: 'mushroom', sticker: 'radish' },
  { id: 'lola', name: 'Lola', kind: 'lemon', sticker: 'butter' },
];

const ART = {
  tom: (
    <><path d="M60 38 C88 36 102 56 100 76 C98 98 80 108 60 108 C38 108 20 96 20 74 C20 52 34 38 60 38Z" fill="#D94A2F"/><path d="M60 46 L50 30 L60 36 L65 24 L69 37 L82 33 L72 44 L60 49 L47 46 L38 36 Z" fill="#56603A"/><path d="M45 76 q5 -5 10 0 M65 76 q5 -5 10 0" stroke="#2B1D18" strokeWidth="3" fill="none" strokeLinecap="round"/><path d="M55 86 q5 4 10 0" stroke="#2B1D18" strokeWidth="3" fill="none" strokeLinecap="round"/></>
  ),
  cal: (
    <><path d="M60 42 Q50 24 40 20 M60 42 Q60 20 62 10 M60 42 Q70 24 82 22" stroke="#56603A" strokeWidth="7" fill="none" strokeLinecap="round"/><path d="M38 42 C50 36 72 36 84 42 C80 64 70 92 62 110 C60 114 57 113 56 109 C48 90 40 64 38 42Z" fill="#F08A3C"/><path d="M44 72 l9 2 M74 84 l-8 2 M54 98 l6 1" stroke="#F7F1E3" strokeWidth="3" strokeLinecap="round"/><path d="M48 54 q4 -4 8 0 M64 54 q4 -4 8 0" stroke="#2B1D18" strokeWidth="3" fill="none" strokeLinecap="round"/><path d="M56 62 q4 3 8 0" stroke="#2B1D18" strokeWidth="3" fill="none" strokeLinecap="round"/></>
  ),
  bea: (
    <><path d="M60 42 C50 22 36 16 32 26 C38 36 50 40 60 42Z" fill="#56603A"/><path d="M60 42 C62 18 74 8 82 14 C80 28 70 38 60 42Z" fill="#56603A"/><path d="M60 40 C84 40 98 56 96 76 C94 96 78 104 60 106 C42 104 26 96 24 76 C22 56 36 40 60 40Z" fill="#7A2A40"/><path d="M60 106 Q58 114 52 118" stroke="#7A2A40" strokeWidth="4" fill="none" strokeLinecap="round"/><path d="M45 74 q5 -5 10 0 M65 74 q5 -5 10 0" stroke="#F7F1E3" strokeWidth="3" fill="none" strokeLinecap="round"/><path d="M55 84 q5 4 10 0" stroke="#F7F1E3" strokeWidth="3" fill="none" strokeLinecap="round"/></>
  ),
  pip: (
    <><path d="M10 72 C26 42 82 32 110 50 C100 84 50 102 10 72Z" fill="#56603A"/><circle cx="38" cy="68" r="11" fill="#9AA66A"/><circle cx="61" cy="61" r="12" fill="#9AA66A"/><circle cx="84" cy="55" r="11" fill="#9AA66A"/><path d="M55 60 q3 -3 6 0 M64 58 q3 -3 6 0" stroke="#2B1D18" strokeWidth="2.5" fill="none" strokeLinecap="round"/><path d="M59 66 q3 2 6 -1" stroke="#2B1D18" strokeWidth="2.5" fill="none" strokeLinecap="round"/></>
  ),
  penny: (
    <><path d="M22 70 C20 48 40 36 64 38 C90 40 104 54 102 74 C100 96 80 106 58 104 C36 102 24 90 22 70Z" fill="#C9A06E"/><circle cx="36" cy="56" r="2.5" fill="#2B1D18" opacity="0.5"/><circle cx="86" cy="88" r="2.5" fill="#2B1D18" opacity="0.5"/><circle cx="80" cy="50" r="2" fill="#2B1D18" opacity="0.5"/><path d="M47 72 q5 -5 10 0 M65 72 q5 -5 10 0" stroke="#2B1D18" strokeWidth="3" fill="none" strokeLinecap="round"/><path d="M56 82 q5 4 10 0" stroke="#2B1D18" strokeWidth="3" fill="none" strokeLinecap="round"/></>
  ),
  brock: (
    <><path d="M50 64 L46 106 C52 110 68 110 74 106 L70 64Z" fill="#9AA66A"/><circle cx="38" cy="50" r="16" fill="#56603A"/><circle cx="60" cy="38" r="18" fill="#56603A"/><circle cx="82" cy="50" r="16" fill="#56603A"/><circle cx="50" cy="62" r="15" fill="#56603A"/><circle cx="71" cy="62" r="15" fill="#56603A"/><path d="M52 86 q3 -3 6 0 M62 86 q3 -3 6 0" stroke="#2B1D18" strokeWidth="2.5" fill="none" strokeLinecap="round"/><path d="M57 94 q3 2 6 0" stroke="#2B1D18" strokeWidth="2.5" fill="none" strokeLinecap="round"/></>
  ),
  moe: (
    <><path d="M44 62 C44 90 46 106 60 106 C74 106 76 90 76 62Z" fill="#FFFCF5" stroke="#2B1D18" strokeWidth="3"/><path d="M14 66 C16 36 40 22 60 22 C82 22 104 36 106 66 C80 72 40 72 14 66Z" fill="#C8402A"/><circle cx="38" cy="46" r="6" fill="#F7F1E3"/><circle cx="64" cy="35" r="5" fill="#F7F1E3"/><circle cx="85" cy="52" r="6" fill="#F7F1E3"/><path d="M50 84 q3 -3 6 0 M64 84 q3 -3 6 0" stroke="#2B1D18" strokeWidth="2.5" fill="none" strokeLinecap="round"/><path d="M57 92 q3 2 6 0" stroke="#2B1D18" strokeWidth="2.5" fill="none" strokeLinecap="round"/></>
  ),
  lola: (
    <><path d="M60 40 C66 28 80 24 88 28 C82 38 70 42 60 40Z" fill="#56603A"/><path d="M16 74 C18 50 40 40 60 40 C82 40 100 52 102 70 L112 74 L102 78 C98 98 80 106 60 106 C38 106 20 96 16 78 L8 74Z" fill="#F0CB5C"/><path d="M45 72 q5 -5 10 0 M65 72 q5 -5 10 0" stroke="#2B1D18" strokeWidth="3" fill="none" strokeLinecap="round"/><path d="M55 82 q5 4 10 0" stroke="#2B1D18" strokeWidth="3" fill="none" strokeLinecap="round"/></>
  ),
};

export default function Buddy({ id = 'tom', size = 64, style }) {
  const b = BUDDIES.find((x) => x.id === id) || BUDDIES[0];
  return (
    <svg
      role="img"
      aria-label={`${b.name} the ${b.kind}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      style={{ flexShrink: 0, filter: 'url(#sift-sticker-edge)', ...style }}
    >
      {ART[b.id]}
    </svg>
  );
}
