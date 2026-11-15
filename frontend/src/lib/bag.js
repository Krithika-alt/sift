// Turns what the user types into bag items. Needs (budget, distance, diet) are matched first,
// in lib/needs.js; any other sentence ("I'm on a cut") is 'other' and never becomes a sticker.

const SENTENCE_START = /^(i'?m|i am|im|no|only|must|prefer|please|keep|nothing|without|i don'?t|i prefer|we don'?t)\b/i
const LIST_START = /^(i need|i want|i'?d like|we need|get|buy|grab|pick up|add)\b/i

/** -> { kind: 'items', items: ['eggs', 'milk'] } | { kind: 'other' } | null */
export function parseEntry(raw) {
  const text = raw.trim()
  if (!text) return null
  const lower = text.toLowerCase()
  const isList = LIST_START.test(lower) || /,|;|\band\b/.test(lower)
  if (!isList && SENTENCE_START.test(lower)) return { kind: 'other' }
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

// Saved bags are saved on purpose (the bookmark on the Bag, or "+" on Saved), newest first, max 12.
// { at (id), name, renamed, items, budget, budgetSet, preferences, dietSet, winner? }  (budget null = no budget)
// winner = { store_id, total, saved } from the last sift of that bag (saved = dollars below the nearby average).

/** Same contents = same bag: the confirmed rows and their quantities. */
export const bagSignature = (items) =>
  items.map(toItem).filter(isRankable).map((i) => `${itemKey(i)}x${i.quantity ?? 1}`).sort().join('|')

export const findSavedBag = (list, bag) => {
  const sig = bagSignature(bag.items)
  return sig ? list.find((b) => bagSignature(b.items) === sig) ?? null : null
}

/** Save the current bag with its auto-name (or return the one already saved). -> { list, entry } */
export function saveBag(bag) {
  const old = loadPastBags()
  const same = findSavedBag(old, bag)
  if (same) return { list: old, entry: same }
  const items = bag.items.map(toItem).filter(isRankable)
  const entry = {
    at: Date.now(),
    name: items.length ? autoName(items) : 'New bag',
    renamed: false,
    items,
    budget: bag.budget,
    budgetSet: Boolean(bag.budgetSet),
    preferences: bag.preferences ?? [],
    dietSet: Boolean(bag.dietSet),
  }
  return { list: writePastBags([entry, ...old].slice(0, MAX_PAST)), entry }
}

/** "+" on Saved: a new, empty saved bag. */
export const newSavedBag = (budget) => {
  const entry = { at: Date.now(), name: 'New bag', renamed: true, items: [], budget, budgetSet: false, preferences: [], dietSet: false }
  return { list: writePastBags([entry, ...loadPastBags()].slice(0, MAX_PAST)), entry }
}

/** Edits save automatically; an un-renamed bag keeps its auto-name in step with its items. */
export const updateSavedBag = (at, patch) =>
  writePastBags(
    loadPastBags().map((b) => {
      if (b.at !== at) return b
      const next = { ...b, ...patch }
      if (!next.renamed && patch.items) next.name = next.items.length ? autoName(next.items) : 'New bag'
      return next
    }),
  )

/** After a sift, remember the winner on the saved bag with the same contents (if there is one). */
export function recordWinner(bag, winner) {
  const old = loadPastBags()
  const same = findSavedBag(old, bag)
  return same ? updateSavedBag(same.at, { winner }) : old
}

export const renamePastBag = (at, name) =>
  writePastBags(loadPastBags().map((b) => (b.at === at ? { ...b, name: name.trim() || autoName(b.items), renamed: Boolean(name.trim()) } : b)))

export const removePastBag = (at) => writePastBags(loadPastBags().filter((b) => b.at !== at))
