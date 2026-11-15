import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { DemoBadge, PrimaryButton, Sticker, Tom } from '../components/brand.jsx'
import { storeColor } from '../lib/stores.js'

const TILTS = [-6, 5, -3, 7, -5, 4, -7, 3]
const POP_MS = 260

/**
 * Tom says "Checking shelves near you..." while POST /api/rank-stores runs.
 * Once stores come back they pop in one by one, then we move to Results.
 */
export default function Sifting({ ranked, error, demo, onDone, onBack }) {
  const [shown, setShown] = useState(0)

  useEffect(() => {
    if (!ranked) return
    if (shown < ranked.length) {
      const t = setTimeout(() => setShown((n) => n + 1), POP_MS)
      return () => clearTimeout(t)
    }
    const t = setTimeout(onDone, 600)
    return () => clearTimeout(t)
  }, [ranked, shown, onDone])

  return (
    <div className="flex min-h-full flex-col items-center px-6 pb-10 pt-[calc(24px+env(safe-area-inset-top))]">
      <div className="flex w-full justify-end">{demo && <DemoBadge />}</div>

      <div className="mt-16 flex flex-col items-center text-center">
        <Tom size={112} />
        {error ? (
          <>
            <p className="mt-6 font-display text-[26px] leading-tight">Couldn't check shelves.</p>
            <p className="mt-2 max-w-[280px] text-[16px] text-muted">{error}</p>
            <PrimaryButton className="mt-8 max-w-[260px]" onClick={onBack}>
              Back to my bag
            </PrimaryButton>
          </>
        ) : (
          <p className="mt-6 font-display text-[28px] leading-tight">Checking shelves near you...</p>
        )}
      </div>

      {!error && (
        <ul aria-live="polite" className="mt-10 flex max-w-[340px] flex-wrap justify-center gap-x-2 gap-y-4">
          {(ranked ?? []).slice(0, shown).map((s, i) => (
            <motion.li
              key={s.store_id}
              initial={{ scale: 1.8, opacity: 0, rotate: TILTS[i % TILTS.length] * 2 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 14, stiffness: 380 }}
            >
              <Sticker color={storeColor(s.store_id)} tilt={TILTS[i % TILTS.length]}>
                {s.name}
              </Sticker>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  )
}
