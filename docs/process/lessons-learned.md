# Lessons learned (what worked, what didn't)

A living record, updated after every lane or experiment. Short entries with evidence. Per-lane detail lives in epics-pipeline/agent-scorecard.md (git-ignored); this file holds the durable conclusions.

## QA and regressions
- **Didn't work:** handling only `webglcontextlost`. A lost WebGPU device (GPU process reset) froze the view for the rest of the session while sim, HUD and radar ran on (Q-197, L4 PROD 10-26); content soaks to 815 corpses never reproduced it. A frozen-view report with a live HUD means device loss or per-frame GPU errors: check the recovery path (`Browser.crashGpuProcess` over CDP reproduces it, tests/e2e/l4-corpse-stall.spec.ts), and compare canvas-only screenshots, since the DOM HUD changes every frame.
- **Didn't work:** QA that only checked the batch's own changes. The PO found 14 issues in L1–L4 on PROD 13h that bots and Opus QA had passed (10-22). Most were older than 13g. No one had ever compared against PROD.
- **Worked:** the three-layer regression gate (docs/qa/regression-gate.md):
  - The invariant sweep (`qa:invariants`) went red on 7 real game problems on its first run and found the 24 s L8 load.
  - The PO-style QA with a side-by-side against PROD per checklist line (docs/qa/po-checklist.md) gave the first trustworthy verdict.
- **Worked:** every check has to be proven red on a known bug or a deliberately broken fixture before it is trusted. The A/B tool's 13g-vs-13h validation found "zero regressions", which was correct (the bugs predated 13g). Injected regressions were the right proof.
- **Didn't work:** narrow capture matrices. Lanes often captured only WebGPU low at zoom 1 or 1.5. Briefs must demand the full matrix, and the orchestrator opens at least one sheet per visual lane.

