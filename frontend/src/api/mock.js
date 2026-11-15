// Offline stand-in for the backend, used by DEMO_MODE and as the automatic fallback.
// Mirrors backend/data_source.py (MockData), backend/matching.py and backend/scoring.py
// (section 3 scoring) so responses match the JSON contract field for field.
// Every price here is generated and labeled source: "simulated".

const STORES = [
  { store_id: 'trader_joes_monroe', name: "Trader Joe's (Monroe St)", lat: 43.0652, lon: -89.4176 },
  { store_id: 'fresh_madison_market', name: 'Fresh Madison Market', lat: 43.0738, lon: -89.4285 },
  { store_id: 'capitol_centre_market', name: 'Capitol Centre Market', lat: 43.0735, lon: -89.3838 },
  { store_id: 'target_state_st', name: 'Target (State St)', lat: 43.0752, lon: -89.3885 },
  { store_id: 'walgreens_state_st', name: 'Walgreens (State St)', lat: 43.0748, lon: -89.387 },
  { store_id: 'pick_n_save', name: "Pick 'n Save", lat: 43.07, lon: -89.419 },
]

// product_id, name, search_terms, size_value, size_unit, base price
const PRODUCTS = [
  ['eggs_large_12', 'Large eggs, 12 ct', 'eggs,egg,dozen eggs,large eggs', 12, 'ct', 3.2],
  ['greek_yogurt_32', 'Nonfat Greek yogurt, 32 oz', 'greek yogurt,greek yoghurt,yogurt', 32, 'oz', 4.8],
  ['chicken_breast_lb', 'Chicken breast, 1 lb', 'chicken breast,chicken breasts,chicken', 1, 'lb', 4.2],
  ['oats_42oz', 'Old-fashioned oats, 42 oz', 'oats,oatmeal,rolled oats', 42, 'oz', 5.2],
  ['bananas_lb', 'Bananas, 1 lb', 'bananas,banana', 1, 'lb', 0.62],
  ['milk_gal', 'Whole milk, 1 gal', 'milk,whole milk', 128, 'oz', 3.6],
  ['bread_20oz', 'Sandwich bread, 20 oz', 'bread,sandwich bread,loaf', 20, 'oz', 2.9],
  ['rice_2lb', 'White rice, 2 lb', 'rice,white rice', 2, 'lb', 2.8],
  ['peanut_butter_16', 'Peanut butter, 16 oz', 'peanut butter', 16, 'oz', 3.1],
  ['pasta_16', 'Spaghetti, 16 oz', 'pasta,spaghetti,noodles', 16, 'oz', 1.7],
  ['ramen_3oz', 'Instant ramen, 3 oz', 'ramen,instant ramen', 3, 'oz', 0.65],
  ['toilet_paper_12', 'Toilet paper, 12 rolls', 'toilet paper,tp', 12, 'ct', 11.5],
].map(([product_id, name, search_terms, size_value, size_unit, base]) => ({
  product_id, name, search_terms, size_value, size_unit, base,
}))

const STORE_LEVEL = {
  trader_joes_monroe: 0.88,
  fresh_madison_market: 1.0,
  capitol_centre_market: 1.12,
  target_state_st: 0.97,
  walgreens_state_st: 1.22,
  pick_n_save: 0.9,
}
const NOT_CARRIED = {
  walgreens_state_st: new Set(['chicken_breast_lb', 'rice_2lb']),
  capitol_centre_market: new Set(['toilet_paper_12']),
  trader_joes_monroe: new Set(['toilet_paper_12']),
}

