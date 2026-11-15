import { motion } from 'framer-motion'
import { BuddyLine, DemoBadge, TornEdge } from '../components/brand.jsx'
import PaperMap from '../components/PaperMap.jsx'
import Sticker from '../components/Sticker.jsx'
import { DEFAULT_LOCATION, MODES } from '../config.js'
import {
  itemsFound,
  matchPct,
  miles,
  money,
  priceCounts,
  reasonLine,
  savingsVsNearby,
  storeColor,
  walkMinutes,
} from '../lib/stores.js'
import { ASK_CHIPS } from './AskTomSheet.jsx'

// The sticker slap after a price report: lands big and tilted, then settles.
function SlapSticker() {
  return (
    <motion.span
      className="inline-block"
      initial={{ scale: 2.4, opacity: 0, rotate: -24 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      transition={{ type: 'spring', damping: 11, stiffness: 420, delay: 0.15 }}
    >
      <Sticker color="olive" tilt={-6}>
        Real price
      </Sticker>
    </motion.span>
  )
}

function BestCard({ store, ranked, slapped, onReceipt }) {
  const { found, total } = itemsFound(store)
  const saves = savingsVsNearby(store, ranked)
  const { simulated } = priceCounts(store)
  return (
    <button
      type="button"
      onClick={onReceipt}
      aria-label={`Best pick: ${store.name}, ${money(store.total_basket_price)}. Open receipt.`}
      className="relative block w-full rounded-[4px] border-[1.5px] border-line bg-receipt p-4 pt-5 text-left"
    >
      <span className="absolute -right-2 -top-3">
        <Sticker color="pea" size="md" tilt={6}>
          Best pick
        </Sticker>
      </span>

      <span className="flex items-baseline justify-between gap-3">
        <span className="text-[20px] font-bold leading-tight text-ink">{store.name}</span>
        <span className="font-mono text-[24px] font-bold leading-none text-ink">{money(store.total_basket_price)}</span>
      </span>

      <span className="mt-2 block font-mono text-[12px] uppercase tracking-normal text-muted">
        {miles(store.distance_miles)} · {walkMinutes(store.distance_miles)} min walk · {found} of {total} · Match{' '}
        {matchPct(store)}
      </span>

      <span className="mt-3 flex min-h-[30px] items-center justify-between gap-2">
        <span className="font-mono text-[12px] font-bold uppercase tracking-[0.06em] text-olive">
          {saves > 0.005 ? `Saves ${money(saves)} vs nearby` : 'About average nearby'}
        </span>
        {slapped ? (
          <SlapSticker />
        ) : (
          simulated > 0 && (
            <Sticker dashed size="sm" tilt={4}>
              Simulated
            </Sticker>
          )
        )}
      </span>

      <span className="mt-2 block text-right font-mono text-[12px] font-bold uppercase tracking-[0.12em] text-ink">
        Receipt &gt;
      </span>
    </button>
  )
}

function RunnerRow({ store, n, slapped, onReceipt }) {
  const { found, total } = itemsFound(store)
  const { real } = priceCounts(store)
  return (
    <button
      type="button"
      onClick={onReceipt}
      className="relative flex min-h-14 w-full items-center gap-3 border-b-[1.5px] border-dashed border-line py-2 text-left"
      aria-label={`${n}. ${store.name}, ${money(store.total_basket_price)}, ${store.distance_miles} miles. Open receipt.`}
    >
      <Sticker shape="round" size="md" color={storeColor(store.store_id)} tilt={n % 2 ? -6 : 5}>
        {n}
      </Sticker>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-bold leading-tight text-ink">{store.name}</span>
        <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-[0.06em] text-muted">
          {miles(store.distance_miles)} · {found} of {total} · Match {matchPct(store)}
        </span>
      </span>
      <span className="flex flex-col items-end gap-0.5">
        {slapped && <SlapSticker />}
        <span className="font-mono text-[15px] font-bold text-ink">{money(store.total_basket_price)}</span>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
          {real > 0 ? `${real} real` : 'Simulated'}
        </span>
      </span>
    </button>
  )
}

export default function Results({ ranked, mode, onMode, budget, demo, busy, slapId, onReceipt, onEditBag, onAsk }) {
  return (
    <div className="min-h-full pb-[34px]">
      <div className="relative">
        <PaperMap ranked={ranked} user={DEFAULT_LOCATION} />
        <div className="absolute inset-x-0 top-12 flex items-center justify-between px-5">
          <button
            type="button"
            onClick={onEditBag}
            className="min-h-11 rounded-[14px] border-[1.5px] border-line bg-receipt px-4 text-[17px] font-semibold text-ink"
          >
            ‹ My bag
          </button>
          {demo && <DemoBadge />}
        </div>
      </div>

      <div className="relative -mt-6">
        <TornEdge color="var(--eggshell)" seed={5} height={14} />
        <div className="grain bg-eggshell px-5 pt-2">
          {/* Cheapest / Balanced / Closest */}
          <div role="radiogroup" aria-label="Sort stores" className="flex rounded-[12px] border-[1.5px] border-ink p-1">
            {MODES.map((m) => {
              const on = m.id === mode
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onMode(m.id)}
                  className={`min-h-11 flex-1 rounded-[9px] text-[17px] font-semibold transition-colors ${
                    on ? 'bg-ink text-eggshell' : 'text-ink'
                  }`}
                >
                  {m.label}
                </button>
              )
            })}
          </div>

          <div className="mt-6">
            <BuddyLine size={52} text={22}>
              {reasonLine(ranked, budget)}
            </BuddyLine>
          </div>

          <ol aria-busy={busy} className={`mt-6 transition-opacity ${busy ? 'opacity-60' : ''}`}>
            {ranked.map((s, i) => (
              <motion.li
                key={s.store_id}
                layout
                transition={{ type: 'spring', damping: 26, stiffness: 260 }}
                className={i === 0 ? 'mb-4' : ''}
              >
                {i === 0 ? (
                  <BestCard store={s} ranked={ranked} slapped={slapId === s.store_id} onReceipt={() => onReceipt(s.store_id)} />
                ) : (
                  <RunnerRow store={s} n={i + 1} slapped={slapId === s.store_id} onReceipt={() => onReceipt(s.store_id)} />
                )}
              </motion.li>
            ))}
          </ol>

          {/* Ask Tom: one scrolling row after the runner-ups */}
          <section aria-label="Ask Tom" className="mt-6">
            <h3 className="label text-[11px] text-muted">Ask Tom</h3>
            <div className="no-scrollbar -mx-5 mt-1 flex gap-2 overflow-x-auto px-5">
              {ASK_CHIPS.map((c) => (
                <button key={c.label} type="button" onClick={() => onAsk(c.question)} className="flex min-h-11 shrink-0 items-center">
                  <span className="flex h-9 items-center rounded-[14px] border-[1.5px] border-ink bg-receipt px-3 text-[14px] font-semibold text-ink">
                    {c.label}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
