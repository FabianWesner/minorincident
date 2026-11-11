# S57 flamingo locomotion and foot-slide gate

**Status: in progress; acceptance is not proven.** The current lane changes contain the first presentation correction and p95 gate plumbing. The before/after motion matrix, reviewed frame strips, full animal/infected actor coverage, flock separation audit, required remote unit command, and complete Scene Lab gate remain outstanding.

## Finding and change

`AnimalMoves.sample()` treated arena engagement, chase, and attack state as a reason to fly at a 2.4 m cruise height. The paw solver correctly disables contact solving while the animal pose is airborne, so ordinary pursuit had no planted feet. Flamingos now take off only during the authored `flamingo.dive` telegraph/active stages; they return toward ground during recovery. This keeps the existing pose/flight blend for the move while allowing ordinary pursuit to use the grounded animal locomotion path. No model files, stats, or lion code changed.

Scene Lab expectations now support `footSlideP95MaxCm` and explicit `footSlideActors`. Each named actor must have a non-null contact p95 and stay at or below 3 cm; missing actors and actors with no contacts fail. The gate criteria cover the moving L8 animal lineup, dog trot/flee, and two ordinary infected chase rows. The L1/L3 scene criteria were extended because those existing rows did not assert the requested foot-slide invariant.

## Measurements

| Fixture | Before p95 | Current p95 | Target | Evidence status |
| --- | ---: | ---: | ---: | --- |
| Flamingo walk/run, day/night × low/high × WebGL2/WebGPU | not measured | not measured | ≤ 3 cm | browser gate blocked |
| L8 animal lineup, named actors | not measured | not measured | ≤ 3 cm | browser gate blocked |
| Dog trot/flee and L1/L3 infected chase | not measured | not measured | ≤ 3 cm | browser gate not run |

The authored source path establishes why the old flight pose released contacts, but it does not establish a measured before/after p95. The requested matrix and same-source baseline capture must be produced before acceptance.

## Visual evidence

The supplied `po-flamingos-292.webp` was opened. It shows a night arena with the courier and a clustered group at the lower left, but no visible flamingos in the image; it cannot establish their pose or spacing. No frame-strip contact sheet has been captured or reviewed in this run.

## Validation and blockers

- `npm run lint`: passed.
- `npm run typecheck`: passed after the change.
- Focused `tests/shared/render-contracts.test.ts`: 14/14 passed after correcting the new grounded-pose assertion.
- Required `sh tools/remote/run.sh "$PWD" -- npm test`: no healthy Hetzner runner; the local slot rejects this `npm test` package-script form.
- `SCENE_PORT=4958 npm run scene:gate`: the `tsx` CLI could not bind its temp IPC socket under sandbox restrictions. Running the gate runner directly with `node --import tsx/esm` reached all four L8 lineup rows, but the browser pool could not bind its coordinator at `127.0.0.1:4329`; all four rows reported not run (exit 75). No gate pass is claimed.
- Required `tools/ops/slim-worktree.sh "$PWD"`: Git could not write the parent worktree config outside the writable workspace. No tracked files were changed by that failed setup step.
- Explicit `git add` / commit: Git could not create `.git/worktrees/s57-flamingo/index.lock` because the linked-worktree Git metadata is outside the writable workspace. Changes remain uncommitted.

The authored L8 landing-ring code in `L8BossArenas.callFlight()` already staggers later flights by radius and bearing (r42). It still needs a runtime crowd-separation measurement under the requested close zoom and night scene; this source inspection is not proof against stacking.

## Scope notes

The scene-spec edits add the requested measurable criterion, correcting the previous gate omission. Ordinary infected classes beyond the two chase variants and animal species beyond the named lineup/dog fixtures still need actor-specific rows. No flamingo model or asset was edited.

## Unrestricted continuation: runtime evidence

The filesystem/network restrictions were removed. Worktree slimming now succeeds. The filtered L8 lineup gate ran to completion on WebGL2/WebGPU × low/high: **0/4 pass, 0 missing**. Every configuration reports zebra 15.6 cm, gorilla 4.5 cm and elephant 22.8 cm p95. Flamingo is 2.1 cm over one contact with 1.91 m travel in this short fixture; that is not sufficient for full walk/run acceptance. Monkey is 2.5 cm, lion 0 cm, lioness 0.4 cm, stationary dog 0 cm and regular 1.5 cm. These are current-source values, not a before/after comparison.

