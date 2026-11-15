# Polish pass 4 (final design pass; overrides every earlier file where they differ)

Layout, color and spacing only. Keep all data flow, voice and API behavior from VOICE-UPDATE.md.

## 1. Map tab is just "Stores near you"
- The Map tab has nothing to do with the bag. Remove basket totals, value-based pin sizes, "See receipt" and any rank-stores call from this tab.
- All pins are the same size: round numbered Sticker (md) in each store's color.
- Sheet rows: store sticker, name (Karla 700 16), "0.4 mi · 8 min walk" (Karla 13 muted), and a 44px directions button on the right. Tapping a pin or row highlights it, pans the map, and shows one full-width soil "Get directions" button in that row. Nothing else.
- Sheet headline: "Stores near you" (Darumadrop 24) with the count as Karla 13 muted beside it, e.g. "6 nearby". Stores come from GET /api/... data already loaded (store list from the last rank response or the mock store list); sort by distance.

## 2. Torn edges in exactly two places
- The zigzag torn edge appears only on: the bag card on the Bag screen (top edge) and the receipt (top and bottom).
- Remove it everywhere else: map bottom edges, bottom sheets, tab bar, past bags, the Me screen, the Results sheet, Ask sheet, report-price sheet.
- Replacements: the map simply ends and the content below sits on eggshell; bottom sheets are eggshell (#F7F1E3) with a 20px top radius, a 36x4 muted grabber, and a 1.5px #DCCDB2 top rule; the tab bar has a straight 1.5px #DCCDB2 top rule.
- Kraft (#D9BE90) is used only for the bag card. Sheets are no longer kraft.

## 3. Pops of color, used on purpose
The page stays eggshell, but color now carries meaning in more places. Use flat fills only, never gradients.
- Buddy splotch: behind the buddy on Bag, Sifting, Receipt header and Me, place a soft organic blob (an irregular rounded shape, about 1.4x the buddy's size, rough edge via #sift-sticker-edge) in the buddy's sticker color at 35% opacity, offset slightly so it overlaps like a riso print. Tom: tomato; Lola: butter; etc. (BUDDIES[].sticker).
- Store color: each store's color shows on its pin, its number sticker, and as a light wash (its color at 14% opacity) on the background of the best-pick card and the receipt header band (a 56px band at the top of the receipt behind the store name). Runner-up rows stay eggshell.
- Past bags: each card's background is a different pop color at 22% opacity (rotate through pea, butter, sardine, radish, clementine), receipt-paper inner area not needed; name in Karla 700 16 ink, item count Karla 13 muted, then the winning store's round sticker and a butter "SAVED $1.10" sticker overlapping the top-right corner.
- Need stickers on the bag (VEGETARIAN, $20 BUDGET) use pea and butter; quantity numbers sit in a small butter round sticker when more than 1.
- Ask chips: outlined in ink with a small colored dot (the store's color for store questions, pea for swaps, butter for protein).
- Segmented control selected state stays ink. Primary buttons stay soil.
- Never more than three pop colors visible in one card.

## 4. Tab icons
Use the new TabIcons.jsx (v2): one flat splotch per tab, no outlines. Icon 28px, label Karla 600 12. Selected: icon in color, label ink. Unselected: muted icon, label #9C8B7D.

## 5. Me screen
- Nothing may be cut off: the screen scrolls, with bottom padding equal to the tab bar height plus 24.
- Remove the kraft card. Top: buddy (112px) on its color splotch, centered, "Hi, I'm Tom." (Darumadrop 28) and "Change buddy" (Karla 600 15 link) under it.
- "Your details" rows on receipt paper (#FFFCF5, 1.5px #DCCDB2, radius 4), 52px rows, label Karla 600 15 left, value Karla 15 muted right, chevron.

## 6. Spacing and alignment (final pass, every screen)
- Side margins 20 everywhere. Section gap 24. Card padding 16. Row height 52 (lists), 44 (bag rows).
- Top: content starts 56 below the top edge; screen headlines Darumadrop 28, 8 below the header row.
- Bottom: every scrollable screen pads its content by tab bar height + 24 so nothing hides under the bar. Primary buttons sit 16 above the tab bar.
- One alignment edge: text, cards, stickers and buttons all line up on the 20px margins. Stickers that hang off a corner may overhang by up to 10px only.
- Vertical rhythm: label to content 8, content to next label 24. No double gaps.
- Remove any leftover letter-spaced uppercase outside stickers and the receipt.

## 7. Check
At 390x844, screenshot Bag (with a dashed confirm row and a need sticker), Sifting, Results, Receipt, Ask, Map with a store tapped, Saved (3+ bags) and Me (scrolled to the bottom). Nothing cut off, torn edges only on the bag and receipt, color visible on every screen.
