import Sheet from '../components/Sheet.jsx'
import Sticker from '../components/Sticker.jsx'
import { MyBuddy, PrimaryButton, Pulse } from '../components/brand.jsx'
import { useBuddy } from '../lib/profile.js'

// Short chip labels; the full question goes to /api/ask-agent.
export const ASK_CHIPS = [
  { label: 'Why this store?', question: 'Why this store?' },
  { label: 'Cheaper swap?', question: 'Cheaper swap?' },
  { label: 'Protein per $?', question: 'Protein per dollar?' },
]

// About two lines of Darumadrop 24 in the sheet.
const HEADLINE_MAX = 64

/**
 * The headline never gets an ellipsis. A long one is shown up to its first natural break
 * (":" ";" "," or " - ") within two lines; the full text is always in the answer below.
 */
function splitHeadline(headline = '') {
  const h = headline.trim()
  if (h.length <= HEADLINE_MAX) return { head: h, cut: false }
  const breaks = [...h.slice(0, HEADLINE_MAX).matchAll(/[:;,]|\s-\s/g)].map((m) => m.index)
  const at = breaks.length ? breaks[breaks.length - 1] : h.slice(0, HEADLINE_MAX).lastIndexOf(' ')
  return { head: h.slice(0, at).trim() + '.', cut: true }
}

// If the answer starts with the same sentence as the headline, drop that sentence.
function answerBody(answer = '', headline = '') {
  const first = answer.split(/(?<=\.)\s+/)[0] ?? ''
  const norm = (t) => t.trim().replace(/\.$/, '')
  return norm(first) === norm(headline) ? answer.slice(first.length).trim() : answer
}

/**
 * Ask [buddy]: POST /api/ask-agent. Closing while it's thinking is fine; the answer is here
 * when the sheet opens again. ask = { question, status: 'loading' | 'done' | 'error', data }
 */
export default function AskTomSheet({ open, ask, onClose, onRetry }) {
  const buddy = useBuddy()
  const data = ask?.data
  const { head, cut } = splitHeadline(data?.headline)
  const body = data ? (cut ? data.answer : answerBody(data.answer, data.headline)) : ''

  return (
    <Sheet open={open} onClose={onClose} title={`Ask ${buddy.name}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-semibold text-ink">{ask?.question}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 flex h-11 w-11 items-center justify-center text-[22px] text-ink">
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
              <p className="font-display text-[24px] leading-[1.2] text-ink">{head}</p>
            </div>
            {body && <p className="mt-4 text-[17px] leading-relaxed text-ink">{body}</p>}

            {data.facts_used?.length > 0 && (
              <ul className="mt-5 rounded-[4px] bg-receipt px-4 py-2 font-mono">
                {data.facts_used.map((f, i) => (
                  <li key={i} className="border-b-[1.5px] border-dashed border-line py-1.5 text-[12px] uppercase leading-snug text-ink last:border-b-0">
                    {f}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4">
              {data.verified ? (
                <Sticker color="olive" size="sm" tilt={-4}>
                  Checked against prices
                </Sticker>
              ) : (
                <p className="text-[13px] text-ink">Based on our price tables</p>
              )}
              {data.note && <p className="mt-2 text-[12px] text-ink">{data.note}</p>}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  )
}
