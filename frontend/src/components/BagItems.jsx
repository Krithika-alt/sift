import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { parseList } from '../api/client.js'
import Sticker from './Sticker.jsx'
import { isRankable, itemKey, isDashed, mergeRows, parseEntry, productItem, shortName, typedItem, voiceItems } from '../lib/bag.js'
import { needsLine, parseNeeds } from '../lib/needs.js'
import { useSpeech } from '../lib/useSpeech.js'

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
    <button type="button" onClick={onClick} aria-label={label} className="flex h-11 w-11 shrink-0 items-center justify-center text-ink active:scale-[0.98]">
      <span className="flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-ink">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {children}
        </svg>
      </span>
    </button>
  )
}

// 44px hit area, small muted glyph.
export function IconButton({ label, onClick, disabled, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`flex h-11 w-11 shrink-0 items-center justify-center text-[14px] leading-none text-ink active:scale-[0.98] disabled:opacity-30 ${className}`}
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
      {/* more than one: the number sits in a small butter round sticker */}
      <span className="flex w-7 justify-center text-[16px] font-bold text-ink" aria-live="polite">
        {item.quantity > 1 ? (
          <Sticker shape="round" size="sm" color="butter" tilt={-5}>
            {item.quantity}
          </Sticker>
        ) : (
          item.quantity
        )}
      </span>
      <IconButton label={`More ${item.label}`} disabled={item.quantity >= MAX_QTY} onClick={() => onChange(item.quantity + 1)}>
        <span className="flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] border-ink text-[16px]">+</span>
      </IconButton>
    </div>
  )
}

/**
 * The bag's rows plus the add row (typing, autocomplete and the mic), shared by the Bag and the
 * Saved Bag screen. Typed lists and speech go through POST /api/parse-list; dashed rows ask to
 * confirm. Sentences of needs ("under $15", "walking distance", "I'm vegan") are matched first and
 * go to onNeeds. onLine(text) lets the screen's buddy speak; onStatus({listening, parsing}).
 */
