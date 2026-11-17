# s158 — L6 native vs real-input survivor gap

## Status: investigation incomplete

This report records a fresh native reproduction and audits the historical real-input receipts. The required fresh HIGH then LOW WebGPU runs could not start in this worktree: the browser pool failed to bind `127.0.0.1:4329` with `EPERM`; retrying through the legacy e2e lock hit the sandbox denial on `ps` inside `mac-gpu-guard.py`. No gameplay change is justified until real-input behavior can be measured again. The machine-readable receipts, including the complete 12-run matrix, are in [qa.json](qa.json).

## Fresh native matrix

`node --import tsx tools/qa/s157-l6saved.mts` reproduced all twelve baseline rows at this source tree. HIGH and LOW skilled seeds 1–3 save 20, 21, and 23 of 29 with zero player deaths (73.6% average, 69.0% minimum). Both tiers' walk seeds save 21, 17, and 21 (67.8% average) with 3, 0, and 1 deaths. These values match the existing s157 report exactly. Native simulation does not reproduce the real-input gap. Full captured rows are embedded in `qa.json`.

The native L6 bot stays near `(0, 4)` during shelter phases, scans visible threats within 22 m of the courier (16 m for one newbie case), prioritizes enemies attacking the group, and shoots them while retreating. This shelters the player in the opening and makes target selection automatic. It is materially stronger than a generic movement/combat driver.

## Historical real-input evidence and diagnosis

Batch 116 used WebGPU at zoom 1.5. HIGH completed with 10/29 survivors, four player deaths, one assist, and 1,633 MG attacks. LOW reached its 480-second cap without finishing: 0 out, 14 player deaths, one assist, and no logged attacks. An aligned LOW retry completed with 2/29, four deaths, one assist, and 1,683 MG attacks. This does not isolate game behavior from driver behavior, and the raw event logs needed to replay real-input positions are absent from this worktree.

The first recorded HIGH shelter grab is tick 2037 at `(8.58, -10.99)`; the first loss alarm is tick 2097. At shelter and stop objectives, the HUD has no waypoint or pin. The objective asks the player to “Look around the shelter” and then “Stop the infected”; it does not identify an attack lane. The HUD does have a five-second, directional survivor alarm when an infected attack/grab event is reported, so the absence of a waypoint is not the only explanation. The native bot's proactive 22 m group threat scan is an evident driver advantage; whether the 60-tick gap to the first loss alarm is also a player-guidance problem remains unverified.

The stair evidence is inconclusive but warrants a targeted follow-up. LOW aligned retries in s154 and s156 used a physical KeyA+KeyS correction near `x=244, z=11` to reach the stairs. The marker remains at `night-exit` `(273, 3.9, 15)`, while the player is still at ground level and the authored follower approach switches to `z=14.1` west of `x=246`. This can ask the player to infer the ground-level alignment before the stair run. Current receipts do not prove the marker itself leads into the stair side, so no route or marker change is made here.

## Driver gaps

- The production playtest driver is not an independent human policy. Its L6 attack acquisition and pathing differ from the native bot, and the LOW batch-116 trace records no attacks at all before timing out.
- Batch-116's retained JSON includes phase summaries, marker samples, attack totals, death counts, and assists, but not the full positional input stream required to replay those positions in native.
- The one assisted LOW result is not a clean acceptance pass for unaided stair guidance. Fresh WebGPU runs are needed to record the stair approach and corrections at HIGH then LOW.

## Verification and open work

- Fresh native matrix: 12/12 complete and identical to the s157 counts/deaths.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `node --import tsx/esm tools/verify.ts E24`: passed the per-change gate; 106 tests passed and one pre-existing platform skip (150/150 inventory). Direct `npm run verify -- E24` could not start because `tsx` IPC socket creation was denied.
- `npm run qa:threat`: passed in 238.7 s; **0 fail flags**. L6 skilled and passive both complete, 0 passive flags (75.0 s).
- `sh tools/remote/run.sh "$PWD" -- npm test`: could not start; remote runner unavailable (exit 69). The verify gate's local unit suite passed, but does not replace the specified remote receipt.
- Fresh real-input HIGH then LOW WebGPU at zoom 1.5: blocked before game startup by the browser-pool/sandbox failures above.

No source or playtest tools were changed. No zombie stats, wave counts, survivor health, corpse lifetime, or acceptance targets changed. No deployment, push, or main movement occurred. The outstanding browser runs and remote unit receipt keep this investigation open.

## Continuation with full permissions

Fresh HIGH WebGPU zoom 1.5 ran for 480 seconds through the required browser pool on port 5053. It failed to finish at the stairs, with 17 deaths, one recorded driver assist, no logged attack totals, and HUD 0/1 out. At tick 22658 the courier was at (246.16,12.16); at the cap it was near (242.9,13.6). Raw receipts: `test-results/playtest/s158-high-l6/`. The retained sheet is now a fresh stair capture, replacing the earlier schematic. LOW remains to run, and the gameplay/driver diagnosis remains open.

The prescribed remote suite now passes on 46.225.66.90: 105 passed, one platform skip, 150/150 inventory, 186.0 seconds. This supersedes the earlier runner outage.

## Fresh LOW and driver policy evidence

LOW followed HIGH through the same pool, WebGPU, zoom 1.5, ports 5053/5054. It reached the eight-minute cap without completing, HUD 0/2 out, near (240,13.9), tick 28825. Earlier at tick 10905 it stood beside the stairs at (249.34,13.05). The run summary in qa.json records deaths and assists; raw logs remain in `test-results/playtest/s158-low-l6/`. Both tiers now reproduce the stair approach failure.

Source inspection confirms substantial driver differences: `prioritizeAllyThreat` gives an armed courier its nearest personal threat before a nearby ally attacker; native sorts group bite risk first. Driver ranged reach is 14m (3m after 30s without objective progress), versus native 22m. During L6 stop the driver backs away from contacts within 5m: fresh HIGH walks from (3,0) to (3,9.26) while residents remain near z=-11. During L6 retreat ranged combat holds still; native continues moving with the column. These are Driver gaps, and tools/playtest remains unchanged. They explain why native results cannot validate this driver as a competent-player policy, but do not yet rule out a game-side guidance issue.

## Candidate stair guidance fix

The physical layout establishes the narrow escalator floor at x249.4–255.4, z14.325–15.675. Both fresh stall traces approach south of this lane. `markerAnchor` now shows the fixed west-platform alignment (244,15) for an unaligned exit approach, then the first stair waypoint (250,15), before restoring the street ring. No simulation movement or physical geometry changes. A focused marker-selection probe and typecheck/lint pass. Browser HIGH then LOW acceptance, the native matrix, and the full required checks on this candidate remain outstanding; this is not yet a verified fix.

## Marker consumer correction

The render-only candidate's fresh HIGH run capped at 480s near (249.4,11.2), HUD 4/4 out, courier not across. Inspection found the standard driver reads `def.anchors[state.marker]` instead of the rendered `markerAnchor` destination. This is an additional Driver gap. The waypoint selection is now moved into `LevelSixSubway.guide`, assigning `l6-stair` to the same fixed alignment/first-tread landmarks, so mission state and rendered guidance agree. Typecheck and lint pass after this correction. Full browser and regression verification on this revised implementation remains pending.

The preceding render-only candidate reproduced the full 12-run s157 native matrix exactly. Its full threat audit passed at 346.3s with zero flags, and the prescribed remote unit suite passed at 182.6s. These receipts precede the mission-state correction and do not qualify that correction as accepted.
