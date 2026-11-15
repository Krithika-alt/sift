import { useCallback, useEffect, useRef, useState } from 'react'
import { askAgent, getProducts, rankStores, reportPrice } from './api/client.js'
import { SvgDefs } from './components/brand.jsx'
import { StickerDefs } from './components/Sticker.jsx'
import { DEFAULT_BUDGET, DEFAULT_LOCATION, DEFAULT_MODE, DEMO_BASKET, DEMO_MODE, MODES } from './config.js'
import { loadPastBags, savePastBag, setPastBagWinner, toItem, toRankItem } from './lib/bag.js'
import AskTomSheet from './screens/AskTomSheet.jsx'
import Bag from './screens/Bag.jsx'
import Receipt from './screens/Receipt.jsx'
import ReportPriceSheet from './screens/ReportPriceSheet.jsx'
import Results from './screens/Results.jsx'
import Sifting from './screens/Sifting.jsx'

const SLAP_MS = 3200
const SLIDE_DELAY_MS = 450

function rankBody(bag, mode) {
  const body = {
    user_location: { lat: DEFAULT_LOCATION.lat, lon: DEFAULT_LOCATION.lon },
    // Only rows with rank text: typed items and matched voice items (rank_items). NOT FOUND rows stay out.
    // Plain string for one, {text, quantity} for more than one (field names match the backend).
    items: bag.items.filter((i) => i.rank).map(toRankItem),
    weights: MODES.find((m) => m.id === mode).weights,
    budget: bag.budget,
  }
  if (bag.preferences.length) body.preferences = bag.preferences
  return body
}

function friendlyError(err) {
  if (err?.status === 422) return 'Something in the bag looks off. Try editing it.'
  return 'The shelves are not answering right now. Try again in a moment.'
}

