# Batch 13b integration evidence

Base: `888954944`. Ordered merges: courier-night-look `e210203e3`, visual-polish `19bd689a0`, perf-w5d `55cc3a6b2`.

The orchestrator explicitly approved the T-E29-14 method change during this integration: exclude ring samples inside the courier's ID silhouette because the criterion measures background contrast. The threshold remains 3 and at least 12 visible ring samples are required. This is an orchestrator-approved method change, not a relaxed contrast threshold.

Merge resolutions retain the camera hotfix's `coversLens` and the BVH raycaster's `firstHitOnly`, and union the scene filters (camera, controls, courier gear, polish and performance scenes). `npm install` succeeded with zero vulnerabilities; package-lock.json already contains three-mesh-bvh 0.9.16 from the courier branch, and install made no further change.

## Incoming artifact review (branch evidence, not final-build certification)

Opened `courier-night-look/sheets/L5-qa-webgl2.jpg` and `L7-rocket-webgl2.jpg`. L5 retains teal caps/bag, yellow-orange fabric, peach skin and brown/auburn hair under warm dusk. L7 female z1.5 high/low retains saturated teal and orange against dark purple companions; the authored cap panel and shoes are white but the courier's body/outfit is not white or pastel. Sheet labels: contrast 3.39 high / 3.37 low, zero clipping. The neighbouring figures are strongly darkened, and health bars overlap the group.

Opened `visual-polish/review-final-webgl.jpg`: waiting civilians show different bent/cowering/looking postures; low silhouettes have solid torsos/legs; Alpha purple arms and dark clothing form continuous surfaces, and blood sits on the ground. This single mosaic demonstrates varied poses, not by itself asynchronous motion; the native idle integration assertion is needed for phase evidence.

## Red tracking

| Check | Red on main yes/no | Integration outcome |
| --- | --- | --- |
| Convoy occlusion, high/low z1/z1.5 | yes (orchestrator baseline) | UNMEASURED: matrix admission exit 75 |
| APC low z0.5 | yes (orchestrator baseline) | UNMEASURED: matrix admission exit 75 |
| L4 low pickup window, main 110.9 ms | yes | UNMEASURED: browser admission limit |
| L7 low timing | yes | UNMEASURED: browser admission limit |
| Zoo S1/S2 sim timing | yes (orchestrator baseline) | passed in the final post-performance remote sweep |
| L8 phone sim p95 | yes | UNMEASURED: browser admission limit |
| Crossing T-E31-19-S4-200 sim timing | no in isolated main-source check (1 passed) | failed after polish; passed in post-performance sweep |

The L4 timing conflict was resolved to start recording immediately after the plaza, retaining batch13a's real pickup/alarm window. The perf branch's pre-step to `turnDueAt` is not retained: pickup now triggers the alarm immediately. Lightweight `perf().l4` beat polling and the perf branch's stricter 50 ms transition bound are retained.

The StaticCorpses merge keeps incremental float32 sphere union and the visual-polish probe LOD field. InstancedGroup retains both the BVH full-batch API (its incoming equivalence tests) and the performance lane's prepared BVH selected-placement API used by DistrictView; camera `coversLens` remains present. No forbidden paths or staticCollision.ts changes were introduced.

Also opened incoming `visual-polish/individuals/webgl/polish-alpha-corpse@high-z1.5/sheet.jpg` and `visual-polish/webgl/polish-waiting-crowd@low-z1.5/sheet.jpg`. These are wide game-camera sheets, so they establish full silhouette coverage but not close surface detail. Opened `visual-polish/close/webgl-low-alphas.png` and `webgl-low-waiting.png` for detail: purple Alpha arms/fingers, black torso and boots remain solid around authored red facial wounds; Mega red torso is solid. Low civilians have continuous jackets/trousers, with a standing guard, clasped hands, raised palms and separate bent/cowering gestures. These remain incoming-branch evidence until recaptured on this integration.

## Final-build browser gate and admission limit

Command: `E2E_PORT=3671 SCENE_PORT=3672 sh /Users/wesner/Workspace/minorincident/epics-pipeline/gate-browser.sh "$PWD"` on `492e86995`.
Typecheck, lint and the fresh production build passed. All **16 smoke tests passed**, zero skipped/unexpected/flaky (see `smoke.json`). This includes WebGL/WebGPU crowd visibility, WebGPU mega bars on both tiers at both zoom limits, and WebGPU L1/L4/L8 game-camera canvas checks.

