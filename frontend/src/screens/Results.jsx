import { motion } from 'framer-motion'
import { BuddyLine, DemoBadge, NumberSticker, Sticker, TornEdge } from '../components/brand.jsx'
import PaperMap from '../components/PaperMap.jsx'
import { ASK_CHIPS } from './AskTomSheet.jsx'
import { DEFAULT_LOCATION, MODES } from '../config.js'
import { itemsFound, miles, money, priceCounts, reasonLine, savingsVsNearby, storeColor } from '../lib/stores.js'

function priceNote(store) {
  const { real, simulated } = priceCounts(store)
  if (real === 0) return 'Simulated'
  if (simulated === 0) return `${real} real`
  return `${real} real · ${simulated} sim`
}

// The sticker slap after a price report: lands big and tilted, settles on the card.
function SlapSticker({ className = '' }) {
  return (
    <motion.span
      className={`z-10 inline-block ${className}`}
      initial={{ scale: 2.4, opacity: 0, rotate: -24 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      transition={{ type: 'spring', damping: 11, stiffness: 420, delay: 0.15 }}
    >
      <Sticker color="olive" tilt={-7}>
        Real price
      </Sticker>
    </motion.span>
  )
}

function BestCard({ store, ranked, slapped, onReceipt }) {
  const { found, total } = itemsFound(store)
  const saves = savingsVsNearby(store, ranked)
  return (
    <div className="relative rounded-2xl border-[1.5px] border-line bg-receipt p-4 pt-5">
      <span className="absolute -right-2 -top-4 z-10">
        <Sticker color="pea" tilt={6} size="lg">
          Best pick
        </Sticker>
      </span>
      <h3 className="pr-8 text-[22px] font-bold leading-tight text-ink">{store.name}</h3>
      <div className="mt-3 flex items-end justify-between gap-3">
        <span className="font-mono text-[32px] font-bold leading-none text-ink">{money(store.total_basket_price)}</span>
        <span className="label pb-1 text-right text-muted">
          {miles(store.distance_miles)} · {found}/{total} items
        </span>
      </div>
      <div className="relative mt-4 flex min-h-[32px] items-center justify-between gap-2">
        {slapped ? (
          <SlapSticker />
        ) : saves > 0.005 ? (
          <Sticker color="butter" tilt={-4}>
            Saves {money(saves)} vs nearby
          </Sticker>
        ) : (
          <span className="label text-muted">About average nearby</span>
        )}
        <span className="label text-[10px] tracking-[1.5px] text-muted">{priceNote(store)}</span>
      </div>
      <button
        type="button"
        onClick={onReceipt}
        className="label mt-4 min-h-[48px] w-full rounded-xl border-[1.5px] border-ink text-[13px] text-ink active:bg-ink active:text-eggshell"
      >
        See receipt
      </button>
    </div>
  )
}

function RunnerRow({ store, n, slapped, onReceipt }) {
  const { found, total } = itemsFound(store)
  return (
    <button
      type="button"
      onClick={onReceipt}
      className="relative flex min-h-[64px] w-full items-center gap-3 border-b-[1.5px] border-dashed border-line py-3 text-left"
      aria-label={`${n}. ${store.name}, ${money(store.total_basket_price)}, ${store.distance_miles} miles. See receipt.`}
    >
      <NumberSticker n={n} color={storeColor(store.store_id)} tilt={n % 2 ? -6 : 5} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[20px] font-bold leading-tight text-ink">{store.name}</span>
        <span className="label mt-0.5 block text-[11px] tracking-[1.5px] text-muted">
          {miles(store.distance_miles)} · {found}/{total} items
        </span>
      </span>
      <span className="flex flex-col items-end">
        <span className="font-mono text-[17px] font-bold text-ink">{money(store.total_basket_price)}</span>
        <span className="label text-[9px] tracking-[1.5px] text-muted">{priceNote(store)}</span>
      </span>
      {slapped && <SlapSticker className="absolute -top-2 right-20" />}
    </button>
  )
}

export default function Results({ ranked, mode, onMode, budget, demo, busy, slapId, onReceipt, onEditBag, onAsk }) {
  return (
    <div className="min-h-full">
      <div className="relative">
        <PaperMap ranked={ranked} user={DEFAULT_LOCATION} />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-3 pt-[calc(10px+env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={onEditBag}
            className="min-h-[44px] rounded-full border-[1.5px] border-line bg-receipt px-4 text-[15px] font-semibold text-ink"
          >
            ‹ My bag
          </button>
          {demo && (
            <span className="rounded-md bg-eggshell">
              <DemoBadge />
            </span>
          )}
        </div>
      </div>

      <div className="relative -mt-7">
        <TornEdge color="var(--eggshell)" seed={5} height={14} />
        <div className="grain bg-eggshell px-4 pb-10">
          {/* Cheapest / Balanced / Closest */}
          <div role="radiogroup" aria-label="Sort stores" className="flex rounded-2xl border-[1.5px] border-ink p-1">
            {MODES.map((m) => {
              const on = m.id === mode
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onMode(m.id)}
                  className={`min-h-[44px] flex-1 rounded-xl text-[16px] font-semibold transition-colors ${
                    on ? 'bg-ink text-eggshell' : 'text-ink'
                  }`}
                >
                  {m.label}
                </button>
              )
            })}
          </div>

          <div className="mt-5">
            <BuddyLine size={52}>{reasonLine(ranked, budget)}</BuddyLine>
          </div>

          {/* Ask Tom */}
          <div className="mt-3 flex flex-wrap gap-2">
            {ASK_CHIPS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onAsk(q)}
                className="min-h-[44px] rounded-full border-[1.5px] border-ink bg-receipt px-4 text-[15px] font-semibold text-ink active:bg-ink active:text-eggshell"
              >
                {q}
              </button>
            ))}
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
        </div>
      </div>
    </div>
  )
}
