# Vehicle glass review — PKG-10/11/12 (FIX-09)

Before is untouched `83969f51`; after uses the delivered changes in this worktree. All captures use headless Chromium, WebGL2 through ANGLE/Metal, 1280×720, and the real renderer. WebGPU remains a manual check.

`*-scene.jpg`: f0 = the unchanged game camera, target `[0,1,0]`; f1 = close camera, target `[1,1.6,0]`, radius 9, azimuth 45°. Both step 60 ticks and settle asset loading before capture. `*-lods.jpg`: f0/f1/f2 = LOD0/1/2 at 45°; f3/f4/f5 = the same tiers at 225°. These use the production Asset Workbench. No camera was adjusted between before and after.

## Inspected captures

| Vehicle | Before game/close | After game/close | Before all LODs | After all LODs | What changed |
|---|---|---|---|---|---|
| sedan-red | [image](../../scenes/vehicle-glass/before/sedan-red-scene.jpg) | [image](../../scenes/vehicle-glass/after/sedan-red-scene.jpg) | [image](../../scenes/vehicle-glass/before/sedan-red-lods.jpg) | [image](../../scenes/vehicle-glass/after/sedan-red-lods.jpg) | Flat teal/blue panes become clear tinted glazing; wheel, front buckets and cabin floor read through the windows. Red panels and black frames stay opaque. |
| suv-dark | [image](../../scenes/vehicle-glass/before/suv-dark-scene.jpg) | [image](../../scenes/vehicle-glass/after/suv-dark-scene.jpg) | [image](../../scenes/vehicle-glass/before/suv-dark-lods.jpg) | [image](../../scenes/vehicle-glass/after/suv-dark-lods.jpg) | Opaque olive panes become tinted glazing with dark seat silhouettes and the rear cabin visible. Roof rack, luggage, lamps and body keep their silhouette. |
| pickup-red | [image](../../scenes/vehicle-glass/before/pickup-red-scene.jpg) | [image](../../scenes/vehicle-glass/after/pickup-red-scene.jpg) | [image](../../scenes/vehicle-glass/before/pickup-red-lods.jpg) | [image](../../scenes/vehicle-glass/after/pickup-red-lods.jpg) | The solid purple windshield becomes transparent; wheel, two bucket seats and red cabin floor are readable. White trim and bed remain opaque. |
| police-sedan | [image](../../scenes/vehicle-glass/before/police-sedan-scene.jpg) | [image](../../scenes/vehicle-glass/after/police-sedan-scene.jpg) | [image](../../scenes/vehicle-glass/before/police-sedan-lods.jpg) | [image](../../scenes/vehicle-glass/after/police-sedan-lods.jpg) | Purple opaque panes become dark tinted glazing; seat edges and the rear shelf are visible, especially from the rear angle. White pillars, badges and light bar remain opaque. |
| ambulance | [image](../../scenes/vehicle-glass/before/ambulance-scene.jpg) | [image](../../scenes/vehicle-glass/after/ambulance-scene.jpg) | [image](../../scenes/vehicle-glass/before/ambulance-lods.jpg) | [image](../../scenes/vehicle-glass/after/ambulance-lods.jpg) | The flat charcoal windshield reveals the dashboard, wheel and opposite cab opening. White surround and the medical box remain opaque. |
| fire-engine | [image](../../scenes/vehicle-glass/before/fire-engine-scene.jpg) | [image](../../scenes/vehicle-glass/after/fire-engine-scene.jpg) | [image](../../scenes/vehicle-glass/before/fire-engine-lods.jpg) | [image](../../scenes/vehicle-glass/after/fire-engine-lods.jpg) | Solid grey cab panels become true glazed openings. The cab has a closed floor/roof, seven cushions/backrests and a steering wheel. Ladder, shutters, silhouette and emergency light placements are retained. |
| school-bus | [image](../../scenes/vehicle-glass/before/school-bus-scene.jpg) | [image](../../scenes/vehicle-glass/after/school-bus-scene.jpg) | [image](../../scenes/vehicle-glass/before/school-bus-lods.jpg) | [image](../../scenes/vehicle-glass/after/school-bus-lods.jpg) | Black window rectangles become openings with translucent glass; bench rows and the driver chair are readable. Yellow panels remain solid and the folding-door frames and glazing stay aligned. |

