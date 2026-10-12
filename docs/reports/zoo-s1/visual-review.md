All retained images below form the before/after evidence set. Desktop is 1280×720; phone is 390×844, low tier, with the game camera and real WebGL2 via headless ANGLE/Metal. Source fixtures are `tests/scenes/zoo-s1/qa-zoo-*.json`. Every contact sheet was opened.

| Move | Before | After desktop | After phone |
| --- | --- | --- | --- |
| lion-pounce | [shot-0035](before/qa-zoo-lion-pounce/shot-0035.png) | [sheet](after/qa-zoo-lion-pounce/sheet.jpg), [shot-0035](after/qa-zoo-lion-pounce/shot-0035.png), [shot-0065](after/qa-zoo-lion-pounce/shot-0065.png), [shot-0140](after/qa-zoo-lion-pounce/shot-0140.png) | [sheet](phone/qa-zoo-lion-pounce-low/sheet.jpg), [shot-0035](phone/qa-zoo-lion-pounce-low/shot-0035.png) |
| lion-flank | [shot-0035](before/qa-zoo-lion-flank/shot-0035.png) | [sheet](after/qa-zoo-lion-flank/sheet.jpg), [shot-0035](after/qa-zoo-lion-flank/shot-0035.png), [shot-0090](after/qa-zoo-lion-flank/shot-0090.png) | [sheet](phone/qa-zoo-lion-flank-low/sheet.jpg), [shot-0035](phone/qa-zoo-lion-flank-low/shot-0035.png) |
| gorilla-roar | [shot-0035](before/qa-zoo-gorilla-roar/shot-0035.png) | [sheet](after/qa-zoo-gorilla-roar/sheet.jpg), [shot-0059](after/qa-zoo-gorilla-roar/shot-0059.png), [shot-0120](after/qa-zoo-gorilla-roar/shot-0120.png) | [sheet](phone/qa-zoo-gorilla-roar-low/sheet.jpg), [shot-0059](phone/qa-zoo-gorilla-roar-low/shot-0059.png) |
| gorilla-pound | [shot-0035](before/qa-zoo-gorilla-pound/shot-0035.png) | [sheet](after/qa-zoo-gorilla-pound/sheet.jpg), [shot-0059](after/qa-zoo-gorilla-pound/shot-0059.png), [shot-0096](after/qa-zoo-gorilla-pound/shot-0096.png) | [sheet](phone/qa-zoo-gorilla-pound-low/sheet.jpg), [shot-0059](phone/qa-zoo-gorilla-pound-low/shot-0059.png) |

Pounce: the baseline lion only held its scheduler telegraph. Afterward, the fixed arrow corridor is visible before launch; the body lifts during the leap, faces its travel direction and stops at normal contact clearance. The courier remains visible. Pin damage is once per attack; 90 ticks of pin, two attack inputs/two hits for rescue and wall/target-dodge controls are asserted in the sim tests.

Flank: the lion turns to the marked side route during the tell, sprints at 10 m/s and stops at its side point. Its heading follows resolved movement; no continued high speed after recovery. Navigation is authoritative when a gate closes during the tell. A separate target-visibility check lives in autonomous move selection.

Roar: arms alternate across the chest during the tell; an inner origin ring remains visible at the default phone framing, while the outer ring marks 20 m. Nearby regular infected converge on that fixed origin. The source does not reveal an unseen player; overlapping Alpha speed boosts retain their original expiry. The later cyan 5 m tell in the long sheet is the ordinary autonomous follow-up pound.

Pound: the 5 m circle encloses the intended area during the full one-second tell; the courier falls only after activation. The rendered ring uses the same sim radius. Tests cover a target at exactly 5 m, one at 5.001 m and a human behind solid cover.

No visible sustained floating, sinking or jitter in the reviewed sequences. The lion paw probe reports the same 1.2 cm sink before and after; short foot-height zig-zags reach 1–3 consecutive frames during posed turns/landings. No actor was invisible while active in the frustum, and the isolated fixtures report zero prop/actor clipping. The dense stress ring intentionally places 100/200 bars together and is used for counters, not default gameplay framing.

Mixed stress captures: [high](after-budget/shot-0030.png), [low](after-budget-low/shot-0030.png). All 200/100 infected are drawn, at 26 draws and 326,146/185,309 triangles. Metrics include shadows separately. The sim fixture replaces 20% of the horde with lions/gorillas and exercises actual effects at the full 200/100 caps; final p95 is 1.278/0.540 ms against 4/6 ms. An initial timing sample during concurrent capture work exceeded the high budget (7.341 ms); subsequent runs retain the original limits.

Scene Lab actor metrics and per-frame movement traces are retained beside the images. Unit/AI/browser/verify results and exact commands are retained in this report directory. No test limits or spec scope were reduced.
