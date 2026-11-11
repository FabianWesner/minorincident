# r34-l9qa: L9 findings from r33-vqa re-checked on main 7df2bd81

Lane r34-l9qa (claude-sonnet-5-5), 2026-11-11. Captures (git-ignored): `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/r34/` (`start1..3`, `final1`, `stall1..3`, `hitch1`, `proofs.txt`).
Real-key runs use `tools/qa/r28-vqa-fixture-play.ts` (level start `level:L9`, fixtures `l9-before-rail-stall`), one headless browser, ports 4927.

## Root cause found by the re-check

The QA driver's "handbrake taps" were **Space**. In the default bindings Space is LEFT (horn/boost, `defaultBindings.left`); the handbrake is **RIGHT = K** (`drive.handbrake = frame.handbrake ?? frame.right.held`). So finding 3 never threw a leaper off, and the driving HUD hint never told a real player the key at all ("W gas · S brake / reverse · A / D steer · LEFT to horn / boost"). The mission hints said "handbrake" without a key.

## Per finding

1. **APC pinned 95 s 5 m from the bay (P1 candidate): not reproducible as written; two real stuck-recovery bugs found and fixed.**
   - The 95 s pin at x 475.2 was r33's pre-polish build: the evacuation started only inside the 11 m radius round x 457 (18 m away), and the objective "5 m" was measured to another anchor. r33-l9polish's bay box (x 443-484, |z| <= 40) already starts the evacuation there; on current main `l9-before-rail-stall` reaches `evac-point` at (457.6, -22.6) and passes x 475 to the bridge (`stall1`).
   - But a general soft-lock exists (`tools/qa/diag/l9naive.ts`, a naive W-held driver with handbrake taps while boarders cling): the APC sat at 0.0 m/s for 145 s, `stuck` never true, no reverse. Cause 1: every handbrake tap with the gas held went through `VehicleBody`'s `clearStuck()` branch, wiping the 3 s window; the L9 driver taps K every ~1.5 s, so the window never filled. Cause 2: a horde shoving the APC creeps it ~0.3 m/s (0.9 m per window), above the old 0.5 m bound.
   - Fix (`src/sim/vehicles/VehicleBody.ts`): a handbrake tap with the gas held pauses the window instead of clearing it; stuck bound 0.5 -> 1.6 m per 3 s at full throttle (a free APC covers >10 m in that time). Naive driver, same seed: longest no-progress stretch 145.8 s -> 3.9 s, recovery (reverse) fires repeatedly.
   - The real-key tool still pins for ~25 s in a junk cluster / horde at x -50 because it re-steers into the same obstacle after each reverse (`final1`); a player who steers does not. Not a soft-lock any more.
