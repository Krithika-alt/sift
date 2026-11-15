// Helpers derived only from contract fields.

// Each store owns one sticker color (map pin, tags, receipt). Pea, olive and butter
// stay free for BEST PICK, REAL PRICE and SAVES.
const STORE_PALETTE = ['tomato', 'clementine', 'sardine', 'radish', 'beet', 'butter']
const KNOWN = {
  trader_joes_monroe: 'tomato',
  fresh_madison_market: 'clementine',
  capitol_centre_market: 'sardine',
  target_state_st: 'radish',
  walgreens_state_st: 'beet',
  pick_n_save: 'butter',
}
export function storeColor(storeId) {
  if (KNOWN[storeId]) return KNOWN[storeId]
  let h = 0
  for (const ch of storeId) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return STORE_PALETTE[h % STORE_PALETTE.length]
}

export const money = (n) => `$${Number(n).toFixed(2)}`
export const matchPct = (store) => `${Math.round(store.ml_rank_score * 100)}%`
export const walkMinutes = (mi) => Math.max(1, Math.round(mi * 20))
// line_total = price x quantity (older backends only send price)
export const lineTotal = (item) => item.line_total ?? item.price * (item.quantity ?? 1)
export const miles = (n) => `${Number(n).toFixed(1)} MI`

// Real = anything observed (crowd or scraped); simulated is labeled as such.
export const isReal = (item) => item.source != null && item.source !== 'simulated'

export function priceCounts(store) {
  const priced = store.items_breakdown.filter((i) => i.source != null)
  const real = priced.filter(isReal).length
  return { real, simulated: priced.length - real }
}

export function itemsFound(store) {
  const found = store.items_breakdown.filter((i) => i.in_stock).length
  return { found, total: found + store.missing_items.length }
}

// Dollars saved vs the average basket across the ranked stores
// (the same mean the backend uses for unit_price_savings_pct).
export function savingsVsNearby(store, ranked) {
  const mean = ranked.reduce((a, s) => a + s.total_basket_price, 0) / ranked.length
  return mean - store.total_basket_price
}

// Tom's one-line reason, built from the ranking only. Never claims filtering.
export function reasonLine(ranked, budget) {
  const best = ranked[0]
  if (!best) return 'No stores found nearby.'
  const { found, total } = itemsFound(best)
  if (found < total) return `Best pick, missing ${total - found} of ${total}.`
  if (budget && best.total_basket_price > budget) {
    return `${money(best.total_basket_price - budget)} over budget here.`
  }
  const cheapest = Math.min(...ranked.map((s) => s.total_basket_price))
  const closest = Math.min(...ranked.map((s) => s.distance_miles))
  const isCheapest = best.total_basket_price <= cheapest
  const isClosest = best.distance_miles <= closest
  if (isCheapest && isClosest) return 'Cheapest and closest.'
  if (isCheapest) return `Cheapest bag, ${best.distance_miles.toFixed(1)} mi away.`
  if (isClosest) return `Closest, only ${money(best.total_basket_price - cheapest)} more.`
  return 'Good price, short walk.'
}

// Directions with no travel mode, so the user picks walking, driving or transit in Maps.
const isApple = () => typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Macintosh|Mac OS X/.test(navigator.userAgent)
export function directionsUrl(store) {
  return isApple()
    ? `https://maps.apple.com/?daddr=${store.lat},${store.lon}&q=${encodeURIComponent(store.name)}`
    : `https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lon}`
}
