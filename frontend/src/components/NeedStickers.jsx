import { useState } from 'react'
import { LandingSticker, PrimaryButton } from './brand.jsx'
import RadiusPills from './RadiusPills.jsx'
import Sheet from './Sheet.jsx'
import Sticker from './Sticker.jsx'
import { DIETS, MAX_DIETS, dietLabel, toggleDiet } from '../lib/needs.js'

const TILTS = [-4, 3, -2, 4]
const fmt = (b) => (Number.isInteger(b) ? String(b) : Number(b).toFixed(2))

/**
 * The bag's needs, the only stickers on the bag, always in this order: budget (butter), distance
 * (sardine), then zero to two diets (pea). Size sm, 8px apart, fixed tilts. Tapping one opens a
 * small sheet. `over` turns the budget sticker tomato (the last sift came in over budget).
 */
export default function NeedStickers({ budget, radius, diets, over = false, onBudget, onRadius, onDiets, className = '' }) {
  const [editing, setEditing] = useState(null) // 'budget' | 'radius' | 'diet'
  const [draft, setDraft] = useState('')

  const stickers = [
    {
      id: 'budget',
      key: `b${budget}${over}`,
      label: budget == null ? 'No budget. Change budget' : `$${fmt(budget)} budget${over ? ', over budget' : ''}. Change budget`,
      el:
        budget == null ? (
          <Sticker dashed size="sm" tilt={TILTS[0]}>
            No budget
          </Sticker>
        ) : (
          <Sticker color={over ? 'tomato' : 'butter'} size="sm" tilt={TILTS[0]}>
            ${fmt(budget)} budget
          </Sticker>
        ),
    },
    {
      id: 'radius',
      key: `r${radius}`,
      label: `Within ${radius} miles. Change distance`,
      el: (
        <Sticker color="sardine" size="sm" tilt={TILTS[1]}>
          Within {radius} mi
        </Sticker>
      ),
    },
    ...diets.slice(0, MAX_DIETS).map((d, i) => ({
      id: 'diet',
      key: `d${d}`,
      label: `${dietLabel(d)}. Change diet`,
      el: (
        <Sticker color="pea" size="sm" tilt={TILTS[2 + i]}>
          {dietLabel(d)}
        </Sticker>
      ),
    })),
  ]

  const open = (id) => {
    if (id === 'budget') setDraft(budget == null ? '' : fmt(budget))
    setEditing(id)
  }

  return (
    <>
      <div className={`flex flex-wrap items-center gap-x-2 ${className}`}>
        {stickers.map((s) => (
          <button key={s.key} type="button" onClick={() => open(s.id)} aria-label={s.label} className="flex min-h-10 items-center">
            {/* a changed sticker lands again (keyed by its value) */}
            <LandingSticker>{s.el}</LandingSticker>
          </button>
        ))}
      </div>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title="Edit">
        {editing === 'budget' && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const n = Math.round(Number(draft) * 100) / 100
              if (n > 0) onBudget(n)
              setEditing(null)
            }}
          >
            <label className="text-[14px] font-semibold text-ink" htmlFor="need-budget">
              Budget for this bag
            </label>
            <div className="mt-1.5 flex min-h-[52px] items-center rounded-[14px] border-[1.5px] border-ink bg-receipt px-4">
              <span className="font-mono text-[20px] font-bold text-ink">$</span>
              <input
                id="need-budget"
                type="number"
                inputMode="decimal"
                min="1"
                step="any"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="20"
                className="ml-1 w-full bg-transparent font-mono text-[20px] font-bold text-ink placeholder:text-muted focus:outline-none"
              />
            </div>
            <PrimaryButton type="submit" className="mt-4">
              Save
            </PrimaryButton>
            <button
              type="button"
              onClick={() => {
                onBudget(null)
                setEditing(null)
              }}
              className="mt-1 min-h-11 w-full text-[17px] font-semibold text-ink"
            >
              No budget
            </button>
          </form>
        )}

        {editing === 'radius' && (
          <div>
            <h2 className="text-[14px] font-semibold text-ink">How far will you go?</h2>
            <RadiusPills
              value={radius}
              onChange={(r) => {
                onRadius(r)
                setEditing(null)
              }}
              className="mt-2"
            />
          </div>
        )}

        {editing === 'diet' && (
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Diet</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {DIETS.map((d) => {
                const on = diets.includes(d.id)
                return (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onDiets(toggleDiet(diets, d.id))}
                    className={`min-h-11 rounded-[14px] border-[1.5px] border-ink px-4 text-[17px] font-semibold ${on ? 'bg-ink text-eggshell' : 'bg-receipt text-ink'}`}
                  >
                    {d.label}
                  </button>
                )
              })}
            </div>
            <p className="mt-3 text-[13px] text-muted">Noted for later. Results aren't filtered by diet yet.</p>
            <PrimaryButton className="mt-4" onClick={() => setEditing(null)}>
              Done
            </PrimaryButton>
          </div>
        )}
      </Sheet>
    </>
  )
}
