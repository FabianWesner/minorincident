# L5 burned civilian cars

Delivered as base-owned `burned` variants; the four integrated bases retain their existing runtime IDs and budgets. Each requested dotted ID has its own build wrapper. Native authored LOD1 supplies near/mid geometry; native authored LOD2 supplies far geometry. No decimation, atlas, flame meshes or new dependencies.

## Measured production meshes

| Asset | LOD | Triangles | Draws | Materials | Bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| veh.sedan-red.burned | 0 | 11,017 | 7 | 3 | 334,012 |
| veh.sedan-red.burned | 1 | 4,236 | 7 | 3 | 105,588 |
| veh.sedan-red.burned | 2 | 1,568 | 7 | 3 | 45,896 |
| veh.sedan-blue.burned | 0 | 11,286 | 7 | 3 | 306,052 |
| veh.sedan-blue.burned | 1 | 4,210 | 7 | 3 | 98,936 |
| veh.sedan-blue.burned | 2 | 1,928 | 7 | 3 | 49,976 |
| veh.sedan-white.burned | 0 | 12,123 | 7 | 3 | 330,548 |
| veh.sedan-white.burned | 1 | 5,794 | 7 | 3 | 145,864 |
| veh.sedan-white.burned | 2 | 1,580 | 7 | 3 | 42,244 |
| veh.suv-dark.burned | 0 | 10,950 | 7 | 3 | 255,508 |
| veh.suv-dark.burned | 1 | 5,704 | 7 | 3 | 140,060 |
| veh.suv-dark.burned | 2 | 1,632 | 7 | 3 | 44,368 |

All tiers are below 15,000 / 6,000 / 2,000 triangles and eight draws. Draw counts include the four wheel assemblies and all body materials; the preview’s extra floor draw is excluded. All retained root/body/wheel/door/seat/exit/collider interface anchors have zero measured translation and full-matrix drift and no missing anchors. Every tier has zero active light records and zero emissive materials. Original colliders remain non-rendering.

## Visual review

**veh.sedan-red.burned:** The red livery, compact roof and nose match the integrated red sedan. Missing glass, the roof opening, folded hood and flattened tyres read at 135/190 px. Soot is more angular and less finely mottled than the reference, especially on LOD2; the far roof no longer has the artificial raised boolean cap.

**veh.sedan-blue.burned:** The blue livery and four-door profile match the integrated blue sedan. Empty window frames, dark exposed cabin, buckled nose and ruined tyres distinguish it at both sizes. The far soot regions are broad triangles rather than the reference’s fine orange oxidation; far rims are intentionally coarse.

**veh.sedan-white.burned:** The pale livery, raked roof and trim match the integrated white sedan. Its formerly solid black windshield gasket backing is removed, exposing the scorched cabin; window borders survive all tiers. The reference has a much wider-open driver door; this model uses a bent door within the native vehicle envelope. LOD2 loses small oxidation islands.

**veh.suv-dark.burned:** The taller cabin, roof rack and off-road nose match the integrated SUV, whose roof lamps and bumper differ from the reference SUV. The lamps are dead and glazing is absent; roof opening, buckled hood and collapsed tyres survive. Its dark cabin is less legible at 135 px than the lighter sedans; rack and shell silhouette remain recognizable.

## Evidence

Each `test-results/l5-burned-civilian-cars/<id>/` contains `comparison.png` (reference + turntable), `lod-contact.png`, `reference-lod-contact.jpg` (reference + every tier at five angles), `game-reference-peer.jpg` (135/190 px), and loading JSON. Sheets are at most 1600 px wide. Intermediate screenshots were deleted. Eight JPG sheets were copied to `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/l5-assets/`.

Exact build/capture/check commands are retained in `commands.sh`; helper sources are `capture-peer.ts`, `sheets.py`, and `measure.ts`. Browser runs were sequential, headless Metal WebGL2 under `tools/e2e-lock.sh`, using a lane-owned preview on 3313. WebGPU is manual.

## Validation

Per base, sequentially: `npm run assets:build -- <base> --decay burned`, `npm run assets:pack -- <base>`, `npm run assets:validate -- --ids <base>`. Every declared base/wrecked/burned LOD passed. Full validation, typecheck, lint and remote unit results are recorded below when complete.