The next stage, the complete WebGPU scene matrix, never acquired admission: other lanes maintained one or two active browser roots. The wrapper stopped after **1,800 seconds**, **exit 75**. Under the binding fairness rule, no further browser queue was started. Consequently the full scene matrix, later gate e2e and grading stages, final-build T-E29-14/colour recaptures, native body/idle phase recheck, touched WebGL matrix, L4 low pickup/first-turn T-E22-20 remeasurement, L7/L8 phone timing and standalone E18 native timing are **UNMEASURED**. `npm run verify -- E18` is not complete. No E18 performance certification or deploy approval is claimed. Incoming receipts and images described above do not substitute for those missing integration checks.

`incoming-contrast-summary.json` records L7 capture-index minima by backend/tier: WebGL high **3.385882**, low **3.374276**; WebGPU high **3.385416**, low **3.372854**. Every minimum occurs at z1.5; each cohort has 12 rocket/horde × survivor × zoom rows. These are incoming courier-branch measurements, not integration reruns.

The orchestrator subsequently requested disk cleanup. Removed this lane's 38 disposable browser files (15.7 MiB), temporary helper scripts and completed `dist/` (363 MiB); retained only report receipts and tracked repository artifacts. There were no extra temporary worktrees or old dist copies. Two smoke-generated tracked boot PNGs were restored to HEAD. Free space was 9.4 GiB at cleanup completion and later reached 15 GiB (also affected by concurrent lane cleanup).

## Remote suites

Both ordered snapshots ran `sh tools/remote/run.sh "$PWD" -- npx vitest run tests/unit tests/sim tests/levels --maxWorkers=4`; no local Vitest sweep was run.

After visual polish (`bd4ea617e`): **3,213 passed / 11 failed / 11 skipped**, 505 passing files / 11 failing / 3 skipped, **3,170.58 s**, exit 1. Every failure was a simulation p95 assertion: director 200, L10 assault high, NPC campaign high, Alpha physical/support/scheduler 200, E18 horde 200, Mega moves 200, zoo S1/S2 200 and crossing residency 200. Unit and functional campaign checks passed, including both continuous complete/newbie L1–L6 and the L1–L10 campaign. Full receipt: `after-polish.log.gz`.

The crossing-only same-test check with `888954944` source in a private remote job passed (1 passed / 10 filtered skips, 8.46 s, exit 0); receipt `main-crossing.log.gz`. This was a source replacement only inside the runner's disposable private job, not in this worktree. No extra local baseline worktree was created.

Opened artifacts: [L5 colours](../courier-night-look/sheets/L5-qa-webgl2.jpg), [L7 rocket colours high/low and all zooms](../courier-night-look/sheets/L7-rocket-webgl2.jpg), [polish mosaic](../visual-polish/review-final-webgl.jpg), [Alpha corpse z1.5](../visual-polish/individuals/webgl/polish-alpha-corpse@high-z1.5/sheet.jpg), [low crowd idle sheet](../visual-polish/webgl/polish-waiting-crowd@low-z1.5/sheet.jpg), [low bodies close](../visual-polish/close/webgl-low-alphas.png), [low waiting figures close](../visual-polish/close/webgl-low-waiting.png).

Receipts: [after-polish remote suite](after-polish.log.gz), [post-performance remote suite](after-perf.log.gz), [main crossing comparison](main-crossing.log.gz), [browser gate](gate-browser.log.gz), [smoke results](smoke.json), [fresh build](build.log.gz), [after-polish typecheck](typecheck-after2.log.gz), [after-polish lint](lint-after2.log.gz), [post-performance typecheck](typecheck-after3.log.gz), [incoming contrast index summary](incoming-contrast-summary.json).

After performance (`492e86995`): **3,250 passed / 0 failed / 9 skipped**, **531 passing files / 3 skipped**, **3,241.16 s**, exit 0. All 11 timing cases that failed in the intermediate sweep passed in this final sweep, including the known zoo S1/S2 cases. No threshold was changed during integration; differing runner load prevents attributing the entire timing difference to code. Full unit, simulation and `tests/levels` coverage is complete. Both continuous L6 campaign policies and the L1–L10 credits run passed. Native GPU E18 budgets remain unmeasured as stated above.