## Seated visibility and anchor contract

Engine: `driverSeat`, `crewSeat0`…`crewSeat5`, `steeringWheel`; bus: `driverSeat`, `passengerSeat0L/R`…`passengerSeat3L/R`, `steeringWheel`. Sockets target the seated pelvis above the cushion, facing +X. Existing exits and wheel pivots are retained. All seat positions agree across the three delivered LODs within the original regression tolerance; every engine seat is more than 45 cm from every other seat. The LOD exporter explicitly pins these authored anchors after matching decorative bounds.

The occupant fixture attaches real `npc.firefighter-alive` rigs to the vehicle, uses `npc-sit`, and checks their drawn pelvis probes against the delivered sockets. It demonstrates glazing visibility at the game camera. Every drawn pelvis matches its socket exactly in both before/after fixtures. Before panes conceal occupants; after panes reveal heads and torsos at the game camera. The stock sitting animation leaves engine hands protruding through the side panes in both sets: this remains a visible P1 for PKG-13/14 occupant pose work, which was notified. Campaign boarding, driver hand poses and crew lifecycle belong to that separate lane.

| Fixture | Before | After |
|---|---|---|
| Seven engine occupants | [image](../../scenes/vehicle-glass/before/fire-engine-occupants.jpg) | [image](../../scenes/vehicle-glass/after/fire-engine-occupants.jpg) |
| Bus driver and first passenger pair | [image](../../scenes/vehicle-glass/before/school-bus-occupants.jpg) | [image](../../scenes/vehicle-glass/after/school-bus-occupants.jpg) |

Low quality uses the existing LOD1 policy at these same camera positions: [engine](../../scenes/vehicle-glass/after/low/fire-engine-scene.jpg), [bus](../../scenes/vehicle-glass/after/low/school-bus-scene.jpg).

## Performance

Glass retains its authored tint and transparency, capped at 25% alpha for older heavily tinted vehicle panes (new engine/bus glass is 18%). Transparent panes disable depth writes and render in one pass. Paint and glass sharing a palette token use separate cache entries. Vehicle-owned copies preserve alpha, depth-write and single-pass state.

Payload counts below exclude renderer fullscreen passes. Source and delivered LOD validators retain their existing limits: 80,000 / 6,000 / 2,000 triangles for engine/bus, at most 40 mesh draws, and the existing file/material budgets. All 42 before/after delivered models validate without errors. Full details: [mesh counts](../../reports/vehicle-glass-checks/mesh-counts.json).

| Vehicle | LOD0 triangles before → after | LOD1 | LOD2 | Mesh draws LOD0 / 1 / 2 before → after |
|---|---|---|---|---|
| sedan-red | 57,344 → 57,344 | 3,376 → 3,376 | 1,412 → 1,412 | 27/22/18 → 27/22/18 |
| suv-dark | 69,436 → 69,436 | 4,088 → 4,088 | 1,612 → 1,612 | 25/25/20 → 25/25/20 |
| pickup-red | 71,950 → 71,950 | 3,987 → 3,987 | 1,920 → 1,920 | 20/20/16 → 20/20/16 |
| police-sedan | 72,804 → 72,804 | 3,766 → 3,766 | 1,876 → 1,876 | 21/18/13 → 21/18/13 |
| ambulance | 74,804 → 74,804 | 3,908 → 3,908 | 1,868 → 1,868 | 26/23/18 → 26/23/18 |
| fire-engine | 66,202 → 67,986 | 4,454 → 4,692 | 1,988 → 1,948 | 39/39/30 → 40/40/31 |
| school-bus | 76,108 → 78,788 | 4,120 → 4,816 | 1,876 → 1,870 | 29/33/27 → 34/38/30 |

Settled game-camera totals include shadow/fullscreen passes. All stay below the existing T-E09-10 limit of 600 draws / 1,500,000 triangles. CPU timings on this shared Mac are submission timings, not GPU timings.

