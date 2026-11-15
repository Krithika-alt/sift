import { useRef, useState } from 'react'
import { motion, useAnimation } from 'framer-motion'
import { DemoBadge, wash } from '../components/brand.jsx'
import LeafletMap from '../components/LeafletMap.jsx'
import RadiusPills from '../components/RadiusPills.jsx'
import Sticker from '../components/Sticker.jsx'
import { directionsUrl, storeColor, walkMinutes } from '../lib/stores.js'

const SHEET_MAX = 520
const SHEET_MIN = 280
const DRAG = SHEET_MAX - SHEET_MIN

/** Simple ink arrow (no road-sign diamond). */
export function ArrowIcon({ size = 22 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  )
}

/**
 * "Stores near you": nothing to do with the bag. A real map you can drag and zoom, same-size
 * numbered pins, and an eggshell sheet (280px, drag to 520px) listing stores by distance.
 * Tapping a pin or row tints the row in the store's color, pans the map, and shows a compact
 * "Get directions" pill under the name. The radius pills at the top of the sheet set the circle.
 */
export default function MapTab({ stores, user, demo, radius, onRadius }) {
  const [selected, setSelected] = useState(null)
  const controls = useAnimation()
  const [expanded, setExpanded] = useState(false)
  const listRef = useRef(null)
  const mapRef = useRef(null)

  const snap = (open) => {
    setExpanded(open)
    controls.start({ y: open ? 0 : DRAG, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } })
  }
  // From a pin: select it and bring its row into view.
  const pick = (id) => {
    setSelected(id)
    requestAnimationFrame(() => listRef.current?.querySelector(`[data-store="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
  }

  return (
    <div className="relative h-full overflow-hidden">
      <LeafletMap ref={mapRef} stores={stores} user={user} radius={radius} selectedId={selected} onSelect={pick} full wheelZoom padBottom={SHEET_MIN} fallbackHeight={760} className="absolute inset-0" />

      {/* top area: title left (the zoom and recenter stack sits at the right edge, above the sheet) */}
      <div className="pointer-events-none absolute inset-x-0 top-14 z-10 flex items-center justify-between px-5">
        <h1 data-map-avoid className="pointer-events-auto relative -ml-2 px-2 font-display text-[28px] leading-[44px] text-ink">
          <span aria-hidden="true" className="absolute inset-x-0 inset-y-1 -z-10 rounded-[2px] bg-eggshell" style={{ filter: 'url(#sift-sticker-edge)' }} />
          Stores near you
        </h1>
        {demo && (
          <span data-map-avoid className="pointer-events-auto">
            <DemoBadge />
          </span>
        )}
      </div>

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
        <RadiusPills value={radius} onChange={onRadius} className="shrink-0" />
        <p className="shrink-0 pt-1 text-[14px] font-semibold text-muted">
          {stores.length ? `${stores.length} within ${radius} mi · closest first` : `No stores within ${radius} mi. Try a bigger circle.`}
        </p>
        <ul ref={listRef} className="no-scrollbar -mx-5 mt-2 min-h-0 flex-1 overflow-y-auto px-5 pb-6" onPointerDownCapture={(e) => expanded && e.stopPropagation()}>
          {stores.map((s, i) => {
            const on = s.store_id === selected
            return (
              <motion.li
                key={s.store_id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1], delay: i * 0.04 }}
                data-store={s.store_id}
                className={`-mx-2 rounded-[4px] px-2 transition-colors ${on ? 'pb-3' : ''}`}
                style={{ background: on ? wash(storeColor(s.store_id), 14, 'var(--eggshell)') : undefined, borderBottom: on ? '1px solid transparent' : '1px solid #E6DCCB' }}
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
                    className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center text-ink"
                  >
                    <ArrowIcon />
                  </a>
                </div>
                {on && (
                  // aligned to the text column (sticker 34 + gap 12)
                  <a
                    href={directionsUrl(s)}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-[46px] inline-flex h-10 items-center rounded-full bg-soil px-[18px] text-[15px] font-semibold text-eggshell active:scale-[0.98]"
                  >
                    Get directions
                  </a>
                )}
              </motion.li>
            )
          })}
        </ul>
      </motion.section>
    </div>
  )
}
