import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { storeColor } from '../lib/stores.js'
import Sticker from './Sticker.jsx'

// Torn-paper collage of the Madison isthmus. Approximate shapes, not map tiles:
// the hand-made look matters more than exact streets.
const W = 390
const CENTER = { lat: 43.0722, lon: -89.405 }
const PX_PER_LON = W / 0.07
const PX_PER_LAT = PX_PER_LON / Math.cos((CENTER.lat * Math.PI) / 180)

// Lake Mendota (north), Monona (south-east), Wingra (south-west). Drawn well past the edges
// so a tall, full-screen map is still covered.
const MENDOTA = [
  [43.16, -89.47], [43.0885, -89.47], [43.0885, -89.45], [43.0855, -89.432], [43.0838, -89.424], [43.0868, -89.418],
  [43.0895, -89.414], [43.0865, -89.411], [43.0805, -89.407], [43.0778, -89.4], [43.0782, -89.392],
  [43.0803, -89.384], [43.0832, -89.376], [43.0868, -89.366], [43.092, -89.35], [43.16, -89.34],
]
const MONONA = [
  [42.98, -89.405], [43.04, -89.4], [43.0555, -89.396], [43.0615, -89.391], [43.0662, -89.385], [43.0695, -89.379],
  [43.0738, -89.371], [43.0765, -89.36], [43.079, -89.34], [42.98, -89.34],
]
const WINGRA = [
  [43.0592, -89.4255], [43.0605, -89.418], [43.0595, -89.41], [43.0572, -89.406], [43.0558, -89.414],
  [43.0565, -89.4235],
]
const ARBORETUM = [
  [43.0625, -89.47], [43.0628, -89.43], [43.0618, -89.405], [43.045, -89.4], [43.04, -89.47],
]
const PARKS = [
  [[43.0758, -89.3852], [43.0758, -89.3828], [43.0738, -89.3826], [43.0738, -89.385]], // Capitol Square
  [[43.0868, -89.4205], [43.0892, -89.4152], [43.0876, -89.414], [43.0852, -89.4195]], // Picnic Point
  [[43.0638, -89.4055], [43.0638, -89.398], [43.0612, -89.398], [43.0612, -89.4055]], // Vilas Park
  [[43.0795, -89.4205], [43.0812, -89.4135], [43.0785, -89.4128], [43.0772, -89.419]], // Lakeshore path
]
const STREETS = [
  [[43.0746, -89.3845], [43.0748, -89.399]], // State St
  [[43.0729, -89.401], [43.0733, -89.413], [43.0745, -89.43], [43.0752, -89.47]], // University Ave
  [[43.0755, -89.3828], [43.081, -89.374], [43.0865, -89.362], [43.095, -89.345]], // East Washington
  [[43.0682, -89.4078], [43.0638, -89.418], [43.0582, -89.432], [43.052, -89.445]], // Monroe St
  [[43.03, -89.4007], [43.0752, -89.4004]], // Park St
  [[43.0672, -89.4], [43.0675, -89.47]], // Regent St
  [[43.0736, -89.3835], [43.0672, -89.3775], [43.0628, -89.371]], // Williamson St
  [[43.0715, -89.4], [43.0705, -89.385]], // Johnson St
]
// Each label has a few nearby spots; the first one clear of pins and edges is used.
export const LABELS = [
  { text: 'Lake Mendota', spots: [[43.0905, -89.401], [43.0925, -89.41]], tilt: -2 },
  { text: 'Lake Monona', spots: [[43.0585, -89.3835], [43.0615, -89.377]], tilt: 2 },
  { text: 'State St', spots: [[43.0762, -89.3935], [43.0732, -89.3955], [43.0775, -89.398]], tilt: -1, street: true },
  { text: 'University Ave', spots: [[43.0768, -89.4325], [43.0758, -89.4225], [43.0778, -89.417]], tilt: 2, street: true },
  { text: 'Capitol', spots: [[43.0712, -89.3795], [43.0792, -89.3842], [43.0688, -89.3862], [43.0805, -89.378]], tilt: 3 },
  { text: 'UW campus', spots: [[43.0768, -89.4095], [43.0785, -89.405]], tilt: -3 },
]
const PIN_CLEAR = 28

