import { useMemo } from 'react'
import { storeColor } from '../lib/stores.js'
import Sticker from './Sticker.jsx'

// Torn-paper collage of the Madison isthmus. Approximate shapes, not map tiles:
// the hand-made look matters more than exact streets.
const W = 390
const H = 270
const CENTER = { lat: 43.0722, lon: -89.405 }
const PX_PER_LON = W / 0.07
const PX_PER_LAT = PX_PER_LON / Math.cos((CENTER.lat * Math.PI) / 180)

function project(lat, lon) {
  return [W / 2 + (lon - CENTER.lon) * PX_PER_LON, H / 2 - (lat - CENTER.lat) * PX_PER_LAT]
}
const path = (pts, close = true) =>
  pts.map(([lat, lon], i) => `${i ? 'L' : 'M'}${project(lat, lon).map((v) => v.toFixed(1)).join(',')}`).join(' ') +
  (close ? ' Z' : '')

// Lake Mendota (north), Monona (south-east), Wingra (south-west).
const MENDOTA = [
  [43.1, -89.45], [43.0885, -89.45], [43.0855, -89.432], [43.0838, -89.424], [43.0868, -89.418],
  [43.0895, -89.414], [43.0865, -89.411], [43.0805, -89.407], [43.0778, -89.4], [43.0782, -89.392],
  [43.0803, -89.384], [43.0832, -89.376], [43.0868, -89.366], [43.1, -89.36],
]
const MONONA = [
  [43.04, -89.4], [43.0555, -89.396], [43.0615, -89.391], [43.0662, -89.385], [43.0695, -89.379],
  [43.0738, -89.371], [43.0765, -89.36], [43.04, -89.36],
]
const WINGRA = [
  [43.0592, -89.4255], [43.0605, -89.418], [43.0595, -89.41], [43.0572, -89.406], [43.0558, -89.414],
  [43.0565, -89.4235],
]
const ARBORETUM = [
  [43.0625, -89.45], [43.0628, -89.43], [43.0618, -89.405], [43.05, -89.4], [43.05, -89.45],
]
const PARKS = [
  [[43.0758, -89.3852], [43.0758, -89.3828], [43.0738, -89.3826], [43.0738, -89.385]], // Capitol Square
  [[43.0868, -89.4205], [43.0892, -89.4152], [43.0876, -89.414], [43.0852, -89.4195]], // Picnic Point
  [[43.0638, -89.4055], [43.0638, -89.398], [43.0612, -89.398], [43.0612, -89.4055]], // Vilas Park
]
const STREETS = [
  [[43.0746, -89.3845], [43.0748, -89.399]], // State St
  [[43.0729, -89.401], [43.0733, -89.413], [43.0745, -89.43], [43.0752, -89.45]], // University Ave
  [[43.0755, -89.3828], [43.081, -89.374], [43.0865, -89.362]], // East Washington
  [[43.0682, -89.4078], [43.0638, -89.418], [43.0582, -89.432]], // Monroe St
  [[43.055, -89.4007], [43.0752, -89.4004]], // Park St
  [[43.0672, -89.4], [43.0675, -89.43]], // Regent St
  [[43.0736, -89.3835], [43.0672, -89.3775], [43.0628, -89.371]], // Williamson St
]

// Keep pins from stacking on top of each other.
function spread(points, min = 30) {
  const p = points.map((q) => ({ ...q }))
  for (let iter = 0; iter < 30; iter++) {
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
  return p.map((q) => ({ ...q, x: Math.min(W - 18, Math.max(18, q.x)), y: Math.min(H - 24, Math.max(18, q.y)) }))
}

export default function PaperMap({ ranked, user }) {
  const pins = useMemo(() => {
    const raw = ranked.map((s, i) => {
      const [x, y] = project(s.lat, s.lon)
      return { id: s.store_id, n: i + 1, color: storeColor(s.store_id), x, y }
    })
    return spread(raw)
  }, [ranked])
  const [ux, uy] = project(user.lat, user.lon)

  return (
    <div className="relative" role="img" aria-label={`Map of ${ranked.length} stores near you, numbered by rank`}>
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" aria-hidden="true">
      <rect width={W} height={H} fill="var(--eggshell)" />
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

      {/* User dot */}
      <circle cx={ux} cy={uy} r="11" fill="var(--receipt)" stroke="var(--ink)" strokeWidth="1.5" strokeDasharray="3 2.5" />
      <circle cx={ux} cy={uy} r="5.5" fill="var(--ink)" />

    </svg>

      {/* Numbered store stickers (number = rank, so color is never the only signal) */}
      {pins.map((p) => (
        <span
          key={p.id}
          className="absolute"
          style={{ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%`, transform: 'translate(-50%, -50%)' }}
        >
          <Sticker shape="round" size="sm" color={p.color} tilt={p.n % 2 ? -6 : 5}>
            {p.n}
          </Sticker>
        </span>
      ))}
    </div>
  )
}