Opened `test-results/scene-gate/webgl2-low-1/night-boss-zoo-lineup@low-z1.5/sheet.jpg`: three frames (0/30/60), separated animals across the slab. Flamingo remains grounded at the lower left, but the scale and frame spacing cannot establish a detailed stepping gait. Elephant, zebra and gorilla body movement is visible; numeric contact failures remain authoritative. The goal remains active and the next work is to isolate the failing contact phases and complete the dedicated movement fixtures.

The earlier sandbox-only browser and Git blockers are historical. The filtered gate now supplies real failing motion evidence.

### Contact-phase diagnosis

`contact-diagnosis.json` records contiguous contacts from the saved rounded track. Before the heavy hit at frame 55, zebra support feet remain grounded through frame 46 while travelling 17.8/15.6 cm; elephant support feet travel 23.6/22.8 cm through frame 37. Gorilla's frame 26–41 contact travels 15.4 cm. These establish sustained support drift during locomotion, rather than only a hit transition. The diagnostic deliberately labels its unfiltered post-hit contacts as unsuitable for acceptance; production `summarizeMotion` excludes knockdown clips.

`PawContacts.placeAnkle()` currently derives the desired sole orientation from the actor's current heading on every frame, including support. A pinned sole centre therefore still rotates its heel/toe during turns. The next implementation should retain orientation during support and release/re-step when reach is exhausted; its effect on shared animal contact code must be measured without changing lion-specific motion.

### Support-orientation correction

The shared `PawContacts` solver now retains a sole's world orientation during support, follows the body heading during swing/settling steps, and carries orientation across LOD handoffs. It resets that state when contact solving is released. No lion-specific motion changed. The same four lineup rows now pass: **4/4, no known failures or missing rows**. WebGL2 low p95 before → after: flamingo 2.1 → 0 cm, zebra 15.6 → 0.4 cm, monkey 2.5 → 0.1 cm, lion 0 → 0 cm, lioness 0.4 → 0.1 cm, gorilla 4.5 → 0.3 cm, elephant 22.8 → 0 cm. This is the short existing fixture, not the requested full walk/run coverage.

Typecheck and the 14 render-contract tests pass. Reopened the current three-frame lineup sheet: the animals remain separated and grounded, with attached limbs; its distant framing still cannot prove close-view gait quality. The full scope remains incomplete.

### Dedicated flamingo rows added

Added day/night × low/high × WebGL2/WebGPU rows for a 360-frame flamingo fixture. The initial run exposed a vacuous fixture: infected `walk` consumes only the last waypoint, which was the spawn point, yielding zero travel and one static contact. Those eight apparent passes are rejected as acceptance evidence. The corrected fixture attracts the bird to a distinct walk target, then chases a distant courier, and requires at least 6 m of recorded travel. The corrected rows are committed for the next measurement; they have not yet been run. This also corrects the missing movement criterion in the scene gate.

### Corrected flamingo matrix and reinforcement orbit

The corrected 360-frame fixture passes **8/8** day/night × low/high × WebGL2/WebGPU rows. Every row records 11.673 m travel, peak 5.0 m/s, eight contacts and p95 0.1 cm. Compact current-source receipts are committed in `flamingo-current-matrix.json`. This establishes repeated movement in the fixture; before-source comparison, close stepping/flight review and complete class coverage remain required.

Found a reinforcement steering defect: `orbit()` used permanent slot IDs divided by the original count of eight, so slots 8/16/24 reused slot 0's target, and analogous pairs reused the other targets. Flamingo orbit now assigns evenly spaced targets to the currently living flock. Other arenas retain their original slot behavior. Runtime nearest-neighbor/body-overlap proof is still outstanding.

A direct production-method probe with living slots 0/8/16/24/1/9/17/25 now yields a minimum orbit-target separation of 3.8268 m. This is a target geometry check, not live-body clearance evidence. Typecheck and lint pass after the orbit change.

### Ordinary infected class gate expansion

Added individual 180-frame pursuit rows for every `humanInfected` definition (runner, crawler, brute, screamer, sprinter, riot, bloated, firefighter, hazmat, armored, butcher, nurse, Alpha), plus infected dog and cat. Every row requires at least 2 m travel and non-null p95 contacts at ≤3 cm. These scene criteria correct the previous omission of class-specific motion assertions without adding unit cases.

First batch: 11/15 pass. Runner fails p95 3.5 cm; crawler fails 10.3 cm. Cat and sprinter require the existing `allowRigid` audit option to exercise their actual production asset. After enabling that option, sprinter passes; cat still fails with zero travel and absent contacts at the distant trigger and needs a closer physical trigger fixture. The failures remain gate failures, without known-failure exemptions. Compact measured humanoid/dog receipts are in `class-first-pass.json`. Remaining work includes these failures and crow/healthy-animal coverage.

