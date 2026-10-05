# E14 · HUD, Menus and Onboarding

## Goal
A readable, mockup-faithful HUD and a clean menu flow that teaches the controls in seconds and works the same with mouse-only, keyboard, and touch.

## Depends on / Enables
E03, E05, E12 / all levels, E13.

## Scope
**In:**
- **HUD (from the mockup, adapted to the two-side model):** portrait plus health (red) and shield/armor (blue) bars; the corgi portrait plus its state; the minimap (circular, N up, objective, threats as red dots, safe/home icon); two slot cards LEFT/RIGHT (the selected side highlighted, the rack strip, ammo/reload ring, charges, cooldown); objective tracker; off-screen markers; damage direction indicator; interaction ring; corgi bark ping; subtitles; and a low-HP vignette.
- **Menus:** title (logo, "A quieter neighborhood today · Braver people tomorrow"), character select (m/f), level select, settings (controls/rebinding, aim assist, blood, shake, flash reduction, quality, audio, text size, colorblind telegraphs), pause, retry/fail, level result, upgrade cards, rack setup, briefing, credits.
- **Auto-pause:** leaving the tab or window (hidden, blur, pagehide) pauses the game and opens the pause menu; returning never auto-resumes (the player clicks or taps Resume). The title and menu screens just go silent (E16).
- **Onboarding:** contextual prompts adapted to the active scheme (the scheme glyphs change), shown once per action. L1 teaches move → evade → interact → pick up weapon → attack → selector (L2) → second side (L2) → vehicle (L3).
- **Touch HUD:** stick zone, two big action buttons with icons, selector, and pause, sized ≥ 56 CSS px, respecting the safe area.
- **UI tech:** DOM + CSS over the canvas (Stylus or plain CSS), with no framework required. All UI elements have `data-testid`.

## Bruno references
Reuse first, per the [reuse map](08-bruno-reuse-map.md). Read these before writing new code:
- [`Menu.js`](../folio-2025/sources/Game/Menu.js): menus
- [`Modals.js`](../folio-2025/sources/Game/Modals.js): dialogs
- [`Overlay.js`](../folio-2025/sources/Game/Overlay.js): overlay
- [`Notifications.js`](../folio-2025/sources/Game/Notifications.js): toasts
- [`Map.js`](../folio-2025/sources/Game/Map.js): minimap
- [`InputFlag.js`](../folio-2025/sources/Game/InputFlag.js): prompt bubble
- [`Title.js`](../folio-2025/sources/Game/Title.js): title
- [`World/Intro.js`](../folio-2025/sources/Game/World/Intro.js): intro sequence
- [`Reveal.js`](../folio-2025/sources/Game/Reveal.js): reveal effect
- [`Inputs/InteractiveButtons.js`](../folio-2025/sources/Game/Inputs/InteractiveButtons.js): touch HUD buttons
- [`sources/style/`](../folio-2025/sources/style/): UI styling patterns

## Acceptance criteria

| ID | Criterion | Verification |
| --- | --- | --- |
| E14-AC01 | Every HUD element has a `data-testid` and reflects sim state within 1 frame (health bar width = HP/max ±1%, ammo, charges, selected side) | e2e |
| E14-AC02 | The selected side card is visually highlighted, and the highlight switches when the other side is used (DOM class + screenshot) | e2e/visual |
| E14-AC03 | The full menu flow (title → character select → briefing → L1 → pause → settings → resume) is completable with **mouse-only**, **keyboard-only**, and **touch** (three e2e tests, no `__SS__` shortcuts) | e2e |
| E14-AC04 | Onboarding prompts show the glyphs of the active scheme (e.g. "LMB" vs "J" vs a touch icon) and appear once per action per save | e2e |
| E14-AC05 | Touch layout at 390×844 and 844×390: no overlap between controls and the minimap or tracker (bounding-box intersection test), and all touch targets ≥ 56 px | e2e |
| E14-AC06 | HUD screenshot (`hud-golden` spot) passes the **HUD vision checklist** (`90` §7.6) against the mockup | vision |
| E14-AC07 | Text-size setting scales HUD text by 1.0 / 1.25 / 1.5 without clipping (no element overflow detected via DOM `scrollWidth > clientWidth`) | e2e |
| E14-AC08 | Pause truly pauses the sim (tick constant while paused) and the HUD stays responsive | e2e |
| E14-AC09 | Accessibility: menus are keyboard-navigable with visible focus; buttons have accessible names (axe-core: no critical violations on menu screens) | e2e |
| E14-AC10 | Minimap shows the player, the objective, and infected within 30 m; positions match the world within 1 m (projected) | e2e |
| E14-AC11 | Auto-pause: during gameplay a tab hide or window blur pauses the sim (tick constant) and shows the pause menu within 100 ms; on return the game stays paused until Resume is pressed; cinematics pause and continue from the same frame | e2e |
