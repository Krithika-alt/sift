# Polish pass 2 (read after CLAUDE.md and POLISH.md; this file wins where they disagree)

Layout, styling and copy only, plus the past-bag naming and the map change below. No API changes.

## 1. Wordmark
Replace every logo in the app with `src/components/Wordmark.jsx` (provided). Header: `<Wordmark size={34} />`. Splash and Sifting: `<Wordmark size={120} onSoil />`. Delete any other leaf or logo drawing.

## 2. Font roles (stricter than before)
- Darumadrop One: screen headlines and anything Tom says. Nothing else.
- Karla: everything else, including labels and meta lines. Section labels are Karla 600, 14px, sentence case, muted (#6E5A4E): "Your bag", "Past bags", "Ask Tom". Meta lines are Karla 500, 13px, muted: "1.0 mi · 19 min walk · 2 of 2 · 93% match". Location in the header: Karla 600 14 "Near Grainger Hall".
- Courier Prime: only money and the receipt. Prices and totals anywhere (Courier 700), the whole receipt, and sticker text. No Courier for labels, distances, counts, "Receipt >", "Source", or the Bag label.
- Remove letter-spaced uppercase everywhere except inside stickers and on the receipt.

## 3. Dirt moments (the theme, used deliberately)
- Sifting screen becomes soil: full-screen #4A2E22 with the same fine film grain as the splash. Tom (96px) at top with eggshell Darumadrop 28 "Digging through 6 stores...". Below him a receipt-paper strip (#FFFCF5, zigzag torn top and bottom, width 300) that prints one line per store, 250 ms apart: round store-color Sticker, store name in Courier 14, dotted leader, total in Courier 700. Lines slide up out of the soil (translateY 12px -> 0, opacity 0 -> 1). When the best store's line lands it gets a small pea BEST PICK sticker, hold 600 ms, then go to Results.
- Bag screen: the bottom 120px is a soil band with a torn top edge and film grain; "Sift my list" sits on it as an eggshell button with ink text (the only inverted button in the app).
- Copy: Tom on Results after sifting: "Dug up your best deal." (Cheapest: "Cheapest bag, 1.0 mi away." stays as the reason line under it if needed, keep one line). Receipt footer: "DUG UP BY SIFT" replaces "THANKS FOR SIFTING". Empty bag: "Add a few things and I'll start digging."

## 4. Past bags
- Each past bag is a small kraft bag card (bg #D9BE90, zigzag torn top, faint grain, width 156, padding 12, square corners).
- Inside: the bag's name in Karla 700 16 (two lines max); "5 items" in Karla 13 muted; the winning store as a round store-color Sticker (size sm) and a butter Sticker "SAVED $1.10" (size sm), both tilted differently, overlapping the card's top-right edge slightly.
- Names: auto-name from contents with simple rules (eggs + oats + yogurt -> "Breakfast run"; chicken + rice -> "Dinner basics"; otherwise the first two items, e.g. "Eggs & oats"). Long-press or a small pencil button (44px target) renames inline; save to localStorage.
- Tap a past bag: load it into the bag. The list scrolls horizontally with 12px gaps and 20px edge padding; the last card is half visible to hint at scrolling.

## 5. Map: real streets, paper style
Replace the abstract SVG with a real Leaflet map, styled to look like the torn-paper map:
- Tiles: CARTO light_nolabels (https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png, attribution "© OpenStreetMap contributors © CARTO"). Center on Grainger Hall, zoom 14, no zoom control, no attribution box over the content (put attribution as a tiny Karla 10 muted line under the map).
- Recolor the tile pane with CSS: `.leaflet-tile-pane { filter: sepia(0.45) saturate(0.55) hue-rotate(-8deg) brightness(1.02) contrast(0.92); }` and lay a multiply eggshell overlay (#F7F1E3, opacity 0.35) plus the paper grain on top, pointer-events none.
- The map's bottom edge is torn (zigzag), as now.
- Hand-placed labels on small eggshell paper scraps (Karla 600 12, tilted 1-3 degrees, rough edge on the scrap only): "Lake Mendota", "Lake Monona", "State St", "University Ave", "Capitol", "UW campus". Use Leaflet markers with divIcons at real coordinates.
- Store pins: round numbered store-color Stickers (size md) as divIcons. The user: ink dot with eggshell ring and a small "You" scrap.
- If tiles fail to load (offline demo), fall back to the current SVG map.

## 6. Results cleanups
- "SIMULATED" on every row is noise. If all prices in the result are simulated, show one quiet line under the runner-ups: "All prices here are simulated for the demo." (Karla 13 muted). Otherwise show the dashed SIMULATED sticker only on stores that have simulated prices.
- Best-pick card: "Receipt >" in Karla 600 15, not Courier. "Saves $1.10 vs nearby" in Karla 600 14 olive.
- Back button "< My bag": a plain 44px circle with the chevron, no text, eggshell, like the brand board.

## 7. Ask Tom sheet
- Headline never truncates: wrap to two lines max at Darumadrop 24. If the answer starts with the same sentence as the headline, drop that sentence from the answer.
- Replace "SOURCE: GROUNDED" with: if `verified`, an olive Sticker "CHECKED AGAINST PRICES"; otherwise a Karla 13 muted line "Based on our price tables". `note` as a Karla 12 muted footnote.

## 8. Check
390x844, backend on and ?demo=1. Count the fonts on each screen: Courier should appear only on prices, the receipt and stickers.
