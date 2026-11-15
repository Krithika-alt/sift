import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MotionConfig, motion } from 'framer-motion'
import { askAgent, getProducts, health, nearbyStores, rankStores, reportPrice } from './api/client.js'
import { Backdrop, SvgDefs, Toast } from './components/brand.jsx'
import { StickerDefs } from './components/Sticker.jsx'
import { SheetHostContext } from './components/Sheet.jsx'
import TabBar from './components/TabBar.jsx'
import Wordmark from './components/Wordmark.jsx'
import { DEMO_BASKET, DEMO_MODE, MODES } from './config.js'
import {
  findSavedBag,
  isRankable,
  loadPastBags,
  newSavedBag,
  recordWinner,
  removePastBag,
  renamePastBag,
  saveBag,
  toItem,
  toRankItem,
  updateSavedBag,
} from './lib/bag.js'
import { applyNeeds, bagBudget, bagDiets, loadRadius, saveRadius, withinRadius } from './lib/needs.js'
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
import SavedBag from './screens/SavedBag.jsx'
import Sifting from './screens/Sifting.jsx'
import Splash from './screens/Splash.jsx'

const SLAP_MS = 3200
const SLIDE_DELAY_MS = 450
const SPLASH_MS = 1000
const TAB_SCREENS = ['map', 'saved', 'me']
const TOAST_MS = 2500
// How deep each screen sits, for the direction of the screen-change motion.
const DEPTH = { bag: 0, map: 0, saved: 0, me: 0, savedBag: 1, sifting: 1, results: 2, receipt: 3 }
// Soil screens have their own film grain and no aura; map screens get grain but no aura.
const SOIL = ['sifting']
const NO_AURA = ['map', 'results']

function rankBody(items, mode, budget, preferences, home) {
  const body = {
    user_location: { lat: home.lat, lon: home.lon },
    // Confirmed rows only, as {text: <product name>, quantity} (the rank_items shape). Dashed rows stay out.
    items: items.filter(isRankable).map(toRankItem),
    weights: MODES.find((m) => m.id === mode).weights,
  }
  if (budget != null) body.budget = budget // "No budget": left out (the contract's budget is optional)
  if (preferences.length) body.preferences = preferences
  return body
}

