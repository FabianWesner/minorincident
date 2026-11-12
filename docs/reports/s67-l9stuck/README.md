# S67 — L9 APC driving blockage (in progress)

The requested whole-route ≤5 s invariant is **not yet verified**. Do not use the focused passing tests as full-route acceptance.

## Implemented

- `c38665de`: held forward APC throttle can turn a retained obstacle into a dynamic body from rest. Previously this required 5 m/s, so a stopped APC could not trigger the shove. Barrier identity and health persist.
- `e67c6aff`: held forward APC throttle also applies a forward contact push to authored movable physics props from rest. Fixed/braced props remain excluded. No actor stats or position assignments were added.
- Focused `tests/engine/vehicles.test.ts` passes (2 tests), including new from-rest barrier and authored-wreck assertions.

## Reproduction and open cause

The native W/route-steering diagnostic is `tools/qa/l9-progress-probe.ts` (still being developed). It excludes authored mission holds from driving-window measurements. It currently does not establish full-route completion or all seeds.

On the same road-following policy, seed 3 recorded 9.13 s on starting main and 13.35 s on PROD `0b650749`, beside a jersey barrier/barricade in the road corridor. This blockage class predates current main. The PROD comparison used one isolated clone at `/tmp/s67-l9stuck-prod-0b650749` because the initial restricted environment could not create shared Git worktree metadata. Cleanup remains pending.

After both changes, a seed-3 diagnostic recorded a 5.27 s window, ticks 9546–9862, from (418.49, -276.02) to (396.13, -268.12). It is still a failure. Earlier in the same run, tick 9300, the APC reported 7.2 m/s while its position barely advanced. Infected contacts continually refreshed the ram velocity floor. Two parentless static colliders touched the chassis at approximately (414.62, 1.06, -277.07) and (417.37, 1.13, -283.35). An automatic reverse precedes the later turn. Static collider ownership and the path into that pocket remain under investigation.

The existing mission pin fallback waits 660 ticks and can assign a new pose. It cannot serve as proof for this task's no-teleport requirement.

## Browser QA needed

Use LOW, god off, held W with ordinary steering. Recheck original QA HUD 632–639 m / ticks 8195–8929, then the HUD 121–122 m bus/roadside trap. Also inspect the native seed-3 pocket around world (418, -280), ticks 9300–9862. Browser verification and opened captures remain pending.

## Remaining acceptance

Full-route native regression over seeds 1–3 with maximum active-driving no-progress window ≤5 s; verify retained props/corpses and no recovery teleport; L9 threat audit with 0 flags; typecheck/lint; exact remote npm test; final report receipts and baseline cleanup. No deployment, push or main movement performed.

## Gate receipts after `73c36370`

- Exact `sh tools/remote/run.sh "$PWD" -- npm test`: exit 0 on 94.130.181.173; 27 files, 106 passed / 1 skipped; Vitest 196.49 s, budget wrapper 199.1 s below 240 s. No test trimming.
- `node --import tsx/esm tools/qa/threat-audit.ts --levels L9`: skilled complete, passive tick-budget, 0 L9 passive flags; exit 1 is the documented partial-selection diagnostic flag.
- The road diagnostic remains red. Its latest waypoint-tracking policy completed seed 2 but recorded 10.05 s beside retained barriers. A lateral obstacle-launch experiment worsened the result and was reverted. These gates do not prove the requested driving invariant.