export default function App() {
  const [screen, setScreen] = useState('bag') // bag | sifting | results | receipt
  const [bag, setBag] = useState({ items: DEMO_BASKET, budget: DEFAULT_BUDGET, preferences: [] })
  const [mode, setMode] = useState(DEFAULT_MODE)
  const [products, setProducts] = useState([])
  const [pastBags, setPastBags] = useState(loadPastBags)
  const [demo, setDemo] = useState(DEMO_MODE)

  const [siftRanked, setSiftRanked] = useState(null)
  const [siftError, setSiftError] = useState('')
  const [ranked, setRanked] = useState([])
  const [siftedAt, setSiftedAt] = useState(() => new Date())
  const [busy, setBusy] = useState(false)

  const [receiptId, setReceiptId] = useState(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [slapId, setSlapId] = useState(null)

  // Ask Tom: { question, ranked, status: 'loading' | 'done' | 'error', data }
  const [ask, setAsk] = useState(null)
  const [askOpen, setAskOpen] = useState(false)
  const askId = useRef(0)

  const scrollRef = useRef(null)
  const siftAt = useRef(null)
  const reqId = useRef(0)

  useEffect(() => {
    getProducts()
      .then(({ data }) => setProducts(data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [screen])

  useEffect(() => {
    if (!slapId) return
    const t = setTimeout(() => setSlapId(null), SLAP_MS)
    return () => clearTimeout(t)
  }, [slapId])

  async function rank(nextBag, nextMode) {
    const id = ++reqId.current
    const { data, demo: wasDemo } = await rankStores(rankBody(nextBag, nextMode))
    return id === reqId.current ? { ranked: data.ranked_stores, demo: wasDemo } : null
  }

  async function sift() {
    const saved = savePastBag(bag)
    setPastBags(saved.list)
    siftAt.current = saved.at
    setSiftRanked(null)
    setSiftError('')
    setScreen('sifting')
    try {
      const res = await rank(bag, mode)
      if (!res) return
      setDemo(res.demo)
      setSiftedAt(new Date())
      setSiftRanked(res.ranked)
    } catch (err) {
      setSiftError(friendlyError(err))
    }
  }

  const finishSifting = useCallback(() => {
    if (siftAt.current && siftRanked?.[0]) setPastBags(setPastBagWinner(siftAt.current, siftRanked[0]))
    setRanked(siftRanked)
    setScreen('results')
  }, [siftRanked])

  async function changeMode(nextMode) {
    if (nextMode === mode) return
    setMode(nextMode)
    setBusy(true)
    try {
      const res = await rank(bag, nextMode)
      if (res) {
        setDemo(res.demo)
        setRanked(res.ranked)
      }
    } catch {
      /* keep the current list */
    } finally {
      setBusy(false)
    }
  }

  // Report -> back to Results -> re-rank. The store that moved gets a sticker slap and slides up.
  async function sendReport(body) {
    const report = await reportPrice(body) // throws on 4xx; the sheet shows a calm message
    setReportOpen(false)
    setScreen('results')
    setBusy(true)
    try {
      const res = await rank(bag, mode)
      if (!res) return
      setTimeout(() => {
        setDemo(res.demo || report.demo)
        setSiftedAt(new Date())
        setRanked(res.ranked)
        setSlapId(body.store_id)
        setBusy(false)
      }, SLIDE_DELAY_MS)
    } catch {
      setBusy(false)
    }
  }

  // Reopening the same question for the same ranking shows the pending or finished answer.
  async function askTom(question, force = false) {
    setAskOpen(true)
    if (!force && ask && ask.question === question && ask.ranked === ranked && ask.status !== 'error') return
    const id = ++askId.current
    setAsk({ question, ranked, status: 'loading', data: null })
    try {
      const { data } = await askAgent({ question, ranking: { ranked_stores: ranked } })
      if (id === askId.current) setAsk({ question, ranked, status: 'done', data })
    } catch {
      if (id === askId.current) setAsk({ question, ranked, status: 'error', data: null })
    }
  }

  const receiptStore = ranked.find((s) => s.store_id === receiptId)

  return (
    <div className="flex min-h-dvh items-center justify-center bg-eggshell min-[440px]:bg-line">
      <SvgDefs />
      <StickerDefs />
      {/* iPhone viewport 390 x 844. Full screen on a phone, framed on a desktop. */}
      <div className="relative h-dvh w-full overflow-hidden bg-eggshell min-[440px]:h-[844px] min-[440px]:w-[390px] min-[440px]:rounded-[48px] min-[440px]:border-[1.5px] min-[440px]:border-ink">
        <main ref={scrollRef} className="grain no-scrollbar h-full overflow-y-auto overscroll-contain">
          {screen === 'bag' && (
            <Bag
              bag={bag}
              setBag={setBag}
              products={products}
              pastBags={pastBags}
              onLoadPast={(pb) =>
                setBag({ items: pb.items.map(toItem), budget: pb.budget, budgetSet: pb.budget !== DEFAULT_BUDGET, preferences: pb.preferences ?? [] })
              }
              onSift={sift}
              demo={demo}
            />
          )}
          {screen === 'sifting' && (
            <Sifting
              ranked={siftRanked}
              error={siftError}
              demo={demo}
              onDone={finishSifting}
              onBack={() => setScreen('bag')}
            />
          )}
          {screen === 'results' && (
            <Results
              ranked={ranked}
              mode={mode}
              onMode={changeMode}
              budget={bag.budget}
              demo={demo}
              busy={busy}
              slapId={slapId}
              onReceipt={(id) => {
                setReceiptId(id)
                setScreen('receipt')
              }}
              onEditBag={() => setScreen('bag')}
              onAsk={askTom}
            />
          )}
          {screen === 'receipt' && receiptStore && (
            <Receipt
              store={receiptStore}
              ranked={ranked}
              siftedAt={siftedAt}
              demo={demo}
              onBack={() => setScreen('results')}
              onReport={() => setReportOpen(true)}
            />
          )}
        </main>

        <ReportPriceSheet
          open={reportOpen}
          store={receiptStore}
          products={products}
          onClose={() => setReportOpen(false)}
          onSend={sendReport}
        />

        <AskTomSheet
          open={askOpen && screen === 'results'}
          ask={ask}
          onClose={() => setAskOpen(false)}
          onRetry={() => askTom(ask.question, true)}
        />
      </div>
    </div>
  )
}
