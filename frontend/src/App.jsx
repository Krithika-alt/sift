import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { askAgent, getProducts, health, nearbyStores, rankStores, reportPrice } from './api/client.js'
import { SvgDefs } from './components/brand.jsx'
import { StickerDefs } from './components/Sticker.jsx'
import { SheetHostContext } from './components/Sheet.jsx'
import TabBar from './components/TabBar.jsx'
import Wordmark from './components/Wordmark.jsx'
import { DEMO_BASKET, DEMO_MODE, MODES } from './config.js'
import { isRankable, loadPastBags, removePastBag, renamePastBag, savePastBag, toItem, toRankItem } from './lib/bag.js'
import { BuddyContext, buddyOf, loadProfile, saveProfile } from './lib/profile.js'
import { savingsVsNearby } from './lib/stores.js'
import AskTomSheet from './screens/AskTomSheet.jsx'
import Bag from './screens/Bag.jsx'
import BuddyPicker from './screens/BuddyPicker.jsx'
import MapTab from './screens/MapTab.jsx'
import Me from './screens/Me.jsx'
import Receipt from './screens/Receipt.jsx'
import ReportPriceSheet from './screens/ReportPriceSheet.jsx'
import Results from './screens/Results.jsx'
import Saved from './screens/Saved.jsx'
import Sifting from './screens/Sifting.jsx'
import Splash from './screens/Splash.jsx'

const SLAP_MS = 3200
const SLIDE_DELAY_MS = 450
const SPLASH_MS = 1000
const TAB_SCREENS = ['map', 'saved', 'me']

function rankBody(items, mode, budget, preferences, home) {
  const body = {
    user_location: { lat: home.lat, lon: home.lon },
    // Confirmed rows only, as {text: <product name>, quantity} (the rank_items shape). Dashed rows stay out.
    items: items.filter(isRankable).map(toRankItem),
    weights: MODES.find((m) => m.id === mode).weights,
    budget,
  }
  if (preferences.length) body.preferences = preferences
  return body
}

function friendlyError(err) {
  if (err?.status === 422) return 'Something in the bag looks off. Try editing it.'
  return 'The shelves are not answering right now. Try again in a moment.'
}

