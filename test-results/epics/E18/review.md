Overall composition review: **FAIL**. E18 high/low visual parity and restored rendering pass inspection, but the inherited phone HUD and portrait fog/framing fail the full-game checklist. Passing AC07 bounds/touch checks does not conceal these findings. Below-integrated assets intentionally retain code placeholders; art detail limitations are recorded, not treated as art blockers.

Opened the north-star mockup and `compare/horde-reference.png`, `compare/l6-tiers.png`, both Pixel/iPhone orientations, `context-restored.png` and the new emulated phone recordings with the image-reading tool. The final captures contain no floating quality selector. Fixed performance overview cameras deliberately differ from gameplay framing. No visual goldens were changed.

Checklist A — north-star / diorama:

- [must] **FAIL** palette: landscape has saturated roofs/grass and warm lamps, but portrait L1 is heavily washed out by camera-distance fog.
- [must] **PASS** shadows: horde/player shadows are soft purple and L6 shadows retain blue tint at both resolutions.
- [must] **PASS** emissives: windows, lamps and L6 fires visibly glow on high and low.
- [must] **PASS** camera: both tiers retain a narrow-FOV high three-quarter view without strong perspective distortion.
- [should] **FAIL** proportions/bevels: placeholder props are chunky, but sharp box edges lack the reference's bevel detail.
- [should] **FAIL** foliage: rounded canopies are present, but dense foliage/flower accents are not demonstrated; low intentionally removes grass.
- [should] **FAIL** composition: the horde's red/teal hero is clear, but the portrait hero is tiny and landscape mission panels cover the central action.
- [should] **FAIL** clutter density: L6 landmarks/clutter survive the tier change, but these placeholder/benchmark views do not reach the reference's detail density.

Checklist D — combat readability in the captured scenes:

- [must] **FAIL** player identification: the arena hero is immediately recognizable; the washed-out portrait player is not reliably identifiable within one second.
- [must] **PASS** infected separation: red eyes and distinct silhouettes read against the arena background and L6's night geometry on both tiers.
- [must] **FAIL** attack shapes: the yellow player sector reads, but no active enemy-telegraph sequence is captured, so complete shape distinction is unverified.
- [should] **FAIL** pickups/interactables: cones/cars are recognizable, but pickup-specific readability is not established by these frozen captures.
- [should] **PASS** VFX coverage: the shown bloom/fire/sector effects do not hide the arena player or its sector.

Checklist F — inherited HUD:

- [must] **FAIL** layout: a minimap is present, but the required portrait/health and bottom-center slot-card composition is absent in this branch.
- [must] **FAIL** selected side: the touch buttons provide no clear selected-side state in the captures.
- [must] **FAIL** text: individual text is readable at both sizes, but overlapping toasts/mission panels obscure touch labels and action.
- [should] **FAIL** style: rounded dark panels partly match, but bars, portraits and key-badged slot cards are incomplete.

The inspected A/D/F set has 4/10 must items and 1/7 should items passing, below §7.1's all-must/70%-should threshold. B/C (new asset authoring), E (decay changes) and H (explosion authoring) were not changed by E18. Full G light-pool/hero-light verification belongs to E25; this review only confirms existing glow/shadow parity and does not claim a full lighting pass.

Follow-up tasks: integrate the assigned mobile-hud lane and recapture both orientations; resolve the portrait camera/fog distance coupling with the camera/lighting owners; retain the normal combat/pickup/lighting vision gates during central regression. E18 leaves touch HUD layout/CSS unchanged as requested. Placeholder bevel/foliage/clutter detail follows asset integration and does not block this performance implementation.

Finish verification uses headless native Metal WebGL2 only. The Android 4× CPU and iPhone-class 2× CPU L6 captures (`emulated-android-webgl.png`, `emulated-ios-webgl.png`) show the real crowd shader rendering red eyes and silhouettes against blue night geometry and orange fire glow. Packed instance attributes preserve limb/gore/flash inputs while fitting Metal’s 16-location vertex limit. Recorder controls occupy the top of these dedicated benchmark pages; their captures do not establish a usable gameplay HUD. The inherited “Game paused” UI overlay remains visible after API resume; it is separate from the benchmark clock, which is active, unpaused, and advances throughout the raw frame recording. This UI mismatch remains an owning-HUD-lane follow-up. Current WebGPU parity requires manual verification under the user’s headless-only rule; `webgpu-low.png` is historical evidence from the earlier implementation, not a verification of the final packing change. The existing full-game composition FAIL and owning-lane follow-ups remain unchanged.


## perf-horde follow-up review (2026-10-07)

[Item-level review](horde/review.md) records preserved visible L1 prop/building/player detail in the inspected before/after gameplay-camera views, protected eyes and bounded far-part simplification. Full-game composition/readability remains **FAIL**: the baseline's malformed infected surfaces persist (crowd-feel owner), and the HUD/portrait benchmark framing remain incomplete. Budget passes do not establish temporal animation correctness. Final mobile evidence uses CSS pixel size (≤1600px wide); no goldens were changed.
