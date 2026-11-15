import { useMemo } from 'react'
import { BottomBar, BuddyLine, DemoBadge, TornEdge } from '../components/brand.jsx'
import Sticker from '../components/Sticker.jsx'
import { appleMapsUrl, isReal, lineTotal, money, priceCounts, savingsVsNearby, walkMinutes } from '../lib/stores.js'

function Barcode({ seed }) {
  const bars = useMemo(() => {
    let h = 7
    for (const ch of seed) h = (h * 33 + ch.charCodeAt(0)) >>> 0
    const out = []
    let x = 0
    while (x < 196) {
      h = (h * 1103515245 + 12345) >>> 0
      const w = 1 + (h % 3)
      const gap = 1 + ((h >>> 3) % 3)
      out.push([x, w])
      x += w + gap
    }
    return out
  }, [seed])
  return (
    <svg viewBox="0 0 200 44" className="mx-auto block h-11 w-[200px]" aria-hidden="true">
      {bars.map(([x, w]) => (
        <rect key={x} x={x} y="0" width={w} height="44" fill="var(--ink)" />
      ))}
    </svg>
  )
}

const Rule = () => <div className="my-4 border-t-[1.5px] border-dashed border-line" />

// Receipt: Courier Prime only. Tom speaks above it, never on it.
export default function Receipt({ store, ranked, siftedAt, demo, onBack, onReport }) {
  const { real, simulated } = priceCounts(store)
  const saves = savingsVsNearby(store, ranked)
  const listed = new Set(store.items_breakdown.map((i) => i.query))
  const notFound = store.missing_items.filter((q) => !listed.has(q))
  const anyOut = store.items_breakdown.some((i) => !i.in_stock)
  const when = siftedAt
    .toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    .toUpperCase()

  return (
    <div className="flex min-h-full flex-col">
      <div className="px-5 pb-6 pt-14">
        <div className="flex items-center justify-between">
          <button type="button" onClick={onBack} className="-ml-1 min-h-11 pr-4 text-[17px] font-semibold text-ink">
            ‹ Results
          </button>
          {demo && <DemoBadge />}
        </div>

        <div className="mt-4">
          <BuddyLine size={64} text={28}>
            Here's the proof.
          </BuddyLine>
        </div>

        <article aria-label={`Receipt for ${store.name}`} className="mt-6 font-mono text-ink">
          <TornEdge color="var(--receipt)" seed={31} height={10} teeth={40} />
          <div className="grain bg-receipt px-4 py-4">
            <header className="text-center">
              <h2 className="text-[16px] font-bold uppercase tracking-[0.06em]">{store.name}</h2>
              <p className="mt-1 text-[12px] uppercase tracking-[0.12em] text-muted">{when}</p>
            </header>

            <Rule />

            <ul className="space-y-3">
              {store.items_breakdown.map((item) => {
                const qty = item.quantity ?? 1
                return (
                  <li key={item.query}>
                    <div className="flex items-start text-[15px] leading-5">
                      <span className="min-w-0 max-w-[68%] uppercase">
                        {qty > 1 && `${qty} x `}
                        {item.name}
                      </span>
                      <span className="dotted-leader mt-[14px] !transform-none" aria-hidden="true" />
                      <span className={`font-bold ${item.in_stock ? '' : 'text-muted line-through'}`}>
                        {money(lineTotal(item))}
                      </span>
                      <span className="ml-1 w-3 text-center text-[11px] font-bold leading-5 text-olive" aria-label={isReal(item) ? 'real price' : undefined}>
                        {isReal(item) ? 'R' : ''}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] uppercase tracking-[0.06em] text-muted">
                      {!item.in_stock && <span className="font-bold text-ink">Out of stock</span>}
                      {qty > 1 && <span>{money(item.price)} each</span>}
                      {item.unit_price && <span>{item.unit_price}</span>}
                      {item.price_age && <span>{item.price_age}</span>}
                      {item.stale && (
                        <Sticker dashed size="sm" tilt={4}>
                          Stale
                        </Sticker>
                      )}
                    </div>
                  </li>
                )
              })}
              {notFound.map((q) => (
                <li key={q} className="flex items-start text-[15px] leading-5 text-muted">
                  <span className="max-w-[68%] uppercase">{q}</span>
                  <span className="dotted-leader mt-[14px] !transform-none" aria-hidden="true" />
                  <span className="font-bold">NOT FOUND</span>
                </li>
              ))}
            </ul>

            <Rule />

            <div className="flex items-baseline justify-between text-[24px] font-bold">
              <span className="tracking-[0.12em]">TOTAL</span>
              <span>{money(store.total_basket_price)}</span>
            </div>
            {anyOut && (
              <p className="mt-1 text-[11px] uppercase tracking-[0.06em] text-muted">
                Out-of-stock items counted at the highest nearby price
              </p>
            )}

            <div className="mt-4 space-y-1 text-[12px] uppercase tracking-[0.12em]">
              <p>{saves >= 0 ? `Saves ${money(saves)}` : `${money(-saves)} more than`} vs nearby avg</p>
              <p>
                Walk {store.distance_miles.toFixed(2)} mi · about {walkMinutes(store.distance_miles)} min
              </p>
            </div>

            <Rule />

            <Barcode seed={store.store_id} />
            <p className="mt-3 text-center text-[12px] font-bold tracking-[0.12em]">
              {real} REAL · {simulated} SIMULATED
            </p>
            <p className="mt-2 text-center text-[12px] font-bold tracking-[0.25em]">THANKS FOR SIFTING</p>
          </div>
          <TornEdge color="var(--receipt)" edge="bottom" seed={47} height={10} teeth={40} />
        </article>
      </div>

      {/* Fixed bottom bar so the actions are never cut off */}
      <BottomBar>
        <a
          href={appleMapsUrl(store)}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-[52px] w-full items-center justify-center rounded-[14px] bg-ink text-[17px] font-semibold text-eggshell active:scale-[0.98]"
        >
          Walk there
        </a>
        <button
          type="button"
          onClick={onReport}
          className="mx-auto mt-1 block min-h-11 px-4 text-[17px] font-semibold text-ink underline decoration-dashed underline-offset-4"
        >
          Saw a different price?
        </button>
      </BottomBar>
    </div>
  )
}
