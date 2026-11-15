import { AnimatePresence, motion } from 'framer-motion'
import { TornEdge } from './brand.jsx'

/** Kraft bottom sheet with a torn top edge. Lives inside the phone frame. */
export default function Sheet({ open, onClose, title, children }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="absolute inset-0 z-40 flex flex-col justify-end">
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-ink/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative flex max-h-[88%] flex-col"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
          >
            <TornEdge color="var(--kraft)" seed={23} height={14} className="shrink-0" />
            <div className="grain no-scrollbar overflow-y-auto overscroll-contain bg-kraft px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-2">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
