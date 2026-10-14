# Q3 game-camera review

The eight atlases in `captures/` are assembled from real Scene Lab game-camera sheets, with first/middle/last frames for each driving composition. All four backend/tier atlases were opened, plus the original narrow HUD sheets and real keyboard L10 captures. High uses zoom 1; low uses zoom .5. The catalog also ran every scene at both zooms on each tier/backend (and unchanged extra zoom 1.5). Final streaming/buffer-fix validation is pending; this review does not erase the recorded WebGPU errors.

| Pair / composition | Observation | Scoped visual score |
| --- | --- | --- |
| Zoo departure / crossing start | Same olive, unarmed six-wheel APC and white emblem; headlights light the road. Different district dressing reads as a departure. | 8/10 |
| Fork healthy / floor | Same camera/pose; floor shows cracked glass, dents, dead lamps and rear smoke while retaining its complete vehicle silhouette. | 8/10 |
| Outskirts healthy / floor | Common approach arrows remain visible; healthy lights illuminate the road and floor lamps are dark. Close zoom crops part of the roof, an existing framing limitation. | 7/10 |
| Crash pre-impact / wreck | Healthy and floor arrivals follow the same bridge collapse. Fire/debris begin at impact; the crawler moves onto clear, dark ground beyond the plume. | 8/10 |
| Crawl / axe opening | Bright cap/clothing/feet remain identifiable; real L10 captures show the red axe and protected corgi, full health and the next weapon checkpoint objective. | 8/10 |
| Roads / countryside / dry / seam | Vehicle heading follows the branch; road markings/dirt differ; wheels stay attached and no gap is visible in the sampled seam frames. | 8/10 |
| HUD at 390 px | Home is beside the companion row, clear of the minimap. Health, axe and corgi are readable on both renderers. Live touch/stream revisit captures remain pending. | 8/10 |

A: PASS for the scoped diorama composition: chunky vehicle/figures, tinted road shadows, amber practical pools and cool night ground. D: PASS for driver/vehicle and crawl visibility, separate hull attackers and cyan hull telegraphs; rear smoke does not obscure the cab in these samples. F: PASS for text/selected axe and Home placement using the existing compact HUD. G: PASS for live headlight pools, colored shadows and readable crawl/axe figures. Existing roof cropping at closest zoom is P2; no new visual P0/P1 is inferred from these sheets. The WebGPU lifecycle error remains a functional blocker until its strict rerun passes.

Final retirement sheets (WebGPU high zoom 1 and low zoom .5) were opened and retained in `captures/retire-webgpu-*.jpg`: nearby infected render before the APC passes, road markings continue through the sampled seam, and headlight pools remain attached as the APC reaches grass. No missing vehicle parts or ground gaps are visible. Low close zoom again crops the roof at early frames (existing P2); scoped score 7/10. All six WebGPU retirement matrix cases pass with the unchanged strict console guard. Native E18 also passes all six cases. The live input rerun remains pending.

Live Pixel 7 WebGPU floor/zoom .5 route and L10 screenshots were opened (`touch-webgpu-floor-{route,axe}.png`): the floor label remains legible above the damaged APC, Home is below the weather indicator and clear of the minimap, and L10 shows a red axe, full health and the corgi. Close phone framing fills the viewport with the APC; the live crawl/audio/axe assertions pass. Final Chromium 10/10 and three Pixel 7 matrix cases also pass; remaining phone cases and streaming are incomplete at the three-hour ceiling.
