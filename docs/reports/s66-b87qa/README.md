# s66-b87qa — batch 87 first-time-player QA

**Status: incomplete; no gameplay verdicts issued.** This report records an environment stop, not a pass. The goal remains to run the real-input route and open captures.

## Run setup

- Worktree head: `91199b68` (`main`, `origin/main`), matching the requested batch head.
- Worktree was clean at start.
- QA preview build: `MI_BUILD_CACHE=off npm run build:qa` — passed (Vite production build, 11.08 s). Cache-off was needed because the default cache lock is under `/Users/wesner/Workspace/minorincident/.mi-worktree-cache`, outside this worktree's writable root.
- Attempted a single headless browser through `E2E_UNITS=1 E2E_RESERVATION_SECONDS=600 E2E_PORT=4867 sh tools/e2e-lock.sh ...` with a fresh profile, WebGL2, low quality, normal menu flow, and no god mode.
- **Stopped before navigation/gameplay:** the required browser-pool daemon failed to bind `127.0.0.1:4329` with `listen EPERM`. The independent preview listener could not be started in this restricted environment either. The attempt returned exit 75; no browser page or capture was produced.
- Pool log: `/var/folders/0d/d1pz5009603g0jcd5r3j353c0000gn/T/mi-browser-pool.log` (ending error: `Error: listen EPERM: operation not permitted 127.0.0.1:4329`).

## Findings and verdicts

No `FIXED`, `NOT FIXED`, `REGRESSION`, or `NEW` verdict is supportable: the game was not opened. There are no current-run captures to describe. Do not treat prior lane fixtures, simulated probes, or existing report images as first-time-player evidence.

## Coverage

| Scope | Status | What remains |
|---|---|---|
| L9 start → bay → bridge → end | NOT PLAYED | Real-input route, drive-start occupant, flicker/FX/wheels, horde contacts, barriers, rail stall countdown, bus, hatch, end; captures at zoom 1 and 1.5 |
| L8 start → flamingo arena → lion arena | NOT PLAYED | Marker-following route, animal motion/appearance, captures at zoom 1 and 1.5 |
| L4 brute/butcher continuous-fire fight | NOT PLAYED | God OFF, automatic weapon continuous fire, whether enemy attacks complete, player hits taken |
| Armored zombie front vs rear | NOT PLAYED | Real shots-to-kill by direction |
| L2 market ambush | NOT PLAYED | Optional route not reached |
| L7 to school bus | NOT PLAYED | Optional route not reached |

No level-level answers about glitches, boring/harmless/babysitting, or stunning score can be made without playing. No >10 s gameplay stall was observed because gameplay did not start.

## Next action

Resume on a runtime where the repo browser pool can bind its local endpoint and the locked preview can bind its unique local port. Then complete the required routes using only ordinary input and visible objective/HUD guidance, save raw captures under `test-results/s66-b87qa/`, open the cited captures, and replace this status with evidence-backed verdicts. No code or spec files were changed.

## Runtime restored

After sandbox removal, the locked headless session started successfully on port 4867. Opened `test-results/s66-b87qa/00-menu.png`: title art and Start game / Settings / Credits buttons render correctly. The previous EPERM blocker is resolved. Gameplay routes and all fix verdicts remain outstanding. The session closed normally.

## Partial L9 real-input run

Normal L9 start preset, LOW, WebGL2/Metal, god OFF, no teleports or onward fixtures. Used `tools/playtest/live.ts --level L9 --quality low --screen --step` with `LUNA_MORTAL=1`; only screenshots and visible HUD guided actions. The clock paused between actions. This limits motion judgement; no full motion pass is claimed. Raw input log: `test-results/s66-b87qa/l9/log.jsonl`.

43 ordinary keyboard actions reached objective distance 157 m with zero deaths and 100/100 player health. APC armour went from 960 to 490. Boarder/leaper swerves cleared their prompts. Armour loss is confounded by boarder attacks and heavy contacts; it does not prove ordinary rams are incorrectly billed. Several stretches were visually sparse/dark. No proven >10 s game stall; steering recovery is not classified as a game defect.

