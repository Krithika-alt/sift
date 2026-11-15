import { useEffect, useState } from 'react'
import Sheet from '../components/Sheet.jsx'
import Sticker from '../components/Sticker.jsx'
import { MyBuddy, PrimaryButton, Pulse } from '../components/brand.jsx'
import { useBuddy } from '../lib/profile.js'
import { storeColor } from '../lib/stores.js'

/**
 * Short chip labels; the full question with real names goes to /api/ask-agent.
 * dot: the store's color for store questions, pea for swaps, butter for protein.
 */
export const askChips = (best) => {
  const store = best?.name ?? 'this store'
  return [
    { label: 'Why this store?', question: `Why did ${store} win?`, dot: best ? storeColor(best.store_id) : 'pea' },
    { label: 'Cheaper swap?', question: `What can I swap to save money at ${store}?`, dot: 'pea' },
    { label: 'Protein per $?', question: 'Which store has the cheapest protein per dollar?', dot: 'butter' },
  ]
}

// Headlines up to this many characters are handwritten (Darumadrop 24); longer ones are Karla 700 18.
const HANDWRITTEN_MAX = 60

// If the answer starts with the same sentence as the headline, don't say it twice.
function answerBody(answer = '', headline = '') {
  const first = answer.split(/(?<=\.)\s+/)[0] ?? ''
  const norm = (t) => t.trim().replace(/\.$/, '')
  return norm(first) === norm(headline) ? answer.slice(first.length).trim() : answer
}

/**
 * Ask [buddy]: POST /api/ask-agent with the full last rank-stores response. Closing while it's
 * thinking is fine; the answer is here when the sheet opens again.
 * ask = { question, status: 'loading' | 'done' | 'error', data }
 */
export default function AskTomSheet({ open, ask, onClose, onRetry }) {
  const buddy = useBuddy()
  const [showFacts, setShowFacts] = useState(false)
  useEffect(() => setShowFacts(false), [ask?.question])
  const data = ask?.data
  const body = data ? answerBody(data.answer, data.headline) : ''

  return (
    <Sheet open={open} onClose={onClose} title={`Ask ${buddy.name}`}>
      {/* the question: Karla 600 15; the 44px close button centers on its first line */}
      <div className="flex items-start justify-between gap-2">
        <h2 className="pt-[11px] text-[15px] font-semibold leading-[22px] text-ink">{ask?.question}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center text-[22px] text-ink">
          ✕
        </button>
      </div>

      <div aria-live="polite" className="mt-2 pb-2">
        {ask?.status === 'loading' && (
          <div className="flex items-center gap-3 py-6">
            <MyBuddy size={64} />
            <p className="font-display text-[28px] text-ink">
              <Pulse>Thinking</Pulse>
            </p>
          </div>
        )}

        {ask?.status === 'error' && (
          <div className="py-4">
            <div className="flex items-center gap-3">
              <MyBuddy size={60} />
              <p className="font-display text-[24px] leading-tight text-ink">I couldn't get an answer just now.</p>
            </div>
            <p className="mt-3 text-[17px] text-ink">The shelves are slow to answer. Try again in a moment.</p>
            <PrimaryButton className="mt-5" onClick={onRetry}>
              Try again
            </PrimaryButton>
          </div>
        )}

        {ask?.status === 'done' && data && (
          <div>
            <div className="flex items-start gap-3">
              <MyBuddy size={56} style={{ marginTop: 2 }} />
              {/* wraps, never truncated. Darumadrop only for short lines; long ones read better in Karla. */}
              {String(data.headline ?? '').length <= HANDWRITTEN_MAX ? (
                <p className="min-w-0 font-display text-[24px] leading-[1.2] text-ink">{data.headline}</p>
              ) : (
                <p className="min-w-0 pt-1 text-[18px] font-bold leading-[1.35] text-ink">{data.headline}</p>
              )}
            </div>
            {body && <p className="mt-4 text-[17px] leading-[1.5] text-ink">{body}</p>}

            <div className="mt-4">
              {data.source === 'genie' && data.verified ? (
                <Sticker color="olive" size="sm" tilt={-4}>
                  Checked against prices
                </Sticker>
              ) : data.source === 'grounded' || data.source === 'demo' ? (
                <p className="text-[13px] text-ink">Answered from our price tables</p>
              ) : null}
              {data.note && <p className="mt-2 text-[12px] text-ink">{data.note}</p>}
            </div>

            {data.facts_used?.length > 0 && (
              <div className="mt-3">
                <button
                  type="button"
                  aria-expanded={showFacts}
                  onClick={() => setShowFacts((v) => !v)}
                  className="-ml-1 min-h-11 px-1 text-[14px] font-semibold text-ink underline underline-offset-4"
                >
                  {showFacts ? 'Hide the numbers' : 'Show the numbers'}
                </button>
                {showFacts && (
                  <ul className="mt-1 rounded-[4px] bg-receipt px-4 py-2 font-mono">
                    {data.facts_used.map((f, i) => (
                      <li key={i} className="border-b border-hair py-1.5 text-[12px] leading-snug text-ink last:border-b-0">
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Sheet>
  )
}
