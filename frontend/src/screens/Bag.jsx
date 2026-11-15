import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { parseList } from '../api/client.js'
import { BuddyLine, DemoBadge, PrimaryButton, Pulse, SectionLabel, TornEdge } from '../components/brand.jsx'
import PastBagCard from '../components/PastBagCard.jsx'
import Sticker from '../components/Sticker.jsx'
import Wordmark from '../components/Wordmark.jsx'
import { isDashed, isRankable, itemKey, parseEntry, productItem, shortName, typedItem, voiceItems } from '../lib/bag.js'
import { useBuddy } from '../lib/profile.js'
import { useSpeech } from '../lib/useSpeech.js'

const NEED_TILTS = [-5, 4]
const MAX_QTY = 99

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

// 44px round outline button (confirm / reject)
function RoundButton({ label, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="flex h-11 w-11 shrink-0 items-center justify-center text-ink">
      <span className="flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-ink">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {children}
        </svg>
      </span>
    </button>
  )
}

// 44px hit area, small muted glyph.
function IconButton({ label, onClick, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-11 w-11 shrink-0 items-center justify-center text-[14px] leading-none text-ink disabled:opacity-30"
    >
      {children}
    </button>
  )
}

function Stepper({ item, onChange }) {
  return (
    <div className="flex items-center" role="group" aria-label={`Quantity of ${item.label}`}>
      <IconButton label={`Fewer ${item.label}`} disabled={item.quantity <= 1} onClick={() => onChange(item.quantity - 1)}>
        <span className="flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] border-ink text-[16px]">−</span>
      </IconButton>
      <span className="w-5 text-center text-[16px] font-bold text-ink" aria-live="polite">
        {item.quantity}
      </span>
      <IconButton label={`More ${item.label}`} disabled={item.quantity >= MAX_QTY} onClick={() => onChange(item.quantity + 1)}>
        <span className="flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] border-ink text-[16px]">+</span>
      </IconButton>
    </div>
  )
}