// Approximate scrap box (Karla 600 at 11-12px plus padding).
const scrapBox = (text, x, y, size) => {
  const w = text.length * size * 0.55 + 14
  const h = size + 8
  return { x0: x - w / 2, x1: x + w / 2, y0: y - h / 2, y1: y + h / 2 }
}
const distToBox = (px, py, b) => Math.hypot(Math.max(b.x0 - px, 0, px - b.x1), Math.max(b.y0 - py, 0, py - b.y1))
// Never under a pin (within 28px) and never cut off at the edge.
const labelFits = (b, pins, H) =>
  b.x0 >= 2 && b.x1 <= W - 2 && b.y0 >= 2 && b.y1 <= H - 2 && pins.every((p) => distToBox(p.x, p.y, b) >= PIN_CLEAR)
const PIN_PX = { sm: 30, md: 34, lg: 40 }

// Keep pins from stacking on top of each other.
function spread(points, H, min = 32) {
  const p = points.map((q) => ({ ...q }))
  for (let iter = 0; iter < 40; iter++) {
    for (let i = 0; i < p.length; i++) {
      for (let j = i + 1; j < p.length; j++) {
        const dx = p[j].x - p[i].x
        const dy = p[j].y - p[i].y
        const d = Math.hypot(dx, dy) || 0.01
        if (d < min) {
          const push = (min - d) / 2
          const ux = d > 0.01 ? dx / d : 1
          const uy = d > 0.01 ? dy / d : 0
          p[i].x -= ux * push
          p[i].y -= uy * push
          p[j].x += ux * push
          p[j].y += uy * push
        }
      }
    }
  }
  return p.map((q) => ({ ...q, x: Math.min(W - 20, Math.max(20, q.x)), y: Math.min(H - 24, Math.max(20, q.y)) }))
}

/** Label on a small eggshell paper scrap: rough edge on the scrap only, text stays crisp. */
function Scrap({ x, y, H, tilt, size = 12, children }) {
  return (
    <span
      className="pointer-events-none absolute whitespace-nowrap px-[7px] py-[3px]"
      style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, transform: `translate(-50%, -50%) rotate(${tilt}deg)` }}
    >
      <span aria-hidden="true" className="absolute inset-0 rounded-[2px] bg-eggshell" style={{ filter: 'url(#sift-sticker-edge)' }} />
      <span className="relative font-semibold text-ink" style={{ fontSize: size }}>
        {children}
      </span>
    </span>
  )
}

/**
 * stores: ranked_stores (pins numbered by rank). sizes: { [store_id]: 'sm' | 'md' | 'lg' }.
 * height: map height in px at 390 wide. focusY: where the map center sits vertically.
 */