2. **Bridge crawl waits forever in the ring (P1 candidate): reproduced in the sim, fixed.** `tools/qa/diag/l9crawl.ts` (bot to the crash, then no input at progress 0.5 / 0.75 / 0.85): stuck at 0.5 and 0.75 (before), 0.85 finishes in 4.2 s after the fix. `LevelNineCrash`: the last fifth of the crawl (`CRAWL_AUTO` = 0.8, the final ~4 m of 19.7 m) advances on its own at 0.75 speed, so a player who stops in the yellow ring (objective "1 m", progress ~0.95) completes the step. Forward input before that still drives the crawl; stopping early (< 80 %) still waits, which is the crawl by design.
3. **Leapers drain the APC to the floor by 55 s: caused by the wrong key; hint added.** With K (not Space) taps `r28-vqa-fixture-play.ts` now throws the leaper pair off: armour at level start 1000 -> 870 (packs) -> 780/720 (first leaper pair, shaken in ~3 s) -> 550 at the second pair and throwers (60 s) -> 280 by 62 s -> floor only when the naive tool jams in the horde (`start3`, `final1`). The skilled bot is unchanged (road seeds 240-300 armour at the bay, `l9damage.ts`; leaper strikes 20 + 30 per 1.5 s only until shaken). No hull damage numbers or shared infected stats changed. HUD: keyboard driving hint now "W gas · S brake / reverse · A / D steer left / right · K handbrake (throws boarders) · LEFT to horn / boost · E / F exit", mission hints "swerve hard or handbrake (K) to throw it off" / "swerve or handbrake (K) while moving". The tool now taps K, not Space.
4. **Weapon keys at the hatch and god mode at the hatch (P2).**
   - Weapon keys work at the hatch: `game.input.drivingContext` is false while `driving.hatch`; a `Digit5` press reaches `Loadout.input` and moves the rack index (shotgun -> MG), and the HUD shows slot 5 selected (`stall3/s008-t1890.jpg`). While driving they are ignored by design (combat input is off). r33's "cannot switch" came from pressing the key before the hatch opened; the tool's `Player.current` reading also stayed stale (`shotgun`) after the switch.
   - God bypass found and fixed: boarders on the hull hit the courier through `world.player.damage(10, ...)` in `Vehicles.infected()`, never through `Damage.apply`, so neither the god cheat nor the inspection ghost applied. Now checks `combat.damage.god` / `inspectionGhost`. `tools/qa/diag/l9hatch.ts --god`: passive courier at the hatch, 100 HP after 30 s with 5 boarders (without god: dead 15 s after the first boarder).
   - Lethality (r33-l9polish pacing: one boarder per 5 s) is unchanged; the real-key run with the MG selected kept 100 HP through the whole hatch (`stall2`, 80 s, no god).
5. **Frame hitch 1917 ms at tick 3213 (high WebGL2): not reproduced.** Level start, high WebGL2 zoom 1, 110 s (ticks 0-6637, both leaper pairs, throwers, 40 event screenshots): zero frames > 100 ms (`hitch1`); low WebGPU runs `start1-3`, `stall2`: none either. The r33 hitch fell on the second leaper windup where the tool also takes an event screenshot, on a loaded machine; no first-use compile is evident. No code change; if it returns, capture with the browser performance trace at tick 3213.

## Tools
- `tools/qa/r28-vqa-fixture-play.ts`: K handbrake, logs `apcSpeed`/`keys` on event shots, hatch weapon-key log.
- `tools/qa/diag/l9crawl.ts` (crawl stop-and-wait), `l9naive.ts` (naive W-held driver, longest no-progress stretch), `l9hatch.ts --god`.

## Verify
- typecheck, eslint clean. `npm run test:gate`: 27 files, 107 passed. `tests/engine/vehicles.test.ts` + `missions.test.ts` (+ vehicle-scenes) remote: passed (rerun after the stuck change: passed, 8 tests). The gate was rerun after the stuck change too: 27 files, 107 passed.
- l9-driving-proof (low, seed 1), all after the stuck change: road 215.8 s, `--risky` 328.4 s, countryside 216.7 s, dry-shortcut 200.7 s, `--zero` 320.6 s: all completed, courier 100 HP, 0 collision failures, 0 admission violations.
- `threat-audit.ts --levels L9`: skilled complete, passive complete, 0 passive flags (the one fail flag is the L8-04 "not measured" row, L9 only selected).
- Real keys: level start (low WebGPU z1.5; high WebGL2 z1) and `l9-before-rail-stall`; captures opened (`start3/s011`, `s012`, `stall1/s008`, `stall3/s008`).

## Browser QA needed
- Rail-stall hatch with a fresh save, K handbrake on the road drive (leaper pair thrown off, HUD hint readable at zoom 1.5 low), crawl: stop in the ring and confirm the step completes.

## Open
- Vehicle-wide stuck bound changed (all vehicles): worth a quick bike/car smoke by the QA lane (the bound only counts full-throttle, non-braking, non-reversing ticks).
- The naive real-key driver still jams ~25 s in a horde: a player who reverses/steers is fine, but no on-screen hint tells the player to reverse (S).
