# r39-l10nan: courier invisible + NaN muzzle after the L10 console fight (P1)

QA finding (r38-vqa P1-1, verbatim): "L10 dispersal console: after the Mega Alpha's grab-throw, the courier is no longer drawn.
It happened in 2 of 2 runs (fixture `l10-dispersal-console`, high, WebGL2, zoom 1.5, god mode on). ... Her HP also dropped to 80
even with god mode on. Every shot after that throws `RangeError: Query position and radius must be finite` ..."

## Root cause (two bugs)
1. **NaN 'hurt' clip (render, regression from batch 77, s34-zombiehits e2db4c7e).** s34 added `gaitShape` rows for the
   in-place clips `hurt`, `windup`, `swing`, `stagger-left/right` so the crowd's runtime foot contacts plant during hits and
   attacks. `buildRetargetedClip` (`src/render/characters/clips.ts`) also uses `gaitShape[name]` to decide whether to bake a
   clip as a planted walk cycle (`plantLocomotion`). Those clips have no `strides[name]`, so `stride` was `NaN`: every foot
   target, the pelvis lowering and all leg/hip tracks became NaN. The courier's first `hurt` therefore wrote NaN into her hip
   and legs; the sampled-pose restore and the foot contacts kept the NaN, so she stayed invisible for the rest of the level and
   `targets.muzzle` (her drawn gun) returned NaN on every shot -> `Vfx.gunshot -> HitQuery.ray -> nearby -> SpatialHash.query`
   threw once per shot. The sim pose stayed finite (as QA logged).
   - The grab-throw was not the cause; it is just what happened before. The first NaN frame in the repro is the first `hurt`
     (tick 660 in run7: `player.damaged=10` from `hazard.fire`, animation `hurt`, first NaN node `hip`, stage `mixer.update`;
     the `hurt` action's interpolants returned NaN for `hip.position` and `legL/legR/shin/foot.quaternion`).
   - In god mode the courier normally never plays `hurt`, which is why it showed up only after bug 2. Without god mode, any
     courier hit since batch 77 does the same.
2. **God mode did not cover hazard fire on campaign levels (sim, old).** `Hazards` cached `world.combat?.damage` in its
   constructor; campaign levels replace `world.combat` afterwards (`src/sim/npc/install.ts`), so fire/toxic zone damage used a
   stale `Damage` without the `god` flag (true on every campaign level checked: L1, L4, L10). The Mega fight set a fire next to
   the console (explosion at tick ~614-630); two 10-HP fire ticks gave HP 80 and the `hurt` that triggered bug 1.

## Fix (commit on the lane branch)
- `clips.ts`: only loop gaits with a stride are baked through `plantLocomotion` (`gaitShape[name] && strides[name]`). The crowd's
  runtime planting (CrowdLocomotion reads `gaitShape` directly) is unchanged; the action clips are back to their pre-b77 bake.
- `Hazards.ts`: `damage` is a getter on the live `world.combat.damage` (fallback instance only without combat).
- Fail-safes: `KeyframeAnimator.guardFinitePose` resets a non-finite hip/leg/arm pose to the bind pose and resets the foot
  contacts (one `console.warn`); `Vfx.gunshot` falls back to the sim origin for a non-finite muzzle (one `console.warn`) and never
  passes non-finite values to the hit query. The sim `SpatialHash` keeps throwing (sim contract).
- Zombie stats untouched; corpses untouched.

## PROD b75 (93016109)
Checked by ancestry, no b75 build: s34 (e2db4c7e) is not in b75 and b75's `gaitShape` has no `hurt` row, so the invisible
courier is a batch-77 regression (main only). The stale hazard `Damage` (god bypass) is in b75 too, so it is old, but it only
matters for the god cheat / QA. No /tmp worktree was created.

## Tests
- `tests/shared/render-contracts.test.ts` (`checkFiniteActionClips`, inside the skinned-crowd case; no new case, test budget):
  retargets hurt/windup/swing/stagger-left/right (rigid and skin) plus walk/run (rigid) on a minimal biped and asserts every
  track value is finite. Fails on main ("rigid hurt hip.position"), passes with the fix.
- `tests/engine/director-pressure.test.ts` (`hazardFireRespectsGod`, inside the native-routing case): L1, god on, a fire under
  the courier for 130 ticks keeps her HP. Fails on main (80 vs 100), passes with the fix.
- Native probe `tools/qa/r39-l10nan-probe.ts` (sim side; `force=1` forces the Mega grab): sim stays finite through the grab and
  release (confirms the NaN was render-only).

## Real-play verification (fixture l10-dispersal-console, zoom 1.5, headless, one browser via e2e-lock, port 4941)
Repro + probe: `tools/qa/r28-vqa-fixture-play.ts` with the new `--watch` option and `--setup "$(cat tools/qa/r39-l10nan-setup.js)"`
(a per-frame probe that records the first non-finite courier node, the pipeline stage that produced it and the sim events; it also
spawns up to 8 small fire patches in front of the running courier so she gets hurt deterministically, logged as QA setup).

| Run | Build | Quality / backend | God | Result |
|---|---|---|---|---|
| run7 | main (no fix) | high / WebGL2 | on | reproduced: HP 90/80, first NaN tick 660 `hip` after `hurt`, 479 page errors |
| run9-11 | main (no fix) | high / WebGL2 | on | reproduced with forced fire (335 / 214 errors), stage `mixer.update`, hurt clip interpolants NaN |
| v-high-gl-nogod | fix | high / WebGL2 | off | HP down to 30 (real hits), no NaN, 0 page errors |
| v-low-gpu-nogod | fix | low / WebGPU | off | 8 fires, HP down to 40, no NaN, 0 page errors |
| v-high-gpu-god | fix | high / WebGPU | on | 8 fires under her, HP 100, no NaN, 0 page errors |
| v-low-gl-god | fix | low / WebGL2 | on | 8 fires, HP 100, no NaN, 0 page errors |

Captures (not in git): `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/r39/`
(`r39-verify-sheet.jpg`: 12 frames, 3 per run, ticks ~780-1520, opened): the courier is drawn with her gun next to the corgi in
every frame, including the no-god runs after several hurts (HUD 30-63/100) and the god runs standing in fire patches (100/100).

Checks: `tsc --noEmit` clean, eslint on touched files clean, focused vitest (render-contracts skinned-crowd case,
director-pressure native-routing case) pass; full `npm test` on the remote runner: 27 files, 106 passed, 1 skipped (161.6 s of 240 s budget).

## Browser QA needed (QA lane)
- Any level, no god: take hits while running / standing / shooting at zoom 1.5, high and low: courier stays drawn, no page errors.
- L10 console fight (fixture `l10-dispersal-console`), no god, full Mega fight to phase 3.
- Crowd hit reactions and attacks (s34) at zoom 1.5: feet still planted during hurt/windup/swing/stagger (runtime contacts are
  unchanged, but the baked clip lost the NaN planting, so compare against r38 sheets). Note: `bakeInfected` samples the same
  `retargetClip` for rigid crowd figures without embedded animations, so their hurt/windup/swing/stagger bake frames were NaN
  in b77 too (possible blink/vanish during those clips on rigid crowd rigs); with the fix they bake as before b77.
