// Turns what the user types into either bag items or "needs" (preferences / budget).

const DIET_WORDS = [
  'vegetarian', 'vegan', 'pescatarian', 'gluten-free', 'gluten free', 'dairy-free', 'dairy free',
  'nut-free', 'nut free', 'halal', 'kosher', 'organic', 'low sodium', 'high protein', 'keto',
]

const SENTENCE_START = /^(i'?m|i am|im|no|only|must|prefer|please|keep|nothing|without|i don'?t|i prefer|we don'?t)\b/i
const LIST_START = /^(i need|i want|i'?d like|we need|get|buy|grab|pick up|add)\b/i
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
  // Lists ("milk, eggs and bread", "I need ...") are items, however long.
  const isList = LIST_START.test(lower) || /,|;|\band\b/.test(lower)
  const diet = DIET_WORDS.find((w) => lower.includes(w))
  if (diet && !isList && (SENTENCE_START.test(lower) || words.length <= 2)) {
    return { kind: 'preference', preference: diet.replace(' ', '-') }
  }
  if (!isList && SENTENCE_START.test(lower)) {
    const preference = lower.replace(/^(i'?m|i am|im)\s+/, '').replace(/[.!?]+$/, '')
    return { kind: 'preference', preference }
  }

  const items = text.split(',').map((s) => s.trim()).filter(Boolean)
  return { kind: 'items', items }
}

// Bag rows: { label, rank, quantity, status, said?, suggestions? }
//   status 'ok'      normal row; `rank` is the text sent to /api/rank-stores
//   status 'confirm' matched but needs_confirm: "Did you mean <label>?" (dashed)
//   status 'missing' not matched: "Couldn't find <label>." with up to 3 suggestions (dashed)
// Only 'ok' rows are sent to rank-stores. Typed items are 'ok' with their own text.
export const typedItem = (text) => ({ label: text, rank: text, quantity: 1, status: 'ok' })
export const productItem = (name, quantity = 1) => ({ label: name, rank: name, quantity, status: 'ok' })

const norm = (t) => String(t).trim().toLowerCase()

// Rows from /api/parse-list. rank_items[i] pairs with items[i] (string or {text, quantity}).
// Never shows match_type or confidence.
export function voiceItems({ items = [], rank_items = [], unmatched = [] }) {
  const missing = new Set(unmatched.map(norm))
  return items.map((it, i) => {
    const ri = rank_items[i]
    const quantity = Math.max(1, (typeof ri === 'object' && ri?.quantity) || it.quantity || 1)
    if (!it.matched || missing.has(norm(it.text))) {
      return { label: it.text, rank: null, quantity, status: 'missing', suggestions: (it.suggestions ?? []).slice(0, 3) }
    }
    const rank = typeof ri === 'string' ? ri : ri?.text ?? it.name ?? it.text
    const name = it.name ?? it.text
    return it.needs_confirm
      ? { label: name, rank, quantity, status: 'confirm', said: it.text }
      : { label: name, rank, quantity, status: 'ok' }
  })
}

export const isDashed = (item) => item.status === 'confirm' || item.status === 'missing'
export const isRankable = (item) => (item.status ?? 'ok') === 'ok' && Boolean(item.rank)

// What rank-stores receives for one confirmed row (same shape as rank_items).
export const toRankItem = (item) => ({ text: item.rank, quantity: item.quantity ?? 1 })

// Dashed rows are keyed by what was said, so two guesses at the same product both stay visible.
export const itemKey = (item) =>
  item.status === 'confirm' ? `confirm:${norm(item.said ?? item.label)}`
    : item.status === 'missing' ? `missing:${norm(item.label)}`
      : norm(item.rank ?? item.label)

// "Old-fashioned oats, 42 oz" -> "Oats": drop the size, keep it short for a chip.
export function shortName(name) {
  const base = String(name).split(',')[0].trim()
  const s = base.length > 14 ? base.split(/\s+/).pop() : base
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

// Older saved bags stored plain strings or rows without quantity.
export const toItem = (x) => (typeof x === 'string' ? typedItem(x) : { quantity: 1, status: 'ok', ...x })

// Past bags (localStorage). Wrapped in try/catch so private windows still work.
const KEY = 'sift.pastBags'
const MAX_PAST = 12

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

// Auto-name from contents: eggs + oats + yogurt -> "Breakfast run"; chicken + rice -> "Dinner basics";
// otherwise the first two items, e.g. "Eggs & oats".
export function autoName(items) {
  const text = items.map((i) => toItem(i).label.toLowerCase()).join(' | ')
  const has = (w) => text.includes(w)
  if (has('egg') && has('oat') && has('yogurt')) return 'Breakfast run'
  if (has('chicken') && has('rice')) return 'Dinner basics'
  const short = (l) => l.split(',')[0].trim().toLowerCase()
  const names = items.slice(0, 2).map((i) => short(toItem(i).label))
  const joined = names.join(' & ')
  return joined.charAt(0).toUpperCase() + joined.slice(1)
}

/**
 * Every successful sift saves the bag (newest first, max 12), with the winner:
 * winner = { store_id, total, saved } where saved = dollars below the nearby average.
 */
export function savePastBag(bag, winner) {
  const items = bag.items.filter(isRankable)
  if (!items.length) return loadPastBags()
  const sig = (b) => b.items.map((i) => itemKey(toItem(i))).sort().join('|')
  const old = loadPastBags()
  const same = old.find((b) => sig(b) === sig({ items }))
  const entry = {
    items,
    budget: bag.budget,
    budgetSet: Boolean(bag.budgetSet),
    preferences: bag.preferences,
    name: same?.renamed ? same.name : autoName(items),
    renamed: Boolean(same?.renamed),
    winner,
    at: Date.now(),
  }
  return writePastBags([entry, ...old.filter((b) => b !== same)].slice(0, MAX_PAST))
}

export const renamePastBag = (at, name) =>
  writePastBags(loadPastBags().map((b) => (b.at === at ? { ...b, name: name.trim() || autoName(b.items), renamed: Boolean(name.trim()) } : b)))

export const removePastBag = (at) => writePastBags(loadPastBags().filter((b) => b.at !== at))
