import { useMemo } from 'react'

// Shape-only filters: Tom's body and the map pieces. Never applied to text.
// Sticker edges come from <StickerDefs /> in Sticker.jsx.
export function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <filter id="rough" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="3" />
          <feDisplacementMap in="SourceGraphic" scale="3" />
        </filter>
        <filter id="rough-map" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="8" />
          <feDisplacementMap in="SourceGraphic" scale="6" />
        </filter>
      </defs>
    </svg>
  )
}

// Deterministic jagged edge so it doesn't jump between renders.
function zigzagPoints(seed, teeth, height, flip) {
  let s = seed
  const rand = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  const pts = []
  const step = 100 / teeth
  for (let i = 0; i <= teeth; i++) {
    const x = Math.min(100, i * step + (rand() - 0.5) * step * 0.4)
    const peak = i % 2 === 0
    const y = peak ? rand() * height * 0.25 : height * (0.65 + rand() * 0.35)
    pts.push([x, flip ? height - y : y])
  }
  return pts
}

/** Torn paper edge. Place directly above (edge="top") or below (edge="bottom") a block of the same color. */
export function TornEdge({ color = 'var(--kraft)', edge = 'top', height = 12, teeth = 46, seed = 7, className = '' }) {
  const d = useMemo(() => {
    const flip = edge === 'bottom'
    const pts = zigzagPoints(seed, teeth, height, flip)
    const line = pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' L')
    return flip ? `M0,0 L${line} L100,0 Z` : `M0,${height} L${line} L100,${height} Z`
  }, [edge, height, teeth, seed])
  return (
    <svg
      aria-hidden="true"
      className={`block w-full ${className}`}
      style={{ height }}
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
    >
      <path d={d} fill={color} />
    </svg>
  )
}

/**
 * "sift" hand-lettered in Darumadrop One; the i is a short stem with a leaf as its dot.
 * Ink letters and olive leaf on eggshell. No filters. Minimum 28px tall.
 */
export function Wordmark({ size = 34, letter = 'var(--ink)', leaf = 'var(--olive)' }) {
  return (
    <span
      role="img"
      aria-label="sift"
      className="inline-flex items-baseline font-display leading-none"
      style={{ fontSize: size, color: letter, minHeight: 28 }}
    >
      <span aria-hidden="true">s</span>
      <svg aria-hidden="true" viewBox="0 0 26 100" style={{ height: '1em', width: '0.26em', margin: '0 0.02em' }}>
        <rect x="7" y="48" width="12" height="52" rx="6" fill={letter} />
        <path d="M13 40 C 2 34, 2 16, 15 6 C 26 16, 24 34, 13 40 Z" fill={leaf} />
        <path d="M13 38 C 13 30, 14 20, 15 10" stroke="var(--eggshell)" strokeWidth="1.6" fill="none" opacity="0.6" />
      </svg>
      <span aria-hidden="true">ft</span>
    </span>
  )
}

/** Tom Tomato, the default buddy. Flat shape, closed content eyes, tiny mouth. Face is never filtered. */
export function Tom({ size = 64, className = '' }) {
  return (
    <svg role="img" aria-label="Tom Tomato" viewBox="0 0 100 100" width={size} height={size} className={`shrink-0 ${className}`}>
      <g filter="url(#rough)">
        <ellipse cx="50" cy="57" rx="40" ry="35" fill="var(--tomato)" />
        <ellipse cx="34" cy="44" rx="10" ry="6" fill="var(--clementine)" opacity="0.55" style={{ mixBlendMode: 'multiply' }} />
        <path d="M50 26 L38 14 L46 24 L30 22 L45 30 L36 38 L50 31 L64 38 L55 30 L70 22 L54 24 L62 14 Z" fill="var(--olive)" />
        <rect x="47.5" y="8" width="5" height="16" rx="2.5" fill="var(--olive)" />
      </g>
      <path d="M33 58 q5 5 10 0" stroke="var(--ink)" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M57 58 q5 5 10 0" stroke="var(--ink)" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M46 68 q4 3 8 0" stroke="var(--ink)" strokeWidth="2.6" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/** Buddy + one Darumadrop line, gap 12. 28px for screen headlines, 22px for Tom's line on Results. */
export function BuddyLine({ children, size = 64, text = 28 }) {
  return (
    <div className="flex items-center gap-3">
      <Tom size={size} />
      <p className="font-display leading-[1.15] text-ink" style={{ fontSize: text }}>
        {children}
      </p>
    </div>
  )
}

/** Small honest label shown whenever the data came from the local mock. */
export function DemoBadge() {
  return (
    <span className="label shrink-0 rounded-[4px] border-[1.5px] border-dashed border-muted bg-eggshell px-2 py-1 text-[10px] text-muted">
      Demo data
    </span>
  )
}

export function PrimaryButton({ children, className = '', ...rest }) {
  return (
    <button
      type="button"
      className={`min-h-[52px] w-full rounded-[14px] bg-ink px-5 text-[17px] font-semibold text-eggshell transition-transform active:scale-[0.98] disabled:opacity-50 ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

/** Primary action pinned to the bottom of the screen, above the safe area. */
export function BottomBar({ children }) {
  return <div className="sticky bottom-0 z-10 mt-auto bg-eggshell px-5 pb-[34px] pt-3">{children}</div>
}

/** Slow three-dot pulse for "Listening..." and "Thinking..." */
export function Pulse({ children }) {
  return (
    <span>
      {children}
      <span className="dot-pulse" aria-hidden="true">
        <span>.</span>
        <span>.</span>
        <span>.</span>
      </span>
    </span>
  )
}
