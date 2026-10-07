# E05 arena presentation review

Reviewed 2026-10-05 at 1600×900, DPR 1, paused tick 0, seed 1, Chromium/SwiftShader WebGL2, gameplay camera. Opened `combat-arena.png` and `compare/combat-arena.png` with the image viewer. Reference: the read-only main checkout's `initial-drafts/sunset-grove-combat-gameplay-mockup.png`.

E05's acceptance table has no visual/vision criterion. This is a supplemental review of the combat scenario, not an approval of the complete game's art, infected AI, weapon views, HUD, or VFX. The arena deliberately uses stationary code dummies while assets await the integrated registry. Full weapon presentation/indicators belong to E06; infected characters and attack telegraphs to E07; VFX to E15.

| Applicable item | Result | Evidence |
| --- | --- | --- |
| D1 [must] Player identifiable quickly | PASS | The detailed survivor, teal bag and red footwear distinguish her from all blue block dummies on the clear ground. |
| D2 [must] Targets separate from background; red eyes visible | PASS | Saturated blue dummy bodies contrast with the warm ground; the forward red eye dots are visible at this camera, including the shield dummy. These are combat-test placeholders, not approved infected art. |
| A2 [must] Shadows tinted, not black | PASS | Long purple-blue shadows remain colored and softly edged. |
| A4 [must] High three-quarter camera | PASS | The overhead diagonal camera and low perspective distortion match the reference's camera relationship. |
| D5 [should] Effects do not obscure player/targets | PASS | The scenario has no occluding VFX; all nine entities are visible. |
| D3 Attack telegraphs | N/A | Stationary E05 dummies do not schedule AI attacks; E07 owns telegraphs. |
| D4 Pickups/interactables | N/A | The E05 arena contains no pickups or interaction targets. |
| Full A/B/C/F look, proportions, asset/HUD review | N/A | Placeholder infected and a plain arena cannot establish the district, catalog, crowd or HUD art criteria. |

Scoped result: all four applicable must items pass, 1/1 applicable should item passes. The comparison visibly shows the absence of district props, weapon models, attack FX and full HUD; no claim is made that this empty mechanics arena matches the mockup's content density.


## Combat-feel review — 2026-10-07

Opened the refreshed `combat-arena.png`, `ground-hit-fists.png`, and `ground-hit-bat.png` at 1600×900, DPR 1, headless Chromium/Metal WebGL2. The current arena uses the integrated character registry rather than the original blue placeholders. The player, bat, targets and purple shadows remain distinct against the simple ground.

Both ground-hit captures show a clear white hit flash and blood beside the target, with the player close enough to continue striking. The fists capture is during the special kick's fall and the first ordinary punch; the bat capture shows the killed target in its settled ground death pose with a larger blood pool. White flash temporarily obscures body detail, as existing impact feedback intends. A still image cannot certify hit-stop timing; the sim tests assert one 40–70 ms hit-stop event per landed hit, and the real-click browser tests verify damage and death during the active knockdown window.

This review covers the melee feedback change and preserves the original arena review's scope. No full-level art or device frame-rate claim is made. All three retained images are exactly 1600 px wide; no video was produced.
