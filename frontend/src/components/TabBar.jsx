import Buddy from './Buddies.jsx'
import { TabIcon } from './TabIcons.jsx'
import { useBuddy } from '../lib/profile.js'

const TABS = [
  { id: 'bag', label: 'Bag' },
  { id: 'map', label: 'Map' },
  { id: 'saved', label: 'Saved' },
  { id: 'me', label: 'Me' },
]

/** Quiet bottom tabs: eggshell with a straight 1.5px line top rule, 64 tall plus the safe area. */
export default function TabBar({ active, onChange }) {
  const buddy = useBuddy()
  return (
    <nav aria-label="Tabs" className="relative z-20 shrink-0 border-t-[1.5px] border-line bg-eggshell pb-[34px]">
      <ul className="flex h-16">
        {TABS.map((t) => {
          const on = t.id === active
          return (
            <li key={t.id} className="flex flex-1 justify-center">
              <button
                type="button"
                onClick={() => onChange(t.id)}
                aria-current={on ? 'page' : undefined}
                className="flex h-16 min-w-11 flex-col items-center justify-center gap-1 px-2"
              >
                {t.id === 'me' ? (
                  <Buddy id={buddy.id} size={28} style={on ? undefined : { filter: 'grayscale(1) opacity(0.5)' }} />
                ) : (
                  <TabIcon name={t.id} selected={on} size={28} />
                )}
                <span className={`text-[12px] font-semibold leading-none ${on ? 'text-ink' : 'text-[#9C8B7D]'}`}>{t.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