// What the over-budget mark belongs to: it lasts until the bag changes.
const bagKey = (b, budget) => JSON.stringify([b.items.filter(isRankable).map(toRankItem), budget])

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
  const [bag, setBag] = useState({ items: DEMO_BASKET, budget: profile.budget, budgetSet: false, preferences: [], dietSet: false })
  // Search radius (miles): the map pills and the bag's distance sticker, both ways. localStorage.
  const [radius, setRadiusState] = useState(loadRadius)
  const setRadius = useCallback((r) => setRadiusState(saveRadius(r)), [])
  const [rankedFor, setRankedFor] = useState(null) // bagKey of the bag the current ranking is for
  const siftKey = useRef(null)
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

  const [savedAt, setSavedAt] = useState(null) // the saved bag open on the Saved Bag screen
  const [savedFrom, setSavedFrom] = useState('saved')
  const [toast, setToast] = useState(null)
  const [meEdit, setMeEdit] = useState(null) // open a Me editor on arrival (the Bag's location pill -> 'home')

  const [sheetNode, setSheetNode] = useState(null)
  const [sheetCount, setSheetCount] = useState(0)
  const onSheetOpenChange = useCallback((d) => setSheetCount((n) => Math.max(0, n + d)), [])
  const sheetHost = useMemo(() => ({ node: sheetNode, onOpenChange: onSheetOpenChange }), [sheetNode, onSheetOpenChange])

  const scrollRef = useRef(null)
  const reqId = useRef(0)
  const askId = useRef(0)

  const budget = bagBudget(bag, profile) // null = no budget
  const diets = bagDiets(bag, profile)
  // Stores outside the circle drop out of the pins, the lists and the ranking (client side).
  const shownRanked = useMemo(() => withinRadius(ranked, radius), [ranked, radius])
  const best = shownRanked[0]
  const over = rankedFor === bagKey(bag, budget) && budget != null && best ? Math.max(0, best.total_basket_price - budget) : 0
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

  // b: the bag to rank (defaults to the current bag); budget and diet resolve against the profile.
  async function rank(nextMode, b = bag) {
    const id = ++reqId.current
    const { data, demo: wasDemo } = await rankStores(rankBody(b.items, nextMode, bagBudget(b, profile), bagDiets(b, profile), home))
    return id === reqId.current ? { ranked: data.ranked_stores, demo: wasDemo } : null
  }

  // Sifting never saves a bag (saving is on purpose); it only updates the winner on a matching saved bag.
  async function sift(b = bag) {
    setSiftRanked(null)
    setSiftError('')
    setScreen('sifting')
    siftKey.current = bagKey(b, bagBudget(b, profile))
    try {
      const res = await rank(mode, b)
      if (!res) return
      setDemo(res.demo)
      setSiftedAt(new Date())
      setSiftRanked(res.ranked)
      const inside = withinRadius(res.ranked, radius)
      const top = inside[0]
      if (top) {
        const winner = { store_id: top.store_id, total: top.total_basket_price, saved: Math.max(0, savingsVsNearby(top, inside)) }
        setPastBags(recordWinner(b, winner))
      }
    } catch (err) {
      setSiftError(friendlyError(err))
    }
  }

  // Saved bags
  const savedMatch = useMemo(() => findSavedBag(pastBags, bag), [pastBags, bag])
  const toastTimer = useRef(null)
  function showToast(t) {
    clearTimeout(toastTimer.current)
    setToast({ ...t, id: Date.now() })
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS)
  }
  function openSaved(at, from = screen) {
    setToast(null)
    setSavedAt(at)
    setSavedFrom(from === 'savedBag' ? 'saved' : from)
    setScreen('savedBag')
  }
  function saveCurrentBag() {
    const { list, entry } = saveBag({ ...bag, budget, preferences: diets })
    setPastBags(list)
    showToast({ text: `Saved as ${entry.name}`, action: { label: 'Rename', onClick: () => openSaved(entry.at, 'bag') } })
  }
  function newBag() {
    const { list, entry } = newSavedBag(profile.budget)
    setPastBags(list)
    openSaved(entry.at, 'saved')
  }
  const asBag = (b) => ({ items: b.items.map(toItem), budget: b.budget ?? null, budgetSet: Boolean(b.budgetSet), preferences: b.preferences ?? [], dietSet: Boolean(b.dietSet) })

  const finishSifting = useCallback(() => {
    setRanked(siftRanked)
    setRankedFor(siftKey.current)
    setScreen('results')
  }, [siftRanked])

  // The bag's needs: tap a sticker, or tell the buddy ("under $15", "walking distance", "I'm vegan").
  const needs = {
    budget,
    radius,
    diets,
    over: over > 0,
    onBudget: (b) => setBag((x) => ({ ...x, budget: b, budgetSet: true })),
    onRadius: setRadius,
    onDiets: (list) => setBag((x) => ({ ...x, preferences: list, dietSet: true })),
    onParsed: (n) => {
      setBag((x) => applyNeeds(x, n, bagDiets(x, profile)))
      if (n.radius) setRadius(n.radius)
    },
  }

  async function changeMode(nextMode) {
    if (nextMode === mode) return
    setMode(nextMode)
    setBusy(true)
    try {
      const res = await rank(nextMode)
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
      const res = await rank(mode)
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
    if (!force && ask && ask.question === question && ask.ranked === shownRanked && ask.status !== 'error') return
    const id = ++askId.current
    setAsk({ question, ranked: shownRanked, status: 'loading', data: null })
    try {
      const { data } = await askAgent({ question, ranking: { ranked_stores: shownRanked } })
      if (id === askId.current) setAsk({ question, ranked: shownRanked, status: 'done', data })
    } catch {
      if (id === askId.current) setAsk({ question, ranked: shownRanked, status: 'error', data: null })
    }
  }

  function openReceipt(id, from) {
    setReceiptId(id)
    setReceiptFrom(from)
    setScreen('receipt')
  }

  function changeTab(t) {
    setScreen(t)
  }

  const receiptStore = shownRanked.find((s) => s.store_id === receiptId)
  const savedOpen = pastBags.find((b) => b.at === savedAt)
  const tab = screen === 'savedBag' ? 'saved' : TAB_SCREENS.includes(screen) ? screen : 'bag'
  // Going "back" (to a shallower screen) reverses the screen-change rise.
  const prevScreen = useRef(screen)
  const navDir = (DEPTH[screen] ?? 0) < (DEPTH[prevScreen.current] ?? 0) ? -1 : 1
  useEffect(() => {
    prevScreen.current = screen
  }, [screen])

  // While a sheet is open the tab bar fades out (it keeps its space, so nothing jumps).
  const showTabs = phase === 'app' && !pickerOpen && !['sifting', 'receipt'].includes(screen)
  // Map tab: stores only, no bag. Last rank response's store list, else the mock list; by distance.
  const mapStores = useMemo(() => nearbyStores(ranked, home), [ranked, home])

  return (
    <MotionConfig reducedMotion="user">
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
                className={`no-scrollbar isolate min-h-0 flex-1 overscroll-contain ${screen === 'map' ? 'overflow-hidden' : 'overflow-y-auto'}`}
              >
                {/* screen change: fade + rise 8px, 260 ms ease-out; going back, the reverse */}
                <motion.div
                  key={screen}
                  className="relative grid min-h-full grid-cols-[minmax(0,1fr)]"
                  initial={{ opacity: 0, y: 8 * navDir }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                >
                {!SOIL.includes(screen) && <Backdrop aura={!NO_AURA.includes(screen)} />}
                {screen === 'bag' && (
                  <Bag
                    bag={bag}
                    setBag={setBag}
                    needs={needs}
                    products={products}
                    pastBags={pastBags}
                    saved={savedMatch}
                    onSave={saveCurrentBag}
                    onOpenSaved={(at) => openSaved(at, 'bag')}
                    onSift={() => sift()}
                    onPlace={() => {
                      setMeEdit('home')
                      setScreen('me')
                    }}
                    demo={demo}
                    place={place}
                    userName={profile.name}
                  />
                )}
                {screen === 'sifting' && (
                  <Sifting ranked={siftRanked && withinRadius(siftRanked, radius)} error={siftError} demo={demo} onDone={finishSifting} onBack={() => setScreen('bag')} />
                )}
                {screen === 'results' && (
                  <Results
                    ranked={shownRanked}
                    total={ranked.length}
                    radius={radius}
                    onRadius={setRadius}
                    over={over}
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
                    bagSummary={`${bag.items.filter(isRankable).length} items${budget == null ? '' : ` · $${budget}`}`}
                  />
                )}
                {screen === 'receipt' && receiptStore && (
                  <Receipt
                    store={receiptStore}
                    ranked={shownRanked}
                    siftedAt={siftedAt}
                    demo={demo}
                    onBack={() => setScreen(receiptFrom)}
                    onReport={() => setReportOpen(true)}
                  />
                )}
                {screen === 'map' && (
                  <MapTab stores={withinRadius(mapStores, radius)} user={home} demo={demo} radius={radius} onRadius={setRadius} />
                )}
                {screen === 'saved' && (
                  <Saved pastBags={pastBags} onOpen={(at) => openSaved(at, 'saved')} onNew={newBag} />
                )}
                {screen === 'savedBag' && savedOpen && (
                  <SavedBag
                    key={savedOpen.at}
                    pb={savedOpen}
                    products={products}
                    profile={profile}
                    radius={radius}
                    onRadius={setRadius}
                    onBack={() => setScreen(savedFrom)}
                    onChange={(patch) => setPastBags(updateSavedBag(savedOpen.at, patch))}
                    onRename={(name) => setPastBags(renamePastBag(savedOpen.at, name))}
                    onSift={(b) => {
                      const next = asBag(b)
                      setBag(next)
                      sift(next)
                    }}
                    onUse={(b) => {
                      setBag(asBag(b))
                      setScreen('bag')
                    }}
                    onDelete={(at) => {
                      setPastBags(removePastBag(at))
                      setScreen('saved')
                    }}
                  />
                )}
                {screen === 'me' && (
                  <Me profile={profile} setProfile={setProfile} pastBags={pastBags} onChangeBuddy={() => setPickerOpen(true)} initialEdit={meEdit} onEditOpened={() => setMeEdit(null)} />
                )}
                </motion.div>
              </main>

              {showTabs && <TabBar active={tab} onChange={changeTab} hidden={sheetCount > 0} />}
              <Toast toast={toast} />
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
    </MotionConfig>
  )
}
