# S79 L8 boarding investigation — HOLD

Date: 2026-11-12  
Baseline: `c9a9bbbd` (`main`)  
Scope: L8 final boarding after the elephant is cleared.

## Fixed HIGH real-input boarding verification

The fixed build ran from `tests/fixtures/saves/qa/l8-before-elephant.json.br` at HIGH zoom 1, headless on port 4981 through the browser pool. Ordinary input cleared the elephant and reached **14/14 aboard in 32.73 seconds** (post-kill objective tick 1299; first 14/14 tick 3263). No objective skips were used. Opened the fixed capture: HUD 14/14, yard crowd gone, elephant corpse retained by the truck. [Opened before/after sheet](boarding-sheet.jpg) shows reproduction left and fixed boarding right. Raw run: `test-results/playtest/s79-fixed-elephant/`. The driver subsequently stopped 8 m from the APC driver door; full departure is not claimed. Zero raw L8 threat flags remains unproven.

## Confirmed reproduction and correction

The retained HIGH zoom 1 real-input run reproduced s78 at tick 28521: `0/14 aboard · 22 m`, courier `(95.4, 53.2)` still at the elephant kill position, and `no marker: true`. Opened [reproduction capture](boarding-sheet.jpg): party and courier remain inside the yard beside the persistent elephant corpse; the yellow ring at the APC marks the destination. The prior interpretation that the courier was already at the APC was incorrect.

Root cause: after the final kill, `LevelEightZoo` immediately changed the objective to “Cover the survivors” and set `waypoint = false`. Boarding itself only activates when the courier is within 12 m of the APC door. The marker-driven input route therefore stopped 22 m away before boarding was active. The native boarding fixture passed because it already placed the courier at the pickup.

The correction keeps “Lead the group to the armored vehicle” and its waypoint until boarding activates, then changes to the cover/boarding counter. The corpse and follower collision/pathing rules are unchanged. This is an objective-route guidance fix. Fixed-build HIGH browser completion still needs verification; the retained profile exists at `test-results/playtest/s79-high-retained/profile` (the generic checkpoint continuation restarted at sanctuary, so it does not yet supply an elephant-clear save).

Earlier investigation follows for provenance; the confirmed reproduction above supersedes its tentative interpretation.

## Finding

The s78 HIGH capture was opened. It shows the APC and courier outside the elephant yard, all 14 passengers grouped inside by the yard gate, and the persistent elephant corpse lying across the inner approach. The HUD remains at `0/14 aboard · 22 m`. This is a credible pathing/jam report, not a vehicle capacity issue.

The L8 follower path already contains the two focused corrections relevant to this geometry: corpse-aware swept detours (`boardingTarget` / `corpseDetour`, introduced in `8b99d007`) and progress-based queue unjamming after 1.5 seconds (`unjamBoarding`, introduced in `0aec05f7`). Both are present in the requested baseline. I did not add a second, speculative pathing rule: the faithful post-clear native matrix below passes with the entry gate physically closed and the elephant body retained. It does not reproduce the reported 0/14 stall.

A native ordinary-input route diagnostic also reaches the boarding phase and empties its passenger queue (seed 1, LOW quality: queue 14 at 384 s, queue 0 at 414 s). This is useful route evidence, but it is not the requested HIGH browser run. A separate experiment moving the elephant body to the centre of the yard during the full bot route left the courier at the yard centre after 600 s; the player route is sensitive to that artificial relocation. The acceptance matrix holds the courier at the actual APC pickup and isolates follower egress/boarding, as required by the survivor boarding criterion.

## Focused native evidence

`node --import tsx/esm tools/qa/l8-boarding-matrix.ts` ran 20 HIGH-quality cases: seeds 1–5 × four persistent corpse positions (yard centre, elephant entry gateway, yard gate, and north exit). In every case:

- all 14 passengers boarded within 30.38–35.49 simulation seconds;
- the elephant corpse remained present;
- the elephant entry gate was armed and physically closed;
- the native solid registry reported zero collision failures.

Full rows and method are in [native-matrix.json](native-matrix.json). The probe starts all passengers in a cluster inside the yard near the gate, with the courier at the APC pickup. It tests the actual survivor paths and vehicle boarding; combat completion is a precondition, not part of this fixture.

`node --import tsx/esm tools/qa/l8-gate-shoves.ts` passed 432 shoves and all 16 authored route edges, with 10 corner shoves and **0 escapes**, unchanged from s77.

`node --import tsx/esm tools/qa/threat-audit.ts --levels L8` reports **0 L8 threat flags**. Its one overall `PARTIAL_LEVEL_SELECTION` flag is the harness’s expected label for running only L8; the L8 stage itself completed with no flags.

