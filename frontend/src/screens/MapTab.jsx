import { useLayoutEffect, useRef, useState } from 'react'
import { motion, useAnimation } from 'framer-motion'
import { DemoBadge } from '../components/brand.jsx'
import PaperMap from '../components/PaperMap.jsx'
import Sticker from '../components/Sticker.jsx'
import { directionsUrl, storeColor, walkMinutes } from '../lib/stores.js'

const SHEET_MAX = 520
const SHEET_MIN = 280
const DRAG = SHEET_MAX - SHEET_MIN

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.8l9.2 9.2-9.2 9.2L2.8 12z" />
      <path d="M9 14.5v-2.2a1.5 1.5 0 0 1 1.5-1.5h4M12.8 8.6l2.2 2.2-2.2 2.2" />
    </svg>
  )
}

/**
 * "Stores near you": nothing to do with the bag. Full-screen paper map with same-size numbered
 * pins, and an eggshell sheet (280px, drag to 520px) listing stores by distance with directions.
 * Tapping a pin or a row highlights it, pans the map, and shows one "Get directions" button.
 */
export default function MapTab({ stores, user, demo }) {
  const [selected, setSelected] = useState(null)
  const controls = useAnimation()
  const [expanded, setExpanded] = useState(false)
  const listRef = useRef(null)
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
  const sizes = Object.fromEntries(stores.map((s) => [s.store_id, 'md']))

  const snap = (open) => {
    setExpanded(open)
    controls.start({ y: open ? 0 : DRAG, transition: { type: 'spring', damping: 30, stiffness: 300 } })
  }
  // From a pin: select it and bring its row into view.
  const pick = (id) => {
    setSelected(id)
    requestAnimationFrame(() => listRef.current?.querySelector(`[data-store="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
  }

  return (
    <div ref={box} className="relative h-full overflow-hidden">
      {/* stores sit in the open area above the sheet */}
      <PaperMap stores={stores} user={user} sizes={sizes} selectedId={selected} onSelect={pick} height={mapH} focusY={(mapH - SHEET_MIN) / 2 + 28} full pan className="absolute inset-0" />
      {demo && (
        <div className="pointer-events-none absolute inset-x-0 top-14 z-10 flex justify-end px-5">
          <span className="pointer-events-auto">
            <DemoBadge />
          </span>
        </div>
      )}

      <motion.section
        aria-label="Stores list"
        className="grain absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[20px] border-t-[1.5px] border-line bg-eggshell px-5"
        style={{ height: SHEET_MAX }}
        initial={{ y: DRAG }}
        animate={controls}
        drag="y"
        dragConstraints={{ top: 0, bottom: DRAG }}
        dragElastic={0.05}
        onDragEnd={(_, info) => snap(info.offset.y < -40 || (expanded && info.offset.y < 40))}
      >
        <button
          type="button"
          onClick={() => snap(!expanded)}
          aria-label={expanded ? 'Show less' : 'Show more'}
          className="mx-auto flex h-5 w-16 shrink-0 items-start justify-center"
        >
          <span className="mt-2 h-1 w-9 rounded-full bg-muted/50" />
        </button>
        <div className="flex shrink-0 items-baseline gap-2 pt-1">
          <h1 className="font-display text-[24px] leading-tight text-ink">Stores near you</h1>
          {stores.length > 0 && <span className="text-[13px] text-muted">{stores.length} nearby</span>}
        </div>
        <ul ref={listRef} className="no-scrollbar -mx-5 mt-2 min-h-0 flex-1 overflow-y-auto px-5 pb-6" onPointerDownCapture={(e) => expanded && e.stopPropagation()}>
          {stores.map((s, i) => {
            const on = s.store_id === selected
            return (
              <li
                key={s.store_id}
                data-store={s.store_id}
                className={`border-b-[1.5px] border-dashed border-line transition-colors ${on ? '-mx-3 rounded-[4px] border-transparent bg-receipt px-3 pb-3' : ''}`}
              >
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setSelected(s.store_id)} aria-pressed={on} className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 py-1 text-left">
                    <Sticker shape="round" size="md" color={storeColor(s.store_id)} tilt={(i + 1) % 2 ? -6 : 5}>
                      {i + 1}
                    </Sticker>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16px] font-bold leading-tight text-ink">{s.name}</span>
                      <span className="block text-[13px] text-muted">
                        {s.distance_miles.toFixed(1)} mi · {walkMinutes(s.distance_miles)} min walk
                      </span>
                    </span>
                  </button>
                  <a
                    href={directionsUrl(s)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Directions to ${s.name}`}
                    className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center text-ink"
                  >
                    <ArrowIcon />
                  </a>
                </div>
                {on && (
                  <a
                    href={directionsUrl(s)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 flex min-h-14 w-full items-center justify-center rounded-[14px] bg-soil px-3 text-[17px] font-semibold text-eggshell"
                  >
                    Get directions
                  </a>
                )}
              </li>
            )
          })}
        </ul>
      </motion.section>
    </div>
  )
}
