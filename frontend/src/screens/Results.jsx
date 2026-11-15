import { motion } from 'framer-motion'
import { BuddyLine, DemoBadge, SectionLabel, TornEdge } from '../components/brand.jsx'
import PaperMap from '../components/PaperMap.jsx'
import Sticker from '../components/Sticker.jsx'
import { MODES } from '../config.js'
import { useBuddy } from '../lib/profile.js'
import { itemsFound, matchPct, money, priceCounts, reasonLine, savingsVsNearby, storeColor, walkMinutes } from '../lib/stores.js'
import { askChips } from './AskTomSheet.jsx'

const fmtMi = (mi) => `${Number(mi).toFixed(1)} mi`
export const modeLabel = (m, buddyName) => (m.id === 'balanced' ? `${buddyName}'s pick` : m.label)

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

/**
 * One extra sticker per store (the card already has BEST PICK or its number), in priority order:
 * the price-report slap, SIMULATED (when the result mixes real and simulated prices),
 * CROWD-CHECKED (last_crowd_ping), BEST UNIT PRICE (highest unit_price_savings_pct).
 */
function ExtraSticker({ store, ctx }) {
  if (ctx.slapId === store.store_id) return <SlapSticker />
  if (!ctx.allSimulated && priceCounts(store).simulated > 0)
    return (
      <Sticker dashed size="sm" tilt={4}>
        Simulated
      </Sticker>
    )
  if (store.last_crowd_ping)
    return (
      <Sticker color="sardine" size="sm" tilt={-4}>
        Crowd-checked
      </Sticker>
    )
  if (ctx.bestUnitId === store.store_id)
    return (
      <Sticker color="butter" size="sm" tilt={5}>
        Best unit price
      </Sticker>
    )
  return null
}

const meta = (s) => {
  const { found, total } = itemsFound(s)
  return `${fmtMi(s.distance_miles)} · ${walkMinutes(s.distance_miles)} min walk · ${found} of ${total} · ${matchPct(s)} match`
}

function BestCard({ store, ranked, ctx, onReceipt }) {
  const saves = savingsVsNearby(store, ranked)
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
      <span className="mt-2 block text-[13px] font-medium text-muted">{meta(store)}</span>
      <span className="mt-3 flex min-h-[30px] items-center justify-between gap-2">
        <span className="text-[14px] font-semibold text-olive">
          {saves > 0.005 ? `Saves ${money(saves)} vs nearby` : 'About average nearby'}
        </span>
        <ExtraSticker store={store} ctx={ctx} />
      </span>
      <span className="mt-2 block text-right text-[15px] font-semibold text-ink">Receipt &gt;</span>
    </button>
  )
}

function RunnerRow({ store, n, ctx, onReceipt }) {
  const { found, total } = itemsFound(store)
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
        <span className="mt-0.5 block text-[13px] font-medium text-muted">
          {fmtMi(store.distance_miles)} · {found} of {total} · {matchPct(store)} match
        </span>
      </span>
      <span className="flex flex-col items-end gap-1">
        <ExtraSticker store={store} ctx={ctx} />
        <span className="font-mono text-[15px] font-bold text-ink">{money(store.total_basket_price)}</span>
      </span>
    </button>
  )
}

export default function Results({ ranked, mode, onMode, budget, demo, fellBack, busy, slapId, onReceipt, onEditBag, onAsk, user }) {
  const buddy = useBuddy()
  const allSimulated = ranked.every((s) => priceCounts(s).real === 0)
  const bestUnitId = ranked.reduce((a, s) => (!a || s.unit_price_savings_pct > a.unit_price_savings_pct ? s : a), null)?.store_id
  const ctx = { slapId, allSimulated, bestUnitId }

  return (
    <div className="min-h-full pb-6">
      <div className="relative">
        <PaperMap stores={ranked} user={user} sizes={Object.fromEntries(ranked.map((s) => [s.store_id, 'md']))} height={300} focusY={170} />
        <div className="pointer-events-none absolute inset-x-0 top-12 z-10 flex items-center justify-between px-5">
          <button
            type="button"
            onClick={onEditBag}
            aria-label="Back to my bag"
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-line bg-eggshell text-ink"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          {demo && <DemoBadge />}
        </div>
      </div>

      <div className="relative z-10 -mt-6">
        <TornEdge color="var(--eggshell)" seed={5} height={14} />
        <div className="grain bg-eggshell px-5">
          <div className="h-2" />
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
                  className={`min-h-11 flex-1 rounded-[9px] text-[15px] font-semibold transition-colors ${on ? 'bg-ink text-eggshell' : 'text-ink'}`}
                >
                  {modeLabel(m, buddy.name)}
                </button>
              )
            })}
          </div>

          <div className="mt-6">
            <BuddyLine size={56} text={22}>
              {fellBack ? (
                "I can't reach the shelves right now. Showing saved prices."
              ) : (
                <>
                  Dug up your best deal.
                  <span className="block">{reasonLine(ranked, budget)}</span>
                </>
              )}
            </BuddyLine>
          </div>

          <ol aria-busy={busy} className={`mt-6 transition-opacity ${busy ? 'opacity-60' : ''}`}>
            {ranked.map((s, i) => (
              <motion.li key={s.store_id} layout transition={{ type: 'spring', damping: 26, stiffness: 260 }} className={i === 0 ? 'mb-4' : ''}>
                {i === 0 ? (
                  <BestCard store={s} ranked={ranked} ctx={ctx} onReceipt={() => onReceipt(s.store_id)} />
                ) : (
                  <RunnerRow store={s} n={i + 1} ctx={ctx} onReceipt={() => onReceipt(s.store_id)} />
                )}
              </motion.li>
            ))}
          </ol>
          {allSimulated && <p className="mt-3 text-[13px] text-muted">All prices here are simulated for the demo.</p>}

          <section aria-label={`Ask ${buddy.name}`} className="mt-6">
            <SectionLabel>Ask {buddy.name}</SectionLabel>
            <div className="no-scrollbar -mx-5 mt-1 flex gap-2 overflow-x-auto px-5">
              {askChips(ranked[0]).map((c) => (
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
