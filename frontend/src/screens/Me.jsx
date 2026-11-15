import { useEffect, useState } from 'react'
import { BuddySplotch, LandingSticker, PrimaryButton, SectionLabel, tint } from '../components/brand.jsx'
import Sheet from '../components/Sheet.jsx'
import Sticker from '../components/Sticker.jsx'
import { MODES } from '../config.js'
import { DIETS, dietLabel, toDietIds, toggleDiet } from '../lib/needs.js'
import { HOME_BASES, useBuddy } from '../lib/profile.js'
import { money } from '../lib/stores.js'
import { modeLabel } from './Results.jsx'

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
}

const HEX = { radish: '#F2A7B5', sardine: '#7DA3E0', pea: '#9DBE5A', butter: '#F0CB5C', clementine: '#F08A3C', beet: '#7A2A40' }
const PAPER = '#F7F1E3'

// Small flat splotch icons, in the tab icons' style: one rough-edged shape, one tiny paper detail, no outline.
const ICONS = {
  name: (c) => (
    <>
      <circle cx="16" cy="11" r="5.6" fill={c} />
      <path d="M6 27 C6.5 20 10.5 17.5 16 17.5 C21.5 17.5 25.5 20 26 27 Q16 28.5 6 27Z" fill={c} />
    </>
  ),
  home: (c) => (
    <>
      <path d="M5.5 15.5 L16 6 L26.5 15.5 L26 26.5 Q16 28 6 26.5 Z" fill={c} />
      <path d="M13.5 26.5 L13.5 20 Q16 19 18.5 20 L18.5 26.5Z" fill={PAPER} opacity="0.85" />
    </>
  ),
  diet: (c) => (
    <>
      <path d="M6.5 25.5 C6 14 13.5 6.5 26 6 C26.5 18.5 19 26 6.5 25.5Z" fill={c} />
      <path d="M9 23 C13 18.5 17 14.5 22 10" stroke={PAPER} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.85" />
    </>
  ),
  budget: (c) => (
    <>
      <circle cx="16" cy="16" r="10.5" fill={c} />
      <circle cx="16" cy="16" r="6.5" stroke={PAPER} strokeWidth="1.5" fill="none" opacity="0.85" />
    </>
  ),
  sort: (c) => (
    <>
      <rect x="5.5" y="7" width="21" height="4.6" rx="2.3" fill={c} />
      <rect x="5.5" y="14" width="15" height="4.6" rx="2.3" fill={c} />
      <rect x="5.5" y="21" width="9" height="4.6" rx="2.3" fill={c} />
    </>
  ),
  accessories: (c) => (
    <>
      <path d="M16 4.5 L19.2 12 L27 12.6 L21 17.7 L22.9 25.5 L16 21.3 L9.1 25.5 L11 17.7 L5 12.6 L12.8 12 Z" fill={c} />
      <circle cx="16" cy="15.5" r="2" fill={PAPER} opacity="0.85" />
    </>
  ),
}

function MeIcon({ name, color }) {
  return (
    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 32 32" style={{ filter: 'url(#sift-sticker-edge)', overflow: 'visible', flexShrink: 0 }}>
      {ICONS[name](HEX[color])}
    </svg>
  )
}

/** A value as a small soft chip in the row's color at 22% (Karla 600 14). */
function Chip({ color, children }) {
  return (
    <span className="inline-flex h-7 max-w-full items-center truncate rounded-full px-2.5 text-[14px] font-semibold text-ink" style={{ background: tint(color, 22) }}>
      {children}
    </span>
  )
}

// 56px rows on a receipt-paper card, 1px hairlines between.
function Row({ icon, color, label, onClick, children }) {
  return (
    <button type="button" onClick={onClick} className="flex h-14 w-full items-center gap-3 border-b border-hair px-4 text-left last:border-b-0">
      <MeIcon name={icon} color={color} />
      <span className="shrink-0 text-[15px] font-semibold text-ink">{label}</span>
      <span className="flex min-w-0 flex-1 justify-end gap-1.5">{children}</span>
      <span className="shrink-0 text-muted">
        <Chevron />
      </span>
    </button>
  )
}

