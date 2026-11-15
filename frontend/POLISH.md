# Polish pass (read with frontend/CLAUDE.md)

Goal: make every screen match the design canvas. Change layout and styling only; do not change data flow or API calls.

## 0. Stickers (biggest fix)
- Replace every sticker in the app with `src/components/Sticker.jsx` (provided). Mount `<StickerDefs />` once at the app root.
- Remove every existing SVG displacement/roughen filter that touches text. Text is never filtered anywhere, including the wordmark.
- Labels max about 14 characters. Store names are never stickers: show the name in Karla and a round numbered `<Sticker shape="round">` in the store's color beside it.
- At most two stickers per card.

## 1. Spacing system
- 8-point scale only: 4, 8, 12, 16, 24, 32, 48. Screen side padding 20. Gap between sections 24. Padding inside cards 16. Safe-area top padding 56, bottom 34.
- Type sizes: Darumadrop 28 (screen headline) / 22 (Tom's line on Results); Karla 20/700 store names, 17/400 body, 17/600 buttons; Courier 11-13 labels (700, caps, 0.12em tracking), 15 receipt lines, 22-24/700 totals.
- Corner radius: buttons and inputs 14, segmented control 12, cards 4 (paper has square-ish corners). Kraft bag card: torn top, square bottom corners (radius 0 to 4), never 16.
- Primary action sits at the bottom of the screen above the safe area (and above the tab bar once tabs exist), not floating mid-screen.

## 2. Bag
- Header row: wordmark left, "NEAR GRAINGER HALL" right, on one line, vertically centered.
- Tom 64px + headline "What do you need?" (Darumadrop 28) in one row, gap 12, 24 below the header.
- Bag rows 44px tall (not 56+). Row text Karla 17. The remove "x" is a 44px hit area but a 14px glyph in muted color.
- Move the input INTO the bag as its last row: "+ Tell Tom what you need" in muted Karla with the mic icon on the right. Enter adds the item. Remove the separate Add button.
- Need stickers (vegetarian, budget) sit in a row under the bag label.
- Past bags: horizontal row of small receipt-paper cards (bg #FFFCF5, 1.5px solid #DCCDB2, radius 4, padding 12, width 140): name in Karla 15/700 (e.g. "Weekly basics", or the first two items), meta in Courier 11 ("5 ITEMS · $18.20"), and the winning store as a small round numbered sticker. No dashed borders.
- "Sift my list" pinned at the bottom.

## 3. Sifting
- Replace the stack of long store-name stickers with a receipt that prints: a narrow receipt-paper strip under Tom where one Courier line types in per store as it is checked, e.g. "TARGET (STATE ST) ........ $17.49", 250 ms apart, with a small round store-color sticker at the start of each line. When the last line lands, go to Results.
- Tom 96px centered, "Checking shelves near you..." Darumadrop 28 under him.

## 4. Results
- Order under the map: segmented control, then Tom's line, then the best-pick card, then runner-ups, then the Ask Tom chips.
- Ask Tom chips: one horizontally scrolling row ("Why this store?", "Cheaper swap?", "Protein per $?"), Karla 14, height 36, outlined, placed after the runner-ups with a small Courier label "ASK TOM".
- Best-pick card (whole card is tappable, opens the receipt):
  - Row 1: store name Karla 20/700 left; total Courier 24/700 right, baseline aligned.
  - Row 2: Courier 12 muted: "0.7 MI · 14 MIN WALK · 5 OF 5 · MATCH 94%".
  - Row 3: "SAVES $0.84 VS NEARBY" as plain Courier 12/700 in olive (not a sticker); SIMULATED dashed sticker on the right only if any price is simulated.
  - BEST PICK sticker (pea, size md) hangs off the top-right corner, tilted 6 degrees.
  - Replace the "SEE RECEIPT" button with a right-aligned Courier 12/700 "RECEIPT >" text link.
- Runner-up rows: round numbered store sticker, name Karla 16/700, meta Courier 11 muted, total Courier 15 right. 56px rows, dashed separators.

## 5. Receipt
- Store name in Courier 16/700, centered, plain text (no sticker). Address line under it if available, then date/time, all centered.
- SIMULATED / REAL count goes in the footer only, not under the header.
- Line items: allow names to wrap to two lines (no ellipsis truncation); price aligned to the first line. Quantity prefix when more than 1: "2 x LARGE EGGS". Show line_total.
- Under each line, unit price and age in Courier 11 muted (keep). Add an "R" in olive after the price when real; STALE dashed sticker when stale.
- The screen scrolls; "Walk there" and "Saw a different price?" sit in a fixed bottom bar on eggshell with 20 side padding so they are never cut off.

## 6. Check
Run the full loop at 390x844 with the backend on and with ?demo=1. Nothing should overflow, truncate mid-word, or have warped text.
