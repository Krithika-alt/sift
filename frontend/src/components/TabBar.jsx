import { MyBuddy } from './brand.jsx'

const Icon = ({ children }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)

const TABS = [
  {
    id: 'bag',
    label: 'Bag',
    icon: (
      <Icon>
        <path d="M5 8h14l-1 12H6L5 8z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </Icon>
    ),
  },
  {
    id: 'map',
    label: 'Map',
    icon: (
      <Icon>
        <path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z" />
        <circle cx="12" cy="10" r="2.2" />
      </Icon>
    ),
  },
  {
    id: 'saved',
    label: 'Saved',
    icon: (
      <Icon>
        <path d="M7 4h10v16l-5-4-5 4V4z" />
      </Icon>
    ),
  },
  { id: 'me', label: 'Me', icon: <MyBuddy size={24} /> },
]

/** Quiet bottom tabs: 56 tall plus the safe area, eggshell, 1.5px rule, no shadow. */
export default function TabBar({ active, onChange }) {
  return (
    <nav aria-label="Tabs" className="relative z-20 shrink-0 border-t-[1.5px] border-line bg-eggshell pb-[34px]">
      <ul className="flex h-14">
        {TABS.map((t) => {
          const on = t.id === active
          return (
            <li key={t.id} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(t.id)}
                aria-current={on ? 'page' : undefined}
                className={`flex h-14 w-full flex-col items-center justify-center gap-0.5 ${on ? 'text-ink' : 'text-muted'}`}
              >
                <span className="flex h-6 items-center" style={t.id === 'me' && !on ? { opacity: 0.7 } : undefined}>
                  {t.icon}
                </span>
                <span className="text-[12px] font-semibold leading-none">{t.label}</span>
                <span aria-hidden="true" className={`mt-0.5 h-2 w-2 rounded-full ${on ? 'bg-pea' : 'bg-transparent'}`} />
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
