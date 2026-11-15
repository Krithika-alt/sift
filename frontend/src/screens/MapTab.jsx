import { useLayoutEffect, useRef, useState } from 'react'
import { motion, useAnimation } from 'framer-motion'
import { TornEdge } from '../components/brand.jsx'
import PaperMap from '../components/PaperMap.jsx'
import Sticker from '../components/Sticker.jsx'
import { directionsUrl, money, storeColor, walkMinutes } from '../lib/stores.js'

const SHEET_MAX = 520
const SHEET_MIN = 260
const DRAG = SHEET_MAX - SHEET_MIN

// Counts what the sheet lists.
const headline = (stores) => (stores.length ? `${stores.length} ${stores.length === 1 ? 'store' : 'stores'} near you` : 'Finding stores near you')

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.8l9.2 9.2-9.2 9.2L2.8 12z" />
      <path d="M9 14.5v-2.2a1.5 1.5 0 0 1 1.5-1.5h4M12.8 8.6l2.2 2.2-2.2 2.2" />
    </svg>
  )
}

/**
 * "Stores near you": full-screen paper map plus a kraft sheet (260px, drag to 520px) with one
 * row per store sorted by value. Tap a pin or a row to select it.
 */
export default function MapTab({ ranked, user, bagEmpty, canReceipt, onReceipt, demo }) {
  const [selected, setSelected] = useState(null)
  const controls = useAnimation()
  const [expanded, setExpanded] = useState(false)
  // The SVG map fills this screen: measure it and draw at 390 wide.
  const box = useRef(null)
  const [mapH, setMapH] = useState(700)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => el.clientWidth && setMapH(Math.round((el.clientHeight * 390) / el.clientWidth))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const stores = ranked ?? []
  const sizes = Object.fromEntries(stores.map((s, i) => [s.store_id, !bagEmpty && i === 0 ? 'lg' : 'sm']))

  const snap = (open) => {
    setExpanded(open)
    controls.start({ y: open ? 0 : DRAG, transition: { type: 'spring', damping: 30, stiffness: 300 } })
  }

  return (
    <div ref={box} className="relative h-full overflow-hidden">
      {/* stores sit in the open area between the title and the sheet */}
      <PaperMap stores={stores} user={user} sizes={sizes} selectedId={selected} onSelect={setSelected} height={mapH} focusY={(mapH - SHEET_MIN) / 2 + 40} full className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-x-0 top-12 z-10 flex justify-between px-5">
        <h1 className="pointer-events-auto relative px-3 py-1 font-display text-[24px] text-ink">
          <span aria-hidden="true" className="absolute inset-0 -z-10 bg-eggshell" style={{ filter: 'url(#sift-sticker-edge)' }} />
          Stores near you
        </h1>
        {demo && (
          <span className="pointer-events-auto self-center rounded-[4px] border-[1.5px] border-dashed border-muted bg-eggshell px-2 py-0.5 text-[12px] font-semibold text-muted">
            Demo data
          </span>
        )}
      </div>

      <motion.section
        aria-label="Stores list"
        className="absolute inset-x-0 bottom-0 z-20 flex flex-col"
        style={{ height: SHEET_MAX }}
        initial={{ y: DRAG }}
        animate={controls}
        drag="y"
        dragConstraints={{ top: 0, bottom: DRAG }}
        dragElastic={0.05}
        onDragEnd={(_, info) => snap(info.offset.y < -40 || (expanded && info.offset.y < 40))}
      >
        <TornEdge color="var(--kraft)" seed={23} height={14} className="shrink-0" />
        <div className="grain flex min-h-0 flex-1 flex-col bg-kraft px-5">
          <button
            type="button"
            onClick={() => snap(!expanded)}
            aria-label={expanded ? 'Show less' : 'Show more'}
            className="mx-auto flex h-6 w-16 shrink-0 items-start justify-center"
          >
            <span className="mt-1 h-1.5 w-10 rounded-full bg-ink/40" />
          </button>
          <div className="flex shrink-0 items-baseline justify-between gap-2">
            <h2 className="font-display text-[24px] leading-tight text-ink">{headline(stores)}</h2>
          </div>
          <ul className="no-scrollbar mt-2 min-h-0 flex-1 overflow-y-auto pb-4" onPointerDownCapture={(e) => expanded && e.stopPropagation()}>
            {stores.map((s, i) => {
              const on = s.store_id === selected
              return (
                <li key={s.store_id} className={`border-b-[1.5px] border-dashed border-ink/20 ${on ? '-mx-2 rounded-[4px] bg-receipt px-2 pb-3' : ''}`}>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setSelected(s.store_id)} aria-pressed={on} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 text-left">
                      <Sticker shape="round" size="md" color={storeColor(s.store_id)} tilt={(i + 1) % 2 ? -6 : 5}>
                        {i + 1}
                      </Sticker>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[16px] font-bold leading-tight text-ink">{s.name}</span>
                        <span className="block text-[13px] font-medium text-ink/80">
                          {s.distance_miles.toFixed(1)} mi · {walkMinutes(s.distance_miles)} min walk
                        </span>
                      </span>
                      {bagEmpty ? (
                        <span className="max-w-[88px] text-right text-[13px] leading-tight text-ink/80">Add items to compare</span>
                      ) : (
                        <span className="font-mono text-[15px] font-bold text-ink">{money(s.total_basket_price)}</span>
                      )}
                    </button>
                    {/* one-tap directions, no expanding needed */}
                    <a
                      href={directionsUrl(s)}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Directions to ${s.name}`}
                      className="flex h-11 w-11 shrink-0 items-center justify-center text-ink"
                    >
                      <ArrowIcon />
                    </a>
                  </div>
                  {on && (
                    <div className="mt-1 flex gap-2">
                      <a
                        href={directionsUrl(s)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-h-14 flex-1 items-center justify-center rounded-[14px] bg-soil px-3 text-[17px] font-semibold text-eggshell"
                      >
                        Get directions
                      </a>
                      {canReceipt && (
                        <button
                          type="button"
                          onClick={() => onReceipt(s.store_id)}
                          className="min-h-14 flex-1 rounded-[14px] border-[1.5px] border-ink bg-receipt px-3 text-[17px] font-semibold text-ink"
                        >
                          See receipt
                        </button>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      </motion.section>
    </div>
  )
}
