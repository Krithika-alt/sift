// The bag's "needs": budget, distance and diet. The only stickers on the bag.

// Search radius (miles), shared by the Results map, the Map tab and the bag's distance sticker.
// 1 mi is walking distance; 10 mi covers a drive across town.
export const RADII = [1, 3, 5, 10]
export const DEFAULT_RADIUS = 3
const RADIUS_KEY = 'sift.radius'

export function loadRadius() {
  try {
    const raw = localStorage.getItem(RADIUS_KEY)
    // older choices (0.5 or 2 mi) move to the nearest pill that still covers them
    return raw == null ? DEFAULT_RADIUS : snapRadius(Number(raw) || DEFAULT_RADIUS)
  } catch {
    return DEFAULT_RADIUS
  }
}
export function saveRadius(r) {
  try {
    localStorage.setItem(RADIUS_KEY, String(r))
  } catch {
    /* storage unavailable */
  }
  return r
}
export const radiusLabel = (r) => `${r} mi`
export const withinRadius = (stores, r) => stores.filter((s) => s.distance_miles <= r)

// Diets: ids sent as `preferences`, labels for Me and the sheet. At most two on a bag.
export const DIETS = [
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'gluten-free', label: 'Gluten-free' },
  { id: 'dairy-free', label: 'Dairy-free' },
]
export const MAX_DIETS = 2
export const dietLabel = (id) => DIETS.find((d) => d.id === id)?.label ?? id
// Older profiles stored labels ("Vegetarian"); older bags may hold other free-text preferences.
export const toDietIds = (list = []) => [...new Set(list.map((d) => String(d).toLowerCase().replace(/\s+/g, '-')).filter((d) => DIETS.some((x) => x.id === d)))]

/** Toggle a diet, keeping at most two (turning on a third drops the oldest). */
export function toggleDiet(list, id) {
  if (list.includes(id)) return list.filter((d) => d !== id)
  return [...list, id].slice(-MAX_DIETS)
}

// Sentences are matched before item parsing.
const BUDGET = [
  /\b(?:under|below|less than|at most|max(?:imum)?(?: of)?|no more than)\s*\$\s*(\d+(?:\.\d{1,2})?)/,
  /\b(?:under|below|less than|at most|no more than)\s*(\d+(?:\.\d{1,2})?)\s*(?:dollars|bucks)?$/,
  /\bbudget(?:\s+(?:of|is|to))?\s*(?:about\s*)?\$?\s*(\d+(?:\.\d{1,2})?)/,
  /^\$\s*(\d+(?:\.\d{1,2})?)\s*(?:budget|max|tops)?$/,
  /\$\s*(\d+(?:\.\d{1,2})?)\s*(?:budget|max|tops)\b/,
]
const NO_BUDGET = /^(?:no budget|any budget|budget doesn'?t matter|no limit)$/
const WITHIN = /\bwithin\s+(?:a\s+)?(half(?:\s+a)?|\d+(?:\.\d+)?)\s*(?:a\s+)?(?:mi|mile|miles)\b/
const NEAR = /\b(?:nothing far|not too far|walking distance|walkable|close by|nearby only)\b/
const DRIVE = /\b(?:i'?m driving|i am driving|i drive|i have a car|i've got a car|by car|can drive)\b/
const DIET_PATTERNS = [
  ['vegan', /\b(?:vegan|plant[- ]based)\b/],
  ['vegetarian', /\b(?:vegetarian|veggie|no meat)\b/],
  ['gluten-free', /\b(?:gluten[- ]?free|no gluten|celiac|coeliac)\b/],
  ['dairy-free', /\b(?:dairy[- ]?free|no dairy|lactose[- ]free|lactose intolerant)\b/],
]
const SENTENCE_START = /^(?:i'?m|i am|im|we'?re|we are|i eat|i only eat|i don'?t eat|no|only|keep it|keep|make it|nothing|without|please)\b/

/** The smallest radius pill that covers the asked distance. */
export const snapRadius = (mi) => RADII.find((r) => r >= mi - 1e-9) ?? RADII[RADII.length - 1]

function matchPart(part) {
  const p = part.trim().replace(/[.!?]+$/, '')
  if (!p) return null
  if (NO_BUDGET.test(p)) return { budget: null }
  for (const re of BUDGET) {
    const m = p.match(re)
    if (m && Number(m[1]) > 0) return { budget: Number(m[1]) }
  }
  const w = p.match(WITHIN)
  if (w) return { radius: snapRadius(w[1].startsWith('half') ? 0.5 : Number(w[1])) }
  if (NEAR.test(p)) return { radius: 1 } // walking distance = 1 mi
  if (DRIVE.test(p)) return { radius: 10 } // a car: across town
  const diet = DIET_PATTERNS.find(([, re]) => re.test(p))
  if (diet) {
    // "vegan" alone or as a sentence ("I'm vegan", "no dairy"); "vegan cheese" is an item.
    const bare = p.replace(SENTENCE_START, '').replace(/^(?:a|an)\s+/, '').trim()
    if (SENTENCE_START.test(p) || DIET_PATTERNS.some(([, re]) => re.test(bare) && bare.replace(re, '').trim() === '')) return { diet: diet[0] }
  }
  return null
}

/**
 * A sentence of needs -> { budget?, radius?, diets? } or null when it isn't one.
 * Several needs may share a sentence: "I'm vegan and under $15".
 */
export function parseNeeds(raw) {
  const text = String(raw).trim().toLowerCase().replace(/[’]/g, "'")
  if (!text) return null
  const parts = text.split(/\s*(?:,|;|\band\b|\balso\b)\s*/).filter(Boolean)
  const found = parts.map(matchPart)
  if (!found.length || found.some((f) => !f)) return null
  const out = {}
  for (const f of found) {
    if ('budget' in f) out.budget = f.budget
    if (f.radius) out.radius = f.radius
    if (f.diet) out.diets = [...new Set([...(out.diets ?? []), f.diet])]
  }
  return out
}

const fmtBudget = (b) => (b == null ? 'no budget' : `$${Number.isInteger(b) ? b : b.toFixed(2)} budget`)
export const budgetText = (b) => (b == null ? 'No budget' : `$${Number.isInteger(b) ? b : Number(b).toFixed(2)} budget`)

/** The buddy's one-line confirmation: "Got it, $15 budget." */
export function needsLine(n) {
  const bits = []
  if (n.diets?.length) bits.push(n.diets.map((d) => dietLabel(d).toLowerCase()).join(' and '))
  if ('budget' in n) bits.push(fmtBudget(n.budget))
  if (n.radius) bits.push(`within ${n.radius} mi`)
  return `Got it, ${bits.join(', ')}.`
}

/** Apply parsed needs to a bag; radius is shared app state, so it is returned separately. */
export function applyNeeds(bag, n, defaultDiets = []) {
  let next = bag
  if ('budget' in n) next = { ...next, budget: n.budget, budgetSet: true }
  if (n.diets?.length) {
    let diets = next.dietSet ? next.preferences ?? [] : defaultDiets
    for (const d of n.diets) if (!diets.includes(d)) diets = toggleDiet(diets, d)
    next = { ...next, preferences: diets, dietSet: true }
  }
  return next
}

// Effective needs for a bag: an untouched bag follows the Me defaults.
export const bagBudget = (bag, profile) => (bag.budgetSet ? bag.budget ?? null : profile.budget ?? null)
export const bagDiets = (bag, profile) => (bag.dietSet ? toDietIds(bag.preferences) : toDietIds(profile.diet))
