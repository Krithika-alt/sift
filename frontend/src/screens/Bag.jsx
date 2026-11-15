import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BuddyLine, DemoBadge, PrimaryButton, Pulse, Sticker, TornEdge, Wordmark } from '../components/brand.jsx'
import { DEFAULT_BUDGET, DEFAULT_LOCATION } from '../config.js'
import { parseList } from '../api/client.js'
import { itemKey, parseEntry, toItem, typedItem, voiceItems } from '../lib/bag.js'
import { useSpeech } from '../lib/useSpeech.js'

const NEED_TILTS = [-5, 4]


function MicIcon({ listening }) {
  return listening ? (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="6.5" y="6.5" width="11" height="11" rx="2.5" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </svg>
  )
}

const orList = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}` : xs[0])

export default function Bag({ bag, setBag, products, pastBags, onLoadPast, onSift, demo }) {
  const [text, setText] = useState('')
  const [tomLine, setTomLine] = useState('What do you need?')
  const [parsing, setParsing] = useState(false)

  // Voice: final transcript -> POST /api/parse-list -> rows in the bag.
  async function onTranscript(transcript) {
    setParsing(true)
    try {
      const { data } = await parseList(transcript)
      const rows = voiceItems(data)
      addItems(rows)
      const missing = rows.filter((r) => r.notFound).map((r) => r.label)
      if (missing.length) setTomLine(`I couldn't find ${orList(missing)}. Try another word?`)
      else if (rows.length) setTomLine('What else do you need?')
      else setTomLine("I didn't catch a list. Try again?")
    } catch {
      setTomLine("I didn't catch that. Try typing it?")
    } finally {
      setParsing(false)
    }
  }
  const speech = useSpeech(onTranscript)

  const suggestions = useMemo(() => {
    const q = text.trim().toLowerCase()
    if (q.length < 2 || q.split(/\s+/).length > 3) return []
    const have = new Set(bag.items.map((i) => i.label.toLowerCase()))
    return products.filter((p) => p.name.toLowerCase().includes(q) && !have.has(p.name.toLowerCase())).slice(0, 4)
  }, [text, products, bag.items])

  function addItems(rows) {
    setBag((b) => {
      const have = new Set(b.items.map(itemKey))
      const fresh = rows.filter((r) => !have.has(itemKey(r)) && have.add(itemKey(r)))
      return { ...b, items: [...b.items, ...fresh] }
    })
  }

  function submit(e) {
    e?.preventDefault()
    const parsed = parseEntry(text)
    if (!parsed) return
    if (parsed.kind === 'items') {
      addItems(parsed.items.map(typedItem))
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
  // Tap a NOT FOUND row to retype it: its text goes back into the input.
  const retype = (item) => {
    removeItem(item)
    setText(item.label)
    setTomLine('Try another word?')
    document.getElementById('bag-input')?.focus()
  }
  const rankable = bag.items.some((i) => i.rank)
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
        <BuddyLine>
          {speech.listening ? <Pulse>Listening</Pulse> : parsing ? <Pulse>Thinking</Pulse> : tomLine}
        </BuddyLine>
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
                  key={itemKey(item)}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  className="flex items-center justify-between border-b-[1.5px] border-dashed border-line last:border-b-0"
                >
                  {item.notFound ? (
                    <button
                      type="button"
                      onClick={() => retype(item)}
                      aria-label={`${item.label}, not found. Tap to retype.`}
                      className="flex min-h-[44px] min-w-0 items-center gap-2 text-left"
                    >
                      <span className="truncate text-[17px] text-ink underline decoration-dashed underline-offset-4 first-letter:uppercase">
                        {item.label}
                      </span>
                      <Sticker dashed tilt={-3} size="sm" className="shrink-0">
                        Not found
                      </Sticker>
                    </button>
                  ) : (
                    <span className="flex min-w-0 items-center gap-2 py-2">
                      <span className="truncate text-[17px] text-ink first-letter:uppercase">{item.label}</span>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeItem(item)}
                    aria-label={`Remove ${item.label}`}
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
          <div className="relative flex-1">
            <input
              id="bag-input"
              value={speech.listening ? speech.live : text}
              onChange={(e) => setText(e.target.value)}
              readOnly={speech.listening || parsing}
              placeholder={speech.listening ? '' : 'Tell Tom what you need'}
              autoComplete="off"
              enterKeyHint="done"
              className={`min-h-[52px] w-full rounded-2xl border-[1.5px] border-line bg-receipt px-4 text-[17px] placeholder:text-muted focus:border-ink focus:outline-none ${
                speech.listening ? 'text-muted' : 'text-ink'
              } ${speech.supported ? 'pr-12' : ''}`}
            />
            {speech.supported && (
              <button
                type="button"
                onClick={speech.listening ? speech.stop : speech.start}
                disabled={parsing}
                aria-pressed={speech.listening}
                aria-label={speech.listening ? 'Stop listening' : 'Speak your list'}
                className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-ink disabled:opacity-40"
              >
                <MicIcon listening={speech.listening} />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={!text.trim() || speech.listening}
            className="min-h-[52px] rounded-2xl border-[1.5px] border-ink px-4 text-[17px] font-semibold text-ink disabled:opacity-40"
          >
            Add
          </button>
        </div>
        {suggestions.length > 0 && !speech.listening && (
          <ul className="absolute inset-x-0 top-[58px] z-20 overflow-hidden rounded-2xl border-[1.5px] border-line bg-receipt">
            {suggestions.map((p) => (
              <li key={p.product_id}>
                <button
                  type="button"
                  className="min-h-[44px] w-full border-b border-dashed border-line px-4 text-left text-[16px] text-ink last:border-b-0"
                  onClick={() => {
                    addItems([typedItem(p.name)])
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

      <PrimaryButton className="mt-5" disabled={!rankable || speech.listening || parsing} onClick={onSift}>
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
                <span className="block max-w-[150px] truncate text-[14px] text-muted">{pb.items.map((i) => toItem(i).label).join(', ')}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
