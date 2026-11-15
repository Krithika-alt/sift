import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { RADII, radiusLabel } from '../lib/needs.js'

/**
 * Search radius: "0.5 mi", "1 mi", "2 mi", "3 mi" (Karla 600 14, height 36, radius 18). Selected is
 * soil with eggshell text. `pulse` (a changing number) makes the 3 mi pill pulse once, gently.
 */
export default function RadiusPills({ value, onChange, pulse = 0, className = '' }) {
  return (
    <div role="radiogroup" aria-label="Search radius" className={`flex gap-2 ${className}`}>
      {RADII.map((r) => {
        const on = r === value
        const isPulsing = pulse > 0 && r === RADII[RADII.length - 1] && !on
        return (
          <button key={r} type="button" role="radio" aria-checked={on} onClick={() => onChange(r)} className="flex min-h-11 flex-1 items-center">
            <motion.span
              key={isPulsing ? `p${pulse}` : 'still'}
              initial={false}
              animate={isPulsing ? { scale: [1, 1.08, 1] } : { scale: 1 }}
              transition={{ duration: 0.7, ease: 'easeInOut', delay: 0.3 }}
              className={`flex h-9 w-full items-center justify-center rounded-[18px] text-[14px] font-semibold transition-colors ${
                on ? 'bg-soil text-eggshell' : 'border-[1.5px] border-line bg-receipt text-ink'
              }`}
            >
              {radiusLabel(r)}
            </motion.span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Results: the radius as one small pill on the map ("2 mi" with a chevron, sardine wash). Tapping
 * opens a tiny popover with the four distances. `pulse` makes the pill pulse once.
 */
export function RadiusPill({ value, onChange, pulse = 0 }) {
  const [open, setOpen] = useState(false)
  const box = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = (e) => !box.current?.contains(e.target) && setOpen(false)
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  return (
    <span ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Search radius ${radiusLabel(value)}. Change`}
        className="flex min-h-11 items-center"
      >
        <motion.span
          key={`p${pulse}`}
          initial={false}
          animate={pulse > 0 ? { scale: [1, 1.08, 1] } : { scale: 1 }}
          transition={{ duration: 0.7, ease: 'easeInOut', delay: 0.3 }}
          className="flex h-8 items-center gap-1 rounded-2xl pl-3 pr-2 text-[13px] font-semibold text-ink"
          style={{ background: 'color-mix(in srgb, #7DA3E0 30%, var(--eggshell))' }}
        >
          {radiusLabel(value)}
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={open ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
          </svg>
        </motion.span>
      </button>
      {open && (
        <span role="radiogroup" aria-label="Search radius" className="absolute right-0 top-full z-20 -mt-1 flex w-[112px] flex-col rounded-[12px] border border-hair bg-receipt p-1">
          {RADII.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={r === value}
              onClick={() => {
                onChange(r)
                setOpen(false)
              }}
              className={`flex h-10 items-center justify-center rounded-[9px] text-[14px] font-semibold ${r === value ? 'bg-soil text-eggshell' : 'text-ink'}`}
            >
              {radiusLabel(r)}
            </button>
          ))}
        </span>
      )}
    </span>
  )
}
