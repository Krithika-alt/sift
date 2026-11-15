// Turns what the user types into either bag items or "needs" (preferences / budget).

const DIET_WORDS = [
  'vegetarian', 'vegan', 'pescatarian', 'gluten-free', 'gluten free', 'dairy-free', 'dairy free',
  'nut-free', 'nut free', 'halal', 'kosher', 'organic', 'low sodium', 'high protein', 'keto',
]

const SENTENCE_START = /^(i'?m|i am|im|i|we|no|only|must|prefer|please|keep|nothing|without)\b/i
const BUDGET = /(?:under|below|less than|max(?:imum)?|budget(?: of| is)?|at most|within)\s*\$?\s*(\d+(?:\.\d{1,2})?)|\$\s*(\d+(?:\.\d{1,2})?)/i

/**
 * Returns one of:
 *  { kind: 'budget', budget: 15 }
 *  { kind: 'preference', preference: 'vegetarian' }
 *  { kind: 'items', items: ['eggs', 'milk'] }
 */
export function parseEntry(raw) {
  const text = raw.trim()
  if (!text) return null

  const b = text.match(BUDGET)
  if (b) {
    const budget = Number(b[1] ?? b[2])
    if (budget > 0) return { kind: 'budget', budget }
  }

  const lower = text.toLowerCase()
  const words = lower.split(/\s+/)
  const looksLikeSentence = SENTENCE_START.test(lower) || words.length >= 4
  const diet = DIET_WORDS.find((w) => lower.includes(w))
  if (diet && (looksLikeSentence || words.length <= 2)) {
    return { kind: 'preference', preference: diet.replace(' ', '-') }
  }
  if (looksLikeSentence) {
    const preference = lower.replace(/^(i'?m|i am|im)\s+/, '').replace(/[.!?]+$/, '')
    return { kind: 'preference', preference }
  }

  const items = text.split(',').map((s) => s.trim()).filter(Boolean)
  return { kind: 'items', items }
}

// Bag rows: { label, rank, quantity, notFound? }. `label` is what the row shows; `rank` is the
// text sent to /api/rank-stores (null = not sent). Typed items use their own text for both.
export const typedItem = (text) => ({ label: text, rank: text, quantity: 1 })

const norm = (t) => String(t).trim().toLowerCase()

// Voice rows from /api/parse-list. rank_items[i] pairs with items[i] (string or {text, quantity}).
// Anything in `unmatched` (or matched: false) gets NOT FOUND and is never sent to rank-stores.
export function voiceItems({ items = [], rank_items = [], unmatched = [] }) {
  const missing = new Set(unmatched.map(norm))
  return items.map((it, i) => {
    const ri = rank_items[i]
    const quantity = Math.max(1, (typeof ri === 'object' && ri?.quantity) || it.quantity || 1)
    if (!it.matched || missing.has(norm(it.text))) return { label: it.text, rank: null, quantity, notFound: true }
    return { label: it.name ?? it.text, rank: typeof ri === 'string' ? ri : ri?.text ?? it.text, quantity }
  })
}

// What rank-stores receives for one row: a plain string, or {text, quantity} when more than one.
export const toRankItem = (item) => (item.quantity > 1 ? { text: item.rank, quantity: item.quantity } : item.rank)

export const itemKey = (item) => (item.rank ?? item.label).toLowerCase()

// Older saved bags stored plain strings or rows without quantity.
export const toItem = (x) => (typeof x === 'string' ? typedItem(x) : { quantity: 1, ...x })

// Past bags (localStorage). Wrapped in try/catch so private windows still work.
const KEY = 'sift.pastBags'

export function loadPastBags() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || []
  } catch {
    return []
  }
}

function writePastBags(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* storage unavailable */
  }
  return list
}

/** Saves the bag before sifting. Returns { list, at } so the winner can be added later. */
export function savePastBag(bag) {
  const items = bag.items.filter((i) => i.rank)
  const sig = (b) => b.items.map((i) => itemKey(toItem(i))).sort().join('|')
  const entry = { items, budget: bag.budget, preferences: bag.preferences, at: Date.now() }
  if (!items.length) return { list: loadPastBags(), at: null }
  const list = [entry, ...loadPastBags().filter((b) => sig(b) !== sig(entry))].slice(0, 6)
  return { list: writePastBags(list), at: entry.at }
}

/** Remembers which store won for a saved bag: { store_id, total }. */
export function setPastBagWinner(at, store) {
  const list = loadPastBags().map((b) =>
    b.at === at ? { ...b, winner: { store_id: store.store_id, total: store.total_basket_price } } : b,
  )
  return writePastBags(list)
}
