import Sheet from '../components/Sheet.jsx'
import { PrimaryButton, Pulse, Tom } from '../components/brand.jsx'

// Short chip labels; the full question goes to /api/ask-agent.
export const ASK_CHIPS = [
  { label: 'Why this store?', question: 'Why this store?' },
  { label: 'Cheaper swap?', question: 'Cheaper swap?' },
  { label: 'Protein per $?', question: 'Protein per dollar?' },
]

// Headlines that fit Tom's two lines in Darumadrop.
const SHORT_HEADLINE = 70

// The grounded headline is usually the answer's first sentence; don't say it twice when it is
// short. A long headline is clamped, so the full answer stays below it.
function bodyAfterHeadline(answer = '', headline = '') {
  const h = headline.trim().replace(/\.$/, '')
  if (h && h.length <= SHORT_HEADLINE && answer.startsWith(h)) {
    return answer.slice(h.length).replace(/^[.:;\s]+/, '').trim()
  }
  return answer
}

/**
 * Ask Tom: POST /api/ask-agent. Closing while Tom is thinking is fine; the request keeps
 * running and the answer is here when the sheet opens again.
 * ask = { question, status: 'loading' | 'done' | 'error', data }
 */
export default function AskTomSheet({ open, ask, onClose, onRetry }) {
  const data = ask?.data
  const rest = data ? bodyAfterHeadline(data.answer, data.headline) : ''

  return (
    <Sheet open={open} onClose={onClose} title="Ask Tom">
      <div className="flex items-center justify-between">
        <h2 className="label text-ink">{ask?.question}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-2 flex h-11 w-11 items-center justify-center text-[24px] text-ink"
        >
          ×
        </button>
      </div>

      <div aria-live="polite" className="mt-2 pb-2">
        {ask?.status === 'loading' && (
          <div className="flex items-center gap-3 py-6">
            <Tom size={64} />
            <p className="font-display text-[26px] text-ink">
              <Pulse>Thinking</Pulse>
            </p>
          </div>
        )}

        {ask?.status === 'error' && (
          <div className="py-4">
            <div className="flex items-center gap-3">
              <Tom size={60} />
              <p className="font-display text-[24px] leading-tight text-ink">I couldn't get an answer just now.</p>
            </div>
            <p className="mt-3 text-[16px] text-ink">The shelves are slow to answer. Try again in a moment.</p>
            <PrimaryButton className="mt-5" onClick={onRetry}>
              Try again
            </PrimaryButton>
          </div>
        )}

        {ask?.status === 'done' && data && (
          <div>
            <div className="flex items-start gap-3">
              <Tom size={56} className="mt-1" />
              <p className="line-clamp-2 font-display text-[22px] leading-[1.2] text-ink">{data.headline}</p>
            </div>
            {rest && <p className="mt-4 text-[16px] leading-relaxed text-ink">{rest}</p>}

            <div className="mt-5 rounded-[4px] bg-receipt px-4 py-3 font-mono">
              {data.facts_used?.length > 0 && (
                <ul className="mb-3">
                  {data.facts_used.map((f, i) => (
                    <li
                      key={i}
                      className="border-b-[1.5px] border-dashed border-line py-1.5 text-[12px] uppercase leading-snug tracking-[0.5px] text-ink last:border-b-0"
                    >
                      {f}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[11px] font-bold uppercase tracking-[2px] text-muted">Source: {data.source}</p>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  )
}
