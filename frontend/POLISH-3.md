# Polish pass 3 (small, final; overrides earlier files where they differ)

## 1. Directions
- Rename "Walk there" to "Get directions" everywhere.
- It opens `https://maps.apple.com/?daddr=<lat>,<lon>&q=<store name>` with no travel mode, so the user can choose walking, driving or transit in Maps. On non-Apple devices use `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lon>`.
- Receipt "Walk 0.96 mi · about 19 min" stays as information.

## 2. Primary buttons are soil
- Remove the soil band at the bottom of the Bag screen.
- Every primary button (Sift my list, Get directions, That one, Send) is soil #4A2E22 with eggshell #F7F1E3 text, Karla 600 17, radius 14, 56px tall. The selected segment in the segmented control stays ink.
- "Sift my list" sits at the bottom of the Bag screen, 16px above the tab bar.

## 3. Tab bar
- Use `src/components/TabIcons.jsx` (provided): `<TabIcon name="bag|map|saved" selected={...} />`. For Me, `<Buddy id={buddyId} size={30} />`; when unselected add `style={{ filter: 'grayscale(1) opacity(0.55)' }}`.
- Bar: eggshell #F7F1E3 with a zigzag torn top edge (same as the kraft edge, 8px, color #DCCDB2 as a thin paper lip) instead of the straight hairline. Height 64 plus the safe area.
- Each tab: icon 30px above the label, 4px gap. Label Karla 600 12, ink when selected, #9C8B7D when not. Remove the green dot under the selected tab; the selected icon is already in full color and tilted.
- 44px minimum hit area per tab; tabs evenly spaced.

## 4. Map labels
- Labels must never sit under a pin or get cut off. Hide a label when a pin is within 28px of it, and nudge "You" to the side of the user dot away from the nearest pin.
- Keep: Lake Mendota, Lake Monona, Capitol, UW campus, State St, University Ave, You. Show street labels at 11px only when the map is at full size (Map tab), not on the Results strip.
- Bottom sheet headline counts what it lists: "6 stores near you" (not "3 within a mile" above six rows).

## 5. Directions from the Map tab
- Tapping a store (pin or row) on the Map tab expands its row in the bottom sheet with two buttons side by side: "Get directions" (soil primary, opens Maps exactly as in section 1, no travel mode) and "See receipt" (outlined secondary, only when there is a ranked result for the current bag).
- Each row also has a small 44px directions icon button on the right (an ink-outline arrow), so directions are one tap without expanding.
- Works even with an empty bag (directions do not need a ranking).

## 6. Check
Bag, Results, Receipt, Map, Saved and Me at 390x844. Primary buttons soil, tab icons hand-drawn, no labels under pins.
