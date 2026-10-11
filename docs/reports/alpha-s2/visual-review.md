# A-S2 visual and performance review

## Reproduction and asset limitation

HEAD baseline: `580b3d17`. Headless Chromium, ANGLE Metal, WebGL2, fixed 60 Hz Scene Lab, seed 7, game camera, desktop 1280×720; low tier phone 390×844 and landscape 844×390. Scenes live in `tests/scenes/alpha-s2/`; use `SCENE_PORT=3379 sh tools/e2e-lock.sh npx tsx tools/scenelab/cli.ts <scene> --out <directory>`.

Main contains two `inf.alpha` manifest entries; the later placeholder wins the asset registry Map. The branch manifest is untouched. For real-mesh visual proof only, one temporary QA worktree removed that duplicate placeholder and used the already shipped A-D1 mesh. Baseline captures used HEAD systems with the same asset correction and neutral, unscripted fixtures. After captures used this lane's systems. These captures prove the physical moves with the real mesh **conditional on upstream manifest deduplication**. The QA worktree is removed before delivery. No WebGPU claim is made.

## Retained before/after set

- Before, neutral game camera: [charge](before/before-alpha-charge/shot-0030.png), [slam](before/before-alpha-ground-slam/shot-0030.png).
- After charge: [windup](after/qa-alpha-charge/shot-0047.png), [impact](after/qa-alpha-charge/shot-0090.png), [sequence](after/qa-alpha-charge/sheet.jpg).
- After slam: [windup](after/qa-alpha-ground-slam/shot-0059.png), [impact](after/qa-alpha-ground-slam/shot-0090.png), [sequence](after/qa-alpha-ground-slam/sheet.jpg).
- Phone: [charge](phone/qa-alpha-charge-low/shot-0047.png), [slam](phone/qa-alpha-ground-slam-low/shot-0047.png), each with retained sequence sheet in the same directory.
- Landscape: [charge](landscape/qa-alpha-charge-low/shot-0047.png), [slam](landscape/qa-alpha-ground-slam-low/shot-0047.png), each with retained sequence sheet.
- Adult follower: [before impact](after/qa-alpha-escort/shot-0059.png), [down](after/qa-alpha-escort/shot-0090.png), [recovered](after/qa-alpha-escort/shot-0150.png); reproduced by `SCENE_PORT=3379 sh tools/e2e-lock.sh npx tsx tools/scenelab/alpha-escort-capture.ts`. This additional capture uses the unchanged main manifest: Alpha is the known placeholder, while the follower is a real civilian GLB.
- Solid-wall controls: [charge](walls/qa-alpha-charge-wall/shot-0090.png), [slam](walls/qa-alpha-ground-slam-wall/shot-0090.png), each with retained sequence sheet.

I opened and inspected the sequence sheets and game-camera images. Four broad bright yellow arrows remain fixed through the 0.8 s charge windup and active sweep; they communicate the locked 12 m corridor. Alpha faces along its velocity and stops before the jersey barrier. The ordinary E26 rail breaks on contact; the brace clears and physical debris retains its identity. The 4 m slam boundary is bright and stable throughout its 1 s windup. On portrait phone the outer circle extends beyond the screen sides, but its boundary around the player remains obvious; landscape shows the full circle. The privacy fence shields the human on its far side while the open-side human falls. Existing player fall/get-up clips recover within the 72-tick hurt interval. The shared Alpha bar is visible.

No measured bone/static/held-prop clipping (all counters 0), no sink (0 cm), no missed in-frustum Alpha frames, and no visible sustained jitter. Charge foot slide max/p95 0.2/0.1 cm, yaw drift 0.1°, sole jitter run 3 frames; slam slide 0.5/0.3 cm, jitter run 2 frames. The charge eventually exits the fixed camera lower-right after its full 12 m path; this is ordinary camera culling, not an invisible active actor. Grounded foot animation has normal lift; no whole-body floating was observed. Metrics and gate values are retained in [visual-proof.json](visual-proof.json); per-scene metrics omit only bulky per-frame tracks.

The additional adult follower capture shows the existing `death-side` pose at frame 90, HP 75, unchanged position [0, 2], and expiry tick 132; at frame 150 it is upright in `npc-walk`, HP still 75, and moving again. I inspected the impact and recovery images: no visible clipping or whole-body floating; the follower remains visible and its recovery fade is smooth. The follower resumes with the existing gradual turn toward its escape direction. The shared NPC checkpoint restoration shifts its knockdown timer with the other NPC timers. [Follower state/clip proof](after/qa-alpha-escort/proof.json).

## E18 numbers

Actual physical sim effects over 720 ticks, retaining 200/100 infected including 40/20 Alphas: Mac sim p95 **0.767/0.280 ms**, budgets **4/6 ms**, 120/60 activations. [200 proof](perf-200.json), [100 proof](perf-100.json).

Real-mesh mixed render fixture: all **200/100 figures drawn**, six Alphas, three slam rings plus twelve charge arrows, shared bars; desktop high **41 draws / 378,722 triangles**, low **33 draws / 222,518 triangles**, budgets **600/300 draws** and **1,500,000/500,000 triangles**. Physical marker/Alpha crowd batches use **4 draws** (≤30), no non-instanced meshes in CrowdView. Ordinary runners retain the existing civilian crowd renderer. These are isolated actor budgets, not whole-campaign frame-time measurements. [High proof](render-high.json), [low proof](render-low.json).

Desktop capture p95/max: charge 95/95 draws, 81,642/81,642 triangles; slam 23/23 draws, 98,252/98,252 triangles. All scene console, visibility and geometry gates pass without changed tolerances.
