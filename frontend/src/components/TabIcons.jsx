// TabIcons.jsx (v2): minimal splotchy tab icons. One flat shape each, one tiny detail, no outlines.
// Selected: its own pop color, tilted a little. Unselected: one muted tone.
// Needs <StickerDefs /> mounted once (for the #sift-sticker-edge filter).
//
// <TabIcon name="bag" selected />   names: bag | map | saved
// For "Me", use <Buddy id={buddyId} size={28} />; when unselected add
// style={{ filter: 'grayscale(1) opacity(0.5)' }}.

import React from 'react';

const MUTED = '#CFC2AE';
const PAPER = '#F7F1E3';

const SHAPES = {
  // kraft bag: a soft trapezoid, a little leaf on top
  bag: (on) => (
    <>
      <path d="M7 11 Q16 9 25 11 L26.5 27 Q16 29 5.5 27 Z" fill={on ? '#D9A55F' : MUTED} />
      <path d="M16 10 C16.5 7 18.5 5 21.5 5 C21 8 19 10 16 10Z" fill={on ? '#9DBE5A' : MUTED} />
    </>
  ),
  // map: one rounded blob with a single pale fold and a tomato dot
  map: (on) => (
    <>
      <path d="M5 9 Q11 6.5 16 8.5 Q21 10.5 27 8 L27 24 Q21 26.5 16 24.5 Q11 22.5 5 25 Z" fill={on ? '#7DA3E0' : MUTED} />
      <path d="M16 9 L16 24" stroke={PAPER} strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
      <circle cx="21.5" cy="15.5" r="3.2" fill={on ? '#C8402A' : '#B5A691'} />
    </>
  ),
  // saved: a soft ribbon
  saved: (on) => (
    <path d="M9 5.5 Q16 4.5 23 5.5 L23.5 27 L16 21.5 L8.5 27 Z" fill={on ? '#F0CB5C' : MUTED} />
  ),
};

export function TabIcon({ name, selected = false, size = 28 }) {
  const draw = SHAPES[name] || SHAPES.bag;
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      style={{
        filter: 'url(#sift-sticker-edge)',
        transform: selected ? 'rotate(-6deg) scale(1.06)' : 'none',
        transition: 'transform 180ms ease',
        overflow: 'visible',
      }}
    >
      {draw(selected)}
    </svg>
  );
}

export default TabIcon;
