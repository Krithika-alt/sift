import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { IdleBuddy, LandingSticker, TornEdge } from '../components/brand.jsx'
import Sticker from '../components/Sticker.jsx'
import Wordmark from '../components/Wordmark.jsx'
import { useBuddy } from '../lib/profile.js'
import { money, storeColor } from '../lib/stores.js'

const LINE_MS = 250
const HOLD_MS = 600

/**
 * A dirt moment: full-screen soil while POST /api/rank-stores runs. Buddy (96px) centered, the
 * line under it, then a receipt strip (300 wide, torn top and bottom) that is never empty: three
 * slow dots while waiting, then the nearest store at once and the rest every 250 ms. The best
 * store's line gets a BEST PICK sticker; hold 600 ms after the last line, then go to Results.
 * No dirt patch or sprouts on soil.
 */
export default function Sifting({ ranked, error, demo, onDone, onBack }) {
  const buddy = useBuddy()
  const [shown, setShown] = useState(0)
  const lines = useMemo(
    () => (ranked ?? []).map((s, i) => ({ ...s, rank: i + 1 })).sort((a, b) => a.distance_miles - b.distance_miles),
    [ranked],
  )

  // The first line prints the moment the stores arrive; then one every 250 ms.
  useEffect(() => {
    if (ranked && lines.length && shown === 0) setShown(1)
  }, [ranked, lines.length, shown])
  useEffect(() => {
    if (!ranked || (lines.length && shown === 0)) return
    if (shown < lines.length) {
      const t = setTimeout(() => setShown((n) => n + 1), LINE_MS)
      return () => clearTimeout(t)
    }
    const t = setTimeout(onDone, HOLD_MS)
    return () => clearTimeout(t)
  }, [ranked, lines.length, shown, onDone])

  const line = error ? "Couldn't reach the shelves." : ranked ? `Digging through ${ranked.length} stores...` : 'Digging through stores...'

  return (
    <div className="soil flex min-h-full flex-col items-center px-5 pb-[34px] pt-14">
      <div className="flex w-full items-start justify-between">
        <span className="w-20" />
        <Wordmark size={120} onSoil />
        <span className="flex w-20 justify-end">
          {demo && (
            <span className="rounded-[4px] border border-eggshell/70 px-2 py-0.5 text-[12px] font-semibold text-eggshell">
              Demo data
            </span>
          )}
        </span>
      </div>

      <div className="mt-6 flex flex-col items-center gap-6">
        <IdleBuddy id={buddy.id} size={96} say={line} />
        <p className="text-center font-display text-[28px] leading-[1.15] text-eggshell">{line}</p>

        {error ? (
          <>
            <p className="max-w-[300px] text-center text-[17px] text-eggshell">{error}</p>
            <button
              type="button"
              onClick={onBack}
              className="mt-2 min-h-[52px] w-full max-w-[280px] rounded-[14px] bg-eggshell text-[17px] font-semibold text-ink"
            >
              Back to my bag
            </button>
          </>
        ) : (
          <div className="w-[300px]">
            <TornEdge color="var(--receipt)" seed={23} height={10} teeth={36} />
            <ol aria-live="polite" className="grain bg-receipt px-4 py-2 text-ink">
              {!ranked ? (
                <li className="flex h-10 items-center justify-center gap-2" aria-label="Waiting for prices">
                  <span className="dot-pulse flex gap-2" aria-hidden="true">
                    <span className="h-2 w-2 rounded-full bg-muted" />
                    <span className="h-2 w-2 rounded-full bg-muted" />
                    <span className="h-2 w-2 rounded-full bg-muted" />
                  </span>
                </li>
              ) : lines.length === 0 ? (
                <li className="flex h-10 items-center justify-center text-[15px] font-semibold text-muted">No stores inside your circle.</li>
              ) : (
                lines.slice(0, shown).map((s) => (
                  <motion.li
                    key={s.store_id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                    className="relative flex items-center gap-2 py-1.5"
                  >
                    <Sticker shape="round" size="sm" color={storeColor(s.store_id)} tilt={s.rank % 2 ? 5 : -5}>
                      {s.rank}
                    </Sticker>
                    <span className="min-w-0 text-[15px] font-semibold leading-tight">{s.name}</span>
                    <span className="dotted-leader mb-[3px] self-end !transform-none" aria-hidden="true" />
                    <span className="font-mono text-[14px] font-bold">{money(s.total_basket_price)}</span>
                    {s.rank === 1 && (
                      <LandingSticker className="absolute -top-3 right-14" delay={0.1}>
                        <Sticker color="pea" size="sm" tilt={-6}>
                          Best pick
                        </Sticker>
                      </LandingSticker>
                    )}
                  </motion.li>
                ))
              )}
            </ol>
            <TornEdge color="var(--receipt)" edge="bottom" seed={29} height={10} teeth={36} />
          </div>
        )}
      </div>
    </div>
  )
}
