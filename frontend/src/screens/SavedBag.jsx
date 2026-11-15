import { useEffect, useRef, useState } from 'react'
import BagItems from '../components/BagItems.jsx'
import { BackButton, PrimaryButton, SecondaryButton } from '../components/brand.jsx'
import NeedStickers from '../components/NeedStickers.jsx'
import Sheet from '../components/Sheet.jsx'
import { autoName, isDashed, isRankable, toItem } from '../lib/bag.js'
import { applyNeeds, bagBudget, bagDiets } from '../lib/needs.js'
import { useBuddy } from '../lib/profile.js'

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />
    </svg>
  )
}

/**
 * One saved bag, opened from Saved (pushed, not the Bag tab). The name is an editable title;
 * the items are bag rows with steppers, remove and an add row. Every edit saves automatically.
 */
export default function SavedBag({ pb, products, profile, radius, onRadius, onBack, onChange, onRename, onSift, onUse, onDelete }) {
  const buddy = useBuddy()
  const [draft, setDraft] = useState(() => ({ ...pb, items: pb.items.map(toItem), preferences: pb.preferences ?? [] }))
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(pb.name)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const first = useRef(true)

  // Edits save automatically.
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    onChange({ items: draft.items, budget: draft.budget, budgetSet: draft.budgetSet, preferences: draft.preferences, dietSet: draft.dietSet })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  const shownName = pb.renamed ? pb.name : draft.items.length ? autoName(draft.items) : pb.name
  const rankable = draft.items.some(isRankable)
  const pending = draft.items.filter(isDashed).length
  const commitName = () => {
    onRename(name)
    setEditingName(false)
  }

  return (
    <div className="flex min-h-full flex-col px-5 pb-6 pt-14">
      <header className="flex h-11 items-center">
        <BackButton onClick={onBack} label="Back to saved bags" />
      </header>

      <div className="mt-2">
        {editingName ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              commitName()
            }}
          >
            <label htmlFor="saved-name" className="sr-only">
              Bag name
            </label>
            <input
              id="saved-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitName}
              maxLength={32}
              className="w-full border-b border-ink bg-transparent font-display text-[28px] leading-tight text-ink focus:outline-none"
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setName(shownName)
              setEditingName(true)
            }}
            aria-label={`Rename ${shownName}`}
            className="flex min-h-11 items-center gap-2 text-left"
          >
            <h1 className="font-display text-[28px] leading-tight text-ink">{shownName}</h1>
            <span className="text-muted">
              <PencilIcon />
            </span>
          </button>
        )}
        <p className="text-[13px] text-muted">
          {draft.items.length} {draft.items.length === 1 ? 'item' : 'items'} · saves as you edit
        </p>
        {/* the same needs row as the Bag */}
        <NeedStickers
          budget={bagBudget(draft, profile)}
          radius={radius}
          diets={bagDiets(draft, profile)}
          onBudget={(b) => setDraft((d) => ({ ...d, budget: b, budgetSet: true }))}
          onRadius={onRadius}
          onDiets={(list) => setDraft((d) => ({ ...d, preferences: list, dietSet: true }))}
          className="mt-1"
        />
      </div>

      <section aria-label={`Items in ${shownName}`} className="mt-6 rounded-[4px] border border-hair bg-receipt px-4 py-1">
        <BagItems
          bag={draft}
          setBag={setDraft}
          products={products}
          inputId="saved-bag-input"
          placeholder="Add something"
          onNeeds={(n) => {
            setDraft((d) => applyNeeds(d, n, bagDiets(d, profile)))
            if (n.radius) onRadius(n.radius)
          }}
        />
      </section>

      <div className="mt-6 space-y-3">
        <PrimaryButton disabled={!rankable || pending > 0} onClick={() => onSift(draft)}>
          Sift this bag
        </PrimaryButton>
        <SecondaryButton disabled={!draft.items.length} onClick={() => onUse(draft)}>
          Use as my bag
        </SecondaryButton>
        {pending > 0 && (
          <p className="text-center text-[13px] text-muted">
            Confirm {pending} {pending === 1 ? 'item' : 'items'} first
          </p>
        )}
      </div>

      <button type="button" onClick={() => setConfirmDelete(true)} className="mx-auto mt-6 min-h-11 px-4 text-[15px] font-semibold text-ink">
        Delete bag
      </button>

      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this bag?">
        <h2 className="font-display text-[24px] text-ink">Delete this bag?</h2>
        <p className="mt-1 text-[17px] text-ink">
          {shownName} goes away for good. {buddy.name} won't mind.
        </p>
        <PrimaryButton className="mt-5" onClick={() => onDelete(pb.at)}>
          Delete
        </PrimaryButton>
        <button type="button" onClick={() => setConfirmDelete(false)} className="mt-1 min-h-11 w-full text-[17px] font-semibold text-ink">
          Keep it
        </button>
      </Sheet>
    </div>
  )
}
