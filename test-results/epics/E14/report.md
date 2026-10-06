# E14 · HUD, menus and onboarding

Implemented in `lane/e14-epic` from base `ab7df4e`. Complete: every E14 acceptance criterion and all required validation commands pass.

## Built

DOM/CSS menus cover title/tagline, character and level select, settings/rebinding,
pause, credits, upgrade choice and rack setup. Existing E12 briefing, retry,
result, off-screen markers and subtitles are retained and styled for the overlay.
Live HUD includes placeholder survivor/corgi portraits, health/armor, circular
north-up minimap, objective/home/nearby threat pins, two selected-side cards,
racks/ammo/charges/reload/recharge/cooldown, objective, damage direction,
interaction ring, bark ping and low-health vignette. Every authored DOM node and
the existing touch controls/stick have test IDs.

The UI updates independently of rendering and continues while paused. Native
buttons, focus traps and input-context separation support mouse, keyboard and
touch. Persisted settings use existing input, VFX and audio services; colorblind
mode recolors current and future telegraphs while preserving their shapes and
lifetimes. Background pause uses E16's synchronous host callback, clears held
input and requires manual Resume, including during cinematics. Onboarding uses
real input/sim events, active-scheme glyphs and a versioned once-per-action record.

Bruno Menu/Modals/Options/Map/Notifications/InputFlag/Intro/style patterns were
adapted; the other cited references were read before implementation. Attribution
is in `THIRD_PARTY_NOTICES.md`. No reference files were edited.

## Acceptance evidence

All IDs below are matched to passing tagged tests in `playwright.json`.

| ID | Result | Check | Evidence (in this directory unless a test name) |
| --- | --- | --- | --- |
| E14-AC01 | PASS | One-frame HUD state and IDs | hud.spec.ts; playwright.json |
| E14-AC02 | PASS | Selected-side class, border and physical J/K | selected-left.png; selected-right.png |
| E14-AC03 | PASS | Real mouse-only, keyboard-only and touch-only menu flows | menus-mouse/keyboard/touch.spec.ts; playwright.json |
| E14-AC04 | PASS | Active/rebound glyphs, persistent once-only prompts, L1/L2/L3 contextual lessons | onboarding.spec.ts; playwright.json |
| E14-AC05 | PASS | 390×844 and 844×390 target sizes and no map/tracker intersections | touch-390.png; touch-844.png |
| E14-AC06 | PASS | HUD checklist F: all must and should items pass | review.md; compare/hud.png; hud-golden.png; hud-mobile.png |
| E14-AC07 | PASS | 1.0/1.25/1.5 text scale at all three viewports, no DOM overflow | hud.spec.ts; playwright.json |
| E14-AC08 | PASS | Frozen tick, responsive HUD/settings, explicit Resume | hud.spec.ts; playwright.json |
| E14-AC09 | PASS | Visible keyboard focus, named buttons, zero critical axe violations on menu screens | ui-accessibility.spec.ts; playwright.json |
| E14-AC10 | PASS | North-up player/objective and ≤30 m infected, <1 m projection error | hud.spec.ts; playwright.json |
| E14-AC11 | PASS | Synchronous <100 ms blur/hidden/pagehide pause; no auto-resume; cinematic frame preserved | ui-autopause.spec.ts; playwright.json |

## Validation

- `npm run typecheck`, `npm run lint`, `npm run build`: exit 0; no new warnings. Repeated after the final runtime change.
- `npm run test:unit`: exit 0, 98/98 passed across 41 files (`unit.json`).
- `E2E_PORT=3328 npm run verify -- E14`: exit 0; 5 selected Node tests passed, 332 outside the selection skipped (`vitest.json`); 39 browser tests passed, 0 skipped/failed/flaky (`playwright.json`, `checks.json`).
- Affected earlier simulation/input/VFX regression: 101/101 passed (`regression-node.json`). Earlier E03 keyboard and E12 mission browser tests: 9/9 passed within a 14/14 passing batch (`regression-browser.json`).
- Separate `E2E_PORT=3328 npm run test:smoke`: exit 0, 3 selected Node tests passed (334 outside selection skipped), 20 browser tests passed with 0 failures/skips/flaky results (`smoke.log`, `smoke-playwright.json`).

Browser runs used the machine-wide lock, production preview on 3328, Chromium
with SwiftShader and DPR 1, two workers maximum; smoke also covers the configured
mobile orientations and WebKit. Vitest uses the repository's four-thread cap.
No deployment, push, additional main merge or asset registration was performed.
The full cross-epic regression remains the central integration gate, as instructed.

## Performance

`ui-perf.json`: 200 spawned threats, 206 entities, 120 animation-frame samples;
HUD update p95 **0.70 ms**, maximum **0.80 ms**. HUD descendants stayed
**301 → 301** with **256** preallocated threat pins. Snapshot:
59.88 fps / 16.70 ms frame, 113 draw calls,
10605 triangles, 67 geometries, 5 textures, WebGL.

This isolates UI overhead in a paused deterministic sandbox; the snapshot's sim
cost is not a running 200-enemy sim benchmark. E14 sets no standalone timing
threshold. E18's real-device GPU/sim budgets remain unchanged. `perf.json` records
the separate eight-entity `hud-golden` scene.

## Deviations and integration boundaries

- No E14 criterion was changed. `specs/status.json` is the only spec edit.
- Corrected the preexisting `T-E17-sources` unit assertion: tracked source models
  below `integrated` do not promise registered runtime GLBs. The failing base had
  a tracked `bld.dugout` source absent from the runtime manifest. The separate
  data-ID assertion remains intact, and integrated/final exports and LODs are
  still checked. No new assets were registered.
- The explicitly required axe-core audit uses pinned, unmodified 4.11.0 as an
  external QA tool through npm's cache (or `E14_AXE_PATH` offline). No dependency
  was added to package.json/node_modules or the distributed game.
- Portraits stay code placeholders while their manifest status is `reference`.
  The four-card mockup is adapted to the specified two-side model.
- E13 owns upgrade effects and distinct save lifecycle; the upgrade UI emits
  `upgrade-selected` with the existing progression handoff. E08 owns companion
  state; the HUD reads it when present and says “awaiting rescue” beforehand.

## Known issues

No known failing E14 acceptance criterion. Actual progression effects, companion
behavior, real-device performance and human playtest gates remain with their
owning epics; this change does not duplicate those systems.
