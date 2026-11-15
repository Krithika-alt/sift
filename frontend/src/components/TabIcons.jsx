// TabIcons.jsx: hand-drawn tab bar icons, flat riso-style shapes with a rough edge.
// Selected: full color, tilted a little. Unselected: one quiet muted tone.
// Needs <StickerDefs /> mounted once (for the #sift-sticker-edge filter).
//
// <TabIcon name="bag" selected />   names: bag | map | saved
// For "Me", use <Buddy id={buddyId} size={30} /> with the same selected/unselected treatment
// (unselected: style={{ filter: 'grayscale(1) opacity(0.55)' }}).

import React from 'react';

const INK = '#2B1D18';
const MUTED_FILL = '#D9CDB8';
const MUTED_LINE = '#9C8B7D';

function Bag({ on }) {
  const body = on ? '#D9BE90' : MUTED_FILL;
  const line = on ? INK : MUTED_LINE;
  return (
    <>
      {/* sprout peeking out */}
      <path d="M16 9 C16 6.5 16 5 16 3.5" stroke={on ? '#56603A' : MUTED_LINE} strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M16 5.2 C17 3 19 2.2 21 2.4 C20.6 4.4 18.6 5.4 16 5.2Z" fill={on ? '#9DBE5A' : MUTED_LINE} />
      {/* bag with torn top */}
      <path d="M6.5 10 L8.3 8.2 L10.1 10 L11.9 8.2 L13.7 10 L15.5 8.2 L17.3 10 L19.1 8.2 L20.9 10 L22.7 8.2 L24.5 10 L25.6 28.5 L6 28.5 Z" fill={body} />
      <path d="M6.5 10 L8.3 8.2 L10.1 10 L11.9 8.2 L13.7 10 L15.5 8.2 L17.3 10 L19.1 8.2 L20.9 10 L22.7 8.2 L24.5 10 L25.6 28.5 L6 28.5 Z" fill="none" stroke={line} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M10 14.5 L22 14.5" stroke={line} strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
    </>
  );
}

function MapIcon({ on }) {
  const a = on ? '#9DBE5A' : MUTED_FILL;
  const b = on ? '#A9C1E4' : '#E4DACA';
  const line = on ? INK : MUTED_LINE;
  return (
    <>
      <path d="M4 8.5 L11.5 5.5 L11.5 25.5 L4 28.5 Z" fill={a} />
      <path d="M11.5 5.5 L20.5 8.5 L20.5 28.5 L11.5 25.5 Z" fill={b} />
      <path d="M20.5 8.5 L28 5.5 L28 25.5 L20.5 28.5 Z" fill={a} />
      <path d="M4 8.5 L11.5 5.5 L20.5 8.5 L28 5.5 L28 25.5 L20.5 28.5 L11.5 25.5 L4 28.5 Z" fill="none" stroke={line} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M11.5 5.5 L11.5 25.5 M20.5 8.5 L20.5 28.5" stroke={line} strokeWidth="1.1" opacity="0.6" />
      {/* store pin: a little tomato sticker */}
      <circle cx="16" cy="15.5" r="3.6" fill={on ? '#C8402A' : MUTED_LINE} />
    </>
  );
}

function Saved({ on }) {
  const fill = on ? '#F0CB5C' : MUTED_FILL;
  const line = on ? INK : MUTED_LINE;
  return (
    <>
      {/* a little stack: receipt behind, ribbon in front */}
      <path d="M8 6 L22 6 L22 24 L20.5 22.8 L19 24 L17.5 22.8 L16 24 L14.5 22.8 L13 24 L11.5 22.8 L10 24 L8.5 22.8 L8 24 Z" fill={on ? '#FFFCF5' : '#EEE6D7'} stroke={line} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M11 9.5 L19 9.5 M11 12.5 L17 12.5" stroke={line} strokeWidth="1.1" strokeLinecap="round" opacity="0.55" />
      <path d="M15 12 L26 12 L26 29 L20.5 25 L15 29 Z" fill={fill} />
      <path d="M15 12 L26 12 L26 29 L20.5 25 L15 29 Z" fill="none" stroke={line} strokeWidth="1.4" strokeLinejoin="round" />
    </>
  );
}

const ICONS = { bag: Bag, map: MapIcon, saved: Saved };

export function TabIcon({ name, selected = false, size = 30 }) {
  const Icon = ICONS[name] || Bag;
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      style={{
        filter: 'url(#sift-sticker-edge)',
        transform: selected ? 'rotate(-6deg) scale(1.08)' : 'none',
        transition: 'transform 180ms ease',
        overflow: 'visible',
      }}
    >
      <Icon on={selected} />
    </svg>
  );
}

export default TabIcon;
