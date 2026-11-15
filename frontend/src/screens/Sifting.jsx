import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { DemoBadge, PrimaryButton, TornEdge, Tom } from '../components/brand.jsx'
import Sticker from '../components/Sticker.jsx'
import { money, storeColor } from '../lib/stores.js'

const LINE_MS = 250

/**
 * Tom says "Checking shelves near you..." while POST /api/rank-stores runs.
 * When stores come back, a receipt prints one line per store, 250 ms apart,
 * then we move to Results.
 */
export default function Sifting({ ranked, error, demo, onDone, onBack }) {
  const [shown, setShown] = useState(0)

  useEffect(() => {
    if (!ranked) return
    if (shown < ranked.length) {
      const t = setTimeout(() => setShown((n) => n + 1), LINE_MS)
      return () => clearTimeout(t)
    }
    const t = setTimeout(onDone, 500)
    return () => clearTimeout(t)
  }, [ranked, shown, onDone])

  return (
    <div className="flex min-h-full flex-col items-center px-5 pb-[34px] pt-14">
      <div className="flex h-6 w-full justify-end">{demo && <DemoBadge />}</div>

      <div className="mt-6 flex flex-col items-center text-center">
        <Tom size={96} />
        {error ? (
          <>
            <p className="mt-4 font-display text-[28px] leading-tight">Couldn't check shelves.</p>
            <p className="mt-2 max-w-[280px] text-[17px] text-muted">{error}</p>
            <PrimaryButton className="mt-8 max-w-[260px]" onClick={onBack}>
              Back to my bag
            </PrimaryButton>
          </>
        ) : (
          <p className="mt-4 font-display text-[28px] leading-tight">Checking shelves near you...</p>
        )}
      </div>

      {!error && (
        <div className="mt-8 w-full max-w-[340px]">
          <TornEdge color="var(--receipt)" seed={19} height={8} teeth={30} />
          <ol aria-live="polite" className="grain min-h-[72px] bg-receipt px-4 py-3 font-mono text-[12px] text-ink">
            {(ranked ?? []).slice(0, shown).map((s, i) => (
              <motion.li
                key={s.store_id}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="flex items-center gap-2 py-1.5"
              >
                <Sticker shape="round" size="sm" color={storeColor(s.store_id)} tilt={i % 2 ? 5 : -5}>
                  {i + 1}
                </Sticker>
                <span className="min-w-0 uppercase leading-tight">{s.name}</span>
                <span className="dotted-leader mb-[3px] self-end !transform-none" aria-hidden="true" />
                <span className="font-bold">{money(s.total_basket_price)}</span>
              </motion.li>
            ))}
          </ol>
          <TornEdge color="var(--receipt)" edge="bottom" seed={29} height={8} teeth={30} />
        </div>
      )}
    </div>
  )
}
