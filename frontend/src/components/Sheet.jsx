import { createContext, useContext, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'

// Sheets render into a host node at the phone-frame level, above the tab bar, and tell the app
// while they are open so it can fade the tab bar out.
export const SheetHostContext = createContext({ node: null, onOpenChange: () => {} })

const EASE_OUT = [0.22, 1, 0.36, 1]

/** Eggshell bottom sheet: 20px top radius, 36x4 muted grabber, 1.5px line top rule. */
export default function Sheet({ open, onClose, title, children }) {
  const { node, onOpenChange } = useContext(SheetHostContext)
  useEffect(() => {
    if (!open) return
    onOpenChange(1)
    return () => onOpenChange(-1)
  }, [open, onOpenChange])

  const sheet = (
    <AnimatePresence>
      {open && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end">
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-ink/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="grain relative flex max-h-[88%] flex-col rounded-t-[20px] border-t-[1.5px] border-line bg-eggshell"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
          >
            <span aria-hidden="true" className="mx-auto mt-2 block h-1 w-9 shrink-0 rounded-full bg-muted/50" />
            {/* content pads by the safe area (34 in the frame) + 24 */}
            <div className="no-scrollbar overflow-y-auto overscroll-contain px-5 pb-[calc(24px+max(34px,env(safe-area-inset-bottom)))] pt-2">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
  return node ? createPortal(sheet, node) : sheet
}
