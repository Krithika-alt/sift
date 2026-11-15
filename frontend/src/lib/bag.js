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

// Bag rows: { label, rank, notFound? }. `label` is what the row shows; `rank` is the text sent
// to /api/rank-stores (null = not sent). Typed items use their own text for both.
export const typedItem = (text) => ({ label: text, rank: text })

// Voice rows from /api/parse-list. rank_items[i] pairs with items[i]; unmatched items are shown
// with NOT FOUND and never sent to rank-stores.
export function voiceItems({ items = [], rank_items = [] }) {
  return items.map((it, i) =>
    it.matched
      ? { label: it.quantity > 1 ? `${it.name} ×${it.quantity}` : it.name, rank: rank_items[i] ?? it.text }
      : { label: it.text, rank: null, notFound: true },
  )
}

export const itemKey = (item) => (item.rank ?? item.label).toLowerCase()

// Older saved bags stored plain strings.
export const toItem = (x) => (typeof x === 'string' ? typedItem(x) : x)

// Past bags (localStorage). Wrapped in try/catch so private windows still work.
const KEY = 'sift.pastBags'

export function loadPastBags() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || []
  } catch {
    return []
  }
}

export function savePastBag(bag) {
  const items = bag.items.filter((i) => i.rank)
  const sig = (b) => b.items.map((i) => itemKey(toItem(i))).sort().join('|')
  const entry = { items, budget: bag.budget, preferences: bag.preferences, at: Date.now() }
  if (!items.length) return loadPastBags()
  const list = [entry, ...loadPastBags().filter((b) => sig(b) !== sig(entry))].slice(0, 6)
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* storage unavailable */
  }
  return list
}
