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