The required remote `sh tools/remote/run.sh "$PWD" -- npm test` reached the healthy runner and collected exactly 150/150 budgeted cases (129 Vitest + 9 e2e + 12 invariant-browser). It timed out at 240.9 s (exit 124 inside the test wrapper, overall exit 1), so no green full-unit result is claimed. Sync took 147 s and remote execution 245 s; the terminal log is `test-results/s57-required-tests.log`. The scene runs are terminal; no checks were left running.

### Cat trigger corrected

The production cat ambush branch remains hidden/perched until a target is within 5 m; the distant 45 m fixture could never activate it. The cat fixture now starts the courier 4 m away and runs her down the lane, exercising the production ambush release and pursuit. The row passes with actual travel and measured contacts; `cat-trigger.json` records the receipt. No cat stats or behavior changed. Runner/crawler slide failures remain unresolved.

### Runner distance-band contact correction

A trial increasing near-solver crowd swing clearance left runner/crawler metrics unchanged; it was reverted. The cheaper `GroundContacts` path rotated a support sole immediately after release, while horizontal travel correctly waited for the lifted portion of the swing. Matching yaw release to that travel window, and retaining at least 4 cm of swing clearance on small-scale figures, reduces runner p95 **3.5 → 2.4 cm** (max 6.5 → 3.2 cm) in the same 180-frame fixture. Crawler remains 10.3 cm and requires a separate reach/transition diagnosis. Trial gates completed; no tolerance changed. The near-solver source is restored exactly to the committed version.

Typecheck, lint and the 14 render-contract tests pass after the distance-band correction. The runner/crawler trial batch is terminal (runner pass, crawler fail).

### Crawler neutral-contact correction

The prone crawler was using the upright solver's neutral point under the hip. The initial resting solve pulled its grounded feet forward by over 10 cm before pursuit; changing swing clearance could not fix that geometry. Crawl-specific contact construction now takes its neutral X/Z from the authored foot position in both the near and distant solvers. Upright figures retain their hip-based neutral point. The same 180-frame crawler row improves p95 **10.3 → 0.1 cm**, max 15.5 → 0.2 cm, with 19 contacts and identical 5.0142 m simulation travel. `crawler-neutral.json` records the current receipt. No lion-specific code or model changed.

Typecheck, lint and 14/14 render-contract tests pass after the crawler correction. Opened the generated crawler sheet: the figure retains its prone silhouette and progresses across the surface, but the follow camera leaves it too small for detailed limb/step judgment. It is numerical motion evidence only; close framing remains required for visual acceptance.

### Live flock dive and visual failure

Added `flamingo-flock-contact`, a close night scene with four living birds, a synchronized production dive, recovery and resumed chase. The WebGL2 low row passes its body-proxy overlap assertion and requires an actual dive activation. All birds remain alive and drawn for 300 frames, travel 3.65–4.13 m, and the saved trace's closest pair is 0.7505 m in X/Z. Receipts are in `flock-contact.json`. This is not the L8 reinforcement arena and cannot close that requirement.

Opened and committed `flock-flight-review.jpg` (f0…300 every 15 frames). **Visual acceptance fails:** f60–90 show very large stretched wing triangles across the frame; f105–120 show the birds returning into the close frame; f135 onward crowds the courier with visually overlapping bird silhouettes. The passing torso proxies and centre distances do not prove clean flight or absence of drawn-mesh overlap. The new scene preserves this reproducer; flight skin/pose layering and mesh-aware separation still need investigation. No model files were changed.

### Correction: screen triangles are the feather veil

The previous paragraph's **wing-stretch diagnosis is retracted**. `Vfx.ts` intentionally creates `[data-testid="flamingo-feathers"]` with a repeating conic pink gradient after dive hits. `tools/qa/s57-veil.ts` now reproduces frame 60 and captures the exact same paused frame before/after hiding only this DOM element. Both images were opened: all pink triangles disappear in `without-feather-veil.png`, while the courier and rendered scene stay fixed. The veil's recorded opacity is 0.35, and console errors are empty (`veil-isolation.json`). No wing/model fix is justified by those triangles. The isolation tool passes ESLint.

The original close camera crops the airborne birds in this interval, so this evidence does not prove flight quality. A wider raised camera framing is still required for clean takeoff/dive/landing review. Recovery crowd silhouettes still require mesh-aware assessment rather than a centre-distance proxy.

