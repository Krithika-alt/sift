# Sift frontend (Role 3: frontend and design)

Context for Claude Code. Read this file and section 3 of the team build plan (data tables, scoring formula, API contract) before writing frontend code. Design source of truth: the "Sift brand exploration" design canvas, pages "Brand system (locked)", "Rules + interface" and "User flow".

## Project
Sift, MadHacks 2026 (UW-Madison, Nov 14-15). Submit by Sunday Nov 15, 11:30 AM (deadline 12:00 PM). Judging 1-3 PM.
A user tells Sift their grocery list. Sift ranks nearby Madison stores by total basket cost, distance and stock, shows one winner with a receipt as proof, lets users report a live price, and a produce buddy explains why a store won.
Honesty rules: real prices are labeled real, generated ones simulated, on screen too. The ranker is a scoring model with tunable weights; never call it ML or deep learning. All project code is written during the event.

## Platform
- iOS-style, mobile-first web app: React + Vite + Tailwind. Layout targets an iPhone viewport (390 x 844). Demo in an iPhone-sized browser window or added to the home screen.
- API base URL in one config value: VITE_API_BASE. The frontend never talks to Databricks.
- DEMO_MODE (VITE_DEMO_MODE=true or ?demo=1) serves mock JSON from the frontend, including a local copy of the section 3 scoring, so the full hero loop works offline. Also fall back to mock data automatically if the backend errors or times out (about 4 s; ask-agent excepted, see below), with a small honest "DEMO DATA" label.
- Default location: Grainger Hall, lat 43.0727, lon -89.4015. Demo basket: eggs, oats, greek yogurt, chicken breast, bananas. Budget $20.
- Use the JSON contract exactly. Do not invent fields or endpoints.

## Backend (from Role 1)
- Run it locally in mock mode, no secrets. From repo root:
  `cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && DATA_SOURCE=mock uvicorn main:app --reload`
  API at http://localhost:8000, interactive docs at http://localhost:8000/docs. Set VITE_API_BASE=http://localhost:8000. CORS is open to all origins. Live data later via a tunnel URL from Role 1.
- Endpoints: POST /api/rank-stores, POST /api/report-price, POST /api/ask-agent, GET /api/products, GET /api/health (section 3).
- Additions beyond section 3:
  - Each items_breakdown item also has `price_age` (e.g. "8 hrs ago") and `stale` (true if older than a week).
  - /api/ask-agent returns `answer`, `headline` (one line), `facts_used`, `source`. Genie takes 10 to 25 seconds.
  - rank-stores accepts optional `"preferences": ["vegetarian", ...]` but ignores it for now.

## Brand rules
Principles: one element, one job (lettering = logo, stickers = labels on content, kraft = a surface). Everything looks hand-made: flat color, rough edges, grain; no gloss, drop shadows, blur or gradients. Color is 60/30/10: eggshell page, earth surfaces (kraft, soil), sticker colors. App icon and splash match. Darumadrop speaks, Karla explains, Courier counts.

Colors (CSS tokens):
- --eggshell #F7F1E3 page background (faint grain)
- --receipt #FFFCF5 cards and receipts
- --ink #2B1D18 all text, primary buttons, selected segment
- --muted #6E5A4E secondary text
- --line #DCCDB2 dashed and dotted rules, card borders
- --kraft #D9BE90 the bag (list card) and bottom sheets only
- --soil #4A2E22 splash, app icon, hero logo only
- --leaf #A6C566 logo leaf on soil; --olive #56603A logo leaf on eggshell
- Sticker colors, all equal weight. Ink text on: clementine #F08A3C, butter #F0CB5C, pea #9DBE5A, sardine #7DA3E0, radish #F2A7B5. Eggshell text on: tomato #C8402A, olive #56603A, beet #7A2A40.
- Each store owns one sticker color, used on its map pin, its tags and its receipt.

