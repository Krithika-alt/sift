import PastBagCard from '../components/PastBagCard.jsx'
import { MyBuddy } from '../components/brand.jsx'

/** A tiny sprout (the empty Saved state's one produce touch). */
function Sprout() {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" style={{ filter: 'url(#sift-sticker-edge)' }}>
      <path d="M20 36 C20 28 20 22 20 16" stroke="#56603A" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M20 20 C16 14 10 13 6 15 C9 20 15 22 20 20Z" fill="#9DBE5A" />
      <path d="M20 17 C23 10 29 8 34 9 C32 15 26 18 20 17Z" fill="#9DBE5A" />
    </svg>
  )
}

/** "Your bags": two columns of mini paper bags (156 x 176, gap 12). Tap opens the Saved Bag screen. */
export default function Saved({ pastBags, onOpen, onNew }) {
  return (
    <div className="min-h-full px-5 pb-6 pt-14">
      <header className="flex h-11 items-center justify-between">
        <h1 className="font-display text-[28px] leading-tight text-ink">Your bags</h1>
        <button
          type="button"
          onClick={onNew}
          aria-label="Start a new saved bag"
          className="-mr-3 flex h-11 w-11 items-center justify-center text-ink transition-transform active:scale-[0.98]"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </header>

      {pastBags.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <MyBuddy size={96} />
          <span className="-mt-2">
            <Sprout />
          </span>
          <p className="mt-3 max-w-[280px] font-display text-[24px] leading-tight text-ink">Save a bag and it grows here.</p>
          <p className="mt-2 max-w-[260px] text-[15px] text-muted">Tap the bookmark on your bag, or + to start one.</p>
        </div>
      ) : (
        // two columns, 12 gap, edges on the 20px margins (each bag stretches from 156 to its column width)
        <div className="mt-6 grid grid-cols-2 gap-3">
          {pastBags.map((pb, i) => (
            <PastBagCard key={pb.at} pb={pb} index={i} fill onOpen={() => onOpen(pb.at)} />
          ))}
        </div>
      )}
    </div>
  )
}