**FIXED (limited scope): school-bus ram telegraph appears.** Opened `test-results/s66-b87qa/l9/bus-telegraph-turn43.jpg`: red lane behind the upright APC and HUD `School bus lining up a ram · dodge now! 1 s · 157 m`. Position: visible HUD distance 157 m, action 43. Exact simulation tick was not read. The 595-second browser reservation expired before the dodge action completed (process exit 124), so dodgeability/beatability, bay/bridge/end, rail timer and hatch remain unverified. The session is terminal; this is an infrastructure cap, not a reported game crash.

Other opened, transient frames showed near-side wheels and an intact hull, plus airborne barriers. Since those frames were overwritten by the live tool, they are observations only, not retained finding evidence. No full vehicle or per-level stunning verdict yet. L8, L4 and armored direction checks remain unplayed.

## Second L9 attempt: P1 driving blockage

**NEW / P1 — recoverable driving blockage beside the rail/roadside props.** Tick 8195 → 8929 (12.23 simulated seconds), HUD distance 632 → 639 m: forward/steering inputs did not produce meaningful onward objective progress while infected surrounded the APC and armour fell to “barely functional.” It moves/spins, so this is not a stationary softlock. Earlier reversing freed a similar roadside blockage. Cause is unresolved (infected, retained props, walls, and steering are confounded); this does not independently prove ordinary ram damage or a velocity reset. Severity follows the requested >10 s first-time-player stall rule.

Opened [L9 sheet](l9-partial.jpg): top left shows APC facing roadside with heavies nearby, top right a crowd enclosing the hull and 270 armour, bottom left a concrete barrier at the nose, smoke and “barely functional.” Full-size raw frames and timing ledger: `test-results/s66-b87qa/l9-replay/`. Tick data is read-only instrumentation (`LUNA_TIMING_LEDGER=1`), never used for route decisions. The session was explicitly closed (exit 130) after the attempt; no check remains running.

The recorded-input restart diverged physically, so replay was stopped at action 14 and all later decisions used opened screenshots/HUD again. A correction to the earlier note: the live driver did retain numbered input frames in `.frames`; those raw captures exist. The latest sheet is opened and retained. Full L9 completion remains unverified. The partial L9 look rates **5/10 stunning**: clear APC silhouette, but sparse dark stretches, conspicuous motes, awkward crowds and repeated steering recovery undermine the scene. Enemies are dangerous while blocked; not harmless. Driving recovery felt like babysitting the vehicle. No all-level verdict follows from this partial run.

## Partial L8 run: start through plaza breach

Same headless LOW WebGL2/Metal, normal L8 start preset, god OFF, screenshot/HUD-only decisions, paused between real-input actions. 53 actions reached tick **8994**, plaza breach, **48/100 health**, zero deaths. The 595-second browser cap ended this session (exit124). Flamingo and lion arenas were **not reached**, so no fix verdict is issued for either animal. Lions were briefly visible behind bars during Nadia's tour; those are not combat/motion acceptance evidence. Exact zoom has not been independently verified, and zoom1/1.5 coverage remains open.

Opened [L8 sheet](l8-partial.jpg): left shows Nadia's objective ring on dark grass beside the lion enclosure, right shows the MG fight outside the plaza with dense overlapping civilians/infected/corpses. The tour is followable through the marker, though several input corrections were mine and are not game findings. The tour's ring leaves the paved path; this contradicts the PO's lit-path preference, but no navigation softlock was proven. Rest was an instructed wait and transitioned naturally into the breach. The breach is **not harmless**: courier health fell100→60, later to48 while firing; retreat and aiming corrections were needed. No brute continuous-fire acceptance claim follows from this mixed fight.

Partial L8 stunning score **5/10**: heroine/corgi read clearly, but the opening feels lengthy and the fight becomes a pile of overlapping bodies, guns, bars and gore. Escorting the tour felt repetitive; no specific straggler babysitting was established. Glitches/motion: marker on grass and crowded body overlap observed; animal flicker/slide remains unverified. Raw inputs, numbered frames and read-only ticks are under `test-results/s66-b87qa/l8/`. No check remains running.
