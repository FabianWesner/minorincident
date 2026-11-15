# s129 L9 HIGH evacuation and staging placement — in progress

This report records a partial P2 placement correction. The P1 HIGH evacuation delay is still open, so this lane is not accepted and the requested three-run browser gate has not been met.

## Staging truck overlap

The archived pre-fix image in [placement-sheet.jpg](./placement-sheet.jpg) shows the old north row at z=10 crossing the low sandbag row and the `EVACUATION / STOP` sign. This was a fresh-L9 custom camera view, not the requested follow-camera zoom-1.5 review. The same fixed scene has sandbags at z=±8, light posts at z=±12, the evacuation sign at (453, 9), gate-side fences at x=440, and the APC stop centered at z=0.

The trucks now stage at (450, 26), (459, 26), and (468, 26). Their model collision bounds are 6.9266 m by 2.858 m; at the authored π/2 yaw their world footprint is 2.858 m across x and 6.9266 m along z. The extended existing vehicle test checks all three footprints against the sandbag/sign/post/fence positions and active L9 obstacle colliders, and verifies the truck row stays outside the APC road lane. The post-change browser capture and visual inspection at HIGH zoom 1.5 are still missing because this sandbox denies localhost binds.

## HIGH evacuation investigation

The supplied s128 HIGH-road log shows 3/4 at the trucks continuously from tick 12,656 through tick 17,447 while the courier remains at (468.76, -2.17), at 100 HP. The supplied tick-16,237 capture shows the APC surrounded by the HIGH horde and no final evacuee visible near the trucks. The logs do not contain the hidden evacuee's identity or civilian navigation/knockdown/slot state. I cannot conclude from this evidence whether the straggler is Mia, Rosa, or another survivor, or whether it is blocked, re-pathing, downed, or waiting on a story beat.

The documented playtest path was attempted with HIGH, `--l9-route road`, WebGPU, and ports 4995/4996. Its QA build succeeded, but the local preview server could not start: `listen EPERM: operation not permitted 127.0.0.1:4995`. The documented `tools/e2e-lock.sh` path cannot provide the required real-input run in this environment. No gameplay behavior has been changed to guess at the P1 cause. Required follow-up: reproduce HIGH road ×2 and HIGH shortcut ×1 through `tools/playtest`, record the straggler's full state, fix the verified cause (or implement and test a visible physical pickup fallback), then inspect the post-fix truck spots and APC stop in-browser at HIGH zoom 1.5.

## Checks so far

- Focused `tests/engine/vehicles.test.ts`: 2 tests passed in 35.11 s after the final obstacle-collider assertion.
- `npm run typecheck`: pass.
- `npm run lint`: pass.
- E31 per-change verify gate via `TMPDIR=/private/tmp node --import tsx tools/verify.ts E31`: typecheck, lint, and full budgeted suite passed; 27 files, 106 tests, 90.3 s under the 240 s limit. The `npm run verify -- E31` wrapper could not start because tsx IPC binding is denied in this sandbox.
- Full direct Vitest suite (`npx vitest run --project default --configLoader runner --maxWorkers=4`): 27 files, 106 tests passed in 55.09 s before the final obstacle-collider assertion; the later verify run covers the final tree.
- Focused native L9 threat audit: `L9.json` has zero skilled and passive flags; the audit command exits nonzero only because its full-report summary marks the intentionally selected one-level run `PARTIAL_LEVEL_SELECTION`.
- Required `sh tools/remote/run.sh "$PWD" -- npm test`: not dispatched; no healthy Hetzner runner is provisioned, and the Mac fallback does not accept the nested `npm test` wrapper. The full suite passed locally through E31 verify as listed above.
- Vehicle campaign motion gate and real-input browser gate: not run; both require a browser preview server, which cannot bind in this sandbox.

The placement code/test and this evidence note are committed as a partial lane checkpoint. The final report must be updated after the HIGH root-cause fix and browser acceptance runs.

## Resumed browser evidence

Local preview startup is now permitted. Two sequential HIGH WebGPU road runs at zoom 1.5 completed L9 without skips or deaths: `repro-high-road-1` (222 s, 4/4 aboard with 8 s defense remaining; two frame-hitch diagnostics) and `high-road-2` (238 s, 4/4 with 9 s remaining; zero issues). The HIGH shortcut run is pending. Raw receipts are under `test-results/s129/`.

