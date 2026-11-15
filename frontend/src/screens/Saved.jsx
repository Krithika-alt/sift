import { useState } from 'react'
import PastBagCard from '../components/PastBagCard.jsx'
import Sheet from '../components/Sheet.jsx'
import { MyBuddy, PrimaryButton } from '../components/brand.jsx'

/** "Your bags": two-column grid of kraft past-bag cards. Tap loads into the Bag tab. */
export default function Saved({ pastBags, onOpen, onRename, onRemove }) {
  const [removing, setRemoving] = useState(null)

  return (
    <div className="min-h-full px-5 pb-8 pt-14">
      <h1 className="font-display text-[28px] text-ink">Your bags</h1>

      {pastBags.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <MyBuddy size={96} />
          <p className="mt-4 max-w-[280px] font-display text-[24px] leading-tight text-ink">Bags you sift will show up here.</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3">
          {pastBags.map((pb) => (
            <PastBagCard
              key={pb.at}
              pb={pb}
              width="100%"
              onOpen={() => onOpen(pb)}
              onRename={(name) => onRename(pb.at, name)}
              onRemove={() => setRemoving(pb)}
            />
          ))}
        </div>
      )}

      <Sheet open={Boolean(removing)} onClose={() => setRemoving(null)} title="Remove this bag?">
        <h2 className="font-display text-[24px] text-ink">Remove this bag?</h2>
        <p className="mt-1 text-[17px] text-ink">{removing?.name}</p>
        <PrimaryButton
          className="mt-5"
          onClick={() => {
            onRemove(removing.at)
            setRemoving(null)
          }}
        >
          Remove
        </PrimaryButton>
        <button type="button" onClick={() => setRemoving(null)} className="mt-1 min-h-11 w-full text-[17px] font-semibold text-ink">
          Keep it
        </button>
      </Sheet>
    </div>
  )
}
