// API client. Section 3 contract only; no invented fields or endpoints.
// Every call resolves to { data, demo } where demo=true means the data came from
// the local mock (DEMO_MODE, or the backend errored / took longer than ~4 s).
import { API_BASE, DEMO_MODE, FALLBACK_TIMEOUT_MS } from '../config.js'
import * as mock from './mock.js'

async function request(path, { method = 'GET', body, timeout = FALLBACK_TIMEOUT_MS } = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    })
    if (!res.ok) {
      const err = new Error(`${method} ${path} failed with ${res.status}`)
      err.status = res.status
      throw err
    }
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

// 4xx means the request itself was wrong (e.g. unknown product), so surface it.
// Network errors, timeouts and 5xx fall back to mock data.
async function withFallback(live, offline) {
  if (DEMO_MODE) return { data: await offline(), demo: true }
  try {
    return { data: await live(), demo: false }
  } catch (err) {
    if (err.status && err.status < 500) throw err
    console.warn('[sift] backend unavailable, using demo data:', err.message)
    return { data: await offline(), demo: true }
  }
}

/** GET /api/products -> [{ product_id, name }] */
export const getProducts = () => withFallback(() => request('/api/products'), mock.getProducts)

/**
 * POST /api/rank-stores
 * body: { user_location: {lat, lon}, items: [str], weights: {price, distance, preference}, budget?, preferences? }
 * -> { ranked_stores: [...] }
 */
export const rankStores = (body) =>
  withFallback(
    () => request('/api/rank-stores', { method: 'POST', body }),
    () => mock.rankStores(body),
  )

/** POST /api/report-price  body: { store_id, product_id, price, in_stock } -> { ok, ping_id } */
export const reportPrice = (body) =>
  withFallback(
    () => request('/api/report-price', { method: 'POST', body }),
    () => mock.reportPrice(body),
  )
