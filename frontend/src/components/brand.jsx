import { useMemo } from 'react'
import { STICKER } from '../lib/stores.js'

// SVG filters used app-wide. Rough edges apply to shapes only, never to text.
export function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <filter id="rough" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="3" />
          <feDisplacementMap in="SourceGraphic" scale="3.5" />
        </filter>
        <filter id="rough-map" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="8" />
          <feDisplacementMap in="SourceGraphic" scale="6" />
        </filter>
      </defs>
    </svg>
  )
}

/**
 * Flat oval sticker, rough edge, Courier Prime bold caps, tilted 3-8 degrees.
 * dashed = the quiet outlined style used for SIMULATED and STALE.
 */
export function Sticker({ color = 'pea', dashed = false, tilt = -4, size = 'md', className = '', style, children }) {
  const c = STICKER[color] ?? STICKER.pea
  const pad = size === 'sm' ? 'px-2.5 py-1 text-[10px] tracking-[1.5px]' : size === 'lg' ? 'px-4 py-2 text-[13px] tracking-[2px]' : 'px-3 py-1.5 text-[11px] tracking-[1.5px]'
  return (
    <span
      className={`relative inline-flex select-none items-center justify-center whitespace-nowrap font-mono font-bold uppercase leading-none ${pad} ${className}`}
      style={{ transform: `rotate(${tilt}deg)`, color: dashed ? 'var(--muted)' : c.fg, ...style }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-[50%]"
        style={{
          background: dashed ? 'transparent' : c.bg,
          border: dashed ? '1.5px dashed var(--muted)' : 'none',
          filter: 'url(#rough)',
        }}
      />
      <span className="relative">{children}</span>
    </span>
  )
}

/** Round numbered sticker in a store's color (map pins, runner-up rows). */
export function NumberSticker({ n, color, tilt = -5, size = 30 }) {
  const c = STICKER[color] ?? STICKER.pea
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center font-mono text-[14px] font-bold leading-none"
      style={{ width: size, height: size, color: c.fg, transform: `rotate(${tilt}deg)` }}
    >
      <span aria-hidden="true" className="absolute inset-0 rounded-full" style={{ background: c.bg, filter: 'url(#rough)' }} />
      <span className="relative">{n}</span>
    </span>
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

/**
 * Torn paper edge. Place directly above (edge="top") or below (edge="bottom") a block
 * of the same color.
 */
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
 * In-app header: ink letters and olive leaf on eggshell. Minimum 28px tall.
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

/** Tom Tomato, the default buddy. Flat shape, closed content eyes, tiny mouth. */
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

/** Buddy + one Darumadrop line. One buddy per screen, beside a headline. */
export function BuddyLine({ children, size = 60 }) {
  return (
    <div className="flex items-center gap-3">
      <Tom size={size} />
      <p className="font-display text-[24px] leading-[1.15] text-ink">{children}</p>
    </div>
  )
}

/** Small honest label shown whenever the data came from the local mock. */
export function DemoBadge() {
  return (
    <span className="label rounded-md border-[1.5px] border-dashed border-muted px-2 py-1 text-[10px] tracking-[1.5px] text-muted">
      Demo data
    </span>
  )
}

export function PrimaryButton({ children, className = '', ...rest }) {
  return (
    <button
      type="button"
      className={`min-h-[52px] w-full rounded-2xl bg-ink px-5 text-[17px] font-semibold text-eggshell transition-transform active:scale-[0.98] disabled:opacity-50 ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
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
