import { useMemo } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import Buddy from './Buddies.jsx'
import { DirtPatch } from './Motifs.jsx'
import { STICKER_COLORS } from './Sticker.jsx'
import { useBuddy } from '../lib/profile.js'

// Shape-only filters: paper scraps and map pieces. Never applied to text.
// Sticker edges come from <StickerDefs /> in Sticker.jsx.
export function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <filter id="rough" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="3" />
          <feDisplacementMap in="SourceGraphic" scale="2.5" />
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

/** A sticker color (Sticker.jsx palette) mixed into a paper color: flat, never a gradient. */
export const wash = (color, pct, paper = 'var(--receipt)') =>
  `color-mix(in srgb, ${STICKER_COLORS[color]?.bg ?? color} ${pct}%, ${paper})`
export const tint = (color, pct) => `color-mix(in srgb, ${STICKER_COLORS[color]?.bg ?? color} ${pct}%, transparent)`

/** The chosen buddy (Buddies.jsx, never redrawn). */
export function MyBuddy({ size = 64, style }) {
  const buddy = useBuddy()
  return <Buddy id={buddy.id} size={size} style={style} />
}

/**
 * Behind every eggshell screen: a faint "aura" at the top (the one allowed gradient: the buddy's
 * sticker color and pea, 0.08 opacity, 320px tall) and the paper grain over the whole page
 * (above the aura, below content). Screens whose top is a map pass aura={false}.
 */
export function Backdrop({ aura = true }) {
  const buddy = useBuddy()
  const c = STICKER_COLORS[buddy.sticker]?.bg ?? STICKER_COLORS.pea.bg
  return (
    <>
      {aura && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-20 h-[320px]"
          style={{
            background: `radial-gradient(120% 70% at 30% 0%, ${c} 0%, transparent 70%), radial-gradient(90% 60% at 85% 10%, #9DBE5A 0%, transparent 65%)`,
            opacity: 0.08,
          }}
        />
      )}
      <span aria-hidden="true" className="page-grain pointer-events-none absolute inset-0 -z-10" />
    </>
  )
}

/**
 * The buddy standing in a small patch of soil (DirtPatch from Motifs.jsx, never redrawn): the
 * patch is 1.3x the buddy's width and the buddy overlaps its upper 40%. The buddy idles (a 2px
 * float) and tilts its head 6deg whenever `say` changes. Never used on soil screens.
 */
export function BuddySplotch({ size = 64, say }) {
  const buddy = useBuddy()
  const patch = Math.round(size * 1.3)
  const patchH = patch * 0.42
  return (
    <span className="relative inline-flex shrink-0 justify-center" style={{ width: patch, height: size + patchH * 0.6 }}>
      <DirtPatch width={patch} style={{ position: 'absolute', left: 0, bottom: 0 }} />
      <IdleBuddy id={buddy.id} size={size} say={say} />
    </span>
  )
}

/** Buddy idle: floats 2px up and down (4 s, ease-in-out, forever); a 6deg head tilt on a new line. */
export function IdleBuddy({ id, size, say, style }) {
  const reduce = useReducedMotion()
  return (
    <motion.span
      className="relative inline-flex"
      animate={reduce ? undefined : { y: [0, -2, 0] }}
      transition={{ duration: 4, ease: 'easeInOut', repeat: Infinity }}
    >
      <motion.span
        key={say ?? ''}
        className="inline-flex"
        initial={reduce || say == null ? false : { rotate: 6 }}
        animate={{ rotate: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{ originY: 0.9 }}
      >
        <Buddy id={id} size={size} style={style} />
      </motion.span>
    </motion.span>
  )
}

/** Buddy + one Darumadrop line, gap 12. 28px for screen headlines, 22px for the line on Results. */
export function BuddyLine({ children, size = 64, text = 28, color = 'var(--ink)', splotch = false, say: sayProp }) {
  const buddy = useBuddy()
  // a new spoken line tilts the head once
  const say = sayProp ?? (typeof children === 'string' ? children : undefined)
  return (
    <div className="flex items-center gap-3">
      {splotch ? <BuddySplotch size={size} say={say} /> : <IdleBuddy id={buddy.id} size={size} say={say} />}
      <p className="relative font-display leading-[1.15]" style={{ fontSize: text, color }}>
        {children}
      </p>
    </div>
  )
}

/**
 * Stickers land: scale 0.9 -> 1 and rotate +4deg -> their own tilt, 320 ms, gentle overshoot.
 * framer-motion's MotionConfig reducedMotion="user" (App) turns this off when asked.
 */
export function LandingSticker({ delay = 0, children, className = '' }) {
  return (
    <motion.span
      className={`inline-flex ${className}`}
      initial={{ scale: 0.9, rotate: 4, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={{ duration: 0.32, ease: [0.34, 1.4, 0.64, 1], delay }}
    >
      {children}
    </motion.span>
  )
}

/** Small honest label shown whenever the data came from the local mock. */
export function DemoBadge() {
  return (
    <span className="shrink-0 rounded-[4px] border border-muted bg-eggshell px-2 py-0.5 text-[12px] font-semibold text-muted">
      Demo data
    </span>
  )
}

/** Section label: Karla 600 14, sentence case, muted. */
export function SectionLabel({ children, className = '' }) {
  return <h3 className={`text-[14px] font-semibold text-muted ${className}`}>{children}</h3>
}

/** Every primary button: soil with eggshell text, Karla 600 17, radius 14, 56 tall. */
export function PrimaryButton({ children, className = '', ...rest }) {
  return (
    <button
      type="button"
      className={`min-h-14 w-full rounded-[14px] bg-soil px-5 text-[17px] font-semibold text-eggshell transition-transform active:scale-[0.98] disabled:opacity-40 ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

/** Back chevron: 44px circle, eggshell, 1.5px line border. */
export function BackButton({ onClick, label = 'Back' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-line bg-eggshell text-ink transition-transform active:scale-[0.98]"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
  )
}

/** Calm toast at the bottom: Karla 15, eggshell on soil, fades. */
export function Toast({ toast }) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          role="status"
          className="pointer-events-none absolute inset-x-5 bottom-[196px] z-50 flex justify-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="soil pointer-events-auto flex min-h-11 items-center gap-2 rounded-[14px] px-4 text-[15px] text-eggshell">
            {toast.text}
            {toast.action && (
              <>
                <span aria-hidden="true">·</span>
                <button type="button" onClick={toast.action.onClick} className="min-h-11 font-semibold underline underline-offset-4">
                  {toast.action.label}
                </button>
              </>
            )}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Outlined secondary button. */
export function SecondaryButton({ children, className = '', ...rest }) {
  return (
    <button
      type="button"
      className={`min-h-14 w-full rounded-[14px] border-[1.5px] border-ink bg-receipt px-5 text-[17px] font-semibold text-ink transition-transform active:scale-[0.98] disabled:opacity-40 ${className}`}
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