Fonts (Google Fonts, nothing else):
- Darumadrop One: headlines and anything the buddy says. 22px and up, at most one line per card.
- Karla: everything read or tapped. Store names 700 (20-22px), body 400 (15-17px), buttons 600 (17px).
- Courier Prime: every price, distance, label, receipt and sticker. Labels 700, uppercase, 1.5-3px letter spacing.
- Never set two of the three at the same size side by side.

Text is never distorted. Rough or displacement filters apply only to shapes (sticker ovals, torn edges, map pieces), never to text or wordmark letters.

Texture: riso style. Flat fills with fine pale flecks and soft overlapping shapes (multiply where they overlap). Soil gets a fine film grain (SVG feTurbulence, baseFrequency about 1.1, light and dark specks at low opacity), never coarse pixel noise. Paper surfaces get a faint grain. Kraft has a torn zigzag top edge; receipts have zigzag torn ends.

Logo: "sift" hand-lettered in Darumadrop One; the i is a short stem with a leaf as its dot. Primary: eggshell letters and #A6C566 leaf on soil. In-app header: ink letters and olive leaf on eggshell. Never inside a sticker, box or badge. No standalone leaf symbol. Minimum 28px tall.

App icon and splash: soil with fine film grain and the eggshell lettering, nothing else. Splash adds "Your list. Our pick." (Darumadrop) and "CHECKING SHELVES NEAR YOU" (Courier, bottom).

Stickers: flat oval, rough edge, Courier Prime bold caps, tilted 3-8 degrees. They label content only: BEST PICK (pea), REAL PRICE (olive), SAVES $X (butter), store names and map pin numbers (store color). At most two per card; BEST PICK may hang over the card corner. SIMULATED and STALE are outlined with a dashed border, quiet, but always shown. A sticker never contains the logo.

Buddies (produce only): Tom Tomato, Cal Carrot, Bea Beet, Pip Pea, Penny Potato, Brock Broccoli, Moe Mushroom, Lola Lemon. Flat shapes, closed content eyes, tiny mouth, each with its own sticker color. One buddy per screen, beside a headline; speaks only in Darumadrop. Default buddy: Tom.

Voice: calm, plain, warm, short sentences, no exclamation marks. "Saw a different price?" not "snitch". Always say when something is simulated. Loading copy: "Checking shelves near you".

Accessibility: text contrast 4.5:1 or better; touch targets 44px or more; color is never the only signal (pins carry numbers, stickers carry words).

## User flow
Core loop (this is the demo): Splash -> Pick your buddy (first launch only) -> Bag -> Sifting -> Results -> Receipt.

1. Splash: calls GET /api/health (wakes the warehouse), about 1 second.
2. Pick your buddy: 3x3 grid of buddies, one tap, "That one". Saved in localStorage. Accessories later only if time allows.
3. Bag (home, bag-first layout): header with wordmark and "NEAR GRAINGER HALL"; buddy plus Darumadrop line "What do you need?"; the bag is a kraft card with a torn top, label "YOUR BAG · N ITEMS · BUDGET $20", one row per item with remove; a single input "Tell Tom what you need".
   - Short entries become bag items (autocomplete from GET /api/products).
   - Sentences like "I'm vegetarian" or "under $20" become need stickers on the bag; send them as `preferences` (budget updates `budget`). Tom replies in one line: "Noted. I'll keep that in mind." He never claims results are filtered.
   - Primary button "Sift my list". Below it, a row of past bags.
4. Sifting: Tom says "Checking shelves near you..."; store stickers pop in one by one while POST /api/rank-stores runs.
5. Results: torn-paper map on top with numbered store stickers and the user dot; eggshell sheet with a torn top; segmented control Cheapest / Balanced / Closest (re-calls rank-stores with weights Cheapest 0.85/0.1/0.05, Balanced 0.6/0.3/0.1, Closest 0.25/0.7/0.05 for price/distance/preference); Tom's one-line reason in Darumadrop; best-pick card (store, total, distance, items found, "SAVES $X VS NEARBY", "SEE RECEIPT") with a BEST PICK sticker on the corner; runner-ups as rows with store-color number stickers. Re-sorting animates. Under Tom, 3 question chips open Ask Tom.
6. Receipt: only Courier Prime on the receipt. Zigzag torn ends; centered store, address, time; dashed rules; each line item with dotted leader, price, an R marker if real, and price_age in muted text (STALE sticker if stale); bold TOTAL; savings vs nearby average; walk distance; "N REAL · N SIMULATED"; a barcode; "THANKS FOR SIFTING". Tom speaks above the receipt, never on it. Primary button "Walk there" (opens Apple Maps); link "Saw a different price?".

