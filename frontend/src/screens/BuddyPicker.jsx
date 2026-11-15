import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Buddy, { BUDDIES } from '../components/Buddies.jsx'
import Sticker from '../components/Sticker.jsx'
import { PrimaryButton } from '../components/brand.jsx'

/**
 * "Pick a buddy": full eggshell sheet, 3-column grid of all 8 buddies. The same picker is the
 * first-launch screen (no close button there).
 */
export default function BuddyPicker({ open, current, onPick, onClose }) {
  const [sel, setSel] = useState(current ?? 'tom')
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Pick a buddy"
          className="grain absolute inset-0 z-50 flex flex-col bg-eggshell"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        >
          <div className="no-scrollbar flex-1 overflow-y-auto px-5 pt-14">
            <div className="flex items-center justify-between">
              <h1 className="font-display text-[28px] text-ink">Pick a buddy</h1>
              {onClose && (
                <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 flex h-11 w-11 items-center justify-center text-[22px] text-ink">
                  ✕
                </button>
              )}
            </div>
            <div role="radiogroup" aria-label="Buddies" className="mt-6 grid grid-cols-3 gap-x-3 gap-y-5">
              {BUDDIES.map((b) => {
                const on = b.id === sel
                return (
                  <button
                    key={b.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={`${b.name} the ${b.kind}`}
                    onClick={() => setSel(b.id)}
                    className="flex flex-col items-center"
                  >
                    <span className={`relative flex h-[100px] w-[100px] items-center justify-center rounded-full ${on ? 'ring-2 ring-ink' : ''}`}>
                      <Buddy id={b.id} size={88} />
                      {on && (
                        <span className="absolute -right-1 -top-1">
                          <Sticker shape="round" size="sm" color="pea" tilt={-6}>
                            ✓
                          </Sticker>
                        </span>
                      )}
                    </span>
                    <span className="mt-1 text-[15px] font-semibold text-ink">{b.name}</span>
                    <span className="text-[13px] text-muted">{b.kind}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="px-5 pb-[34px] pt-3">
            <PrimaryButton onClick={() => onPick(sel)}>That one</PrimaryButton>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