function Choice({ on, onClick, children }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`min-h-11 w-full rounded-[14px] border-[1.5px] border-ink px-4 text-left text-[17px] font-semibold ${on ? 'bg-ink text-eggshell' : 'bg-receipt text-ink'}`}
    >
      {children}
    </button>
  )
}

/**
 * Me: buddy; "Your Sift so far" (saved dollars and bag count, from saved bags in localStorage);
 * details with colored splotch icons and soft value chips. Diet and budget are the defaults for
 * every new bag. Saves immediately.
 */
export default function Me({ profile, setProfile, pastBags = [], onChangeBuddy, initialEdit = null, onEditOpened }) {
  const buddy = useBuddy()
  const [editing, setEditing] = useState(initialEdit) // 'name' | 'home' | 'diet' | 'budget' | 'sort'
  useEffect(() => {
    if (initialEdit) onEditOpened?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [draft, setDraft] = useState('')
  const [geoMsg, setGeoMsg] = useState('')
  const update = (patch) => setProfile((p) => ({ ...p, ...patch }))
  const open = (id, value = '') => {
    setDraft(value)
    setGeoMsg('')
    setEditing(id)
  }
  const sortLabel = modeLabel(MODES.find((m) => m.id === profile.defaultSort) ?? MODES[1], buddy.name)
  const diets = toDietIds(profile.diet)
  const savedTotal = pastBags.reduce((a, b) => a + (b.winner?.saved > 0 ? b.winner.saved : 0), 0)

  function useMyLocation() {
    if (!navigator.geolocation) return setGeoMsg("This browser can't share a location.")
    setGeoMsg('Finding you...')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        update({ home: { id: 'geo', label: 'Your location', lat: pos.coords.latitude, lon: pos.coords.longitude } })
        setEditing(null)
      },
      () => setGeoMsg("Couldn't get your location. Pick a place instead."),
      { timeout: 8000 },
    )
  }

  return (
    <div className="min-h-full px-5 pb-8 pt-14">
      <section className="flex flex-col items-center text-center">
        <BuddySplotch size={112} />
        <h1 className="mt-4 font-display text-[28px] leading-tight text-ink">Hi, I'm {buddy.name}.</h1>
        <button type="button" onClick={onChangeBuddy} className="min-h-11 px-2 text-[15px] font-semibold text-ink underline underline-offset-4">
          Change buddy
        </button>
      </section>

      <section aria-label="Your Sift so far" className="mt-6">
        <SectionLabel>Your Sift so far</SectionLabel>
        <div className="mt-2 flex items-center gap-3">
          <LandingSticker>
            <Sticker color="butter" tilt={-4}>
              Saved {money(savedTotal)}
            </Sticker>
          </LandingSticker>
          <LandingSticker delay={0.06}>
            <Sticker color="pea" tilt={3}>
              {pastBags.length} {pastBags.length === 1 ? 'bag' : 'bags'}
            </Sticker>
          </LandingSticker>
          <span className="text-[13px] text-muted">since you started</span>
        </div>
      </section>

      <SectionLabel className="mt-6">Your details</SectionLabel>
      <div className="mt-2 overflow-hidden rounded-[6px] border border-hair bg-receipt">
        <Row icon="name" color="radish" label="Name" onClick={() => open('name', profile.name)}>
          {profile.name ? <Chip color="radish">{profile.name}</Chip> : <span className="text-[14px] text-muted">Optional</span>}
        </Row>
        <Row icon="home" color="sardine" label="Home base" onClick={() => open('home')}>
          <Chip color="sardine">{profile.home.label}</Chip>
        </Row>
        <Row icon="diet" color="pea" label="Diet" onClick={() => open('diet')}>
          {diets.length ? (
            diets.map((d) => (
              <Chip key={d} color="pea">
                {dietLabel(d)}
              </Chip>
            ))
          ) : (
            <span className="text-[14px] text-muted">None</span>
          )}
        </Row>
        <Row icon="budget" color="butter" label="Weekly budget" onClick={() => open('budget', profile.budget == null ? '' : String(profile.budget))}>
          <Chip color="butter">{profile.budget == null ? 'None' : `$${profile.budget}`}</Chip>
        </Row>
        <Row icon="sort" color="clementine" label="Default sort" onClick={() => open('sort')}>
          <Chip color="clementine">{sortLabel}</Chip>
        </Row>
        <Row icon="accessories" color="beet" label="Accessories" onClick={() => {}}>
          <Chip color="beet">Soon</Chip>
        </Row>
      </div>

      <p className="mt-6 text-[13px] text-muted">Prices: real where marked, simulated otherwise.</p>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title="Edit">
        {editing === 'name' && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              update({ name: draft.trim() })
              setEditing(null)
            }}
          >
            <label className="text-[14px] font-semibold text-ink" htmlFor="me-name">
              Your name (optional)
            </label>
            <input
              id="me-name"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={24}
              autoComplete="given-name"
              className="mt-1.5 min-h-[52px] w-full rounded-[14px] border-[1.5px] border-ink bg-receipt px-4 text-[17px] text-ink focus:outline-none"
            />
            <PrimaryButton type="submit" className="mt-4">
              Save
            </PrimaryButton>
          </form>
        )}

        {editing === 'home' && (
          <div role="radiogroup" aria-label="Home base" className="space-y-2">
            <h2 className="mb-3 text-[14px] font-semibold text-ink">Home base</h2>
            {HOME_BASES.map((h) => (
              <Choice
                key={h.id}
                on={profile.home.id === h.id}
                onClick={() => {
                  update({ home: h })
                  setEditing(null)
                }}
              >
                {h.label}
              </Choice>
            ))}
            <Choice on={profile.home.id === 'geo'} onClick={useMyLocation}>
              Use my location
            </Choice>
            {geoMsg && <p className="pt-1 text-[15px] text-ink">{geoMsg}</p>}
          </div>
        )}

        {editing === 'diet' && (
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Diet</h2>
            <p className="mt-1 text-[15px] text-ink">Every new bag starts with these. Up to two.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {DIETS.map((d) => {
                const on = diets.includes(d.id)
                return (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => update({ diet: toggleDiet(diets, d.id) })}
                    className={`min-h-11 rounded-[14px] border-[1.5px] border-ink px-4 text-[17px] font-semibold ${on ? 'bg-ink text-eggshell' : 'bg-receipt text-ink'}`}
                  >
                    {d.label}
                  </button>
                )
              })}
            </div>
            <p className="mt-3 text-[13px] text-muted">Noted for later. Results aren't filtered by diet yet.</p>
            <PrimaryButton className="mt-5" onClick={() => setEditing(null)}>
              Done
            </PrimaryButton>
          </div>
        )}

        {editing === 'budget' && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const n = Math.round(Number(draft))
              if (n > 0) update({ budget: n })
              setEditing(null)
            }}
          >
            <label className="text-[14px] font-semibold text-ink" htmlFor="me-budget">
              Weekly budget
            </label>
            <div className="mt-1.5 flex min-h-[52px] items-center rounded-[14px] border-[1.5px] border-ink bg-receipt px-4">
              <span className="font-mono text-[20px] font-bold text-ink">$</span>
              <input
                id="me-budget"
                type="number"
                inputMode="numeric"
                min="1"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="ml-1 w-full bg-transparent font-mono text-[20px] font-bold text-ink focus:outline-none"
              />
            </div>
            <PrimaryButton type="submit" className="mt-4">
              Save
            </PrimaryButton>
          </form>
        )}

        {editing === 'sort' && (
          <div role="radiogroup" aria-label="Default sort" className="space-y-2">
            <h2 className="mb-3 text-[14px] font-semibold text-ink">Default sort</h2>
            {MODES.map((m) => (
              <Choice
                key={m.id}
                on={profile.defaultSort === m.id}
                onClick={() => {
                  update({ defaultSort: m.id })
                  setEditing(null)
                }}
              >
                {modeLabel(m, buddy.name)}
              </Choice>
            ))}
          </div>
        )}
      </Sheet>
    </div>
  )
}
