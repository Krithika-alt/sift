// Me tab settings, saved to localStorage immediately. No backend changes.
import { createContext, useContext } from 'react'
import { BUDDIES } from '../components/Buddies.jsx'
import { DEFAULT_BUDGET, DEFAULT_LOCATION, DEFAULT_MODE } from '../config.js'

const KEY = 'sift.profile'

export const HOME_BASES = [
  { id: 'grainger', label: 'Grainger Hall', lat: DEFAULT_LOCATION.lat, lon: DEFAULT_LOCATION.lon },
  { id: 'union', label: 'Memorial Union', lat: 43.0761, lon: -89.3999 },
]
export const DIETS = ['Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free']

export const DEFAULT_PROFILE = {
  buddyId: null, // null until the first-launch picker
  name: '',
  home: HOME_BASES[0], // or { id: 'geo', label: 'Your location', lat, lon }
  diet: [],
  budget: DEFAULT_BUDGET,
  defaultSort: DEFAULT_MODE,
}

export function loadProfile() {
  try {
    return { ...DEFAULT_PROFILE, ...(JSON.parse(localStorage.getItem(KEY)) || {}) }
  } catch {
    return { ...DEFAULT_PROFILE }
  }
}

export function saveProfile(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* storage unavailable */
  }
  return p
}

export const buddyOf = (id) => BUDDIES.find((b) => b.id === id) ?? BUDDIES[0]

// The chosen buddy, available on every screen: { id, name, kind, sticker }
export const BuddyContext = createContext(BUDDIES[0])
export const useBuddy = () => useContext(BuddyContext)
