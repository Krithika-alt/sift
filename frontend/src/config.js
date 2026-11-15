// One place for the API base and demo switches (docs/build-plan.md, "Platform").
const params = new URLSearchParams(window.location.search)

export const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:8000').replace(/\/+$/, '')

// VITE_DEMO_MODE=true or ?demo=1 serves mock JSON from the frontend.
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true' || params.get('demo') === '1'

// Fall back to mock data if the backend errors or takes longer than this.
export const FALLBACK_TIMEOUT_MS = 4000

export const DEFAULT_LOCATION = { lat: 43.0727, lon: -89.4015, label: 'Grainger Hall' }
export const DEMO_BASKET = ['eggs', 'oats', 'greek yogurt', 'chicken breast', 'bananas'].map((t) => ({ label: t, rank: t, quantity: 1 }))
export const DEFAULT_BUDGET = 20

// Segmented control weights for price / distance / preference.
export const MODES = [
  { id: 'cheapest', label: 'Cheapest', weights: { price: 0.85, distance: 0.1, preference: 0.05 } },
  { id: 'balanced', label: 'Balanced', weights: { price: 0.6, distance: 0.3, preference: 0.1 } },
  { id: 'closest', label: 'Closest', weights: { price: 0.25, distance: 0.7, preference: 0.05 } },
]
export const DEFAULT_MODE = 'balanced'
