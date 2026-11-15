import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { storeColor } from '../lib/stores.js'
import PaperMap, { LABELS } from './PaperMap.jsx'
import Sticker from './Sticker.jsx'
import { MAP_STYLE, TILE_ATTRIBUTION } from './mapStyle.js'

const PIN_CLEAR = 28
const FAIL_LIMIT = 4
const LOAD_TIMEOUT_MS = 9000
const MIN_ZOOM = 10 // the 10 mi circle needs room
const MAX_ZOOM = 17
const MI_TO_M = 1609.34
const CIRCLE_MS = 300
const PEA = '#9DBE5A'
const PIN_GAP = 36 // a pin sticker is 34px: centers closer than this would overlap
const TICK_MIN = 10 // a pin moved more than this keeps a thin ink tick to its true spot

/**
 * Spiderfy-lite: push pins that would overlap apart along the line between them, a few passes.
 * pts: [{ id, x, y }] in layer pixels -> { id: [dx, dy] }
 */
function separate(pts) {
  const off = Object.fromEntries(pts.map((p) => [p.id, [0, 0]]))
  for (let pass = 0; pass < 24; pass++) {
    let moved = false
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = off[pts[i].id]
        const b = off[pts[j].id]
        let dx = pts[j].x + b[0] - (pts[i].x + a[0])
        let dy = pts[j].y + b[1] - (pts[i].y + a[1])
        let d = Math.hypot(dx, dy)
        if (d >= PIN_GAP) continue
        if (d < 0.01) {
          // same spot: fan out by index
          const ang = (j * 2.4) % (2 * Math.PI)
          dx = Math.cos(ang)
          dy = Math.sin(ang)
          d = 1
        }
        const push = (PIN_GAP - d) / 2 + 0.5
        a[0] -= (dx / d) * push
        a[1] -= (dy / d) * push
        b[0] += (dx / d) * push
        b[1] += (dy / d) * push
        moved = true
      }
    }
    if (!moved) break
  }
  return off
}

/** Label on a small eggshell paper scrap: rough edge on the scrap only, text stays crisp. */
function Scrap({ size = 12, tilt = 0, children }) {
  return (
    <span className="relative block whitespace-nowrap px-[7px] py-[3px]" style={{ transform: `rotate(${tilt}deg)` }}>
      <span aria-hidden="true" className="absolute inset-0 rounded-[2px] bg-eggshell" style={{ filter: 'url(#sift-sticker-edge)' }} />
      <span className="relative font-semibold text-ink" style={{ fontSize: size }}>
        {children}
      </span>
    </span>
  )
}

function TargetIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="6.5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
    </svg>
  )
}

// + and - : 40px, eggshell, 1.5px line border, Karla 600 18.
function ZoomButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-line bg-eggshell text-[18px] font-semibold leading-none text-ink"
    >
      {children}
    </button>
  )
}

const divIcon = (cls = '') => L.divIcon({ className: `sift-marker ${cls}`, html: '', iconSize: null })

// The circle's bounds, from its center and radius in miles.
function circleBounds(lat, lon, mi) {
  const dLat = mi / 69.0
  const dLon = mi / (69.0 * Math.cos((lat * Math.PI) / 180))
  return L.latLngBounds([lat - dLat, lon - dLon], [lat + dLat, lon + dLon])
}

/**
 * A real, movable map: drag to pan, pinch, double-tap or box to zoom (10 to 17), the wheel only
 * where `wheelZoom` is on. Free vector tiles (OpenFreeMap) drawn by MapLibre in our paper colors:
 * blue water, green parks, cream streets, no labels. The search radius is a soft pea circle around
 * the user; changing it animates the circle (300 ms) and fits the map to it. Store pins are numbered
 * Stickers; place labels sit on paper scraps and hide when they'd cross the edge, a pin or the
 * controls. Falls back to the SVG paper map if the tiles can't load.
 *
 * ref: { recenter() }   padTop / padBottom: px covered by the header / a sheet
 */
