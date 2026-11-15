# Build: tab bar, Map, Saved, Me (read with CLAUDE.md and POLISH-2.md)

Font roles and components from POLISH-2 apply: Darumadrop for headlines and the buddy, Karla for everything else, Courier only for money, receipts and sticker text. Use Wordmark.jsx, Sticker.jsx and Buddies.jsx; never redraw them.

## 0. Buddy name everywhere
- Store the chosen buddy id in localStorage (default "tom"). Use `BUDDIES` from Buddies.jsx for the name.
- Replace every hard-coded "Tom" with the chosen buddy's name and every Tom drawing with `<Buddy id={buddyId} />`: Bag headline, "Tell [Name] what you need", Sifting, Results line, Ask [Name] sheet, Receipt headline.

## 1. Segmented control label
Cheapest / [Name]'s pick / Closest, e.g. "Tom's pick". Same weights as Balanced (0.6 / 0.3 / 0.1) and still the default. Karla 600 15.

## 2. Tab bar
- Four tabs at the bottom of every main screen: Bag, Map, Saved, Me. Hidden on Sifting and Receipt, and while a sheet is open.
- Height 56 plus the safe area, eggshell background, a 1.5px #DCCDB2 top rule, no shadow.
- Each tab: a simple 22px ink outline icon (bag, map pin, bookmark, the buddy's face at 24px for Me) above a Karla 600 12 label. Selected: ink icon and label plus a small pea round sticker dot (8px) under the label. Unselected: muted #6E5A4E.
- On the Bag screen, the soil band from POLISH-2 sits directly above the tab bar, and "Sift my list" stays on the soil.

## 3. Map tab ("Stores near you")
- Full-screen version of the Results map (same paper-styled Leaflet, labels on scraps, torn edges), from the top safe area down to a bottom sheet.
- Every store is a round store-color numbered Sticker. Size by value for the current bag: best value md+ (40px), others sm (30px). With an empty bag, all the same size.
- Bottom sheet (kraft, torn top, grain, 260px tall, draggable to 520px): headline in Darumadrop 24 "6 stores within a mile"; then one row per store sorted by value: round sticker, name Karla 700 16, meta Karla 13 muted "0.4 mi · 8 min walk", basket total in Courier 700 15 on the right (or "Add items to compare" in Karla 13 muted when the bag is empty).
- Tap a store (pin or row): the map pans to it, its row highlights, and a "See receipt" button (ink, 44px) appears in the row. Receipt opens when there is a ranked result for the current bag.
- Uses the stores from the last rank-stores response; if none yet, call rank-stores with the current bag (or the demo basket) once on open.

## 4. Saved tab ("Saved bags")
- Headline Darumadrop 28 "Your bags". Below it, a two-column grid of the kraft past-bag cards from POLISH-2 (name, item count, winning store sticker, SAVED sticker), 12px gaps.
- Tap a card: load the bag into the Bag tab and switch to it. Pencil button on each card renames inline. Swipe left or a small "Remove" in an overflow deletes it (confirm with a sheet: "Remove this bag?").
- Every successful sift saves the bag automatically (localStorage, newest first, max 12), auto-named per POLISH-2.
- Empty state: the buddy (96px) and "Bags you sift will show up here." in Darumadrop 24.

## 5. Me tab (profile)
- Top: the buddy at 120px on a kraft card with Darumadrop 28 "Hi, I'm [Name]." and a Karla 600 15 "Change buddy" link that opens the picker.
- Buddy picker (full sheet, eggshell): Darumadrop 28 "Pick a buddy". 3-column grid of all 8 buddies at 88px, each with name in Karla 600 15 and kind in Karla 13 muted. Selected: a pea round sticker check on its corner and a 2px ink ring. Ink button "That one" saves and closes. The same picker is the first-launch screen (shown once, before the Bag).
- "Your details" (Karla 600 14 muted label), then receipt-paper rows (44px+ each, chevron on the right), each editable in a small sheet:
  - Name (optional, used for "Hi, [name]" on the Bag)
  - Home base: Grainger Hall (default) / Memorial Union / Use my location (browser geolocation; this becomes user_location)
  - Diet: chips for Vegetarian, Vegan, Gluten-free, Dairy-free (sent as `preferences`; the buddy never claims results are filtered)
  - Weekly budget: number, default $20 (sent as `budget`)
  - Default sort: Cheapest / [Name]'s pick / Closest
- "Accessories" row with a quiet dashed Sticker "SOON". No height, weight or measurements anywhere.
- Footer: Karla 13 muted "Prices: real where marked, simulated otherwise." and the attribution line.
- Everything saves to localStorage immediately; no backend changes.

## 6. Check
Walk the whole app at 390x844: first launch picker -> Bag -> Sifting -> Results -> Receipt -> report a price; then each tab. Backend on and ?demo=1. Change buddy to Lola and confirm her name and drawing appear on every screen.
