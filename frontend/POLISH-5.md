# Polish pass 5 (final; overrides earlier files where they differ)

Work top to bottom; P1 first. Keep all data and API behavior. After this pass: feature freeze.

## P1. Fix what is broken

1. Sheets never sit under the tab bar. When any bottom sheet is open, hide the tab bar (fade out 160 ms) or lift the sheet above it; the sheet's content pads by the safe area + 24. The Me "Default sort" sheet currently has its options cut off.
2. Map can move. On both the Map tab and the Results map: drag to pan, pinch to zoom, double-tap to zoom. Results map: dragging works; it does not capture page scroll (Leaflet `dragging: true`, `scrollWheelZoom: false`, `tap: true`). Map tab: a small round "recenter" button (44px, eggshell, ink outline target icon) top right.
3. Map detail. Use Leaflet with real tiles so the user can tell where they are: CARTO light_nolabels (or Voyager) tiles, recolored per POLISH-2 section 5 (sepia/saturate filter + eggshell multiply + grain). Keep our paper-scrap labels (lakes, Capitol, UW campus, State St, University Ave, You) and sticker pins on top. Labels never clipped at the edge (hide a label whose box would cross the map edge). Offline fallback: the current SVG map.
4. Map tab, tapped store: no white block, no full-bleed button. The tapped row gets a wash of the store's color (14%) with 4px radius; under the name/meta line, aligned to the text column, a compact soil "Get directions" pill (height 40, Karla 600 15, horizontal padding 18). The per-row directions button uses a simple ink arrow icon (not the road-sign diamond).

## P2. Saved bags, done properly

5. Save button on the Bag: a 44px bookmark icon button in the bag label row (right side). Tap: save with the auto-name, show a small calm toast at the bottom "Saved as Breakfast run · Rename" (Karla 15, eggshell on soil, 2.5 s, fades). Filled bookmark when the current bag is saved. Remove the automatic save after sifting.
6. Saved tab cards are mini paper bags: use `<MiniBag color={pop}>` from Motifs.jsx (156 x 176, two columns, 12 gap; colors rotate pea, butter, sardine, radish, clementine). Inside: name (Karla 700 16, two lines max), "5 items" (Karla 13 muted). Stickers sit on the bag body like produce stickers: the winning store as a round sticker with the store's initials (TJ, PS, TG, FM, CC, WG) in its store color, and a butter "SAVED $2.35" sticker, tilted differently, overlapping slightly. No Remove link or pencil on the card.
7. Tapping a saved bag opens a Saved Bag screen (push, not the Bag tab): back chevron; the name as an editable title (Darumadrop 28, tap to rename, pencil hint); the items as bag rows with steppers, remove, and an add row ("+ Add something", typing and mic as on the Bag); then two buttons: "Sift this bag" (soil primary) and "Use as my bag" (outlined). A quiet "Delete bag" text button at the bottom (Karla 600 15, tomato text-free: ink text with a confirm sheet). Edits save automatically.

## P3. The top of every screen

8. A light, consistent top area (no bar, no fill, no shadow). 56 px below the status area:
   - Bag: wordmark (34) left; on the right a location pill: small pin glyph + "Near Grainger Hall" (Karla 600 13) on a sardine wash (#7DA3E0 at 18%), height 32, radius 16. Tapping it opens Home base in Me.
   - Map: title "Stores near you" (Darumadrop 28) left, recenter button right.
   - Saved: "Your bags" left; right, a 44px "+" that starts a new empty saved bag.
   - Me: no title (the buddy is the header); a small "Edit" is not needed.
   - Results and Receipt: back chevron (44px circle, eggshell, 1.5px #DCCDB2) left; on Results the right side shows the bag summary pill "5 items · $20" on a butter wash.
   Title baseline and wordmark baseline sit on the same line across tabs, so switching tabs does not jump.

## P4. Brand motifs, softer

9. Replace the solid color splotch behind the buddy with `<DirtPatch />` from Motifs.jsx: the buddy stands in a small patch of soil (patch width 1.6x the buddy, buddy overlapping its upper half). If a hint of the buddy's color is wanted, a very soft second blob at 10% opacity, never more.
10. Receipt motif only where it is a receipt: the Receipt screen, prices (Courier), and the Sifting list. Everywhere else use solid hairlines (#E6DCCB, 1px), not dashed or dotted rules, and no zigzag. Me rows: solid hairlines, receipt-paper fill is fine but no dashes.
11. Small produce touches, each used once: a tiny sprout on the empty Saved state, the dirt patch under the buddy, the pea bag icon. Do not add more decoration than this.

## P5. Calm motion (respect prefers-reduced-motion: no motion when set)

12. Screen changes: fade + rise 8 px, 260 ms, ease-out (cubic-bezier(0.22, 1, 0.36, 1)). Back: reverse.
13. Buddy idle: floats 2 px up and down, 4 s, ease-in-out, infinite; a 6-degree head tilt when it speaks a new line.
14. Stickers land: scale 0.9 -> 1 and rotate +4 deg -> final tilt, 320 ms, gentle overshoot (cubic-bezier(0.34, 1.4, 0.64, 1)). Used for BEST PICK, SAVED, need stickers, the price-report "slap".
15. Lists: rows appear with a 40 ms stagger, fade + 6 px rise. Re-ranking uses FLIP, 360 ms ease-out.
16. Sheets: slide up 300 ms with a soft ease-out, backdrop fades to 30%. Tab icon tilt 180 ms. Buttons press to scale 0.98.
17. Nothing loops except the buddy float and the thinking/listening dots. No bouncing, no shaking.

## P6. Final check

At 390x844: Bag (top area, save button, dirt patch), Results (drag the map), Receipt, Map (tap a store), Saved (mini bags), a Saved Bag being edited, Me with the Default sort sheet open (fully visible). Every screen: 20 px margins, nothing clipped, nothing under the tab bar, motion calm.
