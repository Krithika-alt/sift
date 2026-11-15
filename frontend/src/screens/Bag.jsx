import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BuddyLine, DemoBadge, PrimaryButton, Sticker, TornEdge, Wordmark } from '../components/brand.jsx'
import { DEFAULT_BUDGET, DEFAULT_LOCATION } from '../config.js'
import { parseEntry } from '../lib/bag.js'

const NEED_TILTS = [-5, 4]

export default function Bag({ bag, setBag, products, pastBags, onLoadPast, onSift, demo }) {
  const [text, setText] = useState('')
  const [tomLine, setTomLine] = useState('What do you need?')

  const suggestions = useMemo(() => {
    const q = text.trim().toLowerCase()
    if (q.length < 2 || q.split(/\s+/).length > 3) return []
    const have = new Set(bag.items.map((i) => i.toLowerCase()))
    return products.filter((p) => p.name.toLowerCase().includes(q) && !have.has(p.name.toLowerCase())).slice(0, 4)
  }, [text, products, bag.items])

  function addItems(items) {
    setBag((b) => {
      const have = new Set(b.items.map((i) => i.toLowerCase()))
      const fresh = items.filter((i) => !have.has(i.toLowerCase()))
      return { ...b, items: [...b.items, ...fresh] }
    })
  }

  function submit(e) {
    e?.preventDefault()
    const parsed = parseEntry(text)
    if (!parsed) return
    if (parsed.kind === 'items') {
      addItems(parsed.items)
      setTomLine('What else do you need?')
    } else if (parsed.kind === 'budget') {
      setBag((b) => ({ ...b, budget: parsed.budget, budgetSet: true }))
      setTomLine("Noted. I'll keep that in mind.")
    } else {
      setBag((b) =>
        b.preferences.includes(parsed.preference) ? b : { ...b, preferences: [...b.preferences, parsed.preference] },
      )
      setTomLine("Noted. I'll keep that in mind.")
    }
    setText('')
  }

  const removeItem = (item) => setBag((b) => ({ ...b, items: b.items.filter((i) => i !== item) }))
  const removeNeed = (need) =>
    setBag((b) =>
      need.budget
        ? { ...b, budget: DEFAULT_BUDGET, budgetSet: false }
        : { ...b, preferences: b.preferences.filter((x) => x !== need.text) },
    )

  // Need stickers: budget first, then preferences. At most two stickers per card.
  const needs = [
    ...(bag.budgetSet ? [{ text: `Under $${bag.budget}`, budget: true }] : []),
    ...bag.preferences.map((p) => ({ text: p })),
  ]
  const shownNeeds = needs.slice(-2)
  const hiddenNeeds = needs.slice(0, -2)

  return (
    <div className="flex min-h-full flex-col px-4 pb-8 pt-[calc(14px+env(safe-area-inset-top))]">
      <header className="flex items-center justify-between">
        <div className="flex flex-col">
          <Wordmark size={36} />
          <span className="label mt-1 text-[11px] text-muted">Near {DEFAULT_LOCATION.label}</span>
        </div>
        {demo && <DemoBadge />}
      </header>

      <div className="mt-6">
        <BuddyLine>{tomLine}</BuddyLine>
      </div>

      {/* The bag: kraft card, torn top */}
      <section aria-label="Your bag" className="mt-5">
        <TornEdge color="var(--kraft)" seed={11} />
        <div className="grain rounded-b-2xl bg-kraft px-4 pb-4 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="label text-ink">
              Your bag · {bag.items.length} {bag.items.length === 1 ? 'item' : 'items'} · Budget ${bag.budget}
            </h2>
          </div>

          {shownNeeds.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {shownNeeds.map((need, i) => (
                <button
                  key={need.text}
                  type="button"
                  onClick={() => removeNeed(need)}
                  aria-label={`Remove need: ${need.text}`}
                  className="min-h-[44px] px-1"
                >
                  <Sticker color={need.budget ? 'clementine' : i === 0 ? 'radish' : 'sardine'} tilt={NEED_TILTS[i]}>
                    {need.text} ×
                  </Sticker>
                </button>
              ))}
            </div>
          )}
          {hiddenNeeds.length > 0 && (
            <p className="label mt-1 text-[10px] tracking-[1.5px] text-ink">
              Also: {hiddenNeeds.map((n) => n.text).join(', ')}
            </p>
          )}

          <ul className="mt-2">
            <AnimatePresence initial={false}>
              {bag.items.map((item) => (
                <motion.li
                  key={item}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  className="flex items-center justify-between border-b-[1.5px] border-dashed border-line last:border-b-0"
                >
                  <span className="py-2 text-[17px] capitalize text-ink">{item}</span>
                  <button
                    type="button"
                    onClick={() => removeItem(item)}
                    aria-label={`Remove ${item}`}
                    className="flex h-11 w-11 items-center justify-center text-[22px] leading-none text-ink"
                  >
                    ×
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {bag.items.length === 0 && <p className="py-3 text-[15px] text-ink">Your bag is empty.</p>}
        </div>
      </section>

      {/* Single input */}
      <form onSubmit={submit} className="relative mt-4">
        <label htmlFor="bag-input" className="sr-only">
          Tell Tom what you need
        </label>
        <div className="flex gap-2">
          <input
            id="bag-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tell Tom what you need"
            autoComplete="off"
            enterKeyHint="done"
            className="min-h-[52px] flex-1 rounded-2xl border-[1.5px] border-line bg-receipt px-4 text-[17px] text-ink placeholder:text-muted focus:border-ink focus:outline-none"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="min-h-[52px] rounded-2xl border-[1.5px] border-ink px-4 text-[17px] font-semibold text-ink disabled:opacity-40"
          >
            Add
          </button>
        </div>
        {suggestions.length > 0 && (
          <ul className="absolute inset-x-0 top-[58px] z-20 overflow-hidden rounded-2xl border-[1.5px] border-line bg-receipt">
            {suggestions.map((p) => (
              <li key={p.product_id}>
                <button
                  type="button"
                  className="min-h-[44px] w-full border-b border-dashed border-line px-4 text-left text-[16px] text-ink last:border-b-0"
                  onClick={() => {
                    addItems([p.name])
                    setText('')
                    setTomLine('What else do you need?')
                  }}
                >
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>

      <PrimaryButton className="mt-5" disabled={bag.items.length === 0} onClick={onSift}>
        Sift my list
      </PrimaryButton>

      {pastBags.length > 0 && (
        <section aria-label="Past bags" className="mt-6">
          <h3 className="label text-[11px] text-muted">Past bags</h3>
          <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
            {pastBags.map((pb) => (
              <button
                key={pb.at}
                type="button"
                onClick={() => onLoadPast(pb)}
                className="min-h-[44px] shrink-0 rounded-xl border-[1.5px] border-dashed border-line bg-receipt px-3 py-2 text-left"
              >
                <span className="block font-mono text-[12px] font-bold uppercase tracking-[1.5px] text-ink">
                  {pb.items.length} items · ${pb.budget}
                </span>
                <span className="block max-w-[150px] truncate text-[14px] text-muted">{pb.items.join(', ')}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
