import { useCallback, useState } from 'react'
import BagItems from '../components/BagItems.jsx'
import { BuddyLine, DemoBadge, PrimaryButton, Pulse, SectionLabel, TornEdge, tint } from '../components/brand.jsx'
import NeedStickers from '../components/NeedStickers.jsx'
import PastBagCard from '../components/PastBagCard.jsx'
import Wordmark from '../components/Wordmark.jsx'
import { isDashed, isRankable } from '../lib/bag.js'
import { displayName, useBuddy } from '../lib/profile.js'

export function BookmarkIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="M6.5 3.5h11v17l-5.5-4-5.5 4z" />
    </svg>
  )
}

// The greeting stays within two lines of Darumadrop 28 beside the buddy; longer names drop it.
const NAME_FITS = 10

/** needs: { budget, radius, diets, over, onBudget, onRadius, onDiets, onParsed } (App owns them) */
export default function Bag({ bag, setBag, needs, products, pastBags, saved, onSave, onOpenSaved, onSift, onPlace, demo, place, userName }) {
  const buddy = useBuddy()
  const [tomLine, setTomLine] = useState(null) // null = the default greeting
  const name = displayName(userName)
  const [status, setStatus] = useState({ listening: false, parsing: false })
  const onStatus = useCallback((s) => setStatus(s), [])
  const greeting = bag.items.length === 0
    ? "Add a few things and I'll start digging."
    : name && name.length <= NAME_FITS
      ? `Hi, ${name}. What do you need?`
      : 'What do you need?'

  const rankable = bag.items.some(isRankable)
  const pending = bag.items.filter(isDashed).length

  return (
    <div className="flex min-h-full flex-col">
      <div className="px-5 pb-6 pt-14">
        <header className="flex h-11 items-center justify-between gap-3">
          <Wordmark size={34} />
          <span className="flex items-center gap-2">
            {demo && <DemoBadge />}
            {/* location pill: opens Home base in Me */}
            <button
              type="button"
              onClick={onPlace}
              aria-label={`Near ${place}. Change home base`}
              className="flex min-h-11 items-center transition-transform active:scale-[0.98]"
            >
              <span className="flex h-8 items-center gap-1.5 rounded-2xl px-3 text-[13px] font-semibold text-ink" style={{ background: tint('sardine', 18) }}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                  <path d="M12 2.5c-3.9 0-7 3-7 6.9 0 5 7 12.1 7 12.1s7-7.1 7-12.1c0-3.9-3.1-6.9-7-6.9zm0 9.4a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
                </svg>
                <span className="whitespace-nowrap">Near {place}</span>
              </span>
            </button>
          </span>
        </header>

        <div className="mt-6">
          <BuddyLine size={64} text={28} splotch>
            {status.listening ? <Pulse>Listening</Pulse> : status.parsing ? <Pulse>Thinking</Pulse> : pending ? 'Check the dashed ones for me.' : tomLine ?? greeting}
          </BuddyLine>
        </div>

        {/* The bag: kraft card, torn top, square bottom corners */}
        <section aria-label="Your bag" className="mt-6">
          <TornEdge color="var(--kraft)" seed={11} />
          <div className="grain rounded-b-[4px] bg-kraft px-4 pb-2 pt-1">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-ink">
                Your bag · {bag.items.length} {bag.items.length === 1 ? 'item' : 'items'}
              </h2>
              <button
                type="button"
                onClick={onSave}
                disabled={!rankable}
                aria-pressed={Boolean(saved)}
                aria-label={saved ? `Saved as ${saved.name}` : 'Save this bag'}
                className="-mr-3 flex h-11 w-11 items-center justify-center text-ink active:scale-[0.98] disabled:opacity-30"
              >
                <BookmarkIcon filled={Boolean(saved)} />
              </button>
            </div>

            {/* the bag's needs: budget, distance, diet (the only stickers on the bag) */}
            <NeedStickers {...needs} className="-mt-1.5" />

            <div className="mt-1">
              <BagItems bag={bag} setBag={setBag} products={products} placeholder={`Tell ${buddy.name} what you need`} onLine={setTomLine} onNeeds={needs.onParsed} onStatus={onStatus} />
            </div>
          </div>
        </section>

        {pastBags.length > 0 && (
          <section aria-label="Saved bags" className="mt-6">
            <SectionLabel>Saved bags</SectionLabel>
            <div className="no-scrollbar -mx-5 mt-2 flex gap-3 overflow-x-auto px-5 pb-1">
              {pastBags.map((pb, i) => (
                <PastBagCard key={pb.at} pb={pb} index={i} compact onOpen={() => onOpenSaved(pb.at)} />
              ))}
              <span aria-hidden="true" className="w-2 shrink-0" />
            </div>
          </section>
        )}
      </div>

      {/* Primary action at the bottom, 16px above the tab bar */}
      <div className="sticky bottom-0 z-10 mt-auto bg-eggshell px-5 pb-4 pt-3">
        <PrimaryButton disabled={!rankable || pending > 0 || status.listening || status.parsing} onClick={onSift}>
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