export default function PaperMap({ stores, user, sizes = {}, selectedId, onSelect, height = 270, focusY, full = false, pan = false, className = '' }) {
  const H = height
  const cy = focusY ?? H / 2
  const project = useMemo(
    () => (lat, lon) => [W / 2 + (lon - CENTER.lon) * PX_PER_LON, cy - (lat - CENTER.lat) * PX_PER_LAT],
    [cy],
  )
  const path = (pts, close = true) =>
    pts.map(([lat, lon], i) => `${i ? 'L' : 'M'}${project(lat, lon).map((v) => v.toFixed(1)).join(',')}`).join(' ') + (close ? ' Z' : '')

  const pins = useMemo(() => {
    const raw = stores.map((s, i) => {
      const [x, y] = project(s.lat, s.lon)
      return { id: s.store_id, name: s.name, n: i + 1, color: storeColor(s.store_id), x, y }
    })
    return spread(raw, H)
  }, [stores, project, H])
  const [ux, uy] = project(user.lat, user.lon)

  // Labels: street names only at full size (11px); hide any that would sit under a pin or get cut.
  const labels = LABELS.filter((l) => full || !l.street).flatMap((l) => {
    const size = l.street ? 11 : 12
    for (const [lat, lon] of l.spots) {
      const [x, y] = project(lat, lon)
      if (labelFits(scrapBox(l.text, x, y, size), pins, H)) return [{ ...l, x, y, size }]
    }
    return []
  })
  // "You" goes on the side of the dot away from the nearest pin.
  const nearest = pins.reduce((a, p) => (!a || Math.hypot(p.x - ux, p.y - uy) < Math.hypot(a.x - ux, a.y - uy) ? p : a), null)
  const youSpots = [
    [ux + 26, uy - 14], [ux - 26, uy - 14], [ux + 26, uy + 14], [ux - 26, uy + 14], [ux, uy - 24], [ux, uy + 24],
  ].sort((a, b) => (nearest ? Math.hypot(b[0] - nearest.x, b[1] - nearest.y) - Math.hypot(a[0] - nearest.x, a[1] - nearest.y) : 0))
  const you = youSpots.find(([x, y]) => labelFits(scrapBox('You', x, y, 12), pins, H)) ?? youSpots[0]

  // Pan: slide the whole collage so the selected pin sits at the map's focus point (kept gentle).
  const sel = pan && pins.find((p) => p.id === selectedId)
  const clamp = (v, m) => Math.max(-m, Math.min(m, v))
  const dx = sel ? clamp(W / 2 - sel.x, W * 0.35) : 0
  const dy = sel ? clamp(cy - sel.y, H * 0.25) : 0

  return (
    <div className={`relative w-full overflow-hidden bg-eggshell ${className}`} style={{ aspectRatio: `${W} / ${H}` }} role="img" aria-label={`Map of ${stores.length} stores near you`}>
      <motion.div
        className="absolute inset-0"
        initial={false}
        animate={{ x: `${(dx / W) * 100}%`, y: `${(dy / H) * 100}%` }}
        transition={{ type: 'spring', damping: 30, stiffness: 200 }}
      >
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 block h-full w-full" style={{ overflow: 'visible' }} aria-hidden="true">
        <rect x={-W} y={-H} width={W * 3} height={H * 3} fill="var(--eggshell)" />
        <g filter="url(#rough-map)" style={{ mixBlendMode: 'multiply' }}>
          <path d={path(ARBORETUM)} fill="var(--pea)" opacity="0.28" stroke="var(--receipt)" strokeWidth="3" />
          {PARKS.map((p, i) => (
            <path key={i} d={path(p)} fill="var(--pea)" opacity="0.32" stroke="var(--receipt)" strokeWidth="2.5" />
          ))}
          <path d={path(MENDOTA)} fill="var(--sardine)" opacity="0.4" stroke="var(--receipt)" strokeWidth="4" />
          <path d={path(MONONA)} fill="var(--sardine)" opacity="0.4" stroke="var(--receipt)" strokeWidth="4" />
          <path d={path(WINGRA)} fill="var(--sardine)" opacity="0.4" stroke="var(--receipt)" strokeWidth="3" />
        </g>
        <g filter="url(#rough-map)">
          {STREETS.map((s, i) => (
            <g key={i}>
              <path d={path(s, false)} fill="none" stroke="var(--line)" strokeWidth="9" strokeLinecap="round" />
              <path d={path(s, false)} fill="none" stroke="var(--receipt)" strokeWidth="6" strokeLinecap="round" />
            </g>
          ))}
        </g>
        {/* user: ink dot with an eggshell ring */}
        <circle cx={ux} cy={uy} r="10.5" fill="var(--ink)" />
        <circle cx={ux} cy={uy} r="8" fill="var(--eggshell)" />
        <circle cx={ux} cy={uy} r="5.5" fill="var(--ink)" />
      </svg>

      {labels.map((l) => (
        <Scrap key={l.text} x={l.x} y={l.y} H={H} tilt={l.tilt} size={l.size}>
          {l.text}
        </Scrap>
      ))}
      <Scrap x={you[0]} y={you[1]} H={H} tilt={-3}>
        You
      </Scrap>

      {/* Numbered store stickers (number = rank, so color is never the only signal) */}
      {pins.map((p) => {
        const size = sizes[p.id] ?? 'sm'
        const px = PIN_PX[size]
        const on = p.id === selectedId
        const sticker = (
          <Sticker shape="round" size={size === 'lg' ? 'md' : size} color={p.color} tilt={p.n % 2 ? -6 : 5} style={{ width: px, height: px }}>
            {p.n}
          </Sticker>
        )
        const pos = { left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%`, transform: `translate(-50%, -50%) scale(${on ? 1.2 : 1})`, zIndex: on ? 3 : 2 }
        return onSelect ? (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            aria-label={`${p.n}. ${p.name}`}
            aria-pressed={on}
            className="absolute flex h-11 w-11 items-center justify-center transition-transform"
            style={pos}
          >
            {sticker}
          </button>
        ) : (
          <span key={p.id} className="absolute" style={pos}>
            {sticker}
          </span>
        )
      })}
      </motion.div>
    </div>
  )
}