The exact required remote command now passes on runner `46.225.66.90`: 105 passed, one platform skip, 150-case inventory retained, 126.9 s within the 240 s budget. These results supersede the earlier environment-blocked attempts above.

The resumed HIGH WebGPU shortcut run (`high-shortcut-1`, zoom 1.5) completed in 221 s without skips or deaths, but fails boarding timing: still 3/4 at tick 11213, approximately 31 s after defense completion. Two enemy-frozen diagnostics were recorded. This contradicts any claim that the z=26 staging change alone fixes P1; actor-level reproduction and a verified cause fix remain required.

## Actor trace and candidate rescue correction

A further unchanged real-input HIGH WebGPU shortcut diagnostic used a read-only page observer installed by a Node preload. At tick 10029 (9.03 s after defense), Dale was aboard, Rosa walked north, and Okafor/Mia were `grabbed` near (460.61,-0.86)/(462.26,-0.09). At tick 11410 (32.05 s after defense), Rosa was also aboard, while Okafor and Mia remained grabbed by infected 893 and 903. The corgi goodbye had already completed. This directly identifies a grab/crowd delay rather than a pending Rosa beat or claimed truck slot. The diagnostic was stopped after sustained evidence.

The existing soldier rescue priority covered L7 evacuation grabs but omitted L9. A candidate change extends that same target priority to infected biting active L9 evacuees; validation and fresh browser acceptance are pending. Zombie statistics, bite damage, and corpse persistence remain unchanged.

The rescue-priority candidate passes its first HIGH WebGPU shortcut run: 4/4 at 100 HP, last boarding tick 9539 versus defense completion 8833, **11.77 s** after defense. The run completes L9 in 190 s, no skips/deaths/issues. The existing NPC test now checks a soldier prioritizes an L9 evacuee biter over a closer Alpha; all three NPC tests pass. Two HIGH road runs on the rescue code and final fixture/motion/visual/full-suite checks remain required.

## Final-code browser matrix

On rescue commit `3515e9f8`, HIGH WebGPU road runs `rescue-road-1` (222 s) and `rescue-road-2` (342 s) boarded all four 12.73 s and 13.30 s **before** defense completion. Both completed with zero skips/deaths/issues. Together with the 11.77 s shortcut pass, this satisfies the three-run timing matrix. The final-code required remote suite passed again: 105 passed/one platform skip, 150-case inventory, 127.3 s.

I inspected fresh HIGH WebGPU placement captures: the stop road at follow zoom 1.5 is clear between the barrier rows; the overview shows all three trucks north of the barriers and sign, with visible gaps from light posts, side fence and bridge wall. See `placement-sheet.jpg`. The fixture uses an APC pose at the stop and is labeled placement evidence, not real-input timing evidence. The retained s126 fixture matrix and final motion/threat gates are still pending.

Final-code L9 vehicle campaign motion gate passes HIGH and LOW: both source-stable, zero correction failures. Raw receipts: `test-results/s83-vehicleslide/campaign/L9-{high,low}.json`. Remaining closure work is the retained s126 fixtures, final threat refresh and report rewrite.

## Closure fixture findings

Final L9 threat refresh has zero skilled/passive flags (single-level summary only has `PARTIAL_LEVEL_SELECTION`). The retained s126 native HIGH road and HIGH passive road fixtures pass. LOW road completes with all four alive/aboard at **21.28 s** after defense, failing the strict 20 s probe. The archived s125 stalled save reaches 4/4 at full health at the first observed **22.15 s** point, also outside that strict gate. Thus full acceptance remains open despite the three HIGH real-input passes.

An experiment routing to saved old south-side truck transforms worsened the archived fixture: Rosa remained unboarded through its 60 s sample. That experiment was discarded and production code restored unchanged. Remaining s126 cases were not run after the LOW-road failure.

## Staging distance refinement (pending requalification)

The remaining s126 LOW passive shortcut and HIGH/LOW seed-2 road cases pass at z26 (0, 18.72, 18.20 s). The late LOW seed-1 road actors walk steadily toward the unnecessarily distant z26 row after late disembarkation. Moving the row six metres closer to z20 retains all tested furniture clearances and improves that LOW fixture to **17.95 s**. The archived stalled save first reports 4/4/full health at **20.15 s** on a one-second census; its exact boarding tick remains to be captured. Typecheck, lint and both existing vehicle tests pass (29.33 s). The final three-run browser matrix and gates must be rerun on z20 before acceptance.