Branches:
- A. Saw a different price?: kraft bottom sheet (item, price, in stock, Send) -> POST /api/report-price -> rank-stores again; the store that moved gets a sticker slap and slides up. This is the demo's best moment; test it early.
- B. Ask Tom: kraft bottom sheet from the 3 chips ("Why this store?", "Cheaper swap?", "Protein per dollar?") -> POST /api/ask-agent. Show Tom "Thinking..." with a slow three-dot pulse; the sheet can be closed while waiting; no 4 s fallback here, time out at 40 s with a calm message. Render headline in Darumadrop, answer in Karla, facts_used as small Courier receipt lines, source as a muted Courier footer.

Tabs (bottom, quiet): Bag, Map, Saved, Me.
- Map: all stores as produce-shaped blobs on the torn-paper map, sized by value for the current bag, each with a total sticker. Tap a store for its receipt.
- Saved: past bags (localStorage); one tap re-sifts.
- Me: buddy, location, diet, budget (localStorage). No height, weight or measurements.

Map style: a torn-paper collage of the Madison isthmus rather than map tiles. Lakes Mendota and Monona as pale blue cut shapes, parks as pale green shapes, streets as cream paper strips, each with a pale fiber rim and a rough edge. If Leaflet is used, overlay or style it to match; the hand-made look matters more than exact streets for the demo.

## Build order
1. Scaffold, tokens, fonts, API client with DEMO_MODE.
2. Bag, Sifting, Results, Receipt, the report-price sheet (hero demo). Checkpoint: works on mock data by about 1:30 AM.
3. Connect to the local backend, test report-price -> re-rank.
4. Ask Tom sheet.
5. Map, Saved, Me tabs, then the buddy picker and splash polish.
6. Freeze features at 9 AM; bugs and polish only after.

## Voice (frontend builds the mic; backend endpoint exists)
- New endpoint: POST /api/parse-list with {"text": "<speech transcript>"}. Returns `items` (each with `text`, `quantity`, `matched`, `name`) and `rank_items`.
- Flow: mic button -> browser Web Speech API (`window.SpeechRecognition || window.webkitSpeechRecognition`, lang en-US, interimResults on for live text, no key) -> on the final transcript, POST /api/parse-list -> add the returned items to the bag -> when the user taps "Sift my list", send `rank_items` (not the raw chip text) as `items` to /api/rank-stores.
- Bag rows from voice: show `name` (with quantity if more than 1). If `matched: false`, show the original `text` with a quiet dashed "NOT FOUND" sticker (same style as SIMULATED) and Tom says "I couldn't find [text]. Try another word?" Unmatched items are not sent to rank-stores.
- Entry point: a mic button (44px, ink outline icon, no color) inside the "Tell Tom what you need" input on the Bag screen. While listening: Tom's line is "Listening..." in Darumadrop with the same slow three-dot pulse as "Thinking...", and the live transcript appears in the input in muted text. Tap again to stop. No waveforms, no bright colors.
- Typing stays as the fallback for noisy rooms and works exactly as before. If speech recognition is unsupported or permission is denied, hide the mic and keep typing.
- In DEMO_MODE, parse-list is mocked locally by splitting the transcript on commas and "and" and matching against the mock products.
- Optional if time allows: Tom speaks his one-line replies aloud (speechSynthesis) with a mute toggle on the Me tab.
- Mic access only works on localhost or HTTPS. Voice is a bonus: the core loop must keep working without it.
