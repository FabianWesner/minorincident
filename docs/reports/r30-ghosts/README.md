# r30-ghosts: "see-through ghost" infected and point-blank machine gun (from r28-vqa)

Lane r30-ghosts (claude-sonnet-5-5), 2026-11-10, base main 8d729271. Raw captures are not in git:
`/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/r30-ghosts/`.

## 1. Ghost infected

**It is not the see-through occluder.** Probed in the real game (fixtures l10-dispersal-console and l9-before-rail-stall, high, zoom 1, WebGL2, dev server) by toggling uniforms/materials in the page (`tools/qa/r30-ghost-probe.ts --probes <json>`):
- `seeThrough.strength`/`bossStrength` = 0, courier foreground slice off, hit flash forced to 0, corpse pages hidden, all stencil writes off, crowd `maskNode` removed, `DoubleSide`: no change in the ghosting. The crowd meshes are opaque (`transparent=false`, depthWrite on). `fade` in CrowdView is a constant 0.

**Cause A (L9 APC, confirmed): the 100-active rule.** `CrowdView` line `e.health.current <= 0 || active.length >= 100 ? 'lod2'` put EVERY living infected on the flat far LOD2 once 100 were active, also the ring touching the APC. L9's director cap is 184, so the hatch defence hits it every time. LOD2 is the "broken kite torso" the lodPolicy comment warns about; at night with the moonlit rim fill it reads as pale, translucent figures. Measured by spawning 110 runners around the APC in l9-before-rail-stall: baseline `active 165-173`, every batch `:lod2`; capture `l9-base2/probe-3-later.jpg` (opened) shows the pale ghost crowd exactly like the r28 capture.

**Fix:** in a dense crowd (`active >= denseCrowdLod2 = 100`, high tier) the nearest `denseNearLod1 = 40` living bodies that are big enough for LOD1 (`crowdLod(pixels) === 'lod1'`, about 96+ CSS px) keep LOD1; the rest still drop to LOD2 (draw budget). After the fix with the same spawn (`active 167`): runner/suburban-mom/bbq-dad batches are `:lod1` (probe log), and `l9-fixed2/probe-3-later.jpg` (opened) shows solid, detailed bodies in the front ring. Bodies further back and beyond 40 are still LOD2 and still pale.

**Cause B (L10 console, NOT fixed, hypothesis):** there only 22 infected were active (all LOD1/LOD2 by pixels), so the 100-rule does not apply. Zoomed crops (`l10-probe12/zoom.jpg`) show a patchwork of flat colour patches with hard edges: many bodies (living firefighters plus a pile of corpses) occupy nearly the same spot and z-fight. That looks "see-through" but is stacked coincident bodies, i.e. the crowd clumping/pile problem, not a material. I did not find a one-line fix; it needs the corpse placement (`corpseLayout`) or contact separation to spread bodies. Open item.

**Scene Lab:** new specs `tests/scenes/catalog/r30-ghost-crowd-courier.json` and `r30-ghost-crowd-apc.json` (42 runners in three rings around the courier / the driven APC, L9 night). Both pass (consoleErrors 0, no clipping) on WebGL2 and WebGPU, high and low, zoom 1; opened: `m-webgpu-low/.../courier` and `m-webgpu-high/.../apc` show opaque bodies. Caveat: Scene Lab's director cap is below 100, so these specs do NOT exercise cause A (they pass before and after the fix); the 100+ case was only reproducible through the game fixture. Zoom 1.5 was not run for them.

## 2. Machine gun at contact range

Sim test folded into `tests/engine/aim-assist.test.ts` (first test; the 150-case and 45-file budgets are full): courier with `weapon.army-mg` holds fire for 1 s at an immortal dummy straight ahead.
- 4 m: 19 hits per 2 s, 133 hp/s (a separate run at 120 ticks). 1.1, 1.2, 1.3 m: identical (19 hits, 133 hp/s). 1.2 m at 20 degrees off the facing with aim assist, and 1.2 m with assist off: the same.
- So there is no minimum range, no muzzle-inside-capsule loss and no hit-query offset problem. **No game change.** What r28-vqa saw is most likely the QA script (it fires at the drawn chest of the nearest enemy while kiting, no sustained aim) and the real armour: `weapon.army-mg` TTK for armored is 5.5 s (balance table), so 530/600 HP remaining after a short burst is expected. The firefighter staying at 210/210 is not explained by this test (a sim dummy with firefighter HP loses it in 1 s); it was the script not hitting. Not filed as a bug.

## Checks

- `npm run typecheck`, eslint on the touched files: clean.
- `npx vitest run tests/engine/aim-assist.test.ts`: 3 passed.
- `npm run test:gate`: 106/107 passed. The one failure, `tests/tools/gate-tools.test.ts` "browser pool admission backs off under WindowServer pressure ... 'STALE' to be 'FRESH'", is in browser-pool tooling this lane did not touch (it depends on the machine's WindowServer sampling); not investigated.

## Browser QA needed

After merge, play L9 hatch defence and L10 console at high zoom 1 and 1.5: front ring of infected must read solid at night. Perf with 150+ infected active needs a quiet-window check (up to 40 LOD1 bodies instead of LOD2; draw calls are per batch so only triangles grow, about +60k).
