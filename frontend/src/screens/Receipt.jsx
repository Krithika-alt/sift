import { useMemo } from 'react'
import { BuddyLine, DemoBadge, Sticker, TornEdge } from '../components/brand.jsx'
import { appleMapsUrl, isReal, money, priceCounts, savingsVsNearby, storeColor } from '../lib/stores.js'

const WALK_MIN_PER_MILE = 20

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

const Rule = () => <div className="my-3 border-t-[1.5px] border-dashed border-line" />

// Receipt: Courier Prime only. Tom speaks above it, never on it.
export default function Receipt({ store, ranked, siftedAt, demo, onBack, onReport }) {
  const { real, simulated } = priceCounts(store)
  const saves = savingsVsNearby(store, ranked)
  const listed = new Set(store.items_breakdown.map((i) => i.query))
  const notFound = store.missing_items.filter((q) => !listed.has(q))
  const anyOut = store.items_breakdown.some((i) => !i.in_stock)
  const walkMin = Math.max(1, Math.round(store.distance_miles * WALK_MIN_PER_MILE))
  const when = siftedAt
    .toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    .toUpperCase()

  return (
    <div className="flex min-h-full flex-col px-4 pb-10 pt-[calc(10px+env(safe-area-inset-top))]">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="min-h-[44px] pr-4 text-[16px] font-semibold text-ink">
          ‹ Results
        </button>
        {demo && <DemoBadge />}
      </div>

      <div className="mt-3">
        <BuddyLine size={52}>Here's the proof.</BuddyLine>
      </div>

      <article aria-label={`Receipt for ${store.name}`} className="mt-5 font-mono text-ink">
        <TornEdge color="var(--receipt)" seed={31} height={10} teeth={40} />
        <div className="grain bg-receipt px-5 py-4">
          <header className="text-center">
            <Sticker color={storeColor(store.store_id)} tilt={-3} size="lg">
              {store.name}
            </Sticker>
            <p className="mt-3 text-[12px] uppercase tracking-[2px] text-muted">{when}</p>
            {simulated > 0 && (
              <div className="mt-2">
                <Sticker dashed tilt={3} size="sm">
                  Simulated
                </Sticker>
              </div>
            )}
          </header>

          <Rule />

          <ul className="space-y-2.5">
            {store.items_breakdown.map((item) => (
              <li key={item.query}>
                <div className="flex items-baseline text-[14px]">
                  <span className="max-w-[60%] truncate uppercase">{item.name}</span>
                  <span className="dotted-leader" aria-hidden="true" />
                  <span className={`font-bold ${item.in_stock ? '' : 'text-muted line-through'}`}>{money(item.price)}</span>
                  <span
                    className="ml-1.5 w-4 text-center text-[11px] font-bold text-olive"
                    aria-label={isReal(item) ? 'real price' : undefined}
                  >
                    {isReal(item) ? 'R' : ''}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] uppercase tracking-[1px] text-muted">
                  {!item.in_stock && <span className="font-bold text-ink">Out of stock</span>}
                  {item.unit_price && <span>{item.unit_price}</span>}
                  {item.price_age && <span>{item.price_age}</span>}
                  {item.stale && (
                    <Sticker dashed tilt={4} size="sm">
                      Stale
                    </Sticker>
                  )}
                </div>
              </li>
            ))}
            {notFound.map((q) => (
              <li key={q} className="flex items-baseline text-[14px] text-muted">
                <span className="uppercase">{q}</span>
                <span className="dotted-leader" aria-hidden="true" />
                <span className="font-bold">NOT FOUND</span>
              </li>
            ))}
          </ul>

          <Rule />

          <div className="flex items-baseline justify-between text-[20px] font-bold">
            <span className="tracking-[2px]">TOTAL</span>
            <span>{money(store.total_basket_price)}</span>
          </div>
          {anyOut && (
            <p className="mt-1 text-[11px] uppercase tracking-[1px] text-muted">
              Out-of-stock items counted at the highest nearby price
            </p>
          )}

          <div className="mt-3 space-y-1 text-[12px] uppercase tracking-[1.5px]">
            <p>
              {saves >= 0 ? `Saves ${money(saves)}` : `${money(-saves)} more than`} vs nearby avg
            </p>
            <p>
              Walk {store.distance_miles.toFixed(2)} mi · about {walkMin} min
            </p>
            <p className="font-bold">
              {real} real · {simulated} simulated
            </p>
          </div>

          <Rule />

          <Barcode seed={store.store_id} />
          <p className="mt-3 text-center text-[12px] font-bold tracking-[3px]">THANKS FOR SIFTING</p>
        </div>
        <TornEdge color="var(--receipt)" edge="bottom" seed={47} height={10} teeth={40} />
      </article>

      <a
        href={appleMapsUrl(store)}
        target="_blank"
        rel="noreferrer"
        className="mt-6 flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-ink text-[17px] font-semibold text-eggshell active:scale-[0.98]"
      >
        Walk there
      </a>
      <button
        type="button"
        onClick={onReport}
        className="mx-auto mt-3 min-h-[44px] px-4 text-[16px] font-semibold text-ink underline decoration-dashed underline-offset-4"
      >
        Saw a different price?
      </button>
    </div>
  )
}
