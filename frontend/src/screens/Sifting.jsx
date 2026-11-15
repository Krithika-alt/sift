import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { BuddyLine } from '../components/brand.jsx'
import Sticker from '../components/Sticker.jsx'
import Wordmark from '../components/Wordmark.jsx'
import { money, storeColor } from '../lib/stores.js'

const LINE_MS = 250
const HOLD_MS = 600

/**
 * A dirt moment: full-screen soil while POST /api/rank-stores runs. When stores come back, a
 * receipt strip prints one line per store (nearest first), 250 ms apart. The best store's line
 * gets a BEST PICK sticker; hold 600 ms after the last line, then go to Results.
 */
export default function Sifting({ ranked, error, demo, onDone, onBack }) {
  const [shown, setShown] = useState(0)
  const lines = useMemo(
    () => (ranked ?? []).map((s, i) => ({ ...s, rank: i + 1 })).sort((a, b) => a.distance_miles - b.distance_miles),
    [ranked],
  )

  useEffect(() => {
    if (!ranked) return
    if (shown < lines.length) {
      const t = setTimeout(() => setShown((n) => n + 1), LINE_MS)
      return () => clearTimeout(t)
    }
    const t = setTimeout(onDone, HOLD_MS)
    return () => clearTimeout(t)
  }, [ranked, lines.length, shown, onDone])

  return (
    <div className="soil flex min-h-full flex-col items-center px-5 pb-[34px] pt-14">
      <div className="flex w-full items-start justify-between">
        <span className="w-20" />
        <Wordmark size={120} onSoil />
        <span className="flex w-20 justify-end">
          {demo && (
            <span className="rounded-[4px] border-[1.5px] border-dashed border-eggshell/70 px-2 py-0.5 text-[12px] font-semibold text-eggshell">
              Demo data
            </span>
          )}
        </span>
      </div>

      <div className="mt-6">
        <BuddyLine size={96} text={28} color="var(--eggshell)" splotch>
          {error
            ? "Couldn't reach the shelves."
            : ranked
              ? `Digging through ${ranked.length} stores...`
              : 'Digging through stores...'}
        </BuddyLine>
      </div>

      {error ? (
        <>
          <p className="mt-4 max-w-[300px] text-center text-[17px] text-eggshell">{error}</p>
          <button
            type="button"
            onClick={onBack}
            className="mt-8 min-h-[52px] w-full max-w-[280px] rounded-[14px] bg-eggshell text-[17px] font-semibold text-ink"
          >
            Back to my bag
          </button>
        </>
      ) : (
        <div className="mt-8 w-[300px]">
          <ol aria-live="polite" className="grain min-h-[64px] rounded-[4px] bg-receipt px-4 py-2 text-ink">
            {lines.slice(0, shown).map((s) => (
              <motion.li
                key={s.store_id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="relative flex items-center gap-2 py-1.5"
              >
                <Sticker shape="round" size="sm" color={storeColor(s.store_id)} tilt={s.rank % 2 ? 5 : -5}>
                  {s.rank}
                </Sticker>
                <span className="min-w-0 text-[15px] font-semibold leading-tight">{s.name}</span>
                <span className="dotted-leader mb-[3px] self-end !transform-none" aria-hidden="true" />
                <span className="font-mono text-[14px] font-bold">{money(s.total_basket_price)}</span>
                {s.rank === 1 && (
                  <motion.span
                    className="absolute -top-3 right-14"
                    initial={{ scale: 2, opacity: 0, rotate: -20 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    transition={{ type: 'spring', damping: 12, stiffness: 400, delay: 0.1 }}
                  >
                    <Sticker color="pea" size="sm" tilt={-6}>
                      Best pick
                    </Sticker>
                  </motion.span>
                )}
              </motion.li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