`npm run typecheck` and `npm run lint` passed. The unchanged remote unit suite was attempted with `sh tools/remote/run.sh "$PWD" -- npm test`, but no healthy Hetzner runner was provisioned and the command is ineligible for the local Mac fallback. The suite did not run.

## Required visual follow-up — still open

The requested HIGH zoom 1 physical-input browser run through boarding did not start. `npm run playtest` built the QA bundle successfully with `MI_BUILD_CACHE=off`, then the local `tsx` CLI failed to create its IPC pipe (`listen EPERM`). Running the driver directly through `tools/e2e-lock.sh` reached the browser pool, but the pool daemon could not listen on `127.0.0.1:4321/4329` (`listen EPERM`). No browser was started and no new capture exists to open or describe. The original s78 capture is the visual evidence described above; it does not verify a completed boarding run.

Therefore the native acceptance matrix and s77/threat-audit gates pass, but the original real-input 0/14 report is not closed. Re-run the HIGH zoom 1 browser session from an elephant-clear save when the browser pool can bind its local sockets, open the final capture, and confirm whether the full party boards within 60 seconds.

## Unrestricted continuation

The original evidence/probe was committed as `12e5afed`. The earlier sandbox restrictions no longer apply.

The unchanged remote command completed on runner `94.130.181.173`, job `/srv/mi/jobs/s79-l8boarding-6f0b2d-73393-1794511367`: 27 files passed, 106 tests passed and one skipped, 214.9 seconds against the unchanged 240-second budget. This supersedes the unavailable-runner result above.

A headless HIGH zoom 1 physical-input session now ran through the browser pool on port 4981. It stopped at its 480-second cap on the elephant approach (`Enter the elephant yard · 61 m`), with zero deaths, three logged assists, no skips, and maximum no-progress 51.815 seconds. It cleared the earlier habitats but did not reach boarding. Raw evidence is in `test-results/playtest/s79-high-z1/`.

Opened `captures/campaign-L8-t27148.jpg`: courier at full HP in the gorilla habitat, follower group visible behind her, defeated gorilla at the left, and a clear yellow objective ring. This proves rendered route coverage at that point, not completed boarding. The required run from a pre-elephant save through boarding remains open. No check is still running.

## Post-correction checks

Typecheck, lint, all 20 boarding matrix cases (maximum 35.49 s), and the 432-shove/16-edge confinement probe passed after the objective guidance change. The threat command completed in 98 seconds. Its console summary reports zero passive flags, but inspecting the raw level receipt reveals `step/escape:UNREACHABLE_SHARE_OVER_30_PERCENT_FOR_OVER_20_SECONDS` on the skilled route. Thus **zero L8 flags is not established**; the earlier summary-only claim is insufficient. This raw flag and fixed-build HIGH browser boarding completion remain open. The prior remote unit result predates the small guidance correction. No checks remain running.

The unchanged remote unit suite also passed after the code correction on runner `46.225.66.90`, job `/srv/mi/jobs/s79-l8boarding-6f0b2d-91994-1794512837`: 27 files, 106 passed and one skipped, 204.4 seconds against 240 seconds. All processes from this verification are terminal.

## Threat baseline comparison

A fresh unchanged threat audit with the original `c9a9bbbd` mission source confirms that the skilled flag predates this fix. The receipt reports `sourceMatchesMain: true`, the same unreachable-share flag, exactly 142 blocked seconds, blocked-evidence tick 24478, and courier `(91.968063, 72.316887)`. Passive flags are empty. The ordinary infected in that snapshot are behind the sealed previous route cells, while the courier is at the APC. See [baseline evidence](threat-baseline.json). The committed correction was restored in a `finally` block and the source has no remaining diff.

The boarding guidance fix therefore preserves the measured threat behavior, but the literal zero-raw-L8-flags acceptance condition was already false on the supplied baseline. It remains an explicit open gate; no threat criterion was loosened. Resolving that gate requires further level/gate threat routing work beyond the confirmed boarding guidance cause. The reported driver-door stop is also retained as a follow-up. The focused fix, HIGH boarding evidence, 20-case matrix, confinement result, and passing remote suite are committed; no process remains running.

## Remaining design constraint

Inspected shared traversal rather than changing the audit: `Barricades.vault` supports runners over sandbags below 0.9 m, L4 military wire, and limited Alpha-leaper climbs up to 1.2 m. L8's closing elephant entry is a 3 m solid barrier, and the older cells explicitly seal both entry and exit in `l8GateClosed`. The existing tunnel routes spawn new actors; they do not carry the same trapped actors between cells. There is therefore no existing ordinary-infected traversal to reuse for the baseline unreachable population. A new physical service route or a revised gate design is required to clear that baseline skilled flag while preserving courier confinement. A scope/design decision has been requested; no check or ordinary zombie stat has been changed.
