# Polish pass 6 (small and final; overrides earlier files where they differ)

## 1. Saved bags are flat
- Use the updated `MiniBag` and `BAG_COLORS` from Motifs.jsx: one solid light pop color, the same zigzag torn top as the main bag, no lip, no creases, no transparency, no shading. Everything in the app is flat and printed.
- Saved bags are the third place torn edges are allowed (they are bags).

## 2. Map: color and zoom
- The map looks gray. Switch tiles to CARTO Voyager no-labels (`https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png`) and soften the recolor to `filter: sepia(0.2) saturate(1.05) brightness(1.03);`. Remove the multiply overlay; keep the grain at low opacity (0.15). Water should read blue, parks green, streets cream.
- Zoom must work everywhere: `touchZoom`, `doubleClickZoom` and `boxZoom` on; `scrollWheelZoom` on in the Map tab, off on the Results map. Add two small round buttons (+ and -, 40px, eggshell, 1.5px #DCCDB2, Karla 600 18) stacked at the right edge on both maps, above the recenter button. Zoom range 12 to 17.

## 3. Search radius on both maps
- A row of four pills just under the map on both the Results screen and the Map tab: "0.5 mi", "1 mi", "2 mi", "3 mi" (Karla 600 14, height 36, radius 18). Selected: soil fill with eggshell text. Default 2 mi. Saved in localStorage and shared by both screens.
- The map draws the radius as a soft circle around the user: pea fill at 8% with a 1.5px pea (#9DBE5A) outline. Changing the radius animates the circle (300 ms) and fits the map to it.
- Stores outside the radius disappear from the pins and lists. On Results, the ranking shows only stores inside the radius; if none are inside, the buddy says "Nothing that close. Try a bigger circle." and the 3 mi pill gently pulses once. No API change; filter by distance_miles on the client.

## 4. Me screen with more life (still calm)
- "Your details" rows: each row starts with a small flat splotch icon (24px, same style as the tab icons, rough edge, no outline): Name in radish, Home base in sardine, Diet in pea, Weekly budget in butter, Default sort in clementine, Accessories in beet. Values on the right appear as small soft chips in the matching color at 22% (e.g. "Dairy-free" on a pea chip, "$20" on a butter chip), Karla 600 14.
- Above the details, a "Your Sift so far" strip: two stickers side by side, a butter "SAVED $4.05" and a pea "3 BAGS", both computed from saved bags in localStorage, with Karla 13 muted "since you started". Tilted a few degrees each.
- Row container: receipt-paper card with 1px #E6DCCB hairlines between rows, 56px rows, radius 6. 24px between groups. The screen scrolls fully above the tab bar.

## 5. Bag stickers: one system
The stickers on the bag are the shop's "needs": the few things that shape where you should buy. They are the only place these appear on the bag.

- Label line: "Your bag · 5 items" only (Karla 600 14). Remove "Budget $20" from the label; budget lives in its sticker.
- Sticker row: directly under the label, left-aligned on the 20px margin, 8px gap, max 4 stickers, size sm, fixed tilts in order (-4, 3, -2, 4). Same row on the Saved Bag edit screen.
- Exactly three kinds, always in this order:
  1. Budget, butter, always present: "$20 BUDGET". Default from Me (Weekly budget). Tap: small sheet with a number field and "No budget" (then the sticker reads "NO BUDGET" in the quiet dashed style).
  2. Distance, sardine, always present: "WITHIN 2 MI". Mirrors the map radius pills both ways (changing one changes the other).
  3. Diet, pea, zero to two: "VEGETARIAN", "VEGAN", "GLUTEN-FREE", "DAIRY-FREE". Default from Me (Diet). Tap: sheet with the four options as toggles and the line "Noted for later. Results aren't filtered by diet yet." (Karla 13 muted), honest until the backend supports it.
- How they get set: from Me (defaults for every new bag), by tapping a sticker, or by telling the buddy. Sentences are matched before item parsing: "under $15" or "budget 15" sets Budget; "nothing far", "walking distance" or "within 1 mile" sets Distance (walking distance = 1 mi); "I'm vegan", "vegetarian", "gluten free", "no dairy" set Diet. The buddy confirms in one line: "Got it, $15 budget." A changed sticker lands with the sticker motion from POLISH-5.
- What they do: Budget is sent as `budget`; Distance filters stores (POLISH-6 section 3); Diet is sent as `preferences`. After sifting, if the best total is over budget, the buddy's line on Results says "That's $1.20 over your $20." and the budget sticker on the bag shows "$20 BUDGET" in tomato with eggshell text until the bag changes.
- Never any other sticker on the bag: no item stickers, no store stickers, no decorative ones.

## 6. Check
Bag (sticker row: budget, distance, a diet sticker set by voice or typing), Saved tab and Bag (flat bags), both maps (zoom with buttons and pinch, radius pills changing the circle and the list), Me scrolled top to bottom. Screenshots at 390x844.
