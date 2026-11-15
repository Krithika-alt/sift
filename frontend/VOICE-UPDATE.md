# Voice and pricing update (from Role 1, live on the tunnel). Read with CLAUDE.md.

Fonts and components as in CLAUDE.md: Karla for UI text, Courier only for money and the receipt, Darumadrop only for headlines and the buddy. Use Sticker.jsx and Buddies.jsx.

## 1. Speech capture
- `rec.maxAlternatives = 3`. On the final result, send the top transcript as `text` and the other guesses as `alternatives`:
  POST /api/parse-list `{ "text": "...", "alternatives": ["...", "..."] }`
- Keep continuous, interim results for live text, final results only for parsing, typing as fallback.

## 2. Bag rows from parse-list (the confirm step)
Each returned item becomes a bag row. Three kinds:

a) Matched, `needs_confirm: false`: normal row. Name in Karla 17, quantity stepper, remove.

b) Matched, `needs_confirm: true` (fuzzy, phonetic or alternative match): the row has a dashed #6E5A4E border and a receipt-paper (#FFFCF5) fill instead of sitting flat on the kraft.
   - Text: "Did you mean **Toilet paper, 12 rolls**?" (Karla 16, product name in 600).
   - Two 44px round buttons on the right: confirm (ink outline check) and reject (ink outline x). Confirm turns it into a normal row. Reject removes it.
   - The buddy line above the bag changes to "Check the dashed ones for me." (Darumadrop) while any row still needs confirming.

c) Not matched (`matched: false`): same dashed treatment.
   - With suggestions: "Couldn't find **cereal**." then up to 3 outlined chips (Karla 600 14, height 36): "Oats?" using a short form of each suggestion name. Tapping one replaces the row with that product as a normal row.
   - With no suggestions: "Couldn't find **cereal**." plus "Edit" (puts the text back in the input) and remove.

- "Sift my list" stays disabled (soil at 40% opacity) while any dashed row remains, with Karla 13 muted under it: "Confirm 2 items first".
- Never show `match_type` or `confidence`.

## 3. Ranking with quantities
- After confirming and editing, build `items` from the confirmed rows as `{ "text": <product name>, "quantity": <n> }` (the same shape as `rank_items`; when rows were not edited you can send `rank_items` straight through) and POST /api/rank-stores with `user_location`, `weights`, `budget` and `preferences`.
- Store total is `total_basket_price`.

## 4. Receipt lines
- Line label: "2 x WHOLE MILK, 1 GAL" when quantity is more than 1. Right column is `line_total`.
- Second line (Courier 11 muted): unit price and price age as now.
- If `pack_note` is present, add a third line (Courier 11 muted): "SMALLER PACK · SHELF $1.49 · SHOWN PER 2 LB FOR A FAIR COMPARE". Build it from `shelf_price` and the size in the product name. Never show shelf_price as the main price.

## 5. Ask the buddy
- POST /api/ask-agent `{ "question": "<full question text>", "ranking": <the full last rank-stores response> }`. Chips map to full questions with real names, e.g. "Why did Trader Joe's (Monroe St) win?", "What can I swap to save money at Trader Joe's (Monroe St)?", "Which store has the cheapest protein per dollar?".
- Loading: buddy "Thinking..." with the slow pulse; timeout 40 seconds; the sheet can close while waiting.
- Show `headline` (Darumadrop 24, wraps, never truncated) then `answer` (Karla 17).
- Badge under the answer: if `source` is "genie" and `verified` is true, an olive Sticker "CHECKED AGAINST PRICES"; if `source` is "grounded", Karla 13 muted "Answered from our price tables".
- `note`, if present: Karla 12 muted under the badge. `facts_used`: small Courier receipt lines, collapsed behind a "Show the numbers" Karla 600 14 link.

## 6. Check
Say "two gallons of milk, a dozen eggs, bred and paper towels" (or type it): milk x2 and eggs normal, bread or toilet paper as dashed confirm rows. Confirm, sift, open the receipt, check line totals and any pack note. Ask "Why did ... win?" and wait for the badge.