// Deterministic PRNG so simulated prices are stable across reloads.
function mulberry32(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const byId = Object.fromEntries(PRODUCTS.map((p) => [p.product_id, p]))
const round2 = (x) => Math.round(x * 100) / 100

const BASE_PRICES = (() => {
  const rand = mulberry32(2026)
  const observed_at = new Date(Date.now() - 6 * 3600 * 1000)
  const rows = []
  for (const s of STORES) {
    for (const p of PRODUCTS) {
      if (NOT_CARRIED[s.store_id]?.has(p.product_id)) continue
      const price = round2(p.base * STORE_LEVEL[s.store_id] * (0.96 + rand() * 0.08))
      rows.push({
        store_id: s.store_id, product_id: p.product_id, price,
        unit_price: price / p.size_value, unit: p.size_unit,
        in_stock: true, source: 'simulated', observed_at,
      })
    }
  }
  return rows
})()

const pings = []
let pingCounter = 1

function latestPrices() {
  const rows = new Map(BASE_PRICES.map((r) => [`${r.store_id}|${r.product_id}`, { ...r }]))
  for (const ping of [...pings].sort((a, b) => a.reported_at - b.reported_at)) {
    const key = `${ping.store_id}|${ping.product_id}`
    const base = rows.get(key)
    if (!base || ping.reported_at >= base.observed_at) {
      const prod = byId[ping.product_id]
      rows.set(key, {
        store_id: ping.store_id, product_id: ping.product_id, price: ping.price,
        unit_price: ping.price / prod.size_value, unit: prod.size_unit,
        in_stock: ping.in_stock, source: 'crowd', observed_at: ping.reported_at,
      })
    }
  }
  return [...rows.values()]
}

// --- matching (backend/matching.py: exact term first, then fuzzy, cutoff 80) ---
const norm = (t) => t.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

function levenshtein(a, b) {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return dp[b.length]
}

function similarity(a, b) {
  if (!a || !b) return 0
  const ratio = (1 - levenshtein(a, b) / Math.max(a.length, b.length)) * 100
  const shorter = a.length < b.length ? a : b
  const longer = a.length < b.length ? b : a
  const partial = shorter.length >= 3 && longer.includes(shorter) ? 90 : 0
  return Math.max(ratio, partial)
}

function matchItems(userItems) {
  const index = new Map()
  for (const p of PRODUCTS) {
    for (const t of [...p.search_terms.split(','), p.name]) {
      const n = norm(t)
      if (n && !index.has(n)) index.set(n, p.product_id)
    }
  }
  const terms = [...index.keys()]
  const seen = new Set()
  const out = []
  for (const raw of userItems) {
    const text = norm(raw)
    if (!text) continue
    let pid = index.get(text) ?? null
    if (!pid) {
      let best = null
      let bestScore = 80
      for (const t of terms) {
        const s = similarity(text, t)
        if (s >= bestScore) { best = t; bestScore = s }
      }
      pid = best ? index.get(best) : null
    }
    if (pid) {
      if (seen.has(pid)) continue
      seen.add(pid)
    }
    out.push([raw.trim(), pid])
  }
  return out
}

// --- scoring (backend/scoring.py) ---
const EARTH_RADIUS_MILES = 3958.8
const DEFAULT_WEIGHTS = { price: 0.6, distance: 0.3, preference: 0.1 }
const STALE_AFTER_DAYS = 7

function haversineMiles(lat1, lon1, lat2, lon2) {
  const rad = (d) => (d * Math.PI) / 180
  const p1 = rad(lat1)
  const p2 = rad(lat2)
  const a = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(rad(lon2 - lon1) / 2) ** 2
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(a))
}

function normalizeWeights(weights = {}, anyOut = false) {
  const w = {}
  for (const [k, d] of Object.entries(DEFAULT_WEIGHTS)) w[k] = Math.max(Number(weights[k] ?? d), 0)
  w.stock = weights.stock != null ? Math.max(Number(weights.stock), 0) : anyOut ? 0.1 : 0
  let total = Object.values(w).reduce((a, b) => a + b, 0)
  if (total <= 0) {
    Object.assign(w, DEFAULT_WEIGHTS, { stock: 0 })
    total = 1
  }
  for (const k of Object.keys(w)) w[k] /= total
  return w
}