Unit workers are capped at two per the crash-recovery instruction. The local shared-lock wait was cancelled before tests started when remote tooling landed on main. Remote final command:

```sh
sh tools/remote/run.sh "$PWD" --pull test-results/l5-burned-civilian-cars/unit.json -- sh -c 'npm run typecheck && npm run lint && npm run test:unit -- --maxWorkers=2 --reporter=default --reporter=json --outputFile=test-results/l5-burned-civilian-cars/unit.json'
```

No level/runtime behavior was implemented. Regenerating stale generated collision/physics records from merged main required smoke validation; E23 gameplay verification is outside this asset delivery. District lane owns at least ten total burned-car placements, nearby fire/smoke and mission behavior. Request the intact ID with `decay: burned`; door/seat/axle anchors remain available. Heavy spent-shell physics is non-pushable/non-kickable/non-flammable.

## Recovery and commits

Recovered the prior source commit `edf929e3`. Preserved the unfinished roof/hood fix as `f061f879`; merged main as `ca99b647` and later `c6ee5e61` when remote tooling arrived. Production exports and reviews: `fb1a1590`. Further small source commits: `6a583fd6`, `53ae8ee5`, `7608099d`, `08589ca9`, `e0e355fe`. The crash-era generated collision/validation changes are preserved in the `crash-generated-validation` stash; initial global collision regeneration was excluded until the remote unit run proved merged main’s chair metadata stale. It was then regenerated with the production physics records in `29e29ea9`. No specs or references were edited by this lane. No push, merge into main or deployment.

Repeat-build evidence: `determinism.json` records matching geometry hashes and file byte sizes across all twelve tiers.

The blue far-tier self-intersection solver experiment exceeded its cap (2,196 triangles); the build aborted safely before runtime replacement. The final blue recipe is 1,928 triangles, with no budget increase.

Final global asset validation: **847 passed, 0 failed**, including 36 checks for the four bases and their declared variants/LODs (`validation.json`). Final source/production evidence is committed as `fb1a1590`.

Initial remote result: **101 unit files passed / 2 failed; 362 tests passed / 2 failed**. Both failures were generated-data freshness checks for main’s updated chair GLBs (`unit-before-metadata-refresh.json`). Regenerated using `npm run assets:collision` and `npx tsx tools/assets/physics-metadata.ts`; no asset budget or test was weakened. Final rerun includes typecheck, lint, full two-worker unit, `npm run build`, and `npm run test:smoke -- --project=chromium` on the remote runner with `E2E_PORT=3313`.

Final checks:

- `npm run assets:validate`: **847 passed, 0 failed** (36 checks for these bases/variants).
- `npm run typecheck`, `npm run lint`, `npm run build`: **passed**.
- Remote `npm run test:unit -- --maxWorkers=2 ...`: **103 files / 364 tests passed, 0 failed** (`unit.json`).
- Remote simulation smoke: **5 files / 6 tests passed, 0 failed**, 852 non-smoke tests skipped.
- Local browser smoke: **9 passed, 0 failed**, headless Metal WebGL2, two workers (`smoke-metal.json`). Exact command:

```sh
E2E_PORT=3313 sh tools/e2e-lock.sh npx playwright test --grep @smoke --grep-invert webgpu --project=chromium --workers=2
```

The default remote smoke script attempted 10 browser cases: **6 passed / 4 failed**, with three SwiftShader timeouts and a Linux WebGPU buffer error (`smoke-remote.json`). The three timed-out WebGL2 cases passed on Metal in 22.3 / 8.0 / 21.5 seconds. The supported local WebGL2 suite passes in full; WebGPU remains manual per repository instructions. No timeout, assertion or budget was widened. The remote queued rerun was moved to an idle third runner; only this lane’s queued job was cancelled. The lane-owned preview and Playwright server are stopped.

Evidence commit: `3bc8159a`; generated metadata freshness fix: `29e29ea9`. Technical blockers: none. Independent orchestrator visual acceptance remains outstanding; visual limitations are listed per asset above.