const LeafletMap = forwardRef(function LeafletMap(
  { stores, user, radius = 2, selectedId, onSelect, height = 300, full = false, wheelZoom = false, padTop = 108, padBottom = 0, className = '', fallbackHeight },
  ref,
) {
  const box = useRef(null)
  const map = useRef(null)
  const circle = useRef(null)
  const shownRadius = useRef(radius)
  const [els, setEls] = useState({ pins: [], labels: [], you: null })
  const [nudge, setNudge] = useState({}) // pin id -> [dx, dy] px, so pins never overlap
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false)

  const fitRadius = (animate = false, r = radius) => {
    const m = map.current
    if (!m) return
    const opts = { paddingTopLeft: [24, padTop], paddingBottomRight: [24, 24 + padBottom], maxZoom: MAX_ZOOM }
    const b = circleBounds(user.lat, user.lon, r)
    if (animate) m.flyToBounds(b, { ...opts, duration: CIRCLE_MS / 1000, easeLinearity: 0.5 })
    else m.fitBounds(b, { ...opts, animate: false })
  }
  useImperativeHandle(ref, () => ({ recenter: () => fitRadius(true) }))

  // Create the map once; the vector basemap loads on demand (keeps it out of the first bundle).
  useEffect(() => {
    if (offline || !box.current) return
    const m = L.map(box.current, {
      zoomControl: false,
      attributionControl: true,
      dragging: true,
      scrollWheelZoom: wheelZoom,
      touchZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      tap: true,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      zoomSnap: 0.25,
      zoomDelta: 1,
    })
    map.current = m
    m.attributionControl.setPrefix(false)
    m.setView([user.lat, user.lon], 14)

    let cancelled = false
    let ok = false
    let failed = 0
    const giveUp = setTimeout(() => !ok && !cancelled && setOffline(true), LOAD_TIMEOUT_MS)
    Promise.all([import('maplibre-gl'), import('@maplibre/maplibre-gl-leaflet'), import('maplibre-gl/dist/maplibre-gl.css')])
      .then(() => {
        if (cancelled) return
        const gl = L.maplibreGL({ style: MAP_STYLE, attribution: TILE_ATTRIBUTION, interactive: false }).addTo(m)
        gl.getContainer().classList.add('paper-tiles')
        const glMap = gl.getMaplibreMap()
        glMap.on('load', () => {
          ok = true
        })
        glMap.on('error', () => {
          failed++
          if (!ok && failed >= FAIL_LIMIT && !cancelled) setOffline(true)
        })
      })
      .catch(() => !cancelled && setOffline(true)) // no WebGL, or the chunk failed to load
    return () => {
      cancelled = true
      clearTimeout(giveUp)
      m.remove()
      map.current = null
      circle.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offline])

  // The radius circle: pea fill at 8%, 1.5px pea outline, under the pins.
  useEffect(() => {
    const m = map.current
    if (!m) return
    const c = L.circle([user.lat, user.lon], { radius: shownRadius.current * MI_TO_M, color: PEA, weight: 1.5, fillColor: PEA, fillOpacity: 0.08, interactive: false }).addTo(m)
    circle.current = c
    fitRadius(false, shownRadius.current)
    return () => {
      c.remove()
      circle.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offline, user.lat, user.lon])

  // Changing the radius animates the circle (300 ms) and fits the map to it.
  useEffect(() => {
    const c = circle.current
    const from = shownRadius.current
    shownRadius.current = radius
    if (!c || from === radius) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      c.setRadius(radius * MI_TO_M)
      fitRadius(false)
      return
    }
    fitRadius(true)
    let raf
    const t0 = performance.now()
    const step = (now) => {
      const k = Math.min(1, (now - t0) / CIRCLE_MS)
      const e = 1 - (1 - k) ** 3 // ease-out
      c.setRadius((from + (radius - from) * e) * MI_TO_M)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius])

  // Markers: pins, labels, and the user dot. React renders into each marker's element.
  useEffect(() => {
    const m = map.current
    if (!m) return
    const layer = L.layerGroup().addTo(m)
    const pins = stores.map((s, i) => {
      const mk = L.marker([s.lat, s.lon], { icon: divIcon('sift-pin'), keyboard: false, zIndexOffset: 1000 }).addTo(layer)
      return { id: s.store_id, n: i + 1, name: s.name, color: storeColor(s.store_id), el: mk.getElement(), mk }
    })
    const labels = LABELS.filter((l) => full || !l.street).map((l) => {
      const mk = L.marker(l.spots[0], { icon: divIcon('sift-label'), interactive: false, keyboard: false }).addTo(layer)
      return { ...l, el: mk.getElement() }
    })
    const youMk = L.marker([user.lat, user.lon], { icon: divIcon('sift-you'), interactive: false, keyboard: false, zIndexOffset: 500 }).addTo(layer)
    setEls({ pins, labels, you: youMk.getElement() })
    return () => {
      layer.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stores, user.lat, user.lon, full, offline])

  // Pins never overlap: recompute the nudges whenever the zoom changes.
  useEffect(() => {
    const m = map.current
    if (!m || !els.pins.length) return
    const update = () => {
      const pts = els.pins.map((p) => {
        const pt = m.latLngToLayerPoint(p.mk.getLatLng())
        return { id: p.id, x: pt.x, y: pt.y }
      })
      setNudge(separate(pts))
    }
    update()
    m.on('zoomend', update)
    return () => m.off('zoomend', update)
  }, [els])

  // Hide labels that would cross the map edge, sit under a pin, or under the header and controls.
  useEffect(() => {
    const m = map.current
    if (!m || (!els.labels.length && !els.you)) return
    const check = () => {
      if (!box.current) return
      const frame = box.current.getBoundingClientRect()
      const bottom = frame.bottom - padBottom
      const pinPts = els.pins.map((p) => (p.el.querySelector('button') ?? p.el).getBoundingClientRect()).map((r) => [r.left + r.width / 2, r.top + r.height / 2])
      const avoid = [...document.querySelectorAll('[data-map-avoid]')].map((e) => e.getBoundingClientRect())
      const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
      // the "You" scrap hides too when a pin sits on it
      const you = els.you?.querySelector('[data-you-scrap]')
      if (you) {
        const r = you.getBoundingClientRect()
        const clear = pinPts.every(([x, y]) => Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom)) >= 18)
        you.style.visibility = clear ? 'visible' : 'hidden'
      }
      for (const l of els.labels) {
        const inner = l.el.firstElementChild
        if (!inner) continue
        const r = inner.getBoundingClientRect()
        const inside = r.left >= frame.left + 2 && r.right <= frame.right - 2 && r.top >= frame.top + 2 && r.bottom <= bottom - 2
        const clear = pinPts.every(([x, y]) => Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom)) >= PIN_CLEAR)
        l.el.style.visibility = inside && clear && !avoid.some((a) => overlaps(a, r)) ? 'visible' : 'hidden'
      }
    }
    const t = setTimeout(check, 0)
    m.on('move zoom resize zoomend moveend', check)
    return () => {
      clearTimeout(t)
      m.off('move zoom resize zoomend moveend', check)
    }
  }, [els, padBottom, nudge])

  // Selecting a store pans to it (inside the open area above any sheet).
  useEffect(() => {
    const m = map.current
    const s = stores.find((x) => x.store_id === selectedId)
    if (!m || !s) return
    const pt = m.project([s.lat, s.lon], m.getZoom()).add([0, (padBottom - padTop + 56) / 2])
    m.panTo(m.unproject(pt, m.getZoom()), { animate: true, duration: 0.4 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  if (offline) {
    return <PaperMap stores={stores} user={user} sizes={Object.fromEntries(stores.map((s) => [s.store_id, 'md']))} selectedId={selectedId} onSelect={onSelect} height={fallbackHeight ?? height} full={full} className={className} />
  }

  const abs = className.includes('absolute')
  return (
    <div className={`isolate overflow-hidden bg-eggshell ${abs ? '' : 'relative'} ${className}`} style={abs ? undefined : { height }}>
      <div ref={box} className="paper-map h-full w-full" role="region" aria-label={`Map of ${stores.length} stores within ${radius} miles`} />
      <span aria-hidden="true" className="paper-grain page-grain" />

      {/* zoom stack at the right edge: +, -, then recenter */}
      <div data-map-avoid className="absolute right-5 z-[700] flex flex-col items-center gap-2" style={{ bottom: padBottom + 16 }}>
        <ZoomButton label="Zoom in" onClick={() => map.current?.zoomIn()}>
          +
        </ZoomButton>
        <ZoomButton label="Zoom out" onClick={() => map.current?.zoomOut()}>
          −
        </ZoomButton>
        <button
          type="button"
          onClick={() => fitRadius(true)}
          aria-label="Recenter map"
          className="mt-1 flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-ink bg-eggshell text-ink"
        >
          <TargetIcon />
        </button>
      </div>

      {els.pins.map((p) => {
        const [dx, dy] = nudge[p.id] ?? [0, 0]
        const tick = Math.hypot(dx, dy) > TICK_MIN
        return createPortal(
          <span className="relative block">
            {/* moved more than 10px: a thin ink tick back to the true spot */}
            {tick && (
              <svg aria-hidden="true" width="1" height="1" className="pointer-events-none absolute left-0 top-0 overflow-visible">
                <line x1="0" y1="0" x2={dx} y2={dy} stroke="var(--ink)" strokeWidth="1" />
                <circle cx="0" cy="0" r="2" fill="var(--ink)" />
              </svg>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onSelect?.(p.id)
              }}
              aria-label={`${p.n}. ${p.name}`}
              aria-pressed={p.id === selectedId}
              className="absolute left-0 top-0 flex h-11 w-11 items-center justify-center transition-transform"
              style={{ transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${p.id === selectedId ? 1.2 : 1})` }}
            >
              <Sticker shape="round" size="md" color={p.color} tilt={p.n % 2 ? -6 : 5}>
                {p.n}
              </Sticker>
            </button>
          </span>,
          p.el,
          p.id,
        )
      })}
      {els.labels.map((l) =>
        createPortal(
          <span className="pointer-events-none block w-max -translate-x-1/2 -translate-y-1/2">
            <Scrap size={l.street ? 11 : 12} tilt={l.tilt}>
              {l.text}
            </Scrap>
          </span>,
          l.el,
          l.text,
        ),
      )}
      {els.you &&
        createPortal(
          <span className="pointer-events-none relative block">
            <span className="absolute left-0 top-0 block h-[21px] w-[21px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-ink bg-eggshell">
              <span className="absolute inset-[3px] rounded-full bg-ink" />
            </span>
            <span data-you-scrap className="absolute left-4 top-[-26px] w-max">
              <Scrap tilt={-3}>You</Scrap>
            </span>
          </span>,
          els.you,
        )}
    </div>
  )
})

export default LeafletMap
