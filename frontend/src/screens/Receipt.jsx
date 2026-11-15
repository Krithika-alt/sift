import { useMemo } from 'react'
import { BackButton, BottomBar, BuddyLine, DemoBadge, TornEdge, wash } from '../components/brand.jsx'
import Sticker from '../components/Sticker.jsx'
import { directionsUrl, isReal, lineTotal, money, priceCounts, savingsVsNearby, storeColor, walkMinutes } from '../lib/stores.js'

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

// "SMALLER PACK · SHELF $1.49 · SHOWN PER 2 LB FOR A FAIR COMPARE". shelf_price is never the main price.
function packNote(item) {
  const size = String(item.name).split(',').slice(1).join(',').trim()
  const kind = item.shelf_price < item.price ? 'Smaller pack' : 'Bigger pack'
  return [kind, `Shelf ${money(item.shelf_price)}`, size ? `Shown per ${size} for a fair compare` : 'Shown per standard pack for a fair compare'].join(' · ')
}

const Rule = () => <div className="my-4 border-t-[1.5px] border-dashed border-line" />

// Receipt: Courier Prime only. Tom speaks above it, never on it.
export default function Receipt({ store, ranked, siftedAt, demo, onBack, onReport }) {
  const { real, simulated } = priceCounts(store)
  const band = wash(storeColor(store.store_id), 14)
  const saves = savingsVsNearby(store, ranked)
  const listed = new Set(store.items_breakdown.map((i) => i.query))
  const notFound = store.missing_items.filter((q) => !listed.has(q))
  const inStock = store.items_breakdown.filter((i) => i.in_stock)
  const notHere = store.items_breakdown.filter((i) => !i.in_stock)
  const when = siftedAt
    .toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    .toUpperCase()

  return (
    <div className="flex min-h-full flex-col">
      <div className="px-5 pb-6 pt-14">
        <header className="flex h-11 items-center justify-between">
          <BackButton onClick={onBack} label="Back to results" />
          {demo && <DemoBadge />}
        </header>

        <div className="mt-4">
          <BuddyLine size={64} text={28} splotch>
            Here's the proof.
          </BuddyLine>
        </div>

        <article aria-label={`Receipt for ${store.name}`} className="mt-6 font-mono text-ink">
          {/* torn top in the store's light wash, then a 56px band behind the store name */}
          <TornEdge color={band} seed={31} height={10} teeth={40} />
          <div className="flex h-14 items-center justify-center px-4" style={{ background: band }}>
            <h2 className="text-center text-[16px] font-bold uppercase leading-tight tracking-[0.06em]">{store.name}</h2>
          </div>
          <div className="grain bg-receipt px-4 py-4">
            <header className="text-center">
              <p className="text-[12px] uppercase tracking-[0.12em] text-muted">{when}</p>
              {store.last_crowd_ping && (
                <p className="mt-1 text-[12px] uppercase tracking-[0.12em] text-muted">Checked {store.last_crowd_ping}</p>
              )}
            </header>

            <Rule />

            <ul className="space-y-3">
              {inStock.map((item) => {
                const qty = item.quantity ?? 1
                return (
                  <li key={item.query}>
                    <div className="flex items-start text-[15px] leading-5">
                      <span className="min-w-0 max-w-[68%] uppercase">
                        {qty > 1 && `${qty} x `}
                        {item.name}
                      </span>
                      <span className="dotted-leader mt-[14px] !transform-none" aria-hidden="true" />
                      <span className="font-bold">{money(lineTotal(item))}</span>
                      <span className="ml-1 w-3 text-center text-[11px] font-bold leading-5 text-olive" aria-label={isReal(item) ? 'real price' : undefined}>
                        {isReal(item) ? 'R' : ''}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] uppercase tracking-[0.06em] text-muted">
                      {qty > 1 && <span>{money(item.price)} each</span>}
                      {item.unit_price && <span>{item.unit_price}</span>}
                      {item.price_age && <span>{item.price_age}</span>}
                      {item.stale && (
                        <Sticker dashed size="sm" tilt={4}>
                          Stale
                        </Sticker>
                      )}
                    </div>
                    {item.pack_note && item.shelf_price != null && (
                      <p className="mt-0.5 text-[11px] uppercase tracking-[0.06em] text-muted">{packNote(item)}</p>
                    )}
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

            {notHere.length > 0 && (
              <>
                <Rule />
                <ul className="space-y-2">
                  {notHere.map((item) => (
                    <li key={item.query} className="flex items-start text-[15px] leading-5">
                      <span className="min-w-0 max-w-[68%] uppercase underline decoration-tomato decoration-dashed decoration-2 underline-offset-4">
                        Not at this store: {(item.quantity ?? 1) > 1 && `${item.quantity} x `}
                        {item.query}
                      </span>
                      <span className="dotted-leader mt-[14px] !transform-none" aria-hidden="true" />
                      <span className="font-bold">{money(lineTotal(item))}</span>
                      <span className="ml-1 w-3" />
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] uppercase tracking-[0.06em] text-muted">
                  Counted at the highest nearby price
                </p>
              </>
            )}

            <Rule />

            <div className="flex items-baseline justify-between text-[24px] font-bold">
              <span className="tracking-[0.12em]">TOTAL</span>
              <span>{money(store.total_basket_price)}</span>
            </div>

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
            <p className="mt-2 text-center text-[12px] font-bold tracking-[0.25em]">DUG UP BY SIFT</p>
          </div>
          <TornEdge color="var(--receipt)" edge="bottom" seed={47} height={10} teeth={40} />
        </article>
      </div>

      {/* Fixed bottom bar so the actions are never cut off */}
      <BottomBar>
        <a
          href={directionsUrl(store)}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-14 w-full items-center justify-center rounded-[14px] bg-soil text-[17px] font-semibold text-eggshell active:scale-[0.98]"
        >
          Get directions
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