function timeAgo(ts, now) {
  if (!ts) return null
  const secs = Math.max((now - ts) / 1000, 0)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins} min${mins !== 1 ? 's' : ''} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr${hrs !== 1 ? 's' : ''} ago`
  const days = Math.floor(hrs / 24)
  return `${days} day${days !== 1 ? 's' : ''} ago`
}

const fmtUnit = (r) => (r.unit_price == null ? null : `$${r.unit_price.toFixed(2)}/${r.unit || 'unit'}`)

function freshness(r, now) {
  if (!r || !r.observed_at) return { price_age: null, stale: false }
  const old = now - r.observed_at > STALE_AFTER_DAYS * 86400 * 1000
  return { price_age: timeAgo(r.observed_at, now), stale: Boolean(old && r.source !== 'simulated') }
}

function rank({ user_location, items, weights }) {
  const now = new Date()
  const all = matchItems(items)
  const matched = all.filter(([, pid]) => pid)
  const unmatched = all.filter(([, pid]) => !pid).map(([q]) => q)

  const latest = new Map()
  for (const r of latestPrices()) latest.set(`${r.store_id}|${r.product_id}`, r)

  const maxSeen = {}
  for (const r of latest.values()) maxSeen[r.product_id] = Math.max(maxSeen[r.product_id] ?? 0, r.price)

  const anyOut = matched.some(([, pid]) =>
    STORES.some((s) => latest.get(`${s.store_id}|${pid}`)?.in_stock === false),
  )
  const w = normalizeWeights(weights, anyOut)

  const bestUnit = {}
  for (const r of latest.values()) {
    if (!r.in_stock) continue
    const up = r.unit_price ?? r.price
    bestUnit[r.product_id] = Math.min(bestUnit[r.product_id] ?? Infinity, up)
  }

  const rows = STORES.map((s) => {
    const d = haversineMiles(user_location.lat, user_location.lon, s.lat, s.lon)
    let total = 0
    let inStockN = 0
    let prefN = 0
    let lastCrowd = null
    const missing = [...unmatched]
    const breakdown = []
    for (const [q, pid] of matched) {
      const r = latest.get(`${s.store_id}|${pid}`)
      const name = byId[pid]?.name ?? pid
      if (r && r.in_stock) {
        total += r.price
        inStockN += 1
        if ((r.unit_price ?? r.price) <= (bestUnit[pid] ?? Infinity) + 1e-9) prefN += 1
        breakdown.push({
          query: q, name, price: round2(r.price), unit_price: fmtUnit(r), in_stock: true,
          source: r.source, ...freshness(r, now),
        })
      } else {
        total += maxSeen[pid] ?? 0
        missing.push(q)
        breakdown.push({
          query: q, name, price: round2(r ? r.price : maxSeen[pid] ?? 0),
          unit_price: r ? fmtUnit(r) : null, in_stock: false,
          source: r ? r.source : null, ...freshness(r, now),
        })
      }
      if (r?.source === 'crowd' && (!lastCrowd || r.observed_at > lastCrowd)) lastCrowd = r.observed_at
    }
    const n = matched.length
    return { s, d, total, stock: n ? inStockN / n : 1, pref: n ? prefN / n : 0, missing, breakdown, lastCrowd }
  })

  const totals = rows.map((r) => r.total).filter((t) => t > 0)
  const cheapest = totals.length ? Math.min(...totals) : 0
  const mean = rows.length ? rows.reduce((a, r) => a + r.total, 0) / rows.length : 0
  const dMax = Math.max(...rows.map((r) => r.d), 1)

  const out = rows.map((r) => {
    const score =
      w.price * (r.total > 0 ? cheapest / r.total : 0) +
      w.distance * (1 - r.d / dMax) +
      w.stock * r.stock +
      w.preference * r.pref
    return {
      store_id: r.s.store_id,
      name: r.s.name,
      lat: r.s.lat,
      lon: r.s.lon,
      distance_miles: round2(r.d),
      total_basket_price: round2(r.total),
      unit_price_savings_pct: mean ? Math.round(((mean - r.total) / mean) * 1000) / 10 : 0,
      ml_rank_score: Math.round(score * 10000) / 10000,
      last_crowd_ping: timeAgo(r.lastCrowd, now),
      missing_items: r.missing,
      items_breakdown: r.breakdown,
    }
  })
  out.sort(
    (a, b) =>
      b.ml_rank_score - a.ml_rank_score ||
      a.total_basket_price - b.total_basket_price ||
      a.distance_miles - b.distance_miles,
  )
  return out
}

// --- the same shapes the API returns ---
const settle = (value) => new Promise((resolve) => setTimeout(() => resolve(value), 350))

export function getProducts() {
  return settle(PRODUCTS.map(({ product_id, name }) => ({ product_id, name })))
}

export function rankStores(body) {
  return settle({ ranked_stores: rank(body) })
}

export function reportPrice({ store_id, product_id, price, in_stock = true }) {
  if (!STORES.some((s) => s.store_id === store_id) || !byId[product_id]) {
    const err = new Error('Unknown store or product')
    err.status = 404
    return Promise.reject(err)
  }
  const ping_id = `p_${pingCounter++}`
  pings.push({ ping_id, store_id, product_id, price: Number(price), in_stock, reported_at: new Date() })
  return settle({ ok: true, ping_id })
}
