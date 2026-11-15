import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BackButton, BuddyLine, DemoBadge, LandingSticker, SectionLabel, wash } from '../components/brand.jsx'
import LeafletMap from '../components/LeafletMap.jsx'
import { RadiusPill } from '../components/RadiusPills.jsx'
import Sticker, { STICKER_COLORS } from '../components/Sticker.jsx'
import { MODES } from '../config.js'
import { useBuddy } from '../lib/profile.js'
import { itemsFound, matchPct, money, priceCounts, reasonLine, savingsVsNearby, storeColor, tripLabel } from '../lib/stores.js'
import { askChips } from './AskTomSheet.jsx'

const fmtMi = (mi) => `${Number(mi).toFixed(1)} mi`
export const modeLabel = (m, buddyName) => (m.id === 'balanced' ? `${buddyName}'s pick` : m.label)

// The sticker slap after a price report: the calm landing (scale 0.9 -> 1, +4deg -> tilt, 320 ms).
function SlapSticker() {
  return (
    <LandingSticker delay={0.15}>
      <Sticker color="olive" tilt={-6}>
        Real price
      </Sticker>
    </LandingSticker>
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
  return `${fmtMi(s.distance_miles)} · ${tripLabel(s.distance_miles)} · ${found} of ${total} · ${matchPct(s)} match`
}

function BestCard({ store, ranked, ctx, onReceipt }) {
  const saves = savingsVsNearby(store, ranked)
  return (
    <button
      type="button"
      onClick={onReceipt}
      aria-label={`Best pick: ${store.name}, ${money(store.total_basket_price)}. Open receipt.`}
      className="relative block w-full rounded-[4px] border border-hair p-4 text-left"
      style={{ background: wash(storeColor(store.store_id), 14) }}
    >
      <span className="absolute -right-2.5 -top-3">
        <LandingSticker key={store.store_id} delay={0.2}>
          <Sticker color="pea" size="md" tilt={6}>
            Best pick
          </Sticker>
        </LandingSticker>
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
      className="relative flex min-h-[52px] w-full items-center gap-3 border-b border-hair py-2 text-left"
      aria-label={`${n}. ${store.name}, ${money(store.total_basket_price)}, ${store.distance_miles} miles. Open receipt.`}
    >
      <Sticker shape="round" size="md" color={storeColor(store.store_id)} tilt={n % 2 ? -6 : 5}>
        {n}
      </Sticker>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-bold leading-tight text-ink">{store.name}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-medium text-muted">
          <span>
            {fmtMi(store.distance_miles)} · {found} of {total} · {matchPct(store)} match
          </span>
          <ExtraSticker store={store} ctx={ctx} />
        </span>
      </span>
      <span className="w-[72px] shrink-0 text-right font-mono text-[15px] font-bold text-ink">{money(store.total_basket_price)}</span>
    </button>
  )
}

const fmtBudget = (b) => `$${Number.isInteger(b) ? b : Number(b).toFixed(2)}`

/** ranked: only the stores inside the radius (App filters by distance_miles). over: dollars over budget. */
export default function Results({ ranked, total, radius, onRadius, over = 0, mode, onMode, budget, demo, fellBack, busy, slapId, onReceipt, onEditBag, onAsk, user, bagSummary }) {
  const buddy = useBuddy()
  const allSimulated = ranked.every((s) => priceCounts(s).real === 0)
  const bestUnitId = ranked.reduce((a, s) => (!a || s.unit_price_savings_pct > a.unit_price_savings_pct ? s : a), null)?.store_id
  const ctx = { slapId, allSimulated, bestUnitId }
  const empty = ranked.length === 0 && total > 0
  // Nothing inside the circle: the radius pill pulses once (again each time the circle comes up empty).
  const [pulse, setPulse] = useState(0)
  useEffect(() => {
    if (empty) setPulse((n) => n + 1)
  }, [empty, radius])

  return (
    <div className="min-h-full pb-6">
      <div className="relative">
        <LeafletMap stores={ranked} user={user} radius={radius} height={300} padTop={16} />
        <div className="pointer-events-none absolute inset-x-0 top-14 z-[800] flex items-start justify-between px-5">
          <span data-map-avoid className="pointer-events-auto">
            <BackButton onClick={onEditBag} label="Back to my bag" />
          </span>
          <span className="pointer-events-auto flex flex-col items-end">
            <span data-map-avoid className="flex items-center gap-2">
              {demo && <DemoBadge />}
              {/* bag summary pill on a butter wash */}
              <button type="button" onClick={onEditBag} aria-label={`Your bag: ${bagSummary}. Edit`} className="flex min-h-11 items-center active:scale-[0.98]">
                <span className="flex h-8 items-center rounded-2xl px-3 text-[13px] font-semibold text-ink" style={{ background: wash('butter', 45, 'var(--eggshell)') }}>
                  {bagSummary}
                </span>
              </button>
            </span>
            {/* the search radius: a small pill under the bag pill (the Map tab keeps the full row) */}
            <span data-map-avoid className="-mt-2">
              <RadiusPill value={radius} onChange={onRadius} pulse={pulse} />
            </span>
          </span>
        </div>
      </div>

      {/* the map simply ends; content sits on eggshell */}
      <div className="relative z-10 border-t-[1.5px] border-line">
        <div className="px-5 pt-5">
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
              ) : empty ? (
                'Nothing that close. Try a bigger circle.'
              ) : over > 0.005 ? (
                <>
                  Dug up your best deal.
                  <span className="block">
                    That's {money(over)} over your {fmtBudget(budget)}.
                  </span>
                </>
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
              // rows appear with a 40 ms stagger (fade + 6px rise); re-ranking is a 360 ms FLIP
              <motion.li
                key={s.store_id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  layout: { duration: 0.36, ease: [0.22, 1, 0.36, 1] },
                  default: { duration: 0.26, ease: [0.22, 1, 0.36, 1], delay: i * 0.04 },
                }}
                className={i === 0 ? 'mb-4' : ''}
              >
                {i === 0 ? (
                  <BestCard store={s} ranked={ranked} ctx={ctx} onReceipt={() => onReceipt(s.store_id)} />
                ) : (
                  <RunnerRow store={s} n={i + 1} ctx={ctx} onReceipt={() => onReceipt(s.store_id)} />
                )}
              </motion.li>
            ))}
          </ol>
          {allSimulated && ranked.length > 0 && <p className="mt-3 text-[13px] text-muted">All prices here are simulated for the demo.</p>}

          {ranked.length > 0 && (
          <section aria-label={`Ask ${buddy.name}`} className="mt-6">
            <SectionLabel>Ask {buddy.name}</SectionLabel>
            <div className="no-scrollbar -mx-5 mt-2 flex gap-2 overflow-x-auto px-5">
              {askChips(ranked[0]).map((c) => (
                <button key={c.label} type="button" onClick={() => onAsk(c.question)} className="flex min-h-11 shrink-0 items-center">
                  <span className="flex h-9 items-center gap-2 rounded-[14px] border-[1.5px] border-ink bg-receipt px-3 text-[14px] font-semibold text-ink">
                    <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: STICKER_COLORS[c.dot].bg }} />
                    {c.label}
                  </span>
                </button>
              ))}
            </div>
          </section>
          )}
        </div>
      </div>
    </div>
  )
}