### Flight framing and crow coverage audit

Raised the flock scene target to 2.5 m and camera radius to 14 m. The completed WebGL2 low row passes, and the opened `flock-flight-raised.jpg` retains all four birds from ground through f45–75 flight apex and f90–180 recovery. The bodies and wing silhouettes remain intact; the pink hit veil overlays f60–105 and is already isolated by the paired DOM control. The birds gather tightly around the courier after landing; this image alone does not prove mesh separation or the L8 arena requirement.

Added an explicit `foot-slide-crow` gate row. Its first run fails: leader travel 0.1 m and no contact samples. Source inspection shows the production crow is a twenty-bird flock rendered directly from `birdPositions` (`CrowdView.ts`), while current Scene Lab metrics follow the leader entity. The next QA implementation must probe rendered flock members and distinguish confirmed airborne intervals from grounded contacts. The red row has no known-failure exemption; crow coverage is not claimed complete.

### Rendered crow flock probes

CrowdView now submits a probe for every rendered living crow with its actual submitted instance matrix and sampled atlas pose. Each member has a stable instance key. Scene Lab combines the flock's sole/foot points instead of discarding all but the stationary leader. The 180-frame crow run records **40 feet every frame**, lowest point **0.307 m above the floor**, and 213.16 m summed horizontal foot travel (5.329 m per foot on average). The numeric gate still fails on its inappropriate leader-travel/required-ground-contact criteria. Those failures are preserved until a validated airborne rule checks complete probe coverage, above-floor clearance and actual flock travel. Missing probes must continue to fail. `crow-probe-receipt.json` records the current evidence; this is not yet a green crow gate.

Typecheck, lint and the 14 render-contract tests pass with flock-member probe collection. The crow measurement run is terminal and remains red as documented.

### Verified airborne crow gate

Added an explicit `airborneFootActors` expectation and a reusable contact-track proof. A no-contact actor can pass only with the exact declared foot count on every expected consecutive frame, finite sampled points and floor heights, every sole above the unchanged 1.2 cm contact band, and minimum horizontal travel for **each** foot. Crow requires 40 feet across 180 frames and at least 2 m per foot. The stationary leader's travel assertion is replaced by that rendered-flock proof. Grounded p95 values still fail above 3 cm; absent/incomplete probes never qualify as airborne.

The stable-source crow row now passes. `crow-airborne-gate.json` records the checks. Assertions folded into the existing render-contract case prove rejection of missing frames, missing feet, and grounded points; test count remains unchanged. Typecheck, lint and 14/14 render-contract tests pass. One earlier capture was invalidated by a Vite navigation during a type-only edit and was rerun after source stabilization; it is not acceptance evidence.

### Full validation and native L8 reinforcement spacing

On committed source `86118716`, the complete required Scene Lab command ran all **87 rows**: **86 pass, one fail, no missing rows** (`full-gate-first.md`). The failure was the high-quality WebGPU flamingo night fixture's canvas-content guard (seven varied tiles, minimum eight), while its motion assertions passed. The required remote unit command collected within the 150-case budget but timed out again at **245.2 s** (overall exit 1); it is not green.

The existing native L8 skilled-fight driver was observed read-only on low and high quality. Both traversed **four reinforcement flights**, up to eight living birds, over **1,255 measured ticks**. Minimum living centre separation was **0.77616 m** in horizontal and 3D space, with zero pairs within 0.5 m. The fights completed with no deaths; their existing duration acceptance bar returned nonzero because completion was 20.93 s rather than ≥45 s. No duration/stat changes were made. `native-arena-spacing.json` records these results and source hashes. `tools/qa/s57-live-spacing.mjs` preserves the observer; it wraps the production tick without changing its arguments/result or world state. Its ESLint check passes.

To make the single-bird locomotion fixture readable and satisfy the unchanged canvas-content guard, changed its own camera to a 5.5 m close tracking shot; gate rows now respect that camera rather than overriding it with wide zoom. The corrected close matrix passes **8/8** backends × tiers × day/night with **p95 0 cm** and **16 contacts** per row (`close-flamingo-matrix.json`). Opened `flamingo-close-review.jpg`: long legs remain attached and grounded, with different planted/lifted foot positions between stride phases. The coarse sheet spacing can alias individual steps and does not establish body-bob amplitude. A denser stride strip and matched baseline remain needed. The entire 87-row gate still requires a final pass on this updated fixture source; the isolated matrix is not substituted for that pass.
