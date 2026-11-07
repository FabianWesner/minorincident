# r5-l7: L7 survivor losses and the false "Survivor lost behind you!" (Opus)

Base `8b7a1fa0` (batch 58). Commits:
- `84439ccc` fix(L7): evacuee bites cost health; the "lost" warning only fires for real stragglers.
- `d0b3ce77` tools(playtest): optional read-only L7 roster audit (`PLAYTEST_L7_ROSTER_AUDIT=1`).
- `9da0295d` qa(threat): a follower in grab contact counts as engaged, not walking (see the commit log).
- `8dd0af84` fix(L7-05): press the two closest high-tier kerb runners onto the courier.

No deploy, no push.

## The finding (vqa58, verbatim)

> "survivors die off. Fresh save: the courier is mobbed at the truck, the group drops from 24 to 7 before the corridor, and only 2 board. Preset save: the group drops from 24 to 13 in 6.5 s. 'All 24 board' fails in both runs."

> "Babysitting: 'Survivor lost behind you!' shows while the whole group is nearby."

## Cause

1. **One bite was always fatal.** L7 evacuees use the shared L1 pedestrian bite: an infected touches a follower, holds it for 1.0 s, and the bite kills it (or turns it, when a slot is free). Only a hit on the biter inside that second saves the follower. The 100 HP bar each follower shows (G-12) never mattered. Alpha slams were only a small share of the damage.
   - A sim probe (`test-results/r5-l7/probe.ts`, preset, low, seed 1, god mode) counted the events on followers.
   - When the courier stood 15 s at the truck without firing, 15 of 24 died within 8.7–14.8 s, all 2–8 m from her. That was 18 grabs, 15 bites, 15 `civilian.finished`, and zero `combat.hit` or `infected.attack`.
2. **Why the bots pass.** The `complete` bot fires the launcher with perfect aim at every visible infected within 24 m. No infected ever reaches the column: zero grabs, 24/24 board. A real player who is slower, or who fights the first wave at the truck, cannot rescue 24 people in 1-second windows.
3. **False warning.** Both `lost` ("Survivor lost behind you!") and `attack` ("Survivor under attack! Turn back!") only checked that the follower was off screen. At close zoom, any death inside the column next to the courier was off screen.
   - The real-input before run (high, fresh) showed "lost behind you" for 44 sampled seconds, every time with all living followers within 18 m.

## Design intent

From E29, §5.3 / AC02 / AC11:
- Losses through combat and infection rules are intended.
- Zero survivors must still be able to finish.
- A competent `complete` run boards **≥ 60 %** of its starting followers.
- L7-10 means every *living* follower boards. It does not mean 24 of 24.

PO: "overwhelmed is the point". The pressure stays, and the player has to protect the group.

## Fix

- **Bites wound evacuees** (`LevelSevenEncounters.woundFollower`, called from `InfectedSystem.endBite`):
  - A completed bite on a following L7 evacuee takes 34 HP (`l7Encounters.followerBite`), so the third bite kills or turns as before.
  - The biter reels for 0.75 s while the evacuee tears free.
  - Each wound emits `infected.attack` (special `bite`), so audio, the HUD warning and QA counters see it.
  - An unprotected group still dies. With no player fire at all, 24/24 died within about 20 s, with or without the fix.
- **Warnings:** `lost` and `attack` now also need the follower to be more than 18 m from the courier. This is the existing corridor-group range, now the constant `l7FollowerRangeM`. "Wait for us!" is unchanged.
- **L7-05 kept:** with followers surviving, the high-tier stationary first attack on the player drifted from 9.3 s to 11.15 s (limit 10 s). The r2-l7 opening press now targets the two closest high-tier kerb runners instead of one. Result: 0.7 s high, 1.3 s low (unchanged).
- **Threat audit (QA tooling, not the gate threshold):**
  - In passive runs, mauled followers now lived long enough (10–14 samples) to enter the G-13 pace median. That gave 13 `SLOW_FOLLOWER` flags.
  - The observer now also counts a follower as incapacitated while a living infected is within 1.5 m. Grabbed, bitten and knocked-down states were already excluded.
  - **The orchestrator should review this:** it narrows which samples count as walking for every level. The 0.95 ratio is unchanged.

