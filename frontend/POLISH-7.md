# Polish pass 7 (final audit; overrides earlier files where they differ)

Visual and copy fixes only. No new features, no API changes.

## 1. Top aura and grain (every eggshell screen)
- Add a soft "aura" behind the top of every main screen (Bag, Results, Map, Saved, Saved Bag, Me, Receipt): an absolutely positioned layer, 320px tall, pointer-events none, behind content:
  `background: radial-gradient(120% 70% at 30% 0%, <buddy color> 0%, transparent 70%), radial-gradient(90% 60% at 85% 10%, #9DBE5A 0%, transparent 65%); opacity: 0.08;`
  where the buddy color is the buddy's sticker color (Bob: olive, Tom: tomato, Lola: butter...). This is the one allowed gradient in the brand: very faint, like light on soil. Barely there: ambience, not a color you notice. Never above 0.10 opacity, never on cards or buttons.
- Paper grain over the whole page, above the aura and below content: the existing grain at opacity 0.28 on every eggshell screen, and the film grain on soil screens (splash, sifting). Check it is actually rendering on every screen; it should be visible up close and invisible from arm's length.
- On the Map tab and Results, the map covers the top, so no aura there; the grain still sits over the map at 0.15.

## 2. Buddy rename
- Use the updated Buddies.jsx: the broccoli buddy is now "Bob" (id stays "brock" so saved settings keep working). Every label follows: "Bob's pick", "Tell Bob what you need", "Hi, I'm Bob."

## 3. Dirt patch reads as soil, not a gray stone
- Use the updated DirtPatch styling: fill #8A6A4C at 22% (warm, not gray), a slightly darker top edge (#4A2E22 at 12%, 3px, following the top curve), specks at 28%. Size 1.3x the buddy width (smaller than now). The buddy overlaps the patch's upper 40%.
- On soil screens (Sifting) never draw the patch.

## 4. Sifting screen
- The receipt strip must never show empty: the first line appears immediately (the nearest store), the rest every 250 ms. While waiting for the response, show three slow pulsing dots inside the strip.
- The strip gets the zigzag torn top and bottom like the Receipt, width 300, centered.
- Layout: buddy (96px) centered, then the line "Digging through 6 stores..." centered under it in eggshell Darumadrop 28 (not beside the buddy), then the strip. 24px between each.
- Remove the stray sprouts and the dirt patch on this screen.

## 5. Results
- Two control rows is one too many. Keep the segmented control (Cheapest / Bob's pick / Closest) under the map. Move the radius to a small pill on the map's top-right (under the "5 items · $20" pill): "2 mi" with a small chevron, sardine wash; tapping opens a tiny popover with 0.5 / 1 / 2 / 3 mi. The Map tab keeps the full pill row.
- Pins never overlap: when two pins are within 22px, nudge them apart along the line between them (spiderfy-lite), keeping a thin ink tick to the true spot if moved more than 10px.
- Runner-up rows: stickers (BEST UNIT PRICE, CROWD-CHECKED) sit on the meta line under the name, never next to the price. The price column is a fixed 72px, right-aligned, so totals line up.
- The best-pick card gets the store-color wash (14%) as specified in POLISH-4 if it is missing.

## 6. Ask sheet: Darumadrop only for short lines
- If `headline` is 60 characters or fewer: Darumadrop 24. If longer: show it in Karla 700 18 instead (long handwritten text is hard to read). The answer body is always Karla 17, line-height 1.5.
- The question at the top of the sheet: Karla 600 15 ink, close button 44px aligned to its first line.

## 7. Bag screen copy and details
- Capitalize the user's name in greetings: "Hi, Bob." even if typed as "bob".
- The greeting headline wraps to two lines max at Darumadrop 28; if the name is long, drop to "What do you need?".
- Saved bags row on the Bag screen: show the flat mini bags (same as the Saved tab) at 132 x 150, horizontally scrolling, the last one half visible.

## 8. Me screen: calmer
A middle ground between the plain version and the colorful one:
- Keep the colored splotch icons at the start of each row (they are the one color moment in the list).
- Values go back to plain text: Karla 15 muted, right-aligned, no colored chips. Exception: "Soon" on Accessories stays as the quiet dashed sticker.
- "Your Sift so far": keep it, but as one line of Karla 15 ink, e.g. "$4.04 saved across 3 bags", with only the amount as a single small butter sticker ("$4.04"). No pea "3 BAGS" sticker.
- The buddy's dirt patch and the faint aura stay. No other color on this screen.

## 9. Check
At 390x844: Bag (aura, grain, warm dirt patch, "Bob"), Sifting (centered, lines printing immediately), Results (one control row plus the radius pill on the map, no overlapping pins, aligned prices), an Ask answer with a long headline (Karla), Map tab, Saved, Me. Grain visible on every screen up close.
