# Horde budget lane: visual review

Reviewed at gameplay size with the image tool: the north-star combat mockup; before/after L1 high V1/V3; E07 horde-readability and telegraphs; high/phone-low horde captures. Also opened final high V2/V4/V5/V6 and low V3; screenshots are retained for central review. Final Pixel7 landscape, iPhone14 portrait and restored-context captures were also opened. No goldens were updated.

**Relative quality result:** no new loss of visible L1 prop/building silhouette, trim, window glow, foreground fence posts or player detail was apparent in V1/V3. The hero and gameplay-sized crowd retain their close tiers. Far-tier simplification locks eye vertices and limits absolute part-space error to 0.01, tested without triangles crossing animated parts. This is bounded static evidence, not a claim that all crowd motion is visually correct.

**Overall full-game checklist: FAIL.** Infected surfaces already look shredded in the baseline; the same defect remains after optimization and was surfaced to crowd-feel. Phone benchmark framing crops the player and many figures, which is legitimate culling for counters but unsuitable as a gameplay camera. L1 HUD remains incomplete relative to the mockup. V4 places the player inside a sedan with the existing occlusion dither; that photo framing is not a clean character-quality view. These failures were not masked by the passing budget tests.

## Checklist A: diorama

- [must] **PASS** Warm palette: L1 roofs, green gardens and purple house shading preserve a saturated warm scene.
- [must] **PASS** Tinted shadows: foreground player and lamp shadows remain visibly purple with soft edges.
- [must] **PASS** Bloom: house windows, hanging lights and street lamps still visibly glow.
- [must] **PASS** Camera: V1/V3 retain the same high three-quarter angle and narrow perspective.
- [should] **PASS** Proportions: the unchanged hero, houses and foreground fences retain chunky toy proportions and readable trim.
- [should] **FAIL** Foliage: flowers and rounded bushes are present, but the bushes visibly have noisy needle-like edges.
- [should] **FAIL** Composition: the large L1 mission panel covers lower scenery and the phone benchmark crops the player.
- [should] **PASS** Clutter: porch plants, flowers, string lights, signs and cars provide comparable inhabited density in the inspected L1 views.

## Checklist D: combat readability

- [must] **FAIL** Player: E07 identifies the red/teal hero immediately, but the portrait benchmark cuts the hero off at the left edge.
- [must] **FAIL** Infected: red eyes and individual outlines survive, but malformed surfaces prevent an honest complete readability pass.
- [must] **FAIL** Telegraphs: yellow shapes are visible in E07, but complete animated enemy-shape distinction is not established by these stills.
- [should] **PASS** Pickups: the bat and grenade in the E07 capture are distinguishable from street clutter.
- [should] **PASS** Coverage: shown glow and yellow sectors do not conceal the gameplay-camera hero.

## Checklist F: HUD

- [must] **FAIL** Layout: L1 has its minimap, objective and mission panel but lacks the mockup's portrait/health and slot cards.
- [must] **FAIL** Selection: no clear selected-side state is demonstrated in the phone capture.
- [must] **FAIL** Text: labels are individually legible, but the final phone mission/toast panels overlap each other and action controls, obscuring text and scenery.
- [should] **FAIL** Style: rounded panels are present, but the mockup's complete portrait/bar/key-badge treatment is absent.

Checklist B four-view character conformance, C authored turntables, E decay progression and H new effects are outside this render-budget change; no new art was authored. G is limited to the observed preserved sun/contact shading and glow; light-pool occlusion and night hero-light conformance require the existing lighting gate. No complete G pass is claimed.

LOD correctness is also checked in units: repeated boundary crossings keep exactly one visible civilian instance; low-tier switching retains an instance; conservative bounds keep intersecting screen-edge figures; missing desired crowd tiers use loaded alternatives. Central crowd-feel still owns temporal animation/flicker verification.