export default function Bag({ bag, setBag, budget, products, pastBags, onLoadPast, onRenamePast, onSift, demo, place, userName }) {
  const buddy = useBuddy()
  const [text, setText] = useState('')
  const [tomLine, setTomLine] = useState(null) // null = the default greeting
  const [parsing, setParsing] = useState(false)
  const greeting = bag.items.length === 0
    ? "Add a few things and I'll start digging."
    : userName
      ? `Hi, ${userName}. What do you need?`
      : 'What do you need?'

  function addItems(rows) {
    setBag((b) => {
      const have = new Set(b.items.map(itemKey))
      const fresh = rows.filter((r) => !have.has(itemKey(r)) && have.add(itemKey(r)))
      return { ...b, items: [...b.items, ...fresh] }
    })
  }

  // Voice: final transcript -> POST /api/parse-list -> editable rows in the bag (the confirm step).
  async function onTranscript(transcript, alternatives = []) {
    setParsing(true)
    try {
      const { data } = await parseList(transcript, alternatives)
      const rows = voiceItems(data)
      addItems(rows)
      if (rows.length) setTomLine('What else do you need?')
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

  function submit(e) {
    e?.preventDefault()
    const parsed = parseEntry(text)
    if (!parsed) return
    if (parsed.kind === 'items') {
      // Typed lists get the same confirm step as speech.
      onTranscript(text.trim())
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
  const setQuantity = (item, quantity) =>
    setBag((b) => ({ ...b, items: b.items.map((i) => (i === item ? { ...i, quantity } : i)) }))
  // Replace a dashed row with a confirmed one; merge with an existing row for the same product.
  const settleRow = (item, next) =>
    setBag((b) => {
      const twin = b.items.find((i) => i !== item && isRankable(i) && itemKey(i) === itemKey(next))
      const items = twin
        ? b.items.filter((i) => i !== item).map((i) => (i === twin ? { ...i, quantity: Math.min(99, i.quantity + next.quantity) } : i))
        : b.items.map((i) => (i === item ? next : i))
      return { ...b, items }
    })
  const confirmRow = (item) => settleRow(item, { label: item.label, rank: item.rank, quantity: item.quantity, status: 'ok' })
  const pickSuggestion = (item, name) => settleRow(item, productItem(name, item.quantity))
  // "Edit" puts what was said back in the input.
  const retype = (item) => {
    removeItem(item)
    setText(item.label)
    setTomLine('Try another word?')
    document.getElementById('bag-input')?.focus()
  }
  const removeNeed = (need) =>
    setBag((b) =>
      need.budget
        ? { ...b, budgetSet: false }
        : { ...b, preferences: b.preferences.filter((x) => x !== need.text) },
    )

  const rankable = bag.items.some(isRankable)
  const pending = bag.items.filter(isDashed).length

  // Need stickers: budget first, then preferences. At most two stickers on the bag.
  const needs = [
    ...(bag.budgetSet ? [{ text: `Under $${budget}`, budget: true }] : []),
    ...bag.preferences.map((p) => ({ text: p })),
  ]
  const shownNeeds = needs.slice(-2)
  const hiddenNeeds = needs.slice(0, -2)

  return (
    <div className="flex min-h-full flex-col">
      <div className="px-5 pb-6 pt-14">
        <header className="flex items-center justify-between gap-3">
          <Wordmark size={34} />
          <span className="flex items-center gap-2">
            <span className="whitespace-nowrap text-[14px] font-semibold text-muted">Near {place}</span>
            {demo && <DemoBadge />}
          </span>
        </header>

        <div className="mt-6">
          <BuddyLine size={64} text={28}>
            {speech.listening ? (
              <Pulse>Listening</Pulse>
            ) : parsing ? (
              <Pulse>Thinking</Pulse>
            ) : pending ? (
              'Check the dashed ones for me.'
            ) : (
              tomLine ?? greeting
            )}
          </BuddyLine>
        </div>

        {/* The bag: kraft card, torn top, square bottom corners */}
        <section aria-label="Your bag" className="mt-6">
          <TornEdge color="var(--kraft)" seed={11} />
          <div className="grain rounded-b-[4px] bg-kraft px-4 pb-2 pt-2">
            <h2 className="text-[14px] font-semibold text-ink">
              Your bag · {bag.items.length} {bag.items.length === 1 ? 'item' : 'items'} · Budget{' '}
              <span className="font-mono font-bold">${budget}</span>
            </h2>

            {shownNeeds.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {shownNeeds.map((need, i) => (
                  <button
                    key={need.text}
                    type="button"
                    onClick={() => removeNeed(need)}
                    aria-label={`Remove need: ${need.text}`}
                    className="flex min-h-[44px] items-center px-1"
                  >
                    <Sticker color={need.budget ? 'clementine' : i === 0 ? 'radish' : 'sardine'} tilt={NEED_TILTS[i]} size="sm">
                      {need.text} ×
                    </Sticker>
                  </button>
                ))}
                {hiddenNeeds.length > 0 && (
                  <span className="text-[13px] font-semibold text-ink">+ {hiddenNeeds.map((n) => n.text).join(', ')}</span>
                )}
              </div>
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
                    className={
                      isDashed(item)
                        ? 'my-1.5 rounded-[4px] border-[1.5px] border-dashed border-muted bg-receipt py-1 pl-3'
                        : 'flex min-h-11 items-center border-b-[1.5px] border-dashed border-line'
                    }
                  >
                    {item.status === 'confirm' ? (
                      <div className="flex items-center">
                        <p className="min-w-0 flex-1 py-1.5 text-[16px] leading-snug text-ink">
                          Did you mean <span className="font-semibold">{item.label}</span>
                          {item.quantity > 1 && ` ×${item.quantity}`}?
                        </p>
                        <RoundButton label={`Yes, ${item.label}`} onClick={() => confirmRow(item)}>
                          <path d="M5 12.5l4.5 4.5L19 7.5" />
                        </RoundButton>
                        <RoundButton label={`No, not ${item.label}`} onClick={() => removeItem(item)}>
                          <path d="M7 7l10 10M17 7L7 17" />
                        </RoundButton>
                      </div>
                    ) : item.status === 'missing' ? (
                      <div>
                        <div className="flex items-center">
                          <p className="min-w-0 flex-1 py-1.5 text-[16px] leading-snug text-ink">
                            Couldn't find <span className="font-semibold">{item.label}</span>.
                          </p>
                          {!item.suggestions?.length && (
                            <button type="button" onClick={() => retype(item)} className="min-h-11 px-2 text-[15px] font-semibold text-ink underline decoration-dashed underline-offset-4">
                              Edit
                            </button>
                          )}
                          <IconButton label={`Remove ${item.label}`} onClick={() => removeItem(item)}>
                            <span className="text-muted">✕</span>
                          </IconButton>
                        </div>
                        {item.suggestions?.length > 0 && (
                          <div className="-mt-1 flex flex-wrap gap-x-2 pb-1">
                            {item.suggestions.map((sg) => (
                              <button
                                key={sg.product_id ?? sg.name}
                                type="button"
                                onClick={() => pickSuggestion(item, sg.name)}
                                aria-label={`Use ${sg.name}`}
                                className="flex min-h-11 items-center"
                              >
                                <span className="flex h-9 items-center rounded-[14px] border-[1.5px] border-ink bg-eggshell px-3 text-[14px] font-semibold text-ink">
                                  {shortName(sg.name)}?
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <span className="min-w-0 flex-1 py-2 text-[17px] leading-tight text-ink first-letter:uppercase">
                          {item.label}
                        </span>
                        <Stepper item={item} onChange={(q) => setQuantity(item, q)} />
                        <IconButton label={`Remove ${item.label}`} onClick={() => removeItem(item)}>
                          <span className="text-muted">✕</span>
                        </IconButton>
                      </>
                    )}
                  </motion.li>
                ))}
              </AnimatePresence>

              {/* Input as the bag's last row. Enter adds. */}
              <li className="relative">
                <form onSubmit={submit} className="flex min-h-11 items-center">
                  <span aria-hidden="true" className="w-5 text-[17px] text-muted">
                    +
                  </span>
                  <label htmlFor="bag-input" className="sr-only">
                    Tell {buddy.name} what you need
                  </label>
                  <input
                    id="bag-input"
                    value={speech.listening ? speech.live : text}
                    onChange={(e) => setText(e.target.value)}
                    readOnly={speech.listening || parsing}
                    placeholder={speech.listening ? '' : `Tell ${buddy.name} what you need`}
                    autoComplete="off"
                    enterKeyHint="done"
                    className={`min-h-11 min-w-0 flex-1 bg-transparent text-[17px] placeholder:text-muted focus:outline-none ${
                      speech.listening ? 'text-muted' : 'text-ink'
                    }`}
                  />
                  {speech.supported && (
                    <button
                      type="button"
                      onClick={speech.listening ? speech.stop : speech.start}
                      disabled={parsing}
                      aria-pressed={speech.listening}
                      aria-label={speech.listening ? 'Stop listening' : 'Speak your list'}
                      className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center text-ink disabled:opacity-40"
                    >
                      <MicIcon listening={speech.listening} />
                    </button>
                  )}
                </form>
                {suggestions.length > 0 && !speech.listening && (
                  <ul className="absolute inset-x-0 top-full z-20 overflow-hidden rounded-[4px] border-[1.5px] border-line bg-receipt">
                    {suggestions.map((p) => (
                      <li key={p.product_id}>
                        <button
                          type="button"
                          className="min-h-11 w-full border-b border-dashed border-line px-4 text-left text-[17px] text-ink last:border-b-0"
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
              </li>
            </ul>
          </div>
        </section>

        {pastBags.length > 0 && (
          <section aria-label="Past bags" className="mt-6">
            <SectionLabel>Past bags</SectionLabel>
            <div className="no-scrollbar -mx-5 mt-1 flex gap-3 overflow-x-auto px-5 pb-1">
              {pastBags.map((pb) => (
                <PastBagCard key={pb.at} pb={pb} onOpen={() => onLoadPast(pb)} onRename={(name) => onRenamePast(pb.at, name)} />
              ))}
              <span aria-hidden="true" className="w-2 shrink-0" />
            </div>
          </section>
        )}
      </div>

      {/* Primary action at the bottom, 16px above the tab bar */}
      <div className="sticky bottom-0 z-10 mt-auto bg-eggshell px-5 pb-4 pt-3">
        <PrimaryButton disabled={!rankable || pending > 0 || speech.listening || parsing} onClick={onSift}>
          Sift my list
        </PrimaryButton>
        {pending > 0 && (
          <p className="mt-1.5 text-center text-[13px] text-muted">
            Confirm {pending} {pending === 1 ? 'item' : 'items'} first
          </p>
        )}
      </div>
    </div>
  )
}
