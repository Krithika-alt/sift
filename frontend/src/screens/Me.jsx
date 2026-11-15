import { useEffect, useState } from 'react'
import { BuddySplotch, PrimaryButton, SectionLabel } from '../components/brand.jsx'
import Sheet from '../components/Sheet.jsx'
import Sticker from '../components/Sticker.jsx'
import { MODES } from '../config.js'
import { DIETS, HOME_BASES, useBuddy } from '../lib/profile.js'
import { modeLabel } from './Results.jsx'

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
}

function Row({ label, value, onClick, children }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-[52px] w-full items-center gap-3 border-b border-hair px-4 py-2 text-left last:border-b-0">
      <span className="flex-1 text-[15px] font-semibold text-ink">{label}</span>
      {children ?? <span className="max-w-[55%] text-right text-[15px] text-muted">{value}</span>}
      <span className="text-muted">
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

/** Me: buddy, details (name, home base, diet, weekly budget, default sort). Saves immediately. */
export default function Me({ profile, setProfile, onChangeBuddy, initialEdit = null, onEditOpened }) {
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
    <div className="min-h-full px-5 pb-6 pt-14">
      <section className="flex flex-col items-center text-center">
        <BuddySplotch size={112} />
        <h1 className="mt-4 font-display text-[28px] leading-tight text-ink">Hi, I'm {buddy.name}.</h1>
        <button type="button" onClick={onChangeBuddy} className="min-h-11 px-2 text-[15px] font-semibold text-ink underline underline-offset-4">
          Change buddy
        </button>
      </section>

      <SectionLabel className="mt-6">Your details</SectionLabel>
      <div className="mt-2 rounded-[4px] border border-hair bg-receipt">
        <Row label="Name" value={profile.name || 'Optional'} onClick={() => open('name', profile.name)} />
        <Row label="Home base" value={profile.home.label} onClick={() => open('home')} />
        <Row label="Diet" value={profile.diet.length ? profile.diet.join(', ') : 'None'} onClick={() => open('diet')} />
        <Row label="Weekly budget" onClick={() => open('budget', String(profile.budget))}>
          <span className="font-mono text-[15px] font-bold text-ink">${profile.budget}</span>
        </Row>
        <Row label="Default sort" value={sortLabel} onClick={() => open('sort')} />
        <Row label="Accessories" onClick={() => {}}>
          <Sticker dashed size="sm" tilt={4}>
            Soon
          </Sticker>
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
            <p className="mt-1 text-[15px] text-ink">{buddy.name} will keep this in mind.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {DIETS.map((d) => {
                const on = profile.diet.includes(d)
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => update({ diet: on ? profile.diet.filter((x) => x !== d) : [...profile.diet, d] })}
                    className={`min-h-11 rounded-[14px] border-[1.5px] border-ink px-4 text-[17px] font-semibold ${on ? 'bg-ink text-eggshell' : 'bg-receipt text-ink'}`}
                  >
                    {d}
                  </button>
                )
              })}
            </div>
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
