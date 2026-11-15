import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { storeColor } from '../lib/stores.js'
import PaperMap, { LABELS } from './PaperMap.jsx'
import Sticker from './Sticker.jsx'

// Light, label-free basemap (no API key), recolored to paper in CSS (.paper-tiles in index.css).
// CARTO's basemaps now return "API KEY REQUIRED" tiles, so this uses Esri's Light Gray Base.
const TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'
const ATTRIBUTION = 'Tiles &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors'
const PIN_CLEAR = 28
const FAIL_LIMIT = 4

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

const divIcon = (cls = '') => L.divIcon({ className: `sift-marker ${cls}`, html: '', iconSize: null })

/**
 * A real, movable map: drag to pan, pinch or double-tap to zoom (wheel zoom off so the page
 * scrolls). Store pins are numbered Stickers; place labels sit on paper scraps and hide whenever
 * they would cross the map edge or sit within 28px of a pin. Falls back to the SVG paper map
 * if the tiles can't load.
 *
 * ref: { recenter() }   padBottom: px hidden under a sheet (keeps pins in the open area)
 */
const LeafletMap = forwardRef(function LeafletMap(
  { stores, user, selectedId, onSelect, height = 300, full = false, padBottom = 0, className = '', fallbackHeight },
  ref,
) {
  const box = useRef(null)
  const map = useRef(null)
  const [els, setEls] = useState({ pins: [], labels: [], you: null })
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false)

  const fit = (animate = false) => {
    const m = map.current
    if (!m) return
    const pts = [[user.lat, user.lon], ...stores.map((s) => [s.lat, s.lon])]
    m.fitBounds(L.latLngBounds(pts), { paddingTopLeft: [36, 64], paddingBottomRight: [36, 36 + padBottom], maxZoom: 15, animate })
  }
  useImperativeHandle(ref, () => ({ recenter: () => fit(true) }))

  // Create the map once.
  useEffect(() => {
    if (offline || !box.current) return
    const m = L.map(box.current, {
      zoomControl: false,
      attributionControl: true,
      dragging: true,
      scrollWheelZoom: false,
      touchZoom: true,
      doubleClickZoom: true,
      tap: true,
      zoomSnap: 1, // whole zoom levels: no hairline seams between blended tiles
    })
    map.current = m
    m.attributionControl.setPrefix(false)
    let ok = 0
    let failed = 0
    L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 18, className: 'paper-tiles' })
      .on('tileload', () => ok++)
      .on('tileerror', () => {
        failed++
        if (!ok && failed >= FAIL_LIMIT) setOffline(true)
      })
      .addTo(m)
    m.setView([user.lat, user.lon], 14)
    return () => {
      m.remove()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offline])

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
    fit(false)
    return () => {
      layer.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stores, user.lat, user.lon, full, offline])

  // Hide labels that would cross the map edge or sit under a pin.
  useEffect(() => {
    const m = map.current
    if (!m || !els.labels.length) return
    const check = () => {
      const frame = box.current.getBoundingClientRect()
      const bottom = frame.bottom - padBottom
      const pinPts = els.pins.map((p) => p.el.getBoundingClientRect()).map((r) => [r.left + r.width / 2, r.top + r.height / 2])
      // things drawn over the map (title, buttons) that labels must not sit under
      const avoid = [...document.querySelectorAll('[data-map-avoid]')].map((e) => e.getBoundingClientRect())
      const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
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
    m.on('move zoom resize', check)
    return () => {
      clearTimeout(t)
      m.off('move zoom resize', check)
    }
  }, [els, padBottom])

  // Selecting a store pans to it (inside the open area above any sheet).
  useEffect(() => {
    const m = map.current
    const s = stores.find((x) => x.store_id === selectedId)
    if (!m || !s) return
    const pt = m.project([s.lat, s.lon], m.getZoom()).add([0, padBottom / 2])
    m.panTo(m.unproject(pt, m.getZoom()), { animate: true, duration: 0.4 })
  }, [selectedId, stores, padBottom])

  if (offline) {
    return <PaperMap stores={stores} user={user} sizes={Object.fromEntries(stores.map((s) => [s.store_id, 'md']))} selectedId={selectedId} onSelect={onSelect} height={fallbackHeight ?? height} full={full} className={className} />
  }

  return (
    <div className={`isolate overflow-hidden bg-eggshell ${className.includes('absolute') ? '' : 'relative'} ${className}`} style={className.includes('absolute') ? undefined : { height }}>
      <div ref={box} className="paper-map h-full w-full" role="region" aria-label={`Map of ${stores.length} stores near you`} />
      <span aria-hidden="true" className="paper-grain grain" />
      {els.pins.map((p) =>
        createPortal(
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onSelect?.(p.id)
            }}
            aria-label={`${p.n}. ${p.name}`}
            aria-pressed={p.id === selectedId}
            className="flex h-11 w-11 items-center justify-center transition-transform"
            style={{ transform: `translate(-50%, -50%) scale(${p.id === selectedId ? 1.2 : 1})` }}
          >
            <Sticker shape="round" size="md" color={p.color} tilt={p.n % 2 ? -6 : 5}>
              {p.n}
            </Sticker>
          </button>,
          p.el,
          p.id,
        ),
      )}
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
            <span className="absolute left-4 top-[-26px] w-max">
              <Scrap tilt={-3}>You</Scrap>
            </span>
          </span>,
          els.you,
        )}
    </div>
  )
})

export default LeafletMap