export default function App() {
  const [phase, setPhase] = useState('splash') // splash | app
  const [profile, setProfileState] = useState(loadProfile)
  const setProfile = useCallback((fn) => setProfileState((p) => saveProfile(typeof fn === 'function' ? fn(p) : fn)), [])
  const buddy = useMemo(() => buddyOf(profile.buddyId ?? 'tom'), [profile.buddyId])
  const [pickerOpen, setPickerOpen] = useState(false)

  const [screen, setScreen] = useState('bag') // bag | sifting | results | receipt | map | saved | me
  const [receiptFrom, setReceiptFrom] = useState('results')
  const [bag, setBag] = useState({ items: DEMO_BASKET, budget: profile.budget, budgetSet: false, preferences: [] })
  const [mode, setMode] = useState(profile.defaultSort)
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
  const [ask, setAsk] = useState(null)
  const [askOpen, setAskOpen] = useState(false)

  const [sheetNode, setSheetNode] = useState(null)
  const [sheetCount, setSheetCount] = useState(0)
  const onSheetOpenChange = useCallback((d) => setSheetCount((n) => Math.max(0, n + d)), [])
  const sheetHost = useMemo(() => ({ node: sheetNode, onOpenChange: onSheetOpenChange }), [sheetNode, onSheetOpenChange])

  const scrollRef = useRef(null)
  const reqId = useRef(0)
  const askId = useRef(0)

  const budget = bag.budgetSet ? bag.budget : profile.budget
  const preferences = useMemo(
    () => [...new Set([...bag.preferences, ...profile.diet.map((d) => d.toLowerCase())])],
    [bag.preferences, profile.diet],
  )
  const home = profile.home
  const place = home.id === 'geo' ? 'you' : home.label
  const fellBack = demo && !DEMO_MODE

  // Splash: GET /api/health wakes the warehouse; show it about a second.
  useEffect(() => {
    const started = Date.now()
    health().then(() => setTimeout(() => setPhase('app'), Math.max(0, SPLASH_MS - (Date.now() - started))))
    getProducts()
      .then(({ data }) => setProducts(data))
      .catch(() => {})
  }, [])
  // First launch: the buddy picker, once, before the Bag.
  useEffect(() => {
    if (phase === 'app' && !profile.buddyId) setPickerOpen(true)
  }, [phase, profile.buddyId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [screen])

  useEffect(() => {
    if (!slapId) return
    const t = setTimeout(() => setSlapId(null), SLAP_MS)
    return () => clearTimeout(t)
  }, [slapId])

  async function rank(items, nextMode) {
    const id = ++reqId.current
    const { data, demo: wasDemo } = await rankStores(rankBody(items, nextMode, budget, preferences, home))
    return id === reqId.current ? { ranked: data.ranked_stores, demo: wasDemo } : null
  }

  async function sift() {
    setSiftRanked(null)
    setSiftError('')
    setScreen('sifting')
    try {
      const res = await rank(bag.items, mode)
      if (!res) return
      setDemo(res.demo)
      setSiftedAt(new Date())
      setSiftRanked(res.ranked)
      const best = res.ranked[0]
      if (best) {
        const winner = { store_id: best.store_id, total: best.total_basket_price, saved: Math.max(0, savingsVsNearby(best, res.ranked)) }
        setPastBags(savePastBag({ ...bag, budget }, winner))
      }
    } catch (err) {
      setSiftError(friendlyError(err))
    }
  }

  const finishSifting = useCallback(() => {
    setRanked(siftRanked)
    setScreen('results')
  }, [siftRanked])

  async function changeMode(nextMode) {
    if (nextMode === mode) return
    setMode(nextMode)
    setBusy(true)
    try {
      const res = await rank(bag.items, nextMode)
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
      const res = await rank(bag.items, mode)
      if (!res) return setBusy(false)
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
  async function askBuddy(question, force = false) {
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

  function openReceipt(id, from) {
    setReceiptId(id)
    setReceiptFrom(from)
    setScreen('receipt')
  }

  function loadBag(pb) {
    setBag({ items: pb.items.map(toItem), budget: pb.budget, budgetSet: Boolean(pb.budgetSet), preferences: pb.preferences ?? [] })
    setScreen('bag')
  }

  function changeTab(t) {
    setScreen(t)
  }

  const receiptStore = ranked.find((s) => s.store_id === receiptId)
  const tab = TAB_SCREENS.includes(screen) ? screen : 'bag'
  // While a sheet is open the tab bar fades out (it keeps its space, so nothing jumps).
  const showTabs = phase === 'app' && !pickerOpen && !['sifting', 'receipt'].includes(screen)
  // Map tab: stores only, no bag. Last rank response's store list, else the mock list; by distance.
  const mapStores = useMemo(() => nearbyStores(ranked, home), [ranked, home])

  return (
    <BuddyContext.Provider value={buddy}>
      <SheetHostContext.Provider value={sheetHost}>
      <div className="flex min-h-dvh items-center justify-center gap-16 bg-eggshell min-[500px]:grain">
        <SvgDefs />
        <StickerDefs />
        {/* Laptop presentation: wordmark and line to the left of the phone */}
        <div className="hidden flex-col items-start min-[900px]:flex">
          <Wordmark size={96} />
          <p className="mt-3 font-display text-[32px] text-ink">We dig. You dig in.</p>
        </div>

        {/* iPhone viewport 390 x 844. Full screen on a phone, framed on a laptop. */}
        <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-eggshell min-[500px]:h-[844px] min-[500px]:w-[390px] min-[500px]:rounded-[44px] min-[500px]:border-[1.5px] min-[500px]:border-ink">
          {phase === 'splash' ? (
            <Splash />
          ) : (
            <>
              <main
                ref={scrollRef}
                className={`grain no-scrollbar isolate min-h-0 flex-1 overscroll-contain ${screen === 'map' ? 'overflow-hidden' : 'overflow-y-auto'}`}
              >
                {screen === 'bag' && (
                  <Bag
                    bag={bag}
                    setBag={setBag}
                    budget={budget}
                    products={products}
                    pastBags={pastBags}
                    onLoadPast={loadBag}
                    onRenamePast={(at, name) => setPastBags(renamePastBag(at, name))}
                    onSift={sift}
                    demo={demo}
                    place={place}
                    userName={profile.name}
                  />
                )}
                {screen === 'sifting' && (
                  <Sifting ranked={siftRanked} error={siftError} demo={demo} onDone={finishSifting} onBack={() => setScreen('bag')} />
                )}
                {screen === 'results' && (
                  <Results
                    ranked={ranked}
                    mode={mode}
                    onMode={changeMode}
                    budget={budget}
                    demo={demo}
                    fellBack={fellBack}
                    busy={busy}
                    slapId={slapId}
                    onReceipt={(id) => openReceipt(id, 'results')}
                    onEditBag={() => setScreen('bag')}
                    onAsk={askBuddy}
                    user={home}
                  />
                )}
                {screen === 'receipt' && receiptStore && (
                  <Receipt
                    store={receiptStore}
                    ranked={ranked}
                    siftedAt={siftedAt}
                    demo={demo}
                    onBack={() => setScreen(receiptFrom)}
                    onReport={() => setReportOpen(true)}
                  />
                )}
                {screen === 'map' && (
                  <MapTab stores={mapStores} user={home} demo={demo} />
                )}
                {screen === 'saved' && (
                  <Saved
                    pastBags={pastBags}
                    onOpen={loadBag}
                    onRename={(at, name) => setPastBags(renamePastBag(at, name))}
                    onRemove={(at) => setPastBags(removePastBag(at))}
                  />
                )}
                {screen === 'me' && <Me profile={profile} setProfile={setProfile} onChangeBuddy={() => setPickerOpen(true)} />}
              </main>

              {showTabs && <TabBar active={tab} onChange={changeTab} hidden={sheetCount > 0} />}
              {/* sheets portal here: above the tab bar, outside main's stacking context */}
              <div ref={setSheetNode} className="contents" />

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
                onRetry={() => askBuddy(ask.question, true)}
              />
              <BuddyPicker
                key={pickerOpen ? 'open' : 'closed'}
                open={pickerOpen}
                current={profile.buddyId}
                onPick={(id) => {
                  setProfile((p) => ({ ...p, buddyId: id }))
                  setPickerOpen(false)
                }}
                onClose={profile.buddyId ? () => setPickerOpen(false) : undefined}
              />
            </>
          )}
        </div>
      </div>
      </SheetHostContext.Provider>
    </BuddyContext.Provider>
  )
}