## Before / after

### Real input

Setup: `test-results/r5-l7/run.ts` (vqa58-run copy, local dist vs a pre-fix `dist-before`), god-mode courier, zoom 1, rocket.

| Run | Before | After |
|---|---|---|
| low, WebGPU, preset (male) | 19 board (5 turned at the final horde, ~120 s); 5× "Survivor under attack! Turn back!" with all 24 within 18 m | **24/24 board**; no lost/attack warning |
| high, WebGL2, fresh | **4 board** (10 dead, 10 turned); "Survivor lost behind you!" for 44 sampled seconds, always with every living follower within 18 m | **6 board** (see below); no "lost behind you" |
| low, WebGL2, fresh | driver stalled at (39.5, 40.9) at 180 s with 24/24 alive, before the bus (harness navigation) | **23/24 board** (1 turned) |

**High/fresh is a driver artifact.** The playtest driver never steps the last 3 m to the launcher. It fights with the army MG at the truck for 50 s, with up to 56 infected within 10 m, and the group dies there (24 → 7 by 48 s, all before pickup). The same driver behaviour explains vqa58's "mobbed at the truck, 15 s to close 3 m". A human picks up the launcher. I did not change the opening for this; flag it for the next playtest-harness lane.

The after-runs used the build from before `8dd0af84`. That commit only changes which runner is pressed at arming, so it adds one more courier-focused runner. The real-input after-runs were not repeated on it.

### Sim

`probe.ts`, preset, god mode. "late" means the courier stands 15 s at the truck without firing, which reproduces the mob.

| Policy | Before | After |
|---|---|---|
| bot (complete), low, seed 1 | 24/24 | 24/24 (high seed 2: 24/24) |
| late, low, seed 1 | 9 board | 20 board |
| late, high, seed 1 | — | 19 board |
| burst fire (6 of 48 ticks), low, seed 1 | 23 | — |
| no fire, low, seed 1 | 0 (all dead by 26 s) | 0 (all dead by ~20 s) |

## Checks

- `npx tsc --noEmit`: pass.
- `npm run lint`: pass.
- `npm test`: **27 files / 107 tests pass**, 150/150 test-case cap, 55.8 s.
  - New `checkFollowerBites` is folded into the existing L7 navigation helper (`tests/helpers/l7Uat.ts`). One unopposed runner kills an evacuee on the third bite (100 → 66 → 32 → dead), the biter reels, and there is no lost/attack alarm beside the courier.
  - Mutation check: with damage 100 (the old behaviour) the test fails.
- `npm run qa:accept -- --level L7 --tier both --skip-browser` (final source): 1 fresh failing row, 8 incomplete. Generated status files were restored.
  - **L7-05:** every automated clause passes (low first attack 1.3 s, high 0.7 s). The row stays FAIL only through its stale manual review, as on main.
  - **L7-01:** physical pickup/browser clause, same as main.
  - **L7-10:** PASS.
  - **L7-09:** NOT CHECKED in the final run. An intermediate high-only run failed G-13 departure follower 66 (0.896 / 0.914). A control run with **main's** bite and observer code failed it identically (0.896 / 0.914), so it is pre-existing and not caused by this lane.
- `node --import tsx/esm tools/qa/threat-audit.ts --levels L7` (final source): skilled 0 and passive 0 follower-pace flags, and zero L7 gameplay flags. Exit 1 only for `PARTIAL_LEVEL_SELECTION`, as in r3-l7.
- The full-campaign `qa:threat` (remote, all of L1–L10, observer change included, on `9da0295d`, before `8dd0af84`): **0 fail flags**, exit 0, 1176 s.

## Open

- **Playtest driver:** fresh-save L7 should step onto the launcher before fighting (`tools/playtest/session.ts` combat branch).
- **Pre-existing:** G-13 high departure follower 66 pace (0.896 / 0.914, seeds 2 and 3).
- **Unexplored:** the preset run lost 5 to the final horde before the fix. After the fix it lost 0, but only one run per configuration was taken.
