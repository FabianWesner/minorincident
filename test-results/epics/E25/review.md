# E25 lighting review — checklist G

Inspected headless Chrome / Metal WebGL2 on 2026-10-10. Numeric detectors accompany the images; scene sheets establish appearance rather than backend parity. Reference comparison is deferred because `assets/_keyframes/lighting/` is absent in both this worktree and main (see `closure/keyframe-availability.txt`). The L6 mission spot belongs to E24. The isolated L6 lighting preset was still captured and inspected.

| G item | Result | Evidence / observation |
| --- | --- | --- |
| Sources glow and cast visible light | PASS | `closure/light-lab.png/json`: trailer pool exceeds adjacent ambient by 31×. Trailer heads, street lamps, windows and neon have distinct warm/white/colored emission. `mall-floor.png` shows warm pizza counter spill and cool unlit tiles. |
| Light respects geometry; hero shadows | PASS | Trailer pool stops at the fence; measured behind-fence/ambient <1.3. `hero-shadow.png/json` shows the dummy's colored shadow; powered pools use the static 64-ray visibility fan. |
| Colored shadows, appropriate softness | PASS | Daytime production spots and nine preset sheets show soft violet sun shadows. Trailer spot shadows have a tighter silhouette. Numeric hero shadow hue/darkening tests pass; shadows retain bounce instead of becoming black. |
| Readable player and threats at night | PASS | `night-readability.json` and masks measure ≥3:1 player contrast; infected eyes are brightest. Night/L6 fixture sheets keep the courier and approaching infected distinct against blue ground. |
| Beams, lit haze and glints | PASS | `closure/beam-intersection.png/json`: four subtle trailer cones, smooth ground fade ≤25% per pixel. L3's warm haze and small neon spill remain atmospheric. The first washed-out cone draft was reduced to the inspected subtle opacity. |
| Reflections suit surface | PASS / SSR deferred | Wet lamp/neon streaks exceed dry ground by >2× on both tiers. Car roof/glass highlights move between 45°/60° captures; cream chrome trim/rims are environment-dominant while rubber and the wooden bench stay matte. Polished mall tiles receive environment highlights and warm light. High-tier SSR silhouette work is release extras under specs/04 §6. |
| Mood follows the level script | PASS | L2 neutral midday and short shadows; L3 warm hazy afternoon with lit vehicle heads/neon; L4 clean warm plaza with long violet shadows; L5 red/violet ruined plaza. Nine identical preset fixtures make time-of-day differences directly visible. |

## Production scenarios

`closure/l2-streets-w1.png`, `l3-grove-boulevard.png`, `l4-plaza-safe.png`, `pair-plaza.png`, `mall-floor.png` and the isolated trailer/reflection scenes were inspected. Mission briefing panels were closed before production captures. The L5 fixture reaches the plaza before warming the persistent render emitters; it uses the actual mission rather than replacing the plaza with an isolated scene. The reference-image comparison remains explicitly deferred, not inferred from these captures.

## Windows

Actual shipped GLBs store semantic names on parents of unnamed material primitives. Matching those parents restores `_window` / `_light` indices in all three LODs. `closure/interior-window-45.png`, `interior-window-60.png` and `interior-window-off.png` show a darker back wall shifting within the fixed mullioned frame. The detector follows the bright-to-dark interior boundary (excluding physical perimeter/mullion), removes camera movement in world-space window coordinates, and measures 69.60 px of shift, against the unchanged ≥4 px requirement. Powered/unpowered maximum window luminance is 9.75×. Unpowered window emissions are all zero.

## Fresh gate review (2026-10-11, source 7510e7b2)

All eleven E25 Scene Lab sheets were opened and inspected again after merging `lane/e25-e27-close`. Presets L1/L2 keep neutral warm surfaces and short tinted shadows; L3/L4/golden lengthen the violet shadows; L5 gives red dusk with a warm lamp pool; L6-subway/L6/night retain distinct courier and infected silhouettes against blue darkness. `light-lab` shows four glowing heads, faint cones, and a pool ending at the fence. `reflection-lab` shows warm streaks under the lamp/jukebox through falling rain. All scenes passed with zero console errors.

Fresh production captures were inspected for L2 streets, L3 boulevard, L4 safe plaza, L5 pair plaza, and mall floor. L2 has bright neutral sidewalks, L3 warm haze and lit headlights/neon, L4 long soft violet shadows, and L5 red-purple haze, destroyed buildings and warm burning wrecks. The mall has illuminated pizza-counter tiles against a cool unlit floor. Story subtitles remain in the production frames; they do not cover the measured lighting samples. Two material-camera captures show moving car/chrome highlights and a matte bench; unpowered windows are dark.

Checklist G's four must items and all three atmosphere/material/mood should items still pass on these captures and the fresh quantitative browser checks. Trailer pool/ambient is 31.365x; behind-fence/ambient is 0.400x; beam gradient is 6.054% (limit 25%). Wet/dry ratios are 3.538x/5.854x high and 3.553x/6.443x low. The 40-lamp walk's maximum per-frame luminance change is 1.912% (limit 15%). This is WebGL2 evidence. Manual WebGPU comparison/parity, SSR silhouette, absent lighting keyframes, and the E24-owned L6 mission spot remain open; this review does not complete those parts of E25.

## Final source refresh (`41b57aa2`, 2026-10-11)

All eleven refreshed sheets were inspected: daytime L1/L2/L3/L4 keep actors and bench readable with distinct shadow directions; golden is warm, L5 red dusk, and L6/subway/night cool blue with an amber lamp pool. The trailer projects stable tapered beams that stop at the fence. Rain/reflection-lab retains localized wet highlights and visible rain streaks. No new visual regression was observed relative to the earlier fresh review. Scene Lab checks validate this controlled scene set; they do not provide manual WebGPU parity or the missing E25 lighting reference review.

## Superseding current audit — 2026-10-22

The historical PASS tables above do not establish current acceptance. Fresh current G review is **not accepted**: final seven scores7/8/7/8/4/7/6, with L5/mall below7 and must evidence missing/failing. All28 production captures, independent references, exact prompts, per-spot observations and raw hashes are in [the current acceptance report](../../../docs/reports/ac-close-l7-l10/README.md#e25-ac16--current-checklist-g-review-not-accepted). The current full verifier ends50 browser pass/6fail/1SSRskip, exit1; later isolated quiet5/5 passes do not make it green. Fresh AC01 comparative spike, AC12 windows and AC15 previews/turntable are met. SSR/memory proposals remain unadopted. Reframed reference review is reflected in the final scores. The corrected shadow fixture passes85.884% against the unchanged35% gate; night-readability and saturation failures remain.