export default function BagItems({ bag, setBag, products, inputId = 'bag-input', placeholder, onLine = () => {}, onNeeds, onStatus }) {
  const [text, setText] = useState('')
  const [parsing, setParsing] = useState(false)

  function addItems(rows) {
    setBag((b) => ({ ...b, items: mergeRows(b.items, rows) }))
  }

  // Voice: final transcript -> POST /api/parse-list -> editable rows in the bag (the confirm step).
  async function onTranscript(transcript, alternatives = []) {
    if (takeNeeds(transcript)) return
    setParsing(true)
    try {
      const { data } = await parseList(transcript, alternatives)
      const rows = voiceItems(data)
      addItems(rows)
      onLine(rows.length ? 'What else do you need?' : "I didn't catch a list. Try again?")
    } catch {
      onLine("I didn't catch that. Try typing it?")
    } finally {
      setParsing(false)
    }
  }
  const speech = useSpeech(onTranscript)
  useEffect(() => {
    onStatus?.({ listening: speech.listening, parsing })
  }, [speech.listening, parsing, onStatus])

  const suggestions = useMemo(() => {
    const q = text.trim().toLowerCase()
    if (q.length < 2 || q.split(/\s+/).length > 3) return []
    const have = new Set(bag.items.map((i) => i.label.toLowerCase()))
    return products.filter((p) => p.name.toLowerCase().includes(q) && !have.has(p.name.toLowerCase())).slice(0, 4)
  }, [text, products, bag.items])

  // Budget, distance and diet sentences set the bag's stickers; the buddy confirms in one line.
  function takeNeeds(said) {
    const needs = onNeeds && parseNeeds(said)
    if (!needs) return false
    onNeeds(needs)
    onLine(needsLine(needs))
    return true
  }

  function submit(e) {
    e?.preventDefault()
    if (takeNeeds(text)) return setText('')
    const parsed = parseEntry(text)
    if (!parsed) return
    if (parsed.kind === 'items') {
      // Typed lists get the same confirm step as speech.
      onTranscript(text.trim())
    } else {
      onLine("I can't sort by that yet. Try a budget, a distance or a diet.")
    }
    setText('')
  }

  const removeItem = (item) => setBag((b) => ({ ...b, items: b.items.filter((i) => i !== item) }))
  const setQuantity = (item, quantity) => setBag((b) => ({ ...b, items: b.items.map((i) => (i === item ? { ...i, quantity } : i)) }))
  // Replace a dashed row with a confirmed one; merge with an existing row for the same product.
  const settleRow = (item, next) =>
    setBag((b) => {
      const twin = b.items.find((i) => i !== item && isRankable(i) && itemKey(i) === itemKey(next))
      const items = twin
        ? b.items.filter((i) => i !== item).map((i) => (i === twin ? { ...i, quantity: Math.min(99, i.quantity + next.quantity) } : i))
        : b.items.map((i) => (i === item ? next : i))
      return { ...b, items }
    })
  const confirmRow = (item) => settleRow(item, { label: item.label, rank: item.rank, quantity: item.quantity, status: 'ok', product_id: item.product_id })
  const pickSuggestion = (item, name) => settleRow(item, productItem(name, item.quantity))
  // "Edit" puts what was said back in the input.
  const retype = (item) => {
    removeItem(item)
    setText(item.label)
    onLine('Try another word?')
    document.getElementById(inputId)?.focus()
  }

  return (
    <ul>
      <AnimatePresence initial={false}>
        {bag.items.map((item, i) => (
          <motion.li
            key={itemKey(item)}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1], delay: Math.min(i, 8) * 0.04 } }}
            exit={{ opacity: 0, transition: { duration: 0.16 } }}
            className={
              isDashed(item)
                ? 'my-1.5 rounded-[4px] border-[1.5px] border-dashed border-muted bg-receipt py-1 pl-3'
                : 'flex min-h-11 items-center border-b border-hair'
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
                    <button type="button" onClick={() => retype(item)} className="min-h-11 px-2 text-[15px] font-semibold text-ink underline underline-offset-4">
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
                        className="flex min-h-11 items-center active:scale-[0.98]"
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
                <span className="min-w-0 flex-1 py-2 text-[17px] leading-tight text-ink first-letter:uppercase">{item.label}</span>
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
          <label htmlFor={inputId} className="sr-only">
            {placeholder}
          </label>
          <input
            id={inputId}
            value={speech.listening ? speech.live : text}
            onChange={(e) => setText(e.target.value)}
            readOnly={speech.listening || parsing}
            placeholder={speech.listening ? '' : placeholder}
            autoComplete="off"
            enterKeyHint="done"
            className={`min-h-11 min-w-0 flex-1 bg-transparent text-[17px] placeholder:text-muted focus:outline-none ${speech.listening ? 'text-muted' : 'text-ink'}`}
          />
          {speech.supported && (
            <button
              type="button"
              onClick={speech.listening ? speech.stop : speech.start}
              disabled={parsing}
              aria-pressed={speech.listening}
              aria-label={speech.listening ? 'Stop listening' : 'Speak your list'}
              className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center text-ink active:scale-[0.98] disabled:opacity-40"
            >
              <MicIcon listening={speech.listening} />
            </button>
          )}
        </form>
        {suggestions.length > 0 && !speech.listening && (
          <ul className="absolute inset-x-0 top-full z-20 overflow-hidden rounded-[4px] border border-hair bg-receipt">
            {suggestions.map((p) => (
              <li key={p.product_id}>
                <button
                  type="button"
                  className="min-h-11 w-full border-b border-hair px-4 text-left text-[17px] text-ink last:border-b-0"
                  onClick={() => {
                    addItems([typedItem(p.name)])
                    setText('')
                    onLine('What else do you need?')
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
  )
}
