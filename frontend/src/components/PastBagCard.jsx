import { useEffect, useRef, useState } from 'react'
import { wash } from './brand.jsx'
import Sticker from './Sticker.jsx'
import { autoName, toItem } from '../lib/bag.js'
import { money, storeColor } from '../lib/stores.js'

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />
    </svg>
  )
}

// Each card gets its own pop color at 22%, rotating through these.
const TONES = ['pea', 'butter', 'sardine', 'radish', 'clementine']

/**
 * Past bag card on a pop-color wash: name (Karla 700 16), item count (Karla 13 muted), the winning
 * store's round sticker and a butter SAVED sticker overlapping the top-right corner (10px max).
 * Tap loads it; the pencil renames inline.
 */
export default function PastBagCard({ pb, index = 0, onOpen, onRename, onRemove, width = 156 }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const input = useRef(null)
  const items = pb.items.map(toItem)
  const name = pb.name || autoName(items)

  useEffect(() => {
    if (editing) input.current?.focus()
  }, [editing])

  const commit = () => {
    onRename(draft)
    setEditing(false)
  }

  return (
    <div className="relative shrink-0 pt-2.5" style={{ width }}>
      {pb.winner && (
        <span className="pointer-events-none absolute -right-2 top-0 z-10 flex items-center">
          <Sticker shape="round" size="sm" color={storeColor(pb.winner.store_id)} tilt={-7}>
            1
          </Sticker>
          {pb.winner.saved > 0.005 && (
            <Sticker color="butter" size="sm" tilt={5} style={{ marginLeft: -6 }}>
              Saved {money(pb.winner.saved)}
            </Sticker>
          )}
        </span>
      )}
      <div className="grain relative flex min-h-[112px] flex-col rounded-[4px] p-4" style={{ background: wash(TONES[index % TONES.length], 22, 'var(--eggshell)') }}>
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              commit()
            }}
          >
            <label className="sr-only" htmlFor={`rename-${pb.at}`}>
              Bag name
            </label>
            <input
              id={`rename-${pb.at}`}
              ref={input}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              maxLength={32}
              className="min-h-11 w-full rounded-[4px] border-[1.5px] border-ink bg-receipt px-2 text-[16px] font-bold text-ink focus:outline-none"
            />
          </form>
        ) : (
          <>
            {/* the whole card loads the bag */}
            <button type="button" onClick={onOpen} className="absolute inset-0" aria-label={`Load ${name}, ${items.length} items`} />
            <span className="pointer-events-none mt-2 line-clamp-2 pr-6 text-[16px] font-bold leading-tight text-ink">{name}</span>
          </>
        )}
        <span className="pointer-events-none mt-auto pt-2 text-[13px] text-muted">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
        {!editing && (
          <span className="absolute bottom-0 right-0 flex">
            {onRemove && (
              <button type="button" onClick={onRemove} className="min-h-11 px-2 text-[13px] font-semibold text-ink underline decoration-dashed underline-offset-4">
                Remove
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setDraft(name)
                setEditing(true)
              }}
              aria-label={`Rename ${name}`}
              className="flex h-11 w-11 items-center justify-center text-ink"
            >
              <PencilIcon />
            </button>
          </span>
        )}
      </div>
    </div>
  )
}
