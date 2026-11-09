# r17-polish — six visual FAILs fixed

**PASS for all six specified defects.** Low/high × actual WebGL2/WebGPU × zoom1/1.5 reviewed at1280×720. Six small sheets retain96 selected full-frame cells. The final20 accepted commands used one pooled headless browser serially, with600-second reservations; maximum command wall time112.688s. Zero runtime console errors in those runs.

| Fix | Result and cause | Evidence | Fix commit |
| --- | --- | --- | --- |
| L4 truck canvas | Vehicle paint classification gave cloth a sharp reflective highlight. Canvas is now diffuse fabric, retaining its original folds and geometry. L4 changes are material only. | [Sheet](L4-canvas.jpg), [cells](L4-canvas.json) | `82c8b997` |
| L9 closed APC cab / driver | Extend the opaque roof, steepen and frame tinted glazing, and fit a lower seat and steering wheel. Driver is visible through glass with bent knees and hands at the wheel. | [Sheet](L9-apc.jpg), [cells](L9-apc.json) | `e5bd23a0` |
| L9 bridge impact / crawl | Frame the actual landing and safe actor from the far bank; follow the crawl from the clear side. Girders no longer fill the foreground. Existing motion and gameplay remain intact. | [Sheet](L9-bridge.jpg), [cells](L9-bridge.json) | `d861cd95` |
| L5 shutter composition | Keep the rescued group as camera subject and ease across the stairs so the unchanged five slots separate on screen. All five remain visible, clear of HUD and caption. | [Sheet](L5-shutter.jpg), [cells](L5-shutter.json) | `5f36c95e` |
| L7 opening wreck | Measure light falloff above L7's raised road and place the existing lantern beside the middle of the truck. The warm pool reads the cab and bed. | [Sheet](L7-wreck.jpg), [cells](L7-wreck.json) | `114938d4` |
| L7 departing bus | Lower the look target and bring it toward the bus. The whole bus remains in frame at the failing+1s point and the+5s sample, with the city backdrop visible. | [Sheet](L7-departure.jpg), [cells](L7-departure.json) | `35d9b553` |

## Accepted-level gameplay parity

L4 and L5 simulation code, positions, threats, colliders, weapons and timing are unchanged. L5's fix is confined to the renderer; its five movement slots remain unchanged. The same seed1 mortal native policy on baseline `4e2440c0` and final committed source produces identical phase observations and final simulation state hashes at both qualities. L4 is bounded at250 simulation seconds; L5 completes. This is parity evidence for those samples.

| Level/tier | Observed threat-phase attack starts, before=after | Whole-run damage, before=after | Kills, before=after | Final state hash, before=after |
| --- | ---: | ---: | ---: | --- |
| L4 low, war | 721 | 511.633333 | 36 | `3e1514dd` |
| L4 high, war | 727 | 417.866667 | 30 | `8f0a2e1a` |
| L5 low, search | 27 | 175 | 75 | `b19eda42` |
| L5 high, search | 21 | 150 | 107 | `2c0bdc4b` |

[Parity receipt](threat-parity.json), [baseline observations](threat-before.json.gz), [final observations](threat-after.json.gz), [producer](threat-parity.ts). All four L5 shutter runs retain all five sheltered people.

## Capture method and reproduction

[Matrix receipt](matrix.json), [runner](batch.py), [sheet producer](sheets.py). Existing SceneSession and production bot fixtures run serially through `tools/e2e-lock.sh` on private port4351, with `headless:true` and Metal GPU flags.

APC uses physical E entry at tick61. L4 uses the actual arrival at1949, followed by labelled native-projection inspection poses. L5/L7 use normal mortal campaign routes. L7's existing low/high rescue outcomes are preserved; this lane approves the specified presentation samples. L9 replays the retained unedited low WebGPU route save in [inputs](inputs/L9-crash-save.json.gz); local240 reproduces the reported `(527.5,2.6)` impact. This is a controlled presentation replay across render cells.

Actual backend, quality and zoom are checked. For paired frozen cinematic studies, the harness releases the prior render takeover before setting zoom; production `advance(0)` regenerates the shot at the same simulation tick. L5 therefore renders at actual radii19m/28.5m. L9/L7 authored cinematic poses may be identical at both settings. APC close inspections retain their explicit radius7m; its game views cover both actual zooms. L4 inspections use explicit native-projection radii19m/28.5m.

Every sheet uniformly reduces full screenshots and adds labels, with no cropping or retouching. Manifests retain screenshot hashes, post-zoom `actualCamera`, tick/position, backend/quality and source receipt. The shared `state` in route receipts is the paired simulation snapshot; `actualCamera` is the post-zoom view. Selected sheets and full-size low/high examples were inspected. Each JPEG is under380KiB. Raw screenshots remain under `/private/tmp/r17-polish` for inspection.

Reproduce:

```sh
npm run build:qa
python3 docs/reports/r17-polish/batch.py
python3 docs/reports/r17-polish/sheets.py
```

Rebuilt manifests intentionally reset `reviewed:false` until their new images are inspected.

## Validation and source identity

- `npm run verify -- E31`: PASS, including typecheck, lint and107 shared unit tests in27 files. `test:unit` aliases the same `npm test` command. [Gate receipt](E31-checks.json).
- Final `npm run build:qa`: PASS. [Build identity](build-identity.json) confirms the final rendering bundles match the capture build after generated filenames/version metadata are normalized. The sole differing debug-information bundle has unchanged source and a new Build commit label.
- Strict L4/L5 threat observation and final-state comparison: PASS, zero mismatches, rerun on committed source with no working source diff.
- Twenty final matrix commands and96 selected cells: PASS; source hashes, actual settings, sheet hashes and per-fix reviews retained. [Final audit](audit.json), [logs](validation-logs.json.gz).

Only the final corrected matrix is acceptance evidence. Earlier pool EPERM, Vite hot-reload interruption and ignored in-cinematic zoom requests were discarded. An initial unit review-freshness check failed while renderer changes were uncommitted; the final committed-source gate passes. No performance or audio acceptance is claimed.

Six separate fix commits plus the final QA record. No specs/reference edits, deploy or push.
