# L7-D1 closure capture review

Headless Chrome, native Metal WebGL2, seed 29. The unchanged Scene Lab fixtures use the authored plaza pair camera and W6 district, rather than a free inspection camera. White rig outlines are Scene Lab probe overlays. All images below were opened and inspected.

## Plaza horde and rocket

| Capture | Before changes | After changes |
| --- | --- | --- |
| Low, tick 0 | [Before](captures/horde-low-before-shot-0000.png) | [After](captures/horde-low-after-shot-0000.png) |
| Low, tick 66, rocket blast | [Before](captures/horde-low-before-shot-0066.png) | [After](captures/horde-low-after-shot-0066.png) |
| Low, ticks 0/22/44/66 | [Before sheet](captures/horde-low-before-sheet.jpg) | [After sheet](captures/horde-low-after-sheet.jpg) |
| High, ticks 0/66 | — | [Before blast](captures/horde-high-after-shot-0000.png), [After blast](captures/horde-high-after-shot-0066.png) |

The peripheral infected now keep their mapped civilian appearance from initialization. Low previously missed up to 22 of 66 in-view frames; both tiers now miss zero, with the original zero-frame gate unchanged. This was a real startup visibility problem: dressing on the first simulation tick requested additional model batches after the view had declared readiness.

The courier remains identifiable against the dark pavement. Wrecks, crater rims and the existing large gray frontage retain their silhouettes. Fires remain warm and visible, including beside the truck and in the foreground. The rocket flash and outward debris are readable; the frame-66 capture shows the blast during expansion, rather than proving the subsequent full clearance. No Alpha special-move telegraph is exercised by these district fixtures.

Clipping is not zero in the inherited plaza: 63 static pairs before and after; low actor intersections decrease from 12 to 9 (piercing 9 to 6), while the denser high fixture reports 32/28. The existing frontage occludes some actors normally; there are no invisible-but-active probe misses. Crowd foot sink stays below 0.6 cm, and the low fixture's maximum consecutive jitter stays at three frames before and after. Facing-versus-velocity drift reaches 56.7° before and 57.8° after during turning/contact pushes; these horde fixtures are not straight-line locomotion proofs. No new sustained floating, sinking or frame-to-frame visibility flicker was observed in the sheets.

## Northgate route and companion

| Fixture | Start | End / sequence |
| --- | --- | --- |
| Northgate, low, 240 ticks | [Start](captures/northgate-shot-0000.png) | [End](captures/northgate-shot-0240.png), [sheet](captures/northgate-sheet.jpg) |
| Corgi, low, 240 ticks | [Start](captures/corgi-shot-0000.png) | [End](captures/corgi-shot-0240.png), [sheet](captures/corgi-sheet.jpg) |

The courier walks west along the apron with facing matching velocity: 0° yaw drift, zero sink, 0.2 cm foot-slide p95 and no sustained jitter (maximum one frame). The corgi follows without intersecting the courier or wreck; both remain grounded and drawn. Both fixtures report zero static/actor clipping and zero missed in-view frames. The rocket pickup and wreck remain visible; the growing smoke column stays readable against the night ground.

All four final isolation fixtures pass their existing gates. Compact measurements are retained in [scene-evidence.json](scene-evidence.json). Scene Lab submission timings are diagnostic; the campaign CPU-throttled timing gates provide the performance acceptance evidence.