| Vehicle | Total draws before → after | Total triangles before → after | CPU render ms game/close before → after |
|---|---|---|---|
| sedan-red | 47 → 47 | 67,089 → 67,089 | 1.1/1.2 → 1.0/0.9 |
| suv-dark | 45 → 45 | 79,181 → 79,181 | 2.7/2.4 → 2.6/1.0 |
| pickup-red | 40 → 40 | 81,695 → 81,695 | 1.1/1.1 → 3.7/1.2 |
| police-sedan | 41 → 41 | 82,549 → 82,549 | 1.1/1.4 → 2.6/1.1 |
| ambulance | 46 → 46 | 84,549 → 84,549 | 3.5/1.1 → 2.7/1.8 |
| fire-engine | 59 → 60 | 75,947 → 77,731 | 1.6/1.0 → 3.3/1.4 |
| school-bus | 49 → 54 | 85,853 → 88,533 | 1.2/1.1 → 2.7/2.1 |

## Validation

Final `typecheck`, `lint`, `build` and all 794 unit tests pass (two Vitest workers). The focused glass/anchor/metadata regression suite passes. Strict `T-E09-10` passes with the reviewed glazing goldens, retaining the original brake/siren assertions and performance budgets. Full `verify E09`: browser 30 pass / 7 fail; API harness and old golden failures reproduce on the untouched baseline. Additional failures are audio suspension (desktop/mobile), town driving corner, curb height and known save/continue. Vehicle controls, entry, spawning and fire-engine ride checks pass. Full `verify E25`: browser 37 pass / 3 skip / 2 fail (house-window probe and known save); the final focused T-E25-11 reproduces the same house probe failure. These gate failures remain outstanding; this report does not claim completion of all rerun criteria.

`T-E25-11` fails on the house-window probe: expected 200 sample points, got zero. The exact unchanged test reproduces the same failure on base `83969f51`; [baseline evidence](../../reports/vehicle-glass-checks/baseline-E25-11.json). Known `T-E13-05` save/continue rack mismatch is also reported. No test assertions or tolerances were loosened. The three vehicle golden images were refreshed for the intended glazing change after inspection; the untouched baseline also fails its old golden comparison. The inherited baseline drift includes the background sedan LOD and warm floor/brake-light contribution. Brake/siren pixel assertions and all limits remain unchanged.

## Vehicle visual test captures

The three inspected golden pairs show opaque police windows becoming clear, with rear seats and steering/interior silhouettes visible. White pillars and body stay solid, wheel steering/spin remains visible, brake lamps extinguish during motion, and the siren alternates. The following before images are the inherited goldens; after images are the reviewed refreshed goldens, rather than the separate untouched-build Scene Lab captures above.

| Frame | Before | After |
|---|---|---|
| brake-siren-right | [image](before/vehicle-brake-siren-right.png) | [image](after/vehicle-brake-siren-right.png) |
| driving-wheels | [image](before/vehicle-driving-wheels.png) | [image](after/vehicle-driving-wheels.png) |
| brake-siren-left | [image](before/vehicle-brake-siren-left.png) | [image](after/vehicle-brake-siren-left.png) |

Full `verify E20`: typecheck/lint/build pass; simulation 42 pass / 1 fail / 1,514 skipped. T-E20-05 ride seating and control return pass. T-E20-21 rescued-person lifecycle fails, stopping the standard verifier before browsers. T-E20-19 is not a standalone executable test in this checkout; the vision criterion is tagged on T-E20-18 and is rerun separately. The documented engine hand clipping prevents claiming a clean E20-AC19 vision gate.

The separate headless T-E20-18 tagged vision-capture playthrough passes (1.1 minutes). Its game-camera truck-ride capture was inspected: clear cab openings are visible, but the existing player render remains outside the truck in the street. This P1 was notified to PKG-13; the capture-generation test passing is not a vision approval. T-E20-21 fails because eight rescued people remain elsewhere on seed 2, rather than at the checkpoint/turned/down.