## Playtesting with agents
- **Worked:** scripted real-input bots (tools/playtest) for "is the level finishable". Several "stuck" moments turned out to be bot bugs (HUD clicks, held keys, stale rings), so classify bot vs game before fixing.
- **Mixed:** unscripted play by Luna 6 (low effort, fast tier, tools/playtest/live.ts):
  - Text HUD plus a suggested ground click worked for navigation and objectives.
  - It lost every fight, even in turn-based `--step` mode. The aim assist helped, and the PO's tactic ("run away when outnumbered") belongs in the prompt.
  - Turns take 5–10 s real time and 1–2 s in step mode.
  - Verdict: a cheap navigation and clarity tester, not a combat gate.
  - Round 6 (aim assist + the PO's 'run when outnumbered' tactics in the prompt + the click-settle fix, real time): its best run. It cleared 3 of L1's steps (pickup, delivery, the bat step where rounds 2–5 died 7–9 times) with 1 death in 119 actions, turns 1–4 s. It stopped on its own before the 300-action target, so for long runs wrap it in a loop that re-prompts.
- **Harness bugs looked like model failures:** a click that returned before the courier moved read as "NOT MOVING", a HUD arrow was mistaken for a marker, and a time cap counted from server start. Check the harness before blaming the model.

- **Worked (10-23):** a real-input playtest bot now plays the whole game unattended (L1 → credits in 47m30s, WebGPU low zoom 1.5, 50/50 steps, no skips; `npm run playtest -- --levels L1-L10 --no-skip`). It got there by fixing bot gaps (weapon choice, finale range, zoom drift, escort pacing, HUD-covered clicks) rather than game rules, and it surfaced a real controls bug (Q-152).

## Asset creation (characters)
- **Didn't work:** voxel-union surface merging plus reduction (old Alphas); it made blobs. Corpse-only convex shells fixed the shards at low quality but looked terrible up close.
- **Worked:** imagegen concept drafts (Sol) before any Blender work. 4 Alpha and 3 Mega directions, a contact sheet against the current model, and turnarounds for the picks. The PO and orchestrator choose from images, not words.
- **Partly worked:** a Sonnet Blender rebuild from the drafts (clean faceted parts, existing rig). It was clearly better than the blobs but far from the drafts:
  - the fixed rest pose left the arms sticking out;
  - the head came out small;
  - the faceting was too hard.
- **In progress (10-23):** Sol high plus an independent critical judge (a separate codex exec, the same prompt every round, sees only draft, status quo and new renders), finishing only at ≥ 9/10 for every look. Added techniques from the PO's research: silhouette first, same-angle comparison with region-specific fixes, a reusable part library, automated geometry QA. Record the outcome here when docs/reports/alpha-polish/README.md lands.
- **To evaluate:** WAM (geometry DSL) and blender-skills. Check the licence first, then pilot one asset (roadmap).
- **Didn't work (10-24):** I read an L4 capture full of bodies as "action"; it was a corpse carpet (243 corpses within 14 m vs 55 on PROD). When judging a crowd capture, count living vs dead and compare with PROD at the same moment, don't eyeball density.
- **Worked (10-24, heroine rebind):** keep the game skeleton's names, hierarchy, helpers and bind convention, but move its joints onto the new body (as the male courier already has its own joints under the same clips). Squeezing the TRELLIS heroine onto the chibi courier's joints would have shortened her arms by ~25 % and broken the approved look.
- **Worked:** ownership from a flood fill along mesh edges inside a limb capsule, computed on the position-welded surface. It keeps UV duplicates identical and cannot jump the arm–torso gap. Texture hue (denim, teal) only refines a region; it never decides one alone.
- **Didn't work:** treating the backpack as a rigid pendulum when it is fused to the back. Every swing tore the seam (8× stretch in the walk). It now bends with the back and only its outer body sways.
- **Watch:** the pipeline's stretch audit plays raw clips without alignSkeleton or the helper drive. Use tools/assets/courier-stretch-audit.ts, which runs the production evaluation. The current courier itself scores 32× (bat shoulder) there, so compare against the current asset; don't apply the 4× bar to one asset alone.
- **Worked:** the orchestrator looks at the sheets itself. Lanes' own visual verdicts are often too kind ("reads clearly" while hats were 2.5× head width).

## Performance
- **Worked:** metric-driven Sol lanes with a strict before/after, the same budget throughout, and "forbidden shortcuts" spelled out. Examples:
  - L8 load 24 s → 4 s: the cold menu entry used the handover pacing, and the crowd prep did excess work;
  - L6 reload memory 10.6–12 % → 4–6 %: two leaked references;
  - L10 cold-shader freezes 3.7–4.5 s → < 45 ms: light-variant prewarm.
- **Didn't work without a time box:** sub-millisecond p95 chasing. One lane spent hours on 0.2–0.4 ms. Set an acceptance margin up front.

## Orchestration
- **Worked:**
  - `--goal` mode for Sol jobs; they otherwise stop early with uncommitted work;
  - explicit permission boundaries ("driver work 60 min, game changes forbidden");
  - steering messages to order browser/quiet windows between lanes.
- **Didn't work:**
  - more than about 4 browser-heavy lanes at once: the shared quiet slots starve everyone;
  - lanes based on an older batch: the 13g base produced 9 merge conflicts;
  - merging many lanes before running the suite: a merge silently reverted a test list.
- **Watch:**
  - disk: 6+ worktrees plus captures fill 200 GB quickly. Remove each worktree right after merging, check `git status` first, and stop on any uncommitted tracked file (10-22: two changes were lost that way);
  - lanes leave captures in the shared scratchpad and can delete files there;
  - never `git worktree remove --force` directly: untracked evidence (bot logs, captures) lives in the worktree and gets lost (10-23: the L5 gate logs were lost that way). Use the guard script, and copy test-results/playtest/<run>/ first;
  - never delete anything under /tmp or /private/tmp without first checking which running lane owns it (10-23: the orchestrator deleted the WAM pilot's clone .git during cleanup). Only delete paths a finished lane created, or paths named in a lane's report.

## 2026-10-24: TRELLIS.2 character pipeline (orchestrator experiments)
- **Worked:** Codex imagegen redraw of the game concept in an A-pose, then hosted TRELLIS.2 (≈ 90 s for inference plus a 300k export), then quadric LODs (fast-simplification), then a Blender emission bake. On the Alpha "overgrown worker" this kept rocks, rebar, hard hat and torn jacket at 7.6k triangles / 640 KB.
- **Didn't work:**
  - TRELLIS.2's own export below 100k triangles is rejected by the Space;
  - Blender Decimate stalls at ≈ 20k on TRELLIS meshes (≈ 1,000 floater components);
  - a DIFFUSE colour bake turns metallic-marked parts black.
- **Rule:** LODs are made locally from the 300k export; bake emission of the base colour. Scripts: minorincident_3dpipeline/v2/.
- **Didn't work (10-24, orchestrator):** I removed the cast-sources pipeline worktree after merging. Its git-ignored cache/ held the 300k TRELLIS highs, so they were lost and 10 inferences had to be repeated. **Rule:** large generated sources go to a permanent folder outside every worktree (/Users/wesner/Workspace/trellis-highs/<id>/), and before removing a pipeline worktree, check its cache/.
- **Worked (10-24):** a "solidify" stage (watertight, then isosurface, then planar-weighted reduction) makes TRELLIS figures read as clean masses from the game camera; quadric reduction alone leaves shards. Texture work alone (colour match, region flattening) could not fix that.
### 2026-10-24 — Zebra source, rigid atlas and delivery checks

- Rename an authored GLB node called `world` before flattening with trimesh: it collides with trimesh's implicit graph root and can silently discard the game-space wrapper transform. Check source bounds before reduction.
- Remove reconstruction floaters with semantic exceptions for mane/tail details. Dense coplanar sole patches can consume a quadric reducer's entire budget; replace them with simple closed soles and reserve triangles for joint closure.
- Preserve UVs, opaque-part masks and the registry-owned map through both live crowd bakes and frozen corpse pages. Interleave static attributes to keep the additional UV within backend buffer limits. Budget decoded atlas uploads and mip allocations, rather than WebP file size.
- Geometry-only Node probes should reuse `stripGlbTextures`; verify actual image decoding, texture sampling and corpse retention in the browser separately.
- A melee downing can recover. For permanent-corpse acceptance, deliver a permanent damage event and inspect the frozen body after retirement and again after 30 seconds.
- Large terrain horizons need float positions to preserve their streamed support edges. Normal-only quantization in the current glTF Transform release needs an explicit `KHR_mesh_quantization` flag; test seams as well as delivery metadata.
- A shared material cache must evict atlas materials on the registry-owned texture’s disposal event, even when the global material system outlives a level. Test injected shared ownership as well as standalone registry disposal.
- Inspection ghost removes the courier from AI human-target queries. Keep the courier present for real projectile-impact acceptance, assert actual health loss, and enable ghost only for the later cooldown observation.
- Before repairing a browser assertion, compare it with the current runtime and unit contract: the health-bar fixture still expected an empty bar on a downed body after main had changed eligibility to living actors only. Keep the recovery and permanent-death checks.
- **Worked (10-25, male courier rebind):** the heroine route carried over in one TRELLIS inference (imagegen A-pose → 300k → solidify 6k → bake → Lab match → skin on his own joints). Joints were read off horizontal cross-sections of the 6k source; shoulders must sit in line with the spine (the animator's `keepTorsoForward` reads the shoulder line; 2 cm behind it tipped the run lean to 15°).
- **Didn't work:** the global Lab colour match on a teal-green bag turned it blue-grey; re-tint the hue family against the reference. The heroine's night lift washed out a lighter map (L8 figure luminance 0.51 vs PROD 0.377): measure each body against PROD before sharing a shading lift.
- **Watch:** on a 6k skin, gear that copies the 3 nearest vertices and folds weights to its own limb leaves the skin in bends (3.7-7.6 cm). Barycentric weights of the nearest triangle, unfolded, kept every tier ≤ 1.6 cm. A hard arm/torso weight split to "clean" the body instead tore 16× in swings.
- **Didn't work (10-25, male courier):** `cast_surface.py` nearest-surface repair on a figure with straps standing off the chest painted the strap/bag colour onto the shirt (the solidified surface is closer to the strap than to the shirt under it). Check the plain ray bake first; use the repair only for texels the bake missed.
- **Didn't work (10-25, batch 16):** a WebGPU render-pipeline compile error (Tint "swizzle view instruction still has usages after lowering", pal_picketWhite) reached PROD. Smoke, invariants, Scene Lab 111/111 and the Opus QA all passed, because none of them fails on console pipeline-creation errors. Only the post-deploy probe caught it. **Rule:** probe the preview build BEFORE deploying, and add a gate that fails on any "render pipeline creation failed" console error (the hotfix lane adds it).
- **Didn't work (10-25, hotfix-16):** every WebGPU spec and Scene Lab run launches Chrome with `--enable-unsafe-webgpu`; with that flag Dawn/Metal compiled a shader that players' Chrome (no flag) rejects ("swizzle view instruction still has usages after lowering", from TSL `sample.rgb.r` → `v.xyz.x`). The suit-zombie crowd pipeline failed on PROD and three skipped its draws for the session. Read channels off the vec4 sample; `tests/e2e/webgpu-pipelines.spec.ts` (@smoke) runs the menu → L1 start and the textured crowd/corpse scenes without the flag.
- **Worked (10-25, courier-gear-tex, Q-183):** tier gear cut out of the body's own surface (a smooth field per piece, cut along its zero line, lifted along smoothed normals, rim walls 3 mm into the skin, weights from the skin at each anchor) gives gloves that follow the fist and fingers and a vest that sits on the shirt; attachment gap 1.5 cm max over 144 matrix rows. One painted 512² map per survivor (3D-procedural paint per texel: stitches, quilting, zip, rims) on the shared `Materials.fromTexture` route.
- **Didn't work (same lane):** (1) bone heads as piece centres: the 6k skins' knee/elbow helper joints sit in front of the surface; use the limb cross-section centroid. (2) Blender Decimate never collapses rim vertices, so a decimated patch with a diving rim was mostly rim and lay in the skin; thin the rim first and give it a separate wall. (3) Smart UV project on decimated shells gives one island per triangle (camouflage bleed); project per piece (plane/cylinder) and shelf-pack. (4) The glTF exporter silently drops duplicate/degenerate triangles, which shifts tier draw ranges: drop them in the build and recount. (5) A push-out ray that accepts any surface above the garment grabs the neighbouring arm and spikes the vest: only count hits ≤ 1.2 cm above.
- **Didn't work (10-26, orchestrator):** I started 4 lanes at once (repo cleanup, test cleanup, Astra pass 2, crowd quality) at 22 GB free. Each worktree is ~4.7 GB, and the cleanup lane made its own 4.7 GB baseline copy, so the disk hit 0 GB: two lanes died and Claude Code itself could not run commands. **Rule:** free disk ≥ (new worktrees × 5 GB) + 8 GB before submitting; at most 2 new worktree lanes at a time until the evidence cleanup shrinks the tree; a lane never creates a full repo copy for a "before" number (measure from git).
- **Git history rewrite (10-27, PO-approved):** `git filter-repo` stripped 3,683 + 2,740 old-only blobs (> 200 KB, then > 50 KB) and all of test-results/ from history; the HEAD tree hash was unchanged. `.git` went 26 GB → 3.5 GB (20 GB of it was failed tmp_pack garbage). The backup bundle is /Users/wesner/mi-backup-20261027.bundle; the commit map is in /Users/wesner/Workspace/mi-evidence-archive/git-rewrite-20261027/. GitHub rejects packs > 2 GB per push, so push in topo-order chunks (every 250 commits). **zsh pitfall:** `"$c:refs/..."` applies the `:r` modifier; write `"${c}:refs/..."`.
- **Worked (10-27, crowd-texture-quality-2):** textured crowd figures read like the old rigid crowd once the build writes texel classes into the atlas alpha (hair, skin, shirt, trousers, uniform skin, authored; tools/assets/skin-crowd-regions.ts), flattens each class and the shader tints it with the person's crowd tones by luminance ratio. Infected hair no longer turns green (the skin mask now comes from the classes, not from "warm colour on the head"), the PROD pink shirt / cream hoodie / red jacket come back for the same seed, and L1 human figure download grew only 4.8 % (classes written per 4x4 cell, gutters filled with the nearest island's class: per-texel classes cost +27 %).
- **Didn't work (same lane):** (1) CoreGraphics (sips) premultiplies alpha: class 0 (alpha 0) lost its colour and turned hair black; classed atlases are now resized in JS and class alpha is never 0. (2) A TSL `select` chain whose else-branch is the sampled `rgb` rendered black for that branch on WebGPU; write it as `mix(rgb, tinted, weight)`. (3) Eye discs sample the atlas at their disc UVs; letting their texel class count as skin made the infected eye glow 18 % too bright (hat/eye gate).
- **Worked (10-27, webgl2-attr, Q-201):** measure GPU limits on the compiled programs, not on geometry: tests/e2e/crowd-gpu-limits.spec.ts hooks WebGL2 `linkProgram` (active attributes, vertex `out`s) and WebGPU `createRenderPipeline` (buffers, attributes, VaryingsStruct @locations). The "17 attributes" was the CPU estimate adding the implicit instanceMatrix on top of the explicit `_crowd0-3` columns; no real program bound more than 13. The real at-limit cases were varyings (frozen corpse pages 16 = Chrome's WebGPU maximum) and buffers (untextured corpse pages 8). Packing a float varying into the w of a vec3 varying and interleaving the static surface fixed both pixel-identically (12/12 matched captures, 0 changed pixels).
