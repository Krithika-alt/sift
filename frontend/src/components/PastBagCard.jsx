import { LandingSticker } from './brand.jsx'
import { MiniBag } from './Motifs.jsx'
import Sticker, { STICKER_COLORS } from './Sticker.jsx'
import { autoName, toItem } from '../lib/bag.js'
import { money, storeColor } from '../lib/stores.js'

// Cards rotate through these pop colors.
const TONES = ['pea', 'butter', 'sardine', 'radish', 'clementine']

const INITIALS = {
  trader_joes_monroe: 'TJ',
  pick_n_save: 'PS',
  target_state_st: 'TG',
  fresh_madison_market: 'FM',
  capitol_centre_market: 'CC',
  walgreens_state_st: 'WG',
}
export function storeInitials(storeId, name = '') {
  if (INITIALS[storeId]) return INITIALS[storeId]
  const words = (name || storeId).replace(/[^A-Za-z ]/g, ' ').split(/\s+/).filter(Boolean)
  return words.slice(0, 2).map((w) => w[0].toUpperCase()).join('')
}

/**
 * A saved bag as a mini paper bag (Motifs.jsx): name (Karla 700 16, two lines max), item count
 * (Karla 13 muted), and produce-style stickers on the bag body: the winning store's initials in
 * its color, and a butter SAVED sticker. Tapping opens the Saved Bag screen.
 */
export default function PastBagCard({ pb, index = 0, onOpen, fill = false }) {
  const items = pb.items.map(toItem)
  const name = pb.name || autoName(items)
  const tone = STICKER_COLORS[TONES[index % TONES.length]].bg
  return (
    <button type="button" onClick={onOpen} aria-label={`Open ${name}, ${items.length} items`} className={`shrink-0 text-left transition-transform active:scale-[0.98] ${fill ? 'w-full' : ''}`}>
      <MiniBag color={tone} width={fill ? '100%' : 156} height={176}>
        <span className="line-clamp-2 text-[16px] font-bold leading-tight text-ink">{name}</span>
        <span className="mt-1 text-[13px] text-muted">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
        {pb.winner && (
          <span className="mt-auto flex items-center pb-1">
            <LandingSticker>
              <Sticker shape="round" size="md" color={storeColor(pb.winner.store_id)} tilt={-8}>
                {storeInitials(pb.winner.store_id)}
              </Sticker>
            </LandingSticker>
            {pb.winner.saved > 0.005 && (
              <span className="-ml-2.5 mt-3">
                <LandingSticker delay={0.06}>
                  <Sticker color="butter" size="sm" tilt={5}>
                    Saved {money(pb.winner.saved)}
                  </Sticker>
                </LandingSticker>
              </span>
            )}
          </span>
        )}
      </MiniBag>
    </button>
  )
}
